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
`entry_meta` (now including `display_name` — see §6.4).

```
VideoEditorPage (shell, render polling, toolbar)
├─ EntryListPanel           (left: shot list with friendly names + inline rename,
│                            drag-to-reorder via @dnd-kit)
├─ EditorCanvas             (center: scaled canvas, one <iframe> per active entry)
│   └─ LayerHandlesOverlay  (drag / resize / rotate handles + align tools)
├─ TimelineScrubber         (bottom: multi-channel tracks, waveform, gap markers,
│                            mode toolbar for body-drag verb)
├─ PlaybackBar              (transport controls)
├─ AudioTracksPanel         (bg music / sfx — upload, volume, delay, fade)
├─ PropertiesPanel          (right column, seven tabs — friendly labels)
│   ├─ Elements      (was Layers) — DOM tree of the selected entry with
│   │                friendly kind labels (Container / Horizontal Layout /
│   │                Image / Text / Heading / Graphic). Tag-name badges hidden
│   │                in simple mode; SVG filter primitives hidden in simple
│   │                mode. Inspector uses LengthControl/RotationControl with
│   │                raw CSS in `Advanced ▾`.
│   ├─ Position & Size (was Transform) — X/Y/scale/rotation, background
│   │                color picker. Raw background CSS (gradient/URL) lives
│   │                in `Advanced ▾`.
│   ├─ Transitions  (was Motion) — per-entry `transitionIn`/`transitionOut`
│   │                + easing presets (Smooth/Fast/Slow/Linear/Bouncy).
│   │                Custom `cubic-bezier(...)` per side in `Advanced ▾`.
│   ├─ Text         — list of editable text nodes in the entry HTML.
│   ├─ Images & Video (was Media) — replace/delete src.
│   ├─ Overlays     — combined-HTML overlays inside the shot's own document
│   │                (`.vx-overlay > [data-vx-overlay-id]`). Fit labels are
│   │                Fit inside / Fill / Stretch (not Contain / Cover / Fill).
│   └─ Code         (was HTML) — Monaco editor for the raw entry HTML.
│                    Sticky warning banner in simple mode.
├─ AddShotDialog            (insert blank shot at start / current / end / custom range)
├─ AddMediaOverlayDialog    (upload image/video → new overlay *entry* on top;
│                            LayerOrderControl replaces numeric z-index)
└─ stores/video-editor-store.ts  (Zustand, undo/redo 50-step, viewMode
                              toggle, server-synced displayNames)
```

**Two presentation modes** (see §7):
- `simple` (default for all users) — friendly labels everywhere; raw-CSS /
  class / tag-name / Code-tab content kept reachable but tucked into
  `Advanced ▾` disclosures.
- `developer` — same controls, advanced disclosures pre-expanded, tag-name
  badges shown in the tree. Toggle: wrench icon in the toolbar or
  `Cmd/Ctrl+Shift+D`.

**Rendering model:** every active Entry at the current `currentTime` becomes
its *own* sandboxed `<iframe srcDoc={html}>` stacked by `entry.z`. The canvas
just CSS-scales a fixed-size (`meta.dimensions`) container to fit.

**Edit model:** edits rewrite the Entry HTML *string* — `DOMParser` →
mutate → `body.innerHTML`. Geometry-aware utilities live next to the panels:
- [html-text-editor.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/html-text-editor.ts)
- [html-media-editor.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/html-media-editor.ts)
- [html-overlay-editor.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/html-overlay-editor.ts) (combined-HTML overlay layer — see §4)
- [html-tree.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/html-tree.ts) (Layers-tab DOM tree adapter)
- [registry/friendly-labels.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/registry/friendly-labels.ts) (NEW — tag → friendly label, friendlyEntryName)
- [controls.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/controls.tsx) (NEW — LengthControl, RotationControl, LayerOrderControl, FIT_LABELS)
- [AdvancedSection.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/AdvancedSection.tsx) (NEW — shared collapsible)

**Per-entry overlays** (transforms, transitions, backgrounds) live in store
maps and are baked into a wrapper `<div data-vx-shot="1">` only on save.

**Timeline interactions** (see §5):
- Edge drag → `resizeEntryEdge` (slip/roll/ripple).
- Body drag → `moveEntries` (move / ripple).
- Row drag in EntryListPanel → `reorderEntries` via atomic `/frame/reorder`.

