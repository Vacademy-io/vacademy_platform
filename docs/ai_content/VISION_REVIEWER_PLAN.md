# Vision Reviewer — Implementation Plan

**Status**: Planning. Not yet implemented.
**Owner**: Pipeline team.
**Audience**: Engineers picking up the implementation.
**Companion**: [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md) (esp. §3.8 — animation density validator, which this builds on).

---

## 1. Why this exists

The pipeline currently has **one** post-generation quality gate per shot: the animation density validator (`_validate_shot_animation_density` in `automation_pipeline.py`). It's a regex-based check that counts GSAP tweens and verifies sync-point delays. **It cannot see the output.**

What it can't catch:

| Class of defect | Example |
|---|---|
| Legibility | Title set at `1.2rem` against a busy photo, body text is illegible |
| Hierarchy | The most important word isn't the largest — eye lands wrong |
| Palette violation | Shot uses hardcoded `#3498db` blue instead of the brand `var(--brand-primary)` despite shot-pack rules |
| Subject framing | Generated image is cropped at the subject's face / chin — composition reads broken |
| Visible failures | A `vignette_fade` overlay didn't tear down → next shot is greyed out |
| Layout collapse | Flexbox went sideways at portrait dimensions; two elements overlap |
| Motion stalls | Shot has plenty of GSAP tweens but they all finish at 0.4s and the remaining 4 seconds are dead air |
| Emoji/icon failures | An iconify icon failed to load → rectangular placeholder visible |
| Stock photo mismatch | The Pexels query "tokyo neon" returned a daytime concrete plaza |

The **regex** validator passes all of these. **A vision model looking at the rendered frame catches them in one call.**

This is the highest-leverage quality intervention available — the docs themselves (§2 of the original deep review, "biggest single quality leap") flag this as the top-priority gap.

---

## 2. Mental model

```
Per-shot generation today:
  shot LLM → HTML  →  skill compose  →  animation density validator  →  ✓ ship
                                              │
                                              └─ regex check, can't see output

Per-shot generation with vision reviewer (proposed):
  shot LLM → HTML  →  skill compose  →  animation density validator
                                              │
                                              ▼
                                        Playwright screenshot ×3  (timestamps t=0.3·dur, 0.6·dur, exit)
                                              │
                                              ▼
                                        Gemini-vision call (rubric)
                                              │
                                  ┌───────────┴───────────┐
                                  ▼                       ▼
                              issues=[]                issues=[…]
                                  │                       │
                                  ▼                       ▼
                                ✓ ship              one corrective regen
                                                        │
                                              ┌─────────┴─────────┐
                                              ▼                   ▼
                                          fixed → ship       still bad → ship original
                                                              (per existing
                                                               validator-regen
                                                               policy, §3.8 of
                                                               main doc)
```

The reviewer **fits behind** the existing animation density validator, not in front of it. The animation validator catches "no motion at all" cheaply via regex; only shots that pass that gate go to the more expensive vision call. This avoids paying vision-LLM cost for obviously-broken shots.

---

## 3. Architecture

### 3.1 Three new components

```
ai_service/app/ai-video-gen-main/
├── shot_screenshot_service.py     ← NEW: Playwright pool, takes screenshots from raw HTML
├── shot_visual_reviewer.py        ← NEW: Gemini-vision call + rubric prompt + JSON parsing
└── automation_pipeline.py         ← MODIFY: hook into _shot_task, add tier flag + regen path
```

### 3.2 Screenshot service — three deployment options

| Option | Pros | Cons | Recommended? |
|---|---|---|---|
| **A. Reuse the render server** by adding a `POST /screenshot` endpoint that takes shot HTML + a timestamp and returns PNG bytes. | No new infrastructure. Same Chromium pool that already renders MP4s. Same shadow-DOM scoping behavior — what the reviewer sees is exactly what the MP4 will look like. | Adds a hot path to the render server; needs auth + rate limit. Network round-trip per screenshot (~50–100ms in same VPC). | ✅ **YES** — exactly matches the production rendering surface. |
| **B. Local Playwright pool inside `ai_service`.** | No network. Simplest to test. | Adds ~200MB Chromium dep to `ai_service` image. Two engines to maintain (renderer + reviewer). Subtle drift between what the reviewer sees and what the renderer will produce. | ❌ — drift risk is real. |
| **C. Hosted screenshot SaaS** (urlbox / browserless / shotsherpa). | Zero ops. | External dep + cost. Cannot inject the harness JS that supplies GSAP / KaTeX / etc. — would render shots without their libraries. | ❌ — the harness JS is load-bearing. |

