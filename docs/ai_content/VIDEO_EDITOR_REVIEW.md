# Video Editor — Architecture Review, Bugs & Improvement Plan

Scope: `frontend-admin-dashboard/src/components/ai-video-editor/*`, the route
`routes/video-api-studio/edit/$videoId/index.lazy.tsx`, and the ai_service
endpoints under `/external/video/v1/frame/*`.

Companion docs:
- [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md)
- [CAPTIONS_TRACK_PLAN.md](./CAPTIONS_TRACK_PLAN.md)

---

## 1. What the editor is today

A browser-based shot editor for AI-generated videos. Each **shot** (Entry) is
a raw HTML fragment with optional `inTime/exitTime` (time-driven) or
`start/end` index (user-driven), plus optional `audio_url`, `z`, and
`entry_meta`.

```
VideoEditorPage (shell, render polling, toolbar)
├─ EntryListPanel           (left: shot list with drag-to-reorder via @dnd-kit)
├─ EditorCanvas             (center: scaled canvas, one <iframe> per active entry)
│   └─ LayerHandlesOverlay  (drag / resize / rotate handles + align tools)
├─ TimelineScrubber         (bottom: multi-channel tracks, waveform, gap markers,
│                            mode toolbar for body-drag verb)
├─ PlaybackBar              (transport controls)
├─ AudioTracksPanel         (bg music / sfx — upload, volume, delay, fade)
├─ PropertiesPanel          (right column with seven tabs)
│   ├─ Layers      — full DOM tree of the selected entry; click any node to
│   │                edit attrs/style, drag/resize from canvas handles.
│   ├─ Transform   — per-entry x/y/scale/rotation + background color/gradient.
│   ├─ Motion      — per-entry `transitionIn`/`transitionOut` (fade, slide,
│   │                zoom, wipe…). Stored in `entryTransitions`; baked into
│   │                the wrapper `<div>` on save.
│   ├─ Text        — list of editable text nodes in the entry HTML.
│   ├─ Media       — list of <img>/<video> nodes; replace/delete src.
│   ├─ Overlays    — combined-HTML overlays inside the shot's own document
│   │                (`.vx-overlay > [data-vx-overlay-id]`). Selection drives
│   │                the on-canvas handles.
│   └─ HTML        — Monaco editor for the raw entry HTML.
├─ AddShotDialog            (insert blank shot at start / current / end / custom range)
├─ AddMediaOverlayDialog    (upload image/video → new overlay *entry* on top)
└─ stores/video-editor-store.ts  (Zustand, undo/redo 50-step)
```

**Rendering model:** every active Entry at the current `currentTime` becomes
its *own* sandboxed `<iframe srcDoc={html}>` stacked by `entry.z`. The canvas
just CSS-scales a fixed-size (`meta.dimensions`) container to fit.

**Edit model:** edits rewrite the Entry HTML *string* — `DOMParser` →
mutate → `body.innerHTML`. Geometry-aware utilities live next to the panels:
- [html-text-editor.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/html-text-editor.ts)
- [html-media-editor.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/html-media-editor.ts)
- [html-overlay-editor.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/html-overlay-editor.ts)
  (combined-HTML overlay layer — see §4)
- [html-tree.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/html-tree.ts)
  (Layers-tab DOM tree adapter)

**Per-entry overlays (transforms, transitions, backgrounds)** live separately
in store maps (`entryTransforms`, `entryTransitions`, `entryBackgrounds`) and
are baked into a wrapper `<div data-vx-shot="1">` only on save, via
`injectShotWrapper` in the store.

**Timeline interactions** (see §5):
- Edge drag (existing) → `resizeEntryEdge` with slip/roll/ripple sub-modes.
- Body drag (Phase 1, shipped) → `moveEntries` in `move` or `ripple` mode,
  picked from a sticky toolbar at the top of the timeline.
- Row drag in EntryListPanel (Phase 1, shipped) → `reorderEntries`, routed
  through the atomic `/frame/reorder` endpoint.

