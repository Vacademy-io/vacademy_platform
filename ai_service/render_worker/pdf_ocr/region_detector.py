"""Detect non-text regions (diagrams, number lines) the LLM should annotate
at region-level rather than line-level. Heuristic: large connected components
where the candidate area is mostly NOT covered by any OCR line box.
"""
from __future__ import annotations

import cv2
import numpy as np

MIN_REGION_AREA_FRAC = 0.01
MAX_TEXT_COVERAGE = 0.50  # drop the candidate if >50% of its area is text


def _coverage_fraction(
    candidate: tuple[int, int, int, int],
    line_boxes: list[tuple[int, int, int, int]],
) -> float:
    """Fraction of `candidate`'s area covered by the UNION of line_boxes.

    Computed via a tiny boolean mask sized to the candidate's bbox so adjacent/
    overlapping lines don't double-count (which the previous sum-of-IoUs did).
    """
    _x, _y, w, h = candidate
    if w <= 0 or h <= 0:
        return 0.0
    mask = np.zeros((h, w), dtype=np.uint8)
    cx, cy = _x, _y
    for lb in line_boxes:
        lx, ly, lw, lh = lb
        x1 = max(0, lx - cx)
        y1 = max(0, ly - cy)
        x2 = min(w, lx + lw - cx)
        y2 = min(h, ly + lh - cy)
        if x2 > x1 and y2 > y1:
            mask[y1:y2, x1:x2] = 1
    return float(mask.sum()) / float(w * h)


def detect_regions(img: np.ndarray, page_index: int, lines: list[dict]) -> list[dict]:
    h, w = img.shape[:2]
    page_area = h * w
    min_area = int(page_area * MIN_REGION_AREA_FRAC)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    # Connect strokes of diagrams (axes, ticks, labels) into one region.
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    n_labels, _, stats, _ = cv2.connectedComponentsWithStats(closed, connectivity=8)
    line_boxes: list[tuple[int, int, int, int]] = [
        (int(b[0]), int(b[1]), int(b[2]), int(b[3])) for b in (ln["box"] for ln in lines)
    ]

    regions: list[dict] = []
    region_counter = 0
    for i in range(1, n_labels):
        x, y, ww, hh, area = stats[i]
        if area < min_area:
            continue
        # Skip components that span almost the whole page (likely page border noise).
        if ww * hh > 0.6 * page_area:
            continue
        candidate = (int(x), int(y), int(ww), int(hh))
        # Drop candidates whose area is mostly already covered by line boxes —
        # those are dense paragraphs masquerading as a single component, not
        # actual diagrams.
        if _coverage_fraction(candidate, line_boxes) > MAX_TEXT_COVERAGE:
            continue
        region_counter += 1
        regions.append({
            "region_id": f"R{page_index + 1}_{region_counter}",
            "type": "diagram",
            "box": list(candidate),
        })
    return regions
