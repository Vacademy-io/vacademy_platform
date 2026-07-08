# DOC Slide Content-Loss Investigation ("history drops callouts / images / text / tables / headings")

> **Status:** FIXED & verified (2026-07-08) on branch `fix/slide-content-loss`. Layers 4, 2, and 3B
> implemented; Layer 1 skipped (made moot by Layer 4). Verified by unit tests (21 vitest + 7 backend),
> 3 curl guard tests, and a live 4-round browser torture test (reopen/switch/reload, publish cycle,
> 11 MB image race, guard popup) — **zero data loss** across ~25 operations. See [Fix Plan](#fix-plan)
> for the design and §11 for the shipped files.
> **Audience:** any future session picking up the slide save/history reliability work.

This document records, in detail, the reproduction steps, symptoms, tools, evidence, and root-cause
analysis behind the reported bug: *"the callouts and images are not being saved as part of history,
sometimes the text is not even being saved."* It is intentionally exhaustive so a future session does
not have to re-derive any of it.

---

## 1. TL;DR

- The **`slide_content_history` audit table is NOT the bug.** It faithfully records whatever the save
  wrote. The loss is **upstream**, at the editor serialize/deserialize level.
- The reported symptom is really **three distinct defects**, all rooted in the fact that
  **`html.deserialize` ⇄ `html.serialize` (Yoopta `@yoopta/exports`) is not a lossless round-trip**:
  1. **Content LOSS (proven):** `html.deserialize` silently drops block elements (headings, paragraphs)
     that are nested inside HTML5 **semantic wrappers** (`<section>`, `<header>`, nested `<div>`).
  2. **Content BLOAT:** the round-trip can multiply empty `<p>` blocks (one slide reached **605** empty
     paragraphs, now baked into its stored data).
  3. **Stale-editor-state reset:** a Save Draft on a PUBLISHED/UNSYNC slide flips status → `loadContent`
     re-runs → `applyDocContentToEditor()` re-deserializes → editor loses blocks → the next save
     persists the reduced content.
- **Amplifiers (no backstop):** the backend `handleDraftDocumentSlide` / `handleUnsyncDocumentSlide`
  write `data` with **no shrink guard** (only PUBLISHED is guarded, and only on `published_data`, with a
  ratio that would miss single-block losses); the frontend continuous stash uses `guardShrink=false`.
- **Byte-size is the WRONG signal.** Real losses were 23%–70% (a single heading/table among many). Only
  **block-count / block-identity** catches them.
- **Fix for defect #1 is in our control** (our preprocessing, not a Yoopta patch): flatten semantic
  wrappers before `html.deserialize`. Confirmed experimentally to restore all content.

---

## 2. Symptoms & original report

- Founder report: history is "not saving callouts / images / text; sometimes text not saved."
- User requirement: *"it should save every part of the document in whole — should not drop a callout or
  flash card or image or video or anything, not a single thing."*
- Actual observed behaviour: the editor **intermittently serializes and saves a shorter/incomplete
  version** of the content (dropping blocks), and history faithfully records that shorter content. The
  live `document_slide.data` ends up missing blocks that were previously present.

### Concrete production evidence (original incident, slide `19fa0535-…`)
`slide_content_history` timeline (draft size / has-image):
`16:45 → 73606 B (img✓)`, … `17:13–17:21 → 42425 B (img✓, 4× "Executive Summary")`,
`17:21:59 → 6739 B (img✗, 1 copy)` — **a single save collapsed 42 KB (with image) → 6.7 KB (no image).**
The corrupted content was a **valid, complete HTML document** that was a clean **prefix** of the good one,
truncated exactly at the image block — i.e. the editor genuinely serialized fewer blocks.

---

## 3. What was ruled OUT (do not re-litigate)

1. **History table / trigger** — `slide_content_history` (migration `V364__Add_slide_content_history.sql`,
   was `V363` locally) has a `BEFORE UPDATE` trigger on `document_slide`/`video`/`audio_slide` that
   snapshots `OLD.data`/`OLD.published_data` when they change. It records exactly what the save wrote.
2. **S3 URL sanitizer** — `stripAwsQueryParamsFromUrls` in `formatHtmlString.tsx` is bounded per-attribute
   and cannot over-truncate.
3. **Per-block "degraded" serialize fallback** — `getCurrentEditorHTMLContent` has a fallback that drops a
   block whose serializer *throws* and sets `lastSerializeDegradedRef`. In the reproduced cases the
   serialize did **not** throw (`degraded: false`); the blocks were genuinely absent from `editor.children`.

---

## 4. Environment & tools used

- **Local backend** `admin_core_service` on `:8072` (VS Code "Local (Docker DB)" profile / `run-local.sh
  admin_core`), talking to a **local Docker Postgres** `vacademy-localdb` (prod/dev dump).
- **Frontend** on `localhost:5173`. For the test, the slide load/save/history/status URL constants in
  `frontend-admin-dashboard/src/constants/urls.ts` were flipped to `LOCAL_ADMIN_CORE_BASE`
  (`http://localhost:8072`) — tagged `// LOCALTEST`, **must be reverted before commit**.
- **Backend logs** tee to `.samar/logs/backend.log` (via `run-local.sh`). Temporary `[SLIDE-DBG]` log lines
  were added in `SlideService.java` (`updateDocument` / `handleDraft` / `handleUnsync` / `handlePublished`
  / `guardAgainstPublishedContentWipe`) printing incoming vs stored `data` length, `<img>` count, head.
- **Browser console** `[SLIDE-DBG]` logs in `slide-material.tsx` at the serialize sites (`onChange`,
  `getCurrentEditorHTMLContent`) and the deserialize site (`applyDocContentToEditor`), printing
  `blockCount` / `htmlLen` / `hasImg` / a source-vs-deserialized fingerprint.
- **DB access:** `docker exec vacademy-localdb psql -U postgres -d admin_core_service -c "<sql>"`.
  Note: `slide_content_history.changed_at` is stored in **UTC** (IST − 5:30).
- **Headless round-trip harness:** `…/slides/-components/slide-operations/doc-slide-integrity/test.tsx`
  (vitest + jsdom) drives the real pipeline `serialize → appReloadPreprocess → html.deserialize →
  serialize` with the real plugin set. This is the single most valuable tool — it reproduces the loss
  **deterministically, without a browser.** (vitest `include` is `**/test.{ts,tsx}` — a research file must
  be named `test.tsx` inside its own folder to be picked up.)

Useful SQL:
```sql
-- history sizes/images for a slide (source_id = document_slide.id)
SELECT to_char(changed_at,'HH24:MI:SS') at, length(draft_value) d_len,
       (draft_value ILIKE '%<img%') img, (draft_value ILIKE '%<table%') tbl
FROM slide_content_history WHERE source_id='<document_slide.id>' ORDER BY changed_at DESC LIMIT 15;
-- live content
SELECT length(data), (data ILIKE '%<img%'), (data ILIKE '%<table%') FROM document_slide WHERE id='<id>';
```

---

## 5. Tests performed & results (chronological)

All on a fresh local DOC slide (`slide.id 1e3b2326…` / `document_slide.id dd79bd50…`) unless noted.

| # | Test | Result |
|---|------|--------|
| 1 | Add **text → image → video**, Save Draft each time | ✅ All saved. Monotonic growth 97→132→559→912 B. Image (S3) + video (`<video>` YouTube) intact. |
| 2 | **Reopen / switch away & back**, then save | ✅ No loss. Re-serialize was lossless for these (image/video are built-in Yoopta plugins). |
| 3 | Add **callout + flashcard + accordion**, Save + Publish | ✅ All survived forward-save. Serialized forms: callout=`<dl data-theme="error">`, flashcard=`<div data-yoopta-type="flashcard" data-flashcard="<base64>" …>`, accordion=`<div data-yoopta-type="accordion"><details>…`. |
| 4 | **Image/video race** — add a table + content, Save Draft while an upload was settling | ❌ **REPRODUCED.** 3746 B → 2899 B: the **table + trailing paragraph dropped**. Backend `handleUnsync … NO GUARD` wrote it. Live never recovered (`table=false`). |
| 5 | Console capture of the bad save | `getCurrentEditorHTMLContent` went **blockCount 11 → 9**, `degraded: false`. Stack: post-save status flip → `setEditorContent()` (slide-material.tsx:2404) → `applyDocContentToEditor()` re-deserialize → 9 blocks → next save persisted 9. |
| 6 | **Cold reopen** of slides with tables (`5a448b42`, `02a8a7e0`) — DESERIALIZE fingerprint | `LOSS_table:false` (table block type survives) **but** `02a8a7e0`: 10 `<h2>`/8 `<h3>` → `HeadingTwo:8`/`HeadingThree:4` (**6 headings lost**), 22540 B → 6482 B. `5a448b42`: 10944 B → **636 blocks incl. 605 empty paragraphs** (bloat). |
| 7 | **Headless harness** on real `02a8a7e0` published_data, stage by stage | See table below — pinned the loss to Yoopta's `html.deserialize`. |
| 8 | **Flatten experiment** in the harness | ✅ Flattening semantic wrappers before deserialize restores **all** headings/paragraphs. |

### Stage-by-stage heading counts (headless harness, real `02a8a7e0` published_data)
| Stage | len | h1 | h2 | h3 | p | li |
|---|---|---|---|---|---|---|
| 1. RAW stored HTML | 22540 | 1 | **10** | **8** | 41 | 50 |
| 2. after `appReloadPreprocess` | 15259 | 1 | **10** | **8** | 41 | 50 | ← our preprocessing preserves everything |
| 3. after `html.deserialize` | — | 1 | **8** | **4** | 13 | (12 lists) | ← **Yoopta drops 2 h2 + 4 h3** |
| 4. after re-serialize | 7556 | 1 | 8 | 4 | 13 | 12 |
| 5. after experimental **flatten** | 13683 | 1 | **10** | **8** | 41 | 50 |
| 6. deserialize after flatten | — | 1 | **10** | **8** | 41 | (50 lists) | ← **all content preserved** |

### Why Yoopta drops them — nesting analysis
The `02a8a7e0` HTML is AI-generated rich markup using `<header>`, `<section>`, and nested `<div>`. The
dropped headings are the ones buried at `divDepth ≥ 2` inside `<section>`/`<div>`. Yoopta's
`html.deserialize` does not reliably recurse through semantic/`<div>` wrappers, so block elements inside
them are lost. `appReloadPreprocess` only unwraps *single-child* top-level divs and specific
media/accordion wrappers — it never flattens `<section>`/`<header>`/multi-child `<div>`.

---

## 6. Root causes

### Defect A — lossy deserialize through semantic wrappers (PROVEN, primary)
`html.deserialize` drops block elements (headings, paragraphs) nested in `<section>`/`<header>`/nested
`<div>`. Reproduced deterministically in the headless harness (§5, stage 3). **Fix is in our
preprocessing.**

### Defect B — paragraph bloat
The round-trip can produce large numbers of empty `<p>` blocks (slide `5a448b42`: 605, now stored). Likely
compounds over repeated round-trips. Separate from A; needs its own repro but shares the "round-trip not
faithful" family.

### Defect C — stale-editor-state reset (the reproduced table drop)
Save Draft on PUBLISHED/UNSYNC flips status → `loadContent` re-runs. The guard meant to skip
re-deserialization on a same-slide re-run — `isSameSlideRerun` (slide-material.tsx:1738 / :2390) — was
**false** when it should have been true, so `setEditorContent()` → `applyDocContentToEditor()`
re-deserialized live content and (via Defect A / a transient state) dropped blocks (11 → 9). The next save
persisted the reduced content.

### Amplifiers (no backstop)
- **Backend:** `handleDraftDocumentSlide` / `handleUnsyncDocumentSlide` (`SlideService.java`) write `data`
  unconditionally — **no shrink guard**. Only `handlePublishedDocumentSlide` guards, via
  `guardAgainstPublishedContentWipe` (`MIN_CHARS=2000`, `RATIO=0.25`) — which would **miss** a 3746→2899
  (23%) single-block loss.
- **Frontend:** the continuous `onChange` stash calls `stashDocDraftLocally(…, guardShrink=false)`, so a
  transient short serialize overwrites the good local draft, which then wins on reopen
  (`getRestorableLocalDraftHtml` in `applyDocContentToEditor`).
- **`degraded` flag** does not catch it (serialize doesn't throw when blocks are simply absent).

---

## 7. Contexts where this bug can appear

Every path that **deserializes stored HTML into the editor and later re-serializes + saves**:
1. Save Draft on a PUBLISHED/UNSYNC slide (status flip → reload) — *reproduced*.
2. Slide reopen / switch back.
3. Page reload.
4. Publish.
5. Version-history restore (`SlideContentHistoryService.restore` writes `data` → reload deserializes).
6. Copy / Move slide.
7. AI-copilot course-generation viewer — `SortableViewerSlideItem.tsx` (5 `html.deserialize` sites);
   AI content is exactly the semantic-wrapper-heavy HTML that triggers Defect A.
8. Cold-path manual plugin init (`usedManualPluginInitRef`, slide-material.tsx ~764).

Per block type: `table`/`image`/`video` block **types** survive; **headings / paragraph structure** do
not when wrapped in semantic containers.

---

## 8. Fix Plan

Layered defense; the user's requirement is a **robust, long-term** solution, so Layer 4 (cure) + Layer 2
(net) are mandatory — the byte-size backstop alone is insufficient.

- **Layer 4 — make the round-trip lossless (the cure).** Extend `appReloadPreprocess`
  (`doc-slide-integrity/reload.ts` and the mirror in `slide-material.tsx applyDocContentToEditor`) to
  **recursively flatten non-block wrapper elements** (`section`/`header`/`article`/`main`/`aside`/`figure`
  and plain wrapper `div`s), promoting children to the root — while **protecting** block containers
  (`[data-yoopta-type]`, `table`/`thead`/`tbody`/`tr`/`td`/`th`, `ul`/`ol`/`li`, `dl`, `details`,
  `.mermaid`). Confirmed in the harness to restore all headings/paragraphs. Lock it in with the
  `doc-slide-integrity/test.tsx` suite, asserting **block-count/type parity** for each plugin AND for a
  semantic-wrapper fixture. Investigate Defect B (paragraph bloat) separately.
- **Layer 2 — load-time integrity gate (the net).** After `applyDocContentToEditor` deserializes,
  fingerprint the source HTML (block-by-type counts incl. headings + media src set) vs the re-serialized
  editor. If the editor is missing content, **do not make it authoritative**: keep the stored HTML, warn,
  and block save. Block-agnostic; protects against unknown/future block types.
- **Layer 1 — minimize re-deserialize.** Make `isSameSlideRerun` robust so a post-save status flip never
  re-deserializes a slide the editor already holds.
- **Layer 3 — backend backstop (coarse).** Add a shrink guard to `handleDraft`/`handleUnsync` mirroring
  `guardAgainstPublishedContentWipe`, with a `force` override, for catastrophic collapses only.

---

## 9. How to reproduce (headless, no browser)

The fastest loop is the vitest harness:
1. Dump a real semantic-wrapper slide's HTML to a file (e.g. `psql -tAc "SELECT published_data FROM
   document_slide WHERE id='02a8a7e0-…'" > fixture.html`).
2. In `doc-slide-integrity/…/test.tsx`, deserialize `appReloadPreprocess(fixture)` with the real plugin
   set (`makeEditor()` in `test.tsx`) and compare block-type counts to the source `<h2>`/`<h3>`/`<p>` counts.
3. `npx vitest run <path/to/test.tsx>`.

A semantic-wrapper document (`<section><h2>…</h2><p>…</p></section>`, headings at `divDepth ≥ 2`)
reproduces the heading loss; a flat document does not.

---

## 10. Debug scaffolding (used during the investigation — REMOVED before commit)

The investigation was instrumented with temporary scaffolding, all of which has since been reverted so
the branch is clean. Recorded here only so a future session knows how it was captured and can re-add it
if needed:

- `frontend-admin-dashboard/src/constants/urls.ts` — 9 slide endpoints were temporarily flipped to
  `LOCAL_ADMIN_CORE_BASE` (`http://localhost:8072`) to point the app at the local backend/DB.
- `SlideService.java` + `slide-material.tsx` — `[SLIDE-DBG]` log lines tracing incoming-vs-stored payloads
  and each serialize/deserialize block census.
- A Vite dev middleware (`/__slidedbg` in `vite.config.ts`) + `slide-dbg-sink.ts` teed console `[SLIDE-DBG]`
  output to `.samar/logs/frontend-dbg.log` for untruncated, reload-surviving capture.
- `doc-slide-integrity/_hdbg_research/` — a temporary headless research test that fed real slide HTML
  through the pipeline stage-by-stage to pinpoint the heading loss.

The permanent, committed verification lives in `doc-slide-integrity/test.tsx` (semantic-wrapper +
integrity-detector regression tests) and `SlideStructuralLossTest.java` (backend guard tests).

---

## 11. Key file references

- Frontend: `…/slides/-components/slide-material.tsx` — `applyDocContentToEditor` (deserialize @ ~1045),
  `getCurrentEditorHTMLContent` (serialize), `EditorWithPlaceholder.onChange` stash,
  `stashDocDraftLocally` / `getRestorableLocalDraftHtml`, `isSameSlideRerun` (1738/2390),
  `setEditorContent` (2404), `captureInitialDocSnapshot`.
- Preprocessing: `…/slides/-components/slide-operations/doc-slide-integrity/reload.ts` (`appReloadPreprocess`).
- Round-trip suite: `…/doc-slide-integrity/test.tsx`.
- Backend: `admin_core_service/.../slide/service/SlideService.java` — `updateDocument`,
  `handleDraftDocumentSlide`, `handleUnsyncDocumentSlide`, `handlePublishedDocumentSlide`,
  `guardAgainstPublishedContentWipe`.
- History: `SlideContentHistoryService.java`, `SlideContentHistoryController.java`,
  migration `V364__Add_slide_content_history.sql`, UI `slide-history-dialog.tsx`.

---

*Related: `docs/CODING_SLIDE_FEATURE.md`, `frontend-admin-dashboard/docs/adding-new-slide-type.md`.*
