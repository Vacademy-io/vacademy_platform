# HTML Document Slide Integration Guide for Admin Portal

This guide details the integration of the **HTML Document** slide type — a rich-text document authored with the **Tiptap** editor, coexisting with the legacy Yoopta-based Document slide.

## 1. Overview

The HTML Document is a **sub-type of the existing DOCUMENT slide** (`slide.source_type = "DOCUMENT"`, `document_slide.type = "HTML"`), NOT a new top-level slide type like AUDIO. It reuses the entire document-slide backend stack: same table, same DTOs, same endpoints, same publish/copy/tracking logic.

| | Legacy Document | HTML Document |
|---|---|---|
| `document_slide.type` | `DOC` | `HTML` |
| Editor (admin) | Yoopta | Tiptap (`TipTapEditor`) |
| Stored format | HTML (via lossy Yoopta serialize) | HTML (native, lossless) |
| Learner renderer | `DocViewer` (HTML path) | `DocViewer` (same, forced HTML) |

**Why it exists:** Yoopta's HTML deserialize/serialize round-trip is lossy and fragile at scale. Tiptap consumes and emits HTML natively, so `document_slide.data` round-trips losslessly. The AI course-creation flow now creates `HTML` documents (AI content is generated as HTML). Existing Yoopta (`DOC`) slides keep working unchanged.

## 2. Backend

**No new endpoints.** The existing document-slide contract is reused verbatim — only the `type` value differs.

### 2.1 Create or Update HTML Document Slide

- **Endpoint:** `POST /admin-core-service/slide/v1/add-update-document-slide`
- **Query Parameters:** `chapterId`, `moduleId`, `subjectId`, `packageSessionId`, `instituteId` (all required)
- **Request Body (`AddDocumentSlideDTO` - snake_case):**

```json
{
  "id": "uuid (send for update; with new_slide=true for create)",
  "title": "string (required)",
  "description": "string (optional)",
  "image_file_id": "string (optional)",
  "status": "DRAFT | PUBLISHED | UNSYNC",
  "slide_order": 1,
  "notify": false,
  "new_slide": true,
  "document_slide": {
    "id": "uuid",
    "type": "HTML",
    "data": "<h1>…</h1><p>Tiptap HTML…</p>",
    "title": "string",
    "cover_file_id": "string (optional)",
    "total_pages": 1,
    "published_data": "<p>…</p> (published snapshot, or null)",
    "published_document_total_pages": 1,
    "force_publish": false,
    "force_overwrite": false
  }
}
```

- **Publish semantics:** DRAFT/UNSYNC writes `data`; PUBLISHED copies content into `published_data` (and keeps `data` in sync). Draft saves must always echo the existing `published_data` back so the published snapshot is never wiped.
- **Content guards:** the backend 409s a save/publish that would drastically shrink content or drop structural blocks (`<table>`, `<img>`, `<video>`, `<iframe>` are counted for Tiptap HTML too). Retry with `force_overwrite` / `force_publish` after user confirmation.

### 2.2 Retrieve

Same as all document slides — admin slide list returns `document_slide.{id,title,type,data,published_data,total_pages,…}` with `type = "HTML"`.

### 2.3 Backend changes that were made (for reference)

- `DocumentTypeEnum` — added `HTML` (documentation only; `document_slide.type` is a free varchar and is not validated).
- Chapter/module doc-count queries (`SlideRepository.countSlidesByChapterId`, `ModuleChapterMappingRepository` ×3) — `doc_count` now counts `type IN ('DOC','HTML')`.
- Everything else (copy, move, publish, content history/restore, learner read, activity tracking, reports) branches on `source_type='DOCUMENT'` and works unchanged.

## 3. Admin Portal Implementation

### 3.1 Creating

"Add Slide" → **Document** → **Create HTML document** (`slides-sidebar-add-button.tsx`, case `create-html-doc`). Creates a `type:'HTML'` slide with empty data and a unique "Document N" title.

### 3.2 Editing (`slide-material.tsx`)

- `loadContent` routes `document_slide.type === 'HTML'` to `HtmlDocEditor` (`-components/html-doc/html-doc-editor.tsx`), which wraps the shared `TipTapEditor` (`src/components/tiptap/TipTapEditor.tsx`).
- **Autosave:** every editor change is normalized (see 3.3), stashed in `htmlDocRef`, and a **4s-debounced silent draft save** fires (`saveHtmlDocDraft`). Status semantics: DRAFT stays DRAFT; PUBLISHED/UNSYNC becomes **UNSYNC** — publishing is always explicit (no auto-publish).
- **Save Draft / Publish buttons** read the latest HTML from `htmlDocRef`; publish routes through the standard `handlePublishSlide` DOCUMENT branch (409 confirm + force retry supported). Download-as-PDF works via the same `convertHtmlToPdf` used for DOC.
- **Version history:** the history dialog previews HTML snapshots in a sandboxed iframe (same as DOC).

### 3.3 The code-block contract (IMPORTANT)

All document HTML on the platform uses the lossless code-block form:

```html
<pre data-code="<base64 utf-8>" data-language="python" style="white-space: pre;"><code class="language-python">…</code></pre>
```

`data-code` is the source of truth (survives HTML re-parsing; also tells the learner renderer "code, never mermaid"). Tiptap doesn't emit it natively, so `normalizeCodeBlocksHtml` (`html-doc/html-doc-utils.ts`) re-encodes it on **every save**. Do not bypass it.

### 3.4 AI course creation

`courseCreationService.createDocumentSlide` now creates document slides with `type: 'HTML'` — the generated HTML is stored as-is (no Yoopta conversion). The AI generating/viewer surfaces edit with `TipTapEditor` and render read-only via `DocumentWithMermaidSimple`.

## 4. Key Enums / Values

- **slide.source_type:** `DOCUMENT`
- **document_slide.type:** `HTML`
- **SlideStatus:** `DRAFT`, `PUBLISHED`, `UNSYNC`

## 5. Known v1 gaps (vs Yoopta feature set)

Core parity is covered (headings, lists, tables, images/video/audio/files, links, code blocks, math (KaTeX), mermaid, drawings). Yoopta's exotic custom blocks are **not** yet available in Tiptap: quiz-in-doc, flashcards, fill-blanks, tabs, accordion, timeline, columns, table-of-contents, todo-list, and Jupyter/Scratch/PDF embeds. Existing `DOC` slides retain them via Yoopta; add Tiptap nodes as follow-ups if needed.
