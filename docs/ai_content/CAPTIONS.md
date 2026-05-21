# Captions — end-to-end reference

How narration captions flow from raw word timestamps to the rendered MP4, with a faithful editor preview in between.

Companion docs:
- [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md) — the generation pipeline that produces `narration.words.json`
- [VIDEO_EDITOR_REVIEW.md](./VIDEO_EDITOR_REVIEW.md) — the editor's broader architecture
- [CAPTIONS_TRACK_PLAN.md](./CAPTIONS_TRACK_PLAN.md) — the original product plan (pre-dates this implementation)

---

## 1. Overview

```
┌─────────────────────┐
│  narration.words    │  ← per-word timestamps (Whisper) — S3 asset
│  .json              │
└──────────┬──────────┘
           │ fetch
           ▼
┌──────────────────────────────────────────────────────────────────┐
│  buildPhrases() — 1:1 mirror in three places                     │
│  • Python  generate_video.py:_build_caption_segments             │
│  • TS      useCaptions.ts:buildPhrases       (AIVideoPlayer)     │
│  • TS      caption-rendering.ts:buildPhrases (editor)            │
└──────────┬──────────────────────┬──────────────────┬─────────────┘
           ▼                      ▼                  ▼
   ┌──────────────┐       ┌──────────────┐    ┌──────────────┐
   │ AIVideoPlayer│       │ Editor       │    │ Render server│
   │ preview      │       │ canvas       │    │ MP4 frames   │
   │ (post-gen)   │       │ overlay      │    │ (Playwright) │
   └──────────────┘       └──────────────┘    └──────────────┘
                                  │                  ▲
                                  │  initialSettings │
                                  │  → render dialog │
                                  └──────────────────┘
```

The user previews captions on the **editor canvas**; on render, the dialog seeds itself from the editor's preview settings so the MP4 burns captions in with **exactly** the same CSS that was just previewed.

Per-shot overrides (`hide` / `top` / `bottom`) ride along on `entry.entry_meta.caption_style` through the existing `/frame/update` round-trip.

---

## 2. Data sources

### 2.1 `narration.words.json`

Produced by the pipeline's WORDS stage (Whisper) — see [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md). Schema:

```json
[
  { "word": "Hello",   "start": 0.10, "end": 0.42 },
  { "word": "world.",  "start": 0.43, "end": 0.81 },
  …
]
```

- Times are **absolute audio time** (in seconds).
- Punctuation is **attached** to its word (`world.` not `world` + `.`) — phrase-build break rules depend on this.
- S3 URL is in the timeline JSON's `meta.words_url`, surfaced to the frontend as `wordsUrl`.

### 2.2 Phrase-building algorithm

Identical constants and break rules in all three implementations:

| Constant | Value |
|---|---|
| `WORDS_PER_PHRASE` | 10 |
| `MIN_PHRASE_DURATION` | 2.0 s |
| `MAX_PHRASE_DURATION` | 5.0 s |

Break a phrase when **any** of the following is true:
1. Word ends with `.`, `!`, or `?` (sentence end)
2. Phrase has reached 10 words
3. Phrase has reached 5.0 s of audio
4. Word ends with `,`, `;`, or `:` AND phrase has ≥5 words AND ≥2.0 s
5. Gap to next word > 0.5 s (natural pause)

Files (must stay in lockstep):
- [generate_video.py:_build_caption_segments](../../ai_service/app/ai-video-gen-main/generate_video.py)
- [useCaptions.ts:buildPhrases](../../frontend-admin-dashboard/src/components/ai-video-player/hooks/useCaptions.ts)
- [caption-rendering.ts:buildPhrases](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/caption-rendering.ts)

### 2.3 Active-phrase lookup

```
active(t) = phrase where (start - 0.1) ≤ t ≤ (end + 0.3)
```

Lead 0.1 s lets captions show just before the audio actually starts; tail 0.3 s lingers after the last word so brief captions don't flicker.

(Browser preview multiplies both by `playbackRate` for ≥1× scrubbing — render server keeps the bare values because frames are rendered at 1× by construction.)

