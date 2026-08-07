"""Burn the AI's corrections onto the answer sheet and upload it as a file.

Until this existed, a graded copy left no artifact: marks and feedback landed
in Postgres and the annotations stayed as JSON coordinates, drawn live in the
browser by the admin dashboard's PdfAnnotationOverlay. Every other admin screen
resolves the checked copy through student_attempt.evaluated_file_id, so those
screens showed "No evaluated copy found" on an evaluation that had in fact
completed.

This module composites the annotations onto the student's PDF and uploads the
result to media-service, returning a fileId the Java side can store on the
attempt.

Coordinates: layout_map boxes are [x, y, w, h] in PIXELS at the map's own dpi
(see render_worker/pdf_ocr/layout_ocr.py). PDF user space is points. Rather
than assuming 72/dpi, scale by the ratio of the real page rect to the layout
page's recorded width/height — that stays correct if a page was rasterized at
a different dpi than the map claims, or if pages differ in size.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

# Kept in step with callbacks.py — same gate on media-service's /internal/**.
_INTERNAL_TOKEN_HEADER = "X-Internal-Service-Token"

_HIGHLIGHT = (0.90, 0.26, 0.21)   # red, matches a teacher's pen
_NOTE_TEXT = (0.65, 0.13, 0.11)
_SUMMARY_HEADING = (0.11, 0.11, 0.11)


def _media_base_url() -> str:
    return os.getenv("MEDIA_SERVER_BASE_URL", "http://media-service:8075").rstrip("/")


def _headers() -> dict[str, str]:
    tok = os.getenv("INTERNAL_SERVICE_TOKEN", "")
    return {_INTERNAL_TOKEN_HEADER: tok} if tok else {}


def _target_index(layout_map: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """target id -> {page_id, box}. Mirrors the overlay's index so the burned-in
    copy and the on-screen overlay can never disagree about what a target means."""
    idx: dict[str, dict[str, Any]] = {}
    for page in layout_map.get("pages") or []:
        page_id = page.get("page_id")
        for key in ("lines", "regions"):
            for item in page.get(key) or []:
                item_id = item.get("line_id") or item.get("region_id")
                box = item.get("box")
                if item_id and box and len(box) == 4:
                    idx[item_id] = {"page_id": page_id, "box": box}
    return idx


def _page_dims(layout_map: dict[str, Any]) -> dict[str, tuple[float, float]]:
    dims: dict[str, tuple[float, float]] = {}
    for page in layout_map.get("pages") or []:
        pid, w, h = page.get("page_id"), page.get("width"), page.get("height")
        if pid and w and h:
            dims[pid] = (float(w), float(h))
    return dims


def _page_order(layout_map: dict[str, Any]) -> dict[str, int]:
    """page_id -> zero-based index in the PDF. Falls back to declaration order
    when page_index is absent."""
    order: dict[str, int] = {}
    for i, page in enumerate(layout_map.get("pages") or []):
        pid = page.get("page_id")
        if pid:
            idx = page.get("page_index")
            order[pid] = int(idx) if isinstance(idx, int) else i
    return order


def build_annotated_pdf(
    pdf_bytes: bytes,
    layout_map: dict[str, Any],
    verdicts: list[dict[str, Any]],
) -> bytes:
    """Draw every verdict's annotations onto the copy and append a summary page.

    Annotations whose target is missing from the layout map are skipped rather
    than guessed at — a box in the wrong place on a graded script is worse than
    no box. They still appear in the summary page, so nothing is silently lost.
    """
    import fitz  # PyMuPDF, already a dependency (see requirements.txt)

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    targets = _target_index(layout_map)
    dims = _page_dims(layout_map)
    order = _page_order(layout_map)

    drawn = 0
    for verdict in verdicts:
        q_no = verdict.get("question_number")
        for ann in verdict.get("annotations") or []:
            target = targets.get(ann.get("target"))
            if not target:
                continue
            page_id = ann.get("page_id") or target["page_id"]
            page_no = order.get(page_id)
            if page_no is None or page_no >= doc.page_count:
                continue
            layout_wh = dims.get(page_id)
            if not layout_wh:
                continue

            page = doc[page_no]
            sx = page.rect.width / layout_wh[0]
            sy = page.rect.height / layout_wh[1]
            x, y, w, h = (float(v) for v in target["box"])
            rect = fitz.Rect(x * sx, y * sy, (x + w) * sx, (y + h) * sy)

            page.draw_rect(rect, color=_HIGHLIGHT, width=1.2)

            # The note goes in whichever margin actually has room; a sticky
            # annot is always attached too, so the text is recoverable even
            # when the scan runs edge to edge.
            note = (ann.get("text") or "").strip()
            if note:
                label = f"Q{q_no}: {note}" if q_no else note
                right_margin = page.rect.width - rect.x1
                if right_margin > 90:
                    box = fitz.Rect(rect.x1 + 4, rect.y0, page.rect.width - 6, rect.y0 + 60)
                else:
                    box = fitz.Rect(rect.x0, rect.y1 + 2, page.rect.width - 6, rect.y1 + 46)
                page.insert_textbox(box, label, fontsize=6.5, color=_NOTE_TEXT, align=0)
                page.add_text_annot(fitz.Point(rect.x1 + 2, rect.y0), label)
            drawn += 1

    _append_summary(doc, verdicts)
    out = doc.tobytes(deflate=True, garbage=3)
    doc.close()
    logger.info("copy-check annotator: drew %d annotation(s) over %d page(s)", drawn, len(order))
    return out


def _append_summary(doc: Any, verdicts: list[dict[str, Any]]) -> None:
    """A plain marks + feedback page at the end.

    This is the part that is guaranteed legible: box placement depends on OCR
    quality, but the summary always carries the full verdict, so a teacher can
    always see what was awarded and why.
    """
    import fitz

    total = sum(float(v.get("marks_awarded") or 0) for v in verdicts)
    out_of = sum(float(v.get("max_marks") or 0) for v in verdicts)

    page = doc.new_page()
    y = 56.0
    page.insert_text((48, y), "Evaluation Summary", fontsize=16, color=_SUMMARY_HEADING)
    y += 22
    page.insert_text((48, y), f"Total: {round(total, 2)} / {round(out_of, 2)}",
                     fontsize=11, color=_SUMMARY_HEADING)
    y += 26

    for v in verdicts:
        if y > page.rect.height - 90:
            page = doc.new_page()
            y = 56.0
        head = (f"Q{v.get('question_number') or '?'}  "
                f"{round(float(v.get('marks_awarded') or 0), 2)} / "
                f"{round(float(v.get('max_marks') or 0), 2)}")
        if str(v.get("status") or "").upper() == "FAILED":
            head += "   (needs manual review)"
        page.insert_text((48, y), head, fontsize=10, color=_HIGHLIGHT)
        y += 14

        feedback = (v.get("feedback") or "").strip()
        if feedback:
            box = fitz.Rect(48, y, page.rect.width - 48, y + 88)
            # Negative return = text did not fit; the DB verdict remains the
            # complete record, so truncation here is cosmetic.
            page.insert_textbox(box, feedback, fontsize=8, color=_SUMMARY_HEADING)
            y += 92
        else:
            y += 6


async def _fetch_pdf(pdf_url: str) -> bytes:
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        resp = await client.get(pdf_url)
        resp.raise_for_status()
        return resp.content


async def _upload(content: bytes, filename: str) -> Optional[str]:
    """POST the PDF to media-service and return its fileId.

    upload-file-v2 (not upload-file) because only the v2 response carries the
    id — plain upload-file returns a CDN URL, and evaluated_file_id must hold
    an id the admin dashboard can pass to getPublicUrl.
    """
    url = f"{_media_base_url()}/media-service/internal/upload-file-v2"
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            url,
            files={"file": (filename, content, "application/pdf")},
            headers=_headers(),
        )
        resp.raise_for_status()
        file_id = (resp.json() or {}).get("id")
        return file_id or None


async def render_and_upload(
    pdf_url: str,
    layout_map: dict[str, Any],
    verdicts: list[dict[str, Any]],
    attempt_id: str,
) -> Optional[str]:
    """Produce the checked copy and return its media-service fileId.

    Returns None on any failure. Grading has already succeeded and been
    reported by the time this runs, so a rendering or upload problem must
    degrade to "no annotated copy" and never fail the evaluation.
    """
    try:
        pdf_bytes = await _fetch_pdf(pdf_url)
        annotated = build_annotated_pdf(pdf_bytes, layout_map, verdicts)
        file_id = await _upload(annotated, f"evaluated-copy-{attempt_id}.pdf")
        if not file_id:
            logger.warning("copy-check annotator: media-service returned no id for attempt %s", attempt_id)
            return None
        logger.info("copy-check annotator: uploaded checked copy %s for attempt %s", file_id, attempt_id)
        return file_id
    except Exception as e:
        logger.warning("copy-check annotator failed for attempt %s: %s", attempt_id, e)
        return None
