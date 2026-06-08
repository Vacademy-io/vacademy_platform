# Vimotion Studio — Multi-Asset Video Editing Pipeline

**Status**: P6b shipped 2026-06-08 — **captions** complete the Overlays step. `propose_captions` (deterministic, free+) proposes a caption config ({enabled, preset}) from the project preference; the user toggles it in OverlaysStep. A new `ASSEMBLE_WORDS` build stage (gated on captions enabled) remaps each kept clip's indexed word-transcript onto the composed timeline (`studio_words_track`, driven off the SOURCE_CLIP entries so it can't drift) → uploads `words.json` → `s3_urls.words`; the editor deep-link passes `wordsUrl` (caption preview) and the render passes `--captions-words`. The full Overlays step (titles + text + captions) is now done across free→premium tiers. Next: P7 (Audio).

**Status (P6a)**: 2026-06-08 — the **Overlays** wizard step went live (titles + text overlays). `propose_titles` + `propose_text_overlays` (LLM, premium+) propose segment-anchored overlays; the user accepts/edits/refines/adds-manual; a new `COMPOSE_HTML` build stage appends them as z-layered overlay entries (bright-on-transparent, studio-native renderers in `app/services/edit_overlays/`) over the SOURCE_CLIPs. Wizard now runs ingest → arrangement → cuts → **overlays** → build. Captions (a words-track + render wiring) are deferred to **P6b**. This slice also fixed pre-P6 bugs: confirm now persists losslessly (was `exclude_none=True`, would corrupt overlay params), render is idempotent (in-flight guard), `update_on_render` merges metadata, image still-duration no longer derives from a bare `t_end`, and BuildStep shows all stages.
P5 (2026-05-29) closed the round-trip: a built timeline opens in the existing editor (`kind=studio`), `/frame/{add,update,delete,reorder}` persist edits, `POST /builds/{id}/render` renders to MP4. P4 (build pipeline), P3 (Cuts), P2 (Arrangement), P1.5 (advanced UI), P1 (CRUD), P0 (schema) all prior. Audio wizard step pending (P7).
**Audience**: engineers operating or modifying the Studio pipeline, the wizard, the build executor, or anything that consumes the per-build `time_based_frame.json`.
**Companion docs**: [VIMOTION_FEATURE.md](./VIMOTION_FEATURE.md), [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md), [REELS_FROM_VIDEO.md](./REELS_FROM_VIDEO.md), [VIDEO_EDITOR_REVIEW.md](./VIDEO_EDITOR_REVIEW.md), [RENDER_PIPELINE.md](./RENDER_PIPELINE.md), [INPUT_VIDEO_INDEXING.md](./INPUT_VIDEO_INDEXING.md).
**Design plan**: `/Users/shreyashjain/.claude/plans/vacademy-platform-docs-ai-content-vimot-generic-meerkat.md` (single source of truth for design decisions; this doc tracks the implementation).

---

## 1. What this is

Studio is the third Vimotion video pipeline. It takes a multi-asset input (N indexed videos + M indexed images, user-tagged with handles like `v1`, `v2`, `i1`) plus a free-form prompt, walks the user through a 5-step wizard where an LLM proposes operations per step and the user confirms them, and produces a fully-editable timeline that opens in the existing video editor for refinement and render.

The principle is **video editing as a sequence of LLM-orchestrated tools** — each tool is a composable primitive that does one thing well. The LLM picks which tools apply for a given prompt; the user confirms each step's output before the next step plans.

Builds are versioned snapshots. The user can re-plan and re-build any time; old builds and their editor sessions are preserved so users can switch between iterations without losing refinements.

---

## 2. Where it sits relative to existing pipelines

| Pipeline | Input | Output | Editor kind |
|---|---|---|---|
| **AI Video Generation** (`/external/video/v1/*`) | prompt | text→shots→render | `kind=ai` |
| **Reels from Long Video** (`/external/reels/v1/*`) | one indexed video | short reel | `kind=reel` |
| **Studio** (`/external/studio/v1/*`) | N indexed videos + M images + prompt | multi-asset edited video | `kind=studio` |

Studio reuses (rather than rebuilds) the render worker, the video editor, the indexing artifacts, the V200 stage model routing, and many overlay/caption renderers from reels.

---

## 3. Funnel + lifecycle

```
                          /vim/studio                          (project list)
                              │
                  ┌───────────┼───────────┐
                  ▼                       ▼
       /vim/studio/new          /vim/studio/$projectId         (project detail)
       (create wizard)          ├─ Build switcher (v1, v2, v3)
                                ├─ Per-build editor link
                                └─ "Re-plan" → re-opens wizard

Create wizard:
  Step 0  INGEST       Asset multi-select + auto-handle (v1/v2/i1) + prompt + target params
  Step 1  ARRANGEMENT  LLM call #1 → pick_segments + arrange_sequence
  Step 2  CUTS         LLM call #2 (sees Step 1) → detect_silences + detect_fillers + detect_off_topic
  Step 3  OVERLAYS     LLM call #3 (sees Steps 1+2) → titles, captions, motion graphics, reframe
  Step 4  AUDIO        LLM call #4 (sees Steps 1+2+3) → bgm, sfx, transitions
  Step 5  BUILD        Async 6-stage executor → AWAITING_EDIT → opens in editor

Editor handoff:
  /vim/edit/$buildId?kind=studio   (NEW editor kind; same VideoEditorPage)
    → /frame/* writes scoped to build_id
    → Render → MP4 in s3_urls.video

Re-plan flow:
  Project detail → "Re-plan" → wizard re-opens pre-filled with last ConfirmedPlan
  User changes any step → Build → forks Build N+1 alongside Build N
  Both builds keep their editor sessions; user picks which to "Publish"
```

---

## 4. Endpoints

Mounted at `{AI_SERVICE_BASE_URL}/external/studio/v1/*`. Auth via existing `X-Institute-Key`.

| Method · Path | Purpose | Cost | Status |
|---|---|---|---|
| `POST /projects` | Create project (assets + handles + prompt + targets) | free | **P1 wired** |
| `GET /projects` | List per institute (paginated: limit/offset/status/include_archived) | free | **P1 wired** |
| `GET /projects/{id}` | Full record (project + builds list) | free | **P1 wired** |
| `PATCH /projects/{id}` | Edit handles, prompt, targets, preferences, model_overrides | free | **P1 wired** |
| `DELETE /projects/{id}` | Soft delete (→ ARCHIVED) | free | **P1 wired** |
| `POST /projects/{id}/wizard/{step}/plan` | Run LLM for one wizard step | 1 LLM call | **P2 wired** (arrangement has tools; cuts/overlays/audio return empty until P3/P6/P7) |
| `POST /projects/{id}/wizard/{step}/confirm` | Persist `ConfirmedStepPlan` into `confirmed_plan[step]` | free | **P2 wired** |
| `POST /projects/{id}/wizard/{step}/refine` | Free-form refine prompt for the step | 1 LLM call | **P2 wired** |
| `POST /projects/{id}/builds` | Fork Build vN from ConfirmedPlan; dispatch executor | render | **P4 wired** |
| `GET /projects/{id}/builds` | List all builds for the project (paginated) | free | **P4 wired** |
| `GET /builds/{id}` | Full build record | free | **P4 wired** |
| `GET /builds/{id}/status` | Lightweight poll (status/stage/progress/live) | free | **P4 wired** |
| `POST /builds/{id}/publish` | Mark this build as the project's "published" one | free | **P4 wired** |
| `DELETE /builds/{id}` | Soft delete a build (409 if published) | free | **P4 wired** |
| `POST /builds/{id}/frame/{add,update,delete,reorder}` | Editor wire-up for `kind=studio` (build id in PATH) | free | **P5 wired** |
| `POST /builds/{id}/render` | Render to MP4 via worker (silent narration + intrinsic source audio) | render | **P5 wired** (⚠ staging verify) |

`{step}` ∈ `{arrangement, cuts, overlays, audio}`.

**Asset validation** (P1): `POST /projects` + `PATCH` (when `source_asset_refs` changes) run every referenced asset through `studio_asset_validator.validate_asset_refs` — checks existence, institute ownership, `status=COMPLETED`, and kind match. Per-asset failures return HTTP 400 with `detail.failures[]` so the FE picker can highlight the specific bad assets. Wrong-institute lookups return 404 (not 403) to avoid leaking cross-tenant existence.

---

## 5. Tool catalog

Two registers: **PLAN-TIME** (LLM emits structured specs; user confirms in wizard) and **BUILD-TIME** (executor consumes confirmed specs to build the timeline).