---

## 3. Three caption renderers

### 3.1 Render server (the source of truth)

[generate_video.py:1637-1691](../../ai_service/app/ai-video-gen-main/generate_video.py) emits a `<div>` per frame, evaluated via `window.__batchRenderFrame({caption, ...})` and screenshotted by Playwright. The HTML:

```html
<div style="width:100%; height:100%; position:relative;">
  <div style="position:absolute; left:50%; transform:translateX(-50%);
              max-width:85%; padding:10px 20px; border-radius:8px;
              background:{bg}; text-align:center;
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;
              font-size:{px}px; font-weight:400; color:{fg};
              text-shadow:0 1px 3px rgba(0,0,0,0.4); line-height:1.5; letter-spacing:0.02em;
              min-height:44px; display:flex; align-items:center; justify-content:center;
              {top|bottom}:{int(height*0.037)|int(height*0.074)}px; {bottom|top}:auto;">
    <div style="display:inline-block; text-shadow:0 1px 3px rgba(0,0,0,0.4);">
      {phrase text}
    </div>
  </div>
</div>
```

Sizing: font-size starts as the user's S/M/L pick (36 / 48 / 64 px at the 1920px canvas) and is scaled by `width/1920` in [generate_video.py:850-858](../../ai_service/app/ai-video-gen-main/generate_video.py) — the **only** site that does canvas-relative font scaling. Position is `int(height * 0.037)` for top or `int(height * 0.074)` for bottom.

### 3.2 Editor canvas preview (`CaptionOverlay`)

[CaptionOverlay.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/CaptionOverlay.tsx) mounts inside `EditorCanvas`'s scaled 1920×1080 div ([EditorCanvas.tsx:286-294](../../frontend-admin-dashboard/src/components/ai-video-editor/EditorCanvas.tsx)). It renders the **same** HTML / CSS as the render server, sized in canvas-native pixels — the canvas's `transform: scale(${scale})` then shrinks the whole thing uniformly to fit the preview viewport.

This means preview is **pixel-perfect MP4 parity by construction**, not by approximation: identical CSS at identical canvas size, modulo a uniform CSS transform.

CSS emission: [caption-rendering.ts:captionContainerCss](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/caption-rendering.ts).

### 3.3 AIVideoPlayer preview (post-generation)

