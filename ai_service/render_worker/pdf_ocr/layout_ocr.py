"""Line-level OCR for handwritten answer sheets.

Primary engine: RapidOCR, full page — its detector gives one box per
written line on handwriting, which is what the annotator needs to place a
mark. Fallback: PaddleOCR (pinned to 2.7.x in requirements.txt — the 2.8
release changed the call signature and result shape) when RapidOCR finds
fewer than MIN_PLAUSIBLE_LINES on a page; on that path RapidOCR re-reads the
lines whose PaddleOCR confidence falls below RECHECK_THRESHOLD and the higher
confidence wins. PaddleOCR was the primary until 2026-09-12: on a dense
handwritten scan it returned two page-sized blobs per page, every row merged
into them, and the checked copy had nowhere to put its marks.

NOTE: PaddleOCR ships no built-in English handwriting recognition model; we
use the default printed-text recognizer here, which still reads fairly neat
handwriting acceptably. A dedicated handwriting model can be supplied later
via `rec_model_dir=...` once we have a fine-tuned checkpoint.
"""
from __future__ import annotations

import logging
import threading
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

RECHECK_THRESHOLD = 0.75
MATH_FALLBACK_THRESHOLD = 0.60

_paddle_lock = threading.Lock()
_paddle_singleton: Any = None
_rapid_lock = threading.Lock()
_rapid_singleton: Any = None


def _get_paddle():
    """Lazy-init the PaddleOCR engine. Costly; reuse across pages."""
    global _paddle_singleton
    if _paddle_singleton is None:
        with _paddle_lock:
            if _paddle_singleton is None:
                from paddleocr import PaddleOCR

                _paddle_singleton = PaddleOCR(
                    use_angle_cls=True,
                    lang="en",
                )
    return _paddle_singleton


def _get_rapid():
    global _rapid_singleton
    if _rapid_singleton is None:
        with _rapid_lock:
            if _rapid_singleton is None:
                from rapidocr_onnxruntime import RapidOCR

                _rapid_singleton = RapidOCR()
    return _rapid_singleton


def _xywh_from_quad(pts: list[list[float]]) -> tuple[int, int, int, int]:
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    return int(x_min), int(y_min), int(x_max - x_min), int(y_max - y_min)


def _crop(img: np.ndarray, box: tuple[int, int, int, int], pad: int = 4) -> np.ndarray:
    x, y, w, h = box
    h_img, w_img = img.shape[:2]
    x0 = max(0, x - pad)
    y0 = max(0, y - pad)
    x1 = min(w_img, x + w + pad)
    y1 = min(h_img, y + h + pad)
    return img[y0:y1, x0:x1]


def _rapid_text_conf(img_crop: np.ndarray) -> tuple[str, float] | None:
    """Re-OCR a single line crop with RapidOCR. Returns the best line or None."""
    if img_crop.size == 0:
        return None
    rapid = _get_rapid()
    result, _ = rapid(img_crop)
    if not result:
        return None
    # Crop is one line — usually one result. Concatenate if multiple.
    texts: list[str] = []
    confs: list[float] = []
    for entry in result:
        try:
            _pts, text, conf = entry
        except Exception:
            continue
        if text and text.strip():
            texts.append(text.strip())
            confs.append(float(conf) if conf is not None else 0.0)
    if not texts:
        return None
    return " ".join(texts), sum(confs) / len(confs)


# No handwritten line is a quarter of the page tall. PaddleOCR's detector,
# on a dense handwritten scan, sometimes returns one quad around a whole
# block of answers; downstream that single box swallows every row it
# overlaps and the copy ends up with two "rows" per page and nowhere to put
# a mark. Such boxes carry no line information, so they are dropped.
MAX_LINE_HEIGHT_FRACTION = 0.25
# Below this many detected lines the page is treated as unread and the
# other engine is tried.
MIN_PLAUSIBLE_LINES = 3


def _sane(lines: list[dict], page_height: int) -> list[dict]:
    limit = page_height * MAX_LINE_HEIGHT_FRACTION
    kept = [ln for ln in lines if ln["box"][3] <= limit]
    if len(kept) != len(lines):
        logger.info("dropped %d page-sized OCR box(es)", len(lines) - len(kept))
    return kept


