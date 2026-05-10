# Visual Preferences — User-driven steering of the Director

**Status**: Shipped 2026-05.
**Audience**: Engineers touching the AI video pipeline, the admin Video API Studio, or anyone debugging "why didn't the video look the way I asked for it to look".
**Companion**: [AI_VIDEO_GENERATION.md §3.4](./AI_VIDEO_GENERATION.md) (Director-owned style) — the architectural prerequisite this layer sits on top of.

---

## 0. The thesis

Since 2026-04 the Director LLM owns all per-shot visual decisions (theme, background, shot type, animation language). That solved long-video coherence but **removed the user's last lever** — there was no way to say "I want more cinematic stock footage" or "less text on screen, just narration".

Visual Preferences add that lever back as **soft bias**, not hard quotas:

- Content always wins on conflict. The Director can override any preference and is required to log a `preference_override_reason` when it does.
- Preferences are funneled into the Script LLM, the Act Planner, the Director, and the per-shot HTML stage as text blocks — not as request flags or schema constraints.
- Two channels feed the same resolved view: structured **sliders** in Advanced Settings, and **free-text phrases** in the prompt itself ("use more SVG diagrams", "less text on screen"). Free-text wins on overlap.

Treat this as a steering wheel, not a transmission. The user nudges; the Director steers.

---

## 1. User-facing surface

### 1.1 Sliders (Advanced Settings popover)

Lives at the bottom of the **Advanced** tab in [SettingsPopover.tsx](../../frontend-admin-dashboard/src/routes/video-api-studio/console/-components/SettingsPopover.tsx) — section header **"Visual mix"** with a `Palette` icon. Six controls total:

| Control | Values | What it biases |
|---|---|---|
| Stock video / real footage | Avoid · Auto · Prefer | `VIDEO_HERO` / `IMAGE_HERO` with `video_query` (Pexels / Pixabay) |
| AI-generated imagery | Avoid · Auto · Prefer | shots with `image_prompt` (Seedream) — `IMAGE_SPLIT`, `PRODUCT_HERO`, hero shots without stock |
| SVG / illustrated diagrams | Avoid · Auto · Prefer | `INFOGRAPHIC_SVG`, `KINETIC_TITLE`, `ANNOTATION_MAP` |
| Motion graphics | Avoid · Auto · Prefer | `TEXT_DIAGRAM`, `PROCESS_STEPS`, `DATA_STORY`, `EQUATION_BUILD`, `ANIMATED_ASSET`, `KINETIC_TEXT` |
| App / device UI mockups | Avoid · Auto · Prefer | `DEVICE_MOCKUP` (HTML-rendered app/web/mobile UIs) |
| On-screen text | Minimal · Low · Auto · Rich | per-shot HTML text budget + Director shot-type filter (see §1.4) |

`Auto` is the default and a no-op — selecting it for every control yields an empty preferences object that is dropped before the request leaves the browser.

A small **Active** badge appears next to "Visual mix" whenever any control is non-`auto`. A **Reset** link clears everything back to the all-auto state.

When `On-screen text` is `minimal` or `low` and captions are off, an amber inline warning recommends turning captions on — narration is now load-bearing.

**Tier-aware footnote**: on `free` and `standard` tiers (no Director), the sliders still apply but only at the script level. The footnote explicitly says "On {tier}, family bias is applied via the script. Director-level bias starts at Premium."

### 1.2 Free-text scanner

