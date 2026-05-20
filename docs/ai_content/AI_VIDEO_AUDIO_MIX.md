# AI Video — Audio Mix Pipeline

How narration, background music, sound effects, and transition stingers get composed into a single broadcast-quality audio track for every Premium+ render.

Companion docs:
- [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md) — the wider generation pipeline (TTS, shots, render)
- [CAPTIONS.md](./CAPTIONS.md) — narration word-timestamps that drive caption rendering
- [VIDEO_SOUND_REVIEW.md](./VIDEO_SOUND_REVIEW.md) — original product review (pre-dates this implementation)

Implementation lives at `vacademy_platform/ai_service/app/ai-video-gen-main/` (paths below are relative to that directory unless prefixed with `app/services/`).

---

## 1. Overview

```
                         ┌───────────────────────────────────┐
                         │  Director (LLM)                   │
                         │  emits music_plan + shot list     │
                         └───────────────────────────────────┘
                                       │
              ┌────────────────────────┴────────────────────────┐
              ▼                                                  ▼
    ┌──────────────────────┐                          ┌──────────────────────┐
    │  music_generator.py  │                          │  sound_planner.py    │
    │  provider-dispatched │                          │  picks SFX cues per  │
    │  • fal-elevenlabs    │                          │  shot from a 4176-   │
    │  • lyria (legacy)    │                          │  entry library       │
    └─────────┬────────────┘                          └─────────┬────────────┘
              │                                                  │
              ▼                                                  ▼
       music.mp3 (S3)                                  entries[*].sound_cues
              │                                        (incl. transition_whoosh)
              │                                                  │
              │                                                  ▼
              │                                  ┌────────────────────────────────┐
              │                                  │  transition_stinger_planner.py │
              │                                  │  replaces static whooshes      │
              │                                  │  with fresh fal-elevenlabs     │
              │                                  │  variants (per-video distinct) │
              │                                  └─────────────┬──────────────────┘
              │                                                │
              └────────────────┬───────────────────────────────┘
                               ▼
                  ┌─────────────────────────────┐
                  │  audio_mixer.build_mix()    │   ← single ffmpeg invocation
                  │  • aloop music to length    │
                  │  • sidechain-duck under VO  │
                  │  • adelay SFX/stingers      │
                  │  • amix all layers          │
                  │  • loudnorm I=-16           │
                  │  • alimiter -1 dBTP         │
                  └─────────────┬───────────────┘
                                ▼
                        final_mix.mp3
                                │
                        atomic swap with
                        narration.mp3
                                ▼
                      run_dir/narration.mp3
                      (now mastered audio)
                                │
                                ▼
                     generate_video.py reads
                     this in unchanged
```

Two beats matter:
1. **Music + SFX + stingers are independently planned upstream**, then composed downstream by a single mixer. That keeps the planners simple (they only emit URLs and timestamps) and centralizes ffmpeg complexity.
2. **The mixer's output atomically replaces `narration.mp3`** on disk. Nothing downstream (timeline JSON, render-worker, generate_video.py) needs to know the swap happened — they keep reading `narration.mp3` and get the mastered version automatically.

---

## 2. Components

### 2.1 fal-ElevenLabs client — [app/services/fal_elevenlabs_client.py](../../ai_service/app/services/fal_elevenlabs_client.py)

Single API wrapper for `fal-ai/elevenlabs/sound-effects/v2`. Used by **three** callers in the pipeline: music generation, SFX one-shots, and transition stingers.

```
Endpoint: https://fal.run/fal-ai/elevenlabs/sound-effects/v2
Pricing:  $0.002 / second of generated audio
Duration: 0.5 – 22.0 seconds per call (hard cap)
Auth:     FAL_API_KEY env var (mirrors fal_veo_client convention)
```

Key public surface:
- `FalElevenLabsClient(api_key, cache_dir=…)` — instance with optional content-hash disk cache
- `submit(text, duration_s, loop, prompt_influence, output_format)` → `AudioResult`
- `generate_music_bed(client, prompt, duration_s)` — convenience wrapper (`loop=True`, `prompt_influence=0.55`)
- `generate_sfx_oneshot(client, prompt, duration_s)` — convenience wrapper (`loop=False`, `prompt_influence=0.65`)

