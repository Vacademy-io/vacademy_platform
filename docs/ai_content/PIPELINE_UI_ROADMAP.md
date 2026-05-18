# Movie-Production Pipeline UI — Roadmap

**Status**: Phase 1 + Phase 2 shipped. This doc captures what's done, what's next, and the architectural decisions a future session needs to know to keep working without re-deriving everything.

**Audience**: Engineer (or LLM agent) continuing work on the AI Video Studio pipeline visualization.

**Path**: `frontend-admin-dashboard/src/routes/video-api-studio/-components/pipeline/`

---

## Context — what was rebuilt and why

The old `<GenerationProgress>` (live) and `<VideoResult>` (post-completion) screens were two separate clinical UIs for the AI video pipeline. We replaced them with a **single movie-production view** that uses the same shape during live generation and after completion — only node states + inline artifacts populate over time.

### Key product decisions (locked)

| Decision | Choice |
|---|---|
| Diagram engine | **React Flow** (`reactflow@11.11.4`, already a project dep) |
| Auto-layout | **dagre** (`dagre@0.8.5`, added in Phase 1) |
| Player placement | **Final Cut node IS the AIContentPlayer** — no separate player |
| Scene representation | Each scene is its own React Flow node, sequential chain off Storyboard |
| Optional nodes | Hidden when not configured |
| Visual tone | Editorial / professional (mirrors `workflow/$workflowId/-components/execution-flow-node.tsx`) |
| Composer | Removed from `'generating'` and `'complete'` states (only visible in idle hero) |

### Layout

Left **2/3** = `<PipelineFlow>` (React Flow diagram). Right **1/3** = `<PipelinePanel>` (status badge, stages list, production budget, artifact URLs, actions). Both wrapped by `<PipelineLayout>` and rendered in `console/index.lazy.tsx` for both `consoleState === 'generating'` and `'complete'`.

### Node taxonomy (current)

```
Pitch → Screenplay → Narration → Storyboard → Scene 0 → Scene 1 → … → Scene N → Final Cut
```

Phases 3 / 4 add optional `Research`, `Talent`, `Score` branches off Storyboard (parallel to the scene chain) — see "Next phases" below.

---

## What ships in Phase 1 + Phase 2

### Files

```
pipeline/
├── PipelineLayout.tsx              # 2/3 + 1/3 split shell
├── PipelineFlow.tsx                # left — React Flow + dagre + manual scene positioning
├── PipelinePanel.tsx               # right — stages list, budget, URLs, actions
├── NodeDetailSheet.tsx             # side sheet shown on node click
├── nodes/
│   ├── BaseNodeShell.tsx           # state-driven chrome for stage nodes
│   ├── PitchNode.tsx
│   ├── ResearchNode.tsx            # NOT BUILT YET (Phase 4)
│   ├── ScreenplayNode.tsx
│   ├── NarrationNode.tsx
│   ├── StoryboardNode.tsx
│   ├── FilmingNode.tsx             # legacy fallback (free tier without director)
│   ├── SceneNode.tsx               # per-scene; renders thumbnail when timeline.json loads
│   ├── TalentNode.tsx              # NOT BUILT YET (Phase 3)
│   ├── ScoreNode.tsx               # NOT BUILT YET (Phase 3)
│   └── FinalCutNode.tsx            # embeds AIContentPlayer + fullscreen modal
└── -utils/
    ├── stage-vocab.ts              # NODE_LABELS, SUB_STAGE_BY_NODE, ACTIVE_SUB_STATUS, STAGE_ORDER
    ├── derive-pipeline-state.ts    # CurrentGeneration | (Status+Urls) → PipelineState
    ├── build-pipeline-graph.ts     # PipelineState → { nodes, edges, NODE_SIZES }
    ├── apply-dagre-layout.ts       # dagre wrapper, writes position.{x,y}
    ├── parse-timeline-thumbnails.ts # extract <img>/<video> URLs per scene from timeline.json
    ├── use-timeline-json.ts        # React Query hook for timeline JSON + thumbnails
    └── use-video-status.ts         # React Query hook for /status (shot_plan, generation_progress)
```

### Console wiring

`console/index.lazy.tsx` renders a single `<PipelineLayout state={derivePipelineFromLive(currentGeneration)} apiKey={activeApiKey ?? undefined} />` for both `'generating'` and `'complete'`. The `'reviewing'` state still uses `<ScriptReview>` separately. Legacy `<GenerationProgress>` and `<VideoResult>` are still on disk but unused — Phase 5 deletes them.

### Side fixes shipped during Phase 1 + 2

