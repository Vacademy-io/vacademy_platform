"""Rasterize a copy's PDF pages to base64 image data URLs for VISION grading,
and pick which page(s) to send per question.

Shares the PyMuPDF rasterization core with mathpix_fallback (both turn the
student's PDF into per-page raster images); factored here so the vision grader
and the selective math fallback don't each reimplement fitz page rendering.

fitz/PIL are imported lazily inside the worker functions so this module — and
anything importing it — stays loadable on hosts where PyMuPDF isn't installed,
matching mathpix_fallback's pattern.
"""
from __future__ import annotations

import asyncio
import base64
import io
import logging
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class PageImage:
    """One rendered PDF page, ready to attach to a multimodal LLM message."""

    page_id: str        # render_worker's 1-based id, e.g. "p1"
    page_index: int     # 0-based order in the PDF
    data_url: str       # "data:image/jpeg;base64,..."


# --------------------------- Rendering (shared) ------------------------------

async def download_pdf(url: str, dest: Path) -> None:
    """Stream a PDF to disk. Shared by mathpix_fallback and vision rendering."""
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        async with client.stream("GET", url) as resp:
            resp.raise_for_status()
            with dest.open("wb") as f:
                async for chunk in resp.aiter_bytes(chunk_size=1 << 16):
                    f.write(chunk)


def rasterize_pages(pdf_path: Path, dpi: int = 200) -> list[tuple[str, Any]]:
    """Return ordered [(page_id, PIL.Image)] for every page at the given DPI.

    page_id is render_worker's 1-based "p{i+1}" so callers can key by it. Handles
    all PyMuPDF colorspaces (gray/RGB/CMYK) since PDFs in the wild aren't always
    sRGB — a naive Image.frombytes("RGB", ...) corrupts the buffer for pix.n != 3.
    """
    import fitz  # PyMuPDF (lazy: keeps this module importable without it)
    from PIL import Image

    out: list[tuple[str, Any]] = []
    doc = fitz.open(pdf_path)
    try:
        matrix = fitz.Matrix(dpi / 72.0, dpi / 72.0)
        for i, page in enumerate(doc):
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            mode_map = {1: "L", 3: "RGB", 4: "CMYK"}
            mode = mode_map.get(pix.n)
            if mode is None:
                # Drop alpha or unknown channels via an intermediate RGB pixmap.
                pix_rgb = fitz.Pixmap(fitz.csRGB, pix)
                img = Image.frombytes("RGB", (pix_rgb.width, pix_rgb.height), pix_rgb.samples)
            else:
                img = Image.frombytes(mode, (pix.width, pix.height), pix.samples)
                if mode != "RGB":
                    img = img.convert("RGB")
            out.append((f"p{i + 1}", img))
    finally:
        doc.close()
    return out


def image_to_data_url(img: Any, max_px: int = 2000, jpeg_quality: int = 80) -> str:
    """Downscale so the longest side <= max_px, then JPEG-encode as a data URL.

    JPEG (not PNG) keeps a multi-page handwritten payload small enough to send
    several pages in one request without blowing the token/size budget. The
    "data:image/jpeg;base64,..." shape is what OpenRouter / the multimodal
    client expects for an inline image.
    """
    from PIL import Image

    w, h = img.width, img.height
    longest = max(w, h)
    if longest > max_px:
        scale = max_px / float(longest)
        img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    if img.mode != "RGB":
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=jpeg_quality, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _render_sync(
    pdf_path: Path, dpi: int, max_px: int, jpeg_quality: int, max_pages: int,
) -> list[PageImage]:
    pages = rasterize_pages(pdf_path, dpi=dpi)
    if len(pages) > max_pages:
        logger.warning(
            "copy-check vision: PDF has %d pages > cap %d; encoding only the first %d",
            len(pages), max_pages, max_pages,
        )
        pages = pages[:max_pages]
    return [
        PageImage(
            page_id=pid,
            page_index=i,
            data_url=image_to_data_url(img, max_px=max_px, jpeg_quality=jpeg_quality),
        )
        for i, (pid, img) in enumerate(pages)
    ]


