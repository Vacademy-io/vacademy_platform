# Render Worker & Render Pipeline — End-to-End

**Status**: Living document. Written 2026-05-26 from the code (not from older design docs — where this contradicts another doc, trust the code).
**Audience**: Engineers operating or modifying the render server, the `/render` trigger on the AI service, or anything that consumes `output.mp4`.
**Scope**: The "timeline.json + narration.mp3 → MP4 in S3" path. The render worker is a **standalone HTTP service on its own box** — it downloads its inputs from S3, renders frames with Playwright, mixes audio with FFmpeg, uploads the MP4, and calls back. It is NOT part of the `ai_service` process.

Code lives in [render_worker/](../../ai_service/render_worker/). The frame renderer it shells out to ([generate_video.py](../../ai_service/app/ai-video-gen-main/generate_video.py)) lives in the main pipeline tree and is **copied into the worker's Docker image at build time** (see §10).

---

## 1. One-paragraph mental model

The AI service never renders video itself. When a user requests an MP4, the AI service (`POST /external/video/v1/render/{video_id}`) submits a job to a remote render worker over HTTP, passing **S3 URLs** for the timeline, narration, words, and optional assets — never file bytes. The worker (a single-process FastAPI app on a Hetzner box, port 8090) downloads those inputs into a temp dir, preprocesses the timeline, splits the frame range across N parallel headless-Chrome subprocesses that each run `generate_video.py --frames-only`, assembles the JPEG frames + audio into an H.264 MP4 with FFmpeg, uploads it to `ai-videos/{video_id}/video/output.mp4`, and POSTs a completion callback to the AI service. The AI service records progress + the final URL in `extra_metadata.render_status` and on the video record's `s3_urls.video`.

```
Admin FE                AI service (FastAPI)              Render worker (separate box, :8090)
   │                          │                                      │
   │  POST /render/{id}       │                                      │
   ├─────────────────────────▶│  RenderService.submit() ──POST /jobs─▶│  (queues job, returns job_id)
   │                          │                                      │
   │                          │   ◀──POST /render-callback (progress)─┤  worker downloads S3 inputs,
   │  poll /render/status     │                                      │  renders frames (Playwright),
   │◀─────────────────────────┤   (reads extra_metadata.render_status)│  FFmpeg-assembles MP4,
   │                          │   ◀─POST /render-callback (completed)─┤  uploads MP4 to S3, calls back
   │                          │   updates s3_urls.video               │
```

---

## 2. Process topology

| Component | Where | Code |
|---|---|---|
| Render worker HTTP API | Standalone box (Hetzner), container `vacademy-render`, port **8090** | [render_worker/main.py](../../ai_service/render_worker/main.py) |
| Render orchestration (download → frames → ffmpeg → upload) | inside the worker | [render_worker/worker.py](../../ai_service/render_worker/worker.py) → `RenderWorker.render()` |
| Playwright frame renderer | subprocess spawned by `worker.py` | [generate_video.py](../../ai_service/app/ai-video-gen-main/generate_video.py) (copied into the image) |
| Single-shot Chromium (screenshot / bbox / preview) | inside the worker, long-lived browser | [render_worker/screenshot_worker.py](../../ai_service/render_worker/screenshot_worker.py) |
| Audio slice/splice/silence ops | inside the worker | [render_worker/audio_ops.py](../../ai_service/render_worker/audio_ops.py) |
| Whisper transcription | inside the worker | [render_worker/transcribe_worker.py](../../ai_service/render_worker/transcribe_worker.py) |
| Video/image indexing | inside the worker | [render_worker/extractor/](../../ai_service/render_worker/extractor/) |
| HTTP client → worker | inside `ai_service` | [render_service.py](../../ai_service/app/services/render_service.py) → `RenderService` |
| `/render` trigger + `/render-callback` | inside `ai_service` | [external_video_generation.py](../../ai_service/app/routers/external_video_generation.py) |

The worker is **single-process** (`uvicorn ... --workers 1`) with an **in-memory job dict** — no database. Job state lives only in `jobs[job_id]` and is lost on restart; the AI service is the durable record via the callback. One worker box, `MAX_CONCURRENT_JOBS` (default `2`) jobs at a time across ALL job types (render + index + transcribe share the same capacity counter).

