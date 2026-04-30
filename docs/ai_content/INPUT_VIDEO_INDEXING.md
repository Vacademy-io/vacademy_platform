# Input Video Indexing — Raw Footage Handling

**Status**: Living document. Last updated 2026-04-30.
**Audience**: Engineers building features that consume user-uploaded raw videos (long podcasts, screen recordings, lecture footage) to produce derived content.
**Companion docs**: [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md), [VIDEO_EDITOR_REVIEW.md](./VIDEO_EDITOR_REVIEW.md).

---

## 0. What this is

When a user uploads a **raw video** — a 1-hour podcast, a 20-minute screen recording, an hour of lecture footage — the AI service runs an **indexing pipeline** that strips out everything a future generation pipeline could ever need from the source: transcript, prosody, face positions, scene boundaries, OCR text, cursor tracks, UI cutouts. The pipeline does **not** generate any output video; it just produces structured metadata that downstream pipelines (reel generators, infographic-overlay pipelines, engagement-driven highlight rerollers) can consume.

Two ingestion **modes**:

| Mode | For | Visual emphasis |
|---|---|---|
| `podcast` | Talking-head footage, lecture recordings, interviews | Speaker face/pose, alpha matte for compositing, free-region detection |
| `demo` | Screen recordings, software tutorials, walkthroughs | OCR, cursor tracking, UI cutouts, dynamic crops |

This doc is the contract for that metadata — what gets captured, where it lives, and how a future pipeline reads it.

---

## 1. Lifecycle

```
User uploads raw video to S3
        │
        ▼
POST /external/input-video/v1/create  ───►  ai_input_videos row created (status=PENDING)
        │
        ▼
IndexService.submit() → render worker job (status=QUEUED → PROCESSING)
        │
        ▼
extractor/pipeline.py::run_index_pipeline()
        │
        ├── Stage 1: audio + transcript + prosody + scenes (full video)
        ├── Stage 1.5: full-video face scan @ 1fps (podcast only)
        ├── Stage 2: LLM highlight selection (30-60s window)
        └── Stage 3: highlight-window visual extraction (face/pose/matting OR OCR/cursor/UI)
        │
        ▼
S3 artifacts uploaded:
  • {id}/video_context.json   ← structured metadata (the contract)
  • {id}/video_spatial.sqlite ← per-frame data (queryable by SQL)
  • {id}/assets/*.webm|*.png  ← extracted visual assets
  • {id}/source.mp4           ← browser-compatible source copy
        │
        ▼
ai_input_videos row updated (status=COMPLETED, urls populated)
```

The HTTP layer returns immediately; indexing runs async on the render worker. Frontend polls `GET /external/input-video/v1/{id}/status`.

---

## 2. HTTP API

Base prefix: `{AI_SERVICE_BASE_URL}/external/input-video/v1`. Auth via `X-Institute-Key`.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/create` | Upload reference (S3 URL) + start indexing job |
| `GET`  | `/list` | List indexed videos for the institute |
| `GET`  | `/{record_id}` | Full record incl. all artifact URLs |
| `GET`  | `/{record_id}/status` | Lightweight `{status, progress, error_message}` poll |
| `DELETE` | `/{record_id}` | Soft-delete record |

`POST /create` body:

```json
{
  "name": "Episode 47 — Quantum Mechanics",
  "mode": "podcast",
  "source_url": "https://vacademy-media-storage.s3.amazonaws.com/uploads/abc.mp4"
}
```

Status progression: `PENDING → QUEUED → PROCESSING → COMPLETED | FAILED`. Progress is a 0-100 int reflecting the indexing pipeline's stage.

---

## 3. Pipeline stages

Defined in [extractor/pipeline.py](../../ai_service/render_worker/extractor/pipeline.py). Single entry point: `run_index_pipeline(input_video_id, source_url, mode, on_progress)`.

| Stage | Range | What runs | Output |
|------:|------:|-----------|--------|
| Setup | 0-5%  | Download source from S3, ffprobe metadata, re-encode to MP4 if non-standard container, upload to public bucket | `assets.source_video` |
| 1 — Audio | 5-25% | Demux to 16kHz WAV → faster-whisper (base model, int8) → librosa prosody (RMS @ 100ms, f0 via pyin) → emphasis detection | `transcript`, `prosody`, `emphasis` |
| 1 — Scenes | 25-28% | PySceneDetect content detection (threshold 33 podcast / 27 demo) | `scenes` |
| **1.5 — Full-video face scan** | **28-30%** | **Podcast only.** MediaPipe FaceMesh @ 1fps over entire video → cluster into stable position segments | `face_segments`, `full_video_faces` (SQLite) |
| 2 — Highlight | 30-40% | LLM picks best 30-60s window using transcript + emphasis + scenes + RMS curve. Falls back to energy heuristic on LLM failure | `meta.highlight_window` |
| 3a — Podcast visuals | 40-90% | Within highlight only: FaceMesh @ 6fps, MediaPipe Pose lite, SelfieSeg matting → encode `speaker_fg.webm` | `foreground`, `frames` (SQLite) |
| 3b — Demo visuals | 40-90% | Within highlight only: PaddleOCR sweep, cursor tracking, UI cutout extraction, dynamic crop selection | `demo_only`, `ocr_events`/`cursor_track`/`ui_cutouts` (SQLite) |
| Output | 90-100% | Per-sentence prosody enrichment, build `VideoContext`, upload `video_context.json` + `video_spatial.sqlite` | All artifacts in S3 |

**Failure modes:**
- Stage 1.5 catches its own exceptions and continues with empty `face_segments` — non-fatal so a face-detector edge case doesn't block the whole pipeline.
- Stage 2 LLM failure falls back to picking the highest-energy 30s window via `select_highlight_energy_only`.
- Stage 3 failures abort the pipeline and mark `status=FAILED`.

---

## 4. Artifacts in S3

Layout under `s3://{bucket}/ai-input-videos/{input_video_id}/`:

```
ai-input-videos/{id}/
├── source.mp4                  ← browser-compatible re-encoding of the upload
├── video_context.json          ← THE CONTRACT — structured metadata (§5)
├── video_spatial.sqlite        ← per-frame queryable data (§6)
└── assets/
    ├── speaker_fg.webm         ← podcast: alpha-channel speaker matte (highlight only)
    ├── pip_fg.webm             ← demo: PiP region matte (if speaker visible)
    └── ui_cutouts/             ← demo: standalone UI element images
        ├── cut_001.png
        └── ...
```

URLs are persisted in the `ai_input_videos` DB row:
- `source_url` — original upload (input)
- `context_json_url` — pointer to `video_context.json`
- `spatial_db_url` — pointer to `video_spatial.sqlite`
- `assets_urls` (JSONB) — `{speaker_fg, pip_fg, ui_cutout_*, source_video}` keyed dict

---

## 5. `video_context.json` — full schema

Top-level shape (Pydantic models in [extractor/schemas.py](../../ai_service/render_worker/extractor/schemas.py)):

```jsonc
{
  "meta": { ... },
  "transcript": [ ... ],
  "emphasis": [ ... ],
  "prosody": { ... },
  "scenes": [ ... ],
  "foreground": { ... },         // podcast mode only
  "face_segments": [ ... ],      // podcast mode only
  "demo_only": { ... }           // demo mode only
}
```

### 5.1 `meta` — VideoMeta

```jsonc
{
  "mode": "podcast",
  "duration_s": 3612.4,
  "resolution": [1920, 1080],
  "fps_original": 29.97,
  "fps_sampled_visual": 6.0,
  "highlight_window": {
    "t_start": 1240.5,
    "t_end": 1295.0,
    "reason": "speaker delivers the core thesis with high energy and clear scene break"
  }
}
```

### 5.2 `transcript` — list[Sentence]

Faster-whisper sentence-level segmentation with word timestamps. Per-sentence prosody fields are populated by `assign_sentence_prosody()` in audio.py.

```jsonc
[
  {
    "text": "Quantum entanglement is fundamentally non-local.",
    "start": 12.34,
    "end": 15.78,
    "words": [
      {"word": "Quantum", "start": 12.34, "end": 12.71},
      {"word": "entanglement", "start": 12.71, "end": 13.42},
      ...
    ],
    "energy_mean": 0.0421,         // mean RMS over sentence span
    "pitch_mean_hz": 142.3,        // mean f0 over voiced frames in span
    "pitch_std_hz": 18.7,          // pitch variance — high = expressive delivery
    "speech_rate_wps": 2.318       // words per second
  },
  ...
]
```

**For engagement detection**: a sentence with high `pitch_std_hz`, high `energy_mean`, AND elevated `speech_rate_wps` is a strong "exciting moment" signal. Conversely, a sentence with high `energy_mean` + LOW `speech_rate_wps` is a "deliberate emphasis" moment.

### 5.3 `emphasis` — list[EmphasisMark]

Heuristic per-word emphasis flags from `detect_emphasis()`.