The IntentRouter Service has a deterministic, regex-only scanner ([intent_router_service.py:319+](../../ai_service/app/services/intent_router_service.py#L319)) that runs against the user's prompt before the LLM router. It looks for phrases per family with a 24-character negation lookbehind window:

| Family | Trigger phrases (sample) | Negation window flips to "no" |
|---|---|---|
| `stock_video` | "stock video", "stock footage", "real footage", "live video", "use videos" | "no/avoid/less/without … stock video" |
| `ai_imagery` | "AI generated images/photos", "AI-generated imagery", "ai images" | same |
| `svg_illustrated` | "infographic", "illustrated", "SVG", "diagrams", "hand-drawn", "sketched" | same |
| `motion_graphics` | "motion graphics", "animated charts", "kinetic typography" | same |
| `app_ui_mockup` | "app UI", "mobile app", "web app", "app screens", "dashboard mockup" | same |
| `text_density` | `minimal`: "no text", "just visuals"; `low`: "less text", "minimize text", "too much text"; `rich`: "lots of text", "title cards everywhere" | (phrase-level, not negation-based) |

If a single prompt matches both polarities for the same family ("more SVG but less stock"), `high` wins — the user expressed positive interest at least once. False-positive guards: `demographic` does not match `graphic`, `there's no app for that` does not match `app_ui_mockup`.

Run: `python3 vacademy_platform/ai_service/tests/test_visual_preferences_scanner.py` (52 unit tests, no venv needed — bypasses pydantic by exec'ing only the scanner block).

### 1.3 Merge — free-text wins on overlap

`merge_visual_preferences(structured, from_text)` is the canonical resolver. For every family/density key:

- Free-text value (non-`None`) wins.
- Otherwise the slider value wins.
- Both `None` → result is `None`.

Why free-text wins: prompts are higher-bandwidth, more recent, and more specific than persistent slider state. Someone who set `stock=no` weeks ago and types "use stock footage" today means today's intent.

### 1.4 What "on-screen text" means at each level

| Level | Per-shot HTML | Director / Act Planner | Notes |
|---|---|---|---|
| `minimal` | Headline ≤ 4 words. No body. ≤ 1 `.tracking-label`. | KINETIC_TEXT **forbidden**. LOWER_THIRD vocabulary banners forbidden. `text_elements` ≤ 1 phrase. | Storytelling-style "let visuals speak". Narration carries everything. |
| `low` | Headline ≤ 7 words. No body. `.tracking-label` ≤ 1. | KINETIC_TEXT discouraged; LOWER_THIRD sparingly. | Cinematic tone; the legacy default for explainers. |
| `auto` (default) | unchanged | unchanged | No-op. |
| `rich` | unchanged | KINETIC_TEXT and LOWER_THIRD freely available. | Tutorial / educational tone, supports glossary callouts. |

**Belt-and-braces safety net**: at `minimal` / `low`, any `KINETIC_TEXT` shot the Director still emits gets locally swapped at render time inside `_shot_task` ([automation_pipeline.py:9596](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L9596)) — `low` becomes `KINETIC_TITLE`, `minimal` becomes `TEXT_DIAGRAM`. The swap rebinds the local variable only; telemetry buckets on the Director's pre-swap choice (see §4).

---

## 2. Schema

`VisualPreferences` is a Pydantic model in [video_generation.py](../../ai_service/app/schemas/video_generation.py) carried as an optional field on `VideoGenerationRequest`:

```python
FamilyBias = Literal["no", "auto", "high"]
TextDensity = Literal["minimal", "low", "auto", "rich"]

class VisualPreferences(BaseModel):
    stock_video: Optional[FamilyBias] = None
    ai_imagery: Optional[FamilyBias] = None
    svg_illustrated: Optional[FamilyBias] = None
    motion_graphics: Optional[FamilyBias] = None
    app_ui_mockup: Optional[FamilyBias] = None
    text_density: Optional[TextDensity] = None
```

Mirrored on the FE in [video-generation.ts](../../frontend-admin-dashboard/src/routes/video-api-studio/-services/video-generation.ts) — same key names, same value enums. The full request body now optionally carries:

```json
{
  "prompt": "...",
  "quality_tier": "ultra",
  "visual_preferences": {
    "stock_video": "high",
    "svg_illustrated": "no",
    "text_density": "low"
  }
}
```

`null` and missing keys are interchangeable — both mean "no preference". The all-auto state is `undefined` on the wire (FE drops the field when no slider is active).

---

## 3. Pipeline integration

```
Request (sliders)        Prompt (free-text)
       │                       │
       ▼                       ▼
 [video_generation_service.py — Slice B resolution]
       │
       │  extract_visual_preferences_from_text(prompt)
       │  merge_visual_preferences(slider, scanned)   ← free-text wins on overlap
       │
       ▼                                   ┌── run_dir/visual_preferences.json (resume cache)
 visual_prefs_resolved ─────────────────┬──┤
       │                                │  └── extra_metadata.user_selections.visual_preferences
       │                                │       + .intent_outcomes.visual_preferences_resolved
       ▼                                ▼
 AutomationPipeline.run(..., visual_preferences=resolved)
       │
       ├── _generate_script_plan()            ← appends build_visual_preferences_script_block()
       │                                         (favors visual_type + image_prompt_hint, sets visual_style hint)
       │
       ├── _run_act_planner() (super_ultra)   ← build_visual_preferences_director_block(prefs, for_act_planner=True)
       │                                         net-bias aggregation per style_direction; opposing biases cancel
       │
       ├── _run_director()                    ← build_visual_preferences_director_block(prefs)
       │                                         per-shot LEAN TOWARD / LEAN AGAINST; preference_override_reason contract
       │                                       └─ post-Director telemetry → run_dir/visual_preferences_realized.json
       │
       └── _shot_task() × N                   ← build_visual_preferences_shot_block(prefs, shot_type)
                                                 per-shot text-density caps; KINETIC_TEXT swap safety net
```

### 3.1 Resolution & resume safety

[video_generation_service.py:1055-1099](../../ai_service/app/services/video_generation_service.py#L1055):

- On first call, scan + merge run once and the result is cached at `<run_dir>/visual_preferences.json` (`raw` slider, `from_text` scan, `resolved` merged view).
- On resume, the cache is read back before doing any work. If the prompt or sliders changed mid-resume, **the cached resolved view wins** — the original run's intent is the source of truth, not whatever happens to be on the request body now.
- The resolved view is also mirrored into `extra_metadata.user_selections.visual_preferences` (request snapshot) and `extra_metadata.intent_outcomes.visual_preferences_resolved` (effective view after free-text scan). The latter is what `getRemoteHistory()` reads for the FE history sidebar.
- A top-level `gen_metadata["visual_preferences"]` mirror is kept so the resume path in [external_video_generation.py](../../ai_service/app/routers/external_video_generation.py) (which doesn't see the request body again) can rehydrate without reaching for `extra_metadata`.

### 3.2 Script-level injection

[prompts.py — build_visual_preferences_script_block](../../ai_service/app/ai-video-gen-main/prompts.py): appended after the `_host_block` in `_generate_script_plan`'s user prompt. Emits a `LEAN TOWARD` list (which `visual_type` enum values to favor in `beat_outline`) and a `visual_style` hint (the LLM-picked image-style filter — "realistic cinematic photograph" for `stock_video=high`, "flat vector illustration" for `svg_illustrated=high`, etc.). Returns `""` for all-auto; never crashes on missing keys.

### 3.3 Director-level injection

[director_prompts.py — build_visual_preferences_director_block](../../ai_service/app/ai-video-gen-main/director_prompts.py) has two modes:

- **`for_act_planner=False`** (full Director): emits `LEAN TOWARD` and `LEAN AGAINST` lists per family, plus the `preference_override_reason` contract — every shot that goes against a stated preference must include a one-sentence justification field. Acts as a soft constraint; the JSON schema doesn't validate the field, but post-Director telemetry counts how many shots used it.
- **`for_act_planner=True`** (Act Planner first pass): the Act Planner picks `style_direction` enum values per act (`cinematic_photo` / `illustrated_infographic` / `product_stage` / `kinetic_text` / `mixed`). The helper aggregates net bias **per style_direction** — opposing family signals (e.g. `stock_video=high` + `ai_imagery=no` both map to `cinematic_photo`) **cancel to neutral** and emit no act-level signal, instead of confusing the planner with contradictions.

The full Director block also carries a one-line on-screen text-density rule (see §1.4 table).

### 3.4 Per-shot HTML injection

[prompts.py — build_visual_preferences_shot_block](../../ai_service/app/ai-video-gen-main/prompts.py): appended after `_stock_instruction` in `_shot_task`'s per-shot prompt assembly. Only emits content for `text_density ∈ {minimal, low}` — both higher densities and the family biases are no-ops at the per-shot HTML level (the family bias was already resolved at Director time; this is the budget cap only).

The KINETIC_TEXT → `KINETIC_TITLE` / `TEXT_DIAGRAM` swap (§1.4) happens just above this block in the same function, so the prompt assembly always sees the post-swap shot type.

### 3.5 Frame regeneration path

When the user clicks "Regenerate this frame" in the player, [_build_regen_prompt](../../ai_service/app/services/video_generation_service.py) reads the past run's resolved preferences from `extra_metadata.intent_outcomes.visual_preferences_resolved` (falling back to top-level `extra_metadata.visual_preferences`) and threads them into the regen prompt via the same `build_visual_preferences_shot_block` helper. Family bias is **not** re-applied — regen rewrites HTML for an existing shot type and can't realistically change `shot_type` mid-edit. Only the text-density cap is meaningful.

The helper import is wrapped in try/except with a `logging.warning(...)` on failure so we hear about it if `prompts.py` is ever moved or renamed; regen continues without the block on import error.

### 3.6 Tier behavior matrix

| Tier | Script bias | Director bias | Act-planner bias | Per-shot text caps | KINETIC_TEXT swap |
|---|---|---|---|---|---|
| `free`, `standard` | ✅ | — (no Director) | — | ✅ | ✅ |
| `premium`, `ultra` | ✅ | ✅ | — (single-pass Director) | ✅ | ✅ |
| `super_ultra` | ✅ | ✅ | ✅ (two-pass Director) | ✅ | ✅ |

Lower tiers don't lose the feature — they lose Director-level steering because they don't run a Director. The script-level bias still nudges `visual_type` selection in `beat_outline`.

---

## 4. Observability — `visual_preferences_realized.json`

After the Director plan is finalized, [_run_director](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L7029) emits a telemetry block whenever any preference was set. It buckets every shot into a family using a `shot_type → family` map (HERO shots are split by whether `image_prompt` was set → `ai_imagery`, otherwise `stock_video`), counts `preference_override_reason` occurrences, and writes:

```json
{
  "declared": {"stock_video": "high", "svg_illustrated": "no"},
  "text_density_declared": "low",
  "family_counts": {"stock_video": 5, "motion_graphics": 2, "svg_illustrated": 1},
  "override_count": 1,
  "override_shots": [3],
  "mismatches": ["svg_illustrated=no but 1/8 shots (12%) realized"],
  "shot_total": 8
}
```

The HTML stage merges this file into `extra_metadata.intent_outcomes.visual_preferences_realized` so the FE history view, dashboards, and offline analysis can read declared-vs-realized stats without poking at the run_dir. Also logged inline as `🎨 Visual prefs:` and `⚠️ Visual prefs mismatch:` lines.

### 4.1 Mismatch thresholds

| Declared | Trigger | Why this threshold |
|---|---|---|
| `high` + `0` realized | always warn (any shot count) | A zero hit on a positive preference is a strong "the bias didn't take" signal regardless of length. |
| `high` + `<20%` realized | warn only when shot_total ≥ 5 | Short videos can legitimately have only one or two shots in a family. |
| `no` + `>30%` realized | warn only when shot_total ≥ 5 | One shot in a 3-shot timeline is 33% but doesn't signal real Director defiance. |

The thresholds are intentionally generous: a "mismatch" is a soft signal for tuning the keyword tables and prompt rules later, never a failure. Pipeline runs on regardless.

### 4.2 Known telemetry limitation — KINETIC_TEXT swap

The realized counts use the **Director's** shot type, not the post-swap shot type. With `text_density=low`, a swap from `KINETIC_TEXT` to `KINETIC_TITLE` shifts the actual rendered shot from `motion_graphics` family to `svg_illustrated` family, but the telemetry buckets it as `motion_graphics` (the Director's choice). Acceptable: the swap is a safety net, not the primary signal, and with a perfectly-cooperating Director it should fire zero times.

---

## 5. Design decisions worth knowing

1. **Why not hard quotas** — telling the Director "use exactly 4 stock_video shots" forces it to fight content. Soft bias + override reasons preserves quality on edge cases (a stock-heavy preference on a chemistry-equation video should still yield equation shots).

2. **Why free-text wins on overlap** — typing intent in the prompt is high-bandwidth and recent. Sliders are persistent state; treating them as defaults that the prompt can override matches the way users actually iterate.

3. **Why dropping the field on all-auto** — keeps history snapshots compact, makes "the user has any opinion" a single boolean check (`hasActiveVisualPreferences`), and means `null`/missing/`auto` are all interchangeable on every layer.

4. **Why the Act Planner cancels opposing biases** — the planner picks one `style_direction` enum per act. Sending it `cinematic_photo:+1` and `cinematic_photo:-1` simultaneously confuses the model more than sending nothing. The full Director still sees both signals individually.

5. **Why text density gets its own knob** — it's orthogonal to family bias. A storytelling video can want `motion_graphics=high` AND `text_density=minimal` (animated visuals, narration carries the words). Folding text into family bias would conflate these.

6. **Why the per-shot block only fires at minimal/low** — the rest are no-ops by design. `auto` and `rich` don't need a budget cap; family bias was already resolved at Director time.

---

## 6. File reference

### Backend (Python)

| File | What's in it |
|---|---|
| [app/schemas/video_generation.py](../../ai_service/app/schemas/video_generation.py) | `FamilyBias`, `TextDensity`, `VisualPreferences` types; `visual_preferences` field on `VideoGenerationRequest` |
| [app/services/intent_router_service.py:319+](../../ai_service/app/services/intent_router_service.py#L319) | `_FAMILY_PATTERNS`, `_TEXT_DENSITY_PATTERNS`, `extract_visual_preferences_from_text`, `merge_visual_preferences` |
| [app/services/video_generation_service.py:1055-1099](../../ai_service/app/services/video_generation_service.py#L1055) | Resolution + cache + metadata mirroring |
| [app/services/video_generation_service.py:2890-2920](../../ai_service/app/services/video_generation_service.py#L2890) | Frame regen path — reads resolved prefs, threads into regen prompt |
| [app/routers/external_video_generation.py](../../ai_service/app/routers/external_video_generation.py) | Three call sites: new gen, resume, retry |
| [app/ai-video-gen-main/prompts.py](../../ai_service/app/ai-video-gen-main/prompts.py) | `_VISUAL_PREFERENCE_FAMILY_BIAS` map; `build_visual_preferences_script_block`, `build_visual_preferences_shot_block` |
| [app/ai-video-gen-main/director_prompts.py](../../ai_service/app/ai-video-gen-main/director_prompts.py) | `_DIRECTOR_FAMILY_BIAS` map; `build_visual_preferences_director_block` (two modes) |
| [app/ai-video-gen-main/automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) | `run()` accepts `visual_preferences`; injection in `_generate_script_plan` + `_run_director` + `_shot_task`; KINETIC_TEXT swap; realized.json telemetry |
| [tests/test_visual_preferences_scanner.py](../../ai_service/tests/test_visual_preferences_scanner.py) | 52 unit tests for the scanner |

### Frontend (TypeScript)

| File | What's in it |
|---|---|
| [video-generation.ts](../../frontend-admin-dashboard/src/routes/video-api-studio/-services/video-generation.ts) | `FamilyBias`, `TextDensity`, `VisualPreferences` types; `VISUAL_PREFERENCE_FAMILIES` ordered list; `hasActiveVisualPreferences`; field on `GenerateVideoRequest`; history deserialization |
| [SettingsPopover.tsx](../../frontend-admin-dashboard/src/routes/video-api-studio/console/-components/SettingsPopover.tsx) | `VisualPreferencesPanel` component (5 family sliders + text-density toggle + tier-aware footnote + captions hint) |
| [VideoConsoleWorkspace.tsx](../../frontend-admin-dashboard/src/routes/video-api-studio/-components/VideoConsoleWorkspace.tsx) | History pre-fill (focused merge into `setOptions` — does NOT bulldoze other form fields) |

---

## 7. Testing

### 7.1 Unit tests (no venv needed)

```bash
cd vacademy_platform/ai_service
python3 tests/test_visual_preferences_scanner.py
```

52 cases covering: empty/None inputs, all 5 families, negation polarity, `text_density` patterns, false-positive guards (`demographic`, `there's no app for that`), merge precedence, and the polarity tie-breaker.

### 7.2 Integration sanity (no live LLM needed)

Drop into a Python REPL inside `ai_service/` and:

```python
import sys; sys.path.insert(0, "app/ai-video-gen-main")
from prompts import build_visual_preferences_script_block, build_visual_preferences_shot_block
from director_prompts import build_visual_preferences_director_block

prefs = {"stock_video": "high", "ai_imagery": "no", "text_density": "low"}
print(build_visual_preferences_script_block(prefs))
print(build_visual_preferences_director_block(prefs))                       # full Director
print(build_visual_preferences_director_block(prefs, for_act_planner=True))  # Act Planner aggregation
print(build_visual_preferences_shot_block(prefs, "KINETIC_TEXT"))            # text-density cap
```

All four helpers return `""` when no preference is active. The Director block under `for_act_planner=True` should suppress `cinematic_photo` because `stock=high`+`ai=no` cancel.

### 7.3 End-to-end smoke (dev / local pipeline)

In the Video API Studio:

1. Open Advanced Settings → Visual mix → set `Stock video = Prefer`, `On-screen text = Low`.
2. Type a prompt that doesn't fight the preference (e.g. "make a video about the Amazon rainforest").
3. Generate on `ultra` tier.
4. After the run, check `<run_dir>/visual_preferences_realized.json` — `family_counts.stock_video` should be > 0, `mismatches` should be empty.
5. Pipeline log should contain `🎨 Visual prefs: declared={'stock_video': 'high'} text=low | realized=...`.

Reload the run from history; the sliders should pre-fill from the past run's metadata.

---

## 8. Future work / open ideas

- **Per-act preferences** — let the user say "open with stock, switch to SVG for the explanation" via either timestamps or beat indices. Today it's video-wide.
- **Realized-stats UI** — surface the `family_counts` / `override_count` / `mismatches` block in the admin sidebar so users can see at a glance how closely the Director followed their bias. Currently the data is persisted but only inspected via the run_dir.
- **Tighter free-text grammar** — the regex scanner is deliberately conservative. A small classifier (`bge-small` or similar) could catch more phrasings without exploding false positives.
- **Render-time density override** — let a user re-render with a different `text_density` without regenerating the timeline. Today text density is baked into the per-shot HTML at generation time.
