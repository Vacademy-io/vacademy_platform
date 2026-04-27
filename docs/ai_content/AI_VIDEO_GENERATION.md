# AI Video Generation — End-to-End Architecture

**Status**: Living document. Last updated 2026-04-15.
**Audience**: Engineers working on the `ai_service` pipeline, admin/learner frontends, or the render server.
**Scope**: The full "prompt → MP4" flow for VIDEO content, plus related content types (QUIZ, STORYBOOK, SLIDES, etc.) that share the same pipeline.

**Recent architectural shift (2026-04)**: The Director LLM now owns all visual-style decisions per-shot. The old user-facing `visual_style` mode selector (`standard` / `illustrated_svg` / `product_showcase`) has been **removed from the UI and deprecated in the API** — the Director picks theme, background, shot type, and animation language per beat, and can freely shift styles across a long video's timeline. See §3.4 and §3.7 for the new flow.

---

## 0. Quick mental model

```
                     ┌────────────────────────────────────────────────────────┐
                     │              External HTTP (gateway)                    │
                     └─────────────────────┬──────────────────────────────────┘
                                           │
                                           ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  ai_service  (FastAPI, Python)                                               │
 │  ──────────────────────────────                                               │
 │  routers/external_video_generation.py   ◄── all external calls enter here    │
 │    │                                                                         │
 │    ▼                                                                         │
 │  services/video_generation_service.py   ◄── business logic, credits, DB       │
 │    │                                                                         │
 │    ▼                                                                         │
 │  ai-video-gen-main/automation_pipeline.py   ◄── the pipeline orchestrator    │
 │    │                                                                         │
 │    ├── prompts.py                  → script/image-style prompts              │
 │    ├── shot_type_cards.py          → per-shot-type HTML/CSS/JS patterns      │
 │    ├── director_prompts.py         → shot-planning prompt + act planner      │
 │    ├── skill_registry.py           → motion-primitive registry (Phase 1)     │
 │    ├── skill_composer.py           → <skill> tag → rendered HTML/CSS/JS      │
 │    ├── skills/**/skill.py          → 6 starter motion primitives             │
 │    ├── _generate_script_plan       → LLM call #1: narration + beat outline   │
 │    ├── TTS (ElevenLabs/Sarvam/Edge)→ audio + word timestamps                 │
 │    ├── _generate_style_guide       → LLM call #2: palette, background        │
 │    ├── _run_act_planner            → LLM call #3a (super_ultra): act arc     │
 │    ├── _run_director               → LLM call #3b: shot-by-shot plan         │
 │    ├── _build_shot_pack            → shared design tokens for all shots      │
 │    ├── _shot_task (parallel)       → LLM call #4…N: one per shot             │
 │    ├── skill composer pass         → substitute <skill> tags                 │
 │    ├── _validate_shot_animation_density → regen sparse shots (super_ultra)   │
 │    ├── _process_generated_images   → Seedream / Pexels / Pixabay for images  │
 │    ├── _process_stock_videos       → Pexels / Pixabay + LLM ranker (super)   │
 │    └── _ensure_fonts               → inject CSS + SVG defs                   │
 │    │                                                                         │
 │    ▼                                                                         │
 │  timeline.json  +  narration.mp3  +  words.json  →  stored in S3              │
 │                                                                               │
 └──────────────────────────────────────────────────────────────────────────────┘
                                 │
           ┌─────────────────────┼─────────────────────────┐
           │                     │                         │
           ▼                     ▼                         ▼
    ┌──────────────┐      ┌──────────────┐        ┌──────────────┐
    │ Admin FE     │      │ Learner FE   │        │ Render Server│
    │ AIVideoPlayer│      │ AIVideoPlayer│        │ generate_video.py │
    │ (iframes)    │      │ (iframes)    │        │ (Playwright) │
    └──────────────┘      └──────────────┘        └──────┬───────┘
                                                          │
                                                          ▼
                                                  ┌──────────────┐
                                                  │  MP4 in S3   │
                                                  └──────────────┘
```

Two playback paths:
- **Browser player** (admin/learner): loads the timeline JSON, renders each shot's HTML in an iframe, plays the audio in sync. Real-time, not seekable at frame level.
- **Render server**: same HTML, but rendered in a headless Playwright browser that advances `gsap.globalTimeline.totalTime(t)` frame-by-frame and screenshots each frame. Outputs an MP4.

Both playback paths consume **identical** HTML/CSS/JS. The pipeline generates once, both contexts render from the same source of truth.

---

## 1. Repository layout — files that matter

### 1.1 Backend (Python, `vacademy_platform/ai_service/`)

| File | What it does |
|------|---------------|
| `app/routers/external_video_generation.py` | FastAPI routes under `/external/video/v1/*` — generate, status, urls, history, render, frame ops, audio tracks, TTS voices. |
| `app/schemas/video_generation.py` | Pydantic request/response models. `VideoGenerationRequest` is the canonical input contract. |
| `app/services/video_generation_service.py` | Business logic: credits, persistence, stage dispatch, background task management. Two overloads of `generate_till_stage()`. |
| `app/services/token_usage_service.py` | Credit charges and refund-on-failure. |
| `app/services/render_service.py` | Thin HTTP client for the external render server. |
| `app/ai-video-gen-main/automation_pipeline.py` | The pipeline orchestrator. **`run()`** is the main entry point. ~6300 lines — owns the full script→audio→HTML→timeline lifecycle. |
| `app/ai-video-gen-main/prompts.py` | Script-generation system & user prompts, `TOPIC_SHOT_PROFILES`, image-style classification. |
| `app/ai-video-gen-main/shot_type_cards.py` | Per-shot-type reference cards (HTML templates, script blocks, guidelines). `CORE_PREAMBLE` documents all CSS utilities. `build_per_shot_system_prompt(shot_type)` builds a focused prompt with just the relevant card. |
| `app/ai-video-gen-main/director_prompts.py` | Director LLM prompts. Exports `DIRECTOR_SYSTEM_PROMPT`, `SUPER_ULTRA_DIRECTOR_EXTENSION` (few-shot examples), `ACT_PLANNER_SYSTEM_PROMPT`, `build_director_user_prompt()`, `build_act_planner_user_prompt()`, `build_emphasis_map()`. |
| `app/ai-video-gen-main/skill_registry.py` | Filesystem-discovered registry for motion-primitive skills. Loads `skills/**/skill.py`, validates METADATA/PARAMS_SCHEMA/render(), caches once per process. Exposes `get_registry()`, `build_catalog_for_shot()`, `validate_params()`. |
| `app/ai-video-gen-main/skill_composer.py` | Pure function `compose(shot_html, ctx)` that scans for `<skill>` tags, validates params, renders each skill, and substitutes inline. Aggregates CSS/JS into the final HTML. |
| `app/ai-video-gen-main/skills/**/skill.py` | Individual motion primitive modules (6 shipped — `bar_chart_grow`, `number_counter`, `typewriter_text`, `equation_term_reveal`, `stagger_list`, `ring_progress`). Drop-in: add a folder, no pipeline changes. |
| `app/ai-video-gen-main/pexels_service.py` | Pexels stock photo + video client. Exposes `search_videos()` (legacy single-pick) and `search_video_candidates()` (returns N candidates for LLM ranking). |
| `app/ai-video-gen-main/pixabay_service.py` | Pixabay stock photo + video client. Mirrors the PexelsService surface (`search_photos`, `search_videos`, `search_video_candidates`) so the pipeline can swap providers transparently. Used for illustrations / diagrams / educational imagery where Pexels is thin. |
| `app/ai-video-gen-main/generate_video.py` | The Playwright render engine. Loads HTML, advances GSAP timeline, screenshots each frame, emits MP4. Not called from `ai_service` — runs as its own render server. |
| `app/ai-video-gen-main/content_type_prompts.py` | Per-content-type prompt overrides (QUIZ, STORYBOOK, SIMULATION, etc.). |
| `app/ai-video-gen-main/map_assets.py` | Pre-built SVG maps (world, countries, regions) the LLM can reference. |
| `app/repositories/ai_video_repository.py` | DB persistence. |

### 1.2 Frontend — Admin dashboard (`vacademy_platform/frontend-admin-dashboard/`)

| File | What it does |
|------|---------------|
| `src/routes/video-api-studio/index.tsx` | Video API studio landing page. |
| `src/routes/video-api-studio/console/index.tsx` | Generation console — prompt input + live SSE progress + result. |
| `src/routes/video-api-studio/-components/PromptInput.tsx` | The big prompt+options composer. Houses Quality tier, language, voice, reference files, orientation, captions, model picker. **No Visual Style selector** — the Director owns style decisions now. |
| `src/routes/video-api-studio/-components/ContentSelector.tsx` | Content type picker (VIDEO/QUIZ/STORYBOOK/...). |
| `src/routes/video-api-studio/-components/VideoResult.tsx` | Shows the generated result (AIVideoPlayer). |
| `src/routes/video-api-studio/-components/HistorySidebar.tsx` | Past generations list. |
| `src/routes/video-api-studio/-components/GenerationProgress.tsx` | SSE progress bar. |
| `src/routes/video-api-studio/-components/RenderSettingsDialog.tsx` | Resolution/fps/caption/watermark options for the render request. |
| `src/routes/video-api-studio/-services/video-generation.ts` | Types + API client (`generateVideo`, `getRemoteHistory`, `regenerateFrame`, `requestVideoRender`, etc.). The canonical frontend contract. |
| `src/components/ai-video-player/AIVideoPlayer.tsx` | Plays legacy VIDEO timelines. |
| `src/components/ai-video-player/AIContentPlayer.tsx` | Modern player that dispatches on `content_type` (VIDEO/QUIZ/STORYBOOK/...). Calls `initializeLibraries()`. |
| `src/components/ai-video-player/library-loader.ts` | Maps `ContentType → []string` of CDN libraries to load into the host page. |
| `src/components/ai-video-player/html-processor.ts` | Composes the iframe srcdoc: common libraries + base styles + shot HTML. Source of truth for browser-iframe playback. |
| `src/components/ai-video-player/navigation-controller.ts` | Time-driven / user-driven / self-contained playback modes. |
| `src/components/ai-video-editor/VideoEditorPage.tsx` | Timeline-level editor (non-regen). |

### 1.3 Frontend — Learner dashboard (`vacademy_platform/frontend-learner-dashboard-app/`)

Same AIVideoPlayer module (copy-pasted — no shared package):

| File | What it does |
|------|---------------|
| `src/components/ai-video-player/AIVideoPlayer.tsx` | Plays VIDEO/QUIZ/STORYBOOK content. |
| `src/components/ai-video-player/library-loader.ts` | CDN library config. |
| `src/components/ai-video-player/html-processor.ts` | Iframe srcdoc composer. |
| `src/components/ai-video-player/navigation-controller.ts` | Playback mode controller. |

**No generation UI on the learner side.** The learner only *consumes* — videos are served as pre-rendered MP4s or interactive HTML timelines from S3.

---

## 2. External HTTP API

**Base prefix**: `{AI_SERVICE_BASE_URL}/external/video/v1` where `AI_SERVICE_BASE_URL` comes from `settings.api_base_path` (typically `/ai-service`).

**Auth**: Every route requires header `X-Institute-Key: <institute-api-key>`. Credits-gated routes also run `require_credits("video", ...)`.

### 2.1 Generate

`POST /external/video/v1/generate`

```json
{
  "prompt": "Explain quantum entanglement to a 5-year-old",
  "content_type": "VIDEO",
  "language": "English",
  "captions_enabled": true,
  "html_quality": "advanced",
  "target_audience": "Class 3 (Ages 7-8)",
  "target_duration": "2-3 minutes",
  "quality_tier": "ultra",
  "voice_gender": "female",
  "tts_provider": "standard",
  "voice_id": null,
  "orientation": "landscape",
  "model": "openai/gpt-4o",
  "video_id": null,
  "reference_files": [
    {"url": "https://...", "name": "diagram.png", "type": "image"}
  ]
}
```

> **Deprecated field**: `visual_style` (`standard` / `illustrated_svg` / `product_showcase`) is still accepted on the request body for API back-compat but **no longer gates behavior**. The Director now picks style per-shot. Old clients sending the field won't break; the pipeline ignores the value. Will be removed in a future major version.

**Response**: `StreamingResponse` (Server-Sent Events). The route starts a background task and streams progress events:

```
data: {"type": "progress", "stage": "SCRIPT", "message": "Generating narration...", "percentage": 10, "video_id": "vid_..."}
data: {"type": "progress", "stage": "TTS", "percentage": 30, ...}
data: {"type": "progress", "stage": "WORDS", "percentage": 45, ...}
data: {"type": "progress", "stage": "HTML", "percentage": 60, ...}
data: {"type": "completed", "video_id": "vid_...", "files": {"video": null, "script": "https://...", "audio": "https://...", "timeline": "https://...", "words": "https://..."}}
```