**Backend surface** (ai_service `/external/video/v1`):
- `frame/regenerate` — AI-rewrite an existing frame (preview-then-confirm).
- `frame/add` — append/insert a new HTML frame; extends `total_duration`.
- `frame/update` — overwrite a frame's HTML and timing.
- `frame/delete` — remove a frame by `entry_id` (preferred) or `frame_index`.
- `frame/reorder` — move a frame to a new positional index by `entry_id`.
  Atomic on the server (one S3 PUT of the rewritten timeline); replaces the
  destructive sequential `/frame/update` reorder pattern.
- `sentences/build`, `sentence/regenerate`, `sentence/silence` —
  per-sentence narration editing with audio splice.
- `shot/insert` — fill a narration gap with a generated HTML shot.
- `audio-track/*` — bg music / SFX CRUD.

---

## 2. Bugs & issues — status

Legend: ✅ fixed · ⚠ partial · ❌ open · ➕ new since the last review.

### 2.1 Critical / security

| # | Where | Status | Notes |
|---|---|---|---|
| B1 | `EditorCanvas.tsx`, every entry iframe | ✅ | Sandbox is now `allow-scripts` only — `allow-same-origin` dropped. Entry scripts can no longer reach parent cookies / localStorage. |
| B2 | `html-media-editor.ts`, `replaceMediaSrc` / `buildMediaOverlayHtml` | ✅ | `sanitizeMediaUrl` allowlists `http(s):` / `blob:` / `data:image/`; rejects `javascript:`, `data:text/html`, `file:`, etc. Wired through replace, build, and `html-overlay-editor.ts`. |
| B3 | `html-text-editor.ts` patch path | ⚠ | Text writes go through `textContent`. A few serialization paths still use `innerHTML`/`outerHTML` — needs a once-over to confirm none accept user-derived strings without escaping. |
| B4 | `AddMediaOverlayDialog` raw-HTML mode | ✅ | Raw-HTML paste mode removed; the dialog is upload-only now. Cannot smuggle arbitrary HTML into a new overlay entry. |
| B15 | Route file `edit/$videoId/index.lazy.tsx` | ⚠ | `apiKey` is read from the URL once on mount, then *stashed in sessionStorage and stripped from the URL bar* via `useStashedApiKey`. History/referer logs that captured the first hit still see it. True fix: short-lived signed token + auth header. |

### 2.2 Correctness