[CaptionDisplay.tsx](../../frontend-admin-dashboard/src/components/ai-video-player/components/CaptionDisplay.tsx) overlays the player container, NOT the iframe. Uses fixed positions (`top: 3.7%` / `bottom: 7.4%` — percentages of the player container, see fix #3 in the caption-fix series). Less faithful than the editor preview (player container ≠ 1920×1080 in general), but consistent within the player.

---

## 4. Editor settings & UI

### 4.1 Store slice — `captionSettings`

[video-editor-store.ts:436-454](../../frontend-admin-dashboard/src/components/ai-video-editor/stores/video-editor-store.ts) (shape; default values via `DEFAULT_CAPTION_EDITOR_SETTINGS` in [caption-rendering.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/caption-rendering.ts)):

```ts
interface CaptionEditorSettings {
  enabled:     boolean;       // default: true
  position:    'top'|'bottom'; // default: 'bottom'
  sizePx:      number;        // "px at 1920w canvas" — 36 / 48 / 64
  textColor:   string;        // hex, default '#ffffff'
  bgColor:     string;        // hex, default '#000000'
  bgOpacity:   number;        // 0..1, default 0.6
}
```

**Persistence**: localStorage key `vx-caption-editor-settings`. Per-device preference, **not** per-video — once configured, every video the user edits inherits the same caption style.

Three localStorage keys exist for captions (intentional separation):

| Key | Owner | Purpose |
|---|---|---|
| `ai-player-caption-settings` | AIVideoPlayer preview | Player-side display only |
| `video-render-settings` | RenderSettingsDialog | Render request (resolution/fps/captions/watermark) |
| `vx-caption-editor-settings` | Editor canvas overlay | Editor preview + render dialog seed |

The editor's settings seed the render dialog so MP4 matches preview — see §6.

### 4.2 Slice — `captionWords` / `captionPhrases`

Loaded once per video by `loadCaptionWords()` in [video-editor-store.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/stores/video-editor-store.ts) — fetched from `wordsUrl`, validated, then phrase-built and cached. Soft-fails to empty arrays if the URL is missing or unreachable (captions disappear; editor keeps working).

Called from [VideoEditorPage.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/VideoEditorPage.tsx) right after `loadTimeline()`. Re-fires whenever `props.wordsUrl` changes.

### 4.3 Settings panel — `CaptionSettingsPanel`

[CaptionSettingsPanel.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/CaptionSettingsPanel.tsx). Sibling of `AudioTracksPanel` at the bottom of the editor; mounted in [VideoEditorPage.tsx:867-869](../../frontend-admin-dashboard/src/components/ai-video-editor/VideoEditorPage.tsx).

Controls:
- **Show on canvas** (toggle) — flips `settings.enabled`
- **Position** (top/bottom)
- **Size** (S/M/L → 36/48/64 px at 1920w)
- **Text color** (`<input type="color">`)
- **Background color**
- **Background opacity** (range 0-100, stored 0-1)

When no `wordsUrl` is available, the panel shows "no transcript" and hides controls. When captions are enabled, the panel header shows a phrase count and a small green "on" badge.

### 4.4 Timeline phrase row

[TimelineScrubber.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/TimelineScrubber.tsx) inserts a single 22px-tall row between the audio waveform and the channel area. Each `captionPhrases[i]` becomes a clickable pill positioned by `startTime / totalDuration`. Click → `seek(phrase.startTime)`.

Row is hidden when `!enabled || phrases.length === 0` so the timeline doesn't grow.

Layout constants: `CAPTION_TRACK_H = 22`. `computeChannelYOffsets()` adds it to the start-y when present.

### 4.5 Per-shot override — `ShotCaptionOverride`

[ShotCaptionOverride.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/ShotCaptionOverride.tsx). Lives in the Properties Panel's **Layers** tab (when an entry is selected); 4-way toggle: Default / Top / Bottom / Hidden.

Writes to the store via `setEntryCaptionStyle(entryId, style | null)` which:
1. Updates `entry.entry_meta.caption_style` (writes `null` when clearing — see §5)
2. Marks the entry dirty so `saveChanges()` picks it up

---

## 5. Per-shot override round-trip

### 5.1 Schema

The `Entry.entry_meta` type ([types.ts](../../frontend-admin-dashboard/src/components/ai-video-player/types.ts)):

```ts
entry_meta?: {
  text?: string;
  audio_text?: string;
  display_name?: string;
  caption_style?: { hide?: boolean; position?: 'top'|'bottom' } | null;
  [key: string]: unknown;
};
```

Three states for `caption_style`:
- **`undefined`** (missing key) — never touched this session, no override
- **`null`** — explicit "clear" sentinel (forces BE to overwrite stale value)
- **`{ hide: true }` or `{ position: 'top'|'bottom' }`** — active override

The `null` sentinel matters: if the user *clears* an existing override mid-session, we need the BE to overwrite the stale value on disk. Deleting the key client-side would result in no payload entry → BE deep-merge preserves the stale value. So we explicitly send `caption_style: null`.

### 5.2 Editor → BE

[video-editor-store.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/stores/video-editor-store.ts) — `saveChanges()` builds an `entry_meta` payload that includes both `display_name` (if pending) and `caption_style` (if set, including null):

```ts
const captionStyle = entry.entry_meta?.caption_style;
const entryMetaPayload =
  pendingName !== undefined || captionStyle !== undefined
    ? { ...(pendingName !== undefined ? { display_name: pendingName ?? '' } : {}),
        ...(captionStyle !== undefined ? { caption_style: captionStyle } : {}) }
    : undefined;
```

Both the `/frame/add` and `/frame/update` branches use this pattern — symmetric.

### 5.3 BE persistence

[external_video_generation.py](../../ai_service/app/routers/external_video_generation.py) does a **shallow** deep-merge: `{**existing_meta, **entry_meta}`. Top-level keys get replaced wholesale; missing keys are preserved.

Implication for our use of `caption_style`: every save sends the full object (or null), not a partial patch. Switching from `{position: 'top'}` to `{hide: true}` correctly replaces the whole value (loses `position`) — that matches the UX of the 4-way toggle which can't be both Top *and* Hidden.

`entry_meta` is permissive — no schema validation. The `caption_style` key passes through unchanged.

### 5.4 Render server consumption

Three additions in [generate_video.py](../../ai_service/app/ai-video-gen-main/generate_video.py):

1. **`_load_timeline()`** — carry through `entry_meta` when normalizing the JSON. Previously stripped.
2. **`_active_entries_at()`** — preserve `entry_meta` in the per-frame active list.
3. **Per-frame caption block** — find the first non-branding active entry, read its `caption_style`, apply:
   - `hide: true` → no caption emitted this frame
   - `position: 'top'|'bottom'` → override the global position for this frame

Iteration is **first non-branding entry in timeline order**. The editor's `CaptionOverlay` uses the same semantic (`entries.find(...)`), so editor preview matches the rendered MP4 even for overlay+base shots.

### 5.5 Forward-compat

- Old timelines without `entry_meta` flow through `_load_timeline` unchanged (the `isinstance(em, dict)` guard skips).
- Old render server (no `entry_meta` carry-through) silently ignores per-shot overrides. Editor preview still works; renders just don't honor per-shot overrides until the render server is re-deployed.

---

## 6. Render dialog handoff

The editor's "Render MP4" button opens [RenderSettingsDialog.tsx](../../frontend-admin-dashboard/src/routes/video-api-studio/-components/RenderSettingsDialog.tsx) with `initialSettings` derived from the editor store's `captionSettings`:

```ts
initialSettings={{
  captions:          captionSettings.enabled,
  captionPosition:   captionSettings.position,
  captionTextColor:  captionSettings.textColor,
  captionBgColor:    captionSettings.bgColor,
  captionBgOpacity:  Math.round(captionSettings.bgOpacity * 100),
  captionSize:       snapSizeToBucket(captionSettings.sizePx),  // 36 → S, 48 → M, 64 → L
}}
```

The dialog overlays these on top of localStorage (`video-render-settings`) so:
- Resolution / fps / watermark stay sticky across renders (dialog's own keys)
- Caption fields always reflect what was just previewed

`snapSizeToBucket` (in [caption-rendering.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/caption-rendering.ts)) handles the freeform `sizePx` ↔ S/M/L round-trip — within ±6px the bucket wins, so the dialog's discrete picker doesn't drift if a future feature lets users pick freeform sizes.

Dialogs opened from non-editor contexts (`VideoResult.tsx`, `PipelinePanel.tsx`) don't pass `initialSettings`, so they fall back to localStorage like before — no behavior change for the post-generation result panel.

---

## 7. Invariants & gotchas

1. **Three phrase-build implementations must stay in lockstep.** Algorithm, constants, regex, lead/tail — all duplicated across Python and two TS files because the algorithm is small and crosses a language boundary. Change one → change all three. The duplicated comment headers in each file flag this.

2. **Font-size scaling has exactly one site.** [generate_video.py:856-858](../../ai_service/app/ai-video-gen-main/generate_video.py) scales by `width / 1920`. The render worker does NOT pre-scale (regression fix from 2026-05). The editor's `captionContainerCss` mirrors this scale. If you ever add a third scaling pass you'll get `(width/1920)²` and portrait captions will shrink to ~1% of frame.

3. **Position offsets are baked at 3.7% / 7.4%** of canvas height. Browser preview ([CaptionDisplay.tsx](../../frontend-admin-dashboard/src/components/ai-video-player/components/CaptionDisplay.tsx)) and editor overlay both use these. Render server uses `int(height * 0.037)` / `* 0.074`. Don't introduce a fourth set of constants.

4. **Per-shot iteration order is timeline-insertion-order, first non-branding wins.** With overlapping entries (rare), the entry added first to `entries[]` defines the caption_style. Editor and renderer agree on this.

5. **`null` is the cleared-override sentinel, not an absent key.** Required to force BE deep-merge to overwrite a stale on-disk override.

6. **The `vx-caption-editor-settings` localStorage key is the editor's own.** Don't unify with `ai-player-caption-settings` (post-gen player preview) or `video-render-settings` (render dialog) — they're three separate UX surfaces.

7. **`captionPhrases` is derived state.** Built once in `loadCaptionWords()` from `captionWords`. If you ever let the user edit individual word timestamps mid-session, also rebuild `captionPhrases`.

8. **The editor caption overlay needs an explicit `zIndex`.** `EditorCanvas`'s `EntryLayer` sets `zIndex: entry.z ?? zFallback` per shot — overlay shots can carry z up to 8999. Without `zIndex: 9999` on the caption div, captions stack *under* any shot with z>0 and disappear. The render server avoids this because the dispatcher emits captions in a dedicated overlay slot, not as a DOM sibling of shots. Set in [caption-rendering.ts:captionContainerCss](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/caption-rendering.ts).

---

## 8. Key files

### Render server
- [generate_video.py](../../ai_service/app/ai-video-gen-main/generate_video.py) — `_build_caption_segments`, `_active_caption_at`, `_load_timeline`, `_active_entries_at`, per-frame caption block
- [captions_settings.json](../../ai_service/app/ai-video-gen-main/captions_settings.json) — server-side default style (used when no override sent)
- [worker.py](../../ai_service/render_worker/worker.py) — override-file writer (caption_*` request fields → `captions_settings_override.json`)

### Frontend — editor
- [utils/caption-rendering.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/utils/caption-rendering.ts) — `buildPhrases`, `activePhraseAt`, `captionContainerCss`, types
- [CaptionOverlay.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/CaptionOverlay.tsx) — canvas overlay
- [CaptionSettingsPanel.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/CaptionSettingsPanel.tsx) — settings UI
- [ShotCaptionOverride.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/ShotCaptionOverride.tsx) — per-shot 4-way toggle
- [EditorCanvas.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/EditorCanvas.tsx) — mounts overlay
- [TimelineScrubber.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/TimelineScrubber.tsx) — caption phrase row
- [VideoEditorPage.tsx](../../frontend-admin-dashboard/src/components/ai-video-editor/VideoEditorPage.tsx) — bootstrap, dialog seed
- [stores/video-editor-store.ts](../../frontend-admin-dashboard/src/components/ai-video-editor/stores/video-editor-store.ts) — slices, actions, save payload

### Frontend — player (post-generation preview)
- [hooks/useCaptions.ts](../../frontend-admin-dashboard/src/components/ai-video-player/hooks/useCaptions.ts) — phrase builder + word fetcher
- [components/CaptionDisplay.tsx](../../frontend-admin-dashboard/src/components/ai-video-player/components/CaptionDisplay.tsx) — overlay component
- [types.ts](../../frontend-admin-dashboard/src/components/ai-video-player/types.ts) — `Entry.entry_meta.caption_style` schema, `CaptionSettings`

### Frontend — render dialog
- [RenderSettingsDialog.tsx](../../frontend-admin-dashboard/src/routes/video-api-studio/-components/RenderSettingsDialog.tsx) — `initialSettings` overlay
- [video-generation.ts](../../frontend-admin-dashboard/src/routes/video-api-studio/-services/video-generation.ts) — `RenderSettings`, `DEFAULT_RENDER_SETTINGS`, `requestVideoRender`

### Backend
- [external_video_generation.py](../../ai_service/app/routers/external_video_generation.py) — `/frame/update`, `/frame/add`, render request body, `_CAPTION_SIZE_PX`

### Tests / verification
- TypeScript: `pnpm run typecheck` in `frontend-admin-dashboard/`
- Python parse check: `python3 -c "import ast; ast.parse(open('generate_video.py').read())"`
- Manual smoke: see verification section in [the implementation plan](../../../.claude/plans/plan-and-then-start-velvet-karp.md) if it's still around — open the editor, toggle captions, render, compare.

---

## 9. Recent bug fixes leading here

Bundled chronologically; see file blame / commits for exact lines.

1. **Font double-scale on portrait** — worker.py was pre-scaling by `render_width/1920` and `generate_video.py:850-858` was scaling again. Portrait captions shrank to `(width/1920)² = 31%` of intended size. Fix: pass-through in worker; one scale site in `generate_video.py`.
2. **Default opacity mismatch** — player preview defaulted to 0.75, render dialog and server defaulted to 0.6. Aligned all to 0.6 (matches the server-baked default which has been on disk longest).
3. **Browser preview position drift** — admin/learner player used fixed `top: 40px / bottom: 80px`, which only matched the MP4 at a 1080-tall player. Replaced with `top: 3.7% / bottom: 7.4%` so preview tracks any container size.
4. **Dead `box.y` in worker** — worker wrote a `box.y` field nothing read, with constants (3% / 85%) inconsistent with the live 3.7% / 92.6%. Deleted.
5. **Dead `caption_box` in generate_video.py** — local set but never consumed. Deleted.
6. **Inaccurate "Client defaults" comment** in `generate_video.py:850-851`. Replaced with the real "px at 1920w canvas" contract description.
7. **ADD path drops `caption_style`** — `/frame/add` payload only included `display_name` in `entry_meta`, so caption overrides on freshly-inserted shots were dropped on first save. Fixed to mirror the UPDATE branch.
8. **Editor caption overlay invisible due to z-stacking** — the caption div had no explicit `zIndex`, so any shot with `entry.z > 0` (overlay band 500–8999) rendered on top and hid the caption. Fixed by setting `zIndex: 9999` in `captionContainerCss` — above all shot bands, below selection handles.
9. **Rendered MP4 went all-white whenever captions were enabled** — `__updateCaption` in [dispatcher_install_js.py](../../ai_service/app/ai-video-gen-main/dispatcher_install_js.py) copy-pasted the shot-entry sizing logic from `__updateSnippets` and forced an **opaque body-colored background** on the caption host (`host.style.background = getComputedStyle(document.body).backgroundColor || '#ffffff'`). The caption host sits in `#ui-layer` (z-index 9999) and covers the entire viewport for positioning math, so an opaque host blanket-covered every shot iframe — captions-on renders showed only the caption pill on a white screen. Fixed by keeping the host `background: transparent` (and dropping the now-irrelevant inner-content `minHeight` enforcement that was a holdover from the shot-fill logic). Shots in `#world-layer` now show through the transparent caption overlay as intended.
10. **Dispatcher install failed entirely after redeploy** — the `scopedCode` JS template literal in [dispatcher_install_js.py:417-1077](../../ai_service/app/ai-video-gen-main/dispatcher_install_js.py) (the per-shot script wrapper that gets injected via `newScript.textContent`) had several "comment decorations" using **bare backticks** (e.g. `` // `data-vx-managed` so ... ``). Inside a JS template literal, an unescaped backtick **closes the template literal** — the parser then saw `data-vx-managed` etc. as bare JS expressions. As long as the resulting expression happened to be syntactically valid (identifier-minus-identifier-minus-identifier parses as subtraction), Chromium had been silently accepting nonsense code that just happened never to run in practice. After the redeploy that introduced the caption-host transparency fix, Playwright's `page.evaluate(get_dispatcher_install_js(libs))` started failing outright (renders died at `_prepare_page` — never reached `__updateSnippets`/`__updateCaption` install). Fixed by replacing the bare-backtick decorations in those comments with apostrophes. Only the intended opening backtick at line 417 and the closing at line 1077 now remain in the template-literal region — exact pair, exactly as the template should be. Belt-and-braces invariant: **don't use bare backticks for emphasis in any comment inside a JS template literal** — either escape (`\``) or use apostrophes.