async def render_page_images(
    pdf_url: str,
    dpi: int = 150,
    max_px: int = 2000,
    jpeg_quality: int = 80,
    max_pages: int = 50,
) -> list[PageImage]:
    """Download `pdf_url` and rasterize every page to a JPEG data URL, once.

    Runs the CPU-bound rasterize+encode in a thread (like mathpix_fallback) so
    the event loop isn't blocked. `max_pages` caps pathological PDFs so a runaway
    document can't exhaust memory or the image budget.
    """
    with tempfile.TemporaryDirectory(prefix="vision-pages-") as tmp:
        pdf_path = Path(tmp) / "input.pdf"
        await download_pdf(pdf_url, pdf_path)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, _render_sync, pdf_path, dpi, max_px, jpeg_quality, max_pages,
        )


# --------------------------- Per-question page mapping -----------------------

# Reading-order tokens that commonly precede an answer's question number on a
# handwritten copy: "Q1", "Ans 1.", "Answer 1)", "(1)", "1.", "1-".
_ANSWER_MARKER_PREFIX = r"(?:q(?:ues(?:tion)?)?\.?\s*|ans(?:wer)?\.?\s*)?"


def _answer_marker_regex(number: int) -> "re.Pattern[str]":
    n = re.escape(str(int(number)))
    # Number (optionally zero-padded / bracketed) followed by a delimiter,
    # anchored to the start of a line so a stray "1" mid-sentence never matches.
    return re.compile(
        rf"^\s*{_ANSWER_MARKER_PREFIX}[\(\[]?0*{n}[\)\].:\-]",
        re.IGNORECASE,
    )


def ordered_page_ids(layout_map: dict[str, Any]) -> list[str]:
    """page_ids in PDF order (page_index when present, else declaration order),
    mirroring annotator._page_order so image selection and annotation agree."""
    pages = list(enumerate(layout_map.get("pages") or []))

    def sort_key(item: tuple[int, dict[str, Any]]) -> int:
        i, page = item
        idx = page.get("page_index")
        return int(idx) if isinstance(idx, int) and idx >= 0 else i

    return [p.get("page_id") for _, p in sorted(pages, key=sort_key) if p.get("page_id")]


def _anchor_page_pos(
    layout_map: dict[str, Any], page_ids: list[str], number: int,
) -> Optional[int]:
    """Position (index into `page_ids`) of the first line that reads like the
    answer marker for `number`, else None."""
    rx = _answer_marker_regex(number)
    pos_by_id = {pid: i for i, pid in enumerate(page_ids)}
    best: Optional[int] = None
    for page in layout_map.get("pages") or []:
        pos = pos_by_id.get(page.get("page_id"))
        if pos is None:
            continue
        for line in page.get("lines") or []:
            if rx.match((line.get("text") or "").strip()):
                if best is None or pos < best:
                    best = pos
                break
    return best


def select_pages_for_question(
    question_number: Optional[int],
    layout_map: dict[str, Any],
    page_ids: list[str],
    max_pages: int,
) -> tuple[list[str], str]:
    """Pick the page_id(s) whose images to send for this question.

    Returns (selected_page_ids, reason). Strategy:
      1. If the whole copy fits the per-question budget, send all pages — no
         segmentation risk and the model sees the complete answer.
      2. Otherwise localize the answer via its question-number marker in the OCR
         and send that page through the page before the next question's marker,
         capped to `max_pages`.
      3. If it can't be localized on a large copy, send the first `max_pages`
         pages as a bounded fallback (uncertain — the low-confidence verdict
         then escalates, and the OCR transcript still covers the rest).
    """
    n = len(page_ids)
    if n == 0:
        return [], "no_pages"
    if n <= max_pages:
        return list(page_ids), "all_pages_within_budget"

    if question_number is not None:
        start = _anchor_page_pos(layout_map, page_ids, question_number)
        if start is not None:
            end = _anchor_page_pos(layout_map, page_ids, question_number + 1)
            stop = end if (end is not None and end > start) else n
            window = page_ids[start:stop] or page_ids[start:start + 1]
            return window[:max_pages], "anchored"

    return list(page_ids[:max_pages]), "uncertain_bounded"