---

## 3. The `/jobs` render lifecycle — `RenderWorker.render()`

This is the core path. Source: [worker.py](../../ai_service/render_worker/worker.py) `render()` (≈ lines 59–1208). Everything happens inside a `tempfile.mkdtemp(prefix="render_{video_id}_")` work dir that is `rmtree`'d in a `finally` block — success or failure, the box is left clean.

Progress is reported via an `on_progress(pct)` callback at fixed milestones: **5** (download start) → **15** (inputs done) → **20** (workers about to launch) → **25–70** (frame rendering, scaled by frames done) → **70** (frames done) → **75** (after SOURCE_CLIP compositing) → **85** (after post-trim) → **100** (uploaded).

### 3.1 Download inputs (→ 15%)

Everything comes from S3/HTTP URLs. `_download()` tries an S3 SDK download first when the URL contains the public bucket host, else falls back to a plain HTTP GET with a `VacademyRenderWorker/1.0` User-Agent.

- `narration.mp3` ← `audio_url` (required)
- `time_based_frame.json` ← `timeline_url` (required) — the timeline
- `narration.words.json` ← `words_url` (optional, drives captions)
- `branding_meta.json` ← `branding_meta_url` (optional). If present and it has `intro_duration_seconds > 0`, that value **overrides `audio_delay`** so narration starts after the intro-branding card.
- `avatar_video.mp4` ← `avatar_video_url` (optional)
- **Extra audio tracks** — background music / uploaded tracks. Read from `timeline.meta.audio_tracks[]` if not passed explicitly. Each: `{id,label,url,volume,delay,fadeIn,fadeOut}`.
- **SFX cues** — per-shot sound effects from `sound_planner`. Parsed out of every `timeline.entries[].sound_cues[]`; deduped by URL (`md5(url)[:10]` filename), downloaded once each. Each cue carries `absolute_time` (already includes the intro offset) + `volume` + `duration`.
- **Source videos** ← `source_video_urls[]` (optional, downloaded later, only when SOURCE_CLIP entries exist).

### 3.2 Timeline preprocessing (the part that quietly fixes a lot of bugs)

Before rendering, the timeline JSON is rewritten in place. All HTML-level rewrites go through the **shared** [shot_preprocess.py](../../ai_service/app/ai-video-gen-main/shot_preprocess.py) `preprocess_shot_html()` so a shot rendered via `/shot/preview-mp4` is byte-identical to the same shot inside a full `/jobs` render. A `[shot-preprocess] build=...` log line proves which preprocessor build ran. Per entry it:

- strips inline `<video>` / stage-drift / `vx-timescale` / GSAP CDN tags, converts `vx-shot` CSS transitions to GSAP tweens;
- extracts a per-shot `vx-timescale` and, when ≠ 1.0, attaches `entry["timescale"]` so the dispatcher builds a per-shot child timeline at that scale (FE-editor duration adjustment).

Then `render()` does **timeline-level** fixups (these matter for "black frames" / "video too long" bugs):

- **Duration computation.** `total_duration = max(narration_end, timeline_end)` where `narration_end = audio_dur + audio_delay`. **Background music / extra tracks never extend the video** — they're truncated by FFmpeg `-shortest`. The dominant source is logged (`dominant=narration | timeline_visuals`).
- **Trailing-shot extension.** If narration outlasts the last shot's `exitTime`, every trailing entry's `exitTime` is pushed to `total_duration` so the viewer doesn't see a black tail during the closing narration.
- **Gap-snap** (`[GAP-SNAP]`). Director storyboards often leave sub-second gaps between shots (shot N exits 15.9s, shot N+1 starts 16.2s). The renderer's "active entries at t" filter would render those gap frames as bare page background (the **blank-white-frame bug**). Each content shot's `exitTime` is extended to touch the next shot's `inTime` for positive gaps ≤ 10s. Applied at render time so OLD timelines get fixed without regeneration. Branding entries (`id` starts with `branding-`) are excluded.

Rich diagnostics are logged before rendering: `[NARRATION-DIAG]`, `[TIMELINE-DIAG]` (coverage + gaps), `[EXTRA-AUDIO-DIAG]`, `[SFX-DIAG]`, `[AUDIO-VIDEO-DIAG]`. These are the first place to look when a render comes out wrong.

