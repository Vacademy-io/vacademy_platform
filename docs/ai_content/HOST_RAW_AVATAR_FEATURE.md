# Host (Raw-Avatar) — Future Feature Design

**Status**: Plumbed only. Generation path is **not implemented**. Requests with `host.type='raw'` are rejected at the API edge with a clear error (see [host_planner_service.py](../../ai_service/app/services/host_planner_service.py) — `make_host_plan` raises `HostFeatureError`).

**Owner**: TBD (assign before kicking off the build).

**Companion docs**:
- [AI_VIDEO_GENERATION.md §3.4.6](./AI_VIDEO_GENERATION.md) — host (avatar) feature shipped 2026-05-01.
- [INPUT_VIDEO_INDEXING.md](./INPUT_VIDEO_INDEXING.md) — the metadata contract this feature will consume.

---

## 0. Why this is its own doc

The avatar variant we shipped (per-shot Seedream image + fal.ai talking-head) gives the user an **AI-generated host**. The raw variant is fundamentally different: the host is a **real person** in pre-recorded footage the institute already uploaded. We splice clips from that footage into the generated video, with motion graphics overlaid on the parts of the frame the speaker doesn't occupy.

The two variants share:
- The same `HostConfig` request shape (just different `type`).
- The same `host_in_video_percentage` + emphasis-weighted Director placement.
- The same `extra_metadata.host` snapshot layout.
- The same SSE event scaffolding.
- The same FE preview path (the spliced clip URL is embedded as `<video class="host-avatar host-{layout}">` in shot HTML).

They diverge on:
- **Audio source**: avatar uses TTS; raw uses the source video's audio (no TTS narration overlay during host shots).
- **Script flow**: avatar generates a 1st-person script; raw derives the script from the input video transcript (you can't put words in a real person's mouth).
- **Free-region detection**: avatar dictates free regions at image-gen time; raw reads `face_segments[].free_regions` from the video index.
- **Generation primitive**: avatar is gen-once-per-shot; raw is splice-clip-from-already-indexed-video.

---

## 1. The thesis (script flow)

Per the design call: **transcript-driven**. The input video transcript IS the script.

Concretely:
1. User picks N indexed input videos (`host.raw.input_video_ids`). Each is `mode='podcast'` (talking head, has `face_segments`).
2. We load each video's `transcript[]` (sentence-level with word timestamps + per-sentence prosody — see [INPUT_VIDEO_INDEXING.md §5.2](./INPUT_VIDEO_INDEXING.md)).
3. The script LLM doesn't draft narration — it **selects** sentences from the transcripts that fit the user's prompt + duration target, in order, with optional bridging.
4. Each selected sentence becomes the narration for one or more shots; `start_time`/`end_time` map directly to source video timestamps.
5. The Director still runs — but its job is "what graphic do I overlay on this clip" rather than "what shot do I plan from scratch."

This means **no TTS at all** for raw host shots. The audio comes from the source video's audio track, sliced at the same timestamps.

What if the user wants narration that the host didn't actually say? **They can't.** That's the contract — pick the avatar variant for that. Raw is faithful-to-source.

---

## 2. The seven things we need to build

### 2.1 Pre-script — transcript loader + script selector

**New service**: `app/services/raw_host_script_service.py`

- Input: `[input_video_id]` + user prompt + `target_duration` + `host_in_video_percentage`.
- Loads each video's `video_context.json` (already on S3) and concatenates `transcript[]` per video.
- LLM call: "Here are N transcripts of a person talking. The user wants a video about X, ~Y seconds long. Pick sentences (in order) from the transcripts that best cover the topic and total ~Y seconds. You may insert short bridging sentences between selected pieces if the cuts would otherwise be jarring."
- Output: an ordered list of `SelectedClip` records:
  ```jsonc
  {
    "input_video_id": "vid_abc",
    "source_start": 12.34,
    "source_end": 18.71,
    "transcript_text": "Quantum entanglement is fundamentally non-local.",
    "energy_mean": 0.0421,        // copied from transcript[].energy_mean
    "pitch_std_hz": 18.7,         // for emphasis-aware Director hints
    "is_bridge": false             // true for AI-generated bridges (rare)
  }
  ```
- Bridges (if any) go through TTS using the existing TTS stage. Director needs to know which clips are real-host vs bridge so it can pick a non-host shot for bridges.

**Reused infra**:
- `transcript[]` already has `start`, `end`, `words[]`, `energy_mean`, `pitch_std_hz`, `speech_rate_wps` — the LLM can score sentences directly.
- `_pacing_style` derivation in `automation_pipeline.py` already exists; raw will get `education` pacing by default (long-form).

