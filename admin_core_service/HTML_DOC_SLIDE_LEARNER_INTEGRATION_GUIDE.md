# HTML Document Slide Learner App Integration Guide

This guide describes how the Learner Application renders and tracks the **HTML Document** slide type (Tiptap-authored documents).

## 1. Identification & Data Structure

An HTML document is a DOCUMENT slide with a new sub-type:

- `slide.source_type` = `"DOCUMENT"`
- `slide.document_slide.type` = `"HTML"`

**Example JSON Response:**

```json
{
  "id": "slide_123",
  "title": "Chapter Notes",
  "source_type": "DOCUMENT",
  "document_slide": {
    "id": "doc_slide_abc",
    "type": "HTML",
    "data": "<h1>…</h1>",
    "published_data": "<h1>…</h1><p>Published HTML…</p>",
    "total_pages": 1,
    "published_document_total_pages": 1
  }
}
```

**Important:**

- **Learners always read `document_slide.published_data`** (never draft `data`).
- Unlike legacy `DOC` (which may hold either an HTML string or a DOCX file id), `published_data` for `HTML` is **always an inline HTML string** — no file-id sniffing or `getPublicUrl` fallback is needed.

## 2. Rendering

`type === "HTML"` is **creative, self-contained HTML**, so it renders in a **sandboxed iframe** (its CSS/JS animations must run, and it must be isolated from the learner app):

```
slide-material.tsx  (type HTML → creativeHtml=true)
  → DocViewer (tracking wrapper, unchanged)
    → DocViewerComponent (creativeHtml branch)
      → HtmlSlideIframe  (<iframe sandbox="allow-scripts" srcDoc={published_data}>)
```

- `sandbox="allow-scripts allow-popups…"` **without** `allow-same-origin` → the document gets a unique opaque origin: scripts/animations run, but it cannot read the parent DOM, cookies, or storage.
- The iframe auto-resizes to its content via a `postMessage` height beacon injected into the srcdoc, so the learner page scrolls naturally.
- Legacy `DOC` slides are unchanged (still the inline `DocumentWithMermaid` path with code/mermaid processing). Only `HTML` uses the iframe.

## 3. Tracking Progress

Identical to legacy document slides — the `DocViewer` wrapper posts activity automatically:

- **Endpoint:** `ADD_UPDATE_DOCUMENT_ACTIVITY` (same as DOC/PDF)
- **Payload:** `source: "DOCUMENT"`, `documents: page_views[]`, `percentage_watched = total_pages_read`
- HTML documents render as one long scrolling page, so `total_pages_read`/`current_page` ≈ 1 (same behaviour as today's HTML-flavoured DOC slides).
- No new `learner_operation` value is needed; backend merges intervals and computes completion (`DOCUMENT_LAST_PAGE` / `PERCENTAGE_DOCUMENT_COMPLETED` are derived server-side).

## 4. UI Mappings

- **Icon** (`chapter-sidebar-slides.tsx` `getIcon`): `HTML` → same blue `FileDoc` as DOC.
- **Label** (`getSlideTypeDisplay`): `HTML` → "Reading Note" (same as DOC).
- **Estimated read time** (`utils/courseTime.ts`): `HTML` → 30 min default, normalized to `DOCUMENT`.

## 5. Notes

- The AI chatbot context builder reads `document_slide.published_data` generically, so HTML docs are already ingested with no change.
- Sanitization posture matches the existing DOC path (admin-authored content is trusted; only AWS query params are stripped). If learner-facing sanitization is ever added, apply it to both DOC and HTML paths.
