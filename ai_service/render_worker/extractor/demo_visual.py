"""
Stage 3B: Demo/screencast mode visual extraction.

All 5 demo features:
1. OCR — on-screen text extraction (RapidOCR)
2. Change regions — click/type event detection (cv2.absdiff)
3. Cursor tracking — template match against cursor sprites
4. PiP detection — webcam bubble detection + matting
5. Dynamic crop planner — smoothed crop path through active regions
6. UI cutouts — short clips of key UI elements
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

import cv2
import numpy as np

from .encode import encode_alpha_webm
from .matting.base import Matter
from .schemas import (
    DynamicCrop,
    HighlightWindow,
    KeyOnscreenEvent,
    PipRegion,
    SceneBoundary,
    UiCutout,
)

logger = logging.getLogger(__name__)

SCREEN_SAMPLE_FPS = 2.0
PIP_SAMPLE_FPS = 6.0


@dataclass
class DemoVisualResult:
    ocr_events: list[dict] = field(default_factory=list)
    cursor_track: list[dict] = field(default_factory=list)
    change_events: list[dict] = field(default_factory=list)
    key_events: list[KeyOnscreenEvent] = field(default_factory=list)
    pip_region: Optional[PipRegion] = None
    pip_fg_path: Optional[Path] = None
    dynamic_crops: list[DynamicCrop] = field(default_factory=list)
    ui_cutouts: list[UiCutout] = field(default_factory=list)
    ui_cutout_paths: list[Path] = field(default_factory=list)
    ui_elements_seen: list[str] = field(default_factory=list)


def extract_demo_visuals(
    video_path: Path,
    highlight: HighlightWindow,
    scene_boundaries: list[SceneBoundary],
    output_dir: Path,
    matter: Matter,
    on_progress: Optional[Callable[[float], None]] = None,
) -> DemoVisualResult:
    """Extract all demo-mode features for the highlight window."""
    t_start = highlight.t_start
    t_end = highlight.t_end
    result = DemoVisualResult()

    # Sample frames at screen fps
    logger.info(f"Extracting demo frames: {t_start:.1f}-{t_end:.1f}s @ {SCREEN_SAMPLE_FPS}fps")
    frames_with_idx = _extract_indexed_frames(video_path, t_start, t_end, SCREEN_SAMPLE_FPS)
    if not frames_with_idx:
        return result

    h, w = frames_with_idx[0][1].shape[:2]
    if on_progress:
        on_progress(45)

    # 1. OCR
    logger.info("Running OCR...")
    result.ocr_events = _run_ocr(frames_with_idx, w, h)
    result.ui_elements_seen = _summarize_ui_elements(result.ocr_events)
    if on_progress:
        on_progress(52)

    # 2. Change detection
    logger.info("Detecting change regions...")
    result.change_events = _detect_change_regions(frames_with_idx)
    if on_progress:
        on_progress(58)

    # 3. Cursor tracking
    logger.info("Tracking cursor...")
    cursor_sprites = _load_cursor_sprites()
    result.cursor_track = _track_cursor(frames_with_idx, cursor_sprites)
    if on_progress:
        on_progress(63)

    # 4. Key on-screen events (synthesized from changes + OCR)
    result.key_events = _synthesize_key_events(result.change_events, result.ocr_events, t_start)

    # 5. PiP detection
    logger.info("Detecting PiP...")
    result.pip_region = _detect_pip(video_path, scene_boundaries, highlight)
    if on_progress:
        on_progress(68)

    # 5b. PiP matting (if detected)
    if result.pip_region and result.pip_region.present and result.pip_region.roi_norm:
        logger.info("Matting PiP region...")
        pip_frames = _extract_pip_frames(video_path, t_start, t_end, result.pip_region.roi_norm, w, h)
        if pip_frames:
            # Store as uint8 to save memory
            alpha_mattes: list[np.ndarray] = [
                (np.clip(a, 0.0, 1.0) * 255).astype(np.uint8)
                for a in matter.process(iter(pip_frames))
            ]
            del pip_frames  # free before encoding
            pip_fg_path = output_dir / "assets" / "pip_fg.webm"
            roi = result.pip_region.roi_norm
            crop_bbox = (
                int(roi[0] * w), int(roi[1] * h),
                int(roi[2] * w), int(roi[3] * h),
            )
            encode_alpha_webm(
                video_path=video_path,
                alpha_mattes_sampled=alpha_mattes,
                output_path=pip_fg_path,
                t_start=t_start, t_end=t_end,
                sample_fps=PIP_SAMPLE_FPS, target_fps=30,
                crop_bbox=crop_bbox,
            )
            if pip_fg_path.exists():
                result.pip_fg_path = pip_fg_path
                result.pip_region.pip_fg_asset = "assets/pip_fg.webm"
    if on_progress:
        on_progress(75)

    # 6. Dynamic crop planner
    logger.info("Planning dynamic crops...")
    result.dynamic_crops = _plan_dynamic_crops(
        result.cursor_track, result.change_events, result.ocr_events,
        w, h, t_start,
    )
    if on_progress:
        on_progress(80)

    # 7. UI cutouts
    logger.info("Extracting UI cutouts...")
    cutouts, cutout_paths = _extract_ui_cutouts(
        video_path, result.change_events, output_dir, w, h, t_start,
    )
    result.ui_cutouts = cutouts
    result.ui_cutout_paths = cutout_paths
    if on_progress:
        on_progress(85)

    return result


# ---------------------------------------------------------------------------
# Frame extraction
# ---------------------------------------------------------------------------

def _extract_indexed_frames(
    video_path: Path, t_start: float, t_end: float, fps: float,
) -> list[tuple[int, np.ndarray]]:
    """Extract frames with frame index. Returns [(frame_num, frame), ...]."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []
    cap.set(cv2.CAP_PROP_POS_MSEC, t_start * 1000)
    frames: list[tuple[int, np.ndarray]] = []
    interval = 1.0 / fps
    next_t = t_start
    idx = 0
    while next_t < t_end:
        ret, frame = cap.read()
        if not ret:
            break
        cur_t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
        if cur_t >= next_t:
            frames.append((idx, frame))
            idx += 1
            next_t += interval
    cap.release()
    return frames