```jsonc
[
  {"t": 14.82, "word": "non-local", "reason": "energy_spike"},
  {"t": 22.10, "word": "specifically", "reason": "long_pause_before"},
  ...
]
```

`reason` ∈ `"energy_spike"` (RMS > 1.5× mean), `"long_pause_before"` (≥0.8s silence preceding), `"pitch_rise"` (f0 jump above local baseline — currently unused, reserved).

### 5.4 `prosody` — ProsodySummary

```jsonc
{
  "mean_rms": 0.0312,
  "peak_rms": 0.198,
  "mean_pitch_hz": 138.5,
  "pause_count": 47,
  "pauses": [
    {"start": 23.45, "end": 24.12, "duration_s": 0.67},
    ...
  ],
  "energy_series": [               // 1s-bucketed RMS, full video duration
    {"t": 0.0, "v": 0.028},
    {"t": 1.0, "v": 0.041},
    {"t": 2.0, "v": null},         // null = no audio in bucket
    ...
  ],
  "pitch_series": [                // 1s-bucketed f0, NaN frames excluded
    {"t": 0.0, "v": 142.1},
    {"t": 1.0, "v": null},         // null = unvoiced (silence/breath)
    ...
  ]
}
```

**Why the series?** The 100ms-resolution arrays computed by `analyze_prosody()` are large (~36k entries for a 1hr video). The 1s downsampling balances signal preservation against JSON size — gives a future engagement-detection pipeline a usable energy heatmap without needing to re-run librosa.

### 5.5 `scenes` — list[SceneBoundary]

PySceneDetect output. Use as natural shot-boundary candidates.

```jsonc
[
  {"t": 0.0, "frame_num": 0},
  {"t": 47.83, "frame_num": 1434},
  ...
]
```

### 5.6 `foreground` — SpeakerForeground (podcast only)

Summary metadata for the highlight-window matte. Asset is `speaker_fg.webm` with alpha channel.

```jsonc
{
  "asset_path": "assets/speaker_fg.webm",
  "has_alpha": true,
  "typical_bbox_norm": [0.32, 0.18, 0.36, 0.62],   // averaged over highlight
  "free_regions": ["top_left", "bottom_left"]       // crude quadrant guess
}
```

⚠️ This is highlight-window data. For full-video face-aware placement, use `face_segments` (next).

### 5.7 `face_segments` — list[FaceSegment] (podcast only)

**Full-video** speaker face track, clustered into stable position ranges. This is the primary input for any pipeline that wants to overlay infographics, lower-thirds, or any other element without colliding with the speaker.

```jsonc
[
  {
    "t_start": 0.0,
    "t_end": 312.4,
    "bbox_norm": [0.350, 0.180, 0.380, 0.620],
    "free_regions": [
      "top_right", "bottom_right",
      "right_half", "top_half", "bottom_half"
    ],
    "sample_count": 308,            // frames sampled @ 1fps
    "detection_rate": 0.987         // 98.7% had a face — high confidence
  },
  {
    "t_start": 312.4,
    "t_end": 580.0,
    "bbox_norm": [0.620, 0.190, 0.350, 0.610],   // speaker moved right
    "free_regions": [
      "top_left", "bottom_left",
      "left_half", "top_half", "bottom_half"
    ],
    "sample_count": 268,
    "detection_rate": 0.991
  },
  ...
]
```

**Free-region semantics** (from `_compute_free_regions` in [full_video_face.py](../../ai_service/render_worker/extractor/full_video_face.py)):

| Region | Returned when |
|---|---|
| `top_left` / `top_right` / `bottom_left` / `bottom_right` | Quadrant doesn't contain the face center |
| `left_half` / `right_half` | Face center is on the opposite side (cx > 0.45 → left free; cx < 0.55 → right free) |
| `top_half` / `bottom_half` | Face center is in opposite half (cy > 0.40 → top free; cy < 0.60 → bottom free) |

Both half- and quadrant-zones can appear together — half zones are useful for **wide overlays** (lower-thirds, banners), quadrants for **discrete elements** (logos, badges).

**Segment break rules** (`cluster_into_segments`):
- New segment starts when face center moves >12% of canvas distance
- Detection gaps ≤5s are bridged within a segment
- Segments shorter than 2s are dropped (blip filter)

### 5.8 `demo_only` — DemoContext (demo mode only)