**Picking (A).** Add a thin endpoint to the render worker. The render worker already has the harness page set up — we reuse it via a one-shot mode that takes HTML, advances `gsap.globalTimeline.totalTime(t)` to the requested timestamp, screenshots, returns bytes.

### 3.3 Render worker contract — `POST /screenshot`

```json
// Request
{
  "html": "<style>…</style><div id='shot-root'>…</div>",   // post-_ensure_fonts shot HTML
  "width": 1920,
  "height": 1080,
  "timestamps": [0.6, 1.4, 2.5],                            // shot-relative seconds
  "background": "#0a0e27"                                    // optional fill
}

// Response (multipart or array of base64)
{
  "screenshots": [
    {"t": 0.6, "image_b64": "..."},
    {"t": 1.4, "image_b64": "..."},
    {"t": 2.5, "image_b64": "..."}
  ],
  "ms": 1420
}
```

Auth: same `X-Render-Key` header as `/render`.

Three timestamps per shot, not one — so the reviewer can detect motion presence (frame-to-frame diff) and end-state issues (the vignette overlay not tearing down). For shots <1.2s, two timestamps; for shots <0.6s, one. Cost is mostly fixed per shot regardless of timestamp count (Playwright init dominates).

### 3.4 `shot_visual_reviewer.py` — the vision LLM call

Single function:

```python
def review_shot(
    *,
    screenshots: List[bytes],            # PNG bytes from render worker
    shot: Dict[str, Any],                # the shot dict from Director plan
    shot_pack: Optional[Dict[str, Any]], # for palette/typography compliance check
    canvas: str,                         # "portrait" / "landscape"
    llm_chat: Callable,                  # html_client.chat or similar
) -> Dict[str, Any]:
    """Returns {"passes": bool, "issues": [...], "severity_max": 0-3}"""
```

Model choice: **Gemini 2.5 Flash** (or whichever flash-class vision model is current). The reviewer is a low-stakes, JSON-output classification task — flash-class models handle it cleanly at ~10× the speed and 1/20th the cost of Pro.

Per-shot input:
- 3 PNG screenshots (each ~150 KB at 1920×1080)
- ~1 KB of context: shot type, narration excerpt, visual description, brand palette + font scale tokens

Per-shot output: structured JSON, ~300 tokens.

**One vision LLM call per shot.** The 3 screenshots are sent as a single multimodal user message — flash-class models handle 3 images in one call comfortably.

---

## 4. The rubric

The rubric is the prompt. Treat it as load-bearing — every false-positive issue triggers a corrective regen that wastes tokens, and every false negative ships a flawed shot.

### 4.1 System prompt structure

```
You are a video frame reviewer for an AI-generated educational explainer.
You see 3 screenshots from one shot (early frame, middle frame, exit frame).
Your job: identify SHIPPING-BLOCKING defects, ignore subjective taste calls.

Block the shot ONLY if one or more of these are clearly wrong. Subjective
preferences ("I would have used a different color") are NOT blocking.

CHECKLIST:

1. LEGIBILITY
   - Is every visible text element readable at this resolution?
   - Is contrast against the background sufficient (rough WCAG-AA — 4.5:1 for body, 3:1 for headlines)?
   - Block if: any visible text is illegible (tiny, low-contrast, or behind another element).

2. HIERARCHY
   - Does the eye land on the right element first?
   - Is the most important word/value the largest?
   - Block if: the visual hierarchy actively misleads (e.g. a footnote is bigger than the title).

3. PALETTE COMPLIANCE
   - Compare visible colors against the BRAND PALETTE supplied.
   - Block if: a non-brand hex appears as a primary or accent color (not just neutral text or content-color reds/greens).
   - Do NOT block if: the brand palette appears at lower saturation due to image overlays, or if neutrals are used for body text.

4. SUBJECT FRAMING
   - Is any subject (image hero, product, character) cropped at a damaging point (eyeline, chin, knees)?
   - Is the most important content cut off the frame?
   - Block if: a subject is cropped in a way that breaks readability.

5. LAYOUT INTEGRITY
   - Are elements overlapping in ways that block their content?
   - Did flexbox/grid collapse to a single column where it shouldn't have (or vice versa)?
   - Block if: elements visibly collide (text on top of text, image clipping a label, etc.).

6. MOTION PRESENCE
   - Compare early vs middle vs exit frames. Has anything changed?
   - For shots ≥3s: block if all three frames are identical (static shot).
   - For shots <3s: motion presence is optional.

7. RESIDUAL ARTIFACTS (exit frame only)
   - Is there a vignette overlay still visible at exit?
   - Is there a transition tween mid-flight (e.g. text 70% slid in)?
   - Block if: the exit frame is in the middle of a transition that should have completed.

8. STOCK MEDIA RELEVANCE
   - If the SHOT TYPE is VIDEO_HERO or IMAGE_HERO, does the visible media plausibly match the visual description?
   - Block if: the media is wildly off-topic (e.g. a daytime stock photo for a "neon night alleys" shot).

For each block-worthy issue, return:
- `code`: one of [LEGIBILITY, HIERARCHY, PALETTE, FRAMING, LAYOUT, NO_MOTION, RESIDUAL, IRRELEVANT_MEDIA]
- `severity`: 1 (minor — could ship), 2 (notable — should fix), 3 (must fix — blocks shipping)
- `description`: one sentence pointing at the specific element
- `suggestion`: one sentence telling the regen LLM how to fix it

Rules of engagement:
- ≤4 issues per shot. Pick the most-important.
- If everything looks fine, return {"passes": true, "issues": []}.
- Severity 3 is for genuine breakage. Don't issue a 3 for taste.
```