| # | Where | Status | Notes |
|---|---|---|---|
| B5 | `AddShotDialog.tsx` — id collisions | ✅ | New entries use `shot-${crypto.randomUUID()}`. |
| B6 | `video-editor-store.ts` — dirty tracking baseline | ❌ | A transform set then reset to identity still leaves the entry in `dirtyEntryIds`. Compare against baseline, not "touched". |
| B7 | `video-editor-store.ts` — save loop partial-failure | ❌ | Sequential POSTs to avoid S3 race. If the Nth POST fails, earlier ones are persisted with no rollback or per-entry status. Collect results, surface per-entry state, allow retry of failed subset. |
| B8 | `track-layout.ts` — `assignChannelGroups` user_driven branch | ❌ | Greedy interval scheduling assumes `inTime/exitTime`. User-driven entries land on track 0 and visually overlap. Short-circuit to "one track per channel" for user_driven. |
| B9 | `TimelineScrubber` scrub math | ❌ | `t/totalDuration*100` with no clamp; scrubber falls off the bar if audio tracks extend past `total_duration`. Clamp in `xToTime`. |
| B10 | `html-text-editor.ts` — transform merge regex | ❌ | `/translate\([^)]*\)\s*/g` strips *all* translates, including those nested in `matrix(...)`. Breaks for AI-generated matrix transforms. |
| B11 | `PropertiesPanel` HTML tab — Tab key handling | ❌ | Cursor restoration inside `requestAnimationFrame` loses position if React re-renders mid-typing. Move to synchronous `setSelectionRange` inside the `onKeyDown` after `setValue`. |
| B12 | `VideoEditorPage` render polling | ⚠ | Now sticky via `localStorage` (job survives reload). Still fixed 10 s × 180 polls with silent retry on errors — needs exponential backoff and a surfaced "last check failed" status. |
| B13 | `use-audio-waveform.ts` | ❌ | Decodes on main thread; a 30 MB blob freezes the UI for seconds. Move to `AudioWorklet` / offscreen worker; explicit CORS-failure handling. |
| B14 | `AudioTracksPanel` ↔ `audio-track-api.ts` | ❌ | Hand-written camelCase ↔ snake_case mapping. Drift-prone; centralize as `toApi/fromApi` pair with a single type. |
| B16 | `EditorCanvas` iframe key per entry | ❌ | Every prop change forces a full iframe reload (browser can't diff `srcDoc`). Mitigated by sticky `key`-by-entry-id, but each save still re-mounts. Debounce edits or move to a shadow-root renderer. |
| ➕ B17 | `AddShotDialog` insert with overlap | ❌ | Inserting "at current time" with `duration: 5` may overlap the shot already there. No ripple, no warning — both render simultaneously (z-stacked). |
| ➕ B18 | `AddShotDialog` "At end" stacking | ❌ | Each successive "Add at end" click after a save creates *another* end-shot at the same time range (different UUIDs). No "you already added one" hint; 3 stacked end-blanks renders as one but persists as three. |
| ➕ B19 | Extending `total_duration` is silent | ❌ | `addEntry` bumps `total_duration` past existing narration. New tail plays over silence; bg music isn't extended (no `loop` flag on `AudioTrack`); captions don't cover the tail. No prompt, no warning. See §4 of `CAPTIONS_TRACK_PLAN.md` and audio-policy discussion. |
| ➕ B20 | Overlays-tab Height defaulted to a fixed square | ✅ | Image/video overlays previously defaulted to `width: 30, height: 30` — a 16:9 image rendered letterboxed in a square. Now: `width: 30` only, height auto (natural aspect). Overlays-tab adds a Height slider with Auto/Set toggle. |
| ➕ B21 | Layers tab — image/video had URL field only | ✅ | Replaced with a composite (URL input + Upload button + hidden file input) via the same `useFileUpload` hook the AddMediaOverlay dialog uses. |
| ➕ B22 | Deleting a saved shot didn't persist | ✅ | Frontend tracked the local removal but the save loop had no work to do, and the backend had no `/frame/delete` endpoint. Reload restored the shot. Fix: new backend endpoint `POST /frame/delete` (by `entry_id`, falls back to `frame_index`); frontend tracks `deletedEntryIds`, processes deletions first in `saveChanges`, includes them in the Save button enable rule and badge count. |
| ➕ B23 | Layers tab and Overlays tab can both edit the same overlay | ❌ | Overlay DOM nodes live inside `.vx-overlay` and are visible from both tabs. Layers writes `style.width: "30%"`; Overlays writes positional `%`. Edits in one tab can be partially overwritten by the other. Mitigated by Overlays-tab `listOverlays` now tolerating `px` values from canvas-handle commits (px → % at parse time), but the tab-duplication itself is unresolved — see "Phase 3 — collapse-with-chips" in the planning discussion. |
| ➕ B24 | Reorder via sequential `/frame/update` was destructive | ✅ | Old reorder marked entries dirty and saved them via `/frame/update` at their new positional indices — but `/frame/update` overwrites by position, so the first save destroyed the entry currently at the target position. Fix: new backend endpoint `POST /frame/reorder` (atomic single S3 PUT, identifies by `entry_id`); frontend tracks `pendingReorders[]` and routes through it before adds/updates. |
| ➕ B25 | Ripple drag didn't preview the growing timeline | ✅ | `totalDuration` was computed from un-rippled `entries`, so the bar stayed the same width while the dragged clip approached the right edge, then snapped at commit. Fix: derive `totalDuration` from `previewedEntries`. A `totalDurationRef` mirrors it so the in-flight drag closure reads the live value without the closure → render feedback divergence. |
| ➕ B26 | Snap to non-grid targets lost precision | ✅ | `applySnap` returned a delta that landed an edge on a target, then `snapTime(delta)` re-quantized it — rounding non-grid targets (playhead, total_duration) by up to half a grid step. Fix: `applySnap` returns `{ delta, snapped }`; the post-snap quantize is skipped when snap fired. |
| ➕ B27 | Ripple-mode snap targets included clips that themselves ripple | ✅ | Snapping to a downstream clip's edge while in ripple mode was meaningless — that clip's edges move in lockstep with the dragged clip. Fix: filter downstream non-branding clips from snap targets when `dragMode === 'ripple'`. |

### 2.3 UX / polish

- **Transitions exist now** (Motion tab) for fade / slide / zoom / wipe.
  See §5 — only some of the §6 menu has shipped.
- **Move-mode drag exists now** (Move + Ripple via mode toolbar). Slide / Swap
  buttons are rendered disabled with "Coming soon" tooltips.
- Selection outline still transformed with the entry — goes off-screen when
  the entry is scaled down or rotated. Draw the ring in screen space.
- No multi-select, no copy/paste of entries, no align/distribute across
  entries (canvas-handle align tool works only for the selected layer).
  `moveEntries(ids: string[], ...)` is plural-ready for when multi-select
  ships.
- Portrait layout branch exists (`isPortrait`) but falls through to the
  3-panel desktop layout.
- Canvas safe-area / thirds / center guides exist (`CanvasGuides`).
- Large-HTML warning at 50 KB is advisory only; should block save above a
  hard cap.
- "Outside playhead" badge on the Properties panel helps when the user
  selects an entry whose range doesn't contain the current scrub time, but
  it's the only signal — the canvas itself shows no indication that the
  selected entry is invisible right now.

---

## 3. How a user *currently* adds text / image / video

### 3.1 Text
- **Inside an existing shot's HTML**: Properties → Text tab (lists every
  editable text node) or HTML tab (raw Monaco editor).