def _extract_pip_frames(
    video_path: Path, t_start: float, t_end: float,
    roi_norm: list[float], w: int, h: int,
) -> list[np.ndarray]:
    """Extract PiP region frames at 6fps for matting."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []
    cap.set(cv2.CAP_PROP_POS_MSEC, t_start * 1000)
    x1, y1 = int(roi_norm[0] * w), int(roi_norm[1] * h)
    x2, y2 = int((roi_norm[0] + roi_norm[2]) * w), int((roi_norm[1] + roi_norm[3]) * h)
    frames: list[np.ndarray] = []
    interval = 1.0 / PIP_SAMPLE_FPS
    next_t = t_start
    while next_t < t_end:
        ret, frame = cap.read()
        if not ret:
            break
        cur_t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
        if cur_t >= next_t:
            crop = frame[y1:y2, x1:x2]
            if crop.size > 0:
                frames.append(crop)
            next_t += interval
    cap.release()
    return frames


# ---------------------------------------------------------------------------
# 1. OCR
# ---------------------------------------------------------------------------

def _run_ocr(
    frames: list[tuple[int, np.ndarray]], w: int, h: int,
) -> list[dict]:
    """Run RapidOCR on sampled frames."""
    try:
        from rapidocr_onnxruntime import RapidOCR
    except ImportError:
        logger.warning("RapidOCR not available — skipping OCR")
        return []

    ocr = RapidOCR()
    results: list[dict] = []

    for frame_num, frame in frames:
        ocr_result, _ = ocr(frame)
        if not ocr_result:
            continue
        for box, text, confidence in ocr_result:
            if confidence < 0.3:
                continue
            # box is [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
            x1 = min(p[0] for p in box) / w
            y1 = min(p[1] for p in box) / h
            x2 = max(p[0] for p in box) / w
            y2 = max(p[1] for p in box) / h
            results.append({
                "frame_num": frame_num,
                "text": text,
                "bbox_x": round(x1, 4), "bbox_y": round(y1, 4),
                "bbox_w": round(x2 - x1, 4), "bbox_h": round(y2 - y1, 4),
                "confidence": round(confidence, 3),
            })

    logger.info(f"OCR: {len(results)} text regions found across {len(frames)} frames")
    return results


def _summarize_ui_elements(ocr_events: list[dict]) -> list[str]:
    """Extract unique-ish UI element labels from OCR results."""
    seen: set[str] = set()
    elements: list[str] = []
    for ev in ocr_events:
        text = ev.get("text", "").strip()
        if len(text) < 3 or len(text) > 50:
            continue
        key = text.lower()
        if key not in seen:
            seen.add(key)
            elements.append(text)
            if len(elements) >= 20:
                break
    return elements


# ---------------------------------------------------------------------------
# 2. Change detection
# ---------------------------------------------------------------------------

def _detect_change_regions(
    frames: list[tuple[int, np.ndarray]],
    threshold: int = 30,
    min_area: int = 500,
) -> list[dict]:
    """Detect localized changes between consecutive frames."""
    results: list[dict] = []
    for i in range(1, len(frames)):
        prev_idx, prev_frame = frames[i - 1]
        cur_idx, cur_frame = frames[i]

        prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
        cur_gray = cv2.cvtColor(cur_frame, cv2.COLOR_BGR2GRAY)
        diff = cv2.absdiff(prev_gray, cur_gray)
        _, thresh = cv2.threshold(diff, threshold, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        h, w = cur_frame.shape[:2]
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area:
                continue
            x, y, cw, ch = cv2.boundingRect(cnt)
            # Classify: small + roughly square = click, wide = type
            aspect = cw / max(ch, 1)
            event_type = "type" if aspect > 3.0 else "click"
            results.append({
                "frame_num": cur_idx,
                "region_x": round(x / w, 4), "region_y": round(y / h, 4),
                "region_w": round(cw / w, 4), "region_h": round(ch / h, 4),
                "event_type": event_type,
            })

    logger.info(f"Change detection: {len(results)} events")
    return results


# ---------------------------------------------------------------------------
# 3. Cursor tracking
# ---------------------------------------------------------------------------

def _load_cursor_sprites() -> list[np.ndarray]:
    """Load cursor sprite templates from assets/cursors/."""
    sprites_dir = Path(__file__).parent / "assets" / "cursors"
    sprites: list[np.ndarray] = []
    for name in ("arrow.png", "hand.png", "ibeam.png"):
        path = sprites_dir / name
        if path.exists():
            sprite = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
            if sprite is not None:
                sprites.append(sprite)
    return sprites


def _track_cursor(
    frames: list[tuple[int, np.ndarray]],
    cursor_sprites: list[np.ndarray],
    threshold: float = 0.7,
) -> list[dict]:
    """Track cursor position via template matching."""
    results: list[dict] = []

    if not cursor_sprites:
        # Fallback: detect smallest consistently-moving bright spot
        logger.info("No cursor sprites available — using motion-based fallback")
        return _track_cursor_motion_fallback(frames)

    for frame_num, frame in frames:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

        best_score = 0.0
        best_pos = None
        best_type = "unknown"

        for i, sprite in enumerate(cursor_sprites):
            if sprite.shape[0] > h or sprite.shape[1] > w:
                continue
            result = cv2.matchTemplate(gray, sprite, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, max_loc = cv2.minMaxLoc(result)
            if max_val > best_score and max_val > threshold:
                best_score = max_val
                sh, sw = sprite.shape[:2]
                best_pos = (max_loc[0] + sw // 2, max_loc[1] + sh // 2)
                best_type = ["arrow", "hand", "ibeam"][i] if i < 3 else "unknown"

        if best_pos:
            results.append({
                "frame_num": frame_num,
                "x": round(best_pos[0] / w, 4),
                "y": round(best_pos[1] / h, 4),
                "cursor_type": best_type,
            })

    logger.info(f"Cursor tracking: {len(results)} positions detected")
    return results


def _track_cursor_motion_fallback(
    frames: list[tuple[int, np.ndarray]],
) -> list[dict]:
    """Detect cursor by finding the smallest consistently-moving high-diff region."""
    results: list[dict] = []
    for i in range(1, len(frames)):
        _, prev = frames[i - 1]
        frame_num, cur = frames[i]
        diff = cv2.absdiff(
            cv2.cvtColor(prev, cv2.COLOR_BGR2GRAY),
            cv2.cvtColor(cur, cv2.COLOR_BGR2GRAY),
        )
        _, thresh = cv2.threshold(diff, 40, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # Find smallest contour (likely cursor)
        h, w = cur.shape[:2]
        smallest = None
        smallest_area = float("inf")
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if 50 < area < 5000 and area < smallest_area:
                smallest_area = area
                smallest = cnt

        if smallest is not None:
            x, y, cw, ch = cv2.boundingRect(smallest)
            results.append({
                "frame_num": frame_num,
                "x": round((x + cw / 2) / w, 4),
                "y": round((y + ch / 2) / h, 4),
                "cursor_type": "detected",
            })
    return results


# ---------------------------------------------------------------------------
# 4. PiP detection
# ---------------------------------------------------------------------------

def _detect_pip(
    video_path: Path,
    scene_boundaries: list[SceneBoundary],
    highlight: HighlightWindow,
) -> Optional[PipRegion]:
    """Detect if there's a webcam PiP bubble in a corner."""
    import mediapipe as mp

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return PipRegion(present=False)

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))

    # Sample one frame per ~5s within the highlight window
    sample_times = []
    t = highlight.t_start
    while t < highlight.t_end:
        sample_times.append(t)
        t += 5.0

    face_det = mp.solutions.face_detection.FaceDetection(
        model_selection=0, min_detection_confidence=0.5,
    )

    corner_faces: list[tuple[float, float, float, float]] = []  # (x, y, w, h) norm

    try:
        for t in sample_times:
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
            ret, frame = cap.read()
            if not ret:
                continue
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = face_det.process(rgb)
            if result.detections:
                for det in result.detections:
                    bb = det.location_data.relative_bounding_box
                    fx, fy, fw, fh = bb.xmin, bb.ymin, bb.width, bb.height
                    cx, cy = fx + fw / 2, fy + fh / 2
                    # PiP = face in a corner quadrant + small relative size
                    is_corner = (cx < 0.3 or cx > 0.7) and (cy < 0.3 or cy > 0.7)
                    is_small = fw < 0.3 and fh < 0.4
                    if is_corner and is_small:
                        corner_faces.append((fx, fy, fw, fh))
    finally:
        face_det.close()
        cap.release()

    if len(corner_faces) < len(sample_times) * 0.4:
        return PipRegion(present=False)

    # Average the corner face bboxes to get the PiP ROI
    avg_x = sum(f[0] for f in corner_faces) / len(corner_faces)
    avg_y = sum(f[1] for f in corner_faces) / len(corner_faces)
    avg_w = sum(f[2] for f in corner_faces) / len(corner_faces)
    avg_h = sum(f[3] for f in corner_faces) / len(corner_faces)

    # Expand slightly for padding
    pad = 0.02
    roi = [
        round(max(0, avg_x - pad), 3),
        round(max(0, avg_y - pad), 3),
        round(min(1.0, avg_w + pad * 2), 3),
        round(min(1.0, avg_h + pad * 2), 3),
    ]

    logger.info(f"PiP detected: roi_norm={roi} ({len(corner_faces)}/{len(sample_times)} samples)")
    return PipRegion(present=True, roi_norm=roi)