**New cost**: one LLM call per video at the script stage. Negligible.

### 2.2 TTS stage — partial bypass

When `host_plan.is_raw()`:
- TTS is skipped for any clip span that came directly from a `SelectedClip` (the audio is already in the source video).
- TTS still runs **only for bridge sentences** (if any).
- The "master MP3" for the run is a stitched timeline:
  - For each entry in the timeline (in order): `ffmpeg` slice the source video's audio for clip spans, splice in the bridge TTS for bridge spans.
- Output: same `narration.mp3` shape the rest of the pipeline expects. **Critical**: the WORDS stage (Whisper word timestamps) re-runs over this stitched MP3 so caption timing is correct.

### 2.3 Director — `RAW_HOST_DIRECTOR_EXTENSION`

Same shape as `HOST_DIRECTOR_EXTENSION` (already in [director_prompts.py](../../ai_service/app/ai-video-gen-main/director_prompts.py)) but:
- Tells Director that selected clips are pre-existing — `host_present=true` shots use a `SOURCE_CLIP`-style mechanism, not avatar gen.
- Per-shot fields:
  ```jsonc
  {
    "host_present": true,
    "host_layout": "free_left | free_right | free_top | free_bottom | centered",
    "host_source_video_index": 0,       // which input video
    "host_source_start": 12.34,         // source video timestamp
    "host_source_end": 18.71,
    "host_overlay_slots": [             // optional graphics in free region
      { "tag": "Step 2 of 5", "title": "Add a learner" }
    ]
  }
  ```
- The `host_layout` is **not** chosen freely; Director must pick a layout whose free region matches the speaker's position in the source clip — read from the indexed `face_segments[].free_regions` for the clip's time range.
  - We compute the eligible layouts before calling Director and inject them into the per-clip metadata so Director only picks from `eligible_layouts`.

### 2.4 RawHostBatch — splice clips, no LLM, no fal.ai

Replaces AvatarBatch in the HTML stage when `host_plan.is_raw()`:
1. For each `host_present=true` shot, ffmpeg-slice the source video at `[host_source_start, host_source_end]` to a standalone MP4 (preserving audio).
2. Upload the MP4 to S3.
3. Mutate `shot["avatar_video_url"]` (re-using the existing field — same downstream HTML emit path).
4. Persist artifacts to `run_dir/host_outputs.json` with `source_video_id`, `source_start`, `source_end`, `clip_url`, `duration_s`. Set `purpose: "raw_clip"` so the cost path can distinguish.

Per-shot HTML rendering is **identical** to the avatar variant — same `<video class="host-avatar host-{layout}">` tag, same `.host-overlay-zone` overlay rules. From the HTML's perspective, an avatar video and a spliced clip are interchangeable.

### 2.5 Free-region computation

**New helper**: `app/services/raw_host_free_regions.py`

For a given `(input_video_id, source_start, source_end)`, return the list of free regions valid across the entire span:
1. Load `video_spatial.sqlite` for that input video.
2. Query `SELECT free_regions FROM face_segments WHERE t_start <= :source_start AND t_end >= :source_end`.
3. If the span crosses segment boundaries, intersect the free_regions sets — only zones free in ALL segments touched by the clip are usable.
4. Map free regions to the `host_layout` vocabulary:
   - `right_half` ∈ free_regions → `free_right` is eligible.
   - `left_half` → `free_left`.
   - `top_half` → `free_bottom`.
   - `bottom_half` → `free_top`.
   - All four corners free → `centered` is eligible (face is fully central, overlays only in the lower-third).

This runs at the script-selector / Director-prep stage so Director's per-shot prompt receives `eligible_layouts` per clip.

### 2.6 Audio mixing in renderer

The render server today mixes the master MP3 + (optional) background music + (optional) sound effects. For raw host:
- The master MP3 already contains the clip audio (stitched in §2.2).
- The host video shot HTML embeds `<video class="host-avatar" ... muted>`. **Don't unmute it.** The audio is already in the master track; unmuting would double-play.
- Render server: no change. The existing `<video muted>` semantic carries over.

### 2.7 Credit deduction

**No new pricing entry needed**:
- Bridge TTS: existing `RequestType.TTS` / `TTS_PREMIUM`.
- Splicing: zero cost (ffmpeg in our infrastructure).
- Optional script-selector LLM: `RequestType.VIDEO` (pre-script).