### 5.1 Plan-time tools — tier matrix

| Tool | Wizard step | Tier | Reuses |
|---|---|---|---|
| `pick_segments` | Arrangement | all | indexing transcript + scenes — **P2 (LLM)** |
| `arrange_sequence` | Arrangement | all | — — **P2 (LLM)** |
| `detect_silences` | Cuts | all | `prosody.pauses` — **P3 (deterministic)** |
| `detect_fillers` | Cuts | all | word-level transcript — **P3 (deterministic)** |
| `detect_off_topic` | Cuts | ultra+ | new LLM call (gated) — P8 |
| `propose_captions` | Overlays | all | deterministic config + `studio_words_track` remap — **P6b (wired)** |
| `propose_titles` | Overlays | premium+ | studio-native `edit_overlays/titles.py` — **P6a (LLM)** |
| `propose_text_overlays` | Overlays | premium+ | studio-native `edit_overlays/text_overlays.py` — **P6a (LLM)** |
| `propose_image_overlays` | Overlays | premium+ | image foreground assets |
| `face_track_reframe` | Overlays | premium+ | reels `_source_to_crop_time` + `face_segments` |
| `propose_motion_graphics` | Overlays | ultra+ | reels `_build_motion_graphic_html` |
| `propose_transitions` | Audio | premium+ | reels `_KNOWN_TRANSITIONS` + new mask transitions |
| `propose_bgm` | Audio | ultra+ | AI-video Lyria path + reels sidechaincompress |
| `propose_sfx` | Audio | ultra+ | reels `_compute_cut_points` + anoisesrc pink-noise |
| `change_aspect` | Ingest | all | reels source-clip face-aware crop |

Tier filter is server-side in `studio_tools.tools_for_step(step, tier, …)` — LLM never sees tools the user can't access (defense-in-depth re-checks at validation time).

### 5.2 Build-time executors

| Executor | Stage | Implementation source |
|---|---|---|
| `assemble_audio` | ASSEMBLE_AUDIO | lifts `reels_audio_edit_service.py` (single ffmpeg `filter_complex`) |
| `transcribe_words` | ASSEMBLE_WORDS | render-worker `/transcribe-jobs` on the stitched audio |
| `build_timeline` | ASSEMBLE_TIMELINE | SOURCE_CLIP/IMAGE_STILL entry per segment; tags `entry_meta.order_index` + emits `meta.segment_windows` |
| `compose_html` | COMPOSE_HTML | **P6a wired** — appends title/text overlay entries (z 500–8999, bright-on-transparent) resolved from `segment_windows`; reads `overlays.operations`+`manual_operations` by param shape |
| `assemble_words` | ASSEMBLE_WORDS | **P6b wired** — if captions enabled, fetches transcripts + `studio_words_track.build_words_track` → `words.json` → `s3_urls.words`. Best-effort (never fails the build) |
| `upload_artifacts` | UPLOAD | S3 PUT under `ai-studio/{build_id}/*` |
| `handoff` | HANDOFF | flips build → AWAITING_EDIT; FE polls and routes to editor |

Progress bands per stage will be documented here as executors land.

---

## 6. Data model

Three tables (all live in `ai_studio_*`):

- **`ai_studio_projects`** — persistent edit context; one row per project. Mutates as the user advances the wizard or re-plans. Carries `confirmed_plan` JSONB keyed by step. Status: `DRAFT | PLANNING | READY_TO_BUILD | BUILDING | PUBLISHED | ARCHIVED`.
- **`ai_studio_builds`** — versioned immutable snapshots per project. `plan_snapshot` is the frozen ConfirmedPlan at Build time. `version` monotonic per project (v1, v2, ...). Status: `PENDING | BUILDING | AWAITING_EDIT | RENDERED | FAILED`. Each build owns its own editor save state via the `/frame/*` endpoints.
- **`ai_studio_operation_logs`** — per-operation audit (which tool the LLM proposed, what the user did with it, whether it ended up applied).

FKs:
- `ai_studio_builds.project_id → ai_studio_projects.id` ON DELETE CASCADE
- `ai_studio_projects.published_build_id → ai_studio_builds.id` ON DELETE SET NULL
- `ai_studio_operation_logs.build_id → ai_studio_builds.id` ON DELETE CASCADE

Idempotency:
- `uq_studio_build_version (project_id, version)` — monotonic per project; catches double-submit races.
- `uq_studio_active_build (project_id, (config->>'render_config_hash')) WHERE status IN ('PENDING','BUILDING')` — prevents double-clicks creating Build N+1 AND N+2 from the same plan; slot reopens when build flips terminal.

Migration: `app/migrations/add_ai_studio_tables.sql` (source of truth); Flyway copy `V312__Create_ai_studio_tables.sql`.

---

## 7. Build versioning + editor handoff semantics

- **Each build is immutable** at the plan level — `plan_snapshot` is frozen at Build time. The project's `confirmed_plan` can mutate after without affecting the build's record of what it was built from.
- **Editor sessions are per-build** — `/frame/*` writes scope to `build_id`. Switching from Build v1 → Build v2 in the FE switches editor contexts; no cross-contamination.
- **Re-build forks** — clicking Build on a project with existing Build v1 creates Build v2 alongside; v1 stays intact. The user picks which is "Publish".
- **`published_build_id`** on the project points at the user-designated "this is the one" build. Updated atomically via `POST /builds/{id}/publish`.
- **Re-plan re-opens the wizard** — pre-populated from the most-recent `confirmed_plan`. User changes propagate when they click Build (forks a new build); just changing the plan without clicking Build doesn't affect existing builds.

---

## 8. What's shipped vs pending

### Shipped

- **P0 (2026-05-29)** — DB schema (source SQL + Flyway V312) + ORM models (`AiStudioProject`, `AiStudioBuild`) + repositories with the connection-retry pattern from `ai_reel_repository.py` + Pydantic schemas covering the full external contract + router with all endpoints returning HTTP 501 + router registered in `app_factory.py` + this doc skeleton. Post-review hardening added the full user-control surface (§13): `AssetOverrides`, `ProjectPreferences`, `ModelOverrides`, per-step tool constraints, operation reordering/skip, named/forkable builds, 16-field render contract, and list pagination.
- **P1 (2026-05-29)** — Projects CRUD wired end-to-end:
  - **Backend**: `POST/GET/GET-by-id/PATCH/DELETE /projects` real handlers in `routers/studio_projects.py`; `studio_asset_validator.py` (existence + institute-ownership + COMPLETED + kind checks, returns per-asset `failures[]`); `list_by_institute` gained `limit/offset` pagination; `preferences` + `model_overrides` persisted inside the project `config` JSONB; auto-derived project name from prompt; wrong-institute → 404.
  - **Frontend**: `studio-api.ts` typed client (full contract — projects wired, wizard/build/frame placeholders ready for P2+) + `useStudioProjects.ts` hooks (list/detail with adaptive polling, create/update/delete mutations) + Studio tab in the Vimotion dashboard (`tabsConfig`/`Sidebar`/`DashboardLayout`/`BottomTabBar`) + `StudioTab` list view + `WizardShell` stepper + `CreatePage` state machine + `IngestStep` (multi-select asset picker, auto-numbered editable handles v1/v2/i1, prompt, aspect + duration) + `ProjectDetailPage` + routes `/vim/studio/{index,new,$projectId}`.
  - **Verification**: backend AST + router-symbol resolution clean; design-lint clean; typecheck shows only route-tree-registration errors (resolve when `TanStackRouterVite()` regenerates `routeTree.gen.ts` on next `pnpm dev`/build — identical to how reels routes register).
  - **Deferred to P1.5 polish**: per-asset `AssetOverrides` UI + `ProjectPreferences` UI + `ModelOverrides` picker (all accepted by the backend already; IngestStep ships the core fields only).

- **P1.5 (2026-05-29)** — advanced user-control UI (all backend-accepted since P0):
  - `ProjectPreferencesPanel` (cut aggressiveness, caption preset, bgm/sfx policy, transitions, color hints, tone, notes) + `ModelOverridesPanel` (default + per-stage model picker via `useAIModelsList`) — collapsible sections in IngestStep.
  - `AssetOverridesEditor` per picked asset (initial range, exclude ranges, audio/video-only, speaker-face tag, note) with an "Edited" badge; `hasOverrides()` strips empty overrides before send.
  - IngestStep now threads `preferences` + `model_overrides` + per-asset `overrides` into `CreateProjectRequest` (empty objects stripped to null).
  - Also fixed 2 P1 review bugs: `AssetRef.asset_id` UUID-format validation (malformed → 422 not 500) + `_load_project_or_404` malformed-UUID guard (→ 404 not 500).