```jsonc
{
  "ui_elements_seen": ["VS Code", "Chrome", "Terminal"],
  "cursor_path_summary": "1438 positions tracked",
  "key_onscreen_events": [
    {"t": 12.4, "kind": "click", "near_text": "Run", "ui_cutout_id": "cut_003"},
    {"t": 18.9, "kind": "type", "near_text": "function calculateTotal"},
    {"t": 31.2, "kind": "scroll", "near_text": ""}
  ],
  "dynamic_crops": [
    {"t_start": 10.0, "t_end": 25.0, "crop_bbox_norm": [0.1, 0.2, 0.5, 0.6], "follows": "cursor"}
  ],
  "pip": {
    "present": true,
    "roi_norm": [0.75, 0.05, 0.20, 0.20],
    "pip_fg_asset": "assets/pip_fg.webm"
  },
  "ui_cutouts": [
    {"id": "cut_003", "t": 12.0, "bbox_norm": [0.15, 0.85, 0.10, 0.05],
     "asset_path": "assets/ui_cutouts/cut_003.png", "label": "Run button"}
  ]
}
```

---

## 6. `video_spatial.sqlite` — per-frame queryable data

For workloads that need pixel-level data per timestamp (e.g. "find me the face bbox at frame 1247"), the JSON is too coarse. The SQLite DB is loaded by the renderer or by future per-frame analysis pipelines.

Schema in [extractor/spatial.py](../../ai_service/render_worker/extractor/spatial.py):

| Table | Coverage | Purpose |
|---|---|---|
| `frames` | Highlight window only @ 6fps (podcast) | Per-frame face/head pose/gesture for compositing |
| `full_video_faces` | **Full video @ 1fps (podcast)** | Per-second face bbox over entire duration; index on `t` |
| `face_segments` | **Full video (podcast)** | Materialized version of JSON `face_segments` for SQL access; range-index on `(t_start, t_end)` |
| `ocr_events` | Highlight window only (demo) | Per-frame OCR results with text + bbox |
| `cursor_track` | Highlight window only (demo) | Per-frame cursor position + type |
| `change_events` | Highlight window only (demo) | Per-frame screen region changes |
| `dynamic_crops` | Highlight window only (demo) | Time-bounded crop windows |
| `ui_cutouts` | Highlight window only (demo) | Standalone UI element assets |

### Example queries

```sql
-- "Where was the speaker's face at t=2400s?"
SELECT bbox_x, bbox_y, bbox_w, bbox_h, free_regions
FROM face_segments
WHERE t_start <= 2400 AND t_end >= 2400;

-- "Give me 10s windows with the highest energy in the full video"
-- (use video_context.json prosody.energy_series instead — SQL doesn't have that)

-- "When was the cursor near the 'Run' button during the highlight?"
SELECT frame_num, x, y FROM cursor_track
WHERE x BETWEEN 0.10 AND 0.20 AND y BETWEEN 0.80 AND 0.90;
```

⚠️ `frames.rms` and `frames.pitch` columns exist but are currently always `0.0` for podcast (not populated in [podcast_visual.py](../../ai_service/render_worker/extractor/podcast_visual.py)). Use `prosody.energy_series` and `prosody.pitch_series` from the JSON instead — those cover the **full** video, not just the highlight window.

---

## 7. How a downstream pipeline consumes the index

Loading from `ai_service`:

```python
from app.repositories.ai_input_video_repository import AIInputVideoRepository
import json, sqlite3, urllib.request

record = repo.get_by_id(input_video_id)

# JSON metadata
ctx_json = urllib.request.urlopen(record.context_json_url).read()
ctx = VideoContext.model_validate_json(ctx_json)

# Spatial DB (download to temp file then connect)
with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as f:
    f.write(urllib.request.urlopen(record.spatial_db_url).read())
    conn = sqlite3.connect(f.name)
```

### 7.1 Engagement-driven highlight selection

```python
# Score every 30s window by combined energy + pitch variance
scores = []
energy = ctx.prosody.energy_series
for win_start in range(0, int(ctx.meta.duration_s) - 30):
    energy_sum = sum(e["v"] or 0 for e in energy[win_start:win_start+30])
    sentences_in_win = [
        s for s in ctx.transcript
        if s.start >= win_start and s.end <= win_start + 30 and s.pitch_std_hz
    ]
    pitch_var = sum(s.pitch_std_hz for s in sentences_in_win) / max(1, len(sentences_in_win))
    scores.append((win_start, energy_sum + 0.05 * pitch_var))
best_t, _ = max(scores, key=lambda x: x[1])
```

### 7.2 Face-aware overlay placement