### 3.3 Parallel frame rendering (25 → 70%)

Frames are split across **N parallel subprocesses**, each running `generate_video.py --frames-only --start-frame S --end-frame E` over a contiguous slice of `total_frames` (`total_frames = int(total_duration * fps) + 1`). All workers write JPEGs into one shared `.render_frames/` dir, so reassembly is just a sorted glob.

**Worker count (`NUM_WORKERS`)** — each Chromium worker peaks at ~2.5 GB:
- `RENDER_PARALLEL_WORKERS` env var → explicit override (warns if above the RAM-safe cap).
- Unset → auto-cap from `/proc/meminfo`: `workers = max(1, floor((MemAvailable_MB - 1024) / 2560))`. So ~2 on an 8 GB box, ~6 on 16 GB, ~12 on 32 GB. Last-resort fallback is 4.

**FPS**: validated against `(15,20,25,30,45,60)`, defaults to **25**.

**Native render resolution**: frames always render at **1920×1080** (landscape) or **1080×1920** (portrait) regardless of the user's requested output resolution — the HTML/CSS/SVG was authored for that canvas. The requested `width`×`height` (e.g. 1280×720) is applied as an FFmpeg **downscale** during assembly, not at render time.

**Subprocess management** (`_run_chunk`): each chunk is `subprocess.Popen`'d with `cwd=ai-video-gen-main`, stdout/stderr drained on threads, lines forwarded to container logs as `[w{i}] ...`. Chromium launches are **staggered 2s/worker** so N workers don't all hit the spawn memory peak simultaneously. Per-worker timeout is **5400s** (90 min) → kill + `returncode=124`. The parent parses `[FRAME-PROGRESS] ... rendered=X/Y` lines to compute aggregate progress.

If any worker exits non-zero, the render fails with a curated error: the parent picks the most informative tail (Python traceback > `[WORKER-TIMEOUT]` > playwright error > generic), and tags how far the worker got (`[never reached page setup]` / `[setup reached, dies mid-render; last frame ~N]`). Full stdout/stderr per worker is saved to `worker_{i}_stdout.log` / `worker_{i}_stderr.log` in the work dir. `[BROWSER ERROR]`/`[BROWSER EXCEPTION]` lines from successful workers are collected into `browser_errors.log`.

### 3.4 Frame-gap backfill (the silent-dropped-frame guard)

Under memory pressure, Playwright's `screenshot` occasionally "succeeds" without writing the file — no exception, just a missing JPG. FFmpeg's `image2` demuxer then fails on a gap in the `0–4` probe range even when thousands of frames exist. `[FFMPEG-PREFLIGHT]` detects index gaps and **backfills each missing frame with a copy of its nearest existing neighbor** before invoking FFmpeg. Cost: a single-frame freeze at the gap; vastly better than failing the whole render.

### 3.5 SOURCE_CLIP compositing (70 → 75%)

If `source_video_urls` is set and the timeline has `SOURCE_CLIP` entries, `_composite_source_clips()` (OpenCV) overlays the rendered HTML frames on top of extracted source-video footage. Entries are grouped by `source_video_index`; each source video is downloaded, composited, then deleted to free disk. Two modes, auto-detected from the first frame (or forced via `entry.compositing_mode == "fullscreen"`):
- **card** — source video placed in a detected dark rectangular region of the overlay;
- **fullscreen** — source video behind, overlay composited on top via brightness-based alpha.

### 3.6 FFmpeg assembly + audio mix (75 → 85%)

One `ffmpeg` invocation builds the final MP4. Inputs in fixed order: `0` = frame sequence (`frame_%06d.jpg` at FPS), `1` = narration, `2..` = extra audio tracks, then SFX cues. The `filter_complex`:

1. **Video**: `[0:v]scale=W:H:flags=lanczos[scaled]` — downscale native frames to requested output size.
2. **Narration**: `adelay` by `audio_delay`, then format-normalize (`aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo` — required because `amix` needs matching rate/format/layout and catalog SFX vary wildly).
3. **Extra tracks**: per track `adelay` → `volume` → `fadeIn`; if the track outlasts `total_duration` it gets a 0.6s tail fade-out timed to the cut (so `-shortest` doesn't pop); else the user's `fadeOut` (reverse→fade-in→reverse trick).
4. **SFX cues**: per cue `adelay`(absolute_time) → `volume` → 30ms tail fade; `asplit` into the mix feed + a sidechain key when ducking.
5. **Ducking**: when SFX exist, all keys are summed + `apad`'d (infinite trailing silence so `sidechaincompress`'s framesync doesn't truncate narration when the last SFX ends), then narration is `sidechaincompress`'d (`threshold=0.18:ratio=2:attack=15:release=200` ≈ −4 dB duck, matching the FE player preview).
6. **Mix**: `amix=inputs=N:duration=longest:normalize=0[aout]` (or `anull` passthrough when there's only narration).

Output: `-c:v libx264 -pix_fmt yuv420p -crf 23 -preset fast -c:a aac -shortest`. 600s timeout.

**Post-trim (Fix C)**: some runs ship containers longer than the planned timeline (trailing dead frames). After assembly the MP4 is re-cut to exactly `total_duration` (`-t`, re-encode video keyframe-accurate, stream-copy audio, `+faststart`) before upload. Failure is non-fatal — the original is kept.

### 3.7 Upload + cleanup (→ 100%)

`_upload()` puts the MP4 at S3 key **`ai-videos/{video_id}/video/output.mp4`** (bucket from `AWS_S3_PUBLIC_BUCKET`, default `vacademy-media-storage-public`, `ContentType=video/mp4`) and returns `https://{bucket}.s3.amazonaws.com/{key}`. The `finally` block removes the work dir.

---

## 4. `generate_video.py` — the frame renderer

The worker shells out to this; it is the same engine the legacy local pipeline used, just driven by CLI args. Key facts (source: [generate_video.py](../../ai_service/app/ai-video-gen-main/generate_video.py)):

- CLI: `generate_video.py <audio> <timeline> <output> --frames-dir ... --fps ... --width ... --height ... --frames-only [--start-frame S --end-frame E]` plus caption/branding flags (`--captions-words`, `--captions-settings`, `--show-captions/--no-show-captions`, `--show-branding/--no-show-branding`, `--branding-json`, `--audio-delay`). `--frames-only` is what makes parallel rendering possible — it renders only its `[start,end)` slice and skips assembly (the worker assembles).
- **Rendering model**: headless **Google Chrome** (not bundled Chromium — see §10) loads a harness page, the shot HTML is injected into shadow roots via the dispatcher (`window.__updateSnippets`), and for each frame it **seeks** `gsap.globalTimeline.totalTime(t)` (+ `window._animeSeek(t)`), waits a double-RAF paint, and screenshots. This is deterministic frame-stepping, not real-time playback — identical HTML produces identical frames as the browser player.
- Per-frame work is a single batched `window.__batchRenderFrame({camera, character, caption, t, seekVideos, segmentChanged})` evaluate, then `page.screenshot(type="jpeg", quality=95, clip={0,0,width,height})` → `frame_{index:06d}.jpg`. Camera is static (matches FE preview — no drift/zoom).
- Captions are emitted **per-frame as HTML** from `narration.words.json` + caption settings (phrase or karaoke style, per-word highlight in karaoke). Font size is pre-scaled by `width/1920`.
- Emits `[RENDER-VERSION] generate_video.py build=...` once and `[FRAME-PROGRESS] ... rendered=X/Y` every 50 frames (the liveness signal the worker forwards). Other diagnostic tags: `SIZING-DIAG`, `FONT-DIAG`, `AUTO-SHRINK` (shrinks overflowing text to fit the host), `VIDEO-DIAG`, `ANNOT-DIAG`.

---

## 5. HTTP API surface (`main.py`)

All routes (except `/health`) require header `X-Render-Key` matching the `RENDER_KEY` env var (no-op auth if `RENDER_KEY` is empty).

| Method · Path | Purpose | Sync/Async |
|---|---|---|
| `GET /health` | `{status, active_jobs, max_concurrent}` | sync, no auth |
| `POST /jobs` | Submit a render job (`RenderJobRequest`). Returns `{job_id, status:"queued"}`. 429 if at capacity. | async (fire-and-forget task) |
| `GET /jobs/{job_id}` | Poll render job status (`RenderJobStatus`: status/progress/video_url/error) | sync (in-memory) |
| `POST /screenshot` | Capture ≤5 PNGs of one shot's HTML at given timestamps. For the vision reviewer. | sync |
| `POST /bbox-check` | Deterministic overflow lint — walk the shadow DOM, report elements whose bbox crosses the canvas edge. | sync |
| `POST /shot/preview-mp4` | Render one shot's HTML to a short silent MP4. Returns `video/mp4` bytes. Dev/iteration tool. | sync |
| `POST /index-jobs` + `GET /index-jobs/{id}` | Video/image input indexing (transcript/visuals/ocr/face). Dispatches on `kind`. | async |
| `POST /transcribe-jobs` + `GET /transcribe-jobs/{id}` | Whisper STT (`base`/`small`/`medium`, transcribe/translate/both) | async |
| `POST /concat_audio` | Crossfade-merge Lyria background-music segments → MP3 in S3 | sync |
| `POST /audio/slice` | Cut one MP3 into N clips (sentence clips) | sync |
| `POST /audio/splice` | Replace a time range of an MP3 with a new clip, crossfade both joins; returns `duration_delta` | sync |
| `POST /audio/silence_range` | Replace a range with equal-length silence (preserves duration) | sync |

`RenderJobRequest` carries everything the render needs: `video_id`, the four S3 URLs, `callback_url`, `show_captions`/`show_branding`, `audio_delay`, `width`/`height`, `fps`, the full caption-style set, and `source_video_urls`.

### 5.1 Concurrency & capacity

All three job dicts (`jobs`, `index_jobs`, `transcribe_jobs`) share one capacity counter. A submit is rejected with **429** when `active_render + active_index + active_transcribe >= MAX_CONCURRENT_JOBS`. The sync endpoints (`/screenshot`, `/bbox-check`, `/audio/*`, `/concat_audio`) do **not** count against capacity — they're fast and run inline. The screenshot/bbox/preview paths reuse one long-lived Chromium (`ScreenshotWorker` singleton) so cold-start is amortized.

---

## 6. Progress & callbacks

The worker uses a **push** model, not polling. `_update_progress(job_id, pct)`:
- Updates the in-memory job.
- Debounce-POSTs to the AI service's `callback_url`: at most once per 5s OR when progress moves ≥ 2% (whichever first). Sync `httpx` client (runs on the subprocess-streamer thread).
- If no `callback_url` was supplied, the push is skipped — the worker logs a **warning** at job start (`has NO callback_url ... Check AI_SERVICE_PUBLIC_URL`), because a missing callback is the #1 reason renders complete on the worker but the FE never sees them.

`_send_callback(url, data)` posts terminal updates (`completed` with `video_url`, or `failed` with `error`). Callback POSTs carry the `X-Render-Key` header. Callback failure is non-fatal (logged) — the AI service has a watchdog on `render_status.last_seen_at`.

---

## 7. AI service side — trigger, client, callback

### 7.1 Trigger — `POST /external/video/v1/render/{video_id}`

[external_video_generation.py:1928](../../ai_service/app/routers/external_video_generation.py#L1928) `request_video_render`:
- 503 if `settings.render_server_url` unset; 404 if video unknown; 400 if `timeline` or `audio` S3 URL missing (HTML+TTS stages must be done).
- Optional `RenderOptionsBody`: `resolution` (`720p`/`1080p`), `fps`, `show_captions`, `show_branding`, and the full caption-style set. Resolution × orientation → dimensions via `_RESOLUTION_MAP` (landscape 720p=1280×720 / 1080p=1920×1080; portrait swapped).
- Resolves `source_video_urls` from metadata or by looking up `ai_input_videos` records (for SOURCE_CLIP).
- Builds the callback URL from `AI_SERVICE_PUBLIC_URL` + `api_base_path` (`/ai-service`) + `/external/video/v1/render-callback/{video_id}`. When `AI_SERVICE_PUBLIC_URL` is unset (dev), no callback URL → the worker can't reach back, so there's no live progress (DB-only).
- Calls `RenderService.submit(...)` → returns `{job_id}`.

### 7.2 Client — `RenderService`

[render_service.py](../../ai_service/app/services/render_service.py). Thin `httpx` wrapper: `submit()` (→ `POST /jobs`, 30s timeout), `check_status()` (→ `GET /jobs/{id}`), `health_check()`, plus `slice_audio` / `splice_audio` / `silence_audio_range` (→ `/audio/*`, 300s timeout for cold ffmpeg+boto3). Sends `X-Render-Key` from `settings.render_server_key`. Only includes optional params in the payload when non-None so the worker's own defaults apply.

### 7.3 Callback — `POST /external/video/v1/render-callback/{video_id}`

[external_video_generation.py:2306](../../ai_service/app/routers/external_video_generation.py#L2306). Validates `X-Render-Key`, then on **every** callback writes `extra_metadata.render_status` = `{status, progress?, video_url?, error?, last_seen_at}` (so the FE-facing `/render/status/{job_id}` is a fast DB read, and the watchdog has a fresh `last_seen_at`). On `completed`, it also calls `repo.update_files(video_id, {video: "{id}-video"}, {video: video_url})` so `s3_urls.video` is populated. `failed` just records the error.

---

## 8. Configuration (env vars)

Set on the worker container (see `deploy.sh` `docker run -e ...` — **secrets are redacted here; read the deploy script for live values**):

| Var | Meaning | Default |
|---|---|---|
| `RENDER_KEY` | Shared secret; must match the AI service's `RENDER_SERVER_KEY`. Empty disables auth. | `""` |
| `MAX_CONCURRENT_JOBS` | Total in-flight jobs (render+index+transcribe) | `2` |
| `RENDER_PARALLEL_WORKERS` | Override the RAM-based chromium worker auto-cap | unset (auto) |
| `AWS_S3_PUBLIC_BUCKET` | Bucket for the output MP4 | `vacademy-media-storage-public` |
| `S3_AWS_ACCESS_KEY` / `AWS_ACCESS_KEY_ID`, `S3_AWS_ACCESS_SECRET` / `AWS_SECRET_ACCESS_KEY`, `S3_AWS_REGION` / `AWS_REGION` | S3 creds (S3_* preferred, AWS_* fallback) | region `ap-south-1` |
| `AWS_BUCKET_NAME` | Bucket for `/concat_audio` / audio-op outputs | `vacademy-media-storage` |
| `WHISPER_MODEL_OVERRIDE` | Force a Whisper model size for transcription | unset |
| `LOCAL_TRANSCRIPT_DIR` | Dev-only: serve transcripts from disk when AWS creds absent | `/tmp/vacademy-transcripts` |

On the **AI service** side: `RENDER_SERVER_URL`, `RENDER_SERVER_KEY`, `AI_SERVICE_PUBLIC_URL`, `api_base_path`.

---

## 9. Deployment

- **Image**: [Dockerfile](../../ai_service/render_worker/Dockerfile) — `python:3.11-slim-bookworm` + FFmpeg + Chromium system libs + fonts. Installs `playwright install chrome --with-deps` (**Google Chrome, not bundled Chromium** — Chrome ships the H.264/AAC proprietary codecs the bundled Chromium lacks; without it, launch fails at `headless_shell`, and `screenshot_worker.py` launches with `channel="chrome"` for the same reason). Runs `uvicorn main:app --host 0.0.0.0 --port 8090 --workers 1`.
- **Build**: [build.sh](../../ai_service/render_worker/build.sh) assembles a `.build/` context — copies the worker files **and** copies `generate_video.py`, `render_harness.py`, `dispatcher_install_js.py`, `shot_preprocess.py`, `video_options.json`, `captions_settings.json`, `branding.json`, and `assets/` from `app/ai-video-gen-main/` into `ai-video-gen-main/` inside the image. The dispatcher JS and preprocessor are **shared** between the production render and the single-shot preview so they install byte-identical page state.
- **Deploy**: [deploy.sh](../../ai_service/render_worker/deploy.sh) rsyncs code to the box (`root@157.90.162.154:/opt/vacademy/ai_service`), runs `build.sh` remotely, then stops/removes the old `vacademy-render` container and `docker run`s the new one with `--restart unless-stopped -p 8090:8090`. Health: `http://157.90.162.154:8090/health`.

**Critical coupling**: `generate_video.py` and friends are *copied at build time*, not imported live. If you change the renderer, captions, dispatcher, or `shot_preprocess.py` in `app/ai-video-gen-main/`, you **must rebuild + redeploy the worker** for the change to take effect on production renders. The `[RENDER-VERSION]` and `[shot-preprocess] build=` log lines exist precisely to verify a fresh image is running.

---

## 10. Failure modes & where to look

| Symptom | Likely cause | Diagnostic / fix |
|---|---|---|
| Render completes on worker, FE never updates | No `callback_url` (AI_SERVICE_PUBLIC_URL unset) | Worker logs `has NO callback_url`. Set `AI_SERVICE_PUBLIC_URL`. |
| Black frames mid-video | Timeline gaps between shots | `[GAP-SNAP]` / `[TIMELINE-DIAG]` logs; gap-snap auto-fixes ≤10s gaps |
| Leading black | First shot `inTime > 0.5s` | `[TIMELINE-DIAG] first shot starts at ...` warning |
| Black tail | Narration outlasts visuals | Trailing-shot extension handles it; check `[AUDIO-VIDEO-DIAG]` |
| Narration cut off near a late SFX | duckkey EOF truncation | `apad` on the sidechain key; `[SFX-DIAG]`/`[AUDIO-MIX]` logs |
| FFmpeg "could find no file ... index 0-4" | Playwright silently dropped frames | `[FFMPEG-PREFLIGHT]` backfill (nearest-neighbor copy) |
| 4th chromium launch fails / OOM | Too many parallel workers for box RAM | Auto-cap via `/proc/meminfo`; lower `RENDER_PARALLEL_WORKERS` |
| Worker exits non-zero | Render crash | `worker_{i}_stderr.log`; parent logs curated traceback tail + progress tag |
| Container longer than timeline | trailing dead frames | Post-trim (Fix C) re-cuts to `total_duration` |
| Launch fails at `headless_shell` | Bundled Chromium instead of Chrome | Image must `playwright install chrome`; browser launched with `channel="chrome"` |

---

## 11. Files reference

**Render worker** ([render_worker/](../../ai_service/render_worker/)):
- [main.py](../../ai_service/render_worker/main.py) — FastAPI app, all endpoints, job tracking, progress push, callbacks
- [worker.py](../../ai_service/render_worker/worker.py) — `RenderWorker.render()` orchestration, `_download`, `_composite_source_clips`, `_upload`
- [screenshot_worker.py](../../ai_service/render_worker/screenshot_worker.py) — long-lived Chromium for `/screenshot`, `/bbox-check`, `/shot/preview-mp4`
- [audio_ops.py](../../ai_service/render_worker/audio_ops.py) — slice / splice / silence
- [transcribe_worker.py](../../ai_service/render_worker/transcribe_worker.py) — Whisper STT
- [extractor/](../../ai_service/render_worker/extractor/) — video/image indexing pipeline
- [Dockerfile](../../ai_service/render_worker/Dockerfile) · [build.sh](../../ai_service/render_worker/build.sh) · [deploy.sh](../../ai_service/render_worker/deploy.sh) · [requirements.txt](../../ai_service/render_worker/requirements.txt)

**Copied into the image at build time** (from `app/ai-video-gen-main/`):
- [generate_video.py](../../ai_service/app/ai-video-gen-main/generate_video.py) — Playwright frame renderer
- [shot_preprocess.py](../../ai_service/app/ai-video-gen-main/shot_preprocess.py) — shared HTML preprocessing
- `render_harness.py`, `dispatcher_install_js.py` — shared page harness + shadow-DOM dispatcher
- `video_options.json`, `captions_settings.json`, `branding.json`

**AI service side**:
- [render_service.py](../../ai_service/app/services/render_service.py) — HTTP client
- [external_video_generation.py](../../ai_service/app/routers/external_video_generation.py) — `/render/{video_id}` trigger, `/render-callback/{video_id}`

**Companion docs**: [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md) (§0 has the render-server box in the architecture diagram; §2.3 the external render API), [AI_VIDEO_AUDIO_MIX.md](./AI_VIDEO_AUDIO_MIX.md) (audio-mix detail), [CAPTIONS.md](./CAPTIONS.md) (caption rendering).