- **P2 (2026-05-29)** — Arrangement wizard step end-to-end:
  - **Backend**: `studio_asset_manifest.py` (fetches video_context/image_metadata, prunes transcript to ≤40 sampled sentences, clips to `initial_range_s`, echoes overrides/notes; degrades to a minimal digest on fetch/parse failure). `studio_tools/` registry with tier matrix + per-step enable/disable filter + `pick_segments` + `arrange_sequence` validators (drop bad items, clamp to durations). `studio_plan_service.py` — per-step LLM call (`response_format=json_object`, 3-attempt retry, fenced-JSON extraction), per-operation validation, **deterministic arrangement fallback** (keep-each-clip-whole in upload order) when the LLM is unavailable. Wizard `plan`/`refine`/`confirm` handlers wired in the router; `resolve_step_model` honors the project's `model_overrides` per step. `confirm` persists `ConfirmedStepPlan` into `confirmed_plan[step]` and flips status → PLANNING.
  - **Frontend**: `useWizardStep` hook (plan/refine/confirm mutations) + `ArrangementStep` (plans on entry, editable final-order list with move/remove, kept-segments list with reasons, refine-with-prompt box, confirm → advances to cuts) + `CreatePage` wires it into the wizard, passing image handles so stills render distinctly.
  - **Generic for free**: the same `plan`/`confirm`/`refine` handlers serve all four steps — cuts/overlays/audio return empty plans until their tools register (P3/P6/P7), no router changes needed then.
  - **Verification**: backend parses clean + tool registry verified live (tier/enable/disable filtering); design-lint clean; typecheck shows only route-tree-pending errors.

- **P3 (2026-05-29)** — Cuts wizard step, fully deterministic (no LLM cost on free→premium):
  - **Tool model extended**: `ToolSpec` gained an optional `detect(ctx)` callable. Tools are now either LLM-emitted (`validate` params) or deterministic (`detect` runs server-side). `plan_step` partitions specs, runs detectors first, calls the LLM only if LLM-tools exist for the step — so Cuts makes **zero** LLM calls in P3 (off-topic LLM detection is P8).
  - **`studio_cut_detectors.py`** — pure functions: `detect_silences` (prosody.pauses ≥ a min-duration that scales with `cut_aggressiveness`: light 2.0s / medium 1.0s / aggressive 0.6s) + `detect_fillers` (word-level transcript; conservative interjections um/uh/… by default, softer words + phrases like "you know" when aggressive). Both restrict to the kept arrangement ranges via `arrangement_segments(prior_steps)`. Unit-tested with synthetic context.
  - **`detect_silences.py` / `detect_fillers.py`** tool modules — register as deterministic (`detect=…`) with passthrough `validate` for confirmed-plan re-checks.
  - **Manifest with-raw**: `build_asset_manifest_with_raw` returns `(manifest, raw_contexts)` in one fetch pass so detectors get full prosody/words without a second download. `_plan_inputs` builds the `detect_ctx` (raw_contexts + arrangement segments + thresholds).
  - **Frontend**: `CutsStep` (plans on entry, ref-guarded; toggleable cut list with silence/filler/manual badges; per-cut remove; manual-cut adder; confirm rebuilds accepted-only `detect_*` ops + `manual_cut` in `manual_operations`). Wired into CreatePage (tracks `videoHandles`); advances to overlays.
  - **Also (P2 review fixes)**: plan-service default model → `anthropic/claude-3-5-haiku` (env override `STUDIO_PLAN_LLM_MODEL`); manifest fetches concurrent (`asyncio.gather`); ArrangementStep double-plan race fixed with a `useRef` guard (StrictMode-safe).