These were unrelated bugs found while wiring the new UI; documenting so they don't get re-introduced:

1. **SSE parser destructive replace** — `replace(/'/g, '"')` etc. was corrupting any narration with apostrophes. Removed; FastAPI emits standard JSON via `json.dumps`.
2. **Progress reducer clobber** — the `progress` event handler was rebuilding `CurrentGeneration` from scratch, losing `shotsCompleted/shotsTotal/cumulativeTokens/recentErrors/shotPlan`. Now spreads `prev`.
3. **Side effects in `setState` reducers** — moved `'complete'` transition to a single `useEffect` watching `currentGeneration.htmlUrl/audioUrl`.
4. **PENDING_GENERATION_KEY wipe on transient errors** — terminal errors clear, transient errors keep the key and call `startPollingForVideo` so the documented disconnect-recovery actually works.
5. **Polling percentage** — `computeHtmlPercentage(shotsCompleted, shotsTotal)` interpolates 60–95% during HTML stage; was stuck at 90.
6. **`scriptUrl` from polling** — read from `statusResp.s3_urls.script` (not in `/urls` response).
7. **Auto-resume to reviewing** — polling that lands on `current_stage='SCRIPT'` for review-mode runs auto-fetches the script and transitions to `consoleState='reviewing'` instead of toasting "open from history".
8. **History metadata** — `getRemoteHistory` reads `metadata.user_selections` (canonical) before falling back to top-level `metadata.{orientation,visual_style,quality_tier}`. Old hardcoded defaults removed.
9. **Failed history selection** — added toast feedback ("This generation failed. Click 'Retry' to resume.") so it's not silent.
10. **`COMPLETE_GENERATION_KEY` TTL** — 90-min TTL matching `MAX_RENDER_AGE_MS` so stale completed videos don't auto-restore on a fresh tab open hours later.
11. **Scene ID collision** — React Flow node ids use array position (`scene-${i}`), not BE `shot_index`, so missing/duplicate `shot_index` values don't collapse all scenes to one node.
12. **Scene node dimensions pinned** — `<SceneNode>` sets `style={{ width, height }}` from `NODE_SIZES.scene` so rendered DOM can't grow past dagre's reservation.

---

## Architectural anchors (don't break these)

### 1. Single derivation, two sources

`derive-pipeline-state.ts` exports two entry points:

- `derivePipelineFromLive(cg: LiveCurrentGeneration)` — used by the console (live + history-restored).
- `derivePipelineFromStatus(status, urls, extra?)` — built but not currently wired (reserved for a future "open by ID" deep-link path).

Both produce the same `PipelineState` shape. Downstream components don't care which source.

**Master flag** (used in both): `runWrapped = !!htmlUrl && audioReady`. When the timeline + audio (when needed) are present, every upstream node is `wrapped` regardless of which sub-stage signals are missing — this is what makes history-loaded videos render correctly without per-stage `*_done` events.

### 2. Live data ≠ history data — fill the gap with `/status` and `timeline.json`

For history-loaded videos, `currentGeneration` doesn't carry `shotPlan` or thumbnails. Two React Query hooks bridge the gap:

- `useVideoStatus(videoId, apiKey)` → fetches `/status` → `generation_progress.shot_plan`. **Synthesized into `state.scenes[]`** in `PipelineFlow`'s `enrichedState` `useMemo`. 1-min stale time.
- `useSceneThumbnails(videoId, timelineUrl)` → fetches `timeline.json` → parses `<img>` / `<video>` URLs per entry via regex. Merged into scenes as `imageUrl/videoUrl`. 5-min stale time.

Both are lazy (`enabled: !!apiKey`, `enabled: !!timelineUrl`). Live runs don't fetch until needed.

### 3. Manual scene positioning post-dagre

`PipelineFlow` runs dagre on the full graph, then **overrides scene positions** in a deterministic horizontal row anchored to Storyboard's position. This was needed because dagre's auto-layout for the sequential scene chain produced positions that were unreliable across N values (single-scene runs had giant gaps; many-scene runs had off-screen / stacked nodes). Manual positioning guarantees:

- Every scene gets a unique x position (no stacking)
- All sit on the same y row as the linear chain
- Sorted by `sceneIndex` before positioning
- Final Cut moves dynamically to the right of the scene strip

If you ever swap layout strategies, the contract: scene nodes have `data.kind === 'scene'`, IDs are `scene-${arrayIndex}`, and `sceneIndex` (in `data`) is the array index — **not** the BE `shot_index`. The BE `shot_index` is preserved on `state.scenes[].index` for display only.