Important semantics:
- The background task **outlives** the HTTP connection. If the browser disconnects, the task keeps running and writes to DB. The frontend can reconnect via `GET /status` or `GET /urls` polling.
- If re-connecting while the task is still running, the server reuses the same queue so both connections share the stream.
- On failure, credits are **refunded automatically** via `TokenUsageService.refund_video_credits`.
- `target_stage` query param controls how far the pipeline runs (default `HTML`). Set to `SCRIPT` to get narration only, `TTS` to get audio only, etc.
- `video_id` is optional — if absent, the server generates one. The frontend's `X-Video-ID` response header returns the actual ID used.

### 2.2 Status & URLs

- `GET /external/video/v1/status/{video_id}` → `VideoStatusResponse` (stage, s3_urls, metadata, timestamps, error_message).
- `GET /external/video/v1/urls/{video_id}` → `VideoUrlsResponse` (html_url, audio_url, words_url, video_url, render_job_id, audio_tracks).
- `GET /external/video/v1/history?limit=N` → list of past generations for the institute (used to build admin history sidebar).

### 2.3 Render (MP4 export)

- `POST /external/video/v1/render/{video_id}` — request MP4 render. Body (optional):
  ```json
  {
    "resolution": "1080p",
    "fps": 25,
    "show_captions": true,
    "show_branding": true,
    "caption_position": "bottom",
    "caption_text_color": "#ffffff",
    "caption_bg_color": "#000000",
    "caption_bg_opacity": 60,
    "caption_size": "M"
  }
  ```
  Returns `{ "job_id": "rjob_...", "status": "queued" }`. The backend fires a callback URL to `POST /render-callback/{video_id}` when the render completes.
- `GET /external/video/v1/render/status/{job_id}` → poll render progress.
- `DELETE /external/video/v1/render/{video_id}` → clear cached MP4 so a fresh render can be requested.

Resolution × orientation → dimension lookup:

| orientation | 720p | 1080p |
|-------------|------|-------|
| landscape | 1280×720 | 1920×1080 |
| portrait | 720×1280 | 1080×1920 |

### 2.4 Frame operations

- `POST /external/video/v1/frame/regenerate` — `{video_id, timestamp, user_prompt}` → LLM rewrites a single frame's HTML based on the instruction. Returns `{original_html, new_html}` for preview.
- `POST /external/video/v1/frame/update` — persist `{video_id, frame_index, new_html}` back to the timeline JSON in S3.
- `POST /external/video/v1/frame/add` — insert a new frame at a time or user-driven index.

### 2.5 Audio tracks (background music, SFX)

- `POST /external/video/v1/audio-track/add` — attach an extra audio layer (`{label, url, volume, delay, fade_in, fade_out}`). Stored in `meta.audio_tracks[]` inside the timeline JSON.
- `PATCH /external/video/v1/audio-track/update`
- `POST /external/video/v1/audio-track/delete`

The browser player mixes these via `useWebAudioMixer` (Web Audio API). The render server mixes them via ffmpeg post-processing.

#### Auto-generated background music (Lyria 3 / ultra + super_ultra)

On `ultra` / `super_ultra` tiers, the Director additionally emits a `music_plan` object alongside `shots`. The pipeline feeds each segment's prompt into Google Lyria (Vertex AI) using the same service account as Google TTS, uploads each segment to S3, and — for videos spanning multiple segments — merges them into a single MP3 via the render worker's `POST /concat_audio` endpoint. The final track is inserted into `meta.audio_tracks[]` with `id="background-music"`, `label="Background Music"`, `volume=0.20`, `fadeIn=2.0`, `fadeOut=3.0`. Since it rides the same `audio_tracks` channel as user uploads, the AudioTracksPanel UI can edit/replace/delete it exactly like any other track.

Request knobs (on `VideoGenerationRequest`):
- `background_music_enabled` (Optional[bool]) — `None` = tier default (on for ultra/super_ultra), `True`/`False` overrides.
- `background_music_volume` (Optional[float], 0.0–1.0) — initial volume; defaults to tier config (0.20).

Lyria's per-clip cap is ~180s, so longer videos are tiled across N segments (≤170s each) with 2s crossfades. Music failures are non-fatal: the video ships without a score and the error is logged. Relevant env vars: `GOOGLE_CLOUD_PROJECT`, `LYRIA_LOCATION` (default `us-central1`), `LYRIA_MODEL_ID` (default `lyria-3-pro-preview`; `us-central1` only at time of writing), `RENDER_WORKER_URL` (required for multi-segment concat). Service account must have `aiplatform.endpoints.predict` on the Lyria model. Code: [`music_generator.py`](../../ai_service/app/ai-video-gen-main/music_generator.py), Director contract in [`director_prompts.py::MUSIC_PLAN_EXTENSION`](../../ai_service/app/ai-video-gen-main/director_prompts.py).

### 2.6 TTS voices

- `GET /external/video/v1/tts/voices?language=English&gender=female&tier=premium` — returns available voices (provider varies by language: Sarvam for Indian languages, Google Cloud for global, Microsoft Edge for free tier).

**Supported languages** (~40 via Google Cloud; defined in [`_GOOGLE_VOICES`](../../ai_service/app/routers/external_video_generation.py) and [`LANGUAGES`](../../frontend-admin-dashboard/src/routes/video-api-studio/-services/video-generation.ts)):

- **English**: US, UK, Australia, India
- **European**: Spanish (ES, US), Portuguese (BR, PT), French (FR, CA), German, Italian, Dutch (NL, BE), Danish, Finnish, Norwegian, Swedish, Icelandic, Polish, Russian, Ukrainian, Czech, Slovak, Hungarian, Romanian, Bulgarian, Greek, Catalan
- **Middle East / Africa**: Arabic, Hebrew, Turkish, Afrikaans
- **Asian**: Japanese, Korean, Chinese (Mandarin, Taiwan), Thai, Vietnamese, Indonesian, Malay, Filipino
- **Indian** (route to Sarvam on premium tier): Hindi, Bengali, Tamil, Telugu, Marathi, Kannada, Gujarati, Malayalam, Urdu

**Voice classes** (ordered by quality): Chirp3-HD > Neural2 > WaveNet > Standard. Studio voices are intentionally excluded — they don't support SSML timepoints, which our word-timestamp flow requires. Adding them later would need a Whisper-based alignment fallback and a separate credit multiplier.

Each language exposes every class Google supports for that locale — see the per-language entries in `_GOOGLE_VOICES` for the full voice id list. The canonical Chirp3-HD voice set (4 female + 4 male) is `Aoede / Kore / Leda / Zephyr` and `Charon / Fenrir / Orus / Puck`.

**Sample generation**: `scripts/generate_google_tts_samples.py` synthesizes a ~6-second preview in each voice's native language and uploads to `s3://vacademy-media-storage/TTS_SAMPLES/GOOGLE/`. Run `--dry-run` first to see count + estimated cost. The script emits a `_GOOGLE_SAMPLE_URLS` dict to paste into `external_video_generation.py`. Re-runs are idempotent via `--skip-existing`.

---

## 3. The pipeline — `automation_pipeline.py`

This is the single most important file. All generation flows through `AutomationPipeline.run()`.

### 3.1 Entry point — `run()`

Signature (simplified):
```python
def run(
    self,
    prompt: str,
    *,
    content_type: str = "VIDEO",
    language: str = "English",
    target_audience: str = "General/Adult",
    target_duration: str = "2-3 minutes",
    voice_gender: str = "female",
    tts_provider: str = "standard",
    voice_id: Optional[str] = None,
    stop_after: Optional[str] = None,
    resume_run: Optional[Path] = None,
    reference_context: Optional[Dict] = None,
    video_width: int = 1920,
    video_height: int = 1080,
    visual_style: str = "standard",  # deprecated — accepted for back-compat, immediately deleted
) -> Dict[str, Any]:
    ...
    del visual_style  # no longer gates behavior — Director picks style per-shot
    self._used_pexels_video_ids = set()  # dedup for LLM-ranked stock video
    ...
```

**Style ownership** (2026-04 change): Style decisions (theme, background, animation character) used to be a global pipeline mode driven by the user's `visual_style` request. That model broke down for long, multi-act videos. The Director now owns these decisions per-shot and can shift worlds across the timeline (e.g. photo-hero opener → illustrated infographic middle → product-hero outro). Shot types like `INFOGRAPHIC_SVG`, `PRODUCT_HERO`, and `KINETIC_TITLE` are no longer mode-gated — they're freely pickable by the Director when the content calls for them.

**The one surviving distinction**: `self._current_image_style` still holds the LLM-picked **image style** (`"realistic cinematic photograph"` / `"flat vector illustration"` / `"watercolor painting"` / etc.) used as a prefix for AI image generation prompts. This comes from the script plan at [automation_pipeline.py:1358](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L1358) and is **distinct from anything shot-related** — it's just a consistent photo-style filter applied to every `<img data-img-prompt>` tag in the run.

### 3.2 Pipeline stages

`run()` executes sequentially, with checkpoints at each stage so `resume=True` can skip ahead:

| Stage | What runs | LLM calls | Output |
|-------|-----------|-----------|--------|
| **PENDING** | DB record created | — | `video_id` reserved |
| **SCRIPT** | `_generate_script_plan()` | 1 × script LLM (+ optional review pass on Premium/Ultra) | `script_plan.json` + `narration_raw.txt` |
| **TTS** | `_synthesize_tts()` (ElevenLabs/Sarvam/Google/Edge) | 0 | `narration.mp3` |
| **WORDS** | `_parse_timestamps()` (Whisper) | 0 | `narration.words.json` + `narration.words.csv` |
| **HTML** | `_generate_style_guide()` → `_run_director()` → `_shot_task()` × N (parallel) | 1 style + 1 director + N per-shot + M image generations | `time_based_frame.json` (the timeline) |

Each stage yields progress events via callback → SSE → frontend.

### 3.3 `QUALITY_TIERS`

Defined at [automation_pipeline.py:268](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L268). Controls per-tier feature gates.

**Core feature gates:**

| Tier | Director | HTML validation | Image enhance | Kinetic text | Motion bias |
|------|----------|-----------------|---------------|--------------|-------------|
| `free` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `standard` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `premium` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `ultra` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `super_ultra` | ✅ | ✅ | ✅ | ✅ | ✅ |

**Director tokens & advanced flags (2026-04):**

| Tier | `director_max_tokens` | Shot pack | Emphasis map | Few-shot | Shot density | Two-pass | Anim validator | Stock video rank | Skill library |
|------|----------------------:|-----------|--------------|----------|--------------|----------|----------------|------------------|---------------|
| `premium` | 20,000 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `ultra` | 32,000 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `super_ultra` | 40,000 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

- **`use_director`**: enables the three-stage LLM flow (script → director plan → per-shot HTML) vs legacy single-stage. Premium+ uses the director.
- **`director_max_tokens`**: output cap for the Director call. Bumped from 8k/12k/14k → 20k/32k/40k to handle 50+ shot plans without truncation.
- **`shot_pack_enabled`**: injects a shared design-token pack (colors, fonts, spacing, eases, layout grid) into every shot prompt. Kills cross-shot drift. See §3.8.
- **`director_emphasis_map`**: computes audio-derived silence gaps + long-word peaks + sentence starts and injects them into the Director prompt so it can anchor shot boundaries on real pacing signals. See §3.7.
- **`director_few_shot`**: appends `SUPER_ULTRA_DIRECTOR_EXTENSION` (two hand-written worked examples — portrait travel reel + landscape physics explainer) to the Director system prompt.
- **`director_shot_density`**: requires the Director to emit `shot_density` ("fast"/"medium"/"slow") + `pacing_rationale` fields. Pipeline compares self-report to actual avg shot duration and logs a mismatch warning.
- **`director_two_pass`**: runs the Act Planner (pass 1) before the Shot Planner (pass 2). The Act Planner divides the video into 2-5 acts with `style_direction` + `emotional_beat` + `transition_out`. The shot planner expands each act. Writes `act_plan.json` to the run dir. See §3.7.
- **`shot_animation_validator`**: post-generation scan that counts GSAP tweens in the shot HTML and checks sync-point honoring. Fires ONE corrective regeneration if the shot is thin. See §3.8.
- **`stock_video_ranking`**: fetches 5-6 Pexels candidates per shot, dedupes against `_used_pexels_video_ids`, and runs a small LLM ranker against the shot's narration/visual direction to pick the best clip. See §3.10.
- **`skill_library_enabled`**: injects a filtered skill catalog into the per-shot system prompt and runs the skill composer on the returned HTML. Ultra and super_ultra only. See §3.13.
- **`kinetic_text_shots`**: pipeline builds `KINETIC_TEXT` shots deterministically (word-by-word sync) instead of asking the LLM. Super_ultra only.
- **`director_motion_bias`**: director is instructed to target reel-pace (2–4s shots, 50%+ motion-graphics types). Super_ultra only.
- **`crossfade_duration`**: pipeline inserts 0.35s crossfade transitions between shots on `premium`+.

### 3.4 Visual style — Director-owned per-shot (2026-04)