**Backend surface** (ai_service `/external/video/v1`):
- `frame/regenerate` — AI-rewrite an existing frame (preview-then-confirm).
- `frame/add` — append/insert a new HTML frame; extends `total_duration`.
  Now accepts `entry_meta` (e.g. for renames-before-first-save).
- `frame/update` — overwrite a frame's HTML and timing. Now accepts
  `entry_meta` (shallow-merge into existing).
- `frame/delete` — remove a frame by `entry_id` (preferred) or `frame_index`.
- `frame/reorder` — move a frame by `entry_id`. Atomic single-S3-PUT.
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
| B1 | `EditorCanvas.tsx`, every entry iframe | ✅ | Sandbox is `allow-scripts` only — `allow-same-origin` dropped. |
| B2 | `html-media-editor.ts`, `replaceMediaSrc` / `buildMediaOverlayHtml` | ✅ | `sanitizeMediaUrl` allowlists `http(s):` / `blob:` / `data:image/`. |
| B3 | `html-text-editor.ts` patch path | ⚠ | Most writes use `textContent`. A few `innerHTML` paths still need a once-over for safety against user-derived strings. |
| B4 | `AddMediaOverlayDialog` raw-HTML mode | ✅ | Removed entirely; dialog is upload-only. |
| B15 | Route file `edit/$videoId/index.lazy.tsx` | ⚠ | `apiKey` stashed to sessionStorage then stripped from URL. History/referer logs from the first hit still see it; true fix is a short-lived signed token + auth header. |

### 2.2 Correctness

