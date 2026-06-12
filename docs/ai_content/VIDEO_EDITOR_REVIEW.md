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
│   │                Image / Text / Heading / Graphic). Each row carries a
│   │                muted content preview alongside the type label
│   │                ("Text 'Forest law…'", "Image filename.png") so a tree
│   │                of half a dozen "Text" rows can be told apart at a
│   │                glance. Tag-name badges hidden in simple mode; SVG
│   │                filter primitives hidden in simple mode. Inspector uses
│   │                LengthControl/RotationControl with raw CSS in
│   │                `Advanced ▾`.
│   ├─ Position & Size (was Transform) — X/Y/scale/rotation, background
│   │                color picker. Raw background CSS (gradient/URL) lives
│   │                in `Advanced ▾`.
│   ├─ Transitions  (was Motion) — per-entry `transitionIn`/`transitionOut`
│   │                + easing presets (Smooth/Fast/Slow/Linear/Bouncy).
│   │                Custom `cubic-bezier(...)` per side in `Advanced ▾`.
│   ├─ Text         — list of editable text nodes in the entry HTML, plus
│   │                text injected at runtime by inline scripts
│   │                (`varEl.innerHTML = "…"` / `varEl.textContent = "…"`,
│   │                where `varEl` was bound via `document.querySelector` /
│   │                `getElementById` in the same script). Patches for the
│   │                latter rewrite the JS string literal in place,
│   │                preserving wrapper HTML like `<span style="display:
│   │                inline-block">…</span>`.
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
just CSS-scales a fixed-size (`meta.dimensions`) container to fit. The
iframe's `srcDoc` is memoised on a **structural fingerprint** of
`entry.html` (the HTML with inline `style="…"` attributes stripped), so
style-only edits keep `srcDoc` referentially stable and don't trigger a
reload — instead, the parent broadcasts a `vx-sync-styles` message and the
iframe agent walks DOM + parsed-new-HTML in lockstep, applying inline-style
diffs additively via `setProperty(prop, val, priority)`. The agent itself
is injected at the *start* of `<body>` (not appended at the end) and pauses
`gsap.globalTimeline` synchronously in its IIFE, so any inline
`<script>gsap.fromTo(...)</script>` later in the shot adds tweens to an
already-paused timeline and can't auto-play during the load window.

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
- **Playhead auto-follow** (§6.7): every `seek()` selects whichever
  non-branding entry contains the new playhead position (lowest-z in
  time_driven, `floor(currentTime)` index otherwise). Properties panel
  follows manual scrubbing and the playback engine's RAF loop alike.

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
| B6 | `video-editor-store.ts` — dirty tracking baseline | ✅ | A transform set then reset to identity used to leave the entry permanently in `dirtyEntryIds`, lighting up Save for a no-op. Fix: added a separate `htmlEditedEntryIds` set tracking *just* HTML mutations, plus `recomputeDirty(state, entryId)` that derives dirty membership from `htmlEditedEntryIds ∪ newEntryIds ∪ non-identity transform ∪ background ∪ transition`. `updateEntryTransform` deletes the override when the result is identity and calls `recomputeDirty`; same for `updateEntryBackground` and `updateEntryTransition`. Reverting an override now correctly removes the entry from dirty unless something else still differs from baseline. |
| B7 | `video-editor-store.ts` — save loop partial-failure | ✅ | A single failed POST (delete, reorder, or update) used to throw mid-loop, leaving earlier-succeeded changes persisted on the server but the whole `dirtyEntryIds` set intact locally — next Save click re-sent the already-succeeded ones. Fix: each operation is now wrapped in its own try/catch; succeeded IDs accumulate into `succeededDeletes/Reorders/Saves` sets, failures into `failedDeletes/Reorders/Saves`. After all loops, the state reset partial-clears (succeeded IDs only): succeeded entries get their overrides baked into HTML and removed from dirty/new/htmlEdited; failed entries keep their overrides + dirty bit + newEntryId marker, so the next Save attempt retries exactly those. Throws a single summary error at the end with `Saved N changes; M failed (<first message>). Click Save again to retry.` so the existing `toast.error` path surfaces the partial result without losing visibility. Undo history is preserved on partial-fail (cleared only on full success). |
| B8 | `track-layout.ts` — `assignChannelGroups` user_driven branch | ✅ | Root cause was a layout/render mismatch, not the user_driven branch itself (non-time-driven blocks render at their global entry index, width 1 — track 0 never overlaps there). The real failure: the field-sniffing `hasTimings` check ignored `exitTime`/`end`, so a time_driven timeline whose entries carried only end times fell into the single-row branch while the scrubber still drew real time spans — overlapping clips stacked on one row. Fix: `assignChannelGroups` now takes `navigationMode` and branches exactly like the scrubber's position logic (`time_driven` → interval scheduling, else single row); the no-mode fallback sniff covers all four timing fields. |
| B9 | `TimelineScrubber.tsx` — scrub math | ✅ | Several render paths computed `${(t / totalDuration) * 100}%` inline without clamping or guarding against `totalDuration === 0`, producing `NaN%` or `>100%` widths. Fix: all sites now route through the existing `timeToPercent(t)` helper (already used by ticks/playhead/gaps) which guards `totalDuration <= 0`, clamps to `[0, 100]`, and `.toFixed(4)`s — covering sound-cue markers, shot/sentence regions, caption phrases, gap fills, and entry blocks. |
| B10 | `html-text-editor.ts` — transform merge regex | ✅ | `/translate\([^)]*\)\s*/g` stopped at the FIRST `)`, so transforms with inner parens (`translate(calc(100% - 20px), 0)`) were cut mid-function and the leftover fragment corrupted the whole transform value. Fix: new paren-depth-aware `stripTranslateFunctions()` tokenizes the transform list into top-level functions and removes only standalone `translate(...)` — `rotate`, `scale`, `matrix`, `translateX/Y/3d` survive byte-for-byte. Both merge sites converted; tokenizer verified against calc-nesting, matrix, and translateX cases. |
| B11 | `PropertiesPanel` Code tab — Tab key handling | ❌ | Cursor restoration inside `requestAnimationFrame` loses position during typing debounce. |
| B12 | `VideoEditorPage` render polling | ✅ | Was: fixed 10 s × 180 polls, network errors silently retried at full rate with no UI signal. Now: consecutive failures back off exponentially (10s → 20s → 40s → 60s cap) and flip the render chip to an amber "Status check failed — retrying…" state (with failure count in the tooltip); the first successful poll resets both. Failure counter resets on every new polling session. |
| B13 | `use-audio-waveform.ts` | ✅ | Verified fixed (audit 2026-06-12): decoding now runs in a Web Worker via `audio-decode-cache.ts`; main thread only does the cheap O(numPeaks) peak-extraction loop. |
| B14 | `AudioTracksPanel` ↔ `audio-track-api.ts` | ❌ | Hand-written camelCase ↔ snake_case mapping. |
| B16 | `EditorCanvas` iframe key per entry | ✅ | Verified fixed (audit 2026-06-12): covered by the structural-fingerprint `srcDoc` memoisation from B37 — style-only edits keep `srcDoc` referentially stable; only structural changes re-mount. |
| ➕ B17 | `AddShotDialog` insert with overlap | ✅ | "At current time" with `duration: 5` routinely landed on top of the shot under the playhead with zero feedback. Now the dialog computes which non-branding entries the chosen `[inTime, exitTime)` range overlaps and shows an amber warning ("overlaps N existing shots — the new shot will sit on top until you retime it"). Adding is still allowed — overlap is legitimate for overlays — it's just never silent. Ripple-on-insert deliberately not built (Add Shot stays a non-destructive operation; retiming is one drag away). |
| ➕ B18 | `AddShotDialog.tsx` — "At end" stacking | ✅ | Repeated "Add at end" clicks used to silently stack new blanks. Fix: the dialog now detects when the last entry is an unsaved blank from this session (in `newEntryIds` AND `entry.html === BLANK_SHOT_HTML`) and, when the user clicks Add Shot at the "end" position, jumps to that existing blank instead of creating another. UI: the preview banner is replaced with an amber "You already added an empty shot at the end. Clicking **Open existing** will jump to it instead of creating another" hint, and the primary button relabels to "Open existing". Editing the blank's HTML disqualifies it (the comparison fails) and reverts to normal Add-Shot behaviour. |
| ➕ B19 | Extending `total_duration` is silent | ✅ | Two halves shipped (2026-06-12). **(1) `loop` flag end-to-end**: `AudioTrack.loop` in FE types + "Loop until video end" checkbox in AudioTracksPanel (fade-out input disabled while on — a looping track has no natural end; collapsed rows show a Repeat icon); `loop` persisted via audio-track add/update schemas + service; render worker plays looped tracks via `-stream_loop -1` on the input and always applies the existing tail fade at `total_duration` (the mix still terminates via the muxer's `-shortest`); editor preview sets `source.loop` with the read offset wrapped modulo buffer length so scrubbing deep into the timeline hears the right point in the loop. **(2) SilentTailNotice**: amber strip above the timeline when non-branding content extends >1.5s past narration coverage (`max(shot.start_time+duration)` from `meta.shots[]` vs `max(entry.exitTime)`) — muted shots keep their slot so muting doesn't trigger it; branding outro excluded; legacy no-shots timelines skipped; dismissible, reappears if the gap grows ≥2s. Deferred: a blocking choice dialog with "auto-narrate the tail" / "stretch music" options (auto-narrate is its own feature), and the studio-builds audio-track endpoints (separate schemas, loop ignored there for now). |
| ➕ B20 | Overlays-tab Height defaulted to a fixed square | ✅ | Image/video overlays now default to width-only / natural aspect. Explicit Height slider with Auto/Set toggle. |
| ➕ B21 | Layers tab — image/video had URL field only | ✅ | URL input + Upload button (re-uses `useFileUpload`). |
| ➕ B22 | Deleting a saved shot didn't persist | ✅ | New backend `POST /frame/delete`; frontend tracks `deletedEntryIds`. |
| ➕ B23 | `PropertiesPanel.tsx`, `LayersTab.tsx`, `OverlayEditor.tsx` (new) | ✅ | Layers and Overlays were two parallel tabs editing the same entry HTML — edits in one could be partially overwritten by the other. Collapsed into a single Elements tab. Inspector routes by overlay-ness (presence of `data-vx-overlay-id`) to either `OverlayEditor` (sliders + objectFit + auto-aspect) or `NodeInspector` (rotation + raw CSS). Add-Text/Image/Video Overlay toolbar moved to the top of Elements; new overlay is auto-selected so the inspector opens on it. Chip filters (All / Text / Image / Video / Overlays) prune the tree while preserving container hierarchy. See §6.9. |
| ➕ B24 | Reorder via sequential `/frame/update` was destructive | ✅ | New atomic `POST /frame/reorder` endpoint by `entry_id`; frontend queues ops in `pendingReorders`. |
| ➕ B25 | Ripple drag didn't preview the growing timeline | ✅ | `totalDuration` derived from `previewedEntries`; `totalDurationRef` keeps the in-flight drag closure live. |
| ➕ B26 | Snap to non-grid targets lost precision | ✅ | `applySnap` returns `{ delta, snapped }`; post-snap quantize skipped when snap fired. |
| ➕ B27 | Ripple-mode snap targets included clips that themselves ripple | ✅ | Downstream rippling clips filtered out of snap targets when `dragMode === 'ripple'`. |
| ➕ B28 | Clearing a renamed entry didn't propagate to the server | ✅ | `setEntryDisplayName` previously deleted the displayNames key on empty input; `saveChanges` then read `undefined` and skipped `entry_meta`. Server `display_name` survived across devices. Fix: store empty string as a sentinel so the save loop sends `entry_meta: { display_name: '' }`; server already drops the key when display_name is empty. |
| ➕ B29 | Renames on never-saved entries were lost | ✅ | `frame/add` didn't accept `entry_meta`. A shot the user renamed before its first save persisted on the server *without* `display_name`; localStorage was cleared on save success → rename vanished on reload. Fix: `AddFrameRequest`/`add_video_frame` accept `entry_meta` and the frontend sends the pending display_name on the add path. |
| ➕ B30 | MotionTab easing picker lied when In/Out easings differed | ✅ | Divergent easings produced `sharedEasing === undefined`, then `easingPresetFor(undefined)` returned "Smooth" — visually claiming all was Smooth even though the two transitions differed. Fix: compute `effectiveEasing` with explicit fallback to `'ease'` per side, treat true divergence as `null`, and only call `easingPresetFor` for non-null values. "Custom easing — see Advanced below" warning now appears correctly. |
| ➕ B31 | localStorage persisted empty-string display-name sentinels | ✅ | A pending clear written to localStorage would survive reload visually (showing auto-name) but the dirty bit didn't, so saveChanges would never push the clear to the server → silent permanent desync. Fix: `persistDisplayNames` strips empty strings before writing; pending clears are in-memory only (lost on reload, same as any other unsaved edit). |
| ➕ B32 | `TimelineScrubber.tsx:1118` | ✅ | Sound-cue React key was `${entryId}:${cue.id}` — the Sound Planner can emit duplicate `cue.id`s within one entry, so React warned "two children with the same key". Key now also includes the array index. |
| ➕ B33 | `LayerHandlesOverlay.tsx:50-96, 150-164, 296-307` | ✅ | After every HTML commit the iframe re-mounted (new `srcDoc`) and `iframeRef.current` pointed at the detached old element. The `vx-iframe-ready` guard `e.source === iframeRef.current?.contentWindow` then failed for the new window, the rect re-query never fired, and the next drag's `vx-set-style` posted to a dead window → silent no-op. Fix: subscribe to `selectedEntryHtml` in the useShallow selector (so the resolve effect re-runs after commit), re-resolve from the DOM in the ready listener by `data-vx-entry-id`, and re-resolve at gesture-start as defense-in-depth. |
| ➕ B34 | `LayerHandlesOverlay.tsx:345-349, 444-462` | ✅ | Commits used `previewRectRef.current ?? startRect`, but the state→ref `useEffect` mirror lagged one event tick. A tiny single-pointermove drag committed `dx=dy=0` because the ref hadn't been updated yet. Replaced with closure-local `lastDx/lastDy/lastRotateDeg/lastResize` written synchronously inside `onMove`. Added a `didMove` guard so a pure click on the move handle no longer writes a no-op commit (which would have forced `position: absolute` on a previously-static element). |
| ➕ B35 | `LayerHandlesOverlay.tsx:376-378, 469-471` + `editor-iframe-agent.ts:179-195` | ✅ | Move/resize commits were silently clobbered for shots that animated `left` directly via gsap or had `.foo { left: 0 !important }` in their `<style>`. Fix: commits now write `position/left/top/width/height` with `!important`; the iframe agent parses the `!important` suffix from values and calls `setProperty(prop, val, 'important')`. Tradeoff: shots whose intro animates `left/top` lose that animation for the moved element — the explicit drag wins. |
| ➕ B36 | `EditorCanvas.tsx:63-65` + `editor-iframe-agent.ts:41-66` | ✅ | The agent script was appended *after* the shot HTML, so the shot's `<script>gsap.fromTo(...)</script>` ran first and the tween auto-played for ~50-200 ms before our agent paused the timeline at DOMContentLoaded — every re-mount flickered. Fix: agent injected immediately after `<body>` via `baseHtml.replace('<body>', '<body>' + agent)` and pauses `gsap.globalTimeline` synchronously in its IIFE (with a 4 ms retry loop fallback). Tweens registered later are added to an already-paused timeline. |
| ➕ B37 | `EditorCanvas.tsx:505-558` + `editor-iframe-agent.ts:225-264, 294-297` + `LayerHandlesOverlay.tsx:197-211` | ✅ | Every commit reloaded the iframe (`srcDoc` changed → full reload), so consecutive drags raced the load window. Fix: `EntryLayer` memoises `srcDoc` on a structural fingerprint (entry.html minus inline `style="…"`). Style-only edits keep `srcDoc` referentially stable; a new `vx-sync-styles` message carries the full new HTML to the agent, which walks DOM + parsed-new-HTML in lockstep and applies inline-style diffs *additively* via `setProperty` (preserves gsap-set transforms not in the new HTML). `LayerHandlesOverlay` re-queries the rect on `selectedEntryHtml` change since `vx-iframe-ready` no longer fires for style edits. |
| ➕ B38 | `editor-iframe-agent.ts` | ✅ | Self-inflicted breakage: a JS comment in the agent contained the literal text `</script>`, which the HTML parser interpreted as the end of the agent script. The rest of the agent dumped as visible body content and the iframe logged two SyntaxErrors. Rewrote the comment to avoid the literal closing tag. Lesson noted in the comment for future contributors. |
| ➕ B39 | `html-text-editor.ts:36-48, 134-353` | ✅ | The Text tab didn't surface text injected at runtime by inline scripts (the LLM's common `varEl.innerHTML = "TELANGANA"` pattern leaves the static `<h1>` empty). `extractTextElements` now scans inline `<script>` blocks for `const/let/var X = document.querySelector('SEL') | getElementById('ID')` bindings, then `X.innerHTML = "…"` / `.textContent = "…"` / `document.querySelector(...).innerHTML = "…"` assignments. Each becomes a synthetic `TextElement` carrying a `scriptInjection` ref. `applyTextPatch` routes text-content edits through a literal-rewriter that preserves wrapper HTML (`<span style='…'>…</span>`) and re-injects via a function-form `replace` so `$` chars in the new text aren't mis-read as backreferences. `deleteTextElement` empties the literal in place. Template literals with `${…}` interpolation are skipped on purpose. |
| ➕ B40 | `stores/video-editor-store.ts:853-888` | ✅ | The Properties panel didn't follow the playhead — users scrubbed to shot 6 but the panel still showed shot 3. `seek()` now auto-selects whichever non-branding shot contains the playhead (lowest-z in time_driven; `floor(currentTime)` index otherwise) in the same `set()` call as `currentTime`. Clears `selectedLayerPath` when the entry changes. Works for both manual scrubbing and the playback engine's RAF loop (which calls `seek()` every frame). |
| ➕ B41 | `LayersTab.tsx:271-281, 855-876` | ✅ | Layers-tree rows showed only the type label ("Container", "Text", "Image"), making a tree of half a dozen "Text" rows indistinguishable. Each row now carries a muted content preview alongside the type label — Text/Heading rows show the truncated visible text in quotes; Image/Video rows show the `alt` attribute or basename of `src` (query string stripped). Hovering exposes the full value via `title=`. |
| ➕ B42 | `render_worker/audio_ops.py` — re-narrating the LAST shot failed | ✅ | `splice_audio` cut head/tail unconditionally. For the last shot, `replace_end` overshoots the master's real duration, is clamped to `base_duration`, so `tail_start == base_duration` and the stream-copied tail cut contains zero MP3 frames — a header-only file ffmpeg can't demux ("Invalid frame size (576)… Invalid argument"). The concat fallback only fired when BOTH crossfades were impossible; the head join was fine, so the broken `tail.mp3` was still fed to the crossfade command → 400 surfaced verbatim in the Edit-shot dialog. Fix: head/tail are cut only when their span exceeds `MIN_JOIN_SEGMENT_S` (60 ms) and probe to >0; the surviving 1–3 parts are joined by a new `_join_audio_parts` helper (per-join acrossfade, concat-*filter* fallback, always re-encoded at 192k — the old concat-demuxer `-c copy` fallback silently produced corrupt output when joining the 48 kHz-stereo master with a 24 kHz-mono TTS clip). Same fix applied to `silence_audio_range` (muting the last sentence had the identical bug). First-sentence splices (head ≤ 60 ms) and full-range replaces (single-part re-encode) now degrade cleanly too. |
| ➕ B43 | `ShotEditPopover.tsx` / `SentenceEditPopover.tsx` — raw ffmpeg dumps shown to users | ✅ | Re-narrate/mute failures rendered the backend `detail` string verbatim — for splice failures that's ~700 chars of ffmpeg stream metadata in the popover *and* the toast (see B42's screenshot). Fix: `humanizeNarrationError()` in `sentence-api.ts` maps known failure families (splice/ffmpeg, implausible-delta guard, TTS, network) to one readable sentence; toasts show only that. The raw text stays reachable behind a collapsed "Technical details" disclosure in the popover. Wording notes: splice/TTS failures say "your video was not changed" (justified — the server persists nothing before those steps); network failures instead say "reload the editor to see the current state" (the request may have landed). Short server messages (≤160 chars, e.g. "Shot 3 not found") pass through untouched. |
| ➕ B44 | `video_generation_service.py:4210` — `/frame/update` entry_id mismatch was warn-and-proceed | ✅ | A stale `frame_index` (concurrent reorder/delete since the editor's last load) silently overwrote whatever entry now sat at that index; the `entry_id` mismatch was only logged. Fix: on mismatch, recover by looking the entry up by `entry_id` (the stable address) and update that; if the id is gone entirely, raise (HTTP 400: "reload the editor and retry"). Callers that don't send `entry_id` keep index-only behaviour. |
| ➕ B45 | Timeline JSON had no concurrency control — concurrent saves silently lost updates | ✅ |
| ➕ B46 | No per-video tenant check — any valid institute key could read/edit any video_id | ✅ | Every `/external/video/v1/*` endpoint authenticated the institute key but never verified the video belonged to that institute (the code even carried a `TODO: verify video belongs to institute`). A leaked/lateral key + a guessed video_id gave full read/edit/render/delete access to other tenants' videos. Fix: `_ensure_video_access(video_id, institute_id, db)` in `external_video_generation.py` — loads the `AiGenVideo` record and compares `extra_metadata.institute_id` (stamped at generation time); mismatch → **404** (not 403, so a leaked key can't probe which video_ids exist) + a tenant-mismatch warning log. Wired into all 26 video-scoped endpoints: status/urls/thumbnails (3), cancel/resume/retry, frame regenerate/add/update/reorder/delete, sentences/build, sentence regenerate/silence, shot regenerate/silence/insert, rebuild-master, render request/status/clear, audio-track add/update/delete. Placement matters: guards sit *outside* each endpoint's `try/except Exception` so the 404 isn't re-wrapped as a 500. Videos without a stamp (generated before stamping existed, or via internal tooling) pass through — blocking them would brick legacy videos for their rightful owners. `/render-callback` keeps render-key auth (the worker has no institute key). Reels/studio routers have their own per-record `institute_id` columns and were already scoped. | Every `/frame/*` endpoint did blind S3 read-modify-write: two editor tabs (or a save racing the pipeline-view's direct `frame/update`) clobbered each other, last PUT wins. Fix: app-level optimistic locking via `meta.revision` (new `ai_service/app/services/timeline_revision.py`). All four frame endpoints (`update`/`add`/`delete`/`reorder`) accept `expected_revision`, verify it against the stored timeline *after* in-memory mutation but *before* the S3 PUT (conflict → HTTP 409, nothing written), bump the counter on every write (even unchecked legacy writers stay detectable), and return the new `revision`. FE: `timelineRevision` in the editor store (hydrated from `meta.revision` on load, `null` for legacy plain-array timelines and reel/studio kinds → check skipped), threaded through `saveChanges` — each op sends `expected_revision`, refreshes from the response, and a 409 aborts the whole save loop via `TimelineConflictError` with a "changed in another tab — reload the editor" message; dirty state and undo history are preserved. Residual window: the ms between download and PUT inside one request (vs. the minutes-long load-to-save window this closes). Not yet revision-aware: narration splice paths, `shot/insert`, audio-track CRUD — they round-trip the loaded JSON so the counter survives them; convert later for full coverage. |

### 2.3 UX / polish

- **Transitions exist** (Transitions tab) for fade / slide / zoom / wipe + easing presets.
- **Move-mode drag exists** (Move + Ripple via mode toolbar). Slide / Swap deferred.
- **viewMode toggle exists** — friendly defaults for all users; raw inputs reachable via `Advanced ▾`.
- **Auto-follow exists** — Properties panel switches to whichever shot the playhead enters (manual scrubbing + playback). See §6.7.
- **Layers-tree previews exist** — every row shows a muted content snippet (truncated text / image basename) next to the type label so duplicate-type rows are distinguishable. See §6.8.
- **Iframe re-mount minimisation exists** — style-only edits no longer reload the iframe; structural edits (text/add/delete) still do. Eliminates per-edit flicker. See §6.5.
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

### 6.5 Iframe rendering robustness

Three architectural changes shipped together to kill the "drag works the
first time, then flickers / doesn't work" pattern:

1. **Agent at the top of `<body>`** ([EditorCanvas.tsx:63-65](../../frontend-admin-dashboard/src/components/ai-video-editor/EditorCanvas.tsx#L63-L65)).
   The iframe agent script is no longer appended at the end of the shot
   HTML — it's injected immediately after the opening `<body>` tag via
   `baseHtml.replace('<body>', '<body>' + agent)`. Because gsap is loaded
   in `<head>` by the shared `getCommonLibraries()` block, the agent runs
   *after* gsap exists but *before* the shot's inline animation scripts
   parse.
2. **Synchronous gsap pause** ([editor-iframe-agent.ts:41-66](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/editor-iframe-agent.ts#L41-L66)).
   The agent calls `gsap.globalTimeline.pause()` synchronously in its
   IIFE (with a 4 ms `setInterval` retry as a fallback). Any subsequent
   `gsap.fromTo(...)` adds tweens to an already-paused timeline. No
   autoplay flicker during the iframe load window.
3. **Structural-fingerprint `srcDoc` memoisation** ([EditorCanvas.tsx:505-558](../../frontend-admin-dashboard/src/components/ai-video-editor/EditorCanvas.tsx#L505-L558)).
   `EntryLayer` keeps a `srcDoc` state seeded from the initial
   `entry.html`. A `useEffect` watches `entry.html` and compares the
   *structural fingerprint* (HTML with `style="…"` attributes stripped)
   to the last one. If the fingerprint changed → rebuild `srcDoc` (full
   iframe reload). If only inline styles changed → broadcast a
   `vx-sync-styles` message with the new full HTML and *do not* touch
   `srcDoc`. The agent (`syncStylesFromHtml` / `syncStylesRecursive`)
   walks the live DOM and the parsed new HTML in lockstep, applying
   inline-style diffs additively via `setProperty(prop, val, priority)`
   — preserves any gsap-set transform/opacity not in the new HTML.

The move/resize commit path also writes `!important` on
`position/left/top/width/height` ([LayerHandlesOverlay.tsx:454-481](../../frontend-admin-dashboard/src/components/ai-video-editor/LayerHandlesOverlay.tsx#L454-L481))
and the agent's `applyStylePatch` honours the `!important` suffix on
values ([editor-iframe-agent.ts:179-195](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/editor-iframe-agent.ts#L179-L195)).
Shots whose runtime animation writes `left`/`top` directly (or whose
stylesheet uses `!important`) no longer silently clobber user drags.

Cites B35 / B36 / B37 / B38.

### 6.6 JS-injected text in the Text tab

The LLM commonly emits empty containers and fills them at runtime:

```js
const titleEl = document.querySelector('#s2_title');
titleEl.innerHTML = "<span style='display:inline-block;white-space:nowrap'>TELANGANA</span>";
```

The static `<h1>` is empty, so the DOM-walking text extractor used to
skip it. Now [`extractTextElements`](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/html-text-editor.ts#L134-L155)
also scans inline `<script>` blocks via three regexes
([html-text-editor.ts:158-168](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/html-text-editor.ts#L158-L168)):

- `QS_BINDING_RE` — `const|let|var X = document.querySelector('SEL')`
- `GBI_BINDING_RE` — `const|let|var X = document.getElementById('ID')`
- `ASSIGN_RE` — `X.innerHTML = "…"` / `.textContent = "…"`, also
  accepting a direct `document.querySelector(...)` chain as the target.

Each detected injection becomes a synthetic `TextElement` carrying a
`scriptInjection: { selector, method, quote, originalLiteral }` ref
([html-text-editor.ts:36-48](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/html-text-editor.ts#L36-L48)).
The synthetic row inherits `tagName` and inline style from the resolved
target element (via `querySelector(selector)` against the parsed body)
so the Text tab shows it as "Heading 'TELANGANA'" rather than "Script
'TELANGANA'".

`applyTextPatch` short-circuits when `targetMeta.scriptInjection` is set
and routes to `applyScriptInjectionPatch`:

1. **`patch.text`** → `rebuildLiteralForText` parses the original
   literal as HTML, walks text nodes via `TreeWalker`, replaces the
   first non-empty text node with the new text and clears any trailing
   text nodes. Wrapper spans (`<span style='display:inline-block'>…
   </span>`) survive — critical for `splitReveal` to still find chars
   to animate. The serialised HTML is then re-escaped for the original
   quote type and substituted into the script via a function-form
   `replace` (so `$` chars in the new text aren't misread as
   backreferences) and any `</script>` substring becomes `<\/script>`.
2. **Style patches** (`fontSize`, `color`, `translateX`, …) → applied
   to the target element's inline `style` attribute by selector, same
   as the static-DOM code path.

`deleteTextElement` for script-injected entries empties the literal in
place rather than removing the (empty) DOM node — the assignment stays
so the variable reference doesn't crash the script.

**Limitations** (intentional):

- Template literals with `${…}` interpolation are skipped silently.
- Only `innerHTML` / `textContent` assignments are detected;
  `setAttribute('innerHTML', …)`, `el.append(textNode)`, and
  multi-statement composition (`el.innerHTML += "…"`) are not.
- One pass per assignment — `el.innerHTML = a + b` (concatenation) is
  not handled.

Cites B39.

### 6.7 Auto-follow selection on playhead

[`seek()` in video-editor-store.ts:853-888](../../frontend-admin-dashboard/src/components/ai-video-editor/stores/video-editor-store.ts#L853-L888)
auto-selects the non-branding shot containing the playhead in the same
`set()` call as `currentTime`:

- `time_driven` — filter entries by `[inTime, exitTime)` containing
  `time`, sort by `z` ascending, pick the first (base layer).
- `user_driven` / `self_contained` — `floor(currentTime)` as index.
- Branding entries (`branding-intro` / `-outro` / `-watermark`) are
  excluded — auto-following into the branded outro and switching the
  panel away mid-scrub would be jarring.

When the auto-selection changes, `selectedLayerPath` is cleared (paths
are entry-scoped). Works for both manual scrubbing (TimelineScrubber
drag) and the playback engine (the RAF loop in
[playback-engine.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/playback/playback-engine.ts)
calls `useVideoEditorStore.getState().seek(t)` every frame).

Cites B40.

### 6.8 Layers-tree content previews

Every row in the Layers tree now renders a muted content snippet next
to its type label so half-a-dozen "Text" or "Image" rows can be told
apart at a glance ([LayersTab.tsx:271-281, 855-876](../../frontend-admin-dashboard/src/components/ai-video-editor/LayersTab.tsx#L271-L281)):

- **Text / Heading** — first 32 chars of `node.textContent`,
  whitespace-collapsed, in quotes: `Text "Forest law enforcement…"`.
- **Image / Video** — `alt` attribute if non-empty, else basename of
  `src` with query strings stripped: `Image telangana-cover.png`.
- **Container / Graphic / Element** — no preview; the layout label
  (`Container` / `Horizontal Layout` / `Vertical Layout` / `Grid
  Layout`) carries enough information on its own.

Hovering the row exposes the full value via `title=`. Preview text
colour follows selection (indigo when selected, gray-400 otherwise).

Cites B41.

### 6.9 Merged Elements tab — overlays editable in-tree

The Overlays tab is gone. Overlay editing now lives in the Elements
tab, which means there's one place to manage every element of a shot
— static DOM nodes and overlay rows alike — eliminating the
"edits-in-one-tab-overwrite-the-other" hazard.

Three pieces moved:

1. **Inspector routes by overlay-ness**
   ([LayersTab.tsx:89-235](../../frontend-admin-dashboard/src/components/ai-video-editor/LayersTab.tsx#L89-L235),
   [OverlayEditor.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/OverlayEditor.tsx)).
   When the selected layer-tree row's node has `data-vx-overlay-id`,
   the inspector renders `OverlayEditor` (slider-based geometry,
   objectFit buttons, auto-aspect for media). Otherwise it renders
   the existing `NodeInspector` (LengthControl, RotationControl, raw
   CSS in `Advanced ▾`). Both editors are preserved as-is — no
   controls were merged or lost. `OverlayEditor` and `SliderField`
   were extracted from `PropertiesPanel.tsx` into their own file so
   both panels can import them. A new `hideHeader` prop suppresses
   the inspector-internal row label since the tree row above already
   shows it.

2. **Add-Overlay toolbar at the top of Elements**
   ([LayersTab.tsx:277-313](../../frontend-admin-dashboard/src/components/ai-video-editor/LayersTab.tsx#L277-L313)).
   Three buttons — `Text` / `Image` / `Video` — replace the old
   Overlays-tab add row. Image and Video reuse the same file-input
   infrastructure as the existing "Replace src" button via an
   `id === 'NEW'` sentinel that forks the upload handler between
   "create new overlay" and "replace existing overlay's src". The new
   overlay is auto-selected after creation so the inspector opens on
   it immediately.

3. **Chip filters**
   ([LayersTab.tsx:60-71, 282-307](../../frontend-admin-dashboard/src/components/ai-video-editor/LayersTab.tsx#L60-L71),
   [LayersTab.tsx:909-940](../../frontend-admin-dashboard/src/components/ai-video-editor/LayersTab.tsx#L909-L940)).
   A row of pill buttons above the tree: `All / Text / Image / Video
   / Overlays`. `filterTreeByChip` recursively prunes nodes that don't
   match AND have no matching descendants — preserves hierarchy so a
   Text inside two Containers still shows both containers expandable
   (the chip narrows the view, it doesn't flatten it). Empty result
   shows a friendly "No <chip> in this entry." placeholder.

`selectedLayerPath` is the single source of truth for which row is
selected — no new store state was needed. Cites B23.

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
9. ~~Iframe rendering robustness — agent at body-top, sync gsap pause, structural-fingerprint srcDoc, vx-sync-styles, `!important` on move/resize commits.~~ (§6.5 ✅, B32–B38 ✅)
10. ~~JS-injected text surfaced in Text tab.~~ (§6.6 ✅, B39 ✅)
11. ~~Auto-follow selection on playhead.~~ (§6.7 ✅, B40 ✅)
12. ~~Layers-tree content previews.~~ (§6.8 ✅, B41 ✅)
13. ~~Collapse Layers (Elements) and Overlays into one tab with chips — inspector routes by overlay-ness, Add-Overlay toolbar on Elements, chip filters.~~ (§6.9 ✅, B23 ✅)
14. ~~Stop Add-Shot stacking at end — dialog detects existing unsaved end-blank and opens it instead.~~ (B18 ✅)
15. ~~Correctness sweep round 1 — dirty-tracking baseline, partial-save retry, scrubber clamp.~~ (B6 ✅, B7 ✅, B9 ✅)

Now:

16. ~~**Correctness sweep round 2** — B8 (track layout follows
    `navigationMode`), B10 (paren-depth-aware transform merge), plus B12
    (render-poll backoff + visible failure) and B17 (add-shot overlap
    warning).~~ (B8 ✅, B10 ✅, B12 ✅, B17 ✅)

Next, pick from:

17. ~~**Audio policy on extend** (B19) — `loop` flag on `AudioTrack`
    (UI + API + render + preview) and the SilentTailNotice banner.~~
    (B19 ✅ — auto-narrate-the-tail and stretch-music remain future options.)
18. **Captions track** — see [CAPTIONS_TRACK_PLAN.md](./CAPTIONS_TRACK_PLAN.md).
19. **Move-mode Phase 2** — Slide and Swap; multi-select; sentence-boundary
    snap targets; audio drag on timeline (gated on §17).
20. **Perf** — B13 (waveform off main thread), B16 (debounce iframe
    re-renders or shadow-root renderer; B37 covered the style-only path).
21. **Polish** — screen-space selection ring, portrait layout branch,
    keyframed transforms, overlay timing UI (§4.3), large-HTML hard cap.

---

## 9. Open architectural questions

These came up during recent work and haven't been resolved — flagging so
the next pass can pick one:

1. ~~**One tab or two** for layer-vs-overlay editing.~~ Resolved: collapsed
   to one Elements tab with chip filters (B23 ✅, §6.9).
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
8. **JS-text detection scope** — only the LLM's specific
   `varEl.innerHTML = "..."` pattern is handled (with `document.querySelector` /
   `getElementById` binding upstream). `setAttribute('innerHTML', …)`,
   `el.append(textNode)`, `el.textContent += "..."`, concatenation
   (`el.innerHTML = a + b`), and template literals with `${…}`
   interpolation aren't. Decide between broadening the detector (more
   patterns → more fragile) or constraining the LLM prompt to emit a
   stable pattern.
9. **`vx-sync-styles` is additive only** — a property cleared in the
   inspector (e.g. removing `color` from a Text element) is *not*
   propagated to the iframe DOM, because the sync only applies properties
   present in the new HTML. This is intentional (so a gsap-set transform
   not mentioned in the static HTML doesn't get blown away mid-render),
   but means inspector-driven *removals* require a structural change to
   take visual effect. Revisit if users complain.
10. **Auto-follow has no "pin"** — every `seek` selects the active
    shot. Users can't keep a non-active shot selected (e.g. to copy values
    from one shot to another while the playhead is elsewhere). Should an
    explicit click in EntryListPanel pin until next click, or should
    shift-click pin? Or a toolbar toggle for "follow playhead: on/off"?
11. **`!important` on resize dimensions** — width/height committed with
    `!important` will defeat any responsive `width: 100%` rule in the
    shot's stylesheet. Probably desired (the user explicitly resized to a
    pixel value) but worth a watchpoint if shots stop being responsive
    after the user touches them.

---

## 10. What's needed next — beyond §8

Forward-looking items that surfaced during the last few iterations but
aren't on the existing roadmap. Roughly ordered by leverage; pick from
this list once §8 items 13-20 are unblocked.

### 10.1 Editor reliability follow-ups

- **Tests for the script-injection rewriter** — round-trip "extract →
  patch → re-extract" with assertions on preserved span wrappers and the
  replaced text. No coverage today; all the LLM-pattern variants live in
  one file (`html-text-editor.ts`) so a focused vitest suite is cheap.
- **Telemetry for iframe load + sync** — log time-to-`vx-iframe-ready`
  per re-mount and `vx-sync-styles` round-trip latency. Currently
  invisible — regressions in either would silently re-introduce
  flicker. Bucket by structural-fingerprint hit/miss to confirm the
  memoisation is actually winning in practice.
- **Full-replace mode for `vx-sync-styles`** — additive sync is safe
  but means inspector "delete style" doesn't propagate. A property-mask
  approach ("clear these props, then apply these") plus a "do not
  touch" allowlist for gsap-managed props would let removals work
  without breaking animations.
- **Template-literal interpolation handling** — `` `Hello ${name}` `` is
  skipped silently. Detect and either expose as read-only or surface
  only the static prefix; warn in the inspector so users know the
  detected text is a fragment.
- **Multi-statement composition** — `el.innerHTML += "X"` and
  `el.innerHTML = a + b` patterns aren't detected. Decide on coverage.

### 10.2 Editor capability follow-ups

- **Multi-select for entries** — `moveEntries(ids: string[])` is plural-
  ready; UI is single-select. Wire shift-click in EntryListPanel and on
  timeline clips, with a multi-row inspector that edits the intersection
  of properties.
- **Pin / unpin selection** (auto-follow opt-out). See §9.10.
- **Live DOM introspection mode for Text tab** — supplement the
  static-HTML parser with a query into the iframe's actual rendered DOM
  via a new `vx-dump-text` message. Catches any visible text regardless
  of injection pattern; edits would still need to route back through
  whatever surface created the text (static / script / runtime DOM).
- **Copy / paste entries** — "make this shot like that one". Store the
  entry HTML on the clipboard (custom MIME) plus a paste affordance in
  EntryListPanel.
- **Align / distribute** across multi-select.

### 10.3 Accessibility pass

- LayersTab tree rows use `role="button"` with `tabIndex={0}` but no
  `aria-expanded` (on collapsible parents), `aria-level`, or
  `aria-selected`. Audit and add.
- Canvas drag handles are pointer-only. Keyboard arrow-nudge works once
  a layer is selected, but there's no Tab path to focus a layer from
  the canvas in the first place. Tab into the Layers tree, select, then
  arrow-nudge — works but not discoverable.
- `text-gray-400` muted preview snippet (§6.8) contrast ratio against
  the row hover/selected background — verify against WCAG AA.

### 10.4 Documentation

The iframe agent message protocol now has ten message types:
`vx-seek`, `vx-play`, `vx-pause`, `vx-get-rect`, `vx-rect`,
`vx-set-style`, `vx-sync-styles`, `vx-resize-to-rect`,
`vx-resize-applied`, `vx-iframe-ready`. No single doc lists them;
the next contributor has to read the agent source to learn it. Add a
reference table to [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md)
or a new dedicated doc — direction, payload shape, when it's sent.
