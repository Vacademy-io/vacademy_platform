# Reels from Long Video — Feature Reference

**Status**: Backend Phase 1 + 2a (karaoke captions) + 2c (LLM-driven Director) shipped. Backend Phase 2 (editor `kind=reel` frame save endpoints, `/render` idempotency) shipped. Frontend Phase A (Slices 1-5) shipped. Source-clip aspect canvas now scales to canonical delivery dims (1080×1920 for 9:16).
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
- `reels_llm_director_service.py` — Phase 2c LLM-driven storyline overlays (`hook` / `micro_hook` / `loop_back` / `emphasis`); falls back to deterministic hook overlay on any failure

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
| AUDIO_EDIT | 0-15% | Single ffmpeg `filter_complex`: `atrim×N → concat → atempo`. Stream-copies kept spans, applies speed_multiplier (1.0-1.5), uploads MP3 |
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

### Validation

- All inline smoke tests pass (synthetic + real `video_context.json` from staging)
- Full TS typecheck on admin-dashboard: **0 errors**
- All Python files compile clean
- End-to-end pipeline validated with stubbed I/O (5 candidates → 5 reels through the full 7-stage orchestrator)
- Real S3 ffmpeg HTTPS-seek validated against canonical Steve Jobs source

---

## 7. What's pending (Phase 2+)

### High-value, medium-effort

✅ **LLM-driven DIRECTOR (Phase 2c)** — `reels_llm_director_service.py` introduces `LLMDirector.generate_overlays()` which calls Haiku-class (default `anthropic/claude-3-5-haiku`, overridable via `REELS_DIRECTOR_LLM_MODEL`) with `REEL_DIRECTOR_SYSTEM_PROMPT` and gets back a list of `OverlaySpec{type, t_start, t_end, text, color_intent}`. Hard validation: hook starts ≤0.3s and ends ≤2.6s; micro_hook lands in 30-70% of reel; loop_back is in the last 1.5s; emphasis (max 2) is anywhere inside the reel; all overlays ≤6 words / ≤60 chars / 0.5-4.0s duration; CTA kill-phrases (`follow me`, `subscribe`, `link in bio`, …) reject the overlay. Spec→`_Shot` mapping in `_OVERLAY_STYLE_BY_TYPE` + `_OVERLAY_COLOR_BY_INTENT` gives each type a distinct visual treatment (font weight, top position, color from the caption palette). On LLM failure / disabled / empty response → deterministic single-hook fallback (Phase 1 behavior). Disable via env `REELS_LLM_DIRECTOR_DISABLED=1`. Method (`llm` vs `deterministic_fallback`) is recorded on `AiReel.extra_metadata.director_overlay_method` so we can audit usage.

🔲 **Path B validation against staging** — apply Flyway V245 to staging RDS, fire a real `POST /render` against a live indexed asset, watch a real MP4 land. Catches integration issues (S3 IAM, worker version mismatches, real render times).

### Medium-value, smaller-effort

🔲 **Audio ducking + whoosh SFX** — research §12.2 says these lift retention. Audio-side filter graph extension in AUDIO_EDIT.

🔲 **STYLE_GUIDE palette extraction (Phase 2b)** — auto-theme keyword colors from speaker_clip dominant colors instead of hard-coded Hormozi yellow. **Risk**: Hormozi yellow is the proven retention winner per §12.4; auto-extraction could underperform without A/B testing.

🔲 **PiP layout (alpha matte)** — speaker as alpha-matted corner overlay. Requires on-demand matting compute via `extractor/podcast_visual.py` + `encode_alpha_webm` for the chosen window.

🔲 **1:1 aspect** — config schema already supports it; just needs `_compute_crop` validation + FE option.

🔲 **B-roll auto-insertion** — Pexels/Storyblocks search keyed on transcript concepts. Director places stock footage during emphasized phrases.

🔲 **AI emoji injection** — sentiment-loaded keyword emoji per OpusClip's pattern.

🔲 **Stacked layout** (speaker top + gameplay/satisfying b-roll bottom) — research §12.3 says dual-attention anchoring holds 30-45% longer.

### Low-effort polish

🔲 **pytest harness for scorer + preview** — lock current behaviors so future tuning doesn't silently regress (R14 from review carryover).

🔲 **Per-stage retry on transient failures** — currently FAILED is terminal. Worker hiccup forces full re-render.

✅ **`/render` idempotency** — backend computes a `render_config_hash` from the RenderRequest body (minus input_asset_id, which is implied by the candidate FK) and stashes it inside `AiReel.config["render_config_hash"]`. Before creating a new reel row, `AiReelRepository.find_active_for_candidate(institute, candidate, hash)` looks up any non-terminal reel (PENDING/IN_PROGRESS) with the same key and returns it instead of dispatching a duplicate render. COMPLETED/FAILED reels are NOT matched — the user can still re-render after a failure or after a code fix lands. FE adds a ref-based guard (`renderingCandidateRef`) so a sub-tick double-click is a no-op before the network call even fires. Residual race: two requests landing within DB roundtrip time can still produce two rows; closing that requires a partial UNIQUE index (deferred — not user-reachable from a button).

🔲 **Stuck-render reaper** — periodic job to mark PENDING > 10min as FAILED (catches the "initial flip failed silently" case from G8 review).

🔲 **`/render` config form on PreviewTray** — currently uses defaults (9:16, 25s, hormozi captions, keep_speaker). Slice 4 was supposed to add a config drawer; deferred.

🔲 **Backend "/preview" rate-limit + credit consumption** — currently `/preview` is fast + cheap (one LLM call per pick) but not billed. Real production should meter.

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
| `/render` not idempotent — double-click creates 2 reels | FE button disables during mutation; user discipline | Phase 2 polish: idempotency-key header |
| Initial DB-write failure during render leaves row PENDING forever | Manual DB cleanup; check ai_service logs | Phase 2: stuck-render reaper job |
| STYLE_GUIDE / HTML stages are no-op (5pp + 30pp progress bands) | Visual progress jumps in those bands | Phase 2: extract palette; split HTML from DIRECTOR |
| LLM-Director is template-based (no per-shot variety, no b-roll) | Reels still ship with hook overlay + karaoke captions | Phase 2c: full LLM director |
| PiP layout not supported | Use full_speaker_with_overlays | Phase 2: on-demand alpha matting |
| 1:1 aspect not exposed in FE | Use 9:16 or 16:9 | Phase 2: surface in config |
| Failed renders aren't retryable from FE | Pick another candidate from same source (linked from Failed page) | Phase 2: explicit retry endpoint |
| Backend stuck on demo-mode source asset | `_validate_source_asset` rejects with 400 — clear error message | Phase 2+: demo-mode-tuned scorer |

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
    └── reels_llm_director_service.py                ← LLMDirector + OverlaySpec (Phase 2c)
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
│   ├── CreatePage.tsx                               ← state machine
│   ├── AssetPickerStep.tsx
│   ├── ScanResultsGrid.tsx
│   ├── ReelCandidateCard.tsx
│   ├── PreviewTray.tsx                              ← Gate 2 drawer
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

Add new render stages by:
1. Creating a `reels_<stage_name>_service.py` that calls `register_stage_handler(STAGE_X, _x_stage)` at module scope
2. Adding the import to `register_all_stages()` in `reels_render_orchestrator.py`
3. Adding the StageDef to `STAGE_PIPELINE`
4. Adding the stage label + hint to FE `STAGE_ORDER` in `StageProgressList.tsx`