**The old mental model** (pre-2026-04): user picks `visual_style` mode, pipeline locks the whole video into one style with global background/palette/shot-type restrictions.

**The new mental model**: the Director LLM gets the full shot-type catalog and all relevant CSS utilities, and decides per-beat which visual family to draw from. A single video can open with a cinematic `VIDEO_HERO`, cut to an `INFOGRAPHIC_SVG` for a data moment, shift to a `PRODUCT_HERO` for a brand callout, and close with a `KINETIC_TITLE` — all in one timeline, all coherent because the Director plans the transitions.

#### 3.4.1 What changed in the pipeline

- **`_generate_style_guide`** no longer has `if visual_style == "illustrated_svg"` / `"product_showcase"` branches. One palette, one base background, end of mode dispatch. The style guide provides brand colors and a base surface; individual shots can override their root background via shot-type classes (`.svg-canvas`, `.product-stage`).
- **`_run_director`** no longer restricts the shot-type catalog or injects mode-specific "ABSOLUTE RULES" system prompts. The Director sees the full catalog of 14 shot types and picks freely. The super_ultra motion-bias extension still applies.
- **`_shot_task`** mode branches were rewritten to fire on **shot type**, not global mode:
  - `PRODUCT_HERO` shots get the layered-stage composition constraints ([automation_pipeline.py:3980](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L3980))
  - `INFOGRAPHIC_SVG` / `KINETIC_TITLE` shots get the pure-SVG constraints ([automation_pipeline.py:3999](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L3999))
  - All other shot types run with just their shot-type card
- **`_ensure_fonts`** now always injects all CSS (Bebas Neue + `.svg-canvas` + `.product-stage` + `.paper-texture` + `.flat-badge` + `.tech-annotation` + all other professional utilities). No more conditional gating — the Director may pick any shot type at any time and the CSS must be there.
- **Image/video skip** is driven per-shot by whether the Director emits `image_prompt`/`video_query` for that shot. The old global `no_photos` flag was removed along with the mode branches.

#### 3.4.2 Director system prompt — shot catalog

The Director sees all 14 shot types in one flat catalog (see [director_prompts.py](../../ai_service/app/ai-video-gen-main/director_prompts.py) `DIRECTOR_SYSTEM_PROMPT`). Two former-mode-gated shot types are now freely available:

- **`INFOGRAPHIC_SVG`** — pure SVG diagram that draws itself on screen via `stroke-dashoffset`. Uses its own cream+grid canvas via the `.svg-canvas` root class. Pick when the beat is better drawn than photographed (courts, anatomy, process flows, maps, how-to mechanics).
- **`KINETIC_TITLE`** — full-screen bold typography, word-wipe reveal, one accent-color word. Hooks, section intros, outros. Also works as a **hard cut between style worlds** — e.g. from a photo-hero act into an illustrated infographic act.

#### 3.4.3 Director Rule 12 (updated)

The old Rule 12 said *"never mix dark and cream backgrounds in a single video."* The new Rule 12 says:

> **You own the visual style.** You decide the theme, background, and animation language for each shot — and whether they stay consistent or shift across the timeline. Coherence is usually good (matching shot families within an act), but a long video CAN change worlds between acts (e.g. photo hero → illustrated infographic → product hero outro) as long as each transition feels intentional. Use KINETIC_TITLE or a hard cut between shots to mark act changes.

#### 3.4.4 Shot-type visual families (reference)

For quick mental mapping, the shot-type catalog groups into these visual families (not enforced — just how a Director might think about them):

| Family | Shot types | Root surface | When the Director picks it |
|--------|-----------|--------------|----------------------------|
| **Cinematic photo** | `VIDEO_HERO`, `IMAGE_HERO`, `IMAGE_SPLIT` | Stage bg from style_guide | Real-world hooks, location establishers, hero openers |
| **Pure SVG infographic** | `INFOGRAPHIC_SVG`, `KINETIC_TITLE` | `.svg-canvas` (cream + grid + paper grain) | Diagrams, sports, blueprints, mechanical how-to, concept-first openers |
| **Product stage** | `PRODUCT_HERO` | `.product-stage` (layered bg acts) | Brand reels, product stories, origin stories |
| **Motion graphics** | `TEXT_DIAGRAM`, `PROCESS_STEPS`, `DATA_STORY`, `EQUATION_BUILD`, `ANIMATED_ASSET`, `KINETIC_TEXT` | Varies (dark / palette-driven) | Core explanations, stats, formulas, stepped workflows |
| **Overlay** | `LOWER_THIRD`, `ANNOTATION_MAP` | Floats over other shots | Vocabulary callouts, labeled diagrams |

A well-planned Director output often concentrates shots within one family for an **act**, then uses a KINETIC_TITLE as a hard cut into the next family. This is the mechanism by which a single video can legitimately span multiple visual worlds without feeling incoherent.

#### 3.4.5 CSS utilities reference (always-on)

All injected by `_ensure_fonts` regardless of tier or shot type. The Director can reach for any of them at any moment:

`.full-screen-center`, `.layout-split`, `.layout-bento`, `.highlight`, `.emphasis`, `.product-stage`, `.halftone` (+`-light`), `.flat-badge` (+`.light`/`.dark`), `.slam-wrapper`/`.slam-text`, `.tracking-label`, `.display-xl`/`.display-lg`, `.accent-word`, `.bg-watermark`, `.stage-drift`, `.svg-canvas`, `.paper-texture` (+`.strong`), `.draft-guide`/`.solid-overlay`, `.tech-annotation` (+`-label`/`-caption`), `.vignette-overlay`.

**SVG filters** in the global `<defs>` block: `#roughen`, `#roughen-strong`.

**Fonts** always loaded: Montserrat (headings), Inter (body), Fira Code (code), **Bebas Neue** (display — no longer gated on illustrated mode).

### 3.5 Script generation — `_generate_script_plan()`

- Uses `prompts.py::get_script_system_prompt()` and `SCRIPT_USER_PROMPT_TEMPLATE`.
- Returns structured JSON: `title`, `audience`, `target_grade`, `subject_domain`, `visual_style` (LLM-picked image style — not mode), `script`, `key_takeaway`, `common_mistake`, `beat_outline[]`, `cta`, `questions[]`.
- Each beat carries: `label`, `narration`, `summary`, `visual_type`, `visual_idea`, `image_prompt_hint`, `key_terms[]`, `emotion`, `pacing`, `transition_hint`, `complexity_level`, `needs_recap`.
- On `premium`+, a second LLM call (`SCRIPT_REVIEW_SYSTEM_PROMPT`) reviews and improves the draft.
- MCQ questions are generated for each substantive beat (skipping Hook and CTA).

### 3.6 Style guide — `_generate_style_guide()`

LLM call that designs a palette, background type, font pairing, and motion strategy for the entire video based on the script text. Returns a `style_guide` dict:

```python
{
  "palette": {
    "background": "#0a0e27",
    "primary": "#3b82f6",
    "accent": "#fbbf24",
    "text": "#f1f5f9",
    "text_secondary": "#94a3b8",
    "svg_stroke": "...",
    "svg_fill": "...",
    "annotation_color": "...",
    "grid_pattern": False
  },
  "background_type": "dark",  # or "white", "whiteboard", "chalkboard", "glamour", "diorama", "neon", "blueprint", "minimal", "cerulean"
  "layout_theme": "...",
  "motion_strategy": "..."
}
```

**No mode dispatch** (2026-04 change): `_generate_style_guide` no longer has `if _visual_style == "illustrated_svg"` / `"product_showcase"` branches. It produces one base palette and background; per-shot styling comes from the shot-type's own root class (`.svg-canvas`, `.product-stage`) injected by `_ensure_fonts`.

The palette is resolved to CSS custom properties in `_ensure_fonts`:
- `--brand-primary`, `--brand-accent`, `--brand-text`, `--brand-text-secondary`, `--brand-bg`, `--brand-svg-stroke`, `--brand-svg-fill`, `--brand-annotation`
- Legacy aliases: `--primary-color`, `--accent-color`, `--text-color`

Institute-level brand overrides (from Institute Settings → AI Style) take precedence — see `_current_style_config` and `_current_style_guide`.

### 3.7 Director — `_run_director()`

LLM call that takes the script + beat outline + word timestamps and produces a **shot-by-shot plan**. The Director is the architect of the video — it decides how many shots, which shot types, timing, animation strategy, sync points, and per-shot visual world.

**Inputs**: full script + full beat outline (no truncation) + densified word timestamps (up to 200 entries) + subject domain + style guide + audio duration. Plus, when enabled by tier: reference images, emphasis map, act plan.

**Output**: JSON with `shots[]`, each carrying:
```json
{
  "shot_index": 0,
  "shot_type": "VIDEO_HERO",
  "beat_index": 0,
  "start_time": 0.0,
  "end_time": 4.2,
  "start_word": "The ancient city of",
  "narration_excerpt": "...",
  "visual_description": "...",
  "image_prompt": null,
  "video_query": "aerial ancient rome ruins golden hour",
  "text_elements": ["..."],
  "animation_strategy": "splitReveal at 0.5s, fadeIn at 1.2s",
  "sync_points": [{"word": "Rome", "time": 1.4, "action": "underline"}],
  "complexity_level": "simple",
  "transition_in": "cut",
  "overlay": false,
  "notes": "..."
}
```

Super_ultra also requires top-level `shot_density` (`"fast"`|`"medium"`|`"slow"`) and `pacing_rationale` fields. Two-pass mode also carries `overall_arc` from the Act Planner.

#### 3.7.1 Structured JSON output

The chat client now supports `response_format={"type": "json_object"}` ([automation_pipeline.py:559](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L559)) and the Director call passes it ([automation_pipeline.py:3504](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L3504)). OpenRouter enforces valid JSON at the transport level, eliminating "bare single shot object" envelope drift.

#### 3.7.2 Shot count is the Director's call

There is **no hard min/max shot count** injected into the prompt. The Director decides based on content and pacing. The prompt surfaces a pacing reference (`~3s/shot portrait, ~4s/shot landscape` as a non-binding hint) but the actual count comes from the Director's creative judgment. See `build_director_user_prompt()` in [director_prompts.py](../../ai_service/app/ai-video-gen-main/director_prompts.py).

#### 3.7.3 Single-shot rejection + post-retry fallback

The pipeline still catches obvious Director failures ([automation_pipeline.py:3260-3284](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L3260)):

- `_normalize_director_plan`: if the LLM returns a single flat shot object for a video >15s and the shot doesn't already cover ≥60% of the audio duration, **reject and force retry** instead of silently stretching `end_time` to cover the gap. Without this check, a broken 2.9s response becomes a static 154s video.
- Post-retry sanity: after the retry loop, if `non_overlay_count <= 1` for a video >15s, return `None` so the pipeline **falls back to the segment-based flow** ([automation_pipeline.py:3603-3618](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L3603)). Produces a varied video instead of shipping a dud. Writes `director_debug.json` with the raw response for post-mortem.

#### 3.7.4 Emphasis map (ultra + super_ultra)

`build_emphasis_map(words)` in [director_prompts.py](../../ai_service/app/ai-video-gen-main/director_prompts.py) post-processes the Whisper word timestamps to find:

- **Silence breakpoints** (≥0.4s pauses between words — natural shot boundaries)
- **Stress peaks** (words ≥7 chars or all-caps ≥4 chars — likely narrator emphasis)
- **Sentence starts** (words following `.`/`!`/`?`)

These are injected into the Director user prompt as a short markdown block:

```
EMPHASIS MAP (anchor key shots here):
- Silence breakpoints (≥0.4s pauses): 3.5s 'Neon', 12.3s 'Specifically', 34.8s 'Therefore'
- Stress peaks (long/emphatic words): 2.3s 'different', 5.0s 'specifically', ...
- Sentence starts: 3.5s 'Neon', 12.3s 'Specifically', ...
```

The Director can anchor key shots on real pacing signals instead of guessing timing from word lists.

#### 3.7.5 Reference images (all Director tiers)

When a user uploads reference files (logos, product photos, diagrams), the pipeline attaches them as OpenAI-vision multimodal parts to the Director's user message ([automation_pipeline.py:3287](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L3287)):

```python
[{"type": "text", "text": user_prompt},
 {"type": "image_url", "image_url": {"url": s3_url_1}},
 {"type": "image_url", "image_url": {"url": s3_url_2}}]
```

Capped at 6 images to control context size. The Director can now plan shots that actually feature user-uploaded assets. Same block is attached to the Act Planner (pass 1) when two-pass is enabled.

#### 3.7.6 Few-shot examples (super_ultra only)

`SUPER_ULTRA_DIRECTOR_EXTENSION` in [director_prompts.py](../../ai_service/app/ai-video-gen-main/director_prompts.py) appends two hand-written worked examples to the Director system prompt:

1. **Travel reel** — 30s portrait, fast density, 6 shots mixing VIDEO_HERO + KINETIC_TEXT + KINETIC_TITLE
2. **Physics explainer** — 45s landscape, medium density, 9 shots mixing IMAGE_HERO + EQUATION_BUILD + ANIMATED_ASSET + TEXT_DIAGRAM + KINETIC_TEXT + VIDEO_HERO + DATA_STORY + KINETIC_TITLE

Each example shows exact shot plan JSON including `shot_density`, `pacing_rationale`, and `continuity_notes`. ~5.8KB (~1.5k tokens).

#### 3.7.7 Self-reported `shot_density` (super_ultra only)

Super_ultra Director must emit top-level `shot_density` (`"fast"`|`"medium"`|`"slow"`) + `pacing_rationale` (one-sentence justification). After planning, the pipeline compares the self-report to the actual average shot duration:

```
avg_shot ≤ 2.5s  → expected "fast"
2.5s < avg_shot < 4.0s → expected "medium"
avg_shot ≥ 4.0s  → expected "slow"
```

Mismatches log a `⚠️ MISMATCH` warning. Free telemetry for catching plan-vs-execution drift. See [automation_pipeline.py:3805-3818](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L3805).

#### 3.7.8 Two-pass — Act Planner → Shot Planner (super_ultra only)

When `director_two_pass` is set, `_run_director` first calls `_run_act_planner` ([automation_pipeline.py:3315](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L3315)) which divides the video into 2-5 acts. Each act has:

```json
{
  "label": "Opening Hook",
  "start_time": 0.0,
  "end_time": 5.0,
  "narration_excerpt": "...",
  "style_direction": "cinematic_photo",
  "emotional_beat": "awe",
  "estimated_shot_count": 2,
  "transition_out": "hard_cut"
}
```

`style_direction` is one of `cinematic_photo` / `illustrated_infographic` / `product_stage` / `kinetic_text` / `mixed`. Different acts can pick different directions — this is how long videos shift visual worlds between acts.

Pass 2 (the Shot Planner) receives the act plan as additional context and expands each act into shots that respect its `style_direction` and `emotional_beat`. The act plan is written to `act_plan.json` in the run directory for debugging.

Pass 1 failure degrades gracefully — the Shot Planner just runs without an act plan.

#### 3.7.9 Validation (post-normalization)

[automation_pipeline.py:3626](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L3626):
- `shot_type` must be in the valid_types whitelist (14 types including `INFOGRAPHIC_SVG`, `KINETIC_TITLE`, `PRODUCT_HERO`)
- Shots must cover 100% of the narration with no gaps (shot N's `end_time` == shot N+1's `start_time`)
- First shot starts at 0.0, last shot ends at `audio_duration`
- Post-retry: at least 2 non-overlay shots for videos >15s, else fall back

**Shot type restrictions are gone.** The Director picks freely from the full catalog. What used to be "illustrated_svg mode" is now "the Director picked INFOGRAPHIC_SVG for this shot." What used to be "product_showcase mode" is now "the Director picked PRODUCT_HERO for this shot."

### 3.8 Per-shot HTML — `_shot_task()`

For each shot in the director plan, run a parallel LLM call that produces the HTML/CSS/JS for that single shot. The prompt contains only the shot-type card relevant to `shot.shot_type`, which keeps token counts manageable. Parallelism capped at 8 workers.

**`_shot_task()` full flow** (per-shot):
1. Build focused system prompt via `build_per_shot_system_prompt(shot_type)` — just one card + core preamble
2. (ultra/super_ultra) Append the **filtered skill catalog** for this shot type / tier / canvas (§3.13)
3. Build user prompt with narration excerpt, duration, animation strategy, sync points, visual description
4. (premium/ultra/super_ultra) Append the **shared shot pack** block (§3.8.1)
5. (super_ultra) Append motion-density + reel-pace + brand-palette requirements
6. Append per-shot-type constraints when `shot_type == PRODUCT_HERO` or `shot_type in ("INFOGRAPHIC_SVG", "KINETIC_TITLE")`
7. KINETIC_TEXT bypass — pipeline-builds the HTML directly from words without an LLM call (super_ultra only)
8. Call the HTML LLM
9. `_sanitize_html_content(html)` — strip markdown fences, normalize escapes
10. **Skill composer pass** (ultra/super_ultra) — substitute `<skill>` tags with rendered snippets (§3.13)
11. **Animation density validator + regen** (super_ultra) — scan for GSAP tween count + sync-point honoring; fire ONE corrective regen if thin (§3.8.2)
12. `_ensure_fonts(html)` — CSS + SVG defs injection
13. Stock video fetch (`_process_stock_videos`) — LLM-ranked for super_ultra (§3.10)
14. Image generation (`_process_generated_images`) — Gemini or Pexels, post-LLM
15. Return the entry `{start, end, html, box, z-index, _narration_excerpt, _visual_description, _shot_type}` (stashed fields stripped before serialization)

#### 3.8.1 Shared shot pack (premium / ultra / super_ultra)

Built once per run by `_build_shot_pack(style_guide, width, height)` ([automation_pipeline.py:3296](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L3296)) and injected into every shot's user prompt. Eliminates cross-shot drift (shot 1 uses `#0f172a` text, shot 2 uses `#1e293b`, shot 3 picks Inter at 1.8rem, shot 4 picks Montserrat at 2.2rem — all gone).

Pack contents:

```json
{
  "color_tokens": {
    "primary": "var(--brand-primary)",
    "accent": "var(--brand-accent)",
    "text": "var(--brand-text)",
    "text_secondary": "var(--brand-text-secondary)",
    "bg": "...", "svg_stroke": "...", "svg_fill": "...", "annotation": "..."
  },
  "font_family": {"display": "'Bebas Neue', ...", "heading": "Montserrat", "body": "Inter", "mono": "'Fira Code', monospace"},
  "font_scale": {"display": "9rem", "h1": "5.5rem", "h2": "3.25rem", "body": "1.9rem", "caption": "1.35rem", "micro": "1.05rem"},
  "spacing": {"xs": "8px", "sm": "16px", "md": "24px", "lg": "40px", "xl": "64px", "2xl": "96px", "safe_area": "4%"},
  "ease": {"entry": "power3.out", "exit": "power2.in", "emphasis": "back.out(1.6)", "bg_crossfade": "power2.inOut", "snappy": "expo.out", "settle": "power4.out"},
  "timing": {"entry_stagger": 0.12, "title_delay": 0.3, "subtitle_delay": 0.8, "bg_crossfade_sec": 1.2, "word_wipe_per_word": 0.15},
  "layout": {"aspect": "9:16", "canvas_w": 1080, "canvas_h": 1920, "grid_columns": 6, "gutter": "24px"},
  "id_prefix": "s3_"
}
```

Portrait vs landscape adjusts `font_scale` and `spacing.safe_area`. The `id_prefix` placeholder is substituted per shot so every shot's element IDs (`s0_title`, `s1_title`, ...) are namespaced and never collide.

Prompt rules injected alongside the pack:

- Use only `color_tokens` CSS vars — never hardcode hex
- Use `font_scale` values (e.g. `font-size: 9rem` for display) — never pick your own size
- Use `spacing` tokens for padding/margin/gap; `safe_area` for outer padding
- Use `ease` tokens in GSAP tweens
- Prefix every element id with `s{shot_idx}_`

#### 3.8.2 Animation density validator (super_ultra only)

After `_sanitize_html_content` and before `_ensure_fonts`, super_ultra shots are scanned by `_validate_shot_animation_density(html, shot, start, end)` ([automation_pipeline.py:3296](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L3296)):

1. **Tween count**: regex matches `gsap.(to|from|fromTo|timeline)` + chained `.to/.from/.fromTo/.set(` calls. Must be ≥ `min_animated_elements` (6 on super_ultra).
2. **Sync point honoring**: regex extracts all `delay: <float>` values from the HTML. For each Director sync_point, check a matching delay exists within ±0.2s of the expected shot-relative time.
3. **Zero-motion sanity**: if no GSAP calls AND no `@keyframes` animation, flag the shot as fully static.

On failure, fires ONE corrective regeneration call that includes the original prompts, the previous assistant output, and a specific list of issues. If regen still fails, ships the best attempt and logs the residual issues. No infinite loops. Usage tokens from both calls accumulate.

Console output:
```
⚠️ Shot 3 failed animation density check: found 2 GSAP tweens, need at least 6; sync points not honored (1/2): 1.40s (Rome)
✅ Shot 3 regen passed animation density check
```

KINETIC_TEXT and KINETIC_TITLE shots are exempt (they have their own specialized logic).

#### 3.8.3 Shot type catalog

`shot_type_cards.py::SHOT_TYPE_CARDS`:

| Type | Use for |
|------|---------|
| `IMAGE_HERO` | Full-screen image with Ken Burns + text overlay |
| `VIDEO_HERO` | Full-screen stock video + text overlay (preferred over IMAGE_HERO for real-world topics) |
| `IMAGE_SPLIT` | Image on one side, text on other |
| `TEXT_DIAGRAM` | Text + SVG/Mermaid diagram on clean bg |
| `LOWER_THIRD` | Vocabulary banner at bottom (overlay) |
| `ANNOTATION_MAP` | Full-screen image + animated SVG arrows (anatomy, geography) |
| `DATA_STORY` | Animated bar/line chart with ONE accent bar + stat callout |
| `PROCESS_STEPS` | Sequential numbered nodes with animated connectors |
| `EQUATION_BUILD` | KaTeX formula revealing term-by-term |
| `ANIMATED_ASSET` | Cutout images with GSAP animation |
| `KINETIC_TEXT` | Word-by-word sync (pipeline-built in `super_ultra`, 100% sync accuracy) |
| `PRODUCT_HERO` | Fixed hero subject with crossfading background layers |
| `INFOGRAPHIC_SVG` | Pure SVG with hand-drawn wobble, paper texture, blueprint-draft pattern |
| `KINETIC_TITLE` | Full-screen bold typography, word-wipe reveal |

Every shot type is always available — the Director picks freely. `DOMAIN_SHOT_TYPES` still exists as a hint map for subject domains but no longer gates availability at the mode level.

### 3.9 Image generation — `_process_generated_images()`

Scans every shot's HTML for `<img data-img-prompt="...">` tags. For `data-img-source='stock'` the pipeline tries Pexels and Pixabay (order is driven by the optional `data-stock-provider` attribute, otherwise an auto heuristic) before falling back to AI generation. `data-img-source='generate'` tags go straight to OpenRouter's `bytedance-seed/seedream-4.5` via `_call_image_generation_llm` (chat/completions with `modalities:["image"]`; response `images[].image_url.url` is a base64 data URL).

**Cutout handling**: If `data-cutout='true'`, the image is run through `rembg` (u2netp model, singleton session) to remove the background, producing a transparent PNG.

**Image style prefix**: The LLM-picked `_current_image_style` (e.g., "realistic cinematic photograph") is prepended to every image prompt to maintain visual consistency across the video.

**Per-shot driven**: with the mode dispatch removed, image generation is gated purely by whether individual shots have `image_prompt` set. A Director that picks `INFOGRAPHIC_SVG` for a beat simply leaves `image_prompt: null` for that shot — no photo is generated. The old global `no_photos` flag has been removed.

### 3.10 Stock videos — `_process_stock_videos()`

For each shot with `data-video-query="...search terms"`, searches the configured stock providers (Pexels and/or Pixabay) to find a matching stock video, downloads it, stores in S3, and rewrites the shot HTML to reference the S3 URL. The optional `data-stock-provider` attribute on the `<video>` tag pins which provider to try first; otherwise keyword heuristics pick the order. Both providers support multiple API keys (round-robin with rate-limit detection).

#### 3.10.1 Legacy path (premium / ultra / free)

For each configured provider in order, calls `search_videos(query, orientation)` and takes the first usable HD video meeting the minimum duration. No ranking, no dedup. The first provider with a hit wins; on empty, falls through to the next provider.

#### 3.10.2 LLM-ranked path (super_ultra only)

When `stock_video_ranking` tier flag is set:

1. Calls `search_video_candidates(query, orientation, per_page=6)` on each provider in order until one returns hits. Both `PexelsService` and `PixabayService` return the same shape: **up to 6 candidate videos** as `{id, url, image, duration, alt, photographer, pexels_url}`.
2. Filters out any video ID already in `self._used_pexels_video_ids` (dedup across shots — no two shots in one run get the same clip).
3. If more than one candidate remains, calls `_rank_pexels_candidates_with_llm(candidates, query, narration, visual_description)` ([automation_pipeline.py:6074](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L6074)). This is a small LLM call that sees:
   - The shot's narration excerpt
   - The shot's visual description (from the Director plan)
   - The original video query
   - A compact candidate list: `id | duration | alt`
   and returns `{"best_index": N, "reason": "..."}`.
4. The winning candidate's ID is added to `self._used_pexels_video_ids` so subsequent shots can't reuse it.
5. Falls back to first candidate on any ranker failure.

Requires shot entries to carry `_narration_excerpt` and `_visual_description` fields, which `_shot_task` stashes on every entry and `_process_stock_videos` strips before serialization.

