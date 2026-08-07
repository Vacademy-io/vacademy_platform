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

# A checked script has to read at a glance, so the mark must carry the verdict:
# green tick = credited, red cross = wrong, amber ring = partial/attention.
# Drawing one neutral box for every style would make "correct" and "wrong"
# indistinguishable, which is worse than not marking at all.
_CORRECT = (0.13, 0.55, 0.24)
_WRONG = (0.80, 0.13, 0.13)
_ATTENTION = (0.85, 0.45, 0.05)
_HIGHLIGHT = (0.90, 0.26, 0.21)
_NOTE_TEXT = (0.65, 0.13, 0.11)
_SUMMARY_HEADING = (0.11, 0.11, 0.11)

# Width of the right-hand column reserved for circled per-question marks.
# Margin notes stop short of it so a comment never runs under a score.
_SCORE_GUTTER = 52.0

# Pen notes are set in italic so they read as the marker's hand, distinct from
# both the student's writing and any printed text on the sheet.
_NOTE_FONT = "tiit"  # Times-Italic (PyMuPDF base-14 alias)
_NOTE_FONTSIZE = 8.5

_STYLE_COLOR = {
    "tick": _CORRECT,
    "cross": _WRONG,
    "circle": _ATTENTION,
    "strike": _WRONG,
    "strikethrough": _WRONG,
    "underline": _WRONG,
    "margin_note": _HIGHLIGHT,
    "region_note": _HIGHLIGHT,
}


def _media_base_url() -> str:
    return os.getenv("MEDIA_SERVER_BASE_URL", "http://media-service:8075").rstrip("/")


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
            # A negative index would silently resolve via Python's doc[-1] to
            # the LAST page and burn marks onto the wrong sheet — treat it as
            # absent and fall back to declaration order.
            order[pid] = int(idx) if isinstance(idx, int) and idx >= 0 else i
    return order


def _draw_mark(page: Any, rect: Any, style: str) -> None:
    """Draw the teacher's mark for one annotation.

    Ticks and crosses go in the gutter beside the line rather than over it —
    handwriting is already hard enough to read without a glyph on top of it.
    Circles ring the text itself, which is the point of a circle.
    """
    import fitz

    colour = _STYLE_COLOR.get(style, _HIGHLIGHT)

    if style == "circle":
        page.draw_oval(rect + (-3, -2, 3, 2), color=colour, width=1.3)
        return

    if style in ("strike", "strikethrough"):
        mid = rect.y0 + rect.height / 2.0
        page.draw_line(fitz.Point(rect.x0, mid), fitz.Point(rect.x1, mid), color=colour, width=1.4)
        return

    if style == "underline":
        page.draw_line(fitz.Point(rect.x0, rect.y1 + 1), fitz.Point(rect.x1, rect.y1 + 1),
                       color=colour, width=1.4)
        return

    if style in ("tick", "cross"):
        size = max(7.0, min(13.0, rect.height * 0.9))
        # Prefer the left gutter, the way a script is normally marked; fall
        # back to the right when the writing starts at the page edge.
        if rect.x0 > size + 6:
            cx = rect.x0 - size - 3
        else:
            cx = min(rect.x1 + 3, page.rect.width - size - 3)
        cy = rect.y0 + (rect.height - size) / 2.0

        if style == "tick":
            page.draw_line(fitz.Point(cx, cy + size * 0.55),
                           fitz.Point(cx + size * 0.35, cy + size), color=colour, width=1.6)
            page.draw_line(fitz.Point(cx + size * 0.35, cy + size),
                           fitz.Point(cx + size, cy), color=colour, width=1.6)
            # Underline the credited statement as well as ticking it — the way a
            # teacher marks a script, and it shows WHAT earned the tick rather
            # than just that something on the line did.
            page.draw_line(fitz.Point(rect.x0, rect.y1 + 1), fitz.Point(rect.x1, rect.y1 + 1),
                           color=colour, width=1.0)
        else:
            page.draw_line(fitz.Point(cx, cy), fitz.Point(cx + size, cy + size),
                           color=colour, width=1.6)
            page.draw_line(fitz.Point(cx + size, cy), fitz.Point(cx, cy + size),
                           color=colour, width=1.6)
        return

    # margin_note / region_note / anything unrecognised: underline the span so
    # the note in the margin has something to point at.
    page.draw_line(fitz.Point(rect.x0, rect.y1 + 1), fitz.Point(rect.x1, rect.y1 + 1),
                   color=colour, width=1.0)


