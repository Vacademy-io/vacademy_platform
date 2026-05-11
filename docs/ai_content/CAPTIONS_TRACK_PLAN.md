# Captions Track — Plan

A first-class captions/subtitles track for the AI Video Editor.

Companion docs:
- [VIDEO_EDITOR_REVIEW.md](./VIDEO_EDITOR_REVIEW.md) (engineering review)
- [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md) (generation pipeline)

---

## 1. Problem

We have all the data needed to caption every video and ship none of it.

- The pipeline already produces per-word timestamps (`wordsUrl` on
  [AIContentPlayerProps](../../frontend-admin-dashboard/src/components/ai-video-player/types.ts#L213-L218))
  and per-sentence clips with rebased word timings
  ([SentenceClip](../../frontend-admin-dashboard/src/components/ai-video-player/types.ts#L192-L199)).
- The editor uses sentence data only for *re-narration* in the Text/Script
  tab — never to render captions.
- The renderer (MP4 output) never burns captions in.
- There is no SRT/VTT export anywhere.

**Result:** every creator who needs captions (which is most of them) leaves
our tool, runs the MP4 through CapCut/Veed/Submagic, and treats us as a
draft generator. We lose the export step — the moment our north-star metric
("video shipped without leaving") is decided.

This affects three audiences directly:

| Audience | Why captions are non-negotiable |
|---|---|
| Educators / institutes | Accessibility (WCAG, ADA, India RPwD Act) and ESL learners. |
| Social repurposers | 85% of social video is watched muted; uncaptioned = unwatched. |
| Internal review / QA | Reviewers skim with sound off; captions are how they verify script. |

---

## 2. Why now

- **Data is free.** No new model calls, no new pipeline. We are sitting on
  word-level timestamps and only need a UI + render path.
- **Aspect-ratio reframe is on the roadmap.** Captions in 9:16 demand
  different positioning/sizing than 16:9; building captions *before* reframe
  means reframe inherits the layout system instead of bolting on.
- **Render is the stickiness moment.** Once a creator hits "Render" with
  burned-in captions and gets a usable MP4, our retention math changes.

---

## 3. Scope

Three releases, gated by user value, not engineering convenience.

### MVP — "Toggle captions on, ship the video"

A creator opens the editor, clicks **Captions: On**, picks one of three
styling presets, hits Render, gets an MP4 with burned-in captions.

- New top-level **Captions** toggle in the editor toolbar (next to Render).
- Three presets, no custom styling: **Subtitle** (bottom-centre, white on
  semi-transparent black), **Karaoke** (word-by-word highlight), **Title**
  (large centred for vertical/social).
- Auto-generated from `meta.sentences[]`. No manual edit yet.
- Burned in by the renderer at export time; also visible in the editor's
  preview iframe so WYSIWYG holds.
- SRT + VTT download from the editor toolbar (independent of render).
- One global on/off; can't disable per-shot in MVP.

**Out of scope for MVP:** custom fonts/colors, repositioning, per-shot
overrides, multiple language tracks, live caption editing.

### V1 — "Edit and style without leaving"

- Captions tab in the right Properties panel listing every caption line
  (one per `SentenceClip`) with inline edit.
- Editing a caption is *text-only* (does not re-trigger TTS) and decouples
  the displayed string from `sentence.text`. Schema below.
- Style controls: font family (from the brand kit), size, color, stroke,
  background opacity, position (top / middle / bottom + safe-area aware),
  max characters per line, max lines.
- Per-shot override: hide captions for branding-intro/outro shots by
  default; user can opt back in.
- Toggle "Highlight active word" (karaoke mode) independent of preset.

### V2 — "One video, many languages"

- Multi-language caption tracks. Add a new track from a translation of the
  existing one (calls into the AI service).
- Track switcher in the editor; render dialog picks which to burn in or
  attach as a soft-sub track.
- SRT/VTT export per language.
- (Stretch) Side-by-side dual captions for bilingual learning content.

---

## 4. Data model

Captions are derived state by default and only persist when the user
diverges from the auto-generated version. This avoids a second source of
truth that drifts every time someone re-narrates a sentence.

```ts
// Added to TimelineMeta in
// frontend-admin-dashboard/src/components/ai-video-player/types.ts
interface CaptionsConfig {
  enabled: boolean;
  preset: 'subtitle' | 'karaoke' | 'title';
  // Style overrides applied on top of the preset. Empty = use preset defaults.
  style?: {
    fontFamily?: string;     // resolved against brand kit when present
    fontSize?: number;       // in canvas px at 1920×1080 baseline
    color?: string;
    strokeColor?: string;
    strokeWidth?: number;
    backgroundColor?: string;
    backgroundOpacity?: number;
    position?: 'top' | 'middle' | 'bottom';
    maxCharsPerLine?: number;
    maxLines?: number;
    highlightActiveWord?: boolean;
  };
  // Per-sentence overrides. Sparse — only sentences the user touched.
  // Keyed by SentenceClip.id so re-narration that mutates `text` does
  // not invalidate overrides unless the user later resets them.
  overrides?: Record<string, {
    // null = hide this caption entirely
    text?: string | null;
    style?: Partial<CaptionsConfig['style']>;
  }>;
  // Per-shot hide list (e.g. branding-intro shots).
  hiddenEntryIds?: string[];
}

interface TimelineMeta {
  // ... existing fields ...
  captions?: CaptionsConfig;
}
```

Two ground rules:

1. **Single source of truth for *timing* is `meta.sentences[]`.** Captions
   never own timestamps. Re-narration ripples timestamps; captions follow
   automatically.
2. **`overrides[id].text` is only written when the user types in the
   captions tab.** Auto-changes (re-narration, regenerate frame) never
   touch overrides.

Migration: legacy videos without `meta.captions` default to
`{enabled: false}` server-side. The editor offers a one-click "Turn on
captions" that flips it to a preset.

---

## 5. UX surfaces

### 5.1 Editor toolbar

A `Captions` button next to `Preview / Render`, with a small dropdown:

```
[ CC ▾ ]  ─── Captions: On / Off
              Preset: ● Subtitle  ○ Karaoke  ○ Title
              ───────────────
              Edit captions →   (jumps to Captions tab)
              Download SRT
              Download VTT
```

Live preview updates the canvas iframe immediately. No save round-trip
required for the toggle.

### 5.2 Properties panel — new "Captions" tab (V1)

Eighth tab on
[PropertiesPanel.tsx:1477-1494](../../frontend-admin-dashboard/src/components/ai-video-editor/PropertiesPanel.tsx#L1477-L1494):

- Top: preset switcher + style controls (collapsible "Advanced…" group).
- List: one row per `SentenceClip`, showing timestamp + caption text. Click
  to edit; Reset clears the override and falls back to `sentence.text`.
- Each row has: hide-this-caption toggle, "jump to time" (existing pattern
  from `OutsidePlayheadBadge`), inline edit.
- Bulk: "Reset all overrides", "Hide on branding shots".

### 5.3 Canvas rendering

Two render paths, same source of truth:

- **Editor preview**: a thin overlay layer above the entry iframes —
  *not* injected into entry HTML. This keeps the per-entry HTML clean
  (HTML stays narration-agnostic) and avoids the iframe-reload cost
  flagged in [VIDEO_EDITOR_REVIEW.md](./VIDEO_EDITOR_REVIEW.md) (B16). The
  overlay reads `currentTime` from the store and looks up the active
  sentence in `meta.sentences[]` (already O(log n) sorted by start_time).
- **MP4 render**: server-side renderer reads the same `CaptionsConfig`,
  burns the captions onto each frame using the same positioning math.
  Both paths share a `resolveCaptionLines(sentence, config, t)` helper so
  preview and final stay identical.

### 5.4 SRT / VTT export

Pure client-side from `meta.sentences[]` + `overrides`. One function
per format, no backend round-trip. Filename follows the video's slug.

For multi-line wrapping, respect `maxCharsPerLine` / `maxLines` in the
config; greedy-wrap on word boundaries. Fall back to the raw sentence text
when overrides are absent.

### 5.5 Render settings dialog

[RenderSettingsDialog](../../frontend-admin-dashboard/src/routes/video-api-studio/-components/RenderSettingsDialog.tsx)
gains:
- Captions: **Off / Burned-in / Soft track (mp4 mov_text)**
- Language: (V2) dropdown of available tracks.

---

## 6. Backend / renderer changes

| Where | Change |
|---|---|
| `ai_service` timeline schema | Accept and persist `meta.captions`. No-op if absent. |
| `ai_service` renderer | Read `meta.captions`; render an HTML caption layer above the shot iframes (same DOM trick as the editor preview) when `enabled && burned_in`. |
| `ai_service` renderer | Optional: emit an `mov_text` soft-sub track in the MP4 when the user picks "soft track". Pure ffmpeg flag. |
| `ai_service` (V2) | New endpoint `/captions/translate` that takes a target language and returns a new `CaptionsConfig` with translated `overrides[*].text` derived from sentences. |

No new persistent storage — captions live inside `timeline.json`.

---

## 7. Edge cases worth naming up front

- **Sentence with empty `text`** (silenced via `apiSilenceSentence`):
  caption is hidden automatically. Don't render an empty box.
- **Re-narration changes `sentence.text`**: if the user has an override for
  that sentence, keep the override and show a "edited — original updated"
  badge next to the row in the Captions tab so they can reset.
- **User-driven (index-based) videos** without continuous narration:
  captions tab shows a non-blocking "This video has no narration; captions
  unavailable" state. Don't try to fall back to entry-level text — that's
  not what users mean by "captions".
- **Aspect-ratio reframe** (future): caption position is in % of canvas,
  not px. `safe-area`-aware: bottom captions clamp above the safe-area line
  in 9:16 to dodge platform UI overlays.
- **Caption text containing HTML**: always escaped at render time. We are
  not letting users smuggle HTML into captions even if they paste it in.

---

## 8. Done criteria

### MVP
- [ ] Toggle captions on for any captioned-eligible video (has narration).
- [ ] Three presets render correctly in editor preview and final MP4 at
      both 1920×1080 and 1080×1920 baselines.
- [ ] Existing videos without `meta.captions` open without errors and show
      a "Turn on captions" affordance.
- [ ] SRT and VTT files validate against a standard parser
      ([webvtt-py](https://github.com/glut23/webvtt-py) is the test bar).
- [ ] Render with captions does not increase render time by > 10%.

### V1
- [ ] Captions tab editable; overrides persist round-trip.
- [ ] Style overrides apply identically in preview and render.
- [ ] Per-shot hide works for branding intro/outro out of the box.
- [ ] Re-narration of a sentence preserves user overrides and surfaces a
      "source updated" badge.

### V2
- [ ] Add second language track from existing track.
- [ ] Render dialog can pick which track to burn in or include as soft sub.
- [ ] SRT/VTT export per track.

---

## 9. Open questions

1. **Style storage when a brand kit ships.** Captions style references
   font/color from the brand kit; what's the precedence when both are set?
   Suggested rule: brand kit defines defaults, caption overrides win.
2. **Soft-sub on platforms that strip it.** Instagram Reels strips
   `mov_text` — should the render dialog warn when "soft" + a platform
   preset that drops it are combined? Tied to the platform-presets work.
3. **Karaoke timing granularity.** Word-level highlight uses
   `SentenceClip.words` (already rebased). Do we ship phoneme-level too,
   or is word-level "good enough"? Recommend word-level for V1.
4. **Translation cost visibility.** V2 translation is an AI call that
   should show a credit estimate before running, consistent with other AI
   actions in the editor (see VIDEO_EDITOR_REVIEW.md §3).
5. **Auto-detect when captions are mandatory.** Should we *default* to
   captions: on for any video shorter than 90s (i.e. social-shaped)?
   Probably yes once V1 ships and editing is cheap.

---

## 10. Suggested execution order

1. Schema + migration: `meta.captions` optional field, defaults to off.
2. Editor preview overlay (read-only, three presets, no editing).
3. Toolbar toggle + SRT/VTT export.
4. Server renderer: burned-in captions path.
5. Captions tab: line-level edit, hide, reset.
6. Style controls + brand-kit integration.
7. Soft-sub render path.
8. Translation pipeline + multi-track UI (V2).

Steps 1–4 deliver the MVP. Steps 5–6 are V1. 7–8 are V2.
