# HTML Document Slide Integration Guide (Admin Portal)

The **HTML Document** slide is a piece of **pure, creative, self-contained HTML** — authored and edited entirely by **AI** (no rich-text / block editor), and rendered inside a **sandboxed iframe** so its CSS/JS animations run in isolation. It coexists with the legacy Yoopta `DOC` slide.

## 1. Overview

Sub-type of the existing DOCUMENT slide: `slide.source_type = "DOCUMENT"`, `document_slide.type = "HTML"`. It reuses the whole document-slide backend stack (table, DTOs, endpoints, publish/copy/tracking).

| | Legacy Document (`DOC`) | HTML Document (`HTML`) |
|---|---|---|
| Authoring (admin) | Yoopta block editor | **AI prompt → live iframe preview** (no editor) |
| Editing | WYSIWYG | **Re-prompt AI** (or raw-HTML source escape hatch) |
| Stored format (`data`) | HTML (lossy Yoopta serialize) | **raw creative HTML** (full `<!doctype html>` doc) |
| Rendering | inline (dangerouslySetInnerHTML) | **sandboxed iframe** (`allow-scripts`, opaque origin) |

**Why no editor:** an editor constrains the animations / bespoke layouts the model can produce. Admins describe what they want; AI generates a rich, animated HTML page. This also makes AI course-creation output first-class (it now emits the same creative HTML).

## 2. Backend

**No new admin_core endpoints.** The existing document-slide contract is reused verbatim — only `type` = `"HTML"` and `data`/`published_data` hold raw HTML. See §2.1 of the create/update contract below.

**New ai-service endpoint (authoring):**
```
POST /ai-service/html-doc/v1/generate      (requires auth)
Body: { prompt, current_html?, institute_id?, idempotency_key? }
Resp: { html, model }
```
- `current_html` absent → CREATE from `prompt`. Present → EDIT (apply `prompt` to that HTML).
- Returns a complete standalone HTML document. Credit-metered (best-effort, `RequestType.CONTENT`).

### 2.1 Create/Update slide (admin_core, unchanged contract)
`POST /admin-core-service/slide/v1/add-update-document-slide` (query: chapterId, moduleId, subjectId, packageSessionId, instituteId). Body `AddDocumentSlideDTO`:
```json
{
  "id": "uuid", "title": "string", "status": "DRAFT|PUBLISHED|UNSYNC",
  "slide_order": 1, "new_slide": true, "notify": false,
  "document_slide": {
    "id": "uuid", "type": "HTML",
    "data": "<!DOCTYPE html>…creative HTML…",
    "total_pages": 1, "published_data": "…", "published_document_total_pages": 1,
    "force_overwrite": false, "force_publish": false
  }
}
```
Publish copies `data` → `published_data`; draft saves preserve the existing `published_data`. Content-shrink / structural-loss 409 guards apply (retry with `force_*`).

Backend enum/query changes made: `DocumentTypeEnum` gained `HTML`; `doc_count` queries count `type IN ('DOC','HTML')`. All other logic keys off `source_type='DOCUMENT'` and is unchanged.

## 3. Admin Portal Implementation

- **Create:** "Add Slide" → **Document** → **Create HTML document** (`slides-sidebar-add-button.tsx`, case `create-html-doc`) — makes an empty `type:'HTML'` slide.
- **Author/edit (`html-doc/html-doc-ai-author.tsx`):** a prompt box → calls `/html-doc/v1/generate` → renders the result in `HtmlSlidePreview`. Re-prompt to edit; a collapsible **View/edit HTML** exposes the raw source for power tweaks. Content is stashed in `slide-material`'s `htmlDocRef`; Save Draft / Publish persist it (4s debounced autosave + explicit buttons). No block editor.
- **Rendering (`src/components/html-slide/html-slide-preview.tsx`):** `<iframe sandbox="allow-scripts allow-popups…" srcDoc={html}>` — no `allow-same-origin`, so the document gets a unique opaque origin (scripts/animations run; it cannot touch the parent DOM/cookies). Auto-resizes via a `postMessage` height beacon injected into the srcdoc, so the page scrolls naturally.
- **Icons/labels/history:** `HTML` reuses the DOC icon + "Document" naming; version-history preview shows the HTML snapshot in a sandboxed iframe.

## 4. AI course creation

`courseCreationService.createDocumentSlide` stores generated content as `type:'HTML'` and **skips `markdownToHtml` when the content is already HTML** (so inline `<style>`/`<script>` survive). The ai-service course-content document prompt (`content_prompts.build_document_prompt`) now instructs the model to produce a full creative standalone HTML document (inline CSS, tasteful motion, `prefers-reduced-motion`, real `data-img-prompt` illustrations still swapped in by the pipeline). The copilot preview/viewer render this HTML via the same sandboxed iframe.

## 5. Key values

- `slide.source_type` = `DOCUMENT`; `document_slide.type` = `HTML`; `SlideStatus` = `DRAFT|PUBLISHED|UNSYNC`.

## 6. Notes

- Generation can take up to ~a minute for a rich page; the UI shows a loading state.
- The raw-source escape hatch saves HTML verbatim; re-prompting keeps iterating with AI.
- TipTap/Yoopta are NOT used for HTML slides. (TipTap remains only in unrelated features like the email composer.)