Caching: every `submit()` is SHA-256-keyed over `text|duration|loop|prompt_influence|output_format`. A re-render of the same video (same Director output) reuses cached bytes; no second API charge. Cache lives at `run_dir/_audio_cache/`.

Failure modes:
- 429 with `Retry-After` → honored, exponential backoff up to 3 retries
- 5xx → linear backoff up to 3 retries
- 4xx (other) → hard fail, raises `ElevenLabsSubmitError`
- Network/timeout → `ElevenLabsTimeout`
- Persistent 429 → `ElevenLabsQuotaExceeded`

Each method returns gracefully (no raise) when the call would block the render — callers downgrade to the next layer or to bare VO.

### 2.2 Music generator — [music_generator.py](../../ai_service/app/ai-video-gen-main/music_generator.py)

Two backends, one public surface. The public function `generate_background_music(music_plan, audio_duration, video_id, run_dir, progress_callback, cost_tracker)` produces one music track and uploads to S3 — backend depends on env var.

**Provider resolver** — [`_resolve_music_provider()`](../../ai_service/app/ai-video-gen-main/music_generator.py#L340):

```python
1. MUSIC_PROVIDER env var (explicit override): "fal_elevenlabs" | "lyria" | "fallback"
2. Auto-detect: FAL_API_KEY set → fal_elevenlabs
3. Auto-detect: Google creds present → lyria (legacy)
4. Else → fallback (caller is expected to use music_fallback_library)
```

| Provider | Per-call max | Cost | Speed | Best for |
|---|---|---|---|---|
| `fal_elevenlabs` (default) | 22s | $0.044/22s | 3–8s | promo, announcements, 30–120s videos |
| `lyria` (legacy) | 180s | ~$0.15–0.30/video | 30–60s | long-form (>2min) educational, melodic |
| `fallback` | n/a | $0 | instant | when no provider key is configured |

**Chunk collapse for fal**: ElevenLabs is 22s/call; if the Director emits multi-chunk `music_plan`, the fal branch collapses it to ONE 22s loopable bed using the first chunk's prompt. The mixer's `aloop` extends to full video duration without seam ([`generate_background_music:586`](../../ai_service/app/ai-video-gen-main/music_generator.py#L586)).

**Cost ledger**: each chunk records one `kind="music"` event via `cost_tracker.record_music(stage, model, duration_s, cost_usd, outcome)`. Cache hits record with `outcome="cache_hit"` and `$0`.

### 2.3 Sound planner — [sound_planner.py](../../ai_service/app/ai-video-gen-main/sound_planner.py)

Unchanged in structure, but the **per-shot cap was removed (2026-05)**. Picks SFX cues from `sounds_metadata.json` (4176 entries) per shot based on:
- Shot type → signature cue (e.g. KINETIC_TITLE → impact)
- Skill tags → derived audio events
- Shot boundaries → transition whoosh (pre-roll, 65% peek)
- Empty long shots → emphasis fallback chime

**Cue dict shape** (per cue, attached to `entry["sound_cues"]`):
```python
{
    "id": "abc123",
    "t": 1.4,           # SHOT-RELATIVE time in seconds
    "url": "https://s3/sounds/whoosh.mp3",
    "volume": 0.4,      # 0..1 linear
    "role": "transition_whoosh" | "ui_chime" | "data_reveal" | "impact" | ...,
    "duration": 0.5,
}
```

Caller computes absolute time as `entry["start"] + cue["t"]` when handing cues to the mixer (see [`_run_audio_mix_pass`](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L2059)).

#### Caps (2026-05 update)

| Old | New |
|---|---|
| Per-shot cap: 1–3 cues max (tier-gated) | **Removed** — `sound_max_cues_per_shot` is silently ignored |
| Per-video cap: 10–40 cues max | Unchanged |
| Short-shot clamp: shots < 2.0s get 1 cue | Unchanged |
| Min-gap between cues: 0.30s | Unchanged |

**Why removed**: the per-shot cap fought the planner's own intelligence — a 4s data-reveal with 5 list items deserves 5 chimes, but the Premium cap of 1 dropped 4 of them. The min-gap + dedup + video cap together do the anti-clutter work without an artificial per-shot ceiling. Short shots (<2s) still get the 1-cue clamp so a 0.5s blip can't hold 3 stacked sounds.

Tier-config field `sound_max_cues_per_shot` is read for back-compat but no longer used as a hard ceiling. Safe to leave in old configs.

### 2.4 Transition stinger planner — [transition_stinger_planner.py](../../ai_service/app/ai-video-gen-main/transition_stinger_planner.py)

Runs AFTER `sound_planner` and BEFORE `audio_mixer`. Replaces the URL field of each `role=transition_whoosh` cue with a freshly generated fal-elevenlabs whoosh.

Why fresh stingers: the static library has 159 whoosh files, repeated across thousands of videos. Fresh per-video generation makes consecutive transitions sound distinct.

**Variant rotation**: caps at `FAL_STINGER_MAX_VARIANTS = 5` distinct generations per video. If a video has 10 transitions, 5 variants are produced and cycled — variants `[0,1,2,3,4,0,1,2,3,4]`. Cost: 5 × 0.55s × $0.002 = **$0.0055/video**.

Prompt rotation pool (6 variants seeded by run):
```
"Smooth cinematic whoosh, mid-frequency air movement, short and clean"
"Subtle riser into a soft impact, warm tone, no high-frequency harshness"
"Quick swoosh transition, airy, light reverb tail"
"Brief tonal sweep, low-to-high, ascending pitch, energetic"
"Soft transition hit, muted thud, no metallic ring"
"Light breeze whoosh, naturally panning, brief duration"
```

**Skip conditions** (all return 0 silently, static library cues remain):
- `tier_config.transition_stingers_enabled = False`
- `tier_config.sound_enabled = False`
- `FAL_API_KEY` env var not set
- No `transition_whoosh` cues found in entries

### 2.5 Audio mixer — [audio_mixer.py](../../ai_service/app/ai-video-gen-main/audio_mixer.py)

Single ffmpeg invocation that composes all layers into one mastered mp3. Pure orchestration — no audio DSP in Python.

**Public surface:**
```python
spec = MixSpec(
    vo_path=Path("narration.mp3"),
    video_duration_s=30.0,
    music_path=Path("music.mp3"),       # Optional — None = VO+SFX only
    music_volume=0.10,                  # 0..1 linear
    sfx_cues=[MixCue(url, t_s, volume, label), ...],
    stinger_cues=[MixCue(url, t_s, volume, label), ...],
    enable_ducking=True,                # sidechain-compress music under VO
    enable_loudnorm=True,               # broadcast LUFS master
)
result = build_mix(spec, run_dir=Path(...), output_filename="final_mix.mp3")
# result.ok / result.output_path / result.layers_used / result.error
```

**Filter graph** (conceptual — see `_build_filter_graph`):
```
[narration.mp3] anull / asplit              → [vo] (+ [vo_sc] when ducking)
[music.mp3]    aloop, atrim, volume(0.10)   → [bgm_raw]
[bgm_raw][vo_sc] sidechaincompress           → [bgm_ducked]
[sfx_i.mp3]    adelay=t_ms, volume(0..1)    → [sfx_i]
[sting_j.mp3]  adelay=t_ms, volume(0..1)    → [sting_j]

[bgm_ducked][vo][sfx_0..][sting_0..] amix=duration=longest:normalize=0 → [mix]
[mix] loudnorm=I=-16:LRA=11:tp=-1:linear=true                          → [master_norm]
[master_norm] alimiter=limit=-1                                         → [out]

→ mp3 192kbps 48kHz
```

**Tunables** (constants at module top — change in one place):
```python
_SIDECHAIN_THRESHOLD_DB = -25.0    # music ducks when VO exceeds this
_SIDECHAIN_RATIO        = 8.0      # 8:1 = aggressive duck
_SIDECHAIN_ATTACK_MS    = 20       # fast pump so VO doesn't get masked
_SIDECHAIN_RELEASE_MS   = 300      # gentle return so music doesn't pump

_TARGET_LUFS_I  = -16.0            # YouTube / Spotify integrated loudness target
_TARGET_LUFS_LRA = 11.0            # loudness range
_TARGET_LUFS_TP  = -1.0            # peak ceiling

_LIMITER_CEILING_DB = -1.0         # brick wall — no clipping above this
_OUTPUT_SAMPLE_RATE = 48000
_OUTPUT_BITRATE     = "192k"
```

**Cue download**: each SFX/stinger URL is parallel-downloaded (8 workers) to `run_dir/_audio_cues/cue_NNN.<ext>` before ffmpeg runs. Failed downloads are dropped silently — the mix continues with whichever cues landed. Cleaned up after the mix unless `keep_artifacts=True` (debug only).

**Graceful degradation**:
| Failure | Mixer behavior |
|---|---|
| Music file missing | VO + SFX only (no music) |
| SFX URL 404s | drop that cue, mix continues |
| ffmpeg returns non-zero | no swap; original narration.mp3 stays (legacy behavior) |
| ffmpeg times out (120s) | same as above |
| VO file missing | `ok=False` returned immediately (nothing to mix) |

**LUFS verification helper**: `measure_lufs(audio_path)` — runs loudnorm in analysis mode and returns integrated LUFS as a float. Used in tests to confirm `-16 ±1`.

### 2.6 Pipeline integration — [automation_pipeline.py](../../ai_service/app/ai-video-gen-main/automation_pipeline.py)

The mixer runs **once per render**, between music generation and timeline-JSON write. Single call site:

```python
# automation_pipeline.py:_run_audio_mix_pass — line 2059
self._run_audio_mix_pass(
    run_dir=run_dir,
    narration_path=audio_path,                     # run_dir / "narration.mp3"
    entries=html_segments,                          # populated with sound_cues
    video_id=run_name or run_dir.name,
    audio_duration=float(_seg_audio_dur or 0.0),
)
```

What it does, in order:
1. Calls `transition_stinger_planner.enrich_transitions_with_fresh_stingers` (opt-in / tier-gated)
2. Downloads music URL → local file if remote
3. Flattens `entries[*].sound_cues` → `MixCue` list with absolute timestamps (`entry.start + cue.t`)
4. Routes `transition_whoosh` cues into `stinger_cues`, all others into `sfx_cues`
5. Calls `audio_mixer.build_mix(spec)`
6. On success: atomic file swap (see §3 below)
7. Clears `self._background_music_track = None` and `entries[*].sound_cues = []` so downstream consumers don't double-attach

The pass is a **no-op** when:
- `narration.mp3` doesn't exist
- No music AND no SFX AND no stingers
- Mixer module import fails (e.g. ffmpeg missing on PATH)

In every no-op path the render continues with whatever audio state was in place before.

### 2.7 Cost ledger — [cost_event_tracker.py](../../ai_service/app/ai-video-gen-main/cost_event_tracker.py)

Three audio-related event kinds:

| Kind | Recorded by | When |
|---|---|---|
| `tts` | `_synthesize_voice()` | per VO clip |
| `music` | `generate_background_music()` chunk loop | per generated chunk (cache hits = $0 entry) |
| `sfx` | `transition_stinger_planner` | per fresh stinger generation (cache hits = $0 entry) |

Cost-tracker methods:
```python
tracker.record_music(stage, model, duration_s, cost_usd, outcome)
tracker.record_sfx(stage, model, duration_s, cost_usd, outcome)
```

Library-sourced SFX cues (from `sounds_metadata.json`) cost $0 and **don't** create ledger entries — only fresh API generations do.

---

## 3. Atomic narration swap

The mixer outputs `final_mix.mp3` next to `narration.mp3`. On success:

```
Before swap:
  run_dir/
    narration.mp3        ← bare VO from TTS
    final_mix.mp3        ← VO + music + SFX + stingers, mastered

After swap (atomic rename):
  run_dir/
    narration.mp3              ← mastered audio (was final_mix.mp3)
    narration_unmixed.mp3      ← original VO (for debugging)
```

**Why swap rather than write a new path:**
- Every downstream consumer (timeline JSON, render-worker, generate_video.py, S3 upload) reads `narration.mp3` by name
- No code changes needed in those consumers
- One file = one source of truth — no risk of mixed/unmixed mismatch

**Post-swap cleanup** (in `_run_audio_mix_pass`):
- `self._background_music_track = None` — timeline JSON won't tell the render worker to attach music separately
- `entries[*].sound_cues = []` — timeline JSON won't tell the render worker to trigger SFX separately

These two layers are now baked into `narration.mp3`. Without the cleanup, the render worker would re-attach them on top → double-mixed audio.

**Recovery on swap failure**: if either rename throws, the helper tries to restore the original `narration.mp3` from the backup. Worst case: the render ships with bare VO (legacy behavior).

---

## 4. Configuration

### 4.1 Environment variables

| Var | Effect |
|---|---|
| `FAL_API_KEY` | Enables fal-elevenlabs for music + SFX + stingers. Also auto-selects fal as the music provider when set. |
| `FAL_KEY` | Legacy alias for `FAL_API_KEY` (lower priority). |
| `MUSIC_PROVIDER` | Explicit provider override: `fal_elevenlabs` / `fal` / `elevenlabs` / `lyria` / `fallback`. Bypasses auto-detect. |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Required for Lyria backend. Reused from existing Google TTS path. |

### 4.2 Tier config (per-institute, in `automation_pipeline.py` tier_config dict)

| Field | Type | Default | Effect |
|---|---|---|---|
| `background_music_enabled` | bool | False (Free/Standard); True (Premium+) | Master switch for music generation. |
| `background_music_default_volume` | float | 0.10 | Linear gain for music layer in the mix. |
| `sound_enabled` | bool | False (Free/Standard); True (Premium+) | Master switch for SFX cues. |
| `sound_max_cues_per_video` | int | 10 (Premium) / 20 (Ultra) / 40 (Super Ultra) | Total SFX budget across the whole video. |
| `sound_max_cues_per_shot` | int | (ignored) | **2026-05: silently ignored.** Kept in old configs for back-compat. |
| `transition_stingers_enabled` | bool | True | When False, static-library transition whooshes ship unchanged (no fal API calls). |

### 4.3 Per-request overrides (passed into `VideoGenerationPipeline.__init__`)

| Param | Effect |
|---|---|
| `background_music_enabled: Optional[bool]` | Override tier default. `True` forces on even for Free tier; `False` forces off. |
| `background_music_volume: Optional[float]` | Override `background_music_default_volume`. |

---

## 5. Cost model

For a typical 30s Premium video (FAL_API_KEY set):

| Layer | Cost calc | $ |
|---|---|---|
| TTS narration | ~70 words × $0.0001/word | $0.007 |
| Music bed | 1 × 22s × $0.002/s | $0.044 |
| Fresh stingers | 5 × 0.55s × $0.002/s | $0.0055 |
| Library SFX (6-10 chimes) | $0 (static URLs) | $0 |
| Cover-crop, mix, master | $0 (local ffmpeg) | $0 |
| **Total audio** | | **~$0.06** |

For comparison, the legacy Lyria path costs ~$0.15–0.30/video depending on Vertex pricing tier — fal-elevenlabs is **3–5× cheaper** for the same audio output quality at 30s lengths. For long-form (>2min), Lyria's 180s coherent compositions may be preferable; switch via `MUSIC_PROVIDER=lyria`.

**Circuit breaker**: cost is tallied per-event in the `CostEventTracker`. No hard per-video cap on audio specifically — Premium tier's `ai_video_per_video_cost_cap_usd` already covers all spend.

---

## 6. Failure-mode matrix

| Failure | What ships |
|---|---|
| `FAL_API_KEY` missing AND `GOOGLE_APPLICATION_CREDENTIALS_JSON` missing | VO + SFX only (music silently skipped) |
| `FAL_API_KEY` missing, Google creds present | Lyria music + static SFX + static stingers |
| fal-elevenlabs 429 storm | Retried 3× then raised; pipeline falls through to `music_fallback_library` |
| ffmpeg missing on PATH | No swap; original `narration.mp3` stays (mixer logs "ffmpeg not found") |
| ffmpeg returns non-zero (filter syntax error etc.) | No swap; original stays; stderr tail logged |
| Music download fails (S3 5xx) | Mix runs VO + SFX only |
| Some SFX URLs 404 | Those cues dropped; mix runs with the rest |
| Caller wants bare VO (no audio mix at all) | Set `tier_config.background_music_enabled = False`, `sound_enabled = False` |

**In every failure case the render completes** — never blocks on audio. The worst-case output is a bare-VO mp4, identical to pre-2026-05 behavior.

---

## 7. Verification

### Unit
```bash
cd ai_service/app/ai-video-gen-main

# Mixer filter-graph + ffmpeg
python3 -c "from audio_mixer import build_mix, MixSpec, MixCue, measure_lufs; print('ok')"

# Provider resolver precedence
python3 -c "
import os, music_generator as m
os.environ['FAL_API_KEY']='x'
assert m._resolve_music_provider() == 'fal_elevenlabs'
os.environ['MUSIC_PROVIDER']='lyria'
assert m._resolve_music_provider() == 'lyria'
print('provider resolver OK')
"
```

### Integration (real ffmpeg, synthetic sines)
The smoke test in `audio_mixer.py` exercises the full chain — VO + music + SFX + stingers + ducking + loudnorm. Asserts:
- Output duration matches `video_duration_s` within ±0.5s
- Music layer is present when `music_path` set
- LUFS lands within ±2 of `-16` (broadcast target)
- Bad URLs / missing music degrade gracefully

### LUFS observation
For any rendered video:
```python
from audio_mixer import measure_lufs
lufs = measure_lufs(Path("run_dir/narration.mp3"))
# Expect ~ -15 to -17 when ducking + loudnorm are on
```

LUFS outside this band means either (a) very quiet TTS source, (b) loudnorm pass was disabled in the spec, or (c) the swap didn't happen and the file is still bare VO.

### Audit checklist post-render
```
run_dir/narration.mp3              ← exists, LUFS within band
run_dir/narration_unmixed.mp3      ← exists (backup of bare VO)
run_dir/_music_cache/*.mp3         ← exists when fal cache hit fired
run_dir/_stinger_cache/*.mp3       ← exists when fresh stingers were generated
```

---

## 8. Migration notes (2026-05)

This was a from-scratch wire-up of an audio mix engine that didn't exist before. Three observable changes for every Premium+ render:

1. **`narration.mp3` is now mastered audio**, not bare VO. The bare VO is preserved as `narration_unmixed.mp3` next to it.
2. **Music provider auto-switches to fal-elevenlabs** when `FAL_API_KEY` is set. Lyria stays as fallback when only Google creds exist. Override with `MUSIC_PROVIDER`.
3. **`sound_max_cues_per_shot` is ignored.** Old configs still parse fine — the field is just no longer a clamp. Per-video cap and min-gap are the real budget controls.

No timeline JSON schema changes. No downstream API changes. No client-side changes (the editor + player read `narration.mp3` by name and it Just Works).

### Rollback

To revert to legacy bare-VO + separately-attached music behavior:
1. Set `tier_config.sound_enabled = False` and `background_music_enabled = False` → audio mix pass becomes a no-op (only VO ships).
2. Or unset `FAL_API_KEY` → music_generator falls back to Lyria; stinger planner becomes a no-op; mix still happens for SFX layer alone (which has been inert in the legacy build anyway, so output is similar to legacy).

The mix pass itself can be force-disabled by exception-shorting the import at the top of `_run_audio_mix_pass` — but the existing graceful-degradation paths already cover every realistic failure without needing a kill switch.

---

## 9. Open follow-ups

| Item | Status | Notes |
|---|---|---|
| Beat-sync of shot cuts to music tempo (BPM detection) | Phase 2 (deferred) | Would shift shot boundaries by ±100ms to land on downbeats. |
| Section-aware music (different beds for hook / body / outro) | Phase 3 (deferred) | Requires Director-level pacing model + crossfade layer. |
| Per-tier override of `_TARGET_LUFS_I` | Idea | Some platforms (TikTok) target -14 LUFS. Move to tier_config when needed. |
| Replace Lyria code path entirely | Idea | Keeping for now as the long-form fallback (3-min compositions vs 22s loops). |
| Music-plan schema simplification in `director_prompts.py` | Deferred | The fal branch already collapses multi-chunk plans to single-bed; LLM-side schema change is non-blocking. |
| LUFS 2-pass instead of single-pass | Idea | ±0.5 LU improvement at ~2× ffmpeg time cost. Not worth it for v1. |