# ---------------------------------------------------------------------------
# 5. Dynamic crop planner
# ---------------------------------------------------------------------------

def _plan_dynamic_crops(
    cursor_track: list[dict],
    change_events: list[dict],
    ocr_events: list[dict],
    w: int, h: int,
    t_start: float,
    crop_ratio: float = 0.6,
    min_duration: float = 3.0,
) -> list[DynamicCrop]:
    """Plan smoothed crop path through areas of activity."""
    if not cursor_track and not change_events:
        return []

    # Build attention centers by frame
    attention: dict[int, tuple[float, float]] = {}

    for ct in cursor_track:
        fn = ct["frame_num"]
        attention[fn] = (ct["x"], ct["y"])

    for ce in change_events:
        fn = ce["frame_num"]
        cx = ce["region_x"] + ce["region_w"] / 2
        cy = ce["region_y"] + ce["region_h"] / 2
        if fn in attention:
            # Average with existing
            ox, oy = attention[fn]
            attention[fn] = ((ox + cx) / 2, (oy + cy) / 2)
        else:
            attention[fn] = (cx, cy)

    if not attention:
        return []

    # Sort by frame number, smooth with moving average
    sorted_frames = sorted(attention.keys())
    smoothed_x: list[float] = []
    smoothed_y: list[float] = []
    window = 3
    for i, fn in enumerate(sorted_frames):
        neighbors = sorted_frames[max(0, i - window):i + window + 1]
        avg_x = sum(attention[n][0] for n in neighbors) / len(neighbors)
        avg_y = sum(attention[n][1] for n in neighbors) / len(neighbors)
        smoothed_x.append(avg_x)
        smoothed_y.append(avg_y)

    # Convert to crops — merge consecutive similar positions
    crops: list[DynamicCrop] = []
    half_w = crop_ratio / 2
    half_h = crop_ratio / 2
    fps = SCREEN_SAMPLE_FPS

    i = 0
    while i < len(sorted_frames):
        cx, cy = smoothed_x[i], smoothed_y[i]
        start_fn = sorted_frames[i]

        # Find how far this position holds
        j = i + 1
        while j < len(sorted_frames):
            dist = ((smoothed_x[j] - cx) ** 2 + (smoothed_y[j] - cy) ** 2) ** 0.5
            if dist > 0.1:
                break
            j += 1

        end_fn = sorted_frames[min(j, len(sorted_frames) - 1)]
        t_crop_start = t_start + start_fn / fps
        t_crop_end = t_start + end_fn / fps

        if t_crop_end - t_crop_start >= min_duration:
            crop_x = max(0.0, cx - half_w)
            crop_y = max(0.0, cy - half_h)
            crop_w = min(crop_ratio, 1.0 - crop_x)
            crop_h = min(crop_ratio, 1.0 - crop_y)

            crops.append(DynamicCrop(
                t_start=round(t_crop_start, 3),
                t_end=round(t_crop_end, 3),
                crop_bbox_norm=[round(crop_x, 3), round(crop_y, 3),
                                round(crop_w, 3), round(crop_h, 3)],
                follows="cursor" if cursor_track else "active_region",
            ))

        i = j

    logger.info(f"Dynamic crops: {len(crops)} segments planned")
    return crops


