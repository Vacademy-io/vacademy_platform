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
- Pipeline order unchanged (Phase 2b run() reorder was obsoleted by Phase 5's post-hoc mute approach)
- New visual path: **fal.ai Veo 3.1 Lite** — full-canvas (`AI_VIDEO_HERO`) AND inline (`<aivideo>` tags)
- New first-class field: **`shot["audio_policy"]`** — `narration_only` (default) or `intrinsic_only` (for shots whose own audio plays alone)
- New stage between Director and HTML: **AudioPolicyPlanner** assigns `audio_policy` per shot
- New post-HTML / pre-render step: **master-narration silence** — ffmpeg-zeros narration in `intrinsic_only` windows, atomic-swaps the muted file into `narration.mp3` so all downstream consumers (S3 upload, editor preview, render server) see the correct mix
- New per-run state: **`AiVideoCostTracker`** (thread-safe budget guard with try_charge/refund/summary semantics)
- Per-shot TTS infrastructure (Phase 0) is present but not wired into the main flow yet — exists for future per-shot editing UX

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

Pricing table (locked to 720p, the only resolution we ship):

| Audio | $/s | 4s call | 6s call | 8s call |
|---|---|---|---|---|
| off | $0.03 | $0.12 | $0.18 | $0.24 |
| on  | $0.05 | $0.20 | $0.30 | $0.40 |

Per-video cap: **$1.50** on ultra and super_ultra tiers (`ai_video_per_video_cost_cap_usd`).

Enforced by `AiVideoCostTracker.try_charge(amount)`:
- Atomic increment under a thread lock — concurrent shots can't both sneak past the cap
- Raises `CircuitBreakerExhausted` (caught by orchestrator → fallback path) when the next call would exceed
- `refund(amount)` rolls back budget when a Veo call fails (transient errors don't permanently eat budget)
- `summary()` returns telemetry dict written to `<run_dir>/ai_video_summary.json` at end of run

Chain pre-flight: chain orchestrator charges the FULL chain cost up front before making any Veo call. If the total would exceed cap, the whole chain is rejected — partial chains never ship (a truncated chain would be shorter than the planned shot duration).

Inline tag cost flow: each `<aivideo>` resolution is a separate `try_charge`. When the cap trips mid-shot, the first N tags succeed (and bill), remaining tags resolve to a CSS placeholder. Shot logs `circuit_breaker_partial: true`.

Worst-case bound per video at default flags (audio off): ~6 segments × $0.24 = $1.44 < $1.50 cap. ✓
Worst-case with audio on: 1 segment × $0.40 + remaining gets clipped by cap. ✓

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
  "cap_usd": 1.50,
  "spent_usd": 0.72,
  "remaining_usd": 0.78,
  "shots_completed": 3,
  "shots_failed": 0,
  "shots_skipped_circuit_breaker": 0,
  "ai_video_enabled": true,
  "ai_video_audio_enabled": false,
  "single_shot_count": 1,
  "chain_shot_count": 2
}
```

Per-shot entries in `timeline.json` carry:
- `_ai_video_request_id` — fal.ai request_id, useful for debugging
- `_ai_video_url` — the resolved video URL (S3 for chains, fal CDN for singles)
- `_ai_video_cost_usd` — what this shot actually cost
- `_ai_video_elapsed_s` — wall-clock for the Veo call(s)
- `_ai_video_segments` — list of `{seg_idx, video_url, duration_s, request_id, cache_hit?}`
- `_ai_video_audio_on` — was Veo's `generate_audio` true for this shot

Pipeline logs a `🎬 AI video summary:` line at end of run when the tracker existed.

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
| Per-shot TTS migration | Phase 0 modules exist, not wired into main flow | Use monolithic TTS for now; Phase 0e/f/g land per-shot TTS for editor regen UX |
| BeatPlanner main-pipeline wiring | Phase 1 modules exist, off-by-default flag in QUALITY_TIERS | Not blocking AI video; BeatPlanner refactor is a separate roadmap item |
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
- [app/ai-video-gen-main/beat_planner.py](../../ai_service/app/ai-video-gen-main/beat_planner.py) (not yet wired)
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
