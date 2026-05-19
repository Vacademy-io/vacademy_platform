# AI Video Generation — Architectural Changes

**Status**: shipped 2026-05. End-to-end live behind a per-run toggle on ultra+ tiers.
**Audience**: engineers maintaining the AI video pipeline, frontend toggle, or anything that consumes `narration.mp3` / timeline entries.
**Scope**: a complete record of WHAT changed when fal.ai Veo 3.1 Lite was added, WHY each decision was made, and WHICH bugs were caught along the way. Reading the source is the canonical record; this doc is the map.

For the *user-facing feature reference* see [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md) (the "AI video generation" section at the end).

---

## 1. What this feature does (one paragraph)

A user with `quality_tier ∈ {ultra, super_ultra}` can toggle "Enable AI video" in Advanced Settings. When on, the Director may emit `AI_VIDEO_HERO` shots (full-canvas Veo clips) and the per-shot HTML LLM may drop inline `<aivideo>` tags inside composite shots. Shots ≤8s use Veo's text-to-video; shots >8s use a chain of text-to-video → image-to-video conditioned on each prior segment's last frame, then ffmpeg-concat into one MP4. An optional "Veo audio" toggle lets AI video shots bring their own audio — master narration is silenced in those windows so they play alone. A $1.50 per-video circuit breaker prevents runaway cost; every failure path falls back to a non-AI shot type so the video always ships.

---

## 2. The architectural picture (before → after)

### Before
- Pipeline: Script → TTS → Words → Director → HTML (per shot) → Avatar → Render
- Visual paths: AI image (Seedream), stock video (Pexels/Pixabay), avatar talking-head (fal.ai Kling)
- Master narration: one monolithic `narration.mp3`, played end-to-end across every shot
- Audio policy: implicit; master narration always plays, nothing else does (except SOURCE_CLIP via a special flag)

### After
- **Pipeline order REORDERED on v2 (2026-05 Phase B)**: when `tts_per_shot_enabled` AND `use_director` AND the run reaches the html stage, the TTS stage becomes a no-op and per-shot TTS runs AFTER the Director plans shots. Flow on v2: `script (incl. BeatPlanner) → tts deferred → words deferred → html (Director → AudioPolicyPlanner → per-shot TTS → concat narration.mp3 → reconcile shot timings → HTML gen → render)`. The TTS chars / words / audio_path artifacts land at the same on-disk paths as the legacy monolithic flow (`narration.mp3`, `narration_raw.json`), so downstream consumers (S3 upload, editor preview, render server) need no changes. Legacy v1 path is preserved on three fallback conditions: (a) free/standard tier (no Director), (b) target_stage < HTML (no html stage to run TTS in), (c) Director returns None/empty (caught and falls back to monolithic TTS).
- New visual path: **fal.ai Veo 3.1 Lite** — full-canvas (`AI_VIDEO_HERO`) AND inline (`<aivideo>` tags)
- New first-class field: **`shot["audio_policy"]`** — `narration_only` (default) or `intrinsic_only` (for shots whose own audio plays alone)
- New stage between Director and HTML: **AudioPolicyPlanner** assigns `audio_policy` per shot
- New post-HTML / pre-render step: **master-narration silence** — ffmpeg-zeros narration in `intrinsic_only` windows, atomic-swaps the muted file into `narration.mp3` so all downstream consumers (S3 upload, editor preview, render server) see the correct mix
- New per-run state: **`AiVideoCostTracker`** (thread-safe budget guard with try_charge/refund/summary semantics)
- Per-shot TTS infrastructure (Phase 0) is present but not wired into the main flow yet — exists for future per-shot editing UX
- **BeatPlanner → Director bridge (Phase 1.5, 2026-05)**: `beat_planner_enabled` flipped to True on all 5 tiers. `to_script_plan_beat_outline()` converts BeatPlanner output into the legacy `beat_outline` shape, then overrides `script_plan["plan"]["beat_outline"]` before the Director runs. The Director still consumes word timings on v1 (TTS-first ordering); v2 reorder is the next step.
- **Audio-policy unification (Phase B+1, 2026-05)**: `SOURCE_CLIP` joined `AI_VIDEO_HERO` in `_INTRINSIC_AUDIO_CAPABLE_SHOT_TYPES`. The run-level `mute_tts_on_source_clips` flag is now plumbed into `plan_audio_policy()` (both new-run and resume call sites). When set, SOURCE_CLIP shots get `audio_policy=intrinsic_only` — per-shot TTS skips them, master narration has silent gaps in those windows, source audio plays alone via the existing render-compose path. Replaces the parallel `_mix_audio_with_source_clips` muting (which still runs on v1 fallback). One audio path now covers Veo audio + source-clip audio + future music-driven moments — same primitive, same decision point.
- **Pipeline UI taxonomy (Phase 1.5)**: new `beats` node in `PipelineNodeId` union; appears between Pitch/[Research?] and Screenplay when `beats_planning` / `beats_done` SSE events fire. Stage row in `PipelinePanel`, detail body in `NodeDetailSheet`.

---

## 3. New modules + their role