def _rapid_page_lines(img: np.ndarray, page_index: int) -> list[dict]:
    """Full-page line detection with RapidOCR.

    This is the detector behind every checked copy that was verified by eye:
    on handwriting it returns one box per written line, where PaddleOCR's
    detector returned a handful of page-sized blobs. Same output shape as the
    Paddle path so nothing downstream changes.
    """
    rapid = _get_rapid()
    result, _ = rapid(img)
    lines: list[dict] = []
    for n, item in enumerate(result or [], start=1):
        try:
            quad, text, conf = item[0], item[1], float(item[2])
        except Exception as e:  # pragma: no cover - defensive against shape drift
            logger.debug("RapidOCR line unpack failed on page %d: %s", page_index, e)
            continue
        if not text or not str(text).strip():
            continue
        box = _xywh_from_quad(quad)
        if box[2] < 3 or box[3] < 3:
            continue
        lines.append({
            "line_id": f"L{page_index + 1}_{n}",
            "text": str(text).strip(),
            "box": [box[0], box[1], box[2], box[3]],
            "conf": round(conf, 3),
            "needs_math_fallback": conf < MATH_FALLBACK_THRESHOLD,
        })
    return lines


def ocr_page(img: np.ndarray, page_index: int) -> list[dict]:
    """Detect and read the lines of one page.

    RapidOCR reads the whole page first (see _rapid_page_lines); PaddleOCR is
    the fallback when that finds fewer than MIN_PLAUSIBLE_LINES lines, with
    RapidOCR re-reading its weak lines as before.

    Returns: list of {line_id, text, box[x,y,w,h], conf, needs_math_fallback}.
    """
    page_height = int(img.shape[0])
    try:
        rapid_lines = _sane(_rapid_page_lines(img, page_index), page_height)
    except Exception:
        logger.exception("RapidOCR full-page pass failed on page %d; using PaddleOCR", page_index)
        rapid_lines = []
    if len(rapid_lines) >= MIN_PLAUSIBLE_LINES:
        logger.info("page %d: %d lines (rapidocr)", page_index, len(rapid_lines))
        return rapid_lines

    paddle_lines = _sane(_paddle_page_lines(img, page_index), page_height)
    logger.info("page %d: %d lines (paddleocr fallback; rapidocr found %d)",
                page_index, len(paddle_lines), len(rapid_lines))
    return paddle_lines if len(paddle_lines) >= len(rapid_lines) else rapid_lines


def _paddle_page_lines(img: np.ndarray, page_index: int) -> list[dict]:
    """Run PaddleOCR on a full page, then RapidOCR second-pass on weak lines."""
    paddle = _get_paddle()
    raw = paddle.ocr(img, cls=True)
    # 2.7 returns [[ [quad, (text, conf)], ... ]] — one outer list per image.
    # If we get an empty page result silently, log it so a version skew
    # doesn't silently zero-score every question of every copy.
    page_result = raw[0] if raw and isinstance(raw, list) else None
    if page_result is None:
        logger.warning(
            "PaddleOCR returned an unexpected shape on page %d (raw type=%s); "
            "no lines extracted. Check the installed paddleocr version.",
            page_index, type(raw).__name__,
        )
        page_result = []

    lines: list[dict] = []
    line_counter = 0
    for entry in page_result:
        try:
            quad, (text, conf) = entry
        except Exception as e:
            logger.debug("PaddleOCR line unpack failed on page %d: %s", page_index, e)
            continue
        if not text or not text.strip():
            continue
        box = _xywh_from_quad(quad)
        primary_text = text.strip()
        primary_conf = float(conf) if conf is not None else 0.0

        if primary_conf < RECHECK_THRESHOLD:
            second = _rapid_text_conf(_crop(img, box))
            if second is not None and second[1] > primary_conf:
                primary_text, primary_conf = second

        line_counter += 1
        lines.append({
            "line_id": f"L{page_index + 1}_{line_counter}",
            "text": primary_text,
            "box": [box[0], box[1], box[2], box[3]],
            "conf": round(primary_conf, 3),
            "needs_math_fallback": primary_conf < MATH_FALLBACK_THRESHOLD,
        })
    return lines