### 4. React Flow click handling

Use `<ReactFlow onNodeClick={...}>` — **not** DOM `onClick` on the custom node component. React Flow wraps every node in `.react-flow__node` which intercepts pointer events and DOM-level onClick is unreliable (cursor changes but click never fires). `BaseNodeShell` only adds the visual cursor/hover affordance; `PipelineFlow.handleNodeClick` does the dispatch.

`elementsSelectable` must be `true` for `onNodeClick` to fire reliably. We override the default `.selected` ring via a scoped `<style>` block (see `PipelineFlow.tsx`) so we don't get a doubled outline on top of our state-driven ring.

### 5. Node detail dispatch — tagged union

`<NodeDetailSheet>` accepts `target: DetailTarget | null`:

```ts
type DetailTarget = { kind: PipelineNodeId } | { kind: 'scene'; sceneIndex: number };
```

Stage nodes are singletons; scene needs the index. The sheet's body switches on `kind`. Final Cut explicitly opts out of opening a sheet (its embedded player + fullscreen button cover the artifact view).

### 6. SSE / status BE ground truth

| Stage | Live signal | Post-completion |
|---|---|---|
| SCRIPT | `script_writing` / `script_done`, `s3_urls.script` | Same |
| TTS | `tts_generating` / `tts_done`, `s3_urls.audio` | Same |
| WORDS | (no sub_stage), `s3_urls.words` | Same |
| Storyboard (Director) | `director_planning` / `director_done`, `shot_plan[]` | `gp.shot_plan[]` |
| Filming (per-shot HTML) | `shot_done` per scene, `shotsCompleted/Total`. **No image/video URLs.** | Parse `timeline.json` |
| Talent (Avatar batch) | `avatar_batch_start` / `_image_audio_ready` / `_render_done` / `_failed` / `_batch_done` | `extra_metadata.host.outputs.shot_artifacts` |
| Score (Music) | `background_music_start` / `_segment` / `_concat` / `_done` | Final track in `meta.audio_tracks[]` |
| Final Cut | `s3_urls.timeline` | Same |

