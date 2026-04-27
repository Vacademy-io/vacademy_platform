# Video Editor — Architecture Review, Bugs & Improvement Plan

Scope: `frontend-admin-dashboard/src/components/ai-video-editor/*` and the route
`routes/video-api-studio/edit/$videoId/index.lazy.tsx`.

Companion doc: [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md).

---

## 1. What the editor is today

A browser-based shot editor for AI-generated videos. Each **shot** (Entry) is
a raw HTML fragment with optional `inTime/exitTime` (time-driven) or
`start/end` index (user-driven), plus optional `audio_url`, `z`, and
`entry_meta`.

```
VideoEditorPage (shell, render polling)
├─ EntryListPanel           (left: shot list)
├─ EditorCanvas             (center: scaled canvas, one <iframe> per entry)
├─ TimelineScrubber         (bottom: multi-channel tracks, waveform)
├─ PropertiesPanel          (right: Transform / Text / Media / HTML tabs)
├─ AddShotDialog            (insert blank shot)
├─ AddMediaOverlayDialog    (upload image/video → new overlay entry)
├─ AudioTracksPanel         (bg music / sfx tracks)
└─ stores/video-editor-store.ts  (Zustand, undo/redo 50-step)
```

**Rendering model:** every active Entry at the current `currentTime` becomes
its *own* sandboxed `<iframe srcDoc={html}>` stacked by `entry.z`. The canvas
just CSS-scales a fixed-size (`meta.dimensions`) container to fit. See
[EditorCanvas.tsx:175-227](../../frontend-admin-dashboard/src/components/ai-video-editor/EditorCanvas.tsx#L175-L227).

**Edit model:** edits rewrite the Entry HTML *string* — DOMParser →
mutate → `body.innerHTML`. Transforms (x/y/scale/rotation) live separately
in `entryTransforms` and are baked into a wrapper `<div
style="position:absolute;inset:0;transform:...">` only on save, via the
`WRAPPER_RE` regex round-trip ([video-editor-store.ts:33-34, 378-431](../../frontend-admin-dashboard/src/components/ai-video-editor/stores/video-editor-store.ts#L33-L34)).

---

## 2. Bugs & issues found

### 2.1 Critical / security

| # | Where | Issue |
|---|---|---|
| B1 | `EditorCanvas.tsx:194-211`, every entry iframe | `srcDoc` renders unsanitized HTML with `sandbox="allow-scripts allow-same-origin"`. Because the sandbox includes **both** `allow-scripts` and `allow-same-origin`, any script in entry HTML can reach the parent origin's cookies/localStorage. This is the exact combo the HTML spec warns against. Either drop `allow-same-origin`, or sanitize HTML with DOMPurify before rendering. |
| B2 | `html-media-editor.ts:66-97`, `replaceMediaSrc` | No validation of `newSrc`. `javascript:` and `data:text/html` URLs pass through. Same for `buildMediaOverlayHtml` (line 141). Allow only `http(s):`, `blob:`, and your S3 origin. |
| B3 | `html-text-editor.ts` patch path | Text content is re-inserted via `textContent` in most places, which is safe, but `innerHTML` is used in some serialization paths. Audit every `innerHTML`/`outerHTML` write in both editors. |
| B4 | `AddMediaOverlayDialog` raw-HTML mode | User can paste arbitrary HTML; no allowlist. Same XSS class as B1. |

### 2.2 Correctness

| # | Where | Issue |
|---|---|---|
| B5 | `AddShotDialog.tsx:86` | New entry id = `Date.now()`. Two adds in the same tick collide. Use `crypto.randomUUID()`. |
| B6 | `video-editor-store.ts` — dirty tracking | A transform set and then reset to identity still leaves the entry in `dirtyEntryIds`, causing an unnecessary re-save. Compare against baseline, not "touched". |
| B7 | `video-editor-store.ts:378-431` — save loop | Sequential POSTs to avoid S3 races (comment C26). If the 3rd of 5 fails, shots 1-2 are persisted and 3-5 aren't, with no rollback or user-visible "partially saved" state. Collect results, surface per-entry status. |
| B8 | `track-layout.ts` — `assignChannelGroups` | Greedy interval scheduling assumes sorted entries and doesn't handle `user_driven` (no `inTime/exitTime`) — all land on track 0 and visually overlap. Short-circuit to "one track per channel" for user_driven. |
| B9 | `TimelineScrubber` scrub math | `t/totalDuration*100` with no clamp; if the user drags past the end while audio tracks extend beyond `total_duration`, scrubber falls off the bar. Clamp in `xToTime`. |
| B10 | `html-text-editor.ts:214-227` — transform merge | Regex `/translate\([^)]*\)\s*/g` strips *all* translates, including those inside `matrix(...)` or nested in `transform-box` context. Breaks if the AI generates matrix-based transforms. |
| B11 | `PropertiesPanel` HTML tab, Tab key handling (L580-595) | Cursor restoration inside `requestAnimationFrame` loses position if React re-renders in between (common during typing debouncing). Use the native `setSelectionRange` synchronously inside the `onKeyDown` handler after `setValue`. |
| B12 | `VideoEditorPage` render polling (L170-217) | 10s interval × 180 polls = 30 min, hard-coded; on network error it retries silently. Exponential backoff + surfaced "last check failed" status. |
| B13 | `use-audio-waveform.ts` | Decodes on main thread; a 30 MB audio blob freezes the UI for seconds. Move to an `AudioWorklet` or offscreen worker; also handle CORS failure explicitly. |
| B14 | `AudioTracksPanel` → `audio-track-api.ts:30` | Hand-written camelCase → snake_case mapping. Easy to drift from backend DTO. Centralize as a single `toApi/fromApi` pair with a type. |
| B15 | Route file `edit/$videoId/index.lazy.tsx` | `apiKey` is pulled from `useSearch` and forwarded as a prop — i.e. placed in the URL query. API keys should never travel in the query string (logs, referrers, history). Move to an auth header or session. |
| B16 | `EditorCanvas` iframe key = `editor-${entry.id}` | Good for identity, but *every* prop change forces a full iframe reload (browser can't diff srcDoc). Debounce edits or switch to a shadow-root renderer (see §4). |

### 2.3 UX / polish

- No transition animations between shots → hard cuts.
- Selection outline is transformed with the entry — goes off-screen when the entry is scaled down or rotated. Draw the ring in screen space.
- No multi-select, no copy/paste of entries, no align/distribute.
- Portrait layout branch exists (`isPortrait`) but falls through to the 3-panel desktop layout.
- Canvas doesn't show safe-area guides for the final video aspect.
- Large-HTML warning at 50 KB is advisory only; should block save above a hard cap.

---

## 3. How a user *currently* adds text / image / video

**Text** — edit the shot HTML directly (Properties → Text or HTML tab). Text
is always inside the shot's HTML string.

**Image / Video overlays** — `AddMediaOverlayDialog` does **not** merge into
the current shot. It creates a **new Entry** with a higher `z` and
(typically) the same `inTime/exitTime`, which `EditorCanvas` stacks as a
second `<iframe>` on top. Two iframes, two documents.

```
┌────────── canvas ──────────┐
│ ┌── iframe (entry A, z=10) │  ← base shot HTML
│ │   ...                    │
│ └──────────────────────────┤
│ ┌── iframe (entry B, z=500)│  ← media overlay HTML
│ │   <img .../>             │
│ └──────────────────────────┘
└────────────────────────────┘
```

That is the **layered entries** model. It works but it's not what you're
asking for.

---

## 4. Adding overlays as a *combined HTML* (single-document top layer)

You want the overlay baked into the *same HTML document* as the shot, so the
server sees one HTML per shot and layering is just z-index inside that DOM.

### 4.1 Target HTML shape

Wrap the existing shot body, then append a positioned overlay layer:

```html
<!-- existing shot content, untouched -->
<div class="vx-base" style="position:absolute;inset:0;z-index:0">
  <!-- … original shot nodes … -->
</div>

<!-- new overlay layer, same document -->
<div class="vx-overlay" style="position:absolute;inset:0;z-index:500;pointer-events:none">
  <!-- absolute-positioned children, one per overlay -->
  <div data-vx-overlay-id="ov_abc"
       style="position:absolute;left:40%;top:65%;width:20%;transform:translate(-50%,-50%);
              font:600 32px/1.2 Inter,sans-serif;color:#fff;text-shadow:0 2px 8px #0008">
    Hello world
  </div>

  <img data-vx-overlay-id="ov_def"
       src="https://cdn…/logo.png"
       style="position:absolute;left:4%;top:4%;width:120px;height:auto;opacity:.9"/>

  <video data-vx-overlay-id="ov_ghi"
         src="https://cdn…/clip.mp4" autoplay muted loop playsinline
         style="position:absolute;right:4%;bottom:4%;width:25%;object-fit:cover;border-radius:12px"></video>
</div>
```

Key points:

- One **overlay container** per shot, `position:absolute;inset:0`, high z-index.
- Each overlay is a positioned child with percentage geometry (resolution-independent — good for `object-fit` and rendering at different sizes).
- `data-vx-overlay-id` lets the editor find/update/delete the node deterministically without indices.
- `pointer-events:none` on the container keeps iframe click-through working.

### 4.2 New util: `html-overlay-editor.ts`

Mirror `html-media-editor.ts` with these exports:

```ts
type OverlayKind = 'text' | 'image' | 'video';
type Pct = number; // 0..100

interface OverlayPatch {
  id?: string;
  kind: OverlayKind;
  // geometry in % of canvas — survives resizing
  left: Pct; top: Pct; width?: Pct; height?: Pct;
  anchor?: 'tl' | 'center' | 'br';
  rotation?: number;
  opacity?: number;
  // kind-specific
  text?: string; fontPx?: number; color?: string; weight?: number; align?: 'l'|'c'|'r';
  src?: string; objectFit?: 'contain'|'cover'|'fill';
  // timing within the shot (relative seconds)
  appearAt?: number; disappearAt?: number;
}

export function listOverlays(html: string): OverlayPatch[];
export function upsertOverlay(html: string, patch: OverlayPatch): string;
export function deleteOverlay(html: string, id: string): string;
```

Implementation outline:

1. `DOMParser.parseFromString(html, 'text/html')`.
2. Find `div.vx-overlay`; create it if missing (append to `<body>`).
3. For insert/update, find/create `div[data-vx-overlay-id=…]`, set inline styles from the patch, set innerHTML (text) / `src` (media). Sanitize text via `textContent`, sanitize URLs with an allowlist of `https:` / `blob:` / your S3 origin (fixes B2).
4. Serialize with `doc.body.innerHTML`.
5. For base-layer wrapping, do it **once** on first overlay insert: if there's no `.vx-base`, wrap the existing `body.childNodes` into one before appending the overlay layer.

### 4.3 Store & UI hooks

- Store action: `addOverlay(entryId, patch)` / `updateOverlay(entryId, overlayId, patch)` / `deleteOverlay(entryId, overlayId)`. All just call the new util on the entry's HTML and push an undo snapshot.
- Properties panel: add a fifth tab **"Overlays"** listing `listOverlays(html)` with inline editors (same controls as the existing Text/Media tabs, but geometry uses % sliders).
- Canvas: add drag/resize handles for the selected overlay. Use `screenToCanvas` (already in [coord-convert.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/coord-convert.ts)) to translate pointer deltas into `%` geometry.
- Add dialog: `AddMediaOverlayDialog` gets a toggle — "As new entry (layer)" vs "As overlay on selected shot (combined HTML)". The latter calls `addOverlay` instead of `addEntry`.

### 4.4 Timing inside one HTML

Combined HTML means one iframe, one timeline. To appear/disappear overlays inside a shot, use CSS animations keyed to the shot's relative time. Two options:

- **Pure CSS** (simplest): emit `animation: vx-fade-in .3s <appearAt>s both, vx-fade-out .3s <shotDur - disappearAt>s both;` on each overlay and inject one `<style>` with the keyframes. Good for preview; will render identically in the final MP4 as long as the renderer drives the iframe clock.
- **Scripted** (flexible): a tiny inlined `<script>` that reads `document.currentTime` from a parent message, applies `visibility`/`opacity` per overlay. Required for user-driven timelines where "time" is really an index. This needs `allow-scripts` (already enabled) but please *remove* `allow-same-origin` when you do this (fixes B1).

---

## 5. Transition possibilities between shots

Today: hard cuts. You have a few realistic options, cheapest first.

### 5.1 Per-shot CSS enter/leave (no data model change)
On every entry add an `animation` to the wrapper `<div>`:
```css
/* enter */ animation: vx-enter .4s ease both;
/* leave */ animation: vx-leave .4s ease both;
```
EditorCanvas already renders two iframes when two shots overlap in time
(e.g. if `entryA.exitTime = 5.0` and `entryB.inTime = 4.6`). Just by giving
each entry enter/leave CSS keyframes and letting the timeline overlap them
by a small window, you get **cross-fade, slide-in, zoom-in, wipe** for free
with no renderer changes. This is the 80% solution.

### 5.2 Explicit `transition` on Entry
Extend the schema:
```ts
interface Entry {
  transitionIn?:  { type: 'fade'|'slide-l'|'slide-r'|'zoom'|'wipe'; duration: number; easing?: string };
  transitionOut?: { type: ...;                                        duration: number; easing?: string };
}
```
The editor auto-overlaps neighbours by `max(out.duration, next.in.duration)` and injects the right CSS. PropertiesPanel gets a "Transitions" section with a dropdown and a duration slider. Backend stores it as-is; renderer reproduces the same CSS.

### 5.3 Transition entries (timeline blocks)
Model the transition itself as a special entry kind (`type: 'transition'`) that sits between two shots, has duration, and knows both neighbours' last/first frames. Gives the cleanest UI (drag a transition from the library onto the gap) at the cost of renderer work — this is what DaVinci/Premiere do. Overkill unless you need effects like light-leak, particle, or video-based transitions.

### 5.4 Practical additions beyond transitions

- **Keyframed transforms per shot.** Promote `entryTransforms` to an array of keyframes `[{t, x, y, scale, rotation, opacity}]` and emit `animation-*` or inline `@keyframes`. Lets you do Ken Burns pans, slow zooms, nudges.
- **Overlay entrance animations.** Same CSS approach, per overlay inside a shot (§4.4).
- **Audio fades synced to shot transitions.** `audio_tracks[].fade_in/fade_out` already exists in the schema — wire them into the shot boundary durations.
- **Shot-level filters/effects** via CSS: `filter: blur(4px)`, `mix-blend-mode`, color grades. Cheap, renders everywhere.
- **Speed ramps** (user-driven → time-driven): allow a shot to declare a playback-rate curve, renderer interprets.
- **Ducking**: auto-lower background audio tracks during voiceover by scanning `audio_url` presence on base entries.
- **Safe-area & title-safe guides** on canvas — tiny UI addition, big quality win.

---

## 6. Suggested execution order

1. **Security fixes**: drop `allow-same-origin` from the iframe sandbox OR DOMPurify the HTML; URL allowlist in media/overlay editors; move `apiKey` out of the URL. (B1, B2, B4, B15)
2. **Correctness cleanup**: UUID ids, dirty-tracking baseline, save loop error surfacing, scrub clamp, `assignChannelGroups` user-driven branch. (B5-B9)
3. **Overlay-as-combined-HTML** via new `html-overlay-editor.ts` + Overlays tab + canvas drag handles (§4).
4. **Shot transitions** — start with §5.1 (CSS enter/leave, no schema change), graduate to §5.2 if you need author control.
5. **Perf**: audio decode off main thread; debounced iframe re-render / shadow-root renderer. (B13, B16)
6. **Polish**: screen-space selection ring, portrait layout, safe-area guides, keyframed transforms.
