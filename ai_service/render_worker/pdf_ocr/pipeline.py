"""Orchestrate the PDF → LayoutMap pipeline.

Stages (all sync — runs in a thread pool via asyncio.run_in_executor):
  1. Download PDF to a temp file
  2. PyMuPDF → page images @ DEFAULT_DPI
  3. deskew + denoise + CLAHE
  4. PaddleOCR per page (RapidOCR second-pass on weak lines)
  5. Region detection (diagrams)
  6. Assemble LayoutMap JSON

Progress reporting: on_progress(0..100) is invoked after each page so the
caller can debounce-push to its callback URL.
"""
from __future__ import annotations

import logging
import tempfile
import time
from pathlib import Path
from typing import Callable, Optional

import httpx

from .layout_ocr import ocr_page
from .preprocess import DEFAULT_DPI, pdf_to_pages, preprocess_page
from .region_detector import detect_regions

logger = logging.getLogger(__name__)


def _download(pdf_url: str, dest: Path) -> None:
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        with client.stream("GET", pdf_url) as resp:
            resp.raise_for_status()
            with dest.open("wb") as f:
                for chunk in resp.iter_bytes(chunk_size=1 << 16):
                    f.write(chunk)


def run_pdf_ocr_pipeline(
    pdf_url: str,
    on_progress: Optional[Callable[[float], None]] = None,
    dpi: int = DEFAULT_DPI,
) -> dict:
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="pdf-ocr-") as tmp:
        tmp_path = Path(tmp)
        pdf_path = tmp_path / "input.pdf"
        _download(pdf_url, pdf_path)

        page_imgs = list(pdf_to_pages(pdf_path, dpi=dpi))
        total = len(page_imgs)
        if total == 0:
            return {
                "pdf_url": pdf_url,
                "ocr_engine": "paddleocr-handwriting",
                "dpi": dpi,
                "duration_ms": int((time.monotonic() - started) * 1000),
                "pages": [],
            }

        pages_out: list[dict] = []
        for idx, raw in page_imgs:
            preprocessed = preprocess_page(raw)
            lines = ocr_page(preprocessed, idx)
            regions = detect_regions(preprocessed, idx, lines)
            h, w = preprocessed.shape[:2]
            pages_out.append({
                "page_id": f"p{idx + 1}",
                "page_index": idx,
                "width": w,
                "height": h,
                "dpi": dpi,
                "lines": lines,
                "regions": regions,
            })
            if on_progress is not None:
                on_progress(round(100.0 * (idx + 1) / total, 1))

    return {
        "pdf_url": pdf_url,
        "ocr_engine": "paddleocr-handwriting",
        "dpi": dpi,
        "duration_ms": int((time.monotonic() - started) * 1000),
        "pages": pages_out,
    }