- **P4 (2026-05-29)** — Build pipeline (confirmed plan → editable timeline in S3):
  - **`studio_timeline_builder.py`** (pure, unit-tested) — `build_timeline(arrangement, cuts_plan, asset_kinds, source_urls, aspect, fps)` → `{meta, entries}`. Extracts the order from the confirmed arrangement; collects cut spans from the cuts step's `operations` + `manual_operations`; **merges overlapping spans** (the P3 silence∩filler overlap note) then subtracts them from each kept segment → one SOURCE_CLIP entry per surviving sub-segment (sub-frame slivers <0.15s dropped). Images become IMAGE_STILL entries (default 4s). Entries carry the render-worker contract (`shot_type`/`source_start`/`source_end`/`source_video_index`/`in_time`/`exit_time`) + `<video>`/`<img>` html with the source URL embedded for editor playback. `meta.source_video_urls[]` is the index→URL table. **Source clips keep intrinsic audio — no TTS/audio assembly stage** (Studio is editing, not generation).
  - **`studio_orchestrator.py`** (mirrors reels orchestrator) — `BuildContext`, `run_build` (3 stages: ASSEMBLE_TIMELINE → UPLOAD → HANDOFF, per-stage progress on the row, terminal AWAITING_EDIT via `update_on_handoff`, FAILED with stage-tagged error), GC-safe `dispatch_build`, `register_all_stages`.
  - **`studio_executors/`** — `build_timeline` (calls the builder; fails loud on zero entries) + `upload_artifacts` (S3 PUT `ai-studio/{build_id}/time_based_frame.json` off-loop via `asyncio.to_thread`).
  - **Router** — `POST /projects/{id}/builds` (forks from `from_build_id`'s snapshot or the project's confirmed plan; requires a confirmed arrangement; resolves per-asset source URLs + kinds; dedups in-flight via `render_config_hash`; dispatches the executor) + `GET /projects/{id}/builds` (paginated) + `GET /builds/{id}` + `GET /builds/{id}/status` + `POST /builds/{id}/publish` (only a built build; sets `published_build_id` + status PUBLISHED) + `DELETE /builds/{id}` (409 if it's the published build).
  - **Frontend** — `useStudioBuild` (create mutation + status polling) + `BuildStep` (Build CTA → stage-progress panel → AWAITING_EDIT "View project" / FAILED retry) + a 6th "Build" stepper entry. CreatePage routes cuts → build for P4 (overlays/audio slot in between when P6/P7 land).
  - **Verification**: timeline builder unit-tested (overlap-merge, sliver drop, stills, indexing, sequencing); full `run_build` exercised end-to-end with stubbed repo + S3 (3 entries assembled, uploaded, handoff recorded); design-lint clean; 0 real type errors.

- **P5 (2026-05-29)** — Editor handoff + render (round-trip closed):
  - **Prereq fix**: P4's timeline builder emitted `in_time`/`exit_time` (snake) but the editor + render worker read `inTime`/`exitTime` (camel) — fixed, + added the editor's `htmlStartX/Y/EndX/Y` geometry fields. (Render worker convention: timeline position = camelCase; `source_start`/`source_end`/`source_video_index`/`shot_type` = snake.) Source-clip `<video>` un-muted so intrinsic audio plays.
  - **`studio_frame_service.py`** (unit-tested) — S3 read-modify-write of the build's `time_based_frame.json`: `add_frame` (ordered insert / insert-after / append), `update_frame`, `delete_frame`, `reorder_frame`. Institute scope asserted via the parent project (cross-tenant → 404). Mirrors `reels_frame_service` + adds `reorder`.
  - **`studio_render_service.py`** (⚠ staging-verification-needed — ffmpeg + render worker can't run in dev) — fetches the timeline, generates a **silent master narration** (ffmpeg anullsrc, total_duration) since the worker requires `audio_url` while Studio's real audio is the source clips' own (browser-captured), uploads it, submits to the worker with `source_video_urls` + caption knobs, and **polls** to write `s3_urls.video` + flip → RENDERED (mirrors reels finalize; no callback endpoint).
  - **Router** — `/frame/{add,update,delete,reorder}` wired (sync service via `asyncio.to_thread`; errors mapped 404/409/400) + `POST /builds/{id}/render` (requires AWAITING_EDIT/RENDERED; 503 if render server unset).
  - **Frontend** — `EditorKind` gained `'studio'`; `saveChanges` routes `/frame/*` to `/external/studio/v1/builds/{buildId}/frame/*` (build id in the PATH, not the body). Edit route `validateSearch` accepts `kind=studio`. `UpdateStudioFrameRequest` accepts the store's `new_html` (via `resolved_html`) — no store fork. ProjectDetailPage `BuildRow` with Edit (fetches timeline → deep-links the editor) / Render / Publish / MP4-download actions + published badge.
  - **Verification**: frame service unit-tested (ordered insert, update, reorder, delete, cross-tenant 404); design-lint clean; 0 real type errors. Render path is shape-verified against the reels precedent but needs staging (ffmpeg + worker).
  - **Known nit**: the editor's Back button routes studio builds to `/vim/dashboard?videoId=<buildId>` (a non-existent production view); harmless, fix in a polish pass to route to `/vim/studio/$projectId`.

- **P6a (2026-06-08)** — Overlays wizard step (titles + text), studio-native renderers, COMPOSE_HTML executor:
  - **Pre-P6 fixes** (folded in): `wizard_confirm` persists `model_dump(mode="json")` not `exclude_none=True` (was silently stripping explicitly-null overlay params → build saw a different dict than the user confirmed); render idempotency via a process-local `_ACTIVE_RENDER_BUILDS` guard + `RenderAlreadyInProgress`→409 (no duplicate worker jobs on double-click); `update_on_render` MERGES `extra_metadata` (was full-replace → wiped `entry_count`/build name); `arrange_sequence` image still-duration takes an explicit `still_duration_s` and only derives from a range when BOTH `t_start`+`t_end` are present (a bare `t_end` no longer becomes an N-second still); `BuildStep.STAGE_LABELS` now lists all stages incl. `COMPOSE_HTML` (was clamping the checklist to "un-started" mid-build).
  - **`edit_overlays/`** (studio-native, NOT extracted from reels — the audit showed reels' caption builder is reel-time/layout coupled; sharing would be high-friction + risk the shipped reels pipeline). `titles.py` (`render_title_html`: center/lower title + optional subtitle), `text_overlays.py` (`render_text_overlay_html`: top/center/bottom/lower_third × plain/bold/highlight), `_render_common.py` (escape + full-canvas transparent wrapper + bright palette). All return bright-on-transparent HTML so the worker's brightness mask keeps the text over SOURCE_CLIP footage.
  - **Tools**: `propose_titles` + `propose_text_overlays` (LLM, `step='overlays'`, `min_tier='premium'`). Anchor by `segment_idx` (index into the arrangement order). `_build_validation_ctx` now derives `segment_count` (from `extract_order(prior_steps.arrangement)`) so validators clamp `segment_idx`; `_STEP_INTENT['overlays']` directs the LLM. No router/plan-service structural change — the generic wizard handled it.
  - **Timeline builder**: tags each entry `entry_meta.order_index` and emits `meta.segment_windows[]` (order_index → composed `[inTime,exitTime]`, spanning a video segment's surviving sub-clips after cuts).
  - **`COMPOSE_HTML` executor + orchestrator stage**: inserted between ASSEMBLE_TIMELINE (now 0–40) and UPLOAD (now 60–95); resolves each overlay's `segment_idx` → window, clamps timing, renders HTML, appends z-banded overlay entries (text 500+, title 1500+), drops unresolvable overlays; bumps `meta.total_duration` defensively. Reads `overlays.operations`+`manual_operations` by PARAM SHAPE (`params.titles`/`params.overlays`) so FE `manual_overlay` ops compose without a registered tool.
  - **Frontend**: `OverlaysStep.tsx` (plans on entry; reviewable accept/edit/remove list grouped by Title/Text with per-row segment + placement/position selects; refine-with-prompt box; manual adder; confirm rebuilds accepted-only ops + a single `manual_overlay`). Segments derived from the cached confirmed arrangement (`getStudioProject`, warm after the arrangement confirm). `CreatePage` wires cuts → overlays → build; `studio-api.ts` adds `TitleItem`/`TextOverlayItem` FE-internal shapes.
  - **Verification**: backend functional test passes (timeline `segment_windows`/`order_index`; renderers transparent+bright+escaped; tool tier-gating + clamp + OOR-drop; COMPOSE_HTML end-to-end incl. cut-split windows, manual-by-shape, unresolvable-drop, z-banding). FE design-lint clean (0 errors on new files), `tsc --noEmit` exit 0. **Caption + render-worker compositing (luma-key) need staging verification** (no ffmpeg/worker in dev).

- **P6b (2026-06-08)** — Overlays captions (words track + render wiring):
  - **`studio_words_track.py`** (pure, unit-tested) — `flatten_words` (transcript → ordered `{word,start,end}`) + `build_words_track(entries, words_by_handle)`: iterates the built SOURCE_CLIP entries and remaps each source word `w` to output time `inTime + (w - source_start)`, clamped into the entry window. Words inside a removed cut span never appear in any surviving sub-segment (auto-dropped); a word straddling a cut boundary is clamped to the surviving part. Output is the flat `[{word,start,end}]` array the editor (`loadCaptionWords`) + worker (`--captions-words`) both consume. Exact alignment because it drives off the real timeline entries.
  - **`propose_captions` tool** (deterministic, `step='overlays'`, `min_tier='free'`) — proposes `{enabled, preset}` from the project's `caption_preset` preference (`detect_ctx.caption_preset`, threaded in `_plan_inputs`). For FREE tier the overlays step is now non-empty (captions only, no LLM); premium+ gets captions + titles + text.
  - **`ASSEMBLE_WORDS` build stage** (`studio_executors/assemble_words.py`) — gated on captions enabled in the plan; re-validates refs (`source_asset_refs` now on `BuildContext`), fetches raw video contexts (`build_asset_manifest_with_raw`), builds + uploads `ai-studio/{build_id}/words.json` → `s3_urls.words` + `extra_metadata.caption_word_count`. **Best-effort** — a transcript fetch hiccup logs and ships the build without captions, never FAILS it. Stage inserted ASSEMBLE_TIMELINE(0–35) → COMPOSE_HTML(35–55) → **ASSEMBLE_WORDS(55–80)** → UPLOAD(80–95) → HANDOFF.
  - **Render + editor wiring** — `studio_render_service` passes `words_url=s3_urls.words` to `RenderService.submit` (worker renders captions only when words_url present AND `show_captions`); ProjectDetailPage's editor deep-link passes `wordsUrl=s3_urls.words` so captions preview in the editor.
  - **Frontend** — `OverlaysStep` gains a Captions card (enable toggle + preset selector, prefilled from the proposed config); confirm always includes a `propose_captions` op; `BuildStep.STAGE_LABELS` adds ASSEMBLE_WORDS ("Building captions").
  - **Verification**: words-track unit test passes (remap, cut-boundary clamp, removed-gap drop, ordering); `propose_captions` tier/detect/validate verified; orchestrator pipeline ordered + bands contiguous 0–100; FE design-lint clean + `tsc --noEmit` exit 0. **Caption rendering (worker `--captions-words`) needs staging** (no worker in dev).

### Pending (in plan order)
- **P7** — AudioStep + `propose_bgm` + `propose_sfx` + `propose_transitions` + `face_track_reframe` integration
- **P8** — `detect_off_topic` (LLM, ultra+) + `propose_motion_graphics` + `propose_image_overlays` + `change_aspect`
- **P9** — Build versioning UI polish + "Publish" + per-build editor session preservation tests
- **P10** — `RunStateAggregator` wiring + V200 stage routing rows for the 4 LLM stages + cost telemetry pinning

---

## 9. Known limitations (anti-context-loss section — append cause + workaround + planned fix per item)

- **`UpdateProjectRequest` can't CLEAR a field** — `update_fields` repo method skips None per the reels precedent ("None means leave alone"). User who wants to remove their stored prompt has no API path. Workaround: send empty string and let the server normalize. Planned: introduce an `UNSET` sentinel pattern in a small follow-up; needs to land across reels too for consistency.
- **No `unarchive()` repo method** — soft-delete is one-way. Workaround: admin SQL `UPDATE ai_studio_projects SET status='DRAFT', archived_at=NULL WHERE id=...`. Planned: add when a real undo flow lands in the FE.
- **`DELETE /builds/{id}` on the published build** — MITIGATED (2026-06-08 audit): `delete_build` already returns 409 `build_is_published` when the target is the project's published build (`studio_projects.py:824`). The FK `ON DELETE SET NULL` remains only as a safety net for admin hard-deletes. The `?force=true` escape hatch was never implemented.
- **Overlay luma-key constraint (P6a; ⚠ staging-verify)** — over a SOURCE_CLIP the render worker keeps only BRIGHT overlay pixels (brightness mask). Studio overlay renderers use bright-on-transparent text so titles/text composite correctly, but a DARK drop-shadow / semi-transparent backing bar would be keyed out in the final MP4 (it shows only in the editor preview and over IMAGE_STILL entries). Cause: `_composite_source_clips` luma-keys the rendered HTML frame over footage. Workaround: keep overlay content bright (no dark backings). Planned: verify legibility on staging; if needed, add a bright outline/scrim variant. **Editor preview ≠ final render for dark overlay elements over footage.**
- **Titles are overlay-over-footage, not inserted full-screen cards (P6a)** — `propose_titles` anchors a title to a segment's START and overlays it (z-layered) on the footage; it does NOT insert a separate full-screen title card between clips (which would reflow the base timeline). The design-plan's `after_segment_idx` card-insert variant is deferred. Workaround: place a title on the first segment for an intro. Planned: a card-insert overlay kind if needed.
- **Captions words track is built at BUILD time, gated on the confirmed config (P6b)** — `ASSEMBLE_WORDS` only runs (and `s3_urls.words` only exists) when `propose_captions.enabled` was true at build. So toggling captions ON in the EDITOR after a no-captions build has no words to show; re-build with captions enabled. Cause: avoiding a transcript fetch on every build. Planned: lazy words-track build on first editor caption-enable.
- **No per-shot caption suppression / `caption_style` yet (P6b)** — captions render across the whole timeline; they are not auto-suppressed under a title/text overlay, and per-shot `entry_meta.caption_style` (hide/position) isn't emitted. Cause: scope. Workaround: position overlays where they don't clash (titles center, captions bottom). Planned: compute suppression ranges from overlay windows in `assemble_words`.
- **Caption transcript fetch is best-effort (P6b)** — if `ASSEMBLE_WORDS` can't fetch/parse a transcript it logs and ships the build WITHOUT captions (no words track) rather than failing. A build can therefore silently have captions-enabled-in-plan but no `s3_urls.words`. Check `extra_metadata.caption_word_count` to confirm captions landed.
- **Render idempotency is process-local (P6a)** — the `_ACTIVE_RENDER_BUILDS` in-flight guard prevents duplicate renders within one ai_service process (single-pod today, same assumption as `RunStateAggregator`). A multi-pod move needs a DB/Redis lock. A render that FAILS still flips the build to `FAILED` (pre-existing; an AWAITING_EDIT build can't currently be re-rendered after a render failure — tracked for the render-hardening slice, F24).

---

## 10. Files reference

### Backend (`ai_service/app/`)

```
models/
├── ai_studio_project.py                                      ← P0
└── ai_studio_build.py                                        ← P0
repositories/
├── ai_studio_project_repository.py                           ← P0
└── ai_studio_build_repository.py                             ← P0
schemas/
└── studio_projects.py                                        ← P0 (full external contract)
routers/
└── studio_projects.py                                        ← P0 contract; projects CRUD wired in P1
services/
├── studio_asset_validator.py                                 ← P1 (existence/ownership/COMPLETED/kind)
├── studio_asset_manifest.py                                  ← P2 (fetch + prune metadata digest)
├── studio_plan_service.py                                    ← P2 (per-step LLM + validate + fallback)
├── studio_cut_detectors.py                                  ← P3 (deterministic silence/filler fns)
├── studio_timeline_builder.py                               ← P4 (plan → {meta, entries})
├── studio_orchestrator.py                                   ← P4 (async build runner)
├── studio_frame_service.py                                  ← P5 (S3 timeline add/update/delete/reorder)
├── studio_render_service.py                                 ← P5 (worker submit + poll); P6a idempotency; P6b words_url
├── studio_words_track.py                                    ← P6b (pure: remap clip words → composed timeline)
├── studio_executors/
│   ├── build_timeline.py                                    ← P4 (ASSEMBLE_TIMELINE; P6a order_index + segment_windows)
│   ├── compose_html.py                                      ← P6a (COMPOSE_HTML → overlay entries)
│   ├── assemble_words.py                                    ← P6b (ASSEMBLE_WORDS → words.json, gated on captions)
│   └── upload_artifacts.py                                  ← P4 (UPLOAD → S3)
├── studio_tools/
│   ├── __init__.py                                           ← P2 registry; P3 detect(); P6a/b register propose_*
│   ├── pick_segments.py                                      ← P2
│   ├── arrange_sequence.py                                   ← P2 (P6a: explicit image still_duration_s)
│   ├── detect_silences.py                                    ← P3
│   ├── detect_fillers.py                                     ← P3
│   ├── propose_titles.py                                     ← P6a (LLM, overlays, premium+)
│   ├── propose_text_overlays.py                              ← P6a (LLM, overlays, premium+)
│   └── propose_captions.py                                   ← P6b (deterministic config, overlays, free+)
└── edit_overlays/                                            ← P6a (studio-native renderers; NOT extracted from reels)
    ├── __init__.py
    ├── _render_common.py                                    ← escape + transparent wrapper + bright palette
    ├── titles.py                                            ← render_title_html
    └── text_overlays.py                                     ← render_text_overlay_html
migrations/
└── add_ai_studio_tables.sql                                  ← P0 (source of truth)
```

Pending (P7+):
```
services/
├── studio_tools/ (more)                                      ← P7/8 — bgm/sfx/transitions/motion_graphics
└── studio_executors/ (more)                                  ← P7 — ASSEMBLE_AUDIO (bgm/sfx mix)
```

### Flyway (`admin_core_service/.../db/migration/`)
- `V312__Create_ai_studio_tables.sql` — P0 deployment copy

### Frontend (pending P1+ in `frontend-admin-dashboard/src/`)
```
features/vimotion/studio/
├── services/studio-api.ts                                   ← P1 (typed client, full contract)
├── hooks/useStudioProjects.ts                               ← P1 (list/detail/create/update/delete)
├── dashboard/StudioTab.tsx                                  ← P1 (project list view)
├── create/WizardShell.tsx                                   ← P1 (stepper chrome)
├── create/CreatePage.tsx                                    ← P1 (wizard state machine)
├── create/IngestStep.tsx                                    ← P1 (Step 0: asset picker + handles + prompt)
├── detail/ProjectDetailPage.tsx                             ← P1 (project detail; build switcher P5)
├── create/ProjectPreferencesPanel.tsx                       ← P1.5
├── create/ModelOverridesPanel.tsx                           ← P1.5
├── create/AssetOverridesEditor.tsx                          ← P1.5
├── hooks/useWizardStep.ts                                   ← P2 (plan/refine/confirm)
├── create/ArrangementStep.tsx                               ← P2
├── create/CutsStep.tsx                                      ← P3
├── create/BuildStep.tsx                                     ← P4 (P6a: COMPOSE_HTML in STAGE_LABELS)
├── hooks/useStudioBuild.ts                                  ← P4 (create + status poll)
├── detail/ProjectDetailPage.tsx                             ← P5 BuildRow (Edit/Render/Publish/MP4)
├── create/OverlaysStep.tsx                                  ← P6a (titles + text; accept/edit/refine/manual)
└── create/AudioStep.tsx                                     ← P7 pending

Shared editor (modified, P5): `components/ai-video-editor/stores/video-editor-store.ts` (`EditorKind += 'studio'`; `saveChanges` studio frameBase) + `routes/vim/edit/$videoId/index.tsx` (`kind=studio` in validateSearch).
routes/vim/studio/
├── index.tsx                                                ← P1 (redirect → dashboard?tab=studio)
├── new.tsx                                                  ← P1 (create wizard)
└── $projectId/index.tsx                                     ← P1 (project detail)
```

Dashboard integration (P1, modified existing files): `tabsConfig.ts` (+`studio` tab), `Sidebar.tsx` (+`StackSimple`-icon nav entry — note: `Layers` is NOT a phosphor export, `StackSimple` is), `DashboardLayout.tsx` (+`StudioTab` render branch), `BottomTabBar.tsx` (+`studio` in `MORE_TABS`).

---

## 13. User-control surface (P0)

Every layer of decision-making is exposed to the user. Implementation phases
land the executors; P0's contract surface guarantees the FE has somewhere to
put each control, and the LLM has somewhere to read each constraint from.

### 13.1 Per-asset — `AssetOverrides` on each `AssetRef`

Set at ingest time; applied across every wizard step.

| Field | Type | Effect |
|---|---|---|
| `initial_range_s` | `(start, end)` seconds | Pre-clip the asset; downstream tools see only this slice |
| `exclude_ranges_s` | `[(start, end), ...]` | Additive a-priori excludes; cut detectors prepend these |
| `audio_only` / `video_only` | bool | Strip the other stream (mutually exclusive) |
| `primary_speaker_face_id` | str | Face-track reframe hint; resolved against indexer face_segments |
| `notes` | str (≤2000) | Free-form per-asset note fed verbatim to the LLM |

Validator rejects overlapping ranges, `start ≥ end`, and `audio_only + video_only` together.

### 13.2 Per-project — `ProjectPreferences` + `ModelOverrides` on `CreateProjectRequest`

Declared once; LLM honors them at every step.

`ProjectPreferences` fields:
- `cut_aggressiveness` — `light` / `medium` / `aggressive`
- `caption_preset` — `hormozi` / `karaoke` / `pop` / `clean` / `none`
- `bgm_policy` / `sfx_policy` — `auto` / `always` / `never`
- `transition_style` — `cuts_only` / `smooth` / `energetic`
- `color_scheme_hints` — up to 8 free-form color tokens
- `tone` — free-form ("energetic", "calm", "professional"), ≤120 chars
- `notes` — catch-all hints, ≤4000 chars

`ModelOverrides`:
- `default` — single model id (`provider/model`) applied to every user-overridable stage
- `per_stage` — `{stage_id: model_id}` map; wins over `default`
- User-overridable stages: `studio_arrangement`, `studio_cuts`, `studio_overlays`, `studio_audio`
- Pinned stages (vision_review, utility) silently ignore overrides

Both pass through to the AI service's V200 routing matrix.

### 13.3 Per-wizard-step — `WizardPlanRequest`

Constrain the LLM call BEFORE it runs.

| Field | Type | Effect |
|---|---|---|
| `extra_context` | str (≤2000) | One-shot hint appended to THIS LLM call only (not persisted) |
| `tools_disabled` | `List[str]` | Tools the LLM is forbidden from proposing for this step |
| `tools_enabled` | `List[str]` | If non-empty, ONLY these tools may be proposed (tier filter still applies) |

Validator rejects overlap between `disabled` and `enabled`.

### 13.4 Per-operation — `ConfirmedStepPlan`

User's response to what the LLM proposed.

| Field | Type | Effect |
|---|---|---|
| `decisions[].action` | `accepted` / `rejected` / `edited` / `auto` | Per-operation verdict |
| `decisions[].edited_params` | dict | When `action=edited`, the user-modified params |
| `manual_operations` | `OperationSpec[]` | User-authored operations the LLM didn't propose |
| `operation_order` | `List[int]` | Optional explicit reordering (must be a permutation of `range(len(operations))`) |
| `skipped` | bool | Explicit "user skipped this step entirely"; build uses defaults |

### 13.5 Per-build — `CreateBuildRequest`

Naming, forking, and per-build render overrides.

| Field | Type | Effect |
|---|---|---|
| `name` | str (≤120) | Human label for the build ("Test 1", "Final cut"); persisted in `extra_metadata.name` |
| `notes` | str (≤2000) | Why this build exists |
| `from_build_id` | str | Fork from THIS build's `plan_snapshot` instead of the project's current plan |
| `aspect` | `9:16` / `16:9` / `1:1` | Override project aspect for this build only |
| `fps` | int (15-60) | Override project fps for this build only |

### 13.6 Per-render — `StudioRenderRequest`

Matches AI-video's `RenderOptionsBody` exactly so a shared FE render dialog
drives both pipelines.

14 caption + render knobs: `resolution`, `fps`, `show_captions`, `show_branding`,
`caption_position`, `caption_text_color`, `caption_bg_color`, `caption_bg_opacity`,
`caption_size`, `caption_style`, `caption_font_family`, `caption_font_weight`,
`caption_text_stroke_width`, `caption_text_stroke_color`, `caption_highlight_color`,
`caption_preset`. All optional; render worker falls back to its defaults
when omitted.

### 13.7 Pagination

`GET /projects` and `GET /projects/{id}/builds` accept `limit` (1-200, default
50), `offset` (default 0), `status` (filter by enum), `include_archived`
(bool, default false).

---

## 11. Maintainers — cross-file couplings to keep in sync

(Populated as the implementation lands. The intent of this section is to enumerate every place a single conceptual concept appears in multiple files, so the next contributor doesn't introduce drift.)

P0 couplings:
- **Status enum** `DRAFT|PLANNING|READY_TO_BUILD|BUILDING|PUBLISHED|ARCHIVED` lives in BOTH the SQL CHECK constraint in `add_ai_studio_tables.sql` AND the `ProjectStatus` Literal in `schemas/studio_projects.py`. Adding a value means updating both.
- **Build status enum** `PENDING|BUILDING|AWAITING_EDIT|RENDERED|FAILED` lives in BOTH the SQL CHECK constraint AND `BuildStatus` Literal in schemas. Same rule.
- **Wizard step enum** `arrangement|cuts|overlays|audio` lives in the operation-log SQL CHECK constraint, `WizardStep` Literal in schemas, and (post-P2) `studio_plan_service`. Adding a step requires touching all three.
- **Flyway V312** must match `add_ai_studio_tables.sql` exactly in structural intent. Schema drift between the source migration and the Flyway copy is a class of bug — always edit both, never one alone.
- **Router prefix** `/external/studio/v1` is declared in `routers/studio_projects.py` and referenced in `app_factory.py` comment and (future) `frontend-admin-dashboard/.../studio-api.ts`. Three sites.
- **User-overridable stage list** (`studio_arrangement`, `studio_cuts`, `studio_overlays`, `studio_audio`) is named in the `ModelOverrides` docstring in schemas, will be enforced in (P10) `app/constants/pipeline_stages.py`, and surfaces in the FE's per-stage override picker. Three sites — adding a stage means updating all three. Pinned stages (vision_review-equivalents) must NOT appear in user_overridable lists.
- **`ProjectPreferences` enum literals** (`cut_aggressiveness`, `caption_preset`, `bgm_policy`, `sfx_policy`, `transition_style`) are typed Literals in schemas; downstream tools that consume them (P3 `detect_silences`, P6 `propose_captions`, P7 `propose_bgm`/`propose_sfx`/`propose_transitions`) must enumerate the same allowed values. Two sites per enum.
- **`StudioRenderRequest` shape** mirrors `RenderOptionsBody` in `routers/external_video_generation.py`. Adding a caption knob to AI-video means adding it here too if the editor render dialog is shared between pipelines.

P1 couplings:
- **Pydantic schemas ↔ TS client** — every type in `schemas/studio_projects.py` is mirrored in `features/vimotion/studio/services/studio-api.ts`. Adding/changing a field means editing both. The TS file header calls this out.
- **`config` JSONB storage keys** — `preferences` + `model_overrides` are stored inside `ai_studio_projects.config` under the `_CONFIG_KEY_PREFERENCES` / `_CONFIG_KEY_MODEL_OVERRIDES` constants in `routers/studio_projects.py`. `_extract_preferences` / `_extract_model_overrides` read them back. Storage layout is server-internal — not part of the external contract — so changing a key only touches the router, but the round-trip (`_serialize_config` ↔ `_extract_*`) must stay symmetric.
- **`DashboardTab` enum** — `'studio'` lives in `tabsConfig.ts` (`DashboardTab` union + `TAB_LABELS` + `TAB_DESCRIPTIONS` + `TAB_ORDER`), `Sidebar.tsx` (`NAV_ITEMS`), `DashboardLayout.tsx` (render branch), `BottomTabBar.tsx` (`MORE_TABS`). Four sites — adding a tab touches all four.
- **Asset validation reasons** — `studio_asset_validator.AssetValidationFailure.reason` literals (`not_found`/`wrong_institute`/`not_completed`/`kind_mismatch`/`empty_refs`) surface in the 400 `detail.failures[].reason`. If the FE picker maps reasons to messages, keep that map in sync.
- **Phosphor icon names** — Studio UI uses `StackSimple` (NOT `Layers`, which isn't exported by `@phosphor-icons/react`). Verify any new icon against the package's `index.d.ts` exports before importing.

P2 couplings:
- **Tool registration** — every plan-time tool lives in `services/studio_tools/<tool>.py`, calls `register_tool(ToolSpec(...))` at module scope, and is imported at the bottom of `studio_tools/__init__.py` so the registry populates on import (mirrors reels' `register_all_stages()`). Adding a tool = new file + one import line. The tool's `step` + `min_tier` drive the tier matrix; its `validate(params, ctx)` is the only place params are checked.
- **Validation `ctx` shape** — `studio_plan_service._build_validation_ctx` builds `{video_handles, image_handles, all_handles, durations}` from the manifest; every tool validator reads from it. Adding a tool that needs more context means extending both the ctx builder and the manifest digest.
- **`resolve_step_model` stage naming** — maps wizard step → `studio_<step>` stage id to read `model_overrides.per_stage`. This MUST match the user-overridable stage ids (`studio_arrangement`/`_cuts`/`_overlays`/`_audio`) used in `ModelOverridesPanel` (FE) and the V200 seed (P10). Three sites.
- **Manifest digest fields ↔ tool validators** — `studio_asset_manifest` emits `handle`/`kind`/`duration_s`/`transcript_digest`/… ; tool `ctx` + the LLM prompt both depend on these keys. Renaming a digest key touches the manifest builder, the ctx builder, and the tool prompt docs.
- **`ConfirmedStepPlan` shape ↔ build executor** — P4's `build_timeline` will consume `confirmed_plan[step].operations` (the edited ops the FE sends on confirm). The FE ArrangementStep sends final (post-edit) operations directly; keep the executor reading `operations` (not re-deriving from `decisions`).
- **Plan-service default model** — `StudioPlanService._settings_default_model` reads `STUDIO_PLAN_LLM_MODEL` env then falls back to `anthropic/claude-3-5-haiku` (same default as the reels LLM services). P10 replaces this with V200 stage-routing resolution; until then the project's `model_overrides` is the only per-run control (via `resolve_step_model`).

P3 couplings:
- **Deterministic vs LLM tools** — a `ToolSpec` with `detect` set is deterministic (run server-side, no LLM); without it, LLM-emitted. `plan_step` partitions on `is_deterministic`. A step with ONLY deterministic tools makes no LLM call and skips the fallback (empty result = "nothing to detect", not failure). Keep this invariant when adding tools.
- **`detect_ctx` shape** — `_plan_inputs` (router) builds `{raw_contexts, segments, min_silence_s, fillers_aggressive}`; the cut detectors read these keys. A new deterministic detector needing more context means extending `_plan_inputs` + the `detect_ctx` consumers together.
- **Cut-span shape** — every cut op carries `params.cuts: [{handle, t_start, t_end, kind, word?}]`. The FE CutsStep flattens by `op.tool` (`detect_silences`/`detect_fillers`), and P4's `build_timeline` will collect cuts from ALL cut-step operations (including `manual_cut` in `manual_operations`) by reading `params.cuts` — don't special-case tool names there.
- **Silence/filler thresholds ↔ preferences** — `min_silence_for` + `fillers_aggressive` map `cut_aggressiveness` (from `ProjectPreferences`) to detector knobs. The aggressiveness literals (`light`/`medium`/`aggressive`) live in `studio_cut_detectors`, the schema `CutAggressiveness` Literal, and the FE `ProjectPreferencesPanel`. Three sites.
- **`build_asset_manifest` vs `_with_raw`** — arrangement uses `build_asset_manifest` (manifest only); cuts uses `build_asset_manifest_with_raw` (also returns raw video contexts for detectors). Both share one fetch implementation — don't fork the fetch logic.

P4 couplings:
- **SOURCE_CLIP entry contract** — `studio_timeline_builder` emits `shot_type`/`source_start`/`source_end`/`source_video_index`/`in_time`/`exit_time` to match `render_worker/worker.py`'s compositing reader. `meta.source_video_urls[]` is the index→URL table. Changing the render-worker's expected fields means changing the builder (and vice-versa). The entry `html` ALSO embeds the source URL (for editor/browser playback) — both representations must point at the same clip.
- **Cut-span collection** — `build_timeline` reads cut spans from the cuts step's `operations` AND `manual_operations` (any op with `params.cuts`), regardless of tool name (`detect_silences`/`detect_fillers`/`manual_cut`). Don't special-case tool names here — this is why the FE can introduce `manual_cut` without a registered tool.
- **Overlap merge is mandatory** — silence + filler detectors legitimately overlap; `merge_spans` runs before `subtract_cuts`. Removing the merge would double-split a segment. Covered by the builder's unit test.
- **Timeline artifact key** — uploaded to `ai-studio/{build_id}/time_based_frame.json` (same filename as ai_gen_video/reels) so the P5 editor loader + `/frame/*` save loop find a familiar shape. `s3_urls.timeline` on the build points at it.
- **Build idempotency** — `render_config_hash = sha256(plan_snapshot + aspect + fps)`; `find_active_for_plan` dedups PENDING/BUILDING builds with the same hash. The hash is recomputed in the router (`_render_config_hash`) and stored in `build.config` — keep both in sync if the inputs change.
- **`from_build_id` forking** — `POST /builds` with `from_build_id` copies THAT build's frozen `plan_snapshot` (not the project's live plan), enabling "fork v1 to try a variant". The source build must belong to the same project (400 otherwise).
- **Stage names** — `STAGE_BUILD_TIMELINE = "ASSEMBLE_TIMELINE"` etc. live in `studio_orchestrator`; executors import the constants (no typo risk). The `build_stage` strings persisted on the row must match the FE BuildStep's `STAGE_LABELS` ids. Two sites.

P5 couplings:
- **Entry field casing** — timeline-position is `inTime`/`exitTime` (camelCase); source-clip range is `source_start`/`source_end`/`source_video_index`/`shot_type` (snake_case); geometry is `htmlStartX/Y/EndX/Y` (camelCase). The render worker (`worker.py`), the timeline builder, and the frame service all share this convention — change one, change all.
- **Studio frame URL shape** — `/external/studio/v1/builds/{buildId}/frame/*` puts the build id in the PATH (reels/video put it in the body). The store's `saveChanges` embeds `videoId` (= build id) in `frameBase` for `kind='studio'` and the body's id field is ignored by the (extra-tolerant) Pydantic schema. Three sites: `EditorKind`, `saveChanges` frameBase switch, edit-route `validateSearch`.
- **`new_html` vs `html`** — the shared store sends `new_html` on update; `UpdateStudioFrameRequest` accepts both (`resolved_html` prefers `new_html`). Direct studio API callers (studio-api.ts) send `html`. Don't drop either.
- **Silent narration** — Studio render generates a silent MP3 because the worker requires `audio_url`; real audio is the source clips' own (browser-captured from un-muted `<video>`). If you ever mute source clips in the builder, the rendered MP4 goes silent.
- **Render is poll-based** — `studio_render_service` polls `RenderService.check_status` (no `/render-callback` endpoint), then `AiStudioBuildRepository.update_on_render(video_url)`. Matches reels finalize. The build flips RENDERED with `s3_urls.video` set.

P6a couplings:
- **Overlay tool names** — `propose_titles` / `propose_text_overlays` / `manual_overlay` round-trip on the SAME strings across three sites: BE `register_tool` (`studio_tools/propose_*.py`), FE `OverlaysStep.doConfirm` op groupings, and the `compose_html` executor reader. The executor reads overlays by PARAM SHAPE (`params.titles` / `params.overlays`), NOT tool name — that's why FE `manual_overlay` ops compose without a registered tool. Don't special-case tool names in `compose_html`.
- **Overlay param schema** — `{titles:[{segment_idx,title,subtitle?,duration_s,placement}]}` and `{overlays:[{segment_idx,text,t_offset_s,dur_s,position,style}]}` appear in four places: the tool `params_doc` (LLM-facing), the tool `validate`, the FE `TitleItem`/`TextOverlayItem` + `OverlaysStep`, and the `compose_html` defensive parser. The confirmed ops are NOT re-validated server-side, so `compose_html` parses defensively (coerce, clamp, drop) — keep it tolerant.
- **`segment_idx` ↔ `segment_windows` ↔ `order_index`** — `segment_idx` indexes the arrangement order (`extract_order`). `studio_timeline_builder` tags each entry `entry_meta.order_index` and emits `meta.segment_windows[]` (order_index → composed `[inTime,exitTime]`); `compose_html` resolves `segment_idx` against `segment_windows`; the validator's `segment_count` (from `_build_validation_ctx`) is `len(extract_order(arrangement))`. All four derive from the SAME ordered list — a change to `extract_order` ripples to all.
- **`COMPOSE_HTML` stage** — declared in `studio_orchestrator` (constant + `STAGE_PIPELINE` band + `STAGE_HANDLERS` slot + `register_all_stages` import) and must match the FE `BuildStep.STAGE_LABELS` id. The `BuildStage` Literal (schemas) + the TS `BuildStage` union already include `COMPOSE_HTML`; `build_stage` SQL is free-form VARCHAR (no migration). Stage bands were re-banded (ASSEMBLE_TIMELINE 0–40, COMPOSE_HTML 40–60).
- **z-band convention** — overlay entries use the editor's overlay band (`video-editor-store.ts:278-279`: base 0–499, overlay 500–8999, ui ≥9000). `compose_html` emits text at 500+, titles at 1500+, capped 7999 (below the 8000+ caption band reserved for P6b). The ONLY layering field is `z` (a number) — never emit `layer`/`zIndex`/`z-index`.
- **Overlay entry omits dead fields** — overlay entries carry `id`/`shot_type`(≠SOURCE_CLIP)/`inTime`/`exitTime`/`z`/`html`/`entry_meta` and OMIT `htmlStartX/Y/EndX/Y` (ignored by editor+player), `opacity` (renderer-computed crossfade), `audio*`, `html_model`. Background MUST be transparent/black (luma-key — see §9).
- **Confirm persistence is lossless** — `wizard_confirm` uses `model_dump(mode="json")` (NOT `exclude_none=True`). Overlay params may legitimately omit/null optional keys; the persisted `confirmed_plan[step]` must equal what the user confirmed. Don't re-introduce None-pruning.
- **Segment labels (FE)** — `OverlaysStep` derives the segment list from `project.confirmed_plan.arrangement` via `getStudioProject`, keyed `['studio-project', instituteId, projectId]` — the SAME cache `useWizardStep.confirm` warms. If that cache key changes, the labels go blank (falls back to "Segment N").

P6b couplings:
- **words.json shape** — a flat `[{word, start, end}]` array in master-timeline seconds, produced by `studio_words_track`, consumed by the editor (`video-editor-store.loadCaptionWords`, which adds `meta.audio_start_at` — 0 for Studio, no narration) and the worker (`--captions-words`). Three readers; one shape. Studio words are already in master coords (no narration offset) — don't add one.
- **`s3_urls.words` flows to FOUR places** — written by `assemble_words`; read by `studio_render_service` (`words_url` → `RenderService.submit`), by ProjectDetailPage's editor deep-link (`wordsUrl`), and (transitively) by the editor + worker. Renaming the `words` key touches all of them.
- **Captions-enabled gate** — `propose_captions.params.enabled` is the single source of truth: set in `OverlaysStep` (confirm always includes a `propose_captions` op), read by `assemble_words._captions_enabled` (scans `overlays.operations`+`manual_operations` by tool name). The render's `show_captions` is a SEPARATE render-dialog knob — both must be true for captions to appear.
- **`caption_preset` literal set** — `hormozi|karaoke|pop|clean|none` lives in `propose_captions._PRESETS`, the schema `CaptionPreset` Literal, the FE `CaptionPreset` type + `CAPTION_PRESETS`, and `ProjectPreferences.caption_preset`. Adding a preset touches all four.
- **`ASSEMBLE_WORDS` stage** — `studio_orchestrator` (constant + band + handler slot + `register_all_stages` import) ⇄ FE `BuildStep.STAGE_LABELS`. The `BuildStage` Literal/TS union already include `ASSEMBLE_WORDS`. It needs `BuildContext.source_asset_refs` (populated in `create_build`) to fetch transcripts.
- **Words drive off the BUILT timeline** — `build_words_track` reads each SOURCE_CLIP entry's `source_start`/`source_end`/`inTime`/`exitTime`/`entry_meta.handle`. If the timeline builder changes that entry shape (P5 casing couplings), the words remap silently mis-aligns. Same casing contract as §11 P5.

---

## 12. Verification

### P0 verification (post-migration apply)

```sql
-- Apply: psql -d vacademy_admin -f V312__Create_ai_studio_tables.sql
SELECT table_name FROM information_schema.tables
  WHERE table_name LIKE 'ai_studio_%' ORDER BY table_name;
-- Expect: ai_studio_builds, ai_studio_operation_logs, ai_studio_projects

SELECT conname, pg_get_constraintdef(c.oid)
  FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname LIKE 'ai_studio_%' AND contype IN ('c','u','f');
-- Expect: status CHECKs, version UNIQUE, project FK CASCADE, published_build FK SET NULL
```

```bash
# Endpoint surface live (every route returns 501):
curl -X POST "$BASE/external/studio/v1/projects" \
  -H "X-Institute-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"source_asset_refs":[{"asset_id":"x","handle":"v1","kind":"video"}]}'
# Expect: HTTP 501 + {"error":"not_implemented","endpoint":"POST /projects",...}
```

### P6a verification (overlays)

Backend functional test (no ffmpeg/worker needed — pure logic), run from `ai_service/`:
```python
# Stub the heavy DB module, then exercise the chain end-to-end:
#   1. studio_timeline_builder.build_timeline → asserts meta.segment_windows
#      (incl. a video segment split by a cut → one window spanning both subclips)
#      + every entry carries entry_meta.order_index.
#   2. edit_overlays renderers → transparent wrapper, bright color, html-escaped
#      user text, no htmlStartX baked in.
#   3. studio_tools: propose_titles/propose_text_overlays registered
#      (step='overlays', min_tier='premium'); tools_for_step('overlays','free')==∅,
#      'premium' has both; validators drop out-of-range segment_idx + empty text,
#      clamp duration, raise when all-invalid.
#   4. compose_html._compose_html_stage on a built timeline → overlay entries
#      appended with z in band, timing clamped into the segment window, manual
#      ops composed by shape, unresolvable segment_idx dropped, no SOURCE_CLIP
#      fields on overlays.
# All assertions pass (2026-06-08).
```

FE: `node ../scripts/design-lint.mjs src/features/vimotion/studio/create/OverlaysStep.tsx …` → 0 errors; `pnpm run typecheck` → exit 0.

Walk (staging, real LLM + worker):
1. Create project (≥1 video) → arrangement → cuts → **overlays**. `POST /wizard/overlays/plan` returns `{step:'overlays', operations:[propose_titles|propose_text_overlays…]}` (premium tier) or `[]` (free — overlay tools tier-filtered out).
2. Accept/edit/refine, add a manual title, Confirm → read back `confirmed_plan.overlays` and assert an explicitly-null param key survives (F3 regression guard).
3. Build → BuildStep shows COMPOSE_HTML reached; the built `time_based_frame.json` has TITLE/TEXT_OVERLAY entries with `z` in 500–8999, no `htmlStartX`, transparent bg, `entry_meta.order_index`.
4. Open in editor — overlay entries are individually selectable/editable. **Render to MP4 + confirm the title composites OVER the footage (bright text on top, footage not masked away) — luma-key, staging-only.**

### P6b verification (captions)

Backend functional test (pure, no worker), from `ai_service/`:
```python
# studio_words_track: a transcript with hello/world/straddle/cut/bye over a
# timeline that keeps source 0-4 (inTime 0) and 6-12 (inTime 4) — i.e. a cut
# removed 4-6. Asserts: hello@0-1, world@1-2, straddle clamped to 3.5-4.0,
# 'cut' DROPPED (inside the removed gap), bye remapped to 8-9, track ordered.
# propose_captions: overlays/free/deterministic; tools_for_step('overlays','free')
# == [propose_captions]; detect(karaoke|none|∅) → enabled/preset as expected;
# validate coerces a bad preset → clean. Orchestrator: STAGE_PIPELINE ==
# [ASSEMBLE_TIMELINE, COMPOSE_HTML, ASSEMBLE_WORDS, UPLOAD, HANDOFF], bands
# contiguous 0..100, ASSEMBLE_WORDS handler slot present, BuildContext.source_asset_refs.
# All assertions pass (2026-06-08).
```

FE: design-lint clean on OverlaysStep/BuildStep/ProjectDetailPage; `pnpm run typecheck` → exit 0.

Walk (staging, real worker):
1. Overlays step → enable Captions, pick a preset → Confirm. `confirmed_plan.overlays` has a `propose_captions` op with `enabled:true`.
2. Build → BuildStep shows "Building captions" reached; the build's `s3_urls.words` is set and `extra_metadata.caption_word_count > 0`. Fetch `words.json` → flat `[{word,start,end}]`, times within `[0, meta.total_duration]`, monotonic, NO words inside cut gaps.
3. Open in editor → captions preview (karaoke pills on the scrubber). **Render with show_captions → confirm captions burn into the MP4, aligned to the spoken audio (staging-only — worker).**
4. Free-tier institute: overlays step offers ONLY captions (no titles/text); building with captions on still produces a words track.

Subsequent phases will append their own verification stanzas.
