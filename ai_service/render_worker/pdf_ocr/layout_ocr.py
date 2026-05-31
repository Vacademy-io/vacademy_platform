"""Line-level OCR for handwritten answer sheets.

Primary engine: PaddleOCR (pinned to 2.7.x in requirements.txt — the 2.8
release changed the call signature and result shape). Secondary: RapidOCR
(already in render_worker for image indexing) re-runs on lines whose
PaddleOCR confidence falls below RECHECK_THRESHOLD — whichever engine reports
higher confidence wins for that line.

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


def ocr_page(img: np.ndarray, page_index: int) -> list[dict]:
    """Run PaddleOCR on a full page, then RapidOCR second-pass on weak lines.

    Returns: list of {line_id, text, box[x,y,w,h], conf, needs_math_fallback}.
    """
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