- **As a free-positioned overlay**: Properties → Overlays tab → `+ Text`.
  Creates a `[data-vx-overlay-id]` div inside `.vx-overlay` in the *same*
  HTML document as the shot.

### 3.2 Image / video
Three different surfaces today — the split is a known UX problem:

| Surface | What it does | When it makes sense |
|---|---|---|
| **Add Media Overlay** dialog (toolbar) | Uploads → wraps in HTML → appends as a *separate Entry* layered on top via z-index. Two iframes, two documents at runtime. | When the overlay is a whole-screen element with its own timing different from the base shot. |
| **Overlays tab** in Properties panel | Uploads → appends as a `[data-vx-overlay-id]` child of `.vx-overlay` in the same entry HTML. One iframe, one document. | The default for "add a logo / sticker / picture-in-picture to this shot". |
| **Layers tab** in Properties panel | Lets you edit an existing `<img>`/`<video>` node anywhere in the entry tree (URL + Upload button). | When the AI-generated shot already contains the image/video you want to swap. |

For overlays in particular, the **combined-HTML** model (§4) is the
authoritative path going forward. The "Add Media Overlay" dialog is kept
for explicit z-stacking use cases but is no longer the recommended entry
point.

---

## 4. Combined-HTML overlay layer — built

Shipped. The HTML shape, store actions, and Overlays-tab UI all exist.

### 4.1 HTML shape

