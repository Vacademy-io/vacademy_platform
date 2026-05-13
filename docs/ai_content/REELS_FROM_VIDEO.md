# Reels from Long Video — Feature Reference

**Status**: Backend Phase 1 + 2a (karaoke captions) + 2b (STYLE_GUIDE palette extraction, A/B-gated) + 2c (LLM-driven Director) + 2c.1 (director hardening) + 2c.2 (preview metering) + 2c.3 (stacked + PiP layouts) + 2c.4 (auto b-roll fetch) + 2c.5 Slice 1 (per-phrase b-roll overlays) + 2c.5 Slice 2 (animated stat cards + bar_chart) + 2c.5 Slice 3 (line_chart + pie_chart + comparison_icons) + 2c.6 (whoosh SFX on hard cuts) + 2c.7 (AI emoji injection on caption keywords) + 2c.8 (LLM background-concept extraction for b-roll) + 2d (PiP alpha-matte cutout) shipped. Backend Phase 2 (editor `kind=reel` frame save endpoints, `/render` idempotency) shipped. Frontend Phase A (Slices 1-5) + scan settings strip (target duration / scan limit / topic keywords) + render config panel (aspect / layout / pace / captions / audio / bgv source) shipped. Source-clip aspect canvas scales to canonical delivery dims (1080×1920 for 9:16). Time-varying crop tracks the speaker via piecewise-linear ffmpeg expressions.
**Owners**: Vimotion team.
**Companion docs**: [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md), [INPUT_VIDEO_INDEXING.md](./INPUT_VIDEO_INDEXING.md), [VIDEO_EDITOR_REVIEW.md](./VIDEO_EDITOR_REVIEW.md), [VIMOTION_FEATURE.md](../VIMOTION_FEATURE.md). The full design + research appendix lives in the planning doc (Claude session artifact).

---

## 1. What this is

A pipeline that takes a long-form indexed video (podcast, lecture, interview) and produces multiple short-form reels (≤60s). The user uploads → indexes (existing pipeline) → opens this feature → scans for engaging moments → previews the AI-generated cut plan → renders the final MP4 with captions and overlays.

Output is editor-compatible — the rendered reel can be opened in the existing `/vim/edit/$videoId` editor and re-edited.

### Why

Indexing the source video already produces `transcript`, `emphasis`, `prosody`, `face_segments`, `scenes` etc. (see [INPUT_VIDEO_INDEXING.md](./INPUT_VIDEO_INDEXING.md)). Reels-from-Video is the first **consumer** of that metadata — it turns "1hr of indexed footage" into "5 ready-to-post short clips."

### User journey

```
Assets tab ─► click podcast ─► "Create Reels from this" button
                                          │
                                          ▼
                          /vim/reels/new?fromAssetId=<id>
                          │
       ┌──── Asset picker (skipped via deep-link) ────┐
       └────────────► Gate 1: SCAN ◄─────────────────┘
                          │  30 candidates ranked
                          ▼
                          User picks 1-10
                          │
                          ▼
                  Gate 2: PREVIEW (LLM-enriched)
                          │  title, rationale, cut plan
                          ▼
                          User clicks "Render this clip"
                          │
                          ▼
                  Gate 3: RENDER (async 7-stage pipeline)
                          │
                          ▼
                  /vim/reels/$reelId
                  ├─ stage-by-stage progress
                  └─ on COMPLETED: video player + "Open in editor"
```

---

## 2. Three-gate funnel

Each gate has different cost + commitment level — the design protects the user from accidentally paying render credits.

| Gate | Endpoint | Cost | What it does |
|---|---|---|---|
| **1 — SCAN** | `POST /scan` | Free | Scores every candidate window with a deterministic 4-axis engagement scorer (Hook / Pacing / Info / Loop). Returns 30 ranked candidates. Idempotent + 24h server-side cache. |
| **2 — PREVIEW** | `POST /preview` | 1 LLM call per pick (Haiku-class) | Enriches user-selected candidates: title, rationale, word-level importance, surgical cut plan that hits target duration ±3s. Falls back to heuristic on LLM failure. |
| **3 — RENDER** | `POST /render` | Full pipeline | Async 7-stage render: AUDIO_EDIT → SOURCE_CLIP → STYLE_GUIDE → DIRECTOR → HTML → ASSEMBLE → RENDER. Polls existing render-worker for the final MP4. |

Plus list/get/status/delete for management:
- `GET /list` (optional `?input_asset_id=` filter)
- `GET /{reel_id}` (full record)
- `GET /{reel_id}/status` (lightweight poll)
- `DELETE /{reel_id}` (soft delete)

Plus editor frame plumbing — used by `/vim/edit/$videoId?kind=reel`'s save loop:
- `POST /frame/add` — insert an entry into `s3_urls.time_based_frame`
- `POST /frame/update` — overwrite an entry's HTML / timing / z
- `POST /frame/delete` — remove an entry (entry_id preferred, frame_index fallback)

All routes mounted at `{AI_SERVICE_BASE_URL}/external/reels/v1/*`. Auth via existing `X-Institute-Key` header.

---

## 3. System architecture

```
                      ┌──────────────────────────────┐
                      │  Vimotion FE (/vim/...)      │
                      │  features/vimotion/reels/    │
                      └──────────────┬───────────────┘
                                     │ HTTP + X-Institute-Key
                                     ▼
                      ┌──────────────────────────────┐
                      │  ai_service                  │
                      │  app/routers/reels.py        │
                      │  app/services/reels_*.py     │
                      └──────────────┬───────────────┘
                          ┌──────────┴──────────┐
                          ▼                     ▼
              ┌────────────────────┐  ┌────────────────────┐
              │  admin_core PG     │  │  Render Worker     │
              │  ai_reels          │  │  /jobs (Playwright │
              │  ai_reel_candidates│  │   + ffmpeg)        │
              │  ai_input_assets   │  └─────────┬──────────┘
              └────────────────────┘            │
                          ▼                     ▼
              ┌────────────────────────────────────────────┐
              │  AWS S3                                    │
              │  ai-reels/{reel_id}/                       │
              │   speaker_audio.mp3                        │
              │   speaker_clip.mp4                         │
              │   time_based_frame.json                    │
              │   video.mp4  (final render)                │
              │   thumbnails/                              │
              └────────────────────────────────────────────┘
```

---

## 4. Backend

### 4.1 Files

**Routers**
- `app/routers/reels.py` — all 7 funnel endpoints + 3 frame endpoints + side-effect `register_all_stages()`

**Services** (`app/services/reels_*.py`)
- `reels_engagement_service.py` — 4-axis scorer for `/scan`
- `reels_thumbnail_service.py` — per-candidate ffmpeg poster generation
- `reels_preview_service.py` — `/preview` LLM call + word importance + greedy cut planner
- `reels_render_orchestrator.py` — async 7-stage runner with module-level task ref for GC safety
- `reels_audio_edit_service.py` — AUDIO_EDIT stage (filter_complex single-invocation)
- `reels_source_clip_service.py` — SOURCE_CLIP stage (face-aware aspect crop)
- `reels_director_service.py` — DIRECTOR stage (deterministic template; karaoke captions)
- `reels_assemble_service.py` — ASSEMBLE stage (final {meta, entries} JSON + validation)
- `reels_render_finalize_service.py` — RENDER stage (worker submit + adaptive polling)
- `reels_frame_service.py` — add/update/delete a single entry in the reel's `time_based_frame.json` on S3 (editor save plumbing)
- `reels_llm_director_service.py` — LLM-driven storyline overlays. Eight spec types: text overlays (`hook` / `micro_hook` / `loop_back` / `emphasis`) + non-text visual overlays (`broll_video` / `broll_image` / `animated_stat` / `motion_graphic`). Deterministic fallback synthesizes missing hook / micro_hook from the working title + word_importance.
- `reels_broll_service.py` — Pexels search wrapper for the LLM director's media specs. `extract_concept` for the auto-bgv path; `find_b_roll` (videos) + `find_b_roll_image` (photos) for per-phrase media overlays. Per-process LRU cache (256 entries) keyed on `(concept, orientation, min_duration)` with `v|` / `i|` namespaces.