### 4.2 User prompt — per shot

```
SHOT META:
- Shot type: {shot_type}
- Duration: {duration}s
- Narration: "{narration_excerpt}"
- Director visual direction: "{visual_description}"

BRAND PALETTE (must be the dominant non-neutral colors):
- primary: {palette.primary}
- accent: {palette.accent}
- text: {palette.text}
- background: {palette.background}

FONT SCALE (for legibility reference, font sizes in rem):
- display: {shot_pack.font_scale.display}
- h1: {shot_pack.font_scale.h1}
- body: {shot_pack.font_scale.body}

[3 screenshots attached, labeled "early", "middle", "exit"]

Return JSON only:
{
  "passes": true | false,
  "issues": [
    {"code": "...", "severity": 1|2|3, "description": "...", "suggestion": "..."}
  ],
  "severity_max": 0-3
}
```

### 4.3 Pass / fail logic

- `passes = true` AND `issues = []` → ship
- `passes = false` AND `severity_max == 3` → fire corrective regen (one round)
- `passes = false` AND `severity_max ≤ 2` → log issues but ship (don't waste tokens on minor stuff)

This is intentionally conservative. The reviewer's purpose is to catch the catastrophes, not to pursue perfection.

---

## 5. Pipeline integration

### 5.1 Where the call lives in `_shot_task`

Insert **after** the existing animation density validator and **before** `_ensure_fonts`. Conceptually:

```python
# automation_pipeline.py, _shot_task body — pseudocode

html = self._sanitize_html_content(html)
html = skill_composer.compose(html, ctx)["html"]

# Existing animation density validator (regex)
if self._tier_config.get("shot_animation_validator"):
    issues = self._validate_shot_animation_density(...)
    if issues:
        html, _validator_record_for_entry = self._regen_shot_for_density(...)

# NEW: vision review
if self._tier_config.get("shot_vision_review"):
    review_record = self._review_shot_visually(html, shot, shot_idx, ctx)
    if review_record.get("regen_html"):
        html = review_record["regen_html"]
    # stash on entry for telemetry (same pattern as _validator_record)

html = self._ensure_fonts(html)
entry = { ..., "_vision_review": review_record_or_None }
```

The vision-review helper:

```python
def _review_shot_visually(
    self,
    html: str,
    shot: Dict[str, Any],
    shot_idx: int,
    ctx: Dict[str, Any],
) -> Dict[str, Any]:
    """Screenshot → vision review → optional one-round regen.

    Returns a record dict with {passes, issues, regen_html?, screenshots_url?}.
    Never raises — every failure path returns a no-op record so the shot ships.
    """
```

### 5.2 Tier gate

Add to `QUALITY_TIERS` in `automation_pipeline.py`:

| Tier | `shot_vision_review` |
|---|---|
| `free` | ❌ |
| `standard` | ❌ |
| `premium` | ❌ |
| `ultra` | ❌ |
| `super_ultra` | ✅ |

Initially super_ultra only — keep cost contained while we tune the rubric. Promote to ultra once the false-positive rate is <5% and average review time is <8s/shot.

### 5.3 Skip conditions

The reviewer is skipped (entry is built normally) when:
- Tier flag is off
- Shot type is `KINETIC_TEXT` or `KINETIC_TITLE` (deterministic builders — output is by-construction-correct)
- Shot type is `SOURCE_CLIP` (the visible content is the user's source video, not the LLM's HTML)
- Shot duration is <1.5s (not enough motion signal for the rubric to evaluate)
- Render worker is unreachable (graceful fallback to the existing animation density check only)

### 5.4 Corrective regen prompt

When the reviewer returns `severity_max == 3`, the helper fires one corrective regen using the same chat history pattern as the animation validator:

```python
corrective = (
    "Your previous shot HTML had visible quality issues that block shipping:\n\n"
    + "\n".join(
        f"- [{i['code']}] {i['description']}\n  → {i['suggestion']}"
        for i in issues if i["severity"] >= 3
    )
    + "\n\nRegenerate the shot HTML, keeping the shot pack tokens and "
    "narration unchanged. Address each issue specifically. Return only the "
    "JSON shot object."
)
messages = [
    {"role": "system", "content": system_prompt},     # original per-shot prompt
    {"role": "user", "content": user_prompt},
    {"role": "assistant", "content": raw[:4000]},
    {"role": "user", "content": corrective},
]
```

After regen, **re-screenshot and re-review**. If the regen still fails, ship the **original** (matches the existing `_validator_record` ship-original-on-regression policy from §3.8 of the main doc).

### 5.5 Telemetry record

Each shot entry gains `_vision_review` (stripped before timeline serialization, like `_validator_record`):

```json
{
  "passed_first": false,
  "regen_fired": true,
  "regen_passed": true,
  "issues_pre": [{"code": "LEGIBILITY", "severity": 3, "description": "Title at 1.2rem against busy photo — illegible"}],
  "issues_post": [],
  "shipped": "regen",
  "screenshots_review_url": "s3://.../vision_review/{video_id}/{shot_idx}/early.png",
  "review_ms": 6420,
  "review_cost_usd": 0.00031
}
```

These records aggregate into the run's `_visual_review_summary` for log output:

```
   👁️  Visual review: 9/12 shots passed first try, 2 regen passes, 1 ship-original
   👁️  Top issues: LEGIBILITY×3, PALETTE×1, FRAMING×1
```

Same pattern as the existing `_validator_record` strip / aggregation in `_strip_internal_fields`.

---

## 6. Cost & performance

### 6.1 Per-shot cost

| Component | Time | $ |
|---|---|---|
| Render-worker screenshot (3 timestamps, in-VPC HTTP) | 1.5–3s | infra fixed cost |
| Gemini Flash vision call (3 images + 1 KB text input, ~300 tok output) | 3–6s | ~$0.0008 |
| One corrective regen (~10% of shots) | adds full regen latency | ~$0.04 averaged in |
| **Net per shot** | **+5–9s** parallelizable | **~$0.005 averaged** |

### 6.2 Per-video cost

Typical super_ultra video: 12 shots, 8-way parallel pool.
- Wall-clock latency added: ~12–18s (the slow shots dominate)
- $/video: ~$0.06 (negligible vs the rest of super_ultra at ~$1–2)

### 6.3 Per-month cost (assuming 1k super_ultra videos/month)

- ~$60/month vision LLM
- ~12k extra screenshots on the render worker (which is mostly idle between renders anyway)

### 6.4 Hard cost cap

Add a per-run circuit-breaker: if `_vision_review_total_cost_usd > $0.15` for a single video, skip the reviewer for the rest of that run. Defends against runaway loops and very-long videos.

---

## 7. Failure modes & graceful degradation

| Failure | Behavior |
|---|---|
| Render worker unreachable / 5xx | Skip vision review for the shot. Log `⚠️ vision review skipped — render worker unreachable`. Shot ships as if the tier flag were off. |
| Render worker returns garbled images | Catch on PNG header check. Skip. |
| Vision LLM returns malformed JSON | Parse error → skip review for this shot, log. |
| Vision LLM rate-limited (429) | Pipeline-wide backoff; if recurring, skip remaining shots' reviews for the run. |
| Vision LLM identifies "issues" but they're all severity ≤2 | Log issues, ship without regen. (The regen path is reserved for severity 3.) |
| Corrective regen ALSO fails review | Ship the **original** HTML (not the regen). This matches the validator-regen ship-original-on-regression policy already in the codebase. |
| Per-run cost cap exceeded | Skip remaining shots for this run, log. |

The cardinal rule: **the vision reviewer must never make a working shot worse**. If anything goes wrong, ship the pre-review HTML.

---

## 8. Implementation phases

### Phase 1 — Render worker `/screenshot` endpoint (1 week)

- Files: `ai_service/render_worker/server.py` (or wherever the render worker FastAPI lives)
- Add `POST /screenshot` accepting the shape in §3.3
- Reuse the existing harness page; add a "screenshot mode" branch that doesn't write video, just dumps PNGs at requested timestamps
- Reuse the existing shadow-DOM injection logic verbatim — what the reviewer sees must equal what the MP4 will produce
- Auth: same `X-Render-Key`
- Bench target: 3-timestamp request returns in <2.5s p95 for a 1920×1080 shot

### Phase 2 — `shot_screenshot_service.py` client (1 day)

- Files: `ai_service/app/ai-video-gen-main/shot_screenshot_service.py`
- Thin HTTP client: `take_shot_screenshots(html, width, height, timestamps) -> List[bytes]`
- Retry on 5xx (max 2), no retry on 4xx
- Cleanup on timeout

### Phase 3 — `shot_visual_reviewer.py` (3 days)

- Files: `ai_service/app/ai-video-gen-main/shot_visual_reviewer.py`
- One function `review_shot(...)` returning the structured record
- Prompt locked in as a frozen string (any changes get a version bump for telemetry)
- JSON parse with the same forgiveness pattern as `subject_extractor._parse_subjects_json`
- Unit tests with fixed image fixtures

### Phase 4 — Pipeline integration in `_shot_task` (3 days)

- Files: `ai_service/app/ai-video-gen-main/automation_pipeline.py`
- New helper `_review_shot_visually` co-located with `_validate_shot_animation_density`
- Tier flag wired into `QUALITY_TIERS["super_ultra"]`
- Strip `_vision_review` in `_strip_internal_fields`
- Per-run cost tally on `self._vision_review_run_cost_usd`

### Phase 5 — Rubric tuning (ongoing, 1–2 weeks)

- Run on 50 representative super_ultra prompts
- Capture screenshots + reviewer outputs to a labeled directory
- Hand-label what should-have-passed-but-didn't (false positives) and what-should-have-blocked-but-passed (false negatives)
- Iterate on the rubric prompt
- Promote to ultra tier when false-positive rate <5%

### Phase 6 — Documentation update (½ day)

- Add §3.17 to `AI_VIDEO_GENERATION.md` mirroring the §3.8 animation-validator section
- Update §11 troubleshooting with new symptoms (regen-fired-too-often, render-worker-screenshot-timeouts)
- Update §10 testing checklist

---

## 9. Open questions

1. **3 timestamps or 1?** 1 is cheaper but misses motion-presence detection. 3 is more conservative. Start with 3, drop to 1 if costs are higher than expected.
2. **Resolution downsampling.** Send full-res screenshots or 1024-wide? Full-res reads small text reliably; downsampled is 4× cheaper. Suggest sending 1024-wide for the rubric pass and only escalating to full-res when severity ≥3 to surface to a human review queue. **Open until we have data.**
3. **Concurrent regens.** If 3 shots out of 12 fail review and all fire regen, the burst doubles HTML-LLM cost briefly. Cap with a semaphore? Per-run regen budget? Suggest cap = 30% of shots; if more than 30% fail, the issue is upstream (Director or shot pack), not in any single shot.
4. **Composition with the existing animation validator.** Both can fire on the same shot. Order matters: animation validator first (cheap regex) catches dead-air shots before we pay for screenshots. Confirmed in §5.1.
5. **Ship the regen even if it has fewer issues but didn't pass `severity_max < 3`?** Same logic as the animation-validator regen: if regen has ≥1 issue more than the original, revert to original; otherwise ship regen.
6. **Per-shot vs per-video review.** Shot-level is what's spec'd here. A video-level review (does the timeline as a whole flow well) is a separate, much-harder problem — out of scope for this plan.
7. **Vision model choice.** Gemini Flash is the default. Claude Haiku 4.5 is also viable and ~30% cheaper. Run both on a labeled set during Phase 5 and pick by accuracy/cost ratio.
8. **Caching.** If the same shot HTML is reviewed twice (re-render after a frame regen), should we hash and cache? Probably not — frame regen produces different HTML by definition. Skip caching for v1.

---

## 10. Verification plan

### 10.1 Unit tests

- `shot_screenshot_service`: hit the render worker against a known-good shot HTML; assert 3 PNGs returned with sane dimensions.
- `shot_visual_reviewer`: feed pre-captured screenshot fixtures + expected JSON output; assert parse succeeds and rubric matches.
- `_review_shot_visually` graceful failure: mock `take_shot_screenshots` to raise → assert no exception propagates, no `_vision_review` stash, shot ships.

### 10.2 Integration tests

- **End-to-end happy path**: super_ultra prompt → all 12 shots pass first review → no regen → console shows `👁️  Visual review: 12/12 shots passed first try`.
- **Forced bad shot**: handcraft a shot HTML with a 0.6rem title and a busy bg → reviewer must return `severity_max == 3` with `code=LEGIBILITY` → corrective regen fires → re-review passes (or ship-original record stashed).
- **Render worker down**: temporarily route `/screenshot` to 503 → all shots ship without review, log line per shot.
- **Cost cap**: hand-set `RENDER_WORKER_SCREENSHOT_TIMEOUT=1` to force per-shot failures → at $0.15 cumulative, reviewer disables for rest of run → log line confirms.

### 10.3 Quality regression test

Hand-curate 20 known-good shots and 20 known-bad shots (manually screenshot/labeled). Track:
- True-positive rate (bad shots correctly blocked) — target ≥85%
- False-positive rate (good shots wrongly blocked) — target ≤5%
- Average review latency — target ≤7s p95

Re-run on every rubric prompt change.

### 10.4 Cost dashboard

Add a metric `vision_review_cost_per_video_usd` (mean + p95) and `vision_review_regen_rate` (fraction of shots that fired regen). Watch for week-over-week drift.

---

## 11. Out of scope (for v1)

- **Video-level review** — does the timeline as a whole feel coherent? Different problem; needs a different pass that sees multiple shot screenshots together.
- **Audio review** — narration quality, BGM/SFX balance. Different sense modality; future work.
- **Reviewer-driven shot selection** — having the reviewer choose between multiple candidate generations. Doable but adds 2× cost; defer to a separate experiment.
- **User-facing review UI** — letting the user see the reviewer's flagged issues per shot. Useful but not necessary for the quality lift; layer on later.
- **Adversarial prompts to the reviewer** — making the reviewer robust against shot HTML containing instructions to ignore the rubric. Low risk because the reviewer is a vision call (text-injection inside a screenshot wouldn't work) but worth a single-paragraph note in the eventual rubric prompt.

---

## 12. Effort estimate

| Phase | Effort |
|---|---|
| 1. Render worker `/screenshot` endpoint | 1 week |
| 2. Screenshot client | 1 day |
| 3. Vision reviewer module + rubric prompt | 3 days |
| 4. Pipeline integration | 3 days |
| 5. Rubric tuning | 1–2 weeks |
| 6. Documentation | ½ day |
| **Total** | **~3 weeks of focused work**, plus rolling rubric tuning |

The biggest unknown is rubric tuning. The mechanical implementation lands in ~2 weeks; getting the rubric calibrated to <5% false-positive rate is the long pole.

---

## 13. Definition of done

This feature is "shipped" when **all** of the following hold:

1. Render worker `POST /screenshot` returns 200 in <2.5s p95 for a 1920×1080 shot
2. `shot_visual_reviewer.review_shot` returns valid JSON in 100% of test runs (no parse errors leak)
3. End-to-end on super_ultra: console shows `👁️  Visual review: N/M shots passed first try, K regen passes` lines
4. Quality regression set: ≥85% true positives, ≤5% false positives
5. Median per-video cost of the reviewer ≤$0.10
6. Median per-video latency added by the reviewer ≤30s
7. Documentation §3.17 written + linked from §3.8 + §11 + §13 glossary
8. Per-run cost circuit breaker tested (manual test with low cap)
9. Graceful degradation tested (render worker down → no exceptions, shots still ship)
10. Telemetry: `_vision_review` field on entries, stripped before timeline ships, surfaced in run-summary log

---

## 14. References

- [AI_VIDEO_GENERATION.md §3.8](./AI_VIDEO_GENERATION.md) — animation density validator (the cheaper sibling this builds on)
- [AI_VIDEO_GENERATION.md §3.16](./AI_VIDEO_GENERATION.md) — image continuity (similar pattern for tier-gated, fail-graceful enrichment)
- The existing `_validate_shot_animation_density` in `automation_pipeline.py` — copy its structure (regen-once-then-revert) for the vision-review regen path