Console output: `🎬 Stock video [ranked]: aerial tokyo shibuya... → https://...` (the `[ranked]` marker confirms the LLM ranker ran).

### 3.11 `_ensure_fonts()` — the CSS injection stage

**Post-processes every shot's HTML** before storing in the timeline. Prepends:

1. A hidden `<svg width="0" height="0">` element with `<defs>` containing `#roughen` and `#roughen-strong` filters (SVG filter URL references resolve within the same shadow-root / iframe, so every shot carries its own copy).
2. A single `<style>` block with:
   - `@import` for Google Fonts — **always** Montserrat + Inter + Fira Code + **Bebas Neue**
   - CSS custom properties (`--brand-*`)
   - Layout utilities (`.full-screen-center`, `.layout-split`, `.layout-bento`, `.highlight`, `.emphasis`)
   - Typography (`.text-display`, `.text-h2`, `.text-body`, `.text-label`, `.display-xl`, `.display-lg`, `.tracking-label`)
   - Professional utilities (`.product-stage`, `.halftone`, `.halftone-light`, `.flat-badge`, `.slam-wrapper`/`.slam-text`, `.bg-watermark`, `.stage-drift`, `.draft-guide`, `.solid-overlay`)
   - Paper texture (`.paper-texture` + `.strong` variant, using inline SVG noise data-URI)
   - Technical annotations (`.tech-annotation`, `.tech-annotation-label`, `.tech-annotation-caption`)
   - Scene transitions (`.vignette-overlay`)
   - **`.svg-canvas`** cream + grid background (**always** injected, not gated on mode)

**2026-04 change**: Bebas Neue and `.svg-canvas` CSS are now unconditional. The Director may pick `INFOGRAPHIC_SVG`, `KINETIC_TITLE`, or `PRODUCT_HERO` at any time and the required CSS must be present regardless of the run's style guide. The old `_is_illustrated` conditional gating was removed.

The `_ensure_fonts` call is what makes the **same HTML renderable in both the server renderer (shadow DOM in Playwright) and the browser player (iframe srcdoc)**. All CSS and SVG filters are baked in at generation time — no per-playback library loading is required for these utilities.

### 3.12 Timeline JSON output

Final `time_based_frame.json` shape (varies slightly by content type):

```json
{
  "meta": {
    "content_type": "VIDEO",
    "navigation": "time_driven",
    "entry_label": "segment",
    "audio_start_at": 0,
    "total_duration": 142.3,
    "dimensions": {"width": 1920, "height": 1080},
    "audio_tracks": [{"id":"track-1","label":"BG Music","url":"..."}],
    "palette": {...}  // from style_guide
  },
  "entries": [
    {
      "id": "shot-0",
      "index": 0,
      "start": 0.0,
      "end": 4.2,
      "htmlStartX": 0, "htmlStartY": 0,
      "htmlEndX": 1920, "htmlEndY": 1080,
      "z": 10,
      "html": "<svg width='0' ...><defs>...</defs></svg><style>...</style><div class='svg-canvas paper-texture'>...</div>"
    },
    ...
  ]
}
```

This is the single artifact consumed by both the render server and the browser player.

### 3.13 Skill library — motion primitives (Phase 1, ultra + super_ultra)

The pipeline ships a **filesystem-discovered skill registry** that lets the Director reference reusable, pre-built, version-controlled motion primitives. The shot LLM drops `<skill>` tags into its HTML; the composer resolves them into validated GSAP/CSS code. Adding a new skill = dropping a folder, no pipeline changes.

#### 3.13.1 The architecture

```
skills/
  motion_primitives/
    bar_chart_grow/
      skill.py           ← METADATA + PARAMS_SCHEMA + render(params, ctx)
    number_counter/
      skill.py
    typewriter_text/
      skill.py
    equation_term_reveal/
      skill.py
    stagger_list/
      skill.py
    ring_progress/
      skill.py

skill_registry.py   ← discovers skills/, loads each skill.py via importlib,
                      validates METADATA, caches once per process
skill_composer.py   ← pure compose(shot_html, ctx) → substitutes <skill> tags
```

Every skill is a single Python file that exports:

- **`METADATA`** — `id`, `version`, `category`, `title`, `description`, `use_when`, `compatible_shot_types`, `requires_tier`, `requires_plugins`, `requires_canvas`, `example_params`
- **`PARAMS_SCHEMA`** — loose JSON Schema (required + properties.type)
- **`render(params, ctx) -> dict`** — returns `{"html": str, "css": str, "js": str, "plugins": List[str]}`

`ctx` carries `{shot_index, canvas_w, canvas_h, tier, shot_type}` so skills can produce shot-indexed element IDs (`bcg3-fill-0`, `rp3-arc`) that never collide across parallel shots.

#### 3.13.2 The 6 starter skills

| Skill | Use case | Output |
|---|---|---|
| `bar_chart_grow` | Revealing 2-8 numeric categories with bars + value counters | HTML + CSS + GSAP width/counter tweens |
| `number_counter` | Hero stat reveals ("75 BPM", "$2.3M") with prefix/suffix/decimals | HTML + CSS + GSAP number roll |
| `typewriter_text` | Char-by-char text reveal with blinking caret, duration-synced | HTML + CSS + vanilla rAF loop |
| `equation_term_reveal` | Math formulas with term-by-term scale-in + labeled annotations | HTML + CSS + GSAP staggered scale tweens |
| `stagger_list` | Bullet/feature/step lists with tight stagger | HTML + CSS + GSAP y-translate stagger |
| `ring_progress` | Circular SVG arc with synced center number counter | SVG + CSS + GSAP stroke-dashoffset tween |

#### 3.13.3 How the LLM uses a skill

The per-shot system prompt (ultra/super_ultra only) gets a **filtered skill catalog** appended — only skills whose `compatible_shot_types` includes the current `shot_type`, whose `requires_tier` ≤ current tier, and whose `requires_canvas` matches. Example:

```markdown
## 🧩 SKILL CATALOG — reusable motion primitives

You have access to pre-built, tested motion primitives. Drop a <skill> tag
anywhere in your HTML and the pipeline will replace it with validated,
production-quality HTML + CSS + GSAP code. ...

### Available skills for this shot:

**`bar_chart_grow`** — Bar Chart Grow-in
  Horizontal bars growing from 0 with staggered entry and number counter per row.
  *Use when*: Revealing numeric data across 2-8 categories (rankings, comparisons).
  *Example*: <skill data-skill-id="bar_chart_grow" data-params='{"bars":[...]}'></skill>
...
```

The LLM then drops a tag like:

```html
<div class="shot">
  <h1>Quarterly Results</h1>
  <skill data-skill-id="bar_chart_grow" data-params='{"bars":[{"label":"Jan","value":45}]}'></skill>
  <p>Strongest quarter yet.</p>
</div>
```

After `_sanitize_html_content` and before the animation validator, `_shot_task` calls `skill_composer.compose(html, ctx)` which:

1. Regex-scans for `<skill data-skill-id="..." data-params='...'></skill>` tags
2. Parses each `data-params` JSON
3. Looks up the skill in the registry
4. Validates params against `PARAMS_SCHEMA` (required keys + top-level types)
5. Calls `skill.render(params, ctx)` which returns HTML/CSS/JS fragments
6. Substitutes the rendered HTML inline
7. Aggregates all CSS into a `<style data-skill-css>` block in `<head>`
8. Aggregates all JS into a scoped IIFE `<script data-skill-js>` block before `</body>`
9. Returns a report: `{html, invocations, plugins, succeeded, failed}`

Invalid params or unknown skills are replaced with HTML comments (`<!-- skill X: invalid params -->`) and logged — the pipeline never crashes on a malformed skill reference.

Console output:
```
🧩 Shot 4 skills: 2 rendered, 0 failed [bar_chart_grow,ring_progress]
```

#### 3.13.4 Why this design scales

- **Drop-in**: new skill = new folder + `skill.py`. Zero edits to `skill_registry.py`, `skill_composer.py`, or `automation_pipeline.py`. The next run sees it in the catalog.
- **Versioned**: every skill has `version: "1.0.0"`. When you ship v2, add a new folder — don't delete v1. Old videos that referenced v1 stay reproducible.
- **Filtered catalog**: the Director catalog for a given shot is always compact (only relevant skills), so scaling to 50+ skills never blows the context window.
- **Pure rendering**: `compose()` is deterministic — same input gives the same output. Enables caching, diffing, regression testing.
- **Escape hatch**: the LLM can always write custom HTML alongside skills. Skills are a toolbox, not a cage. Shot-type cards still carry their own generic examples for when no skill fits.
- **One code path**: all skill rendering goes through `compose()`. One place to log, test, optimize. Skill bugs are isolated — a broken `render()` gets caught in a try/except and the shot ships with a comment stub instead of crashing.

#### 3.13.5 Roadmap beyond Phase 1

- **Phase 2 — Director-aware**: Director plan schema gains `skills: [...]` per shot; per-shot prompt tells the LLM which skill IDs will render into which placeholder element IDs; telemetry logs which skills fire, which fail validation, which are ignored entirely.
- **Phase 3 — Transitions as skills**: new `transitions/` subdirectory (`zoom_through`, `vignette_fade`, `whip_pan`, `hard_cut`, `kinetic_title_interstitial`). The Director picks `transition_out` per shot from this catalog and the composer wires shot N's exit tween into shot N+1's entry.
- **Phase 4 — Shot templates**: `shot_templates/` with `split_comparison`, `stat_block_with_context`, `three_up_grid`, `quote_callout`. Full shot compositions the Director can invoke instead of writing custom HTML.
- **Phase 5 (ongoing)**: `camera_moves/`, `filters/`, `audio_cues/`, per-institute `brand_packs/`. Each new category is a new subdirectory with its own loader, same base protocol.

---

## 4. Render server — `generate_video.py`

Runs as a **separate process**, not inside `ai_service`. Triggered via `RenderService` HTTP client when the frontend calls `POST /external/video/v1/render/{video_id}`.

### 4.1 Responsibilities

1. Pull `time_based_frame.json` + `narration.mp3` + `words.json` from S3
2. Launch headless Chromium (Playwright)
3. Load a base HTML page that:
   - Imports GSAP + MotionPathPlugin + Anime.js + Mermaid + Vivus + RoughNotation + KaTeX + Prism + D3 + Iconify (all via CDN)
   - Defines `window.__SHADOW_CSS`, `window.__updateSnippets`, `window.__updateCaption`, `window.__batchRenderFrame`
4. Call `__updateSnippets(entries)` to inject each shot into its own shadow-root-wrapped `<div>` — at most K snippets visible at any time (overlaps for transitions)
5. For each output frame at time `t` (every `1/fps` seconds):
   - Call `gsap.globalTimeline.totalTime(t)` to advance GSAP to that moment
   - Call `window._animeSeek(t)` to advance all registered Anime.js instances
   - Seek stock videos via `videoEl.currentTime = ...`
   - Take a screenshot via `page.screenshot()`
6. Feed screenshots + audio into ffmpeg → MP4
7. Upload MP4 to S3
8. Call the callback URL `POST /render-callback/{video_id}` with the result

### 4.2 Shadow DOM scoping

Each shot is wrapped in `<div>` with `attachShadow({mode:'open'})`. This isolates CSS between shots so one shot's `h1 { font-size: 8rem }` doesn't leak into the next.

**Why it matters**: the LLM often writes `:root { --primary-color: ... }` which doesn't work inside shadow DOM. The renderer does a find-replace `:root → :host` before injection.

Scripts inside each shot are rewritten to replace `document.querySelector` with a shadow-root-aware helper (`__sd_querySelector`), so LLM code like `gsap.to('#title', ...)` resolves to the element in the current shadow root.

### 4.3 Anime.js bridge

LLM code uses `anime({autoplay:false, ...})` and registers with `_animeR({instance, startMs})`. The renderer:

1. Declares `window._animeTimelines = []` and `window._animeR = (entry) => window._animeTimelines.push(entry)` at init
2. At each frame: `window._animeSeek(tSec)` iterates all registered entries and calls `instance.seek((tSec*1000) - startMs)` for those whose start has passed
3. Scoped `anime` proxy in the shadow-DOM IIFE resolves string target selectors via `scope.querySelectorAll(...)` so LLM code doesn't need to know about shadow roots