```html
<!-- existing shot content, untouched -->
<div class="vx-base" style="position:absolute;inset:0;z-index:0">
  …
</div>

<!-- overlay layer, same document -->
<div class="vx-overlay" style="position:absolute;inset:0;z-index:500;pointer-events:none">
  <div data-vx-overlay-id="ov-…" data-vx-kind="text"
       style="position:absolute;left:50%;top:50%;width:40%;transform:translate(-50%,-50%);font-size:48px;color:#fff;…">
    Hello world
  </div>
  <div data-vx-overlay-id="ov-…" data-vx-kind="image"
       style="position:absolute;left:50%;top:50%;width:30%;transform:translate(-50%,-50%)">
    <img src="https://cdn…/logo.png" style="width:100%;height:auto;display:block" alt=""/>
  </div>
</div>
```

Key invariants:
- One **overlay container** per shot, `position:absolute;inset:0`, high z-index.
- Each overlay is a positioned child with **percentage geometry** so the
  shot renders identically at 1080p preview and 4K export.
- `data-vx-overlay-id` is the stable id — never indexed.
- `pointer-events:none` on the container keeps iframe click-through working.
- Image overlays default to `width:N%` only, height `auto` → preserve
  natural aspect ratio. Setting Height explicitly switches the inner
  element to `width:100%;height:100%;object-fit:<fit>`.

### 4.2 API surface — `html-overlay-editor.ts`

```ts
export function listOverlays(html: string, canvas?: { w: number; h: number }): Overlay[];
export function upsertOverlay(html: string, overlay: Overlay): string;
export function deleteOverlay(html: string, overlayId: string): string;
export function findOverlayPath(html: string, overlayId: string): number[] | null;
export function newTextOverlay(text?: string): TextOverlay;
export function newImageOverlay(src: string): ImageOverlay;
export function newVideoOverlay(src: string): VideoOverlay;
```

The `canvas` arg on `listOverlays` makes the parser tolerate the **px
values** that the canvas drag/resize handles commit via the generic
`patchNodeStyle` path. `parsePercentOrPx` converts px → % using the canvas
dimensions so the overlay model stays in %, while the handles infra
doesn't need a special case.

`findOverlayPath` returns the `body`-relative visible-child path of an
overlay element, using the same indexing as `editor-iframe-agent.ts` and
`html-tree.ts`. The Overlays-tab uses it to set `selectedLayerPath` when
the user clicks an overlay row, which is exactly what
`LayerHandlesOverlay` reads to draw the drag/resize/rotate handles.

### 4.3 Store & UI hooks
- Overlays-tab: list + per-row inline editor (text content, font size,
  color, align, src replace, X/Y/Width/Height/Opacity sliders).
- Click an overlay row → header strip highlights → canvas handles appear.
- Drag/resize/rotate handles work for overlays exactly like Layers-tab nodes
  (same `vx-resize-to-rect` postMessage roundtrip).

### 4.4 Timing inside one HTML

Not built. `OverlayBase.appearAt` / `disappearAt` exist in the model but
aren't surfaced in the UI and aren't emitted into the HTML as CSS
animation. Path forward stays the same as the original plan: pure-CSS
keyframes injected at save time, or a tiny scripted clock for
user-driven timelines.

---

## 5. Move / Ripple / Reorder — built (Phase 1)

### 5.1 Body-drag in the timeline

A mode toolbar at the top of [TimelineScrubber](../../frontend-admin-dashboard/src/components/ai-video-editor/TimelineScrubber.tsx)
picks the verb for body drag:

- **Move (M, default)** — shift `inTime`/`exitTime` by the same delta;
  preserves duration. Clamps so `inTime ≥ 0` and `exitTime ≤ total_duration`.
  Nobody else moves.
- **Ripple (R)** — shift the selected clip(s) AND every non-branding entry
  whose `inTime ≥ max(originalExitTime of selection)`. `total_duration`
  grows/shrinks accordingly. Branding entries (intro/outro) stay anchored.
  A sticky amber banner warns: *"Ripple mode — narration audio not shifted.
  Playback alignment may drift."*
- **Slide / Swap** — buttons rendered disabled with "Coming soon" tooltips.