**Models / repo / schemas**
- `app/models/ai_reel.py` — `AiReel` table
- `app/models/ai_reel_candidate.py` — `AiReelCandidate` (TTL'd, 24h)
- `app/repositories/ai_reel_repository.py` — `AiReelRepository` + `AiReelCandidateRepository`
- `app/schemas/reels.py` — Pydantic schemas (request + response shapes)

**Migration**
- `app/migrations/add_ai_reels_tables.sql` (ai_service-side, source of truth)
- `admin_core_service/src/main/resources/db/migration/V245__Create_ai_reels_tables.sql` (Flyway deployment copy)

### 4.2 4-axis engagement scorer

Per [research §12.2](#research-appendix) of the planning doc, scoring on a single composite hides quality signals. Veed's 4-axis (Flow/Impact/Clarity/Relevance) wins user trust over Opus's opaque single number.

| Axis | Signals |
|---|---|
| **Hook** | Energy in first 2.5s, opener-quality penalty for filler words ("So,", "Yeah,", "I think,"), question / contrarian opener bonus, vocal expressiveness (pitch variance) |
| **Pacing** | Predicted post-trim duration match to target±tol, emphasis density *relative to source baseline* (not absolute), scene-boundary alignment, silence-fraction penalty |
| **Info** | Unique content-word density per second, numeric token bonus, keyword match bonus, repetition penalty |
| **Loop** | First-last MFCC similarity (when prosody series available) or first-last sentence Jaccard text callback (fallback), strong CTA penalty on final 2.5s |

Composite = weighted geometric mean (hook 0.40, pacing 0.25, info 0.20, loop 0.15). Geometric mean intentional — one weak axis tanks the composite, which matches the user-facing penalty we want.

**Hard rejects**:
- Window word-cut budget > 20% of word count (too much surgery → meaning damage)
- ≥3 face_segment moves in window (jumpy vertical crop)
- Empty transcript snippet (silent stretch)

Plus a **diversity penalty** — windows within `min(60, duration/5)`s of an already-top-ranked window get dropped after the 5th pick, so top-N spreads across the source.

### 4.3 Cut planner (Gate 2)

Greedy algorithm in `reels_preview_service.plan_cuts`:

1. Compute `excess_s = predicted_after_silence - target` from the candidate row
2. If within tolerance → return empty cut plan
3. Sort cuttable words (importance ≤ 1) by `(importance asc, duration desc)` — most-filler + longest first (fewer cuts = fewer crossfade artifacts)
4. Mark words until `accumulated_s ≥ excess_s × (1 + overshoot)`. Overshoot fraction = 15% to absorb validation losses
5. Merge consecutive marked words into spans
6. **Validate**: drop sub-80ms spans (sub-syllable artifacts), split spans >2s (jumpy even with crossfade)
7. **Iterate** up to 3 retries if validation losses still leave us short of target

LLM never marks `importance ≥ 2` words as cuttable. Emphasis marks + topic_keyword matches are deterministically raised to importance ≥ 2 *after* the LLM pass (post-hoc floor enforcement).

### 4.4 Seven render stages

Each stage runs in a thread (`asyncio.to_thread`) so the asyncio loop stays responsive. Per-stage progress band:

| Stage | Range | What runs |
|---|---|---|
| AUDIO_EDIT | 0-15% | Single ffmpeg `filter_complex`: `atrim×N → concat → atempo`, then layered amix with optional `[bgm_ducked]` (sidechaincompress) and `[sfx]` (per-cut anoisesrc whooshes). Stream-copies kept spans, applies speed_multiplier (1.0-1.5), uploads MP3 |
| SOURCE_CLIP | 15-35% | Single ffmpeg: `trim×N → concat → crop → setpts/K`. Face-aware aspect crop (9:16 face-centered, 16:9 passthrough). No audio in output (-an) |
| STYLE_GUIDE | 35-40% | **No-op in Phase 1** — folded into DIRECTOR templates (Hormozi yellow/green/red palette) |
| DIRECTOR | 40-55% | Deterministic template (no LLM in Phase 1): base SOURCE_CLIP entry + hook overlay (first 2.5s with candidate title) + sentence-aware caption blocks with per-word karaoke animation |
| HTML | 55-85% | **No-op in Phase 1** — DIRECTOR generates HTML directly |
| ASSEMBLE | 85-90% | Build `{meta, entries}` JSON. Strict body-fragment validation. Upload to S3 |
| RENDER | 90-100% | Submit to existing render worker (`/jobs`), poll until completed, write final video URL. Intermediate progress writes for 5pp granularity |

Stages register themselves at module import via `register_stage_handler`. The orchestrator's `register_all_stages()` helper imports every stage module, guaranteeing all real handlers are installed before the first render dispatches.

### 4.5 G-fixes from deep reviews

| Fix | Purpose |
|---|---|
| G1 | `error_message` prefixed with `[STAGE_NAME]` so failures surface which stage broke |
| G2 | Module-level `_PENDING_RENDER_TASKS` set holds task refs to prevent GC kill ("Task was destroyed but it is pending!") |
| G3 | FAILED writes `progress=last_progress` (end of last successful stage), not 0 — UI doesn't visually "rewind" |
| G4 | Candidate's `enriched` snapshotted into `AiReel.config["enriched_snapshot"]` at `/render` time. Concurrent `/preview` can't corrupt an in-flight render |
| G5 | Source URL strict-validated (https / http only, whitespace stripped, file:// rejected) |
| G6 | `register_all_stages()` helper for explicit handler installation from any entry point |
| F1 | `_sentence_at` falls forward to nearest sentence within 1.5s — hook scoring no longer collapses on pre-roll silence |
| F2 | `_count_speaker_moves` measures actual bbox-center displacement, not segment-touches — fixes false-positive jumpy-framing rejections |
| F3 | `first_sentence_complete` bonus fires when 2nd sentence starts inside hook window (was: only fired for sentences ≤2.5s, perversely rewarded fragmentary openings) |
| F4 | `must_include_ranges` bypass speaker_moves rejection — user-pinned ranges are honored even if framing isn't perfect |
| R1-R12, P1-P18 | Various correctness + edge-case fixes from earlier review rounds (see git history) |

---

## 5. Frontend

### 5.1 Routes

| Path | Purpose |
|---|---|
| `/vim/dashboard?tab=reels` | List of reels (filter chips, polling, status badges) |
| `/vim/reels/new` | Create flow (Gate 1 + 2 + 3 entry) |
| `/vim/reels/new?fromAssetId=<id>` | Deep-link from AssetDetailPanel — skips asset picker |
| `/vim/reels/$reelId` | Detail page: stage-by-stage progress → completed MP4 player |
| `/vim/edit/$videoId` | Existing editor — reels currently open here read-only |

### 5.2 Files

**Hooks** (`features/vimotion/reels/hooks/`)
- `useReelsList.ts` — list query with adaptive polling
- `useScan.ts` — `useQuery` wrapping POST /scan (server is idempotent)
- `usePreview.ts` — `useMutation` wrapping POST /preview
- `useRender.ts` — `useMutation` wrapping POST /render; invalidates reels-list cache on success
- `useReel.ts` — full record query for the detail page with adaptive polling

**Service** (`features/vimotion/reels/services/`)
- `reels-api.ts` — typed HTTP client. All response shapes mirror `app/schemas/reels.py`

**Dashboard surface** (`features/vimotion/dashboard/`)
- `ReelsTab.tsx` — list view (mirrors AssetsTab patterns)
- `AssetDetailPanel.tsx` — *edited* to include `<CreateReelsCTA />`

**Create flow** (`features/vimotion/reels/create/`)
- `CreatePage.tsx` — state machine (picking → scanning → results → previewing)
- `AssetPickerStep.tsx` — eligibility-filtered picker (kind=video + mode=podcast + status=COMPLETED)
- `ScanResultsGrid.tsx` — multi-select grid with sticky action bar (capped at 10 picks per server schema)
- `ReelCandidateCard.tsx` — thumbnail + 4-axis bars + composite score + transcript snippet + low-confidence badge
- `PreviewTray.tsx` — slide-up drawer with loading / error / enriched-cards
- `WordImportanceTimeline.tsx` — visualizes kept vs cut words with strikethrough + per-word coloring

**Detail surface** (`features/vimotion/reels/detail/`)
- `ReelDetailPage.tsx` — three branches: RunningBody / CompletedBody / FailedBody
- `StageProgressList.tsx` — 7-stage visual (completed=green check, active=blue spinner, failed=red alert, pending=grey circle)

**Reusable** (`features/vimotion/reels/dashboard/`)
- `CreateReelsCTA.tsx` — self-gating button (only renders for reels-eligible assets)

### 5.3 Dashboard integration

`tabsConfig.ts` got a 6th tab (`reels`) between `recent` and `assets`. `Sidebar.tsx` adds a `Scissors` icon entry. `DashboardLayout.tsx` renders `<ReelsTab />` when `tab === 'reels'`.

---

## 6. What's shipped (Phase 1 + 2a)

### Backend

✅ **Schemas + models + migration** — `ai_reels` + `ai_reel_candidates` with UNIQUE constraint on `(input_asset_id, config_hash, rank)` + FK with `ON DELETE SET NULL` + `pgcrypto` extension. Deployed via Flyway V245.

✅ **`/scan`** — 4-axis engagement scorer, validated against the real Steve Jobs interview (`video_context.json` from staging). Real-world tuning fixes applied (emphasis ratio relative to source baseline, diversity radius proportional to source duration, energy fallback when prosody series missing, text-callback fallback for loop axis).

✅ **`/preview`** — combined LLM call (title + rationale + word_importance in one Haiku roundtrip), greedy cut planner with overshoot for validation-drop absorption, parallelized across N picks via `asyncio.gather`, cache-hit short-circuits via `candidate.enriched` field.

✅ **`/render`** + 7-stage orchestrator — async fire-and-forget, in-process. All 7 stages have real handlers (except STYLE_GUIDE / HTML which are no-op for Phase 1 — folded into DIRECTOR templates).

✅ **AUDIO_EDIT** — single ffmpeg filter_complex producing trimmed/atempo'd MP3. Validated against real S3 source with HTTPS-seek (no full download).

✅ **SOURCE_CLIP** — single ffmpeg with face-aware aspect crop (9:16 face-centered using `face_segments`, 16:9 passthrough), frame-accurate cuts in lockstep with audio trim_map. No audio in clip (separate file).

✅ **DIRECTOR** — deterministic template. Hook overlay (first 2.5s) + sentence-aware caption grouping (breaks on `.?!`) + **per-word karaoke reveal animation** (Phase 2a) with `animation-delay` matching each word's `t_start` offset. Hormozi-style yellow/green/red palette for `keyword_type` words.

✅ **ASSEMBLE** — produces editor-contract-conformant `{meta, entries}` payload; strict body-fragment validation rejects accidental full-doc HTML.

✅ **RENDER** — submits to existing render worker, intermediate progress writes mapped to 90-99 overall band, deadline + retry handling.

✅ **GET /list, /{id}, /{id}/status, DELETE /{id}** — full CRUD for reel management.

### Frontend (FE Phase A)

✅ **Slice 1** — Reels tab in dashboard + list view + adaptive polling + status badges + empty state

✅ **Slice 2** — `/vim/reels/new` create flow: asset picker → scan grid with multi-select + 4-axis bars + sticky action bar

✅ **Slice 3** — PreviewTray slide-up drawer: loading → enriched cards with title/rationale/cut-plan timeline → per-card Render CTA

✅ **Slice 4** — ReelDetailPage: RunningBody (stage list + progress) / CompletedBody (MP4 player + Open in editor / Download / Delete) / FailedBody (error + retry path)

✅ **Slice 5** — CreateReelsCTA on AssetDetailPanel (self-gating, deep-links to /vim/reels/new?fromAssetId=...)

✅ **Editor `kind=reel` save plumbing** — `/external/reels/v1/frame/{add,update,delete}` endpoints update `ai_reels.s3_urls.time_based_frame` on S3. Editor's `saveChanges` switches `frameBase`/`idField` when the route's `kind=reel` search param is set. ReelDetailPage's "Open in editor" navigates with `kind=reel`, so user edits round-trip to the right table. The video-editor pipeline-view affordances (`frame/regenerate`, `frame/update` for LLM re-prompts) stay on the AI-gen endpoints — reels don't use that flow.

✅ **Time-varying crop** — Phase-1's static crop drifted off-center when the speaker moved during the window. SOURCE_CLIP now walks `face_segments` overlapping the window, emits one keyframe per segment (`(crop_t, cx_norm, cy_norm)`) mapped via `_source_to_crop_time` to the **pre-atempo** post-trim+concat clock that ffmpeg's crop filter uses, smooths sub-1%-of-frame moves, and feeds the result to `crop=w:h:x:y` as **piecewise-linear expressions** of `t` (`if(lt(t, t1), p0+(p1-p0)*(t-t0)/(t1-t0), if(...))`). Crop **dimensions stay fixed** (aspect ratio preserved); only x/y track the speaker. Falls back to static crop when face_segments has 0-1 useful entries in the window. Validated end-to-end against ffmpeg 8.0.1: expression parsing + crop applied frame-accurately on a synthesized 22s 1280×720 source → 404×720 vertical crop.

✅ **`/render` config form (PreviewTray)** — `features/vimotion/reels/create/RenderConfigPanel.tsx` is a collapsible panel above the enriched-candidate cards. Surfaces aspect (9:16/16:9/1:1), pace (silence_trim level + speed 1.0×/1.1×/1.2× + word_trim toggle), captions (enabled + hormozi/karaoke/pop/clean preset), and audio (speaker-only vs speaker+bgm with URL input + ducking toggle). One config applies to whichever card the user renders next — matches the Opus/Vizard/Klap mental model. Soft-validation in `handleRender`: refuses click when "speaker+bgm" is picked without a URL. Layout stays hardcoded (`full_speaker_with_overlays`) since the other layouts aren't shipped yet.

✅ **Audio ducking + bgm mixing (`keep_speaker_plus_bgm`)** — AUDIO_EDIT now takes the second input via `-stream_loop -1 -i <bgm_url>` when the render config requests bgm. Filter graph adds `aresample=44100` to the speaker chain (so the sidechain compressor can run at a matching rate), then `[bgm]volume=-8dB[bgm_quiet]` → `[bgm_quiet][speaker]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=200:level_sc=1[bgm_ducked]` → `[speaker][bgm_ducked]amix=duration=first:normalize=0[mix]`. Output bumps to stereo 44.1kHz 128k mp3 when bgm is on (vs mono 22050/96k speaker-only) so music doesn't sound crunchy. `_resolve_bgm_url` applies the same `https?://`-only gate as source URLs (defense against `file:///` etc). Mode (`speaker_only` / `speaker_plus_bgm` / `speaker_plus_bgm_ducked`) lands in `AiReel.extra_metadata.audio_mode` for audit. Validated against real ffmpeg with synthetic speech+bgm inputs: mix produced 44.1kHz stereo mp3 at exactly the speaker's duration.

✅ **Whoosh SFX on hard cuts (Phase 2c.6)** — short pink-noise bursts (200ms each, -10dB, bandpass 200-2400 Hz with 25ms attack + 120ms tail) layer over the speaker at every kept-span boundary on the reel timeline. Research §12.2: transition SFX mask abrupt audio edits and lift retention by re-engaging attention at the seam. AUDIO_EDIT now emits one `anoisesrc=color=pink:…,adelay=<cut_ms>:all=1[wN]` filter chain per cut point and routes them through an `[w0][w1]…amix=duration=longest[sfx]` aggregator (or directly when only one cut). The final mix is now a unified N-input amix consuming `[speaker]` + optional `[bgm_final]` + optional `[sfx]` — replaced the previous bgm-only mix branch. Cut-point selection in `_compute_cut_points` dedupes whooshes that fall within 300ms of the previous (avoids buzz when the cut planner removes several short slivers in succession) and tail-trims cuts that would be truncated by `amix duration=first` (would have produced a click). SFX sample rate matches the speaker chain (22050 when no bgm, 44100 when bgm) so no implicit resample needed. Default-on; env kill-switch `REELS_WHOOSH_SFX_DISABLED=1` disables without a redeploy. `whoosh_sfx_count` lands in `AiReel.extra_metadata` for audit. Filter graphs validated against real ffmpeg for all 4 layer combos (speaker-only / +bgm / +bgm+ducking / +bgm+ducking+sfx) — exit=0 with valid MP3 output.

✅ **STYLE_GUIDE palette extraction (Phase 2b, A/B-gated)** — promoted the previously no-op STYLE_GUIDE stage to a real handler. `RenderRequest.palette: Literal["default", "source_derived"]` defaults to `"default"` so the proven Hormozi-style palette (yellow important / green definition / red warning) ships unchanged — protects the retention winner per research §12.4. Opt-in `"source_derived"` mode samples 3 keyframes from the just-uploaded `speaker_clip` (20% / 50% / 80% timestamps) via single-frame ffmpeg pipes (`-ss <t> -frames:v 1 -f image2pipe -vcodec png`), masks each frame's HSV pixels above (S>60, V>80) to filter grayish skin tones, takes the median hue across all "colorful" pixels (≥500 minimum), and re-renders at S=230 V=240 to produce a vivid caption-readable accent. ONLY the `important` slot is overridden — `definition` stays green and `warning` stays red because those colors are semantic across all reels (red warning ≠ "speaker happened to wear red"). `body` (white) + `stroke` (black) also stay fixed for readability. New helper `_effective_caption_palette(override)` merges `ctx.extra_metadata["style_palette"]` onto DEFAULT defensively — invalid hex / unknown tokens / short hex / non-string values all silently fall back to the default for that slot. `_build_caption_blocks_from_reel_time` + `_build_caption_block_html` gained a `palette: Optional[dict]` kwarg threaded from `run()` → block builder → block HTML, so source-derived accents flow through every caption span without touching the stat/motion-graphic renderers (those still read `_STAT_COLOR_BY_INTENT` directly — future polish). `extra_metadata.palette_mode` records `"default"` or `"source_derived"`; `palette_downgrade_reason` (`"no_speaker_clip"` / `"clip_too_short"` / `"no_frames"` / `"no_accent"`) lands when source_derived was requested but downgraded. Graceful degradation at every step: cv2/numpy not installed → fallback; ffmpeg frame extract failure → fallback; <500 colorful pixels (mostly grayscale source) → fallback. ~1-2s added to STYLE_GUIDE stage when source_derived fires; default mode is true no-op. 21+ inline tests cover hex validation (3-digit rejected, lowercase accepted, whitespace trimmed), override merging (token-level, partial, multi-token), downgrade reasons, schema field, orchestrator registration, and director threading.

✅ **PiP alpha-matte cutout (Phase 2d)** — `pip_corner_speaker` layout used to render a rounded rectangular PiP window in the bottom-right. Now (when matting succeeds) it renders the speaker as a full-frame transparent silhouette layered over the bgv — no border, no box. New `reels_alpha_matte_service.py` runs MediaPipe SelfieSegmentation at 6fps with temporal EMA smoothing (alpha_smooth=0.6) + 2px Gaussian edge feather (matches the proven `SelfieSegMatter` defaults from `render_worker/extractor/matting/`, inlined to keep ai_service self-contained — no `sys.path` hacks). Matter consumes the just-built `speaker_clip.mp4` (still in SOURCE_CLIP's tempdir), produces alpha mattes, then streams RGBA frames to ffmpeg → VP9 WebM with `pix_fmt=yuva420p` at 1Mbps. `~20s added to SOURCE_CLIP_BUILD on average`. SOURCE_CLIP uploads `speaker_fg.webm` to S3 alongside `speaker_clip.mp4`; `ctx.s3_urls["speaker_fg"]` flows through DIRECTOR. The director's `pip_corner_speaker` branch now dispatches on `speaker_fg_url`: present → alpha cutout (full-frame webm over full-frame bgv); None → Phase-2c.3 rectangular fallback. Matter only fires when `layout=pip_corner_speaker` so layouts that don't render a cutout don't pay the cost. Graceful degradation at every step: env kill-switch `REELS_ALPHA_MATTE_DISABLED=1` disables without a redeploy; missing cv2 / mediapipe at import time logs a warning and falls back to rectangular PiP; ffmpeg failure / empty webm output → fallback; missing/empty speaker_clip → fallback. `extra_metadata.alpha_matte` records `"selfie_seg"` / `"skipped"` for audit. mediapipe==0.10.14 + opencv-python-headless≥4.8 + numpy≥1.24 added to ai_service `requirements.txt` (matching render_worker's pins so matting behavior doesn't fork). Cross-reel cache by `(asset_id, t_start, t_end)` is a Phase-2d.1 follow-up — v1 produces fresh mattes per reel.

✅ **LLM background-concept extraction for b-roll (Phase 2c.8)** — auto-bgv resolution for stacked + PiP layouts now prefers an LLM-picked 2-5 word scene query ("podcast studio interview", "data analytics dashboard", "san francisco skyline") over the Phase 2c.4 heuristic single-word pick. The concept rides on the existing director LLM call — no extra round-trip, no extra cost. `REEL_DIRECTOR_SYSTEM_PROMPT` gains a `## Background concept` section that asks for an optional top-level `background_concept` field with concrete scene-vs-mood guidance + examples. `generate_overlays` now returns `tuple[list[OverlaySpec], Optional[str]]` (specs + bg_concept). `_validate_background_concept` normalizes the LLM output (lowercase, single-spaced, punctuation stripped), enforces 2-5 words + ≤50 char cap, returns None on any failure. `_build_storyline_overlays` returns a 3-tuple `(shots, method, bg_concept)`. `run()` reorders so the LLM director fires BEFORE bgv resolution; the bgv chain now tries `user URL → LLM concept → heuristic concept → downgrade` (was `user URL → heuristic concept → downgrade`). Both LLM + heuristic share the same `find_b_roll` cache, so cache hits short-circuit the second Pexels call when both concepts yield the same query. `extra_metadata.bgv_source` extended with `auto_pexels_llm` / `auto_pexels_heuristic` variants for audit, and `extra_metadata.bgv_concept` records the concept that actually fed Pexels (debugging "why did this reel pick THIS clip?"). 18+ inline validator tests cover happy paths (normalization, word-count boundaries, char-count boundaries), rejections (1 word, 6+ words, 51+ chars, non-string, list, dict, None), and signature contracts (return types, run() unpacking, LLM-tried-first ordering).

✅ **AI emoji injection on caption keywords (Phase 2c.7)** — the existing /preview LLM call now optionally returns an `emojis` array parallel to `importance`, with `""` entries for most words and a single emoji ("💰", "📈", "⚡", "👥", "🔒", "⚠️" …) for 0-3 hand-picked keywords per reel. The system prompt gives the LLM examples and an explicit ceiling so it doesn't carpet-bomb. `_validate_emojis` filters defensively: drops entries containing ASCII letters/digits (LLM tried to emit a text label), rejects strings >4 codepoints (catches "emoji walls" that occasionally slip through when the LLM misreads the schema), caps the total at `MAX_EMOJIS_PER_REEL=3`. The emoji field threads through `_Word.emoji` → `EnrichedPayload.word_importance[].emoji` → `WordImportance` schema + router constructor → API response → the two word-dict builders in `reels_director_service.py` → `_build_caption_block_html`. The renderer appends a small emoji span AFTER the tagged word's main span, with its own `emoji-pop` keyframe (scale 0.3 → 1.4 overshoot → 1.0 + slight rotation) delayed 150ms after the word's karaoke-reveal so the emoji punches as a punchline rather than competing with the word. `-webkit-text-stroke:0` reset on the emoji span — the caption block's inherited stroke harms emoji rendering. FE preview tray's `WordImportanceTimeline.tsx` now also surfaces the emoji next to each tagged word so the user sees what's coming in the render. Heuristic-fallback path emits no emojis (a static word→emoji map looks robotic; LLM context-awareness is what makes the tagging feel intentional). HTML-escaping of the emoji slot defends against LLM injection of stray markup. 15+ inline validator + renderer tests cover happy paths, length cap, ASCII-leak rejection, ZWJ family rejection, cardinality cap, length-mismatch graceful-degrade, missing-field graceful-degrade, and HTML escaping. Deep-review bugfixes from Slice 7: (1) `WordImportance` Pydantic schema + router constructor now carry `emoji` end-to-end (was silently dropped on serialization since Pydantic's default `extra='ignore'` discards unknown fields); (2) system prompt no longer references `keyword_type` (a field the LLM doesn't see — set server-side by deterministic floors); (3) `WordImportanceTimeline` displays the emoji inline so users can preview render decisions in the tray.

✅ **LLM Director hardening (Phase 2c.1)** — earlier deploys showed Haiku occasionally emitting hook + loop_back but skipping `micro_hook`, leaving a 24s reel with no midpoint re-engagement beat. Two fixes: (1) prompt now declares hook + micro_hook + loop_back **REQUIRED** with an explicit "deterministic fallback will fill the slot — your tailored text is better" nudge. (2) New `_fill_missing_required` in `reels_llm_director_service.py` synthesizes any missing structural slot from `word_importance_reel_time` — hook from the working title (uppercased, ≤6 words), micro_hook from the highest-importance non-stopword in the middle 30-65% of the reel (1.5s window, color-coded by importance), with a generic `WAIT FOR IT` fallback when no word qualifies. Loop_back is intentionally NOT synthesized (a weak loop-back is worse than none; the scorer's Loop axis gives a good baseline). The fallback only runs when the LLM produced ≥1 valid spec — fully-empty LLM result still triggers the outer "deterministic single hook" path. Stopword list deduped from preview service's `STOPWORDS`. 6/6 inline synthesis tests pass.

✅ **`/preview` credit metering (Phase 2c.2)** — `/preview` was previously free; now wired through the existing `CreditService` infrastructure. New `reels_preview` entry in `DEFAULT_PRICING` (same rates as `content`). Router does a pre-flight `check_credits` for `cache-miss-count × ~2000 tokens` and returns 402 on insufficient balance. After successful enrichment we `deduct_credits` based on successful-LLM-pick count × fixed estimate (1500 prompt + 500 completion). Cache hits and failed picks are NOT billed. `batch_id` set to `input_asset_id` so all previews for an asset roll up in the transaction history. Deduct failures log but don't fail the response — the user has their result, we don't punish them for our tracking glitch.

✅ **Stacked layout — `stacked_speaker_with_broll` (Phase 2c.3)** — speaker top half, user-supplied b-roll bottom half. Per research §12.3 this dual-attention anchoring holds attention 30-45% longer than single-frame for slower beats. Director emits a `<div>` flex-column wrapping two `<video>` elements (speaker on top via `<video data-source-clip>`, bgv on bottom with `loop muted autoplay`). Bgv is Playwright-fetched at render time — no extra source_video_urls plumbing. Captions auto-shift via `_CAPTION_BOTTOM_PCT_BY_LAYOUT` from `bottom:18%` (full-speaker) to `bottom:53%` (stacked) so they sit on the speaker half above the split. Missing/invalid bgv URL → silent fallback to `full_speaker_with_overlays` (tracked in `extra_metadata.effective_layout`). FE: layout chip in `RenderConfigPanel`, conditional bgv URL input, soft-validation in `PreviewTray.handleRender`. New shared `_resolve_http_url` helper applies the http(s)-only gate (defense in depth — Playwright would happily fetch `file://`).

✅ **PiP layout — `pip_corner_speaker` (rectangular)** — speaker in a bottom-right 32%-wide rounded-corner window (border-radius + drop-shadow), bgv fills the rest of the frame. Same plumbing as stacked: required `background_video_url`, fallback to full-speaker when missing, layout chip in FE. Captions shift to `bottom:42%` so they clear the PiP's top edge (PiP's bottom-right footprint spans ~y=60-92% in a 1080×1920 frame). True alpha-matte cutout-style PiP is deferred to Phase 2d — it requires re-running `extractor/podcast_visual.py` per reel window (~30s GPU/CPU per render), which warrants its own roll-out + caching strategy.

✅ **B-roll auto-fetch (Phase 2c.4)** — closes the "what URL do I paste" friction on stacked + PiP layouts. New `reels_broll_service.py` exposes `extract_concept(word_importance_reel_time)` (picks highest-importance non-stopword + non-bare-number content word, with `keyword_type` tags getting +5 score boost) and `find_b_roll(concept)` (async wrapper around the existing `PexelsService.search_videos`, runs in `asyncio.to_thread` since PexelsService is sync). Per-process LRU cache (256 entries) keyed on `(concept, orientation, min_duration_s)` so re-renders from the same source word reuse the same clip — visual consistency across reels. DIRECTOR's layout-resolution block now tries auto-fetch BEFORE falling back to full-speaker: `(user URL)` → `(auto Pexels)` → `(downgrade to full_speaker)`. `extra_metadata.bgv_source` records which path fired (`user_url` / `auto_pexels` / `none`) for audit. FE adds a "B-roll source" Auto/URL toggle inside LayoutGroup; Auto is the default. URL-mode validation only fires when `bgv_source === 'url'` — Auto mode passes through. Direct Pexels URL embedded in the timeline (no S3 mirror this round); Playwright fetches at render time. Requires `PEXELS_API_KEYS` env (comma-separated for round-robin). Empty key list → silent fallback to full-speaker.

✅ **Per-phrase b-roll overlays (Phase 2c.5 Slice 1)** — the LLM director now decides **when** and **what kind** of media to overlay, not just whether to add full-frame bg. Two new spec types — `broll_video` (Pexels stock video) and `broll_image` (Pexels stock photo) — joined the existing hook / micro_hook / loop_back / emphasis text overlays in `OverlaySpec`. Prompt teaches the LLM the picking criteria: concrete noun → image (logos, named entities); concept with implied motion → video (places, activities, scenes); emotional / abstract / personal beats → skip entirely. Hard validation: concept is 1-4 words ≤40 chars; duration 1.2-3.5s; position ∈ {full, corner, lower_third}; cardinality cap of 3 total non-text visual overlays per reel; visuals cannot land in the hook window (first 2.6s) or loop_back window (last 1.5s); visuals cannot overlap any structural text overlay (hook / micro_hook / loop_back) or another visual. Director's storyline-build pre-fetches all media concepts in parallel via `asyncio.gather` over `find_b_roll` / `find_b_roll_image` — fan-out per render, one network RTT total. Failed Pexels lookups silently drop the spec; rest of the reel still ships. New `Z_BROLL_MEDIA=200` band: media sits above the base speaker_clip but below text overlays (z=500+) and captions (z=8000+), so text always reads on top regardless of position. `_MEDIA_POSITION_CSS` handles full (cover frame) / corner (top-right PiP-style with rounded corners + shadow) / lower_third (bottom strip).

✅ **Stat cards + motion graphics (Phase 2c.5 Slice 2)** — two new OverlaySpec types. `animated_stat` is a big bouncing number ("47%", "2×", "14 YEARS") with optional subtitle line; CSS-keyframed `stat-pop` entry (scale 0.35 → 1.12 overshoot → 1.0 over 480ms), color-coded by `color_intent` from the caption palette. `motion_graphic` is a chart family — Slice 2 shipped `bar_chart` (see Slice 3 below for the rest). All four non-text-visual types (`broll_video` + `broll_image` + `animated_stat` + `motion_graphic`) share one cardinality cap of 3 total per reel, the same hook + loop_back protection windows, and the same no-overlap-between-visuals rule. Both stat/graphic kinds render entirely from spec fields — **no Pexels, no network** — so they're free to use as often as the LLM thinks they fit. Validator coerces stringy bar values (`"250k"` → 250.0) so the LLM can be lenient with units. Subtitle truncates at 32 chars rather than rejecting — a clipped subtitle is better than no stat. Prompt teaches the picking criteria: `animated_stat` when ONE specific number is the punchline; `motion_graphic` only when the claim's STRUCTURE (comparison / trend / proportion / contrast) is the lift. Deep-review bugfixes from Slice 2: bar-height now capped at 70% (was 100% of column → pushing labels off-screen); `lower_third` stat wrapper moved to `bottom:30%` (was at `bottom:18%` colliding with captions).

✅ **More motion_graphic kinds (Phase 2c.5 Slice 3)** — three new `graphic_kind` variants under the same OverlaySpec wrapper, dispatched through `_build_motion_graphic_html`. `line_chart` (2-5 points, numeric) — SVG polyline with `stroke-dasharray` / `stroke-dashoffset` line-draw animation over 700ms, then point dots + value labels fade in staggered behind the draw cursor; viewBox 0-100 + `preserveAspectRatio="xMidYMid meet"` keeps stroke widths and circle radii undistorted at any wrapper aspect; inner div sets its own `aspect-ratio` (16/10 full / 1/1 corner / 16/9 lower_third) so the SVG renders at `corner` position where the wrapper has no explicit height. `pie_chart` (2-4 wedges, numeric) — CSS `conic-gradient` with cumulative-percentage stops, scale + rotate `pie-pop` entry, percentage legend with color dots fading in 80ms apart; wedge palette cycles through caption-yellow / definition-green / warning-red / complementary-blue for visual distinction regardless of `color_intent`. `comparison_icons` (exactly 2, values OPTIONAL) — two flex cards with slide-in-from-side entry, centered VS pill with pop-in delayed 220ms; values render above labels when > 0, label-only when 0/missing (the qualitative case). Per-kind validation rules live in one `_GRAPHIC_KIND_SPECS` dict in the LLM director (min/max bars, values_required, max_label_len per kind) — adding a 5th kind is one dict entry + one renderer branch. Per-position sizing tables in each renderer (font sizes / disc widths / aspect ratios scale by full vs corner vs lower_third). System prompt updated with use-case guidance per kind: line_chart when the SHAPE of the curve is the punchline; pie_chart when one whole splits into proportions; comparison_icons when the contrast IS the point and exact numbers don't apply. Smoke tests pass on all 12 (kind × position) combos + edge cases (empty bars / unknown kind → empty fragment). Deep-review bugfixes from Slice 3: (1) line_chart with all-equal values now sits at the chart midline (y=48 in viewBox units) — the previous code dropped through to a divide-by-zero fallback that pinned the flat line to the bottom (y=78); (2) bar_chart inner div now carries `min-height:22vh` — load-bearing at `corner` position where the wrapper has no explicit height (latent from Slice 2; bars rendered at 0px because `height:var(--vx-target-h)` had no resolvable parent height to compute %-against). `vh` is critical over `vw`: `22vh` exactly matches the `lower_third` wrapper's `height:22%` in any aspect (no overflow); `22vw` would have overflowed in 16:9 (22% × 1920 = 422px vs 36% × 1080 = 388px full-wrapper); (3) validator now rejects `inf` / `nan` bar values via `math.isfinite` — these would otherwise reach SVG/CSS as literal "inf" text and broken geometry.

✅ **Scan settings strip** — `features/vimotion/reels/create/ScanSettingsStrip.tsx` sits above the candidate grid. Target duration (15/25/45/60s chips), candidate count (10/20/30/50 chips), and topic keywords (chip-input — Enter/comma commits, X removes, Backspace on empty removes last, soft-cap at 10). Changing any chip triggers a fresh `/scan` (TanStack Query re-keys on the params, busts the 1h server cache via `config_hash`). Selected `previewIds` reset on change so they don't reference stale candidate UUIDs.

✅ **`/render` idempotency** — backend computes a `render_config_hash` from the RenderRequest body (minus input_asset_id) and stashes it inside `AiReel.config["render_config_hash"]`. Before creating a new reel row, `AiReelRepository.find_active_for_candidate(institute, candidate, hash)` looks up any non-terminal reel (PENDING/IN_PROGRESS) with the same key and returns it instead of dispatching a duplicate render. COMPLETED/FAILED reels are NOT matched. FE adds a ref-based guard (`renderingCandidateRef`) so a sub-tick double-click is a no-op before the network call even fires.

### Validation

- All inline smoke tests pass (synthetic + real `video_context.json` from staging)
- Full TS typecheck on admin-dashboard: **0 errors**
- All Python files compile clean
- End-to-end pipeline validated with stubbed I/O (5 candidates → 5 reels through the full 7-stage orchestrator)
- Real S3 ffmpeg HTTPS-seek validated against canonical Steve Jobs source

---

## 7. What's pending (Phase 2+)

### Visual / pipeline

🔲 **B-roll polish — S3 mirror** — LLM concept extraction shipped in Phase 2c.8 (see §6). Still pending: S3-mirroring Pexels results would give predictable CDN performance + relief from Pexels rate limits at scale. Worth doing once we observe a real Pexels rate-limit incident; deferred otherwise.

### Production hardening

🔲 **Path B validation against staging** — apply Flyway V245 to staging RDS, fire a real `POST /render` against a live indexed asset, watch a real MP4 land. Catches integration issues (S3 IAM, worker version mismatches, real render times). We've done this manually a few times in development; needs to be promoted to a smoke-test that runs against every deploy.

🔲 **Stuck-render reaper** — periodic job to mark PENDING > 10min as FAILED (catches the "initial flip failed silently" case from G8 review).

🔲 **Per-stage retry on transient failures** — currently FAILED is terminal. A worker hiccup forces full re-render even if the failure was at the final RENDER stage.

🔲 **`/render` partial UNIQUE index** — current idempotency check is in-app. Closes the "two requests inside DB roundtrip time" race that the application-level check can't catch. Needs a Flyway migration adding `UNIQUE (institute_id, parent_candidate_id, (config->>'render_config_hash')) WHERE status IN ('PENDING','IN_PROGRESS')`.

🔲 **Backend `/preview` rate-limit** — credit metering already gates total cost. A separate per-institute rate-limit (max N previews/min) would prevent runaway abuse on top of the per-call billing.

🔲 **`/preview` token-estimate refinement** — pre-flight check currently passes `prompt_tokens=N, completion_tokens=0` because `CreditCheckRequest` only has one token field. Under-estimates on models where output pricing > input pricing (e.g. Haiku $0.80/$4 per 1M). Fix needs `CreditCheckRequest` schema extension to split prompt/completion. Tail-risk: user with borderline balance gets a free preview when deduct's CAS update fails.

🔲 **pytest harness for scorer + preview** — lock current behaviors so future tuning doesn't silently regress (R14 from review carryover).

🔲 **Failed-render retry from FE** — currently the Failed page tells the user to pick another candidate. An explicit "Retry" button would re-fire `/render` with the same config (and a different render_config_hash if needed).

### Documentation

🔲 **Reels section in `docs/VIMOTION_FEATURE.md`** — the canonical Vimotion reference doc. Should mirror the existing Create/Recent/Assets/Avatars/Brand Kits tabs sections.

🔲 **Research appendix** — the 1500-word competitive scan + caption design + engagement-science research currently lives only in the planning doc. Worth extracting to a standalone research note for product/marketing reference.

---

## 8. How to test end-to-end

### Pre-reqs
1. Flyway V245 applied to the admin-core DB (run admin-core service or apply manually)
2. ai_service env: `RENDER_SERVER_URL` + `RENDER_SERVER_KEY` configured
3. ai_service S3 creds (`S3_AWS_*` + `AWS_BUCKET_NAME`)
4. ai_service `OPENROUTER_API_KEY` for `/preview` LLM enrichment (optional — falls back to heuristic)

### Path A — Local scorer dry run (zero risk)

```bash
# Validates: scorer logic + window selection + boundary refinement
# Does NOT validate: persistence, thumbnails, full render
cd vacademy_platform/ai_service
.venv/bin/python -c "
import json, sys; sys.path.insert(0, '.')
from app.services.reels_engagement_service import score_windows, ScoringRequest
# Drop in any video_context.json URL and score it locally
import httpx
ctx = httpx.get('https://vacademy-media-storage-public.s3.amazonaws.com/ai-input-videos/<your-asset-id>/video_context.json').json()
results = score_windows(ctx, ScoringRequest(target_duration_sec=25, scan_limit=10))
for c in results: print(c.rank, c.source_t_start, c.source_t_end, c.score.composite, c.transcript_snippet[:60])
"
```

### Path B — Full end-to-end against staging

```bash
# 1. Get an institute API key (Vimotion auto-provisions via useVimotionApiKey)
# 2. Pick a COMPLETED podcast asset
INPUT_ASSET_ID="<uuid-from-staging-db>"
INSTITUTE_API_KEY="<your-key>"
BASE="https://api.vacademy.com/ai-service/external/reels/v1"

# 3. Scan
curl -X POST "$BASE/scan" \
  -H "X-Institute-Key: $INSTITUTE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"input_asset_id\":\"$INPUT_ASSET_ID\",\"target_duration_sec\":25}" \
  | jq '.candidates[0:3] | .[] | {rank, source_t_start, source_t_end, composite: .score.composite, snippet: .transcript_snippet}'

# 4. Preview top 2 candidates
CANDIDATE_IDS='["<uuid1>","<uuid2>"]'
curl -X POST "$BASE/preview" \
  -H "X-Institute-Key: $INSTITUTE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"input_asset_id\":\"$INPUT_ASSET_ID\",\"candidate_ids\":$CANDIDATE_IDS}"

# 5. Render the top one
curl -X POST "$BASE/render" \
  -H "X-Institute-Key: $INSTITUTE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"input_asset_id\":\"$INPUT_ASSET_ID\",\"candidate_id\":\"<uuid1>\",\"aspect\":\"9:16\"}"

# 6. Poll status (watch stage progression)
REEL_ID="<from-render-response>"
watch -n 3 "curl -s '$BASE/$REEL_ID/status' -H 'X-Institute-Key: $INSTITUTE_API_KEY' | jq"

# 7. When status=COMPLETED, download the MP4
curl -s "$BASE/$REEL_ID" -H "X-Institute-Key: $INSTITUTE_API_KEY" \
  | jq -r '.s3_urls.video' \
  | xargs curl -o reel.mp4
open reel.mp4
```

### FE manual QA

1. `pnpm dev` on `frontend-admin-dashboard`
2. Log into `/vim/login`
3. Land on `/vim/dashboard` — see "Reels" tab in sidebar (Scissors icon)
4. Click Reels tab — empty state with "Create your first reel" CTA
5. Click Assets tab — open a completed podcast — "Create Reels from this" button at bottom of detail panel
6. Click it — lands on `/vim/reels/new?fromAssetId=...` — scan runs immediately
7. Multi-select 2-3 candidates — bottom bar shows "N selected · Preview selected"
8. Click Preview — drawer slides up, LLM enrichment runs, enriched cards render with timelines
9. Click "Render this clip" — toast → navigate to `/vim/reels/$reelId`
10. Watch stage progression: AUDIO_EDIT → ... → RENDER → COMPLETED
11. MP4 plays inline in correct aspect — "Open in editor" / Download / Delete CTAs

---

## 9. Known limitations

| Limitation | Workaround | Fix |
|---|---|---|
| Initial DB-write failure during render leaves row PENDING forever | Manual DB cleanup; check ai_service logs | Phase 2: stuck-render reaper job |
| STYLE_GUIDE / HTML stages are no-op (5pp + 30pp progress bands) | Visual progress jumps in those bands | Phase 2b: extract palette; split HTML from DIRECTOR |
| PiP renders as rectangular window, not alpha-matte cutout | Visual is still useful; cutout would be cleaner | Phase 2d: re-run `extractor/podcast_visual.py` per reel window + cache the alpha webm |
| Failed renders aren't retryable from FE | Pick another candidate from same source (linked from Failed page) | Phase 2: explicit retry endpoint |
| Backend stuck on demo-mode source asset | `_validate_source_asset` rejects with 400 — clear error message | Phase 2+: demo-mode-tuned scorer |
| `/render` idempotency check has a sub-RTT race window | Not user-reachable from a button; FE ref-guard catches double-clicks | Partial UNIQUE index migration |
| `/preview` pre-flight credit estimate undercounts on model-priced rates | Worst case: borderline-balance user gets a free preview when deduct's CAS fails | Schema extension to split prompt/completion in CreditCheckRequest |
| Pexels b-roll fetched directly from `videos.pexels.com` at render time | Playwright fetches per render; slower + counts against Pexels rate limits | Phase 2c.5 follow-up: S3 mirror with TTL cache |

---

## 10. Reuse map (what we DON'T own)

| Existing | Where | How reels uses it |
|---|---|---|
| Indexing artifacts | `extractor/pipeline.py` | Read `video_context.json` for transcript / prosody / face_segments |
| Free-region computation | `extractor/full_video_face.py:_compute_free_regions` | Available for Phase 2 PiP layout |
| Audio slicing/splicing | `extractor/audio_ops.py` | Reference for cut+splice patterns; we use ffmpeg directly |
| Render worker contract | `render_worker/generate_video.py` | No changes — worker already handles SOURCE_CLIP entries |
| RenderService HTTP client | `app/services/render_service.py` | Reused as-is in `reels_render_finalize_service` |
| S3Service | `app/services/s3_service.py` | Reused for uploads in audio/source-clip/assemble/thumbnail services |
| Editor | `frontend-admin-dashboard/src/components/ai-video-editor/*` | No backend-side changes; FE wires editor search params |
| Vimotion shell | `features/vimotion/dashboard/*` | Reels added as 6th tab; no refactor |
| AssetsTab patterns | `features/vimotion/dashboard/AssetsTab.tsx` | ReelsTab mirrors structure (filter chips, polling, status badges) |
| `useVimotionApiKey` | `features/vimotion/dashboard/hooks/` | All reels API calls use it |

The new code is **purely additive** to the existing Vimotion + ai_service infrastructure. No existing files were rewritten, only modified in surgical ways (AssetDetailPanel footer, tabsConfig/Sidebar/DashboardLayout for the new tab).

---

## 11. Files reference

### Backend (`vacademy_platform/ai_service/`)

```
app/
├── migrations/
│   └── add_ai_reels_tables.sql                      ← source of truth
├── models/
│   ├── ai_reel.py
│   └── ai_reel_candidate.py
├── repositories/
│   └── ai_reel_repository.py
├── routers/
│   └── reels.py                                     ← funnel + frame endpoints
├── schemas/
│   └── reels.py                                     ← Pydantic
└── services/
    ├── reels_engagement_service.py                  ← /scan scorer
    ├── reels_thumbnail_service.py                   ← per-candidate posters
    ├── reels_preview_service.py                     ← /preview + cut planner
    ├── reels_render_orchestrator.py                 ← 7-stage runner
    ├── reels_audio_edit_service.py                  ← AUDIO_EDIT
    ├── reels_source_clip_service.py                 ← SOURCE_CLIP
    ├── reels_director_service.py                    ← DIRECTOR
    ├── reels_assemble_service.py                    ← ASSEMBLE
    ├── reels_render_finalize_service.py             ← RENDER
    ├── reels_frame_service.py                       ← editor /frame/{add,update,delete}
    ├── reels_llm_director_service.py                ← LLMDirector + 8 OverlaySpec types
    └── reels_broll_service.py                       ← Pexels search + LRU cache (videos + photos)
```

### Flyway (`vacademy_platform/admin_core_service/src/main/resources/db/migration/`)
- `V245__Create_ai_reels_tables.sql` — deployment copy of the migration

### Frontend (`vacademy_platform/frontend-admin-dashboard/src/`)

```
features/vimotion/reels/
├── services/
│   └── reels-api.ts                                 ← typed HTTP client
├── hooks/
│   ├── useReelsList.ts
│   ├── useScan.ts
│   ├── usePreview.ts
│   ├── useRender.ts
│   └── useReel.ts
├── create/
│   ├── CreatePage.tsx                               ← state machine + scan-config state
│   ├── AssetPickerStep.tsx
│   ├── ScanResultsGrid.tsx
│   ├── ScanSettingsStrip.tsx                        ← target dur + scan limit + topic keywords
│   ├── ReelCandidateCard.tsx
│   ├── PreviewTray.tsx                              ← Gate 2 drawer + render config state
│   ├── RenderConfigPanel.tsx                        ← aspect / layout / pace / captions / audio / bgv
│   └── WordImportanceTimeline.tsx
├── detail/
│   ├── ReelDetailPage.tsx                           ← status + completed views
│   └── StageProgressList.tsx
└── dashboard/
    └── CreateReelsCTA.tsx                           ← AssetDetailPanel footer button

routes/vim/reels/
├── new.tsx                                          ← Route + search-param validation
└── $reelId/index.tsx

routes/vim/edit/$videoId/
├── index.tsx                                        ← reads kind from search params (optional 'reel')
└── index.lazy.tsx                                   ← passes kind through to VideoEditorPage

components/ai-video-editor/stores/
└── video-editor-store.ts                            ← saveChanges switches frame URL on kind

features/vimotion/dashboard/
├── ReelsTab.tsx                                     ← list view
├── tabsConfig.ts                                    ← added 'reels' tab
├── Sidebar.tsx                                      ← added Scissors nav entry
├── DashboardLayout.tsx                              ← renders <ReelsTab/>
└── AssetDetailPanel.tsx                             ← edited footer
```

---

## 12. Maintainers

When changing:
- `app/schemas/reels.py` → must update `features/vimotion/reels/services/reels-api.ts` to match
- `STAGE_PIPELINE` in `reels_render_orchestrator.py` → must update `STAGE_ORDER` in `features/vimotion/reels/detail/StageProgressList.tsx`
- `app/routers/reels.py` endpoint paths → must update `BASE` in `reels-api.ts`
- The eligibility gate for reels (currently `kind=video && mode=podcast && status=COMPLETED`) lives in BOTH `app/routers/reels.py:_validate_source_asset` AND `features/vimotion/reels/dashboard/CreateReelsCTA.tsx`. Keep these in sync.
- The editor frame URL switch: the literal `'reel'` flag is set in THREE places — the route's `validateSearch` in `routes/vim/edit/$videoId/index.tsx`, the editor store's `EditorKind` type in `components/ai-video-editor/stores/video-editor-store.ts`, and `buildEditorSearch()` in `features/vimotion/reels/detail/ReelDetailPage.tsx`. Changing the literal means hitting all three.
- The `OverlaySpec.type` literal set is defined in `reels_llm_director_service.py` (`_TEXT_OVERLAY_TYPES`, `_MEDIA_OVERLAY_TYPES`, `_STAT_OVERLAY_TYPES`) AND mirrored as `_MEDIA_OVERLAY_TYPES_LOCAL` + `_STAT_OVERLAY_TYPES_LOCAL` in `reels_director_service.py`. Adding a new spec type means updating both modules + the prompt's example schema.
- The bgv "non-text visual" cardinality cap (currently 3) is read from `MAX_MEDIA_OVERLAYS` in `reels_llm_director_service.py` and ALSO referenced in the prompt's "no more than 3 visuals TOTAL" line. Keep the numeric value + prompt phrasing in sync.
- The `Layout` literal lives in BOTH `app/schemas/reels.py` (backend Pydantic) AND `features/vimotion/reels/services/reels-api.ts` (frontend TS). FE picker (`RenderConfigPanel.SHIPPED_LAYOUTS`) only exposes the shipped subset; the schema can be ahead.
- Layouts that require a `background_video_url` are listed in BOTH `reels_director_service.py:run()` (the auto-fetch trigger) AND `RenderConfigPanel.tsx:LAYOUTS_REQUIRING_BGV`. Same condition in both places — keep them in lockstep when adding a new layout.
- The `motion_graphic` `graphic_kind` enum lives in `_GRAPHIC_KIND_SPECS` in `reels_llm_director_service.py` (validation rules — bar counts, value requirements, label cap) AND in the `_build_motion_graphic_html` dispatcher in `reels_director_service.py` (one renderer branch per kind). Adding a 5th kind means a dict entry + a renderer function + a sentence in the LLM prompt's "When to use which visual type" section. The prompt's schema example lists the kinds as a `|`-separated union — keep that list current too.
- Caption emoji injection (Phase 2c.7) is wired across FIVE files: `reels_preview_service.py` defines the validation rules (`MAX_EMOJIS_PER_REEL`, `MAX_EMOJI_LEN`, `_EMOJI_REJECT_RE`) + the system prompt's emoji guidance; the `EnrichedPayload.word_importance[].emoji` field carries it through to the candidate row; `reels_director_service.py`'s two word-dict builders (caption pre-remap + post-remap) must pass `emoji` through, and `_build_caption_block_html` renders the emoji span with its own `emoji-pop` keyframe. ALSO: the `WordImportance` Pydantic schema in `app/schemas/reels.py` AND the `WordImportance(...)` constructor in `app/routers/reels.py:get_candidate` must both carry `emoji=w.get("emoji")` or the API silently drops it (Pydantic's default `extra='ignore'`). The FE `WordImportance` TS interface in `features/vimotion/reels/services/reels-api.ts` must match. Skipping any step silently drops emojis without failing the render.

Add new render stages by:
1. Creating a `reels_<stage_name>_service.py` that calls `register_stage_handler(STAGE_X, _x_stage)` at module scope
2. Adding the import to `register_all_stages()` in `reels_render_orchestrator.py`
3. Adding the StageDef to `STAGE_PIPELINE`
4. Adding the stage label + hint to FE `STAGE_ORDER` in `StageProgressList.tsx`
