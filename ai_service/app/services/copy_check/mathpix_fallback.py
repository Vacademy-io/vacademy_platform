"""Selective Mathpix fallback: re-OCR low-confidence math lines via cropped
images, then re-grade just those questions if their answer hinges on a
mathematically-precise line.

Hard cap: MAX_CROPS_PER_COPY — keeps Mathpix spend bounded per copy.
"""
from __future__ import annotations

import asyncio
import base64
import io
import logging
import tempfile
from pathlib import Path
from typing import Any

from ..mathpix_service import MathpixService
from .page_images import download_pdf, rasterize_pages

logger = logging.getLogger(__name__)

MAX_CROPS_PER_COPY = 4


class MathpixFallback:
    def __init__(self):
        self.mathpix = MathpixService()
        self._used = 0

    @property
    def used(self) -> int:
        return self._used

    @property
    def can_run(self) -> bool:
        return self._used < MAX_CROPS_PER_COPY

    async def enrich_layout_for_math(self, pdf_url: str, layout_map: dict[str, Any]) -> dict[str, Any]:
        """Find lines flagged needs_math_fallback, re-OCR via Mathpix, replace
        their text with the LaTeX-bearing version. Mutates `layout_map` in place
        and returns it. Capped at MAX_CROPS_PER_COPY total calls per copy."""
        flagged: list[tuple[dict[str, Any], dict[str, Any]]] = []
        for page in layout_map.get("pages", []):
            for line in page.get("lines", []):
                if line.get("needs_math_fallback"):
                    flagged.append((page, line))
        if not flagged:
            return layout_map
        flagged.sort(key=lambda pl: pl[1].get("conf", 0))  # weakest first

        with tempfile.TemporaryDirectory(prefix="mathpix-crops-") as tmp:
            pdf_path = Path(tmp) / "input.pdf"
            await download_pdf(pdf_url, pdf_path)
            # 200 DPI matches the layout_map's box coordinates (full_res px), so
            # crops line up. rasterize_pages returns [(page_id, img)]; keyed by
            # page_id here for the crop lookup below.
            page_imgs = dict(await asyncio.get_event_loop().run_in_executor(
                None, rasterize_pages, pdf_path,
            ))
            for page, line in flagged:
                if not self.can_run:
                    logger.info("Mathpix budget exhausted (%d crops), skipping rest", self._used)
                    break
                page_img = page_imgs.get(page["page_id"])
                if page_img is None:
                    continue
                crop_b64 = _crop_to_base64(page_img, line["box"])
                self._used += 1
                try:
                    result = await self.mathpix.ocr_image_base64(crop_b64, mime_type="image/png")
                    text = result.get("latex") or result.get("text") or ""
                    if text.strip():
                        line["text"] = text.strip()
                        line["conf"] = max(line.get("conf", 0), 0.95)
                        line["needs_math_fallback"] = False
                except Exception as e:
                    logger.warning(f"Mathpix crop OCR failed for {line.get('line_id')}: {e}")
        return layout_map


def _crop_to_base64(img, box: list[int]) -> str:
    from PIL import Image  # noqa: F401  — typed via duck typing

    x, y, w, h = box
    pad = 6
    left = max(0, x - pad)
    top = max(0, y - pad)
    right = min(img.width, x + w + pad)
    bottom = min(img.height, y + h + pad)
    crop = img.crop((left, top, right, bottom))
    buf = io.BytesIO()
    crop.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")