| # | Where | Status | Notes |
|---|---|---|---|
| B5 | `AddShotDialog.tsx` — id collisions | ✅ | New entries use `crypto.randomUUID()`. |
| B6 | `video-editor-store.ts` — dirty tracking baseline | ❌ | A transform set then reset to identity still leaves the entry in `dirtyEntryIds`. Compare against baseline, not "touched". |
| B7 | `video-editor-store.ts` — save loop partial-failure | ❌ | Sequential POSTs; if the Nth fails, earlier ones are persisted with no rollback or per-entry status. |
| B8 | `track-layout.ts` — `assignChannelGroups` user_driven branch | ❌ | Greedy interval scheduling assumes `inTime/exitTime`; user-driven entries overlap on track 0. |
| B9 | `TimelineScrubber` scrub math | ❌ | `t/totalDuration*100` with no clamp. |
| B10 | `html-text-editor.ts` — transform merge regex | ❌ | `/translate\([^)]*\)\s*/g` strips translates inside `matrix(...)`. |
| B11 | `PropertiesPanel` Code tab — Tab key handling | ❌ | Cursor restoration inside `requestAnimationFrame` loses position during typing debounce. |
| B12 | `VideoEditorPage` render polling | ⚠ | Sticky via `localStorage`; fixed 10 s × 180 polls with silent retry — needs exponential backoff + visible "last check failed" status. |
| B13 | `use-audio-waveform.ts` | ❌ | Decodes on main thread; large blob freezes UI. |
| B14 | `AudioTracksPanel` ↔ `audio-track-api.ts` | ❌ | Hand-written camelCase ↔ snake_case mapping. |
| B16 | `EditorCanvas` iframe key per entry | ❌ | Every prop change re-mounts the iframe (browser can't diff `srcDoc`). |
| ➕ B17 | `AddShotDialog` insert with overlap | ❌ | "At current time" with `duration: 5` may overlap the existing shot. No ripple, no warning. |
| ➕ B18 | `AddShotDialog` "At end" stacking | ❌ | Repeated "Add at end" clicks after a save stack new end-shots silently. |
| ➕ B19 | Extending `total_duration` is silent | ❌ | `addEntry` bumps `total_duration` past existing narration; bg music isn't extended (no `loop` flag on `AudioTrack`); captions don't cover the tail. |
| ➕ B20 | Overlays-tab Height defaulted to a fixed square | ✅ | Image/video overlays now default to width-only / natural aspect. Explicit Height slider with Auto/Set toggle. |
| ➕ B21 | Layers tab — image/video had URL field only | ✅ | URL input + Upload button (re-uses `useFileUpload`). |
| ➕ B22 | Deleting a saved shot didn't persist | ✅ | New backend `POST /frame/delete`; frontend tracks `deletedEntryIds`. |
| ➕ B23 | Layers tab and Overlays tab can both edit the same overlay | ❌ | Edits in one tab can be partially overwritten by the other. Phase 3-of-editing-bugs is to collapse Layers + Overlays into one tab with chips. |
| ➕ B24 | Reorder via sequential `/frame/update` was destructive | ✅ | New atomic `POST /frame/reorder` endpoint by `entry_id`; frontend queues ops in `pendingReorders`. |
| ➕ B25 | Ripple drag didn't preview the growing timeline | ✅ | `totalDuration` derived from `previewedEntries`; `totalDurationRef` keeps the in-flight drag closure live. |
| ➕ B26 | Snap to non-grid targets lost precision | ✅ | `applySnap` returns `{ delta, snapped }`; post-snap quantize skipped when snap fired. |
| ➕ B27 | Ripple-mode snap targets included clips that themselves ripple | ✅ | Downstream rippling clips filtered out of snap targets when `dragMode === 'ripple'`. |
| ➕ B28 | Clearing a renamed entry didn't propagate to the server | ✅ | `setEntryDisplayName` previously deleted the displayNames key on empty input; `saveChanges` then read `undefined` and skipped `entry_meta`. Server `display_name` survived across devices. Fix: store empty string as a sentinel so the save loop sends `entry_meta: { display_name: '' }`; server already drops the key when display_name is empty. |
| ➕ B29 | Renames on never-saved entries were lost | ✅ | `frame/add` didn't accept `entry_meta`. A shot the user renamed before its first save persisted on the server *without* `display_name`; localStorage was cleared on save success → rename vanished on reload. Fix: `AddFrameRequest`/`add_video_frame` accept `entry_meta` and the frontend sends the pending display_name on the add path. |
| ➕ B30 | MotionTab easing picker lied when In/Out easings differed | ✅ | Divergent easings produced `sharedEasing === undefined`, then `easingPresetFor(undefined)` returned "Smooth" — visually claiming all was Smooth even though the two transitions differed. Fix: compute `effectiveEasing` with explicit fallback to `'ease'` per side, treat true divergence as `null`, and only call `easingPresetFor` for non-null values. "Custom easing — see Advanced below" warning now appears correctly. |
| ➕ B31 | localStorage persisted empty-string display-name sentinels | ✅ | A pending clear written to localStorage would survive reload visually (showing auto-name) but the dirty bit didn't, so saveChanges would never push the clear to the server → silent permanent desync. Fix: `persistDisplayNames` strips empty strings before writing; pending clears are in-memory only (lost on reload, same as any other unsaved edit). |

### 2.3 UX / polish

- **Transitions exist** (Transitions tab) for fade / slide / zoom / wipe + easing presets.
- **Move-mode drag exists** (Move + Ripple via mode toolbar). Slide / Swap deferred.
- **viewMode toggle exists** — friendly defaults for all users; raw inputs reachable via `Advanced ▾`.
- Selection outline still transformed with the entry — goes off-screen when scaled / rotated. Draw the ring in screen space.
- No multi-select, no copy/paste of entries, no align/distribute across entries. `moveEntries(ids: string[], ...)` is plural-ready.
- Portrait layout branch exists (`isPortrait`) but falls through to the 3-panel desktop layout.
- Canvas safe-area / thirds / center guides exist (`CanvasGuides`).
- Large-HTML warning at 50 KB is advisory only; should block save above a hard cap.

---

## 3. How a user *currently* adds text / image / video

### 3.1 Text
- **Inside a shot's HTML**: Properties → Text or Code tab.
- **As a free-positioned overlay**: Properties → Overlays tab → `+ Text`.

### 3.2 Image / video

| Surface | What it does | When it makes sense |
|---|---|---|
| **Add Media Overlay** dialog (toolbar) | Upload → wraps in HTML → appends as a *separate Entry* layered on top. | Whole-screen overlay with timing different from the base shot. |
| **Overlays tab** in Properties panel | Upload → appends as `[data-vx-overlay-id]` child of `.vx-overlay` in the same entry HTML. | Default for "add a logo / sticker / picture-in-picture to this shot". |
| **Layers tab** (Elements in simple mode) | Edit an existing `<img>`/`<video>` (URL + Upload). | When the AI-generated shot already contains the image/video to swap. |

Combined-HTML (§4) is the authoritative path for overlays going forward.

---

## 4. Combined-HTML overlay layer — built

Shipped. The HTML shape, store actions, and Overlays-tab UI all exist.

### 4.1 HTML shape

```html
<div class="vx-base" style="position:absolute;inset:0;z-index:0"> … </div>
<div class="vx-overlay" style="position:absolute;inset:0;z-index:500;pointer-events:none">
  <div data-vx-overlay-id="ov-…" data-vx-kind="text" style="…">Hello world</div>
  <div data-vx-overlay-id="ov-…" data-vx-kind="image" style="…">
    <img src="…" style="width:100%;height:auto;display:block"/>
  </div>
</div>
```

Key invariants: percentage geometry; `data-vx-overlay-id` as the stable
identifier; `pointer-events:none` on the container; image overlays default
to width-only / natural aspect.

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

`canvas` lets the parser tolerate px values committed by canvas drag/resize
handles (px → % conversion). `findOverlayPath` bridges Overlays-tab
selection into `selectedLayerPath` so the canvas drag handles work for
overlays.

### 4.3 Timing inside one HTML

Not yet built. `OverlayBase.appearAt` / `disappearAt` exist in the model but
aren't surfaced in the UI and aren't emitted into the HTML as CSS animation.

---

## 5. Move / Ripple / Reorder — built (Phase 1)

### 5.1 Body-drag in the timeline

Mode toolbar in [TimelineScrubber](../../frontend-admin-dashboard/src/components/ai-video-editor/TimelineScrubber.tsx):

- **Move (M, default)** — shift `inTime/exitTime` by `Δt`. Duration preserved.
- **Ripple (R)** — shift selected clip(s) + every non-branding entry whose
  `inTime ≥ max(originalExitTime of selection)`. `total_duration`
  grows/shrinks. Banner warns: "narration audio not shifted".
- **Slide / Swap** — buttons rendered disabled with "Coming soon".

Drag mechanics:
- 8 px edge hit zone, body grab on the remainder. Below ~28 px clip width
  body grab disables.
- `MIN_SHOT_DURATION = 0.2 s`, `SNAP_S = 0.1 s` shared with `resizeEntryEdge`.
- Snap targets: other clip edges, playhead, `0`, `total_duration`. Ripple
  filters out downstream rippling clips.
- `Alt + drag` disables snap.
- Mouseup < 3 px displacement + 0 delta = click → seek to clip start
  (preserves click semantics).
- `totalDuration` derived from `previewedEntries`; `totalDurationRef`
  feeds the in-flight drag closure.

### 5.2 Drag-to-reorder in EntryListPanel

`@dnd-kit/sortable` powers a hover-revealed `GripVertical` handle. Branding
entries show a `Lock` icon. Drop fires `reorderEntries(fromIndex, toIndex)`.

### 5.3 Persistence — atomic `/frame/reorder`

The naive "mark every shifted entry dirty + `/frame/update` for each"
approach was destructive: `/frame/update` overwrites by position, so the
first POST destroyed the entry at the target position. Fix: new endpoint
[`POST /external/video/v1/frame/reorder`](../../ai_service/app/routers/external_video_generation.py)
takes `entry_id` + `to_index` and rewrites the timeline JSON in one S3 PUT.
Frontend queues `pendingReorders[]` and the save loop processes them after
deletes and before adds/updates so subsequent `/frame/update` indices line
up. Stale ops are dropped when the corresponding entry is deleted.

### 5.4 Out of scope (deferred)

- **Slide** and **Swap** body-drag modes.
- **Multi-select** (store action is plural-ready).
- **Audio clip drag on the timeline** — audio tracks aren't rendered as
  timeline rows; needs new track row surface first.
- Sentence-boundary snap targets, visible snap markers.
- Cross-channel y-axis drag.

---

## 6. Layman-friendly editor — built (Phase 1 + 2 + 3)

A non-techy user opening the editor in default (simple) mode sees friendly
labels everywhere. Every advanced control remains reachable behind a
collapsed `Advanced ▾` disclosure or the developer-mode toggle.

### 6.1 Foundation

- **`viewMode: 'simple' | 'developer'`** in the store, persisted to
  `localStorage['vx-view-mode']`. Toolbar `<Wrench>` button + `Cmd/Ctrl+Shift+D`.
- **[registry/friendly-labels.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/registry/friendly-labels.ts)**
  — single source of truth:
  - `inferDisplayMeta({ tag, kind, style })` → `{ label, icon, advanced }`.
    Containers are auto-classified from `display`/`flex-direction` into
    `Container` / `Horizontal Layout` / `Vertical Layout` / `Grid Layout`.
    SVG filter primitives (`feTurbulence`, `feDisplacementMap`, …) are
    marked `advanced` and hidden from the simple-mode tree.
  - `PROPERTY_META` table for property-label friendly names.
  - `friendlyEntryName(entry, index, entries, overrides)` — overrides win,
    then branding-prefix special cases (Intro / Outro / Watermark), then
    overlay numbering, then `Scene N`.
  - `friendlyChannelLabel(id)` — `base → Main`, `overlay → On top`,
    `ui → Watermarks`.
- **[AdvancedSection.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/AdvancedSection.tsx)**
  — shared collapsible disclosure. Collapsed by default in simple mode;
  pre-expanded in developer mode. Local state syncs to viewMode on toggle.

### 6.2 Friendly controls

[controls.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/controls.tsx):
- **`<LengthControl>`** — % slider with `Auto` toggle. `Custom` falls back
  to a raw text input for `auto` / `px` / `calc(...)` values.
- **`<RotationControl>`** — `-180°…180°` slider that surgically updates
  the `rotate(Ndeg)` portion of a CSS `transform`, preserving siblings.
- **`<LayerOrderControl>`** — three-button radio (Behind / On top /
  Watermark) mapping to z = 0 / 500 / 9000. Numeric escape hatch lives in
  the dialog's `Advanced ▾`.
- **`FIT_LABELS`** — `Contain → "Fit inside"`, `Cover → "Fill"`,
  `Fill → "Stretch"` + description tooltips.

### 6.3 Per-panel changes

| Surface | Simple-mode change | Developer-mode behaviour |
|---|---|---|
| Tab labels | Elements / Position & Size / Transitions / Text / Images & Video / Overlays / Code | Same labels |
| Elements (Layers tab) | Row labels from `inferDisplayMeta`; tag-name badge hidden; SVG filter primitives hidden | Tag-name badge shown next to friendly label; advanced rows visible |
| Elements inspector | `X position` / `Y position` / `Width` / `Height` use `LengthControl`; rotation slider in `Advanced ▾` alongside raw transform / CSS class / z-index | `Advanced ▾` pre-expanded |
| Position & Size | Background color picker primary; raw background CSS (gradient/URL) in `Advanced ▾` | `Advanced ▾` pre-expanded |
| Transitions | Easing presets row (Smooth / Fast / Slow / Linear / Bouncy); per-side `cubic-bezier(...)` in `Advanced ▾` | `Advanced ▾` pre-expanded |
| Overlays | Friendly fit labels with descriptions; LayerOrderControl in AddMediaOverlay | Numeric z-index input also visible (in dialog's Advanced) |
| Code tab | Sticky amber banner: "Editing raw code can break the layout. Most edits are easier in the other tabs." | Banner suppressed |
| Properties header | Friendly name (`Scene 4   0:10 → 0:14`) | Friendly name + faded `entry.id` + `z:N` prefix |
| EntryListPanel | UUIDs gone — `Scene N` / `Intro` / `Outro` / `Watermark` / `Overlay N`. Double-click or pencil-icon inline rename. Branding rows are renameable but locked from reorder. | Same |
| TimelineScrubber channel labels | Main / On top / Watermarks | Same |

### 6.4 Display-name persistence

Server is the source of truth via `entries[].entry_meta.display_name`:
- **Save**: `setEntryDisplayName` marks the entry dirty; `saveChanges`
  sends `entry_meta: { display_name: <value> }` on the existing
  `/frame/update` (and now `/frame/add`) payload. Empty string means
  "drop the override server-side".
- **Backend merge**: `update_video_frame` and `add_video_frame` shallow-
  merge `entry_meta` into the entry's existing meta. Empty/None
  `display_name` is popped from the merged dict.
- **Load**: `loadTimeline` hydrates `displayNames` from
  `entries[].entry_meta.display_name`, then overlays unsaved local
  renames on top (localStorage cleared on save success).
- **localStorage** is the offline buffer for pending unsaved renames.
  Empty-string sentinels are *not* persisted to disk — they exist only
  in-memory until save (mirrors how every other unsaved edit behaves).

---

## 7. Shot transitions

The Transitions tab implements the explicit per-entry `transitionIn` /
`transitionOut` path with type + duration + per-side easing. Friendly
preset row applied to both transitions; per-side custom `cubic-bezier(...)`
in `Advanced ▾`. Persisted in `entryTransitions`, baked into the shot
wrapper's `animation` / `<style>` on save.

What's open:
- **Transition entries** dragged into gaps — not built.
- **Keyframed transforms per shot** (Ken Burns, slow zooms) — not built.
- **Overlay entrance animations** (§4.3) — not built.
- **Audio fades synced to shot transitions** — `audio_tracks[].fade_in/out`
  exist but aren't wired to shot boundaries.
- **Shot-level filter effects** (blur, color grade, mix-blend) — not built.
- **Speed ramps** — not built.
- **Ducking** — not built.

---

## 8. Suggested execution order — updated

Done ✅ — strikethrough left in for context:

1. ~~Security fixes: drop `allow-same-origin`, URL allowlist, move `apiKey` out of the URL.~~ (B1 ✅, B2 ✅, B4 ✅, B15 ⚠)
2. ~~Correctness — UUID ids.~~ (B5 ✅)
3. ~~Overlay-as-combined-HTML.~~ (§4 ✅)
4. ~~Shot transitions — explicit `transitionIn/Out` path.~~ (Transitions tab ✅)
5. ~~Delete persistence — frontend `deletedEntryIds` + backend `/frame/delete`.~~ (B22 ✅)
6. ~~Layers-tab upload for image/video; Overlays-tab Height slider; overlay selection → canvas handles.~~ (B20 ✅, B21 ✅)
7. ~~Move-mode body drag + Ripple + EntryListPanel reorder + atomic `/frame/reorder`.~~ (§5 ✅, B24 ✅, B25 ✅, B26 ✅, B27 ✅)
8. ~~Layman-friendly editor — viewMode toggle, friendly labels, controls, server-synced renames.~~ (§6 ✅, B28 ✅, B29 ✅, B30 ✅, B31 ✅)

Now:

9. **Collapse Layers (Elements) and Overlays into one tab with chips** (B23).
   Add buttons (Text / Image / Video) become a `+` menu on the unified tab;
   chips filter All / Text / Image / Video / Overlays; the inspector picks
   its control set based on the selected node's kind and whether it sits
   inside `.vx-overlay`.
10. **Stop Add-Shot stacking at end** (B18). When an unsaved end-blank
    already exists, the dialog should select it instead of creating another.

Next, pick from:

11. **Correctness sweep** — B6 (dirty baseline), B7 (per-entry save status
    + retry), B8 (user-driven track layout), B9 (scrubber clamp), B10
    (matrix-safe transform merge). Independent and small.
12. **Audio policy on extend** (B19) — first-class prompt when
    `total_duration` would grow: silent / auto-narrate / loop bg music /
    stretch bg music. Adds `loop` flag to `AudioTrack`. Prereq for any
    "add AI shot at end" flow and for audio-on-timeline drag.
13. **Captions track** — see [CAPTIONS_TRACK_PLAN.md](./CAPTIONS_TRACK_PLAN.md).
14. **Move-mode Phase 2** — Slide and Swap; multi-select; sentence-boundary
    snap targets; audio drag on timeline (gated on §12).
15. **Perf** — B13 (waveform off main thread), B16 (debounce iframe
    re-renders or shadow-root renderer).
16. **Polish** — screen-space selection ring, portrait layout branch,
    keyframed transforms, overlay timing UI (§4.3), large-HTML hard cap.

---

## 9. Open architectural questions

These came up during recent work and haven't been resolved — flagging so
the next pass can pick one:

1. **One tab or two** for layer-vs-overlay editing. Current direction:
   collapse to one (B23 / step 9 above).
2. **Where the renderer authority lives** for time-driven overlay
   visibility (CSS keyframes vs scripted clock).
3. **Should `total_duration` auto-shrink on entry delete?** Today: no —
   `/frame/delete` leaves `total_duration` alone. Surface a "trim total"
   affordance when the user has just deleted the last entry?
4. **AI-shot generation on Add Shot** — skipped per discussion; users add
   blank + use the existing Remake AI flow.
5. **Reorder semantics in time_driven mode** — list reorder changes only
   `frame_index`; visual scrubber order stays driven by `inTime`. Worth a
   UX nudge (tooltip, or hide the grip in time_driven mode).
6. **AdvancedSection on viewMode toggle** — flipping to developer auto-
   expands every advanced section; flipping back collapses them, including
   any the user had manually opened in simple mode. Acceptable today (no
   state lost — they can re-open) but reconsider if user feedback flags it.
7. **`branding-watermark-1`, `-2`** — `friendlyEntryName` returns plain
   "Watermark" for all variants. If a video has multiple watermarks the
   user can't distinguish them by name without renaming each. Low priority.