# ---------------------------------------------------------------------------
# 6. Key events + UI cutouts
# ---------------------------------------------------------------------------

def _synthesize_key_events(
    change_events: list[dict],
    ocr_events: list[dict],
    t_start: float,
) -> list[KeyOnscreenEvent]:
    """Create key on-screen events from change + OCR data."""
    events: list[KeyOnscreenEvent] = []

    # Top change events by area (bigger = more significant)
    significant = sorted(
        change_events,
        key=lambda e: e.get("region_w", 0) * e.get("region_h", 0),
        reverse=True,
    )[:15]

    for ce in significant:
        fn = ce["frame_num"]
        t = t_start + fn / SCREEN_SAMPLE_FPS

        # Find nearest OCR text
        near_text = ""
        for ocr in ocr_events:
            if ocr["frame_num"] == fn:
                near_text = ocr.get("text", "")[:30]
                break

        events.append(KeyOnscreenEvent(
            t=round(t, 3),
            kind=ce.get("event_type", "click"),
            near_text=near_text,
        ))

    events.sort(key=lambda e: e.t)
    return events[:10]


def _extract_ui_cutouts(
    video_path: Path,
    change_events: list[dict],
    output_dir: Path,
    w: int, h: int,
    t_start: float,
    max_cutouts: int = 5,
    padding_px: int = 20,
) -> tuple[list[UiCutout], list[Path]]:
    """Extract padded rectangles around key change events as short WebM clips."""
    cutouts_dir = output_dir / "assets" / "ui_cutouts"
    cutouts_dir.mkdir(parents=True, exist_ok=True)

    # Pick top events by change area
    significant = sorted(
        change_events,
        key=lambda e: e.get("region_w", 0) * e.get("region_h", 0),
        reverse=True,
    )[:max_cutouts]

    cutouts: list[UiCutout] = []
    paths: list[Path] = []

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return [], []

    for i, ce in enumerate(significant):
        fn = ce["frame_num"]
        t = t_start + fn / SCREEN_SAMPLE_FPS
        cut_id = f"cut_{i:03d}"

        # Extract the frame
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ret, frame = cap.read()
        if not ret:
            continue

        # Compute padded bbox in pixels
        x1 = max(0, int(ce["region_x"] * w) - padding_px)
        y1 = max(0, int(ce["region_y"] * h) - padding_px)
        x2 = min(w, int((ce["region_x"] + ce["region_w"]) * w) + padding_px)
        y2 = min(h, int((ce["region_y"] + ce["region_h"]) * h) + padding_px)

        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            continue

        # Save as PNG (not WebM — single frame, no video needed)
        out_path = cutouts_dir / f"{cut_id}.png"
        cv2.imwrite(str(out_path), crop)
        paths.append(out_path)

        cutouts.append(UiCutout(
            id=cut_id,
            t=round(t, 3),
            bbox_norm=[
                round(x1 / w, 4), round(y1 / h, 4),
                round((x2 - x1) / w, 4), round((y2 - y1) / h, 4),
            ],
            asset_path=f"assets/ui_cutouts/{cut_id}.png",
            label=f"UI element at {t:.1f}s",
        ))

    cap.release()
    logger.info(f"UI cutouts: {len(cutouts)} extracted")
    return cutouts, paths