What we do need:
- A `host_outputs.shot_artifacts[].purpose = "raw_clip"` flag so the host-deduction block in [video_generation_service.py](../../ai_service/app/services/video_generation_service.py) (the one we just shipped at line ~1450) skips the IMAGE + AVATAR_VIDEO charges for raw shots.

---

## 3. Data shape additions

### 3.1 HostRawConfig — already exists
[`schemas/video_generation.py`](../../ai_service/app/schemas/video_generation.py) — `input_video_ids: List[str]`. Validator already enforces non-empty.

### 3.2 HostRawPlan — already exists
[`schemas/routing.py`](../../ai_service/app/schemas/routing.py) — same shape, used in HostPlan.

### 3.3 New fields on Director per-shot output (raw mode)
- `host_source_video_index: int`
- `host_source_start: float`
- `host_source_end: float`
- `host_overlay_slots: list[dict]` — same shape as existing SOURCE_CLIP overlay slots.

### 3.4 New keys in `host_outputs.shot_artifacts[]` (raw mode)
- `purpose: "raw_clip"` (vs `"avatar_render"` for the avatar variant)
- `source_video_id: str`
- `source_start: float`, `source_end: float`
- `host_image_url`: **null** (no per-shot image gen)
- `audio_slice_url`: **null** (audio is stitched into the master MP3 instead)
- `fal_request_id`: **null**
- `clip_url: str` (S3 URL of the spliced MP4)

### 3.5 New `extra_metadata.host.outputs.script_selection` block
Captures which transcript sentences were used so we can reconstruct the script-selection decision later:
```jsonc
{
  "selected_clips_count": 14,
  "bridge_count": 1,
  "total_source_seconds": 87.4,
  "selected_clips": [
    {"video_id": "vid_abc", "source_start": 12.3, "source_end": 18.7, "text": "..."},
    ...
  ]
}
```

---

## 4. Constraints to enforce upfront (validation)

All run inside the `HostPlanner` rather than failing mid-pipeline:

1. Each `input_video_id` must be in `ai_input_videos` with `status='COMPLETED'`.
2. Each must have `mode='podcast'` (we need `face_segments` for free-region math). Reject `mode='demo'` with a clear message.
3. Each must have a non-empty `transcript[]` (catch silent uploads early).
4. Sum of `duration_seconds` across all videos must be ≥ `target_duration` (we can't stretch a 30s podcast into a 5-min video).
5. **Tier gate**: ultra / super_ultra only — same as avatar variant.
6. `host_in_video_percentage` minimum 25% — under 25% means the user's videos are barely used, suggesting they meant something else (warn-but-allow vs hard-reject is a UX call).

---

## 5. Failure modes

| Failure | Behaviour |
|---|---|
| Script selector LLM picks clips that overlap with each other | Detect in post-validation; merge or drop the shorter overlap. |
| `face_segments` empty for a clip span (face detector missed) | Treat all 4 corners as free; default to `centered` layout. |
| Source video audio is mono / different sample rate from TTS | Re-encode during stitching with ffmpeg target params (matches existing TTS audio spec: 44.1 kHz stereo). |
| Bridge TTS voice doesn't match the speaker's voice | Acceptable for v1 (jarring but explicit). v2: voice-clone bridge using ElevenLabs/SarvamAI from a 30s reference cut from the source. |
| Selected sentence is too short for the shot's narrative beat | Raise the lower bound on `select_min_clip_duration` (~2.5s) in the script-selector prompt. |
| Director picks a layout that's not in `eligible_layouts` | Validate after Director output; force `centered` and log a warning. |
| User's prompt is wildly off-topic from any input video transcript | Script selector returns empty / very few clips. Surface as a generation error before TTS runs. |

---

## 6. Cost model (5-min raw host, 50% host-in-video)

| Item | Calls | Per-call | Total |
|---|---|---|---|
| Script-selector LLM | 1 | ~$0.01 | $0.01 |
| Bridge TTS (estimated 5–10 bridge sentences) | ~10 | $0.30 / 1k char ≈ $0.05 ea | $0.50 |
| ffmpeg slicing | ~25 | $0 | $0 |
| S3 storage | ~25 clips | negligible | ~$0.01 |
| **Raw-host marginal cost** | | | **~$0.50** |

Vastly cheaper than the avatar variant (~$10) — the savings come from no per-shot fal.ai calls.

---

## 7. Build order (recommended)

When this gets prioritised:

1. **Free-region math + helper** (§2.5) — pure function, easiest to test in isolation. Write unit tests against a known `video_spatial.sqlite`.
2. **Script-selector service** (§2.1) — can be developed against canned `video_context.json` files; no end-to-end pipeline needed.
3. **Audio stitcher** (§2.2) — extension to the existing TTS stage. Test by manually stitching two clips and verifying `narration.mp3` plays.
4. **Director extension** (§2.3) — once 1+2 work, Director can be told about clip metadata + eligible layouts.
5. **RawHostBatch** (§2.4) — replaces AvatarBatch. Smallest LOC, just ffmpeg + S3.
6. **HostPlanner unblock** — change [`host_planner_service.py`](../../ai_service/app/services/host_planner_service.py) to stop rejecting `type='raw'` and instead build a real `HostPlan` with the validation rules from §4.
7. **End-to-end smoke test**: pick a 5-min recorded talking-head, point a request at it with `host_in_video_percentage=50`, watch the FE preview light up.

---

## 8. Out of scope for v1 (explicitly)

- **Voice-clone bridges** — bridges use whatever default TTS voice the user already picked. Cloning the speaker's voice is a follow-up.
- **Multi-speaker disambiguation** — if the input video has multiple people on screen at different times, we splice based on the dominant speaker per `face_segments` row but don't run speaker diarisation. Single-speaker podcasts only for v1.
- **Reaction-shot insertion** — fancy editor moves like cutting away to a graphic during a long pause. Stick to the speaker's natural cadence.
- **Cross-video continuity** — each clip is independent. We don't hide cuts with crossfades or B-roll yet.
- **Demo-mode raw host** — `mode='demo'` input videos (screen recordings) are explicitly not supported. They go through the existing SOURCE_CLIP path with `infographic_mode=overlay`, which is a different feature.

---

## 9. Open questions worth answering before kicking off

1. **What's the max number of input videos** in `host.raw.input_video_ids`? The avatar variant has no cap. Raw should probably cap at 3–5 to keep script-selector LLM context manageable.
2. **Does the script selector need to be Director-aware** (i.e. does it know which beats need emphasis vs which are filler), or is per-sentence prosody enough?
3. **Bridge sentences** — can the script-selector emit them, or should they be written by a separate "bridge LLM" that tries harder to sound like the speaker?
4. **What if ALL the user's input videos are about the wrong topic**? Hard reject? Soft fallback to avatar variant with a warning? Probably reject.
5. **Pricing**: is the ~$0.50 marginal cost too cheap to justify the ultra-tier gate? Could we open it to `premium` tier?

---

## 10. Definition of done (when we ship this)

1. POSTing `host.type='raw'` with a valid input video produces a video where the host is the actual person from the upload, the audio is their actual voice, and the script is built from sentences they actually said.
2. Motion graphics overlay correctly in `face_segments.free_regions` zones — they never occlude the speaker.
3. `extra_metadata.host.outputs.script_selection` shows which transcript sentences were used, so debugging can answer "why did this clip get picked?"
4. SSE events surface raw-host progress (clip selection, audio stitch, ffmpeg splice) — same `sub_stage` channel the avatar variant uses, just different labels.
5. Resume safety: kill mid-stitch, resume, and the already-spliced clips are reused (idempotent on S3).
6. AI_VIDEO_GENERATION.md gains a §3.4.7 "Host (raw)" subsection that mirrors §3.4.6 (avatar) and links here from "Open follow-ups."
7. `HostPlanner.make_host_plan` no longer rejects `type='raw'` — feature is live.

---

## Quick reference — what I can read now to understand the avatar variant

The avatar variant (already shipped) is the closest existing pattern. Useful anchors:
- [`video_generation_service.py:217-238`](../../ai_service/app/services/video_generation_service.py#L217-L238) — early tier gate + legacy PiP suppression.
- [`video_generation_service.py:705-810`](../../ai_service/app/services/video_generation_service.py#L705-L810) — pre-script preamble where IntentRouter / VideoTypeClassifier / HostPlanner run in parallel.
- [`automation_pipeline.py` — `_run_avatar_batch_sync`](../../ai_service/app/ai-video-gen-main/automation_pipeline.py) — per-shot generation harness. Replace its body for raw, keep its signature.
- [`director_prompts.py` — `HOST_DIRECTOR_EXTENSION`](../../ai_service/app/ai-video-gen-main/director_prompts.py) — model the `RAW_HOST_DIRECTOR_EXTENSION` after this.
- [`fal_avatar_client.py`](../../ai_service/app/services/fal_avatar_client.py) — not used by raw, but the dataclass + bounded-concurrency pattern is reusable for future video-synthesis features.