def _place_note(page: Any, rect: Any, style: str, note: str) -> None:
    """Write the pen note where a teacher would put it.

    Matches how a marked script reads: the correction for a struck statement is
    written over the struck words; otherwise the note continues on the same
    line when the margin has room ('Cite Section 21 explicitly'), else sits in
    the interline gap just above the span ('Mention buyer's right to refund'),
    else wraps below. A sticky annot is the last resort only — an icon on the
    page hides the work under it.
    """
    import fitz

    note_right = page.rect.width - _SCORE_GUTTER
    size = _NOTE_FONTSIZE
    width = fitz.get_text_length(note, fontname=_NOTE_FONT, fontsize=size)

    def write(x: float, baseline: float) -> None:
        page.insert_text(fitz.Point(x, baseline), note, fontsize=size,
                         fontname=_NOTE_FONT, color=_NOTE_TEXT)

    # A span that starts inside (or behind) the score gutter leaves no room for
    # prose at all — every rect below would be empty, and insert_textbox RAISES
    # on an empty rect rather than returning the negative fit code, which would
    # take down the whole render for one edge-hugging note.
    if note_right - rect.x0 < 30:
        page.add_text_annot(fitz.Point(min(rect.x1 + 2, note_right), rect.y0), note)
        return

    # The correction floats just above the struck words, centred over them —
    # on the words themselves it would collide with the writing it replaces.
    if style in ("strike", "strikethrough") and width <= note_right - rect.x0:
        x = rect.x0 + max(0.0, (min(rect.width, note_right - rect.x0) - width) / 2.0)
        baseline = rect.y0 - 2 if rect.y0 - size > 6 else rect.y0 + size
        write(x, baseline)
        return

    # Same line, continuing after the student's text.
    if rect.x1 + 6 + width <= note_right:
        write(rect.x1 + 6, rect.y1 - rect.height * 0.25)
        return

    # The interline gap directly above the span.
    if width <= note_right - rect.x0 and rect.y0 - size > 6:
        write(rect.x0 + 2, rect.y0 - 3)
        return

    # Wrapped below the span (two lines of headroom — insert_textbox rejects a
    # box without line-height slack and silently writes nothing).
    box = fitz.Rect(rect.x0, rect.y1 + 2, note_right, rect.y1 + 4 + size * 2.9)
    if page.insert_textbox(box, note, fontsize=size, fontname=_NOTE_FONT,
                           color=_NOTE_TEXT, align=0) >= 0:
        return

    page.add_text_annot(fitz.Point(min(rect.x1 + 2, note_right), rect.y0), note)


def _fmt_marks(value: float) -> str:
    """4.5 not 4.50, 6 not 6.0 — a marked script is written the short way."""
    return f"{value:g}"


def _draw_score_badge(page: Any, centre: Any, awarded: float, out_of: Optional[float] = None,
                      radius: float = 15.0) -> None:
    """A circled mark, the way it is written on a real script.

    out_of given -> the "34/60" total; omitted -> a bare per-question "4.5".
    """
    import fitz

    # insert_text, not insert_textbox: a box only as tall as the glyphs is
    # rejected for want of line-height headroom and silently writes nothing,
    # which leaves an empty circle where the mark should be.
    def centred(text: str, baseline_y: float, size: float) -> None:
        width = fitz.get_text_length(text, fontname="helv", fontsize=size)
        page.insert_text(fitz.Point(centre.x - width / 2.0, baseline_y),
                         text, fontsize=size, color=_WRONG)

    page.draw_circle(centre, radius, color=_WRONG, width=1.4)
    awarded_text = _fmt_marks(awarded)

    if out_of is None:
        centred(awarded_text, centre.y + radius * 0.32, radius * 0.78)
        return

    # Stacked "34 / 60" with a rule between, as it is written on a script.
    centred(awarded_text, centre.y - radius * 0.12, radius * 0.62)
    page.draw_line(fitz.Point(centre.x - radius * 0.55, centre.y + radius * 0.08),
                   fitz.Point(centre.x + radius * 0.55, centre.y + radius * 0.08),
                   color=_WRONG, width=1.0)
    centred(_fmt_marks(out_of), centre.y + radius * 0.72, radius * 0.5)