Per-scene image / stock-video URLs are **not** in any live progress payload. They only become available by parsing the final `timeline.json` (entries' `html` strings carry `<img src>` / `<video src>` references).

---

## Next phases

### Phase 3 — Conditional Talent + Score branches

**Goal**: When a video used host-avatar generation or background music, surface them as their own nodes branching off Storyboard.

**Data sources**:
- Talent presence: `statusResp.metadata.user_selections.host?.type === 'avatar'` OR `extra_metadata.host?.enabled`
- Talent outputs: `extra_metadata.host.outputs.shot_artifacts[]` — each has `host_image_url`, `avatar_video_url`, `shot_index`, `duration_s`
- Score presence: `metadata.user_selections.background_music_enabled` (or `null` for tier default)
- Score outputs: `meta.audio_tracks[]` from `timeline.json` — find entry with `id === 'background-music'`

**Tasks**:
1. Extend `PipelineState`: `talent?: NodeSlot<TalentArtifact>`, `score?: NodeSlot<ScoreArtifact>`. Add derivation in both `derivePipelineFromLive` (read `cg.options.host`, `cg.options.background_music_enabled`) and `derivePipelineFromStatus` / `useVideoStatus` consumer (read `metadata.user_selections.host`, etc.). The avatar sub_stage events (`avatar_batch_start`, `avatar_image_audio_ready`, `avatar_render_done`, `avatar_failed`, `avatar_batch_done`) — these flow through `currentGeneration.message` for live runs; parse the substring matching pattern from `stage-vocab.ts::SUB_STAGE_BY_NODE`.
2. Build `<TalentNode>` and `<ScoreNode>` (mirror `BaseNodeShell` patterns):
   - **Talent (live)**: counter "Recording lead performance · 3 of 5 takes"
   - **Talent (wrapped)**: 4×N grid of avatar take thumbnails (use `host_image_url`)
   - **Score (live)**: counter "Composing · 2 of 3 segments"
   - **Score (wrapped)**: `<audio controls>` for the merged track URL
3. Add 'talent' / 'score' to `PipelineNodeKind` + `NODE_SIZES` + `NODE_TYPES` registry in `PipelineFlow`.
4. Update `buildPipelineGraph`:
   - When `state.talent` exists, push a `talent` node and edge `storyboard → talent → finalCut`
   - When `state.score` exists, push a `score` node and edge `storyboard → score → finalCut`
   - Both branches run in parallel to the scene chain
5. Update manual scene positioning in `PipelineFlow`: position Talent + Score nodes BELOW the scene row (they're optional and visually secondary). Scenes stay in the main horizontal row.
6. Update `<NodeDetailSheet>` `NodeDetailBody` switch:
   - Talent: replace "coming soon" placeholder with grid of `host_image_url` cards + per-shot `avatar_video_url` previews
   - Score: replace placeholder with a full audio player + segment list (`extra_metadata` may include per-segment URLs in future; for now just the merged track)
7. Update `PipelinePanel` stages list to include Talent / Score rows (conditionally).

**Verification**:
- Generate an `ultra` video with host config → Talent node appears live, populates with takes when `avatar_render_done` fires.
- Generate an `ultra` video with `background_music_enabled: true` → Score node appears live, populates with audio when `background_music_done` fires.
- Free-tier video (no host, no music) → Talent / Score nodes hidden.

### Phase 4 — Research node + abort + retry affordances

**Goal**: Visualize URL scraping / web search work that runs before SCRIPT stage. Add user controls for in-flight cancellation and per-shot retry.

**Data sources**:
- Research enabled: `metadata.intent_outcomes.tools_enabled` includes `'scrape_url'` or `'web_search'`
- Scrape artifacts: `metadata.intent_outcomes.scrape_url_artifacts` — `urls_attempted`, `files_captured` (S3 URLs of screenshots), `screenshot_count`, `text_excerpt`
- Web search artifacts: `metadata.intent_outcomes.web_search_artifacts` — `query`, `answer`, `sources[]` (host + url)

**Tasks**:
1. Extend `PipelineState`: `research?: NodeSlot<ResearchArtifact>`. Add `ResearchArtifact` with sources + screenshots + excerpt fields.
2. Derive from `metadata.intent_outcomes` in `useVideoStatus` consumer. Live derivation is harder (no SSE events for intent-router that I'm aware of — confirm via `Agent({ Explore })` if needed); for v1, only show Research on already-finished videos that used it.
3. Build `<ResearchNode>` — chips for cited sources, screenshot thumbnails grid.
4. Position Research in `buildPipelineGraph` between Pitch and Screenplay (chronologically before SCRIPT runs): `Pitch → Research → Screenplay → …`. Hide when not configured.
5. **Abort button**: add to `PipelineFlow` top-strip when `state.status === 'in_production'`. Wire to `abortRef.current()` from console (need to expose via context or prop). On click, invoke abort + clear `PENDING_GENERATION_KEY` + reset console state.
6. **Per-scene retry**: for scenes in `cut` or `reshoot` state, the detail sheet should offer a retry. The BE has `/retry/{video_id}` but it's full-pipeline retry; per-scene retry would need a new endpoint. **Defer to Phase 4.5** if not BE-supported.
7. **Production halted banner**: `<PipelinePanel>` already shows the "Halted" badge; add a retry CTA that calls `retryVideo(videoId, ...)` (already wired in console).

**Verification**:
- Submit a prompt with a URL → Research node visible during/after generation.
- Submit prompt without URLs → Research node hidden.
- Cancel a live generation via Abort button → background task continues on BE but FE goes idle (matches current "abort doesn't kill BE task" behavior — toast should explain this).
- Retry a failed video → reset state, kicks off `/retry`, scenes that previously failed re-render.

### Phase 5 — Cleanup + dead code removal

1. **Delete `<GenerationProgress>`** (`-components/GenerationProgress.tsx`) — fully covered by `<PipelineLayout>`.
2. **Refactor `<VideoResult>`** (`-components/VideoResult.tsx`):
   - Extract `<ResultActionsCard>` (Render MP4, Edit, Share, Embed, Download) — already lifted into `<PipelinePanel>`; can delete `<VideoResult>` entirely if no other consumer.
   - Extract `<GenerationDetails>` (token + shot table) — also lifted; delete.
   - Verify no other route imports `<VideoResult>` before deleting (search via Grep).
3. **Drop legacy filming counter path** in `buildPipelineGraph` if Phase 3 confirms scenes are always synthesized for any tier with shot_plan. Keep only if free-tier verification shows no shot_plan in `gp` — then the fallback is still needed.
4. **Tailwind shorthand cleanup** — current code has 3 `tailwindcss/enforces-shorthand` warnings (`h-full w-full` → `size-full`). Sweep them (cosmetic).
5. **Remove `<style>` selection-ring override** in `PipelineFlow` once a cleaner React Flow API is found. Currently we suppress `.react-flow__node.selected` with raw CSS — works but ugly.

---

## Open questions / unresolved items

These came up during Phase 2 but didn't get fully solved:

### Q1: Does the BE really emit `shot_index` consistently?

Empirical check earlier: `curl /status/vid_1777715430817_eg23qy5` returned 10 shots with sequential `shot_index: 0..9`. So the data IS clean for that video. The defensive `typeof s.shot_index === 'number' ? s.shot_index : arrayIdx` fallback is paranoia, not a known fix for an actual bug. Keep it; cheap insurance.

### Q2: Why did dagre's sequential-chain layout produce visually broken positions?

Couldn't fully diagnose. Symptoms: with N=10 scenes in a Storyboard→S0→S1→…→S9→FinalCut chain, dagre placed scenes in unexpected y/x positions — sometimes only the last scene visible, sometimes huge gaps. **Workaround shipped**: manual scene positioning in `PipelineFlow.tsx` after dagre runs. If revisiting, look at:
- `align: 'UL'` dagre option (not currently set)
- `ranker: 'tight-tree'` vs default `'longest-path'`
- Whether the issue was actually HMR cache during the diagnosis session

### Q3: Per-scene retry endpoint

The pipeline has `/retry/{video_id}` for whole-run retry. There's no `/retry-scene/{video_id}/{shot_index}` endpoint. If Phase 4 wants per-scene retry, that needs BE work. Worth scoping with the BE team before promising the feature.

### Q4: Live host / music sub_stage signals

The doc's `SUB_STAGE_BY_NODE` map covers avatar_* and music_* sub_stages, but the live derivation reads them via substring-match on `currentGeneration.message`. Confirm via real run that:
- `avatar_batch_start` / `avatar_render_done` actually arrive in `message` (e.g. with the `🎙️` prefix the console adds)
- Music sub_stages similarly bubble up

If they don't, Phase 3 needs a more direct event-to-state path (e.g. console parses `sub_stage` events explicitly and writes `host_*` / `music_*` fields onto `currentGeneration`).

### Q5: Composer-removed-from-complete UX

We removed the docked composer from `'complete'` state (and `'generating'`). Users now must click "New Video" in History sidebar to kick off another run. Watch user feedback — if discoverability is an issue, consider a small "+ New" button in `PipelinePanel`'s top-right.

### Q6: Live-progress visibility for filming

When SSE is running and `shot_done` events arrive, scene nodes should flip Scheduled → In Production → Wrapped one by one with their narration excerpts visible. This works for live runs that have the shotPlan in `currentGeneration` (post `director_done`). Test that the visual transition is visible — not blink-and-miss-it. May need a 200–300ms transition animation on the state ring.

---

## Quick reference — when adding new node types

1. Add to `PipelineNodeKind` in `build-pipeline-graph.ts`.
2. Add to `NODE_SIZES` in same file.
3. Add to `NODE_LABELS` + `ACTIVE_SUB_STATUS` in `stage-vocab.ts`.
4. Add slot type to `PipelineState` in `derive-pipeline-state.ts` + populate in both derivation paths.
5. Build node component in `nodes/`, register in `NODE_TYPES` in `PipelineFlow.tsx`.
6. Add to `PipelineNodeId` (in `stage-vocab.ts`) if it's a singleton stage; if it has multiple instances per pipeline (like `scene`), add it as its own kind in `PipelineNodeKind` with its own click-dispatch branch in `handleNodeClick`.
7. Add detail-body component in `NodeDetailSheet.tsx` `NodeDetailBody` switch (or add a new branch in `DetailSheetContents` if it carries an index like `scene`).
8. Update `PipelinePanel` stages list if it should appear there.

---

## File of last resort — debugging tips

- **Scenes missing**: log `state.scenes.length` and `gp?.shot_plan?.length` at the top of `enrichedState` `useMemo`. Most likely cause: `apiKey` is undefined → `useVideoStatus` is `enabled: false`.
- **Layout broken**: log `positioned.map(n => ({id: n.id, x: n.position.x, y: n.position.y}))` after dagre + manual override. Check if scene IDs are unique.
- **Click does nothing**: confirm React Flow's `onNodeClick` fires (not DOM onClick). Check `elementsSelectable` is `true`.
- **Thumbnails not loading**: check `useTimelineJson` query state (loading / error / data). Verify the timeline URL is HTTP 200 (CORS allow public bucket).
- **Stale UI after change**: HMR can lag — full refresh (`Cmd+Shift+R`). Production builds need `pnpm run build` to reflect changes.

---

**Last updated**: 2026-05-03 (Phase 2 ship + manual scene positioning workaround)