See the `_animeR` / `_animeSeek` glue in [generate_video.py:195-210](../../ai_service/app/ai-video-gen-main/generate_video.py#L195).

### 4.4 Frame-seekable libraries

The following libraries are loaded globally and are seekable via `gsap.globalTimeline.totalTime(t)`:

- **GSAP** core timeline (every `gsap.to`/`from`/`fromTo`/`delayedCall`/`fromTo` lives on the global timeline by default)
- **GSAP MotionPathPlugin** (ball arcs, trajectories)
- **Anime.js** via the registration bridge above
- **Vivus** (SVG path draw animations — wrapped for shadow DOM)
- **Rough Notation** (hand-drawn annotations — wrapped for shadow DOM)
- **Stock videos** (seeked via `videoEl.currentTime = t - videoStartTime`)

Libraries that are **not** frame-seekable (they run in real-time and behave the same for browser player and renderer):
- Anime.js loops with `autoplay:true` (ambient effects only — no sync to narration)
- Mermaid chart build (one-shot layout, no animation)
- KaTeX math rendering (one-shot layout)

### 4.5 Settings controlled by the render request body

| Field | Effect |
|-------|--------|
| `resolution` | `720p` → 1280×720 or 720×1280. `1080p` → 1920×1080 or 1080×1920. Based on `orientation` from video metadata. |
| `fps` | 15/20/25/30. Default 20. Higher fps = smoother motion + longer render time. |
| `show_captions` | Render captions from `narration.words.json` onto the frames. |
| `show_branding` | Add watermark/logo overlay (from `branding.json`). |
| `caption_position` | `top` or `bottom`. |
| `caption_text_color`, `caption_bg_color`, `caption_bg_opacity` | Colors for the caption box. |
| `caption_size` | `S` / `M` / `L`. |

---

## 5. Admin frontend — Video API Studio

### 5.1 Flow

```
User opens /video-api-studio
  → PromptInput renders (big composer)
  → User picks content_type=VIDEO, quality_tier=ultra, visual_style=illustrated_svg, language=English, etc.
  → User types prompt, optionally attaches reference files (auto-uploaded to S3)
  → User hits send
  → generateVideo() streams SSE events
  → GenerationProgress shows stage + percentage
  → On "completed" event, VideoResult mounts an AIContentPlayer with the timeline URL
  → User can inspect, re-render as MP4, edit individual frames, or save to history
```

### 5.2 Key types — `video-generation.ts`

```typescript
export type ContentType = 'VIDEO' | 'QUIZ' | 'STORYBOOK' | 'INTERACTIVE_GAME' | 'PUZZLE_BOOK'
  | 'SIMULATION' | 'FLASHCARDS' | 'MAP_EXPLORATION' | 'WORKSHEET' | 'CODE_PLAYGROUND'
  | 'TIMELINE' | 'CONVERSATION' | 'SLIDES';

export type QualityTier = 'free' | 'standard' | 'premium' | 'ultra' | 'super_ultra';
export type VideoOrientation = 'landscape' | 'portrait';
// Deprecated: the Director now picks theme/background/animation per-shot.
// Type kept for reading historical metadata from past runs.
export type VisualStyle = 'standard' | 'illustrated_svg' | 'product_showcase';

export interface GenerateVideoRequest {
  prompt: string;
  content_type?: ContentType;
  language: string;
  voice_gender: VoiceGender;
  tts_provider: TtsProvider;
  voice_id?: string;
  captions_enabled: boolean;
  html_quality: 'classic' | 'advanced';
  target_audience: string;
  target_duration: string;
  model: string;
  quality_tier: QualityTier;
  video_id?: string;
  reference_files?: ReferenceFile[];
  orientation?: VideoOrientation;
  visual_style?: VisualStyle;  // deprecated — accepted for back-compat, ignored by pipeline
}
```

**`VISUAL_STYLES` array removed**: the catalog constant that drove the old Visual Style selector UI is gone. The `VisualStyle` type still exists so `getRemoteHistory()` can deserialize the `visual_style` field from past runs' metadata (old videos still show their historical mode in the history sidebar).

### 5.3 PromptInput.tsx structure

- Textarea with auto-resize
- "OptionBubble" popover row:
  - Content type (`ContentSelector`)
  - Quality tier (Free / Standard / Premium / Ultra / Super Ultra badges)
  - Language (grouped: Global / Indian)
  - Voice gender + TTS provider + voice ID (with sample playback)
  - Target audience (grade level)
  - Target duration
  - Orientation (landscape/portrait)
  - Captions on/off
  - Reference file attachments (image or PDF — PDFs are converted to HTML via `handleConvertPDFToHTML` and stitched into the prompt)
  - Model picker (filtered to tier-appropriate models)
- Style preview chip shows institute-level branding (palette + layout_theme) from `GET /institute-settings/video-style`
- Credit balance indicator

**Visual Style selector removed (2026-04)**: the old `<OptionBubble label="Style">` that let users pick `standard` / `illustrated` / `product_showcase` has been removed from the UI. The Director now picks per-shot style automatically based on content. See §3.4.

### 5.4 History reconstruction

`getRemoteHistory()` calls `GET /external/video/v1/history?limit=20`. The backend returns `RemoteHistoryItem[]` which the frontend maps to `HistoryItem[]`.

**Important**: The backend's `history` endpoint returns only what's stored in the DB — it doesn't re-serialize the full request. To get the original `visual_style`, `orientation`, and `quality_tier` back, the frontend reads them from `item.metadata` (stored at generation time by `VideoGenerationService.generate_till_stage`):

```typescript
const meta = (item.metadata || {}) as Record<string, unknown>;
const metaVisualStyle = typeof meta.visual_style === 'string' ? meta.visual_style as VisualStyle : 'standard';
const metaOrientation = typeof meta.orientation === 'string' ? meta.orientation as VideoOrientation : 'landscape';
const metaQualityTier = typeof meta.quality_tier === 'string' ? meta.quality_tier as QualityTier : 'ultra';
```

If metadata is missing, it falls back to the default values. This means **old videos (pre-metadata) will show as "standard" mode in history** — not a bug, just the honest default.

### 5.5 AIVideoPlayer / AIContentPlayer

Two players exist in the admin dashboard:
- `AIVideoPlayer.tsx` — legacy, VIDEO-only
- `AIContentPlayer.tsx` — modern, dispatches on `content_type` (VIDEO uses `AIVideoPlayer` under the hood; QUIZ/STORYBOOK/etc. use dedicated navigation)

**Initialization** ([AIContentPlayer.tsx:376](../../frontend-admin-dashboard/src/components/ai-video-player/AIContentPlayer.tsx#L376)):
```typescript
await initializeLibraries(loadedMeta.content_type);
```

This fetches the CDN libraries from `LIBRARY_CONFIG[content_type]`:

```typescript
VIDEO: [
  'gsap.min.js',
  'MotionPathPlugin.min.js',
  'animejs@3.2.1/anime.min.js',   // ← added for INFOGRAPHIC_SVG patterns
  'mermaid.min.js',
  'rough-notation.iife.js',
  'vivus.min.js',
  'katex.min.js',
  'auto-render.min.js',
  'prism.min.js',
  'd3.min.js',
  'iconify-icon.min.js',
]
```

**Rendering** is via `html-processor.ts`:
- `getCommonLibraries()` returns the `<script>`/`<link>` tags for libs
- `getBaseStyles()` returns the iframe base CSS (Montserrat/Inter fonts, palette vars, `.full-screen-center`, etc.)
- The full iframe srcdoc = `getCommonLibraries() + getBaseStyles() + entry.html`

The `entry.html` already contains the `_ensure_fonts`-injected SVG defs + CSS utilities baked in by the backend, so iframe playback gets all the same classes as the MP4 render.

**Anime.js browser-mode bridge**: Because browser playback is real-time (not frame-seeked), `_animeR` can't call `instance.seek(t)` per frame. Instead, it schedules the animation via `gsap.delayedCall(startMs/1000, () => instance.play())`, which lives on the iframe's GSAP timeline. `_animeSeek` is a no-op.

See [html-processor.ts:25-46](../../frontend-admin-dashboard/src/components/ai-video-player/html-processor.ts#L25) (admin) and [html-processor.ts:24-46](../../frontend-learner-dashboard-app/src/components/ai-video-player/html-processor.ts#L24) (learner).

### 5.6 Frame regeneration UI

The admin video editor (`VideoEditorPage.tsx`) lets users click a frame and request a regeneration:
1. Frontend calls `POST /external/video/v1/frame/regenerate` with `{timestamp, user_prompt}`
2. Backend fetches the frame HTML from the timeline JSON, sends it to an LLM along with the user's instruction
3. Backend returns `{original_html, new_html}` for preview
4. User accepts → frontend calls `POST /external/video/v1/frame/update` to persist the change

**Known limitation**: The regen LLM call doesn't know about the pipeline mode. If a user regens a frame in `illustrated_svg` mode and asks "add a stock photo", the LLM will comply and break mode constraints. A future improvement is to read `metadata.visual_style` from the video record and inject mode constraints into the regen system prompt.

### 5.7 Render flow

After generation, the user clicks "Render MP4":
1. Frontend opens `RenderSettingsDialog` (resolution, fps, captions, watermark)
2. `requestVideoRender(videoId, settings)` calls `POST /external/video/v1/render/{video_id}`
3. Backend forwards to external render server via `RenderService`
4. Frontend polls `GET /external/video/v1/render/status/{job_id}` until status is `completed`
5. `getVideoUrls(videoId)` returns the final `video_url`

---

## 6. Learner frontend — AIVideoPlayer (playback only)

The learner dashboard has **no generation UI**. Learners consume videos that were generated via the admin dashboard (or via direct API calls from course-creator tooling).

### 6.1 Rendering

Same `AIVideoPlayer.tsx` module as admin, with minor stylistic differences. Key files:

- `src/components/ai-video-player/AIVideoPlayer.tsx` — the player component
- `src/components/ai-video-player/library-loader.ts` — CDN library list (identical to admin's)
- `src/components/ai-video-player/html-processor.ts` — iframe srcdoc composer (identical to admin's)
- `src/components/ai-video-player/navigation-controller.ts` — time_driven / user_driven / self_contained playback
- `src/components/ai-video-player/hooks/useWebAudioMixer.ts` — mixes `meta.audio_tracks[]` over the primary narration

### 6.2 Content types

The player dispatches on `meta.content_type`:

| Content type | Navigation | What the learner sees |
|--------------|-----------|----------------------|
| `VIDEO` | `time_driven` | Shots play in sync with audio, advance automatically. Play/pause/seek works. |
| `QUIZ` | `user_driven` | One question at a time, user clicks Next. |
| `STORYBOOK` | `user_driven` | Page flip navigation. |
| `SLIDES` | `user_driven` | PPT-style deck. |
| `INTERACTIVE_GAME` | `self_contained` | HTML game runs on its own; no external navigation. |
| `FLASHCARDS` | `user_driven` | Spaced-repetition card stack. |
| `MAP_EXPLORATION` | `user_driven` | Interactive SVG map. |
| `TIMELINE` | `user_driven` | Scrollable events. |
| `CONVERSATION` | `user_driven` | Dialogue bubbles. |

### 6.3 Audio + MCQ overlay

For VIDEO content, the player supports inline MCQ overlays: if `frame.question` is present, playback pauses and shows the question. On submit, playback resumes. Results are posted via `add-video-activity.ts` → backend tracking endpoints.

### 6.4 Playback performance

Because the HTML is pre-generated with all CSS/SVG-defs inline, the browser player doesn't need to load any custom assets per-shot. It just:
1. Loads the iframe with common libraries (GSAP, Anime.js, etc. — once per player instance)
2. For each active shot, sets iframe srcdoc to the shot HTML
3. Plays the narration audio and lets the shot's GSAP timeline run in real-time

---

## 7. Shot visual families — deep reference

> **Legacy note**: This section used to describe three user-selectable global modes (`standard` / `illustrated_svg` / `product_showcase`). As of 2026-04 those modes are removed from the UI and deprecated in the API. The Director picks shot types freely from the full catalog on every run. The **visual characteristics** below still describe how each shot family looks, but they're now per-shot not per-video.

### 7.1 Shot visual families at a glance

Any Director plan can freely mix shots from these families, and a long video often shifts families between acts (e.g. cinematic photo opener → pure SVG middle act → product stage outro).

| Family | Shot types | Root surface | Photos/videos | Palette | Typography | Animation character | Use the family for |
|--------|-----------|--------------|---------------|---------|-----------|--------------------|--------------------|
| **Cinematic photo** | `VIDEO_HERO`, `IMAGE_HERO`, `IMAGE_SPLIT`, `ANNOTATION_MAP`, `ANIMATED_ASSET` | Palette-driven dark/white stage | ✅ Stock + AI-gen | Brand palette + text/bg | Montserrat + Inter | Ken Burns on image/video + text overlays | Real-world hooks, establishers, hero openers |
| **Pure SVG infographic** | `INFOGRAPHIC_SVG`, `KINETIC_TITLE` | `.svg-canvas` (cream `#f5f0e8` + CSS grid + paper grain) | ❌ Zero | 2-color brand + red `.tech-annotation` utility | Bebas Neue + Inter + italic serif captions | Hand-drawn wobble via `#roughen`, `stroke-dashoffset` draw-on, blueprint-draft pattern | Diagrams, sports, anatomy, blueprints, how-to mechanics, concept-first openers |
| **Product stage** | `PRODUCT_HERO` | `.product-stage` (layered bg acts) | ✅ One hero subject reused | 2-color brand + texture layers | Bebas Neue + Inter tracking labels | Fixed subject + crossfading bg layers + slam-text outros | Brand reels, product stories, origin stories |
| **Motion graphics** | `TEXT_DIAGRAM`, `PROCESS_STEPS`, `DATA_STORY`, `EQUATION_BUILD`, `KINETIC_TEXT` | Varies (dark / palette-driven) | ❌ Usually none | Brand palette | Mixed | GSAP-heavy — chart growths, term reveals, stepped flows | Core explanations, stats, formulas, workflows |
| **Overlay** | `LOWER_THIRD` | Floats over previous shot | ❌ | Brand palette | Bebas Neue + tracking label | Slide-in from edge | Vocabulary callouts, speaker labels, key terms |

Reference video per family: *Cinematic* — typical travel reel. *Pure SVG* — "How to Play Volleyball" / MacBook Neo blueprint. *Product stage* — Converse Chuck Taylor origin reel.

### 7.2 How the Director mixes families

The Director's Rule 12 (see §3.4.3) explicitly permits cross-family mixing. In practice:

- **Short videos (<30s)**: usually one family throughout — easier to keep coherent.
- **Medium videos (30s-90s)**: one primary family with 1-2 contrast shots (e.g. a KINETIC_TITLE interstitial between two VIDEO_HERO shots).
- **Long videos (90s+)** with `director_two_pass` (super_ultra): the Act Planner divides into 2-5 acts, each with its own `style_direction`. The Shot Planner respects each act's direction. This is when you get multi-world videos like *cinematic opener → illustrated infographic middle → product hero outro*.

The **transitions between families** matter more than which families are used. Use `KINETIC_TITLE` as a hard cut between worlds, or a vignette fade, or a zoom-through. Never just drop from dark cinematic photo to cream infographic without a beat of intentional punctuation.

### 7.3 Professional CSS utilities reference

All injected by `_ensure_fonts`. Available in **every** generated shot HTML — no conditional gating. Bebas Neue and `.svg-canvas` are now always loaded (change from 2026-04; see §3.11).

| Class | Purpose | Documented in |
|-------|---------|---------------|
| `.full-screen-center` | Flex center full-screen container | `CORE_PREAMBLE` |
| `.layout-split` | 2-col grid 60px gap | `CORE_PREAMBLE` |
| `.layout-bento` | Bento-grid layout | `CORE_PREAMBLE` |
| `.product-stage` | Full-screen relative container for PRODUCT_HERO | PRODUCT_HERO card |
| `.halftone` / `.halftone-light` | Dot-pattern texture overlays | PRODUCT_HERO / CORE_PREAMBLE |
| `.flat-badge` (+`.light`/`.dark`) | Zero-border-radius colored badge with Bebas Neue | CORE_PREAMBLE |
| `.slam-wrapper` + `.slam-text` | Overflow-hidden container for `translateY(100%→0%)` reveals | CORE_PREAMBLE |
| `.tracking-label` | Small ALL-CAPS Inter label with letter-spacing | CORE_PREAMBLE |
| `.display-xl` / `.display-lg` | Bebas Neue display headlines (≥4rem / ≥3rem) | CORE_PREAMBLE |
| `.accent-word` | Color swap to `var(--brand-accent)` | CORE_PREAMBLE |
| `.bg-watermark` | Position-absolute watermark slot | CORE_PREAMBLE |
| `.stage-drift` | Continuous-motion wrapper for holds ≥4s | CORE_PREAMBLE |
| `.svg-canvas` | Cream + grid canvas (always available; used by `INFOGRAPHIC_SVG` / `KINETIC_TITLE`) | INFOGRAPHIC_SVG card |
| `.paper-texture` (+`.strong`) | Parchment grain overlay via SVG-noise data-URI | INFOGRAPHIC_SVG / CORE_PREAMBLE |
| `.draft-guide` / `.solid-overlay` | Two-phase blueprint reveal (dashed → solid) | INFOGRAPHIC_SVG card |
| `.tech-annotation` (+`-label`/`-caption`) | Red dashed dimension lines, caps label, italic serif caption | INFOGRAPHIC_SVG / CORE_PREAMBLE |
| `.vignette-overlay` | Full-screen radial darkening (scene exit) | INFOGRAPHIC_SVG / CORE_PREAMBLE |

### 7.3 SVG filters

Available in every shot via pre-registered `<defs>` block:

| Filter ID | Effect |
|-----------|--------|
| `#roughen` | Subtle hand-drawn wobble (baseFrequency 0.018, scale 2.6) — architect sketch feel |
| `#roughen-strong` | Bolder sketchbook wobble (baseFrequency 0.025, scale 4.2) — more aggressive |

Usage: `<g filter="url(#roughen)">...</g>` wraps any SVG elements that should look hand-drawn. **Preserves `stroke-dashoffset` animation** — the filter is applied post-process as a displacement map, so clean bezier paths still draw in normally.

---

## 8. Key invariants & gotchas

### 8.1 Director owns style — never re-introduce global mode dispatch

**Historical context**: until 2026-04 the pipeline had a `self._current_visual_style` attribute holding one of `standard` / `illustrated_svg` / `product_showcase`, and that attribute gated behavior in `_generate_style_guide`, `_run_director`, `_shot_task`, and `_ensure_fonts`. It was removed because long/multi-act videos need per-shot style decisions, not a global lock.

**The current invariant**: there is no pipeline-level "style mode." The Director picks shot types freely, each shot type carries its own visual family (cinematic photo / pure SVG / product stage / motion graphics / overlay), and per-shot-type constraints fire in `_shot_task` based on `shot_type == "PRODUCT_HERO"` or `shot_type in ("INFOGRAPHIC_SVG", "KINETIC_TITLE")`. **Do not re-introduce any `if self._current_visual_style == "..."` dispatch.** If you need to change Director behavior, edit the system prompt or add a tier flag — never a global mode.

The one remaining related attribute is `self._current_image_style` (LLM-picked image style — `"realistic cinematic photograph"` / `"flat vector illustration"` / etc.). This is **just a prefix for AI image generation prompts** at [`_enhance_image_prompt`](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L5782) and is shot-agnostic. It does not gate anything else.

### 8.2 SVG filter scoping in shadow DOM

SVG filter URL references (`filter="url(#roughen)"`) resolve within the containing tree scope. In shadow DOM, that's the containing shadow root. In an iframe, that's the iframe's document.

`_ensure_fonts` prepends the `<svg><defs>...</defs></svg>` block to every shot's HTML. This means:
- In the render server: each shot's shadow root has its own copy → filter references work ✓
- In the browser player: the shot HTML goes into the iframe body → filter references work ✓

Do **not** try to move the defs to a top-level document — shadow-DOM-scoped SVG elements can't reach outside their scope.

### 8.3 GSAP `:root` vs `:host` in shadow DOM

LLM code often writes `:root { --primary-color: ... }`. This doesn't apply inside shadow DOM (no document root). The renderer does a mechanical find-replace `:root → :host` before injection. Custom properties defined on `:host` cascade into the shadow tree.

The browser player renders shots in iframes (not shadow DOM), so `:root` works there natively. No rewrite needed.

### 8.4 `setTimeout` is forbidden in shot scripts

Because the render server advances `gsap.globalTimeline.totalTime(t)` in a loop, `setTimeout` callbacks never fire at the right moment — they fire in wall-clock time, not timeline time. All delayed actions must use:

- `gsap.to('#el', {delay: 1.4, ...})` — on timeline
- `gsap.delayedCall(1.4, fn)` — on timeline
- For Anime.js: `_animeR({instance: anime({autoplay:false,...}), startMs: 1400})` — registered with the pipeline's seek bridge

Documented in `CORE_PREAMBLE` as a hard rule.

### 8.5 Shadow DOM-scoped libraries

The LLM expects `document.querySelector`, `window.RoughNotation`, `window.Vivus`, etc. to work globally. In shadow DOM, they don't — elements are scoped to the shadow root.

The renderer rewrites shot scripts in place:
- `document.querySelector(...)` → `__sd_querySelector(...)` (shadow-root-aware)
- `document.querySelectorAll(...)` → `__sd_querySelectorAll(...)`
- `document.getElementById(...)` → `__sd_getElementById(...)`
- `window.RoughNotation` → `__sd_RoughNotation` (scoped version)
- `new Vivus(...)` → `new __sd_Vivus(...)`
- A scoped `anime` proxy wraps Anime.js calls to resolve string selectors within the shadow scope

This rewriting is the single largest source of render-server surprise. When LLM-generated code works in the browser player but not the render server, the first thing to check is whether it's using an API that the renderer's scope helpers don't support.

### 8.6 Continuous motion rule

`CORE_PREAMBLE` mandates that every shot ≥4s must have at least one element in motion at any given frame. The pattern is: wrap content in `<div class='stage-drift'>` and tween the whole composition with a 12-second loop:

```javascript
gsap.fromTo('.stage-drift',
  {x:0, y:0, scale:1},
  {x:20, y:-10, scale:1.04, duration:12, ease:'none'});
```

Individual foreground elements can add their own Ken Burns scale on top. Together these enforce the "reference-grade" motion characteristic of top-tier explainers.

### 8.7 Easing mandate

Every GSAP tween must use a named ease:
- `expo.out` — snappy, modern
- `power3.out` — smooth
- `back.out(1.6)` — playful pop
- `power2.inOut` — crossfades
- Never omit `ease` or use `linear` unless intentional (e.g. continuous drift)

Enforced via `CORE_PREAMBLE` and checked in `html_validation` (when enabled by quality tier).

### 8.8 Typography hierarchy — 2 levels, not 3

Every shot uses exactly 2 text levels:
1. Display headline: Bebas Neue / Montserrat Black, ≥4rem
2. Small label: Inter, ≤1rem, letter-spacing 0.25em, ALL-CAPS

**Exception**: `illustrated_svg` allows a 3rd level — italic serif `Fig. 1 — caption` style via `.tech-annotation-caption`. This is the only place a body paragraph is permitted, and it reads as "textbook annotation" not content.

---

## 9. Credit accounting & rate limiting

### 9.1 Credits

- Every generation request passes through `require_credits("video", estimated_tokens=5000)` which reserves credits upfront.
- The pipeline emits `TokenUsageService` events at each LLM call with actual token usage.
- On **success**, credits are settled to match actual usage.
- On **failure**, `TokenUsageService.refund_video_credits` refunds all charges for that `video_id`.
- `quality_tier` multiplies estimated cost (ultra ≈ 2× premium, super_ultra ≈ 3×).

### 9.2 Rate limiting & concurrency

- `_check_rate_limit(institute_id)` — N requests per minute per institute (configured via `settings.video_rate_limit_per_minute`).
- `_check_concurrency_limit(institute_id)` — at most K concurrent in-flight generations per institute. Exceeding returns 429.
- The background-task pattern means disconnecting from an SSE stream doesn't abort the generation — it continues to completion and can be reconnected via `/status` polling. The concurrency counter decrements only when the task actually finishes.

---

## 10. Testing checklist

When making changes that touch the pipeline or render engine:

1. **Parse check** — `python -c "import ast; ast.parse(open('X').read())"` on all edited Python files (pipeline + `skill_registry.py` + `skill_composer.py` + any new skill modules).
2. **Admin typecheck** — `cd frontend-admin-dashboard && pnpm run typecheck` must exit 0.
3. **Learner typecheck** — `cd frontend-learner-dashboard-app && pnpm run typecheck` must exit 0.
4. **Skill registry dry-run** — `python -c "from skill_registry import get_registry; print(get_registry().keys())"` should list all 6 starter skills without import errors.
5. **Skill composer dry-run** — feed a sample HTML with 2-3 `<skill>` tags through `skill_composer.compose()` and verify the output substitutes them, aggregates CSS/JS, and returns `succeeded > 0, failed == 0`.
6. **Smoke test generation** — send a short prompt via the Video API Studio, verify all 4 stages (SCRIPT/TTS/WORDS/HTML) complete.
7. **Director tier tests** — regenerate the same prompt at premium, ultra, and super_ultra; confirm:
   - **Premium**: `shot_pack_enabled` only, shots use consistent design tokens
   - **Ultra**: adds emphasis map + skill catalog injection; skills actually get picked for data-heavy shots
   - **Super ultra**: adds two-pass act planner + few-shot examples + shot_density self-report + animation validator + LLM-ranked stock video. Check for `🎭 Running Act Planner (pass 1)`, `🧩 Shot N skills: X rendered`, `🎯 Density: self-reported='fast' | actual avg=...`, `🎬 Stock video [ranked]:` log lines.
8. **Shot diversity check** — for a long (>60s) super_ultra video, confirm the Director picks shots from multiple visual families (not all VIDEO_HERO, not all TEXT_DIAGRAM).
9. **Skill adoption check** — for a super_ultra data-heavy prompt (e.g. "Q3 sales report"), confirm at least one shot uses `bar_chart_grow` or `number_counter` (via the `🧩 Shot N skills:` log line).
10. **Regression catch** — force a thin shot (short narration, no sync points) at super_ultra and confirm the animation validator fires a regen log line.
11. **Broken-Director recovery** — mock a single-shot response for a >15s video and confirm `_normalize_director_plan` rejects it and triggers retry or segment-flow fallback (see §3.7.3).
12. **Render test** — trigger `POST /render/{video_id}` and verify the MP4 matches the browser player output.
13. **History round-trip** — generate a video, refresh the page, verify history entry shows the correct `orientation`, `quality_tier` (pulled from `item.metadata`). Old videos may still carry `visual_style` in metadata; the frontend reads it for display but new videos don't surface it in the UI.
14. **Frame regen** — edit a frame via `/frame/regenerate` and verify the new HTML still has `_ensure_fonts` CSS classes available (regen doesn't re-run `_ensure_fonts`; relies on the CSS baked into the full timeline — known gap).

---

## 11. Troubleshooting cheatsheet

| Symptom | Likely cause | Where to look |
|---------|-------------|---------------|
| Video is one static shot for entire duration | Director returned a flat single-shot object and the old salvage path stretched it | Check [`_normalize_director_plan`](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L3260) — should reject for audio >15s. Look for `⚠️ Single-shot response with end_time=... — rejecting` in logs |
| Director timed out / truncated for long videos | `director_max_tokens` too low | Bump the tier config — premium is 20k, ultra is 32k, super_ultra is 40k |
| Director plan broken with envelope drift (`{"shot_index": 0, ...}` instead of `{"shots": [...]}`) | Model ignoring envelope rule | Confirm `response_format={"type": "json_object"}` is being passed; structured JSON is load-bearing |
| `🎭 Running Act Planner` doesn't appear on super_ultra | `director_two_pass` flag missing or exception in `_run_act_planner` | Check tier config; check `act_plan.json` for raw output from the failed call |
| Two shots in one run get the same Pexels clip | `stock_video_ranking` flag off, or `_used_pexels_video_ids` not initialized | Confirm the flag on super_ultra; confirm `run()` initializes the dedup set at entry |
| Shot HTML is thin/static in super_ultra | Animation validator not firing OR regen also failed | Look for `⚠️ Shot N failed animation density check` followed by regen result; if absent, check the `shot_animation_validator` tier flag |
| Skill catalog missing from shot prompts | `skill_library_enabled` flag off OR `skill_registry.py` import failed at pipeline startup | Check the `[skill_registry] loaded N skills` log line at boot; check tier config |
| `<skill>` tags appear in final HTML as literal markup | Composer didn't run or the tag regex didn't match | Verify `data-params='...'` uses single-quoted JSON (no smart quotes); check for `🧩 Shot N skills:` log line |
| Skill renders but parameters are wrong | Loose schema validation passed but skill's `render()` received garbage | Add stricter type enforcement in `PARAMS_SCHEMA.properties`; loose check only catches missing required + top-level types |
| Shot 1 uses `#0f172a`, shot 2 uses `#1e293b` | Shot pack not being injected OR the LLM is ignoring it | Check the `SHARED SHOT PACK` block in the shot user prompt; consider raising `shot_pack_enabled` priority in the prompt ordering |
| `shot_density` mismatch warning fires frequently | Few-shot examples don't match actual content pacing, or the Director is bad at self-assessment | Adjust `SUPER_ULTRA_DIRECTOR_EXTENSION` examples or relax the bucket thresholds in [automation_pipeline.py:3812](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L3812) |
| SVG filter has no effect | Filter defs not in same shadow root / iframe | Check `_ensure_fonts` is prepending the defs block; check no `innerHTML` replacement is stripping them |
| `setTimeout` animations don't fire in MP4 but work in browser | Render engine uses `gsap.globalTimeline.totalTime` | Rewrite to `gsap.delayedCall` or `_animeR` |
| Fonts fall back to Impact/serif | Bebas Neue not loaded | Bebas Neue is now **always** loaded — if missing, the `_fonts_url` in `_ensure_fonts` has been mis-edited |
| MP4 render stuck at queued | Render server unreachable / auth failing | Check `settings.render_server_url` + `settings.render_server_key`, poll `/render/status/{job_id}` |
| Anime.js instance doesn't animate in MP4 | Missing `_animeR` registration | All `autoplay:false` instances must call `_animeR({instance, startMs})` |
| Anime.js animates in browser but jumps in MP4 | `_animeSeek` not called per frame | Check [generate_video.py:2364](../../ai_service/app/ai-video-gen-main/generate_video.py#L2364) inside `__batchRenderFrame` |
| Two shots visually overlap incorrectly | Shot timing gap | Director output must have `shot[N].end_time == shot[N+1].start_time`; gap-fill runs at [automation_pipeline.py:3641](../../ai_service/app/ai-video-gen-main/automation_pipeline.py#L3641) |
| Frame regen produces inconsistent style | Regen LLM doesn't see the shot pack or skill catalog | Known gap — propagate run-level design tokens to the regen call (future work) |
| Background task keeps running after browser closes | Intended behaviour | Reconnect via `GET /status/{video_id}` polling |
| 402 Insufficient credits | Credit balance < reserved amount | Top up via AI credits purchase flow |
| 429 Too many requests | Rate limit or concurrency cap | Wait / reduce concurrent requests |

---

## 12. Future work / known gaps

### 12.1 Skill library roadmap (phases 2-5)

Phase 1 (6 motion primitives, passive LLM discovery) is shipped. Next:

1. **Phase 2 — Director-aware skill planning**: Director plan schema gains `skills: [...]` per shot. The per-shot HTML LLM is told explicitly which skill IDs will render into which placeholder element IDs, and it writes the surround HTML. Telemetry logs skill usage rates.
2. **Phase 3 — Transitions as skills**: new `skills/transitions/` category (`zoom_through`, `vignette_fade`, `whip_pan`, `hard_cut`, `kinetic_title_interstitial`). Composer wires cross-shot entry/exit tweens.
3. **Phase 4 — Shot templates**: `skills/shot_templates/` with full shot compositions the Director can invoke as a unit (`split_comparison`, `stat_block_with_context`, `three_up_grid`, `quote_callout`).
4. **Phase 5 — Extension categories**: `camera_moves/`, `filters/`, `audio_cues/`, per-institute `brand_packs/`. Each adds a new subdirectory with the same base protocol.

### 12.2 Director improvements

5. **Dedicated Director model**: currently piggybacking on `html_client` (usually Gemini 3 Pro). Could route the Director to a stronger model (Claude Opus 4.6 / GPT-5) for better planning while keeping the cheaper model for per-shot HTML.
6. **Skill usage telemetry aggregation**: weekly reports on which skills are used vs ignored vs failing. Feed into a catalog prioritization and deprecation policy.
7. **A/B test by skill version**: pin 50% of runs to `bar_chart_grow@1.0`, 50% to `@2.0`, compare engagement metrics.

### 12.3 Other known gaps

8. **Frame regen carries over shot pack + skill catalog**: currently the regen LLM gets a minimal prompt without the run's design tokens or skill catalog, so regenerated frames can drift stylistically from the surrounding shots.
9. **Resume endpoint**: `VideoGenerationResumeRequest` schema exists but no route is wired up. `generate_till_stage(resume=True)` is only used internally.
10. **Rough.js vs SVG filter**: the current hand-drawn wobble uses `<feTurbulence>` + `<feDisplacementMap>`. This is free, preserves `stroke-dashoffset`, and needs no new CDN dep. Rough.js would give more authentic pencil-stroke fills but requires rewriting how `INFOGRAPHIC_SVG` generates paths. Open question.
11. **Shared AIVideoPlayer package**: admin and learner each have their own copy. A future refactor could extract to a shared package in `packages/ai-video-player`.
12. **Institute branding injection**: the pipeline reads `_current_style_config` from institute settings but doesn't currently propagate per-institute font overrides. See `_TEMPLATE_EXTRA_FONT_FAMILIES` in `_ensure_fonts` for the current extension point.
13. **Mobile playback**: the browser player works on mobile but `.stage-drift` and other transform-heavy effects can stutter on low-end devices. The render server MP4 is the recommended mobile delivery path.
14. **Kinetic text word-sync accuracy**: the pipeline-built `KINETIC_TEXT` shots have frame-perfect sync. LLM-built kinetic text in lower tiers relies on `sync_points` from the Director which are not as precise.
15. **Stock video cache**: Pexels downloads are not cached across generations. Within one run the LLM-ranked dedup prevents reuse, but across runs the same clip gets re-fetched. A shared cache would cut Pexels API costs.
16. **`visual_style` API field removal**: currently kept on the request schema as `DEPRECATED` for back-compat. Remove in next major API version.

---

## 13. Glossary

| Term | Meaning |
|------|---------|
| **Shot** | A single unit of visual content within a video. One shot = one `<div>` of HTML, one shadow root at render time, 2–6 seconds of narration coverage. |
| **Segment** | Legacy term for multi-shot groups. Modern pipeline uses individual shots only. |
| **Beat** | A unit of the narrative script outline. One beat → 1–4 shots. |
| **Act** | (Super ultra two-pass only) A narrative chunk of 2-5 shots sharing a `style_direction` and `emotional_beat`. The Act Planner (pass 1 of the Director) splits a video into acts; the Shot Planner (pass 2) expands each into shots. |
| **Timeline** | The `time_based_frame.json` output containing all shots + audio metadata. |
| **Entry** | A single item in the timeline `entries[]` array (≈ shot for VIDEO content, ≈ question for QUIZ, ≈ page for STORYBOOK). |
| **Stage** | Pipeline phase: PENDING → SCRIPT → TTS → WORDS → HTML → RENDER. |
| **Director** | The shot-planning LLM call that turns a script + beat outline + word timestamps into a shot-by-shot plan. **Owns all style decisions** — picks theme, background, shot type, animation language per shot. |
| **Act Planner** | Pass 1 of the two-pass Director (super_ultra only). Produces a high-level act plan before the shot plan. |
| **Shot Planner** | Pass 2 of the two-pass Director. Expands each act into shots. In single-pass mode (ultra/premium), this is just "the Director." |
| **Shot pack** | A shared design-token dict (colors, fonts, spacing, eases, layout grid) built once per run and injected into every shot's user prompt. Kills cross-shot drift. Premium/ultra/super_ultra only. |
| **Emphasis map** | A condensed list of silence gaps + stress peaks + sentence starts derived from word timestamps. Injected into the Director prompt so it can anchor shots on real pacing signals. Ultra/super_ultra only. |
| **Skill / motion primitive** | A pre-built, parameterized HTML/CSS/JS snippet the LLM can invoke via a `<skill data-skill-id="..." data-params='...'></skill>` tag. The composer substitutes the tag with rendered code. Ultra/super_ultra only. |
| **Skill composer** | Pure function `compose(shot_html, ctx)` that scans for `<skill>` tags, validates params, renders each skill via its `render(params, ctx)` function, and aggregates CSS/JS into the final HTML. |
| **Skill registry** | Filesystem-discovered dict of all skills loaded from `skills/**/skill.py`. Cached once per process. |
| **Animation density validator** | Post-generation scanner (super_ultra only) that counts GSAP tweens and checks sync-point honoring. Fires one corrective regeneration if a shot is thin. |
| **Shot visual family** | A grouping of shot types by visual character (cinematic photo / pure SVG / product stage / motion graphics / overlay). The Director can mix families freely across a timeline. |
| **Shot density** | Super_ultra Director's self-reported pacing label (`fast`/`medium`/`slow`). Validated against actual average shot duration. |
| **Shadow DOM** | Browser feature used by the render server to style-isolate each shot. Not used by the browser player (which uses iframes instead). |
| **Navigation mode** | `time_driven` (VIDEO — follows audio clock), `user_driven` (QUIZ/STORYBOOK — user clicks), `self_contained` (INTERACTIVE_GAME — HTML runs on its own). |
| **Visual style** (deprecated) | Legacy pipeline mode concept (`standard` / `illustrated_svg` / `product_showcase`). Removed from UI and no longer gates pipeline behavior. Still accepted on the request schema for back-compat. |
| **Image style** | LLM-picked photography/illustration style used as a prompt prefix for AI image generation. `"realistic cinematic photograph"` / `"flat vector illustration"` / etc. Shot-agnostic — just a prefix. |
| **Quality tier** | `free` / `standard` / `premium` / `ultra` / `super_ultra`. Controls feature gates (director token budget, shot pack, emphasis map, few-shot, two-pass, animation validator, stock video ranking, skill library). |

---

**Maintainers**: if you change anything in `automation_pipeline.py::run()`, `_ensure_fonts()`, `shot_type_cards.py::SHOT_TYPE_CARDS`, `director_prompts.py::DIRECTOR_SYSTEM_PROMPT`, `skill_registry.py`, `skill_composer.py`, `QUALITY_TIERS`, or the external API contract, update this doc in the same commit. Adding a new skill under `skills/**/skill.py` does NOT require a doc update — skills are discovered at runtime.