def _place_question_scores(doc: Any, placements: dict[int, tuple[int, float]],
                           verdicts: list[dict[str, Any]]) -> None:
    """Circle each question's mark in the right margin beside its answer.

    placements maps question_number -> (page_no, y). Built from where that
    question's annotations actually landed, so the mark sits next to the work
    it refers to. A question we could not locate on the page is left to the
    summary rather than being circled in an arbitrary spot.
    """
    import fitz

    by_number = {v.get("question_number"): v for v in verdicts}
    for q_no, (page_no, y) in placements.items():
        verdict = by_number.get(q_no)
        if verdict is None or page_no < 0 or page_no >= doc.page_count:
            continue
        page = doc[page_no]
        cx = page.rect.width - _SCORE_GUTTER / 2.0
        cy = min(max(y, 30.0), page.rect.height - 30)
        _draw_score_badge(page, fitz.Point(cx, cy), float(verdict.get("marks_awarded") or 0))


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
    # question_number -> (page_no, y) of its lowest annotation, so the circled
    # mark lands beside the end of that answer.
    placements: dict[int, tuple[int, float]] = {}
    for verdict in verdicts:
        q_no = verdict.get("question_number")
        for ann in verdict.get("annotations") or []:
            target = targets.get(ann.get("target"))
            if not target:
                continue
            page_id = ann.get("page_id") or target["page_id"]
            page_no = order.get(page_id)
            if page_no is None or page_no < 0 or page_no >= doc.page_count:
                continue
            layout_wh = dims.get(page_id)
            if not layout_wh:
                continue

            page = doc[page_no]
            sx = page.rect.width / layout_wh[0]
            sy = page.rect.height / layout_wh[1]
            x, y, w, h = (float(v) for v in target["box"])
            rect = fitz.Rect(x * sx, y * sy, (x + w) * sx, (y + h) * sy)

            style = (ann.get("style") or "margin_note").strip().lower()
            _draw_mark(page, rect, style)

            # Ticks usually carry text=None — the mark alone is the message.
            # No "Q1:" prefix: the circled mark beside the answer already names
            # the question, and a real pen note carries none.
            note = (ann.get("text") or "").strip()
            if note:
                _place_note(page, rect, style, note)
            drawn += 1

            if q_no is not None:
                prev = placements.get(q_no)
                if prev is None or (page_no, rect.y1) > prev:
                    placements[q_no] = (page_no, rect.y1)

    _place_question_scores(doc, placements, verdicts)

    # The total, circled top-right of page one — the first thing anyone looks
    # for on a returned script.
    if doc.page_count:
        import fitz
        total = sum(float(v.get("marks_awarded") or 0) for v in verdicts)
        out_of = sum(float(v.get("max_marks") or 0) for v in verdicts)
        first = doc[0]
        _draw_score_badge(first, fitz.Point(first.rect.width - 46, 52), total, out_of, radius=22.0)

    _append_summary(doc, verdicts)
    out = doc.tobytes(deflate=True, garbage=3)
    doc.close()
    logger.info(
        "copy-check annotator: drew %d annotation(s) over %d page(s), %d question score(s) placed",
        drawn, len(order), len(placements),
    )
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

    Auth: media_service gates every URI containing "internal" with the shared
    InternalAuthFilter, which reads clientName + Signature — NOT the
    X-Internal-Service-Token that assessment_service's callback endpoints use.
    Sending the wrong header 401s every upload and the feature silently renders
    for nothing, so this reuses internal_auth_headers() exactly like
    media_file_client does for the sibling /internal/get-url/id call.
    """
    # Lazy import, same as fitz: keeps the pure rendering functions loadable
    # standalone (tests) without dragging in the DB-backed auth stack.
    from ..internal_auth import internal_auth_headers

    url = f"{_media_base_url()}/media-service/internal/upload-file-v2"
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            url,
            files={"file": (filename, content, "application/pdf")},
            headers=await internal_auth_headers(),
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