```python
def safe_zone_at(t: float) -> str:
    seg = next(
        (s for s in ctx.face_segments if s.t_start <= t <= s.t_end),
        None,
    )
    if not seg:
        return "bottom_right"  # default
    # Prefer wider zones for banners, quadrants for badges
    for zone in ["right_half", "left_half", "bottom_right", "top_right",
                 "bottom_left", "top_left"]:
        if zone in seg.free_regions:
            return zone
    return "bottom_right"

# Place an infographic at every emphasis mark in the safe zone for that moment
for mark in ctx.emphasis:
    if mark.reason == "energy_spike":
        zone = safe_zone_at(mark.t)
        emit_overlay(t=mark.t, content=mark.word, zone=zone)
```

### 7.3 Per-sentence pacing analysis

```python
# Find "fast and excited" stretches — high WPS + high pitch variance
hot = [
    s for s in ctx.transcript
    if (s.speech_rate_wps or 0) > 3.0 and (s.pitch_std_hz or 0) > 25
]
```

---

## 8. Extending the pipeline

### Adding a new metadata field

1. Add the field to the relevant Pydantic model in `schemas.py`
2. Compute it inside the existing stage that has the source data, or add a new stage
3. Wire it into the `VideoContext(...)` construction in `pipeline.py`
4. Update §5 of this doc with the new field

### Adding a new SQLite table

1. Add the `CREATE TABLE` to `create_spatial_db()` in `spatial.py`
2. Add a `write_*` helper following the existing pattern
3. Call it from `pipeline.py` (re-open the connection if needed — Stage 3 closes it)
4. Update §6 of this doc

### Adding a new ingestion mode

Currently `podcast` and `demo`. To add e.g. `screencast_and_face`:

1. Add the mode string to the `mode` field validation in `app/schemas/ai_input_video.py`
2. Add a stage-3 branch in `pipeline.py` calling a new `extractor/{mode}_visual.py`
3. Decide whether `foreground` and/or `demo_only` apply, populate accordingly

---

## 9. Operational notes

- **Capacity**: render worker manages a shared pool for index jobs and render jobs (see `main.py`). A single 1hr indexing job takes ~3-8 min depending on Whisper model size and CPU.
- **Storage**: typical 1hr podcast produces ~1-2 MB of JSON, ~5-15 MB of SQLite, ~50-200 MB of `speaker_fg.webm` (highlight only).
- **Re-runs**: indexing is idempotent at the DB record level. To re-index, `DELETE` the record and `POST /create` again with the same `source_url`.
- **GPU vs CPU**: Whisper runs `int8` on CPU by default (lazy singleton in [audio.py](../../ai_service/render_worker/extractor/audio.py)). MediaPipe FaceMesh and Pose lite are CPU. SelfieSeg is CPU. Switching to GPU is a config change, not a code change — see worker env.
- **PII**: `transcript`, `ocr_events`, and `near_text` in `key_onscreen_events` can contain user data. Treat artifacts as institute-private — they go to the same private S3 paths as generated videos.

---

## 10. Glossary

| Term | Meaning |
|------|---------|
| **Index pipeline** | The 3-stage extractor in `extractor/pipeline.py` that turns a raw upload into structured metadata. Distinct from the **generation pipeline** (`automation_pipeline.py`) which produces shot-by-shot HTML. |
| **Highlight window** | LLM-picked 30-60s slice of the source. Stage 3 expensive visual extraction runs only here. |
| **Full-video face scan** | Stage 1.5: 1fps face detection across the **entire** source video, regardless of highlight. Distinct from Stage 3a's 6fps highlight-window pass. |
| **Face segment** | A time range within the full video where the speaker's face stayed in roughly the same canvas region. Carries `free_regions` for overlay placement. |
| **Free region** | A canvas zone (`top_left` / `right_half` / etc.) that does NOT contain the speaker's face — i.e. safe to put an overlay there. |
| **Emphasis mark** | A timestamped word the prosody analyzer flagged as emphasized (energy spike or long preceding pause). |
| **Energy/pitch series** | 1s-bucketed downsampled RMS/pitch covering the full video. The "engagement heatmap" raw input. |
| **Spatial DB** | `video_spatial.sqlite` — relational store for per-frame data the renderer queries by timestamp. |
| **Foreground** | The alpha-matted speaker WebM (`speaker_fg.webm`) plus its summary bbox. Highlight-window only. |
| **Mode** | `podcast` (talking head) or `demo` (screen recording). Determines which Stage 3 branch runs. |

---

**Maintainers**: when changing `extractor/schemas.py`, `extractor/pipeline.py`, or any `extractor/*_visual.py`, update §3 (stages), §5 (JSON schema), and §6 (SQLite tables) in this doc in the same commit.