Drag mechanics:
- 8 px edge hit zone (resize) + body grab on the remainder. Below 28 px
  total clip width the body grab disables and the edges take over.
- `MIN_SHOT_DURATION = 0.2 s` and `SNAP_S = 0.1 s` shared with `resizeEntryEdge`.
- Snap targets: other clip edges, playhead, `0`, `total_duration`. In
  Ripple mode, downstream rippling clips are filtered out (snap to them
  would be meaningless).
- `Alt + drag` disables snap.
- Mouseup < 3 px displacement + 0 delta = click → seek to clip start
  (preserves original click semantics).
- Live preview applies the drag delta to `previewedEntries`, which feeds
  both the per-clip geometry and `assignChannelGroups` so overlapping
  neighbours visibly push track rows during the drag.
- `totalDuration` is derived from `previewedEntries` so the bar grows live
  during ripple. A `totalDurationRef` mirrors it so the in-flight drag
  closure reads the current value without rebuilding.
- Branding entries (`id.startsWith('branding-')`) are silently locked from
  body drag in any mode.

### 5.2 Drag-to-reorder in EntryListPanel

`@dnd-kit/sortable` powers a hover-revealed `GripVertical` handle on each
row. Branding entries show a `Lock` icon instead. Releasing the drag fires
the store's `reorderEntries(fromIndex, toIndex)`.

### 5.3 Persistence — the atomic `/frame/reorder` endpoint

The naive "mark every shifted entry dirty + send `/frame/update` for each"
approach was destructive: `/frame/update` overwrites by position, so the
first POST in a sequence destroys the entry at the target position. A
partial failure leaves the timeline corrupted.

**Fix:** new backend endpoint
[`POST /external/video/v1/frame/reorder`](../../ai_service/app/routers/external_video_generation.py)
that takes `entry_id` + `to_index`, splices the entry to its new position
in the timeline JSON, and writes the whole file back in one S3 PUT. Atomic;
no partial-failure window. The frontend store queues `pendingReorders[]`
ops and the save loop processes them after deletes and before adds/updates
so any subsequent `/frame/update` calls hit the right post-reorder
indices. Stale reorder ops are dropped when the corresponding entry is
deleted before save.

### 5.4 Out of scope (deferred)

- **Slide** and **Swap** body-drag modes.
- **Multi-select** (store action `moveEntries(ids, ...)` is plural-ready).
- **Audio clip drag on the timeline** — audio tracks aren't currently
  rendered as rows in TimelineScrubber, so this needs a new track row
  surface first.
- Sentence-boundary snap targets, visible snap markers.
- Cross-channel y-axis drag (move clip from base to overlay).

---

## 6. Shot transitions — partial

The Motion tab in PropertiesPanel and `utils/transitions.ts` together
implement the explicit per-entry `transitionIn` / `transitionOut` path
(type + duration + easing), persisted in the store as `entryTransitions`
and baked into the shot wrapper `<div data-vx-shot="1">` on save.

What's open:
- **Transition entries / dragged into gaps** — not built; out of scope for
  now per discussion.
- **Keyframed transforms per shot** (Ken Burns, slow zooms) — not built.
- **Overlay entrance animations** (§4.4) — not built.
- **Audio fades synced to shot transitions** — `audio_tracks[].fade_in/out`
  exist but aren't wired to shot boundaries.
- **Shot-level filter effects** (blur, color grade, mix-blend) — not built.
- **Speed ramps** — not built.
- **Ducking** — not built.

---

## 7. Suggested execution order — updated

Done ✅ — strikethrough left in for context:

1. ~~Security fixes: drop `allow-same-origin`, URL allowlist, move `apiKey` out of the URL.~~ (B1 ✅, B2 ✅, B4 ✅, B15 ⚠ — sessionStorage-stashed, true fix still wanted)
2. ~~Correctness — UUID ids.~~ (B5 ✅)
3. ~~Overlay-as-combined-HTML.~~ (§4 ✅)
4. ~~Shot transitions — explicit `transitionIn/Out` path.~~ (Motion tab ✅)
5. ~~Delete persistence — frontend `deletedEntryIds` + backend `/frame/delete`.~~ (B22 ✅)
6. ~~Layers-tab upload for image/video; Overlays-tab Height slider; overlay selection → canvas handles.~~ (B20 ✅, B21 ✅)
7. ~~Move-mode body drag + Ripple + EntryListPanel reorder + atomic `/frame/reorder` backend endpoint.~~ (§5 ✅, B24 ✅, B25 ✅, B26 ✅, B27 ✅)

Now:

8. **Collapse Layers and Overlays into one tab with chips** (B23). Remove
   the dual-edit footgun. Add buttons (Text / Image / Video) become a `+`
   menu on the unified tab; chips filter All / Text / Image / Video /
   Overlays; the inspector decides which control set to render based on the
   selected node's kind + whether it sits inside `.vx-overlay`.
9. **Stop Add-Shot stacking at end** (B18). When an unsaved end-blank
   already exists, the dialog should select it instead of creating
   another. When a saved end-blank is the most recent edit, prompt rather
   than silently appending.

Next, pick from:

10. **Correctness sweep** — B6 (dirty baseline), B7 (per-entry save
    status + retry), B8 (user-driven track layout), B9 (scrubber clamp),
    B10 (matrix-safe transform merge). These are independent and small.
11. **Audio policy on extend** (B19) — first-class prompt when
    `total_duration` would grow: silent / auto-narrate / loop bg music /
    stretch bg music. Adds `loop` flag to `AudioTrack`. Pre-requisite for
    any "add AI shot at end" flow and for audio-on-timeline drag.
12. **Captions track** — see [CAPTIONS_TRACK_PLAN.md](./CAPTIONS_TRACK_PLAN.md).
    The data is all there (`meta.sentences[]` with rebased word
    timestamps); the UX and renderer hooks are not.
13. **Move-mode Phase 2** — Slide and Swap; multi-select; sentence-boundary
    snap targets; audio drag on timeline (gated on §11).
14. **Perf** — B13 (waveform off main thread), B16 (debounce iframe
    re-renders or shadow-root renderer).
15. **Polish** — screen-space selection ring (canvas), portrait layout
    branch, keyframed transforms, overlay timing UI (§4.4), large-HTML
    hard cap.

---

## 8. Open architectural questions

These came up while editing and weren't resolved — flagging them so the
next pass can pick one:

1. **One tab or two** for layer-vs-overlay editing. Current direction:
   collapse to one (B23 / step 8 above). Alternative considered: keep
   Overlays-tab as a filtered view of Layers and have a single source of
   truth on the patch path. Both work; the collapse approach is being
   pursued for practicality.
2. **Where the renderer authority lives** for time-driven overlay
   visibility (CSS keyframes vs scripted clock). Tied to whether we ever
   drop `allow-scripts` in entry iframes. As long as `allow-scripts` is
   on (it has to be, for gsap/anime), the scripted clock is feasible.
3. **Should `total_duration` auto-shrink on entry delete?** Today: no —
   `/frame/delete` deliberately leaves `total_duration` alone because
   shrinking past an active narration sentence is worse than leaving
   trailing silence. Open: surface a "trim total_duration" affordance in
   the editor when the user has just deleted the last entry.
4. **AI-shot generation on Add Shot.** Skipped for now per discussion;
   user can add a blank and use the existing Remake AI flow to rewrite
   it. Revisit if `/shot/generate` proves materially better than blank +
   remake for cold-start cases.
5. **Reorder semantics in time_driven mode.** Confirmed: list reorder
   changes only the server-side `frame_index`; visual scrubber order
   stays driven by `inTime`. Worth a UX nudge somewhere — in time_driven
   mode, the EntryListPanel reorder has no visible effect on playback,
   which can confuse users. Possibly hide the grip handle in time_driven
   mode, or add a tooltip explaining it.