| Module | Purpose | Lines |
|---|---|---|
| `app/services/fal_veo_client.py` | Sync `FalVeoClient` over fal.ai's queue submit-poll. Pricing table, payload builders, response-shape detection (3 known shapes), typed exception hierarchy (`VeoError`, `VeoSubmitError`, `VeoSafetyBlocked`, `VeoTimeout`, `VeoQuotaExceeded`, `VeoMalformedResponse`, `VeoPollError`), `get_fal_api_key_from_env()` (canonical: `FAL_API_KEY`; legacy: `FAL_KEY`). | ~370 |
| `app/ai-video-gen-main/ai_video_orchestrator.py` | Three concerns in one file: (a) **shot orchestration** — `orchestrate_ai_video_shot()` single-shot + `orchestrate_ai_video_chain()` multi-segment chain; (b) **cost tracking** — `AiVideoCostTracker` thread-safe budget with `try_charge`/`refund`/`summary`; (c) **audio mute helpers** — `collect_intrinsic_audio_ranges`, `silence_audio_ranges`, `mute_master_narration_for_intrinsic_shots`. Plus ffmpeg subprocess wrappers and `<video>` HTML builder. | ~1,200 |
| `app/ai-video-gen-main/ai_video_composer.py` | Inline `<aivideo>` tag composer mirroring `skill_composer.py`. Regex matcher, attribute coercion (duration snaps to {4,6,8}, aspect defaults to canvas, audio gated by host shot's policy), CSS-gradient placeholder fallback. | ~280 |
| `app/ai-video-gen-main/audio_policy_planner.py` | `plan_audio_policy(shots, ai_video_audio_enabled)` — assigns `audio_policy=intrinsic_only` to shots where shot_type=AI_VIDEO_HERO AND `ai_video_audio=True` AND run audio is enabled. Otherwise `narration_only`. Idempotent — safe to re-run on checkpoint-loaded plans. | ~150 |
| `app/ai-video-gen-main/beat_planner.py` | (Phase 1 module, not yet wired into main flow.) LLM-driven beat planning + normalization with 9 `BEAT_VISUAL_TYPES` and 7 `BEAT_INTENT_ROLES` enums. Forward-compatible with legacy `beat_outline`. | ~340 |
| `app/ai-video-gen-main/default_shot_mapper.py` | (Phase 1 module, not yet wired.) Pure-Python beat → shot mapper for free/standard tiers (no LLM). `VISUAL_TYPE_TO_SHOT_TYPE` table. | ~140 |

---

## 4. Modified existing modules

| Module | What changed |
|---|---|
| `app/ai-video-gen-main/automation_pipeline.py` | `QUALITY_TIERS` gained `tts_per_shot_enabled`, `beat_planner_enabled`, `ai_video_eligible`, `ai_video_per_video_cost_cap_usd`. `run()` signature gained `ai_video_enabled` + `ai_video_audio_enabled`. Constructor block initializes `_ai_video_run_enabled`, `_fal_veo_client`, `_ai_video_cost_tracker` with graceful downgrades on tier/key/import failure. New `_build_ai_video_uploaders()` factory closes S3 service over per-run name → mp4 + frame uploaders. `_shot_task` AI_VIDEO_HERO branch dispatches single vs chain; on failure downgrades shot_type and falls through. Inline composer wired between skill_compose and `_ensure_fonts`. `_inherit_keys` extended with Phase 1/2/3 fields. `_VISION_REVIEW_SKIP_SHOT_TYPES` adds `AI_VIDEO_HERO`. `_decompose_shot` skip-list adds `AI_VIDEO_HERO`. `_shot_to_family` adds `"AI_VIDEO_HERO": "ai_video"`. Director prompt assembly conditionally appends `build_ai_video_director_block`. Per-shot system prompt conditionally appends `build_ai_video_inline_teaching_block`. After Director plan finalizes (BOTH new-run AND resume-from-checkpoint paths) `plan_audio_policy` is called. Before `_render_video` the master narration is muted in intrinsic windows + atomic-swapped. End of `run()` writes `<run_dir>/ai_video_summary.json`. |
| `app/ai-video-gen-main/director_prompts.py` | New `build_ai_video_director_block(enabled, audio_enabled, cost_cap_usd)` — appended to Director system prompt only when AI video enabled. Teaches AI_VIDEO_HERO shot type, per-shot fields, Option A (`ai_video_segments`) vs Option B (auto-split) for >8s shots, hero-pacing rule, optional fallback hint via `video_query`, audio variant. |
| `app/ai-video-gen-main/shot_type_cards.py` | New `build_ai_video_inline_teaching_block(enabled, audio_enabled, cost_cap_usd)` — appended to per-shot system prompt for non-specialized shot types. Teaches `<aivideo>` tag syntax + attributes + audio gating. |
| `app/ai-video-gen-main/shot_template_composer.py` | `_SPECIALIZED_SHOT_TYPES` adds `AI_VIDEO_HERO` (templates would shadow Veo content). |
| `app/services/intent_router_service.py` | `_FAMILY_PATTERNS` gains `ai_video` (regex covering "AI video", "Veo", "generative video", "generated clips", standard 24-char negation lookbehind). `extract_visual_preferences_from_text` and `merge_visual_preferences` carry the new family. |
| `app/services/video_generation_service.py` | `generate_video_to_stage` + `run_video_generation_pipeline` signatures gain `ai_video_enabled` + `ai_video_audio_enabled`; forwarded to `pipeline.run()`. |
| `app/routers/external_video_generation.py` | New-gen call site forwards from request body. Resume + retry paths rehydrate from saved metadata. |
| `app/schemas/video_generation.py` | `VisualPreferences.ai_video?: FamilyBias`. `VideoGenerationRequest.ai_video_enabled`, `ai_video_audio_enabled`, `ai_video_model`. |

### Frontend
| Module | What changed |
|---|---|
| `routes/video-api-studio/-services/video-generation.ts` | New types: `AiVideoModel`, `AI_VIDEO_MODELS`. `VisualPreferences.ai_video` + entry in `VISUAL_PREFERENCE_FAMILIES`. `GenerateVideoRequest.ai_video_enabled`, `ai_video_audio_enabled`, `ai_video_model`. `DEFAULT_OPTIONS` defaults. History rehydration in `getRemoteHistory` via `pickBool` / `pickStrOrUndef`. |
| `routes/video-api-studio/console/-components/SettingsPopover.tsx` | New `AiVideoPanel` component between `sub_shots_enabled` and `VisualPreferencesPanel`. Three controls: master Enable, model dropdown, Veo audio. Tier-gated disabled state with amber notice when tier < ultra. Beta badge. |

---

## 5. Two critical bugs caught during deep review

### Bug R1: Audio toggle was functionally dead

**Symptom**: User toggles "Veo audio" → backend logs say AI video enabled with audio=on → but the Veo API is called with `generate_audio=false` for every shot and master narration is never muted.

**Root cause**: The orchestrator's audio gate (`_resolve_audio_flag`) requires `shot.audio_policy == "intrinsic_only"` to enable Veo audio. The `audio_policy` field is set by `AudioPolicyPlanner.plan_audio_policy()`. **But no production code path was actually calling `plan_audio_policy`.** Unit tests called it manually so they passed, masking the bug. The stub existed; it just was never invoked.

**Fix**: pipeline.run() now calls `plan_audio_policy(_director_plan["shots"], ai_video_audio_enabled=...)`:
- After `_run_director` returns a fresh plan
- After loading a Director plan from checkpoint (resume path)

Both paths are tested. The planner is idempotent — re-running on a plan that already has `audio_policy` set preserves it (caller-set values are honored over the stub's decision).

**Detection**: Caught by re-reading the Case C pseudo test — noticed the test called `plan_audio_policy` explicitly but production never did. The test was technically green but tested a code path that didn't exist.

### Bug R2: Editor playback would hear narration+Veo collision

**Symptom**: Final rendered MP4 has correct audio (narration muted in Veo audio windows) — but the FE editor preview plays the original (unmuted) master narration alongside the browser-played Veo audio. User hears double audio during preview.

**Root cause**: The mute helper wrote a sidecar `narration_intrinsic_muted.mp3` and passed it ONLY to `_render_video`. The original `narration.mp3` remained on disk. Downstream consumers (S3 upload, editor preview) reference the master by name → they got the unmuted original.

**Fix**: After successful mute, atomic-swap:
- `narration.mp3` (original) → `narration_unmuted.mp3` (backup)
- Sidecar `narration_intrinsic_muted.mp3` → `narration.mp3` (now muted)

Every downstream consumer that reads `narration.mp3` by name gets the muted version. The original is preserved on disk for resume / debugging. Swap failure is logged and the run continues with the original (the only consequence: editor preview has the double-audio bug for that single run; the rendered MP4 still ships correctly since `_render_video` already took the sidecar path before the swap).

### Earlier bugs (logged for completeness)

Phase 0 deep review caught **4** prior bugs that were fixed before they shipped (provider-aware word-format reading, shot_idx type coercion, silence file duration drift, per-shot failure isolation). Phase 3b deep review caught **7** more (Director prompt literal Python expression leakage, broken import fallbacks, missing `shot["shot_type"]` sync on fallback, missing `_skill_audio_events` for shape parity, `_decompose_shot` missing AI_VIDEO_HERO, `_shot_to_family` missing AI_VIDEO_HERO, gross f-string cargo culting).

Total bugs caught + fixed during development: **13**.

---

## 6. Audio path — the precise control flow

This is the trickiest part of the system because there are three audio sources in play:

1. **Master narration** (`narration.mp3`) — the TTS-produced voiceover
2. **Veo audio** (embedded in each `AI_VIDEO_HERO` MP4 when Veo's `generate_audio: true`)
3. **Browser-captured audio** (whatever the `<video>` elements in the rendered HTML play during capture)

The render server's final audio mix = master narration + browser-captured. The challenge: when a `<video>` is unmuted (intrinsic_only shot), the browser plays Veo audio, AND master narration would also play unless silenced.

### Control flow for `audio_policy = intrinsic_only`

```
Request: ai_video_enabled=true, ai_video_audio_enabled=true (ultra+ tier)
   │
   ▼
Director plan finalizes with shots; some have ai_video_audio=true
   │
   ▼
plan_audio_policy(shots, ai_video_audio_enabled=True)
   │
   │   For each shot:
   │     if shot_type=AI_VIDEO_HERO AND ai_video_audio=True:
   │       audio_policy = "intrinsic_only"
   │     else:
   │       audio_policy = "narration_only"
   │
   ▼
For each shot, _shot_task:
   │
   ├─ shot_type=AI_VIDEO_HERO + audio_policy=intrinsic_only:
   │    orchestrator calls Veo with generate_audio=true ($0.05/s rate)
   │    orchestrator emits <video src=... UNMUTED loop> in HTML
   │    entry._ai_video_audio_on = True
   │
   └─ shot_type=AI_VIDEO_HERO + audio_policy=narration_only:
        orchestrator calls Veo with generate_audio=false ($0.03/s rate)
        orchestrator emits <video src=... MUTED loop> in HTML
        entry._ai_video_audio_on = False
   │
   ▼
Timeline assembled, entries have _ai_video_audio_on for the audio_on shots
   │
   ▼
collect_intrinsic_audio_ranges(entries) → [(start, end), ...]
   │
   ▼
ffmpeg silence narration.mp3 in those windows → narration_intrinsic_muted.mp3
   │
   ▼
Atomic swap:
   narration.mp3 → narration_unmuted.mp3 (backup)
   narration_intrinsic_muted.mp3 → narration.mp3 (final)
   │
   ▼
_render_video(audio_path=narration.mp3) — already muted in those windows
   │
   ▼
Render server captures the rendered video frames + plays BOTH:
   - Browser HTML audio (Veo plays during unmuted <video> windows)
   - Master narration audio (silent in those windows due to mute step)
   │
   ▼
Final MP4: in intrinsic_only windows, only Veo audio plays.
           Elsewhere, only master narration plays. ✓
```

### Why this works without re-ordering the pipeline

The original Phase 2b plan called for moving Director to run BEFORE TTS so the Script Generator could emit empty narration for AI-video-audio shots — Master TTS would have a natural gap, no muting needed. That refactor was correctly judged necessary AT THE TIME, but Phase 5 found a simpler route: TTS runs normally, then ffmpeg-mutes the resulting MP3 in specific windows. The cost is ~$0.001 of wasted TTS per intrinsic shot (the narrator pronounces words that get muted) — acceptable.

---

## 7. Cost model and circuit breaker

Pricing table (locked to 720p, the only resolution we ship). USD is the source of truth — credits derive via the live `credit_rate_config` ratio (seed 150×):

| Audio | $/s · cr/s | 4s call ($ · cr) | 6s call ($ · cr) | 8s call ($ · cr) |
|---|---|---|---|---|
| off | $0.03 · 4.5 cr | $0.12 · 18 cr | $0.18 · 27 cr | $0.24 · 36 cr |
| on  | $0.05 · 7.5 cr | $0.20 · 30 cr | $0.30 · 45 cr | $0.40 · 60 cr |

Per-video cap: **$1.50 · 225 cr** on ultra and super_ultra tiers (`ai_video_per_video_cost_cap_usd`; credit equivalent derived at runtime via `credit_rate_config`).

Enforced by `AiVideoCostTracker.try_charge(amount)`:
- Atomic increment under a thread lock — concurrent shots can't both sneak past the cap
- Raises `CircuitBreakerExhausted` (caught by orchestrator → fallback path) when the next call would exceed
- `refund(amount)` rolls back budget when a Veo call fails (transient errors don't permanently eat budget)
- `summary()` returns telemetry dict written to `<run_dir>/ai_video_summary.json` at end of run

**Global credit ledger integration (Phase 2, 2026-05):** every successful `try_charge` is paired with an `AiVideoLedger.charge(...)` that writes a `USAGE_DEDUCTION` row to `credit_transactions` (`request_type="ai_video"`, `batch_id=video_id`). On Veo failure / cache-hit / mid-chain abort, the ledger writes a matching `REFUND` row. Per-shot timeline entries now carry both `_ai_video_cost_usd` and `_ai_video_cost_credits`. On insufficient balance at charge time (race past pre-flight), the tracker reservation is rolled back and the shot falls back exactly like `CircuitBreakerExhausted` — see `ai_video_ledger.py` for details.

**Veo-aware pre-flight (Phase 2d, 2026-05):** `POST /external/video/v1/generate` now refuses with HTTP 402 when `ai_video_enabled=true` and the institute's balance is below the worst-case Veo cap × current ratio. The check uses `CreditService.get_balance` + `CreditRateService.get_effective_ratio` and runs immediately after the generic `require_credits("video", ...)` dependency.

Chain pre-flight: chain orchestrator charges the FULL chain cost up front before making any Veo call. If the total would exceed cap, the whole chain is rejected — partial chains never ship (a truncated chain would be shorter than the planned shot duration). Ledger emits one charge for the chain total; cache hits and mid-chain failures issue per-segment refunds proportional to USD weight.

Inline tag cost flow: each `<aivideo>` resolution is a separate `try_charge` + `ledger.charge`. When the cap trips mid-shot, the first N tags succeed (and bill), remaining tags resolve to a CSS placeholder. Shot logs `circuit_breaker_partial: true`.

Worst-case bound per video at default flags (audio off): ~6 segments × $0.24 = $1.44 (216 cr) < $1.50 (225 cr) cap. ✓
Worst-case with audio on: 1 segment × $0.40 (60 cr) + remaining gets clipped by cap. ✓

---

## 8. Fallback policy

Every failure path produces a shippable video — no hard errors propagate to the user.

| Failure | Fallback |
|---|---|
| Veo 4xx (safety block) | Orchestrator returns `VeoSafetyBlocked` result; `_shot_task` downgrades shot_type to VIDEO_HERO (if `video_query` set) or IMAGE_HERO, strips ai_video_* fields, falls through to per-shot LLM |
| Veo 5xx / timeout | Same as above |
| Veo 429 (quota) | Same as above; budget refunded |
| Cost cap exceeded | `CircuitBreakerExhausted`; same downgrade path |
| Director emitted AI_VIDEO_HERO on disabled run | Silent downgrade; no Veo call attempted |
| Missing `ai_video_prompt` | `AiVideoSpecError`; downgrade |
| S3 unavailable for chain | Chain rejected → degrade to single-segment via simpler path |
| ffmpeg last-frame extract fails | Chain rejected; downgrade |
| ffmpeg concat fails | Chain rejected after segments produced; downgrade (cost spent is logged but unused) |
| Master narration mute ffmpeg fails | Ship with original narration (audio collision in intrinsic windows, but render succeeds) |
| Atomic swap fails | Same as above — sidecar exists for forensic comparison |
| Inline `<aivideo>` tag failure | Tag resolves to CSS gradient placeholder; shot ships |

Cardinal rule: **a failure in the AI video stack must never make a working video worse**. The pipeline's existing visual paths (Seedream, Pexels, motion graphics) are the always-available fallback.

---

## 9. Telemetry produced per run

`<run_dir>/ai_video_summary.json`:

```jsonc
{
  "cap_usd": 1.50,        "cap_credits": 225.0,
  "spent_usd": 0.72,      "spent_credits": 108.0,
  "remaining_usd": 0.78,  "remaining_credits": 117.0,
  "shots_completed": 3,
  "shots_failed": 0,
  "shots_skipped_circuit_breaker": 0,
  "ai_video_enabled": true,
  "ai_video_audio_enabled": false,
  "single_shot_count": 1,
  "chain_shot_count": 2
}
```

USD and credit fields are written side-by-side per the "keep both for internal accounting" decision: customer-facing surfaces read `*_credits`, internal/forensic tooling can still cross-check against `*_usd`. `*_credits` numbers are derived at end-of-run via the live `CreditRateService.get_effective_ratio()`; on lookup failure they fall back to 0 and trust USD as authoritative.

Per-shot entries in `timeline.json` carry:
- `_ai_video_request_id` — fal.ai request_id, useful for debugging
- `_ai_video_url` — the resolved video URL (S3 for chains, fal CDN for singles)
- `_ai_video_cost_usd` — what this shot actually cost in dollars
- `_ai_video_cost_credits` — what was actually deducted from the institute ledger (NEW Phase 2)
- `_ai_video_elapsed_s` — wall-clock for the Veo call(s)
- `_ai_video_segments` — list of `{seg_idx, video_url, duration_s, request_id, cache_hit?}`
- `_ai_video_audio_on` — was Veo's `generate_audio` true for this shot

Corresponding `credit_transactions` rows (NEW Phase 2):
- `request_type="ai_video"`, `model_name="fal-ai/veo-3.1-lite"`, `batch_id=video_id`
- One `USAGE_DEDUCTION` row per single shot, per chain (one row, not per-segment), per inline `<aivideo>` tag
- Matching `REFUND` rows on per-shot Veo failures + chain cache hits + mid-chain aborts
- Full-pipeline failure uses the existing `TokenUsageService.refund_video_credits(video_id)` which sums all batch_id-matching deductions

Pipeline logs a `🎬 AI video summary:` line at end of run when the tracker existed, including credit + USD totals side-by-side.

---

## 10. Pseudo cases the system handles correctly (verified)

These were the deep-review test scenarios that exercise the audio path end-to-end:

**Case A — Pure narration, no AI video.** All shots narration_only. Mute helper is a no-op. `collect_intrinsic_audio_ranges` returns `[]`. Atomic swap never fires. Identical to today's pipeline. ✓

**Case B — Source clip with native VO** (hypothetical future case). Director sets `_audio_policy=intrinsic_only` on a SOURCE_CLIP entry. Mute helper picks it up via the future-proofing `_audio_policy` field (not just `_ai_video_audio_on`). Master narration is silenced during that source clip's window. ✓ (Helper code ready; SOURCE_CLIP native VO support is a separate roadmap item.)

**Case C — Single AI video shot with audio.** Director emits AI_VIDEO_HERO + `ai_video_audio: true`. AudioPolicyPlanner assigns `intrinsic_only`. Orchestrator calls Veo with `generate_audio=true`. Result entry has `_ai_video_audio_on=True`. Master narration muted in [shot.start, shot.end]. Atomic swap. Render mixes correctly. ✓

**Case D — Multiple AI video shots, some audio some silent.** Mixed: shot 2 audio_on, shot 3 audio_off, shot 4 audio_on. Mute helper produces TWO intrinsic ranges (shots 2 + 4), keeps shot 3 narrated. ffmpeg expression: `between(t,...,...)+between(t,...,...)`. ✓

**Case E — Inline `<aivideo>` in composite shot.** Per-shot LLM drops `<aivideo data-audio="true">` inside a side-by-side composite shot. Host shot's `audio_policy=narration_only`. The composer's audio gate silently overrides — inline Veo is muted, no narration collision. ✓ When host shot is intrinsic_only (rare), inline audio is allowed. ✓

**Case F — Chain shot with audio.** 16s AI_VIDEO_HERO with `ai_video_audio: true`. Chain orchestrator pre-flights 2-segment cost ($0.80). Both segments call Veo with `generate_audio=true`. ffmpeg-concat. Single concatenated MP4 carries the Veo audio. Master narration muted in [0, 16]. ✓

**Case G — Max-cost chain trips circuit breaker.** 6-segment audio_on chain = $2.40 > $1.50 cap. Pre-flight rejection BEFORE any Veo call. Tracker shows skipped count incremented. Fallback to non-AI shot. ✓

**Case H — Director emits AI_VIDEO_HERO without prompt.** Orchestrator returns `AiVideoSpecError`. Downgrade path. No exception leak. ✓

**Case I — `FAL_API_KEY` resolution.** Canonical name preferred; legacy `FAL_KEY` still honored as fallback. ✓

---

## 11. Limitations + deferred polish

Documented for the next engineer:

| Item | Status | Workaround |
|---|---|---|
| Per-shot TTS migration | **Phase B shipped 2026-05**: `tts_per_shot_enabled` True on all 5 tiers; main flow on premium+ now defers TTS to html stage and runs `_synthesize_voice_per_shot` + `_concat_master_narration` after Director plans shots. Reconciliation step (`_reconcile_shot_timings_after_tts`) rewrites shot timings from actual MP3 durations. Per-shot mp3s + word timings + script texts are persisted to S3 at `ai-videos/{video_id}/per_shot_tts/shot_NNN.*` (added to html-stage upload list). Each shot in `director_plan.json` carries pre-computed `audio_url` / `audio_words_url` / `audio_script_url` / `audio_duration_s` so the editor reads per-shot audio without an extra S3-listing round-trip. Shots with `audio_policy=intrinsic_only` (Veo+audio) get `audio_skipped: True` instead. | Legacy monolithic TTS remains the fallback when (a) tier lacks `use_director`, (b) target_stage < HTML, (c) Director fails — the run still ships with audio in every case. |
| Director-before-TTS reorder (Phase 2b / Phase B) | **Phase B shipped 2026-05**: Director runs BEFORE per-shot TTS on v2. `_run_director` accepts `words: Optional[]` and the Director prompt surfaces a fallback ("plan from beat narration word-counts using ~150 wpm") when words are absent. Audio duration pre-Director is estimated from BeatPlanner beats' `duration_estimate_s` sum (falls back to `_target_seconds`). | Audio-overrun safety net (script regen at TTS+1.25× target) is bypassed on v2 — risk is much lower since BeatPlanner now sees the correct target_duration (Bug 8 fix). Phase B+1 may add per-shot overrun handling. |
| BeatPlanner main-pipeline wiring | Phase 1 modules wired (2026-05): `beat_planner_enabled` True on all 5 tiers; `to_script_plan_beat_outline()` bridges BeatPlanner output into `script_plan["plan"]["beat_outline"]` before Director runs. FE pipeline UI shows Beats node when `beats_planning` / `beats_done` events fire. | Telemetry-only on history view — `beats_v2.json` URL is not yet in `s3_urls`, so completed runs don't show the Beats node in the diagram. Persisting the URL is a follow-up |
| Editor "Remake with AI" for AI_VIDEO_HERO shots | Frame-regen path uses LLM for HTML; doesn't re-call Veo | The user can edit the timeline.json directly; full UI loop is Phase 8 polish |
| Circuit breaker tally not checkpointed | Resume after pipeline crash restarts the tally at $0 | A mid-crash budget over-spend is bounded by cap × 2 in the worst case; acceptable for now |
| Per-shot Veo MP4s live on fal CDN | Single-shot path uses fal URLs directly (chain path uses S3 for concat output) | fal CDN URLs are stable for hours; resume-after-CDN-expiry is a known limitation |
| Inline `<aivideo>` tag counts not in summary | Only AI_VIDEO_HERO shots aggregated to `single_shot_count` / `chain_shot_count` | Tracker's `shots_completed` does include them in the run-level total; per-tag detail is in stdout logs only |
| Additional audio policies | `intrinsic_under_narration` / `narration_over_intrinsic` enum values exist but planner doesn't assign them | Phase 8 — needs render-stage ducking primitives |
| FE editor preview audio | Plays the muted `narration.mp3` (atomic swap fix) — correct after swap | If swap fails, editor preview hears narration+Veo overlap; final MP4 still correct |

---

## 12. Files reference

### Files this feature added
- [app/services/fal_veo_client.py](../../ai_service/app/services/fal_veo_client.py)
- [app/ai-video-gen-main/ai_video_orchestrator.py](../../ai_service/app/ai-video-gen-main/ai_video_orchestrator.py)
- [app/ai-video-gen-main/ai_video_composer.py](../../ai_service/app/ai-video-gen-main/ai_video_composer.py)
- [app/ai-video-gen-main/audio_policy_planner.py](../../ai_service/app/ai-video-gen-main/audio_policy_planner.py)
- [app/ai-video-gen-main/beat_planner.py](../../ai_service/app/ai-video-gen-main/beat_planner.py) — wired into main flow via `to_script_plan_beat_outline()` (2026-05); Director consumes beats as `beat_outline`
- [app/ai-video-gen-main/default_shot_mapper.py](../../ai_service/app/ai-video-gen-main/default_shot_mapper.py) (not yet wired)

### Files this feature modified
- [app/ai-video-gen-main/automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) — substantial changes (QUALITY_TIERS, run() signature + body, `_shot_task` AI_VIDEO_HERO branch, inline composer call, AudioPolicyPlanner invocation, master narration mute + atomic swap, telemetry summary, 17 shot_type branch sites updated)
- [app/ai-video-gen-main/director_prompts.py](../../ai_service/app/ai-video-gen-main/director_prompts.py) — `build_ai_video_director_block`
- [app/ai-video-gen-main/shot_type_cards.py](../../ai_service/app/ai-video-gen-main/shot_type_cards.py) — `build_ai_video_inline_teaching_block`
- [app/ai-video-gen-main/shot_template_composer.py](../../ai_service/app/ai-video-gen-main/shot_template_composer.py) — AI_VIDEO_HERO added to `_SPECIALIZED_SHOT_TYPES`
- [app/services/intent_router_service.py](../../ai_service/app/services/intent_router_service.py) — `_FAMILY_PATTERNS` adds `ai_video`
- [app/services/video_generation_service.py](../../ai_service/app/services/video_generation_service.py) — signatures + plumbing
- [app/routers/external_video_generation.py](../../ai_service/app/routers/external_video_generation.py) — three call sites (new-gen, resume, retry)
- [app/schemas/video_generation.py](../../ai_service/app/schemas/video_generation.py) — `VisualPreferences.ai_video`, request fields

### Frontend
- [routes/video-api-studio/-services/video-generation.ts](../../frontend-admin-dashboard/src/routes/video-api-studio/-services/video-generation.ts)
- [routes/video-api-studio/console/-components/SettingsPopover.tsx](../../frontend-admin-dashboard/src/routes/video-api-studio/console/-components/SettingsPopover.tsx)

### Companion docs
- [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md) — user-facing feature reference (the new section at the end)
- [VISION_REVIEWER_PLAN.md](./VISION_REVIEWER_PLAN.md) — `AI_VIDEO_HERO` added to skip list
- [VISUAL_PREFERENCES.md](./VISUAL_PREFERENCES.md) — `ai_video` family entry
- [SKILLS_AND_TEMPLATES_AUTHORING.md](./SKILLS_AND_TEMPLATES_AUTHORING.md) — note that `<aivideo>` composer co-exists with skill composer

---

**Maintainers**: when adding a new audio source (e.g. source-clip native VO, uploaded video native audio, music-driven moments), the new field should set `_audio_policy=intrinsic_only` on the timeline entry — `collect_intrinsic_audio_ranges` already future-proofs against this without code changes. When adding a new fail mode in the orchestrator, return a populated `AiVideoShotResult.error` rather than raising — every failure must produce a shippable shot via fallback. When changing the cost cap, update the `ai_video_per_video_cost_cap_usd` value in `QUALITY_TIERS` for ultra and super_ultra — no other place hardcodes it.

---

# May 2026 audit — post-generation gate chain + Director-level lifts

**Status**: shipped 2026-05.
**Audience**: engineers maintaining the per-shot quality gates, Director prompt schema, or credit-cost surface.
**Companion**: [VISION_REVIEWER_PLAN.md §16-§19](./VISION_REVIEWER_PLAN.md) for the rubric-v3 + bbox-lint deep dive.

The audit was driven by `vid_1778774930857_w8cwa1y` (Vacademy×Edzumo client-onboarding announcement, 30s landscape ultra). Frame-by-frame review identified a class of defects the existing checks (animation density validator + vision reviewer v2) silently shipped. None of the failures were Gemini's fault — they came from gaps in the prompts, schema, fallback path, and rubric. Four tiers of fix shipped:

## Tier 1 — Surgical prompt / schema / fallback fixes (Day 1–3)

| Fix | What | File |
|---|---|---|
| 1.1 / 1.2 | Append `OUTPUT FORMAT` (strict JSON envelope) + `TEXT BOUND BOX` (per-orientation char/line caps) to per-shot system prompt | [shot_type_cards.py](../../ai_service/app/ai-video-gen-main/shot_type_cards.py) `build_per_shot_system_prompt` |
| 1.3 | Lower landscape `font_scale.display` 24rem→12rem; `h1` 16rem→8rem (left portrait unchanged) | [automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) `_build_shot_pack` |
| 1.4 | Whitespace-safe accent-word rule: forbid bare `<span color>`; require `&nbsp;` before any colored span. **Added to BOTH `CORE_PREAMBLE` (lower tiers) and `CORE_PREAMBLE_ASPIRATIONAL` (ultra+).** | [shot_type_cards.py](../../ai_service/app/ai-video-gen-main/shot_type_cards.py) |
| 1.4 (pipeline) | `_build_kinetic_text_html` defensive `&nbsp;` join between word spans | [automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) `_build_kinetic_text_html` |
| 1.5 | Fallback card reskin: inherit `shot_pack.palette` instead of hardcoded charcoal; safe-contrast text-color computation gated on hex availability | [automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) (inline fallback in `_shot_task`) |
| 1.6 | Vision reviewer rubric **v2→v3**: promote `TEXT_CLIPPED` from host-only to top-level; add `WHITESPACE_COLLISION` (sev 3) + `BG_DISCONTINUITY` (sev 2, cross-shot) | [shot_visual_reviewer.py](../../ai_service/app/ai-video-gen-main/shot_visual_reviewer.py) |
| 1.7 | `review_shot` accepts `prior_shot_screenshot`; pipeline maintains `_review_thumbnails` cache keyed by shot_idx; mid-frame cached for shot N+1's BG_DISCONTINUITY check | [shot_visual_reviewer.py](../../ai_service/app/ai-video-gen-main/shot_visual_reviewer.py) + [automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) `_review_shot_visually` |

## Tier 2 — Deterministic post-render bbox-lint (the LLM-rubric closer)

The probabilistic vision reviewer will always miss some overflows. Tier 2 ships a `getBoundingClientRect()` walk that catches what the LLM doesn't.

| Component | File |
|---|---|
| Render-worker `POST /bbox-check` endpoint | [render_worker/main.py](../../ai_service/render_worker/main.py) |
| `ScreenshotWorker.bbox_check_shot()` — reuses the `/screenshot` harness/dispatcher; runs JS walker inside the shadow root | [render_worker/screenshot_worker.py](../../ai_service/render_worker/screenshot_worker.py) |
| `ShotScreenshotClient.check_shot_bbox()` HTTP client + `BboxViolation` dataclass | [shot_screenshot_service.py](../../ai_service/app/ai-video-gen-main/shot_screenshot_service.py) |
| `_lint_shot_bbox()` pipeline helper (regen-once-then-ship-original, same shape as density validator) | [automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) |
| Tier flag `shot_bbox_check: True` on `ultra` + `super_ultra` (premium opt-in / off by default) | [automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) `QUALITY_TIERS` |
| Wired between density validator and vision reviewer in `_shot_task` | [automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) `_shot_task` |

Deep dive in [VISION_REVIEWER_PLAN.md §18](./VISION_REVIEWER_PLAN.md).

## Tier 3 — Director-level lifts (pacing + bg continuity + brand-asset + back-half motion)

| Fix | What | File |
|---|---|---|
| 3.1 | **PACING PROFILE**: hook=15% × duration, body=10-13% avg, close=17% × duration. Replaces "2-5s per shot" rule. Worked examples for 30s + 45s. | [director_prompts.py](../../ai_service/app/ai-video-gen-main/director_prompts.py) |
| 3.2 | Per-shot **`background_treatment`** schema field (`brand_solid` / `brand_textured` / `brand_gradient` / `media_hero`) with at-most-2-per-video cross-shot contract. Lazy inheritance from `shot_type` via `_SHOT_TYPE_BG_TREATMENT_DEFAULT` when Director omits the field. Per-shot template gains `Background treatment: {background_treatment}` line + CORE_PREAMBLE teaching rule. | [director_prompts.py](../../ai_service/app/ai-video-gen-main/director_prompts.py) + [automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) `_run_director` + [shot_type_cards.py](../../ai_service/app/ai-video-gen-main/shot_type_cards.py) `CORE_PREAMBLE`/`CORE_PREAMBLE_ASPIRATIONAL` + [prompts.py](../../ai_service/app/ai-video-gen-main/prompts.py) `PER_SHOT_USER_PROMPT_TEMPLATE` |
| 3.3 | Brand-asset enforcement: Director rule that intro/outro/`role:"product_proof"` shots use asset-hostable shot_types. Post-render regex assertion in `_lint_shot_brand_asset` with one corrective regen. | [director_prompts.py](../../ai_service/app/ai-video-gen-main/director_prompts.py) + [automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) |
| 3.4 | Second-beat motion: validator check that shots ≥3s have at least one tween with `delay >= 0.55 × duration`; corrective regen prompts with 4 concrete GSAP idioms; preamble rule (both `CORE_PREAMBLE` and `CORE_PREAMBLE_ASPIRATIONAL`) teaches the pattern with examples | [automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) `_validate_shot_animation_density` + [shot_type_cards.py](../../ai_service/app/ai-video-gen-main/shot_type_cards.py) |

## Tier 4 (partial) — Continuity brief + style ceiling + mask transitions

| Fix | What | File |
|---|---|---|
| L1 — Continuity Brief | `_build_continuity_brief(shots, shot_idx, recurring_motifs)` pure helper builds a ≤300-token cross-shot context block (PRIOR SHOT + NEXT SHOT + RECURRING MOTIFS) from Director-plan fields. Wired into per-shot user prompt. The single biggest fix for the "stateless LLM" gap. | [automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) |
| L1 schema | Director plan top-level `recurring_motifs: [{description, screen_position, when_visible}]` field with prompt rule + lazy-default normalization in `_run_director` | [director_prompts.py](../../ai_service/app/ai-video-gen-main/director_prompts.py) + [automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) |
| 4.1 | `CORE_PREAMBLE_ASPIRATIONAL` gains: **3D PERSPECTIVE LAYERS** (`perspective:1200px` + `translateZ` parallax), **SVG FILTERS** (inline motion-blur / glow `<filter>` defs), **BRANDED EASING VOCABULARY** (look up `shot_pack.ease.snappy` and inline the resolved value — not a literal JS path) | [shot_type_cards.py](../../ai_service/app/ai-video-gen-main/shot_type_cards.py) |
| 4.2 | 4 new mask/clip-path transitions in `TRANSITION_CSS_BLOCKS`: `circle_iris`, `diagonal_wipe`, `hexagon_iris`, `blinds_horizontal`. All target `#shot-root` (shadow-DOM safe). `blinds_horizontal` uses `clip-path:inset()` (curtains parting from horizontal center) — chosen over a 12-point polygon because the latter would have been self-intersecting and rendered unpredictably across browsers. Wired into `_KNOWN_TRANSITIONS` allow-list + Director's TRANSITION_IN options. | [prompts.py](../../ai_service/app/ai-video-gen-main/prompts.py) + [transition_picker.py](../../ai_service/app/ai-video-gen-main/transition_picker.py) + [director_prompts.py](../../ai_service/app/ai-video-gen-main/director_prompts.py) |

### Deferred from Tier 4 (separate scoping)

- **L4 polish pass** (draft → critique → refine on super_ultra) — needs cost monitoring + A/B before promotion.
- **L5 render fidelity bump** to 1920×1080 @ 30fps/60fps — render-worker infra change.
- **L2 + L6 brand kit per institute** — schema + admin UI + scrape integration; ~2-sprint follow-up.
- **Match cuts** (Director schema `match_anchor` + picker logic) — wants brand-kit landed first.
- **Lottie hero shots** — needs lottie-web in the render harness + new shot type + curated Lottie pack.
- **Multi-device choreography** — depends on brand-kit / UI ingestion.

## Bugs caught + fixed inside this audit cycle

Internal review of the Tier 1–4 changes themselves caught 5 deeper bugs that would have shipped:

1. **`_SHOT_TYPE_BG_TREATMENT_DEFAULT`** had a phantom `STAT_HERO` key (no such shot type in `SHOT_TYPE_CARDS`) and missed two real types (`IMAGE_SPLIT`, `ARTICLE_FOCUS`). Real shot types now mapped; phantom removed.
2. **Fallback card** had a dead `_fb_brand.get("text_hex")` reference — `_extract_brand_brief()` doesn't return that key. Cleaned, with a forward-compat comment.
3. **CORE_PREAMBLE coverage gap**: WHITESPACE-SAFE / BACKGROUND CONTRACT / SECOND-BEAT MOTION rules were added only to `CORE_PREAMBLE_ASPIRATIONAL`. Lower tiers (standard/premium) saw the user-prompt `Background treatment:` line with no teaching. Backported the three foundational rules to `CORE_PREAMBLE` too.
4. **Branded-easing rule misreadable as JS**: original text said "`ease: shot_pack.ease.snappy`" — LLM could literally copy that, producing a JS ReferenceError. Rewrote to clarify it's a LOOKUP key; resolved value must be inlined as a literal string.
5. **`blinds_horizontal` self-intersecting polygon**: original 12-point polygon had degenerate edges and rendered unpredictably (browser uses non-zero winding rule on self-intersecting paths). Replaced with clean `clip-path:inset(50% 0% 50% 0%)` → `inset(0% 0% 0% 0%)` animation (curtains parting from horizontal center).

## Cost surface delta

Per ultra video (8 shots): **~+32 credits**. Per super_ultra: **~+45 credits**. Sources broken out in [VISION_REVIEWER_PLAN.md §19](./VISION_REVIEWER_PLAN.md). Updates landed in:
- [external_video_generation.py](../../ai_service/app/routers/external_video_generation.py) — pre-flight `estimated_tokens` bumped at 3 call sites (5000→60000 main; 3000→30000 resume/retry)
- [credit_service.py](../../ai_service/app/services/credit_service.py) — comment on `DEFAULT_PRICING["video"]` noting the new cost-surface drivers
- [docs/AI_CREDITS_PRICING.md](../AI_CREDITS_PRICING.md) — per-tier estimated-credits table refreshed

Per-stage deduction is automatic — every new LLM call (bbox-lint regen, brand-asset regen, vision review with prior_thumb) accumulates into the per-shot `usage` dict and lands in `credit_transactions` via the existing `TokenUsageService.record_usage_and_deduct_credits` flow. No new request_type was introduced — analytics bucketing stays comparable.

---

# Pipeline Reorder v3 — ShotPlanner-first architecture

**Status**: backend wiring shipped 2026-05-15 behind `PIPELINE_VERSION=v3` flag (also per-tier `pipeline_version: "v3"`). v2 remains the default; v3 is opt-in for shadow testing before promotion.
**Audience**: engineers maintaining the AI video pipeline, the editor's audio surface, or anything that reads `timeline.meta.sentences[]`.
**Origin**: user-requested architectural reorder — see [plan-to-make-the-tranquil-engelbart.md](../../../../Users/shreyashjain/.claude/plans/plan-to-make-the-tranquil-engelbart.md) for the full design rationale.

## 1. The problem with v2 ordering

v2 runs LLM calls in the wrong order: **BeatPlanner → ScriptGenerator → Director → per-shot HTML**. Three LLM hops play telephone before any visual planning happens, and the Director (which knows about shots) ends up *slicing* a pre-written monolithic script rather than *authoring* shot-owned narration. Three concrete consequences:

1. **Telephone-game drift.** Each hop loses intent. The Director sees what survived the ScriptGenerator's interpretation of beats — the original prompt's nuances (uploads, AI-video flags, configs) are 2 hops away.
2. **Free/standard fork.** `use_director` is unset on those tiers, so they skip the Director entirely and run a monolithic-only path. Two pipelines to maintain, two surfaces to debug.
3. **Editor can't edit shots.** Audio is one monolithic `narration.mp3` mapped to client-derived sentence clips. The user wants: each shot owns its audio; editing a shot re-narrates only that shot; shots with intrinsic audio have no narration text.

## 2. v3 — what's new

```
PROMPT + CONFIGS + UPLOADS + TIER
        │
        ▼
   ShotPlanner   ──►  shot_plan.json (shots[] with narration_brief, audio_policy,
        │                              background_treatment, transition_in,
        │                              recurring_motifs, intent_role, etc.)
        │                              ONE LLM call — sees everything.
        ▼
  NarrationWriter ──►  shot_plan.json updated (shots[i].narration_text filled)
        │                              ONE LLM call. Single coherent narrator.
        ▼
  Per-shot TTS   ──►  per_shot_tts/shot_NNN.{mp3, json, txt}
        │             narration.mp3 (concat) + narration_raw.json
        ▼
  Per-shot HTML  ──►  HTML/CSS/GSAP + post-render gates (bbox-lint,
        │             vision review v3, brand-asset, density)
        ▼
     Render     ──►  final.mp4 (master narration muted in intrinsic_only windows)
```

Two LLM planning calls (~$0.06–$0.10) replace v2's three (~$0.08–$0.16). The savings compound at scale and apply uniformly across all tiers — free/standard get the same architectural benefits as ultra.

## 3. New modules

| File | Purpose | Lines |
|---|---|---|
| [shot_planner.py](../../ai_service/app/ai-video-gen-main/shot_planner.py) | ShotPlanner — replaces Director's planning role. System prompt absorbs BeatPlanner duty (intent_role enum, pacing profile, max-shot-count). Emits `shots[]` with per-shot `narration_brief` + `audio_policy` + `background_treatment` + `transition_in` + visual fields. Plan-level `recurring_motifs[]`. Standalone, network-free (injected `llm_chat` callable). | ~750 |
| [narration_writer.py](../../ai_service/app/ai-video-gen-main/narration_writer.py) | NarrationWriter — reads ShotPlanner output, authors per-shot `narration_text` in one coherent LLM call. Enforces `audio_policy=intrinsic_only ⇒ narration_text=""`. Single narrator voice across all shots; word count budgeted at 150 wpm × `duration_estimate_s` per shot. | ~320 |

## 4. Modified modules

| Module | Changes |
|---|---|
| [automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) | Added 7 v3 helper methods on `VideoGenerationPipeline` (`_pipeline_v3_enabled`, `_v3_aspect_label`, `_v3_collect_reference_assets`, `_v3_source_clip_available`, `_v3_article_screenshots`, `_v3_write_derived_script_artifacts`, `_run_v3_shot_planning`). Script stage gains a v3 dispatch block right after the target-duration pre-parse — on success, populates `script_plan` from ShotPlanner+NarrationWriter, persists `shot_plan.json` + derived `script.txt`, and short-circuits the v2 BeatPlanner + `_draft_script` + reviews + bridge. The `_v2_tts_deferred` gate is extended with a `_v3_in_play` branch so per-shot TTS runs inside the html stage on v3 the same way it does on v2. The html stage's Director branch checks `self._v3_shot_plan` (and `shot_plan.json` on disk for resume parity) and uses it directly when present — `_run_director` is skipped entirely. AudioPolicyPlanner runs as a defensive normalizer in v3 (`audio_policy` already set per shot by ShotPlanner). `_write_timeline` populates `meta.shots[]` from the active shot plan. |
| [sentence_clip_service.py](../../ai_service/app/services/sentence_clip_service.py) | Added `regenerate_shot()` method, `ShotRegenerateResult` class, `_patch_shot`/`_extract_shots`/`_versioned_shot_clip_key`/`_sync_shot_plan_after_regen` helpers, plus module-level `_find_shot_by_idx` + `_ripple_shots` mirroring the existing sentence equivalents. Shares all the render/S3/TTS plumbing with the sentence path. |
| [external_video_generation.py](../../ai_service/app/routers/external_video_generation.py) | New `POST /external/video/v1/shot/regenerate` endpoint + `ShotClipDto` / `RegenerateShotRequest` / `RegenerateShotResponse` schemas. Refuses (400) when the target shot is `intrinsic_only` or the video has no `meta.shots[]` yet. |
| [types.ts](../../frontend-admin-dashboard/src/components/ai-video-player/types.ts) | New `ShotClip` interface. `TimelineMeta.shots?: ShotClip[]` added; `sentences?` marked `@deprecated`. |
| [sentence-api.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/sentence-api.ts) | New `apiRegenerateShot()` helper + `RegenerateShotResponse` type. Mirrors `apiRegenerateSentence` shape so editor migration is a drop-in. |

## 5. Behavioral guarantees

- **v3 is OFF by default.** Without `PIPELINE_VERSION=v3` (env) or per-tier `pipeline_version: "v3"`, the pipeline runs the existing v2 path unchanged. No production behavior change at this commit.
- **v3 failure falls back to v2.** ShotPlanner or NarrationWriter raising any exception logs and falls through to the v2 path. No run is sacrificed to the new path while it's bedding in.
- **`meta.shots[]` is built for both v2 and v3 timelines.** `_write_timeline` reads from `self._v3_shot_plan` first, then `shot_plan.json` on disk, then `director_plan.json`. So a v2 ultra-tier video also gets `meta.shots[]` — the editor's shot-mode works for any video with a Director plan.
- **Sentence clips remain readable.** `meta.sentences[]` is left intact for backward compatibility; the editor MAY prefer `meta.shots[]` when present but doesn't have to.
- **Resume parity.** A v3 run that crashes mid-html picks up where it left off via `shot_plan.json` on disk; the html stage detects it and uses it directly.
- **Intrinsic-only shots are unwriteable through `/shot/regenerate`.** Source-clip speaker / Veo audio cannot be re-narrated through this endpoint — that's by design. Edit the underlying source asset instead.

## 6. Audio-policy unification

v3 doesn't need `_mix_audio_with_source_clips` (the fade-ordering function that landed in the recent CRITICAL bug fix). Source-clip audio in v3 flows through the same `intrinsic_only` audio policy as AI_VIDEO_HERO+audio:

- ShotPlanner emits `audio_policy=intrinsic_only` on SOURCE_CLIP shots (per the system-prompt rule for source clips with meaningful audible moments).
- AudioPolicyPlanner normalizes (defensive) and honors run-level `mute_tts_on_source_clips`.
- Master narration is silenced in those windows (existing `mute_master_narration_for_intrinsic_shots` path).
- Render-stage `<video>` element plays unmuted → source audio rides the browser-captured channel.

One audio primitive, same code path, no parallel muting logic. v2's `_mix_audio_with_source_clips` stays in the file (still used on v2 runs) but is dead code on v3.

## 7. Tier unification (not yet shipped — planned)

The plan calls for unifying `QUALITY_TIERS` so all five tiers (`free`, `standard`, `premium`, `ultra`, `super_ultra`) run the v3 path; differences become **knobs** (model picks, post-render gate flags) not separate code paths. This is gated on v3 first proving stable in shadow runs. Once unified:

- `free` / `standard` get the same ShotPlanner + NarrationWriter + per-shot TTS + per-shot HTML flow as `ultra`.
- They differ only by `shot_planner_model` (Gemini 3 Flash vs Pro), `shot_bbox_check` (off vs on), `vision_review_enabled`, `ai_video_eligible`, etc.
- `beat_planner.py` + `default_shot_mapper.py` become dead code and are deleted.

This is tracked as a Phase 5 follow-up in the plan; not in this PR.

## 8. Editor frontend follow-up

The `ShotClip` types + `apiRegenerateShot` helper are in place. The PropertiesPanel UI rework — switching from sentence-clip editing to shot-clip editing rows with re-narrate buttons + intrinsic-audio badges — is the next FE work item. Tracked as Phase 4 in the plan.

## 9. Cost surface

Planning LLM cost on v3:

| Run profile | v2 | v3 | Delta |
|---|---|---|---|
| `free` / `standard` (no Director, monolithic script) | ~$0.02–0.04 | ~$0.05–0.08 (ShotPlanner+NarrationWriter on Flash) | **+ ~$0.03**, but with shot planning + per-shot TTS + editor-ready meta.shots[] which v2 free/standard never had |
| `premium` / `ultra` (BeatPlanner + Script + Director) | ~$0.08–0.16 | ~$0.06–0.10 | **− 25-35%** |
| `super_ultra` | ~$0.12–0.20 | ~$0.08–0.14 | **− 30-35%** |

v3 is cheaper for any tier that already runs Director; slightly more expensive for tiers that didn't (but those gain a full Director pipeline they previously lacked).

## 10. What stays

- All post-render quality gates (`_lint_shot_bbox`, `_lint_shot_brand_asset`, `_validate_shot_animation_density`, `_review_shot_visually` v3 rubric) — they operate on per-shot HTML output and are unaffected.
- `AiVideoCostTracker`, fal Veo client, audio mute helpers, AudioPolicyPlanner (demoted to defensive normalizer in v3).
- Per-shot TTS infrastructure (`_synthesize_voice_per_shot`, `_concat_master_narration`, `_synthesize_voice_for_shot`). v3 feeds these `shot.narration_text` directly — same default `narration_key="narration_text"` that already worked on v2.
- `_reconcile_shot_timings_after_tts` — still corrects shot timings from actual MP3 durations after per-shot TTS.
- The existing sentence-clip editor flow (`/sentence/regenerate`, `apiRegenerateSentence`). Both editor units coexist; the editor picks whichever matches the timeline.

## 11. Files reference

### Added
- [app/ai-video-gen-main/shot_planner.py](../../ai_service/app/ai-video-gen-main/shot_planner.py)
- [app/ai-video-gen-main/narration_writer.py](../../ai_service/app/ai-video-gen-main/narration_writer.py)

### Modified
- [app/ai-video-gen-main/automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) — `_pipeline_v3_enabled` + 6 v3 helpers, script-stage dispatch, TTS-defer gate, html-stage Director-skip, `_write_timeline` `meta.shots[]`
- [app/services/sentence_clip_service.py](../../ai_service/app/services/sentence_clip_service.py) — `regenerate_shot()` + `ShotRegenerateResult` + helpers
- [app/routers/external_video_generation.py](../../ai_service/app/routers/external_video_generation.py) — `POST /shot/regenerate` + DTOs
- [frontend-admin-dashboard/src/components/ai-video-player/types.ts](../../frontend-admin-dashboard/src/components/ai-video-player/types.ts) — `ShotClip` type
- [frontend-admin-dashboard/src/components/ai-video-editor/utils/sentence-api.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/sentence-api.ts) — `apiRegenerateShot()` helper

### Pending (next session)
- `PropertiesPanel.tsx` — shot-based editing UI (rows with re-narrate + intrinsic-audio badges)
- Persist `shot_plan.json` in the html-stage S3 upload bundle
- Tier unification + `beat_planner.py`/`default_shot_mapper.py` deletion (after v3 soaks in shadow)

---

# V200 — DB-Backed Per-Stage Model Routing

**Status**: backend + frontend landed 2026-05; always-on once migration `V200__ai_model_stage_assignments.sql` is applied. The matrix seeds day-1 no-op defaults so applying it on a running deploy is a behavior-preserving change. The earlier `STAGE_ROUTING_ENABLED` env flag was removed once verified — resolution now runs on every request; an empty-matrix DB (migration not applied) falls through to the legacy `script_model`/`html_model` path automatically.
**Audience**: engineers touching the AI video pipeline's LLM call sites, the `OpenRouterClient`, or the video-generation request DTO.
**Origin**: the pipeline had 23 LLM call sites but only one model knob (`preferred_script_model` / `preferred_shot_model` on `QUALITY_TIERS`) and one user override (`model: str` on the request). A user picking Pro paid Pro tokens for every utility prompt (cultural-context inference, headline gen); a user picking a cheap model degraded vision review. This change introduces a per-(quality_tier, stage_id) assignment matrix in the DB and a per-stage user-override surface in the existing video-creation `SettingsPopover`.

## 1. The problem

| Symptom | Cause |
|---|---|
| Free-tier and Ultra-tier ran exactly the same models on every LLM call | `QUALITY_TIERS` only declared `preferred_script_model` + `preferred_shot_model`; tier-specific keys like `shot_planner_model` / `narration_writer_model` were *read* but never *set* |
| User override applied globally — Pro for everything or Flash for everything | Resolved in `video_generation_service` lines 712-722, baked into `script_client.default_model` + `html_client.default_model` on construction |
| Vision review hardcoded to Pro in source | `shot_visual_reviewer.py:389`: `model: str = "google/gemini-2.5-pro"` |
| Avatar hardcoded to Kling Standard | tier config literal |
| Cost telemetry recorded `stage="unknown"` for ~20 of 24 LLM call sites | Only the 4 regen sites wrapped with `_llm_stage.set(...)`; the rest used the ContextVar default |

## 2. Architecture

```
POST /external/video/v1/generate
  body: {
    ..., quality_tier: "ultra",
    model_overrides: {
      default: "anthropic/claude-sonnet-4-6",
      per_stage: { regen_html: "google/gemini-3-flash-preview" }
    }
  }
   │
   ▼
video_generation_service.generate()
  │  resolves quality_tier
  │  stage_resolved = AIModelsService(db).get_stage_model_map(
  │    use_case="video", quality_tier=tier, overrides=body.model_overrides
  │  )
  │  → reads ai_model_stage_assignments (1 SQL); per stage:
  │     • per_stage[stage] if user_overridable                    → source="user_per_stage"
  │     • else default if user_overridable                        → source="user_default"
  │     • else admin matrix model_id                              → source="matrix"
  │  empty result (matrix not seeded yet) → fall through to legacy
  │  pipeline_args["stage_model_map"] = {sid: (model_id, source)}
   │
   ▼
VideoGenerationPipeline(stage_model_map=...)
  │  stores on self._stage_model_map (tuples)
  │  copies to script_client.stage_model_map + html_client.stage_model_map
   │
   ▼  (every LLM call site:)
OpenRouterClient.chat(messages, model=?, …)
  • if explicit `model=` passed → use that (helper-module callers + explicit pipeline call sites pass model=_resolve_stage_model(STAGE) here)
  • else if stage_model_map non-empty:
      _runtime_stage = _llm_stage.get()           # ContextVar set by call site or wrapper
      canonical = _normalize_stage_to_taxonomy(_runtime_stage)
      (model_id, source) = stage_model_map[canonical]
  • else fall through to model_chain → default_model
  • cost event records (stage, model, source)
```

The flag-off path skips the resolver entirely, `stage_model_map` is empty on both clients, every `chat()` falls through to the legacy `default_model` — perfect zero-risk no-op.

## 3. Stage taxonomy

Frozen enum in [app/constants/pipeline_stages.py](../../ai_service/app/constants/pipeline_stages.py) — 17 stages bucketed by quality-defining role:

| Stage ID | Bucket | Day-1 seed | user_overridable |
|---|---|---|---|
| `shot_planner` | CRITICAL | gemini-3-flash-preview | ✅ |
| `narration_writer` | CRITICAL | gemini-3-flash-preview | ✅ |
| `per_shot_html` | CRITICAL | gemini-3-flash-preview | ✅ |
| `vision_review` | CRITICAL | **gemini-2.5-pro** | ❌ (pinned) |
| `director` (v2 legacy) | CRITICAL | gemini-3-flash-preview | ✅ |
| `script_generation` (v2 legacy) | CRITICAL | gemini-3-flash-preview | ✅ |
| `script_review` (v2 legacy) | CRITICAL | gemini-3-flash-preview | ✅ |
| `act_planner` | MEDIUM | gemini-3-flash-preview | ✅ |
| `beat_planner` (v2 legacy) | MEDIUM | gemini-3-flash-preview | ❌ |
| `image_prompt_enhancement` | MEDIUM | gemini-3-flash-preview | ❌ |
| `stock_video_ranking` | MEDIUM | gemini-3-flash-preview | ❌ |
| `entity_extraction` | MEDIUM | gemini-3-flash-preview | ❌ |
| `regen_html` | UTILITY | gemini-3-flash-preview | ✅ |
| `cultural_context` | UTILITY | gemini-2.5-flash | ❌ |
| `shot_decomposer` | UTILITY | gemini-3-flash-preview | ❌ |
| `host_description` | UTILITY | gemini-2.5-flash | ❌ |
| `headline_thumbnail` | UTILITY | gemini-2.5-flash | ❌ |

`regen_html` collapses five physical call sites (html_repair, brand_asset_regen, bbox_lint_regen, animation_validator_regen, html quality repair) into one bucket — admins/users shouldn't have to manage five rows for the same intent.

**`vision_review_regen_*` resolves to `vision_review`, not `regen_html`** — the corrective pass for a vision-review defect must run on the same pinned model that flagged the defect; otherwise a cheap-model regen would mask the issue. See [B6 in deep review](#deep-review-disposition).

## 4. New modules

| File | Purpose | Lines |
|---|---|---|
| [app/constants/pipeline_stages.py](../../ai_service/app/constants/pipeline_stages.py) | `PipelineStage` enum, `USER_OVERRIDABLE_STAGES` frozenset, `STAGE_BUCKETS` classification, `is_user_overridable()` helper | ~80 |
| [admin_core_service/.../V200__ai_model_stage_assignments.sql](../../admin_core_service/src/main/resources/db/migration/V200__ai_model_stage_assignments.sql) | New table + 85-row seed (17 stages × 5 tiers) via CROSS JOIN INSERT with `ON CONFLICT DO UPDATE` for re-runnability | ~120 |

## 5. Modified modules

| Module | What changed |
|---|---|
| [app/schemas/video_generation.py](../../ai_service/app/schemas/video_generation.py) | New `ModelOverrides` pydantic class (`default`, `per_stage`) with `model_validator` for format checking (max 200 chars, `provider/model` shape); `model_overrides` field on `VideoGenerationRequest`; legacy `model` marked deprecated |
| [app/services/ai_models_service.py](../../ai_service/app/services/ai_models_service.py) | New `ResolvedModel` dataclass; new `get_stage_model_map(use_case, quality_tier, overrides)` — single SQL read + per-stage override resolution; handles both pydantic `ModelOverrides` and plain dict (resume path) defensively |
| [app/services/video_generation_service.py](../../ai_service/app/services/video_generation_service.py) | `model_overrides` param threaded through `generate_till_stage` + `run_video_generation_pipeline`; resolver runs unconditionally — empty matrix falls back to legacy `script_model`/`html_model` routing; collapses legacy `model` → `ModelOverrides(default=model)`; warns when both legacy `model` and `model_overrides` are sent; projects `ResolvedModel` to `(model_id, source)` tuple for the pipeline |
| [app/routers/external_video_generation.py](../../ai_service/app/routers/external_video_generation.py) | `model_overrides` forwarded on all three call sites (new-gen / resume / retry); resume + retry rehydrate from `_meta["model_overrides"]` |
| [app/ai-video-gen-main/automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) | Module-level `_normalize_stage_to_taxonomy()` mapper; `OpenRouterClient.stage_model_map` field + auto-routing in `chat()` via `_llm_stage` ContextVar (tuple-aware); `VideoGenerationPipeline.__init__` accepts `stage_model_map` and copies to both clients; `_resolve_stage_model()` helper; 11 explicit `chat()` sites pass `model=self._resolve_stage_model("...")`; helper-callable sites (entity_extraction at `_extract_subjects`, headline_thumbnail at `thumbnail_generator`) wrapped with `_llm_stage.set/reset`; ShotPlanner / NarrationWriter / vision_review callers updated to use `_resolve_stage_model` ahead of legacy tier_cfg fallbacks |
| [app/ai-video-gen-main/cost_event_tracker.py](../../ai_service/app/ai-video-gen-main/cost_event_tracker.py) | `CostEvent.source` field (`""` / `"matrix"` / `"user_default"` / `"user_per_stage"`); `record_llm(source=...)` kwarg — lands in `cost_breakdown.json` so forensics can answer "did the user override land at runtime?" |
| [app/ai-video-gen-main/shot_visual_reviewer.py](../../ai_service/app/ai-video-gen-main/shot_visual_reviewer.py) | Hardcoded `model="google/gemini-2.5-pro"` default kept as a safety net for empty stage maps. Pipeline callers now pass `model=self._resolve_stage_model("vision_review") or "google/gemini-2.5-pro"` — Pro stays everywhere unless admin edits the matrix |

### Frontend
| Module | What changed |
|---|---|
| [routes/video-api-studio/-services/video-generation.ts](../../frontend-admin-dashboard/src/routes/video-api-studio/-services/video-generation.ts) | New types: `ModelOverrides`, `UserOverridableStage` (8 stage union), `USER_OVERRIDABLE_STAGE_META` (display labels for the advanced expander); `model_overrides?: ModelOverrides` on `GenerateVideoRequest`; history rehydration in `getRemoteHistory` from `sel['model_overrides'] ?? meta['model_overrides']` |
| [routes/video-api-studio/console/-components/SettingsPopover.tsx](../../frontend-admin-dashboard/src/routes/video-api-studio/console/-components/SettingsPopover.tsx) | New `ModelOverridesPanel` sub-component (mirrors `AiVideoPanel`). Single "Default model" dropdown sourced from `useAIModelsList({ use_case: 'video' })` mass-applies to every user-overridable stage. Optional "Customize per stage" accordion exposes 8 per-stage rows. `prunePerStage()` strips empty/whitespace before serialization so FE state never carries values the BE would reject |

## 6. Override semantics

| User sends | Effect |
|---|---|
| Nothing (`model_overrides` omitted) | Every stage uses its admin matrix default. `source="matrix"` on every cost event |
| Legacy `model: "X"` only | Collapsed to `ModelOverrides(default="X")` server-side; same as if user set the default in the panel |
| `model_overrides: {default: "X"}` | Every **user-overridable** stage uses X; pinned stages (vision_review + utility) stay on admin defaults. `source="user_default"` on overridden cost events |
| `model_overrides: {default: "X", per_stage: {regen_html: "Y"}}` | `regen_html` uses Y, every other user-overridable stage uses X, pinned stays admin. `source="user_per_stage"` for regen_html, `"user_default"` for others |
| `model_overrides: {per_stage: {shot_planner: "Y"}}` (no default) | `shot_planner` uses Y, every other stage uses admin defaults. `source="user_per_stage"` for shot_planner, `"matrix"` for others |
| `model_overrides: {per_stage: {vision_review: "Y"}}` | Silently ignored — `user_overridable=false` for vision_review. `source="matrix"`. No error |
| Both legacy `model: "X"` and new `model_overrides: {...}` | `model_overrides` wins; service emits a `logger.warning` so client-side bugs surface in audit |

## 7. Cost tracking

`CostEvent.source` lands in `cost_breakdown.json` per event. Aggregation by `source` is a follow-up; for now, individual events can be queried:

```bash
jq '[.events[] | select(.kind=="llm") | {stage, model, source}] | group_by(.source) | map({source: .[0].source, count: length})' cost_breakdown.json
```

Expected on a typical Ultra run with user override:
- `source: "matrix"` — utility stages, vision review
- `source: "user_default"` or `"user_per_stage"` — critical stages

## 8. Files reference

### Added
- [app/constants/pipeline_stages.py](../../ai_service/app/constants/pipeline_stages.py)
- [admin_core_service/.../V200__ai_model_stage_assignments.sql](../../admin_core_service/src/main/resources/db/migration/V200__ai_model_stage_assignments.sql)

### Modified
- [app/schemas/video_generation.py](../../ai_service/app/schemas/video_generation.py) — `ModelOverrides` DTO + validator
- [app/services/ai_models_service.py](../../ai_service/app/services/ai_models_service.py) — `ResolvedModel` + `get_stage_model_map`
- [app/services/video_generation_service.py](../../ai_service/app/services/video_generation_service.py) — resolver call, tuple projection, legacy-`model` collapse + warning
- [app/routers/external_video_generation.py](../../ai_service/app/routers/external_video_generation.py) — three call sites forward `model_overrides`
- [app/ai-video-gen-main/automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) — normalizer + pipeline + OpenRouterClient + ~13 LLM call sites
- [app/ai-video-gen-main/cost_event_tracker.py](../../ai_service/app/ai-video-gen-main/cost_event_tracker.py) — `source` field
- [app/ai-video-gen-main/shot_visual_reviewer.py](../../ai_service/app/ai-video-gen-main/shot_visual_reviewer.py) — Pro safety-net docstring
- [frontend-admin-dashboard/.../video-generation.ts](../../frontend-admin-dashboard/src/routes/video-api-studio/-services/video-generation.ts) — types + rehydration
- [frontend-admin-dashboard/.../SettingsPopover.tsx](../../frontend-admin-dashboard/src/routes/video-api-studio/console/-components/SettingsPopover.tsx) — `ModelOverridesPanel`

### Not created (explicit non-goals)
- ❌ No admin "AIModelMatrix" settings page — matrix edits via SQL.
- ❌ No `PATCH /models/v2/stage-assignments` endpoint — out of scope.

## 9. Rollout

1. Apply migration `V200` to staging. Verify: `SELECT COUNT(*) FROM ai_model_stage_assignments WHERE use_case='video' AND is_active=TRUE` → 85.
2. Restart `ai_service` so the new resolver code path is loaded. No env flag is required — the resolver runs on every request and an empty matrix is the legacy-fallback signal.
3. Generate runs across all 5 tiers. Inspect `cost_breakdown.json`: expected to match legacy behavior (matrix == day-1 defaults). `source: "matrix"` on every event.
4. Send a request with `model_overrides: {default: "anthropic/claude-sonnet-4-6"}`. Expect critical stages on Sonnet, utility on Flash, vision_review still on Pro.
5. Soak 1 week. Watch cost telemetry per stage.
6. Rollback path: `TRUNCATE ai_model_stage_assignments` (or set `is_active=FALSE` for every row) — resolver returns an empty map and the pipeline falls back to legacy global routing on its next request.

## 10. Deep-review disposition

A code-review pass after landing the change surfaced 7 blockers + 8 nice-to-fixes; 13 were fixed in the same session. Surviving deferred items:

- **B5 full DB allow-list validation** — currently only pydantic-side format check (`provider/model`, max 200 chars). A malicious request with `default: "google/does-not-exist"` will reach OpenRouter and 4xx there. Recommended follow-up: validate at router entry against `SELECT model_id FROM ai_models WHERE is_active=TRUE AND 'video' = ANY(recommended_for)`.
- **B7 free-tier seed uses gemini-3-flash-preview (premium 2× credit multiplier)** — matches the existing legacy `_FLASH_TIERS` routing at `video_generation_service.py:712` exactly, so not a regression. Admins can edit free-tier rows to a true free model post-launch.
- **N4 `pgcrypto` extension** — `gen_random_uuid()` requires it; verify on target DBs before applying V200.
- **N5 redundant single-column `is_active` index** — dropped on next cleanup.
- **N2 db_session-nil logging** — minor logging miss.

## 11. Known gaps not yet addressed

- **No admin UI for editing the matrix** — defaults are seeded by migration; admins edit individual cells via SQL until a follow-up `AIModelMatrix.tsx` ships.
- **No per-institute overlays** — matrix is global. Multi-tenant per-institute overrides are a Phase 2 plan.
- **No per-stage user override for medium/utility stages** — `cultural_context`, `image_prompt_enhancement`, `headline_thumbnail`, etc. always use admin defaults. Intentional cost guardrail.
- **No quality_score-driven dynamic routing** — admin picks explicit models per cell.
- **Legacy v2 model knobs (`preferred_script_model`, `preferred_shot_model`) still in `QUALITY_TIERS`** — kept as fallback for when stage routing is off. Removed when v2 deletion lands.

---

# Live progress aggregator (2026-05) — polling-based v3 pipeline UI

**Status**: shipped 2026-05. v3 only.
**Audience**: engineers maintaining the AI video studio pipeline view, the polling `/status` endpoint, or anything that reads `extra_metadata.live`.
**Why**: The pipeline already collected rich per-shot telemetry (director decisions, regen verdicts, third-party polling, costs) but the FE only ever saw the coarse `sub_stage / shot_done / shot_error` triplet that bubbled through SSE. The studio UI showed a generic "Filming 3/8" spinner with no visibility into what was actually running. This rework gives the FE one structured live snapshot, served from the polling status endpoint, that drives both live and history views from the same shape.

## 1. What changed end-to-end

```
Pipeline thread emits _emit_progress({type, ...}) events
        │
        ▼
RunStateAggregator.handle_event(video_id, ev)   ← NEW, in-process singleton
        │  (also forwarded to the existing SSE queue — additive)
        ▼
LiveProgress snapshot (per video_id, RLock-guarded)
        │
        │  every 5s + on terminal transition
        ▼
ai_gen_video.extra_metadata.live   ← persisted JSONB for history reads
        │
        ▼
GET /status/{video_id}   →   response.live   (in-memory first, DB fallback)
        │
        ▼
FE useVideoStatus()  (refetchInterval = 15s while IN_PROGRESS, false on terminal)
        │
        ▼
derivePipelineFromStatus(status)  enriches each SceneSlot with
liveDetail { substage, regenCount, attempts, regenLog, externalCalls, … }
        │
        ▼
PipelineFlow auto-focuses on liveActiveStage / single in-production scene
SceneNode renders chips + 🔄 regen counter + live-substage line
SceneDetail drawer shows verdict log + external calls
Bottom-center "Director:" ticker shows the latest director_thought
```

## 2. New module

| File | Purpose | Lines |
|---|---|---|
| [app/ai-video-gen-main/run_state_aggregator.py](../../ai_service/app/ai-video-gen-main/run_state_aggregator.py) | Process-local `RunStateAggregator` singleton (`RUN_STATE`). Holds one `LiveProgress` per video_id under a per-entry `threading.RLock`. Exposes `start_run` / `end_run` / `handle_event` / `snapshot` / `serialize_for_db`. v3 stage IDs (`pitch`, `research`, `shotPlanner`, `narrationWriter`, `filming`, `talent`, `score`, `finalCut`) match the FE `PipelineNodeId` enum exactly. Single-instance assumption documented — swap `_runs` for Redis when scaling out. | ~470 |

## 3. New / enriched `_emit_progress` events

All additive — existing `sub_stage` / `shot_done` / `shot_error` continue to fire.

| Event | When | Site |
|---|---|---|
| `sub_stage[shot_planning_done]` (enriched) | After ShotPlanner finalizes | `_run_v3_shot_planning` in [automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) — now carries `shots_summary[]` with `shot_type / intent_role / audio_policy / background_treatment / transition_in / narration_brief / duration_estimate_s` per shot, plus `recurring_motifs`. |
| `shot_substage` `{shot_idx, substage, message}` | Entry of bbox-lint / brand-asset / vision-review and start of `_shot_task` | `_lint_shot_bbox`, `_lint_shot_brand_asset`, `_review_shot_visually`, `_shot_task` |
| `shot_regen_attempt` `{shot_idx, step, attempt, verdict, reason}` | When a gate decides to fire a corrective regen | bbox-lint at the "firing corrective regen" log line; brand-asset at the "MISSING — firing corrective regen" line; vision-review at the severity-3 branch |

The aggregator also handles `external_call`, `cost_tick`, `director_thinking`, `render_progress`, `tts_segment_done`, `thumbnails_ready` event types — these are reserved for future emit sites (Veo polling wrapper, cost tracker hook, etc.). The aggregator gracefully ignores unknown event types.

Two helper methods on the pipeline class make new emits one-liners:
- `_emit_shot_substage(shot_idx, substage, message=None)`
- `_emit_shot_regen(shot_idx, step, attempt, verdict, reason=None)`

## 4. Service / endpoint changes

| File | Change |
|---|---|
| [app/services/video_generation_service.py](../../ai_service/app/services/video_generation_service.py) | New lazy import helper `_get_run_state_aggregator()`. `_progress_cb` now calls `aggregator.handle_event(video_id, ev)` before queueing for SSE. `start_run(video_id)` fires before the pipeline thread is launched. `end_run(video_id, "COMPLETED" \| "FAILED")` fires at every terminal point (success, error, cancellation). Periodic flush every 5 s (and on each terminal transition) calls `repository.update_live_snapshot(video_id, snap)`. `get_video_status` attaches `live` to the response, preferring in-memory, falling back to `extra_metadata.live`. The authoritative DB `status` is folded onto the snapshot so the FE never has to reconcile two status strings. |
| [app/repositories/ai_video_repository.py](../../ai_service/app/repositories/ai_video_repository.py) | New `update_live_snapshot(video_id, snapshot)` — replaces `extra_metadata.live` atomically; best-effort with rollback on failure. |
| [app/schemas/video_generation.py](../../ai_service/app/schemas/video_generation.py) | `VideoStatusResponse.live: Optional[Dict[str, Any]]` field added with shape-describing docstring. Legacy `generation_progress` retained. |

The SSE streaming-POST endpoint at `/external/video/v1/generate` is **intentionally retained**. The aggregator is additive — events flow into both the queue (SSE) and the aggregator (polling snapshot). Removing SSE involves cross-cutting FE work in `generateVideo()` / `regenerateFromStage()` / `addToStage()` consumers (each a streaming body-parse loop) and is deferred to a separate iteration since the live polling UI is fully functional without it.

## 5. FE changes

| File | Change |
|---|---|
| [routes/video-api-studio/-services/video-generation.ts](../../frontend-admin-dashboard/src/routes/video-api-studio/-services/video-generation.ts) | New types: `VideoLiveProgress`, `VideoLiveStageId`, `VideoLiveStageProgress`, `VideoLiveShotProgress`, `VideoLiveExternalCall`, `VideoLiveCosts`, `VideoLiveEvent`. `VideoStatusResponse.live` added. |
| [routes/video-api-studio/-components/pipeline/-utils/use-video-status.ts](../../frontend-admin-dashboard/src/routes/video-api-studio/-components/pipeline/-utils/use-video-status.ts) | Rewritten to use `refetchInterval: 15s` while `status` is non-terminal, `false` once terminal. `staleTime: 0` so React Query re-renders consumers on every successful poll. |
| [routes/video-api-studio/-components/pipeline/-utils/derive-pipeline-state.ts](../../frontend-admin-dashboard/src/routes/video-api-studio/-components/pipeline/-utils/derive-pipeline-state.ts) | New `SceneLiveDetail` shape on `SceneSlot.liveDetail`. New top-level `PipelineState.liveActiveStage`, `liveActiveSubstage`, `liveDirectorThought`, `liveStarted`, `liveLastEventAt`, `liveCosts`. `derivePipelineFromStatus` now folds `status.live` over the base derivation — preserving URLs / talent / score enrichment, overriding scene state from `live.shots[].state`, populating decisions when the base derivation didn't have them. Two helpers: `liveStateToNodeState`, `sumRegenAttempts`. |
| [routes/video-api-studio/-components/pipeline/PipelineFlow.tsx](../../frontend-admin-dashboard/src/routes/video-api-studio/-components/pipeline/PipelineFlow.tsx) | Auto-focus camera: when `state.liveActiveStage` changes (or exactly one scene is in_production during Filming), `flow.fitView({nodes: [target], padding: 0.3, duration: 500, maxZoom: 0.9})` smoothly pans to it. `onMoveStart` flips `followLiveRef.current = false` so any manual pan/zoom opts out. New bottom-center `<Panel>` renders the director-thinking ticker. |
| [routes/video-api-studio/-components/pipeline/nodes/SceneNode.tsx](../../frontend-admin-dashboard/src/routes/video-api-studio/-components/pipeline/nodes/SceneNode.tsx) | `SUBSTAGE_VISUAL` map (label + icon per substage). Added `transition_in` chip alongside the existing `intent_role` / `background_treatment` chips. New 🔄 regen counter chip in the header when `liveDetail.regenCount > 0`. New live substage line (icon + label + active external call) below the chip row, visible only while the scene is in_production. |
| [routes/video-api-studio/-components/pipeline/NodeDetailSheet.tsx](../../frontend-admin-dashboard/src/routes/video-api-studio/-components/pipeline/NodeDetailSheet.tsx) | Scene branch gains a "Live progress" panel: current substage, per-gate attempt counts, full verdict log, external calls, last error, elapsed seconds. Quietly absent for runs without `liveDetail`. |

## 6. Behavior guarantees

- **No legacy regression.** v2 runs that don't populate `live` continue to render via the existing `generation_progress`-based derivation. The FE detects `live` and additively enriches; absent `live` means the diagram falls back to the pre-rework view.
- **SSE coexists.** The streaming-POST `/generate` endpoint is unchanged. Every progress event still lands on the SSE queue AND in the aggregator — no event is dropped. A future cleanup can remove SSE without touching the aggregator code.
- **Single-instance assumption.** The aggregator is process-local. Multi-replica deploys need either sticky routing by video_id or a Redis snapshot store — the choke point is `RunStateAggregator._runs`.
- **History parity.** A history view of a wrapped run reads `extra_metadata.live` (the final snapshot persisted at terminal transition) and renders the same scene-level decisions + final regen log as a live run did at completion. Per-shot URLs / final media still come from the base derivation.
- **Polling cadence.** 15 s while running, halted on terminal status. Token + cost data refreshes at the same cadence; the per-shot regen counter updates within one poll of the BE emit.
- **Auto-focus respects the user.** Any manual pan/zoom turns off the auto-focus camera until the user reloads or manually navigates. No surprise scroll-jacking.

## 7. Cost surface

Aggregator memory: ~1–5 KB per active run (deepcopy-isolated snapshot + 200-event rolling log).
DB write volume: 1 row update per video every 5 s = 12 writes/min/active video. Truncated event log keeps each write under ~50 KB.
No new LLM calls. No new third-party calls. No new render-worker work.

## 8. Deferred (separate iteration)

- **Remove SSE.** `POST /generate` continues to stream; `generateVideo()` / `regenerateFromStage()` / `addToStage()` continue to parse body-line SSE. Removal requires rewriting all three consumers (in `video-generation.ts`) plus the SSE state machine in `VideoConsoleWorkspace.tsx`. The aggregator path makes SSE redundant but not yet harmful.
- **Delete `FilmingNode` Phase 1 placeholder + `GenerationProgress` linear stepper.** Both are still referenced by `PipelineFlow.tsx` / `VideoConsoleWorkspace.tsx`; safe deletion requires the SSE removal above first.
- **External-call wrapping for fal.ai Veo / Seedream / Pexels / ElevenLabs.** The aggregator already handles `external_call` events; emit sites in `fal_veo_client.py` etc. are not wired yet. Wrapping the queue submit-poll loop is the highest-ROI follow-up.
- **`cost_tick` emits from `AiVideoCostTracker.try_charge`.** Aggregator handles them; tracker doesn't emit yet.
- **Density-validator substage emit.** Density is called from the caller (not self-contained), so it didn't fit the same one-liner pattern as the other three gates. Add when refactoring the validator loop.
- **`director_thinking` natural-language emits.** ShotPlanner / NarrationWriter could optionally emit short "I chose hook → setup → moment because…" lines for the ticker. Not yet wired.
- **Multi-instance support.** Swap `_runs` for a Redis-backed store and add sticky routing by video_id when ai_service moves past one pod.

## 9. Files reference

### Added
- [app/ai-video-gen-main/run_state_aggregator.py](../../ai_service/app/ai-video-gen-main/run_state_aggregator.py)

### Modified — backend
- [app/ai-video-gen-main/automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) — `_emit_shot_substage` + `_emit_shot_regen` helpers; enriched `shot_planning_done` emit; substage emits in bbox-lint / brand-asset / vision-review entries + `_shot_task` HTML-gen start; regen-attempt emits at each gate's regen decision
- [app/services/video_generation_service.py](../../ai_service/app/services/video_generation_service.py) — aggregator lazy-import helper; `_progress_cb` forwards to aggregator; `start_run` / `end_run` lifecycle; 5 s flush loop; `get_video_status` attaches `live`
- [app/repositories/ai_video_repository.py](../../ai_service/app/repositories/ai_video_repository.py) — `update_live_snapshot`
- [app/schemas/video_generation.py](../../ai_service/app/schemas/video_generation.py) — `VideoStatusResponse.live`

### Modified — frontend
- [routes/video-api-studio/-services/video-generation.ts](../../frontend-admin-dashboard/src/routes/video-api-studio/-services/video-generation.ts)
- [routes/video-api-studio/-components/pipeline/-utils/use-video-status.ts](../../frontend-admin-dashboard/src/routes/video-api-studio/-components/pipeline/-utils/use-video-status.ts)
- [routes/video-api-studio/-components/pipeline/-utils/derive-pipeline-state.ts](../../frontend-admin-dashboard/src/routes/video-api-studio/-components/pipeline/-utils/derive-pipeline-state.ts)
- [routes/video-api-studio/-components/pipeline/PipelineFlow.tsx](../../frontend-admin-dashboard/src/routes/video-api-studio/-components/pipeline/PipelineFlow.tsx)
- [routes/video-api-studio/-components/pipeline/nodes/SceneNode.tsx](../../frontend-admin-dashboard/src/routes/video-api-studio/-components/pipeline/nodes/SceneNode.tsx)
- [routes/video-api-studio/-components/pipeline/NodeDetailSheet.tsx](../../frontend-admin-dashboard/src/routes/video-api-studio/-components/pipeline/NodeDetailSheet.tsx)
