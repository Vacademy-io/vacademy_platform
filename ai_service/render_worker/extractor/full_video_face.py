"""
Full-video face scan — lightweight 1fps pass over the ENTIRE source video.

Stage 3 (podcast_visual.py) only runs face detection on the 30-60s highlight
window because it also does matting + pose + WebM encoding (expensive). For
future placement pipelines that need to know where the speaker's face is at
ANY point in a 1hr video, that's not enough.

This module runs FaceMesh-only at ~1fps on the whole source video and clusters
the per-second samples into stable "face segments" — time ranges where the
face stayed roughly in the same canvas region. Each segment carries free
quadrants so a future overlay pipeline can place an infographic in a region
that doesn't collide with the speaker.

All bboxes are normalized [0,1].
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Callable, Optional

import cv2
import numpy as np

from .schemas import FaceSegment

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------

DEFAULT_SAMPLE_FPS = 1.0          # 3600 samples for a 1hr video — cheap
SEGMENT_BREAK_DIST = 0.12         # face center moved >12% of canvas = new segment
SEGMENT_MIN_DURATION_S = 2.0      # drop blips shorter than this
GAP_FILL_SECONDS = 5.0            # bridge across short detection gaps within a segment


# ---------------------------------------------------------------------------
# Per-frame sampling
# ---------------------------------------------------------------------------

def scan_full_video_faces(
    video_path: Path,
    sample_fps: float = DEFAULT_SAMPLE_FPS,
    on_progress: Optional[Callable[[float], None]] = None,
    progress_lo: float = 0.0,
    progress_hi: float = 1.0,
) -> list[dict]:
    """Sample the full video at sample_fps and run FaceMesh on each frame.

    Returns a list of per-sample dicts:
        [{t, face_x, face_y, face_w, face_h, detected (bool)}, ...]

    Frames where no face is detected are still emitted with detected=False
    and zero bbox — so downstream segmenting can compute detection_rate.
    """
    import mediapipe as mp

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        logger.warning(f"Could not open video: {video_path}")
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_s = total_frames / fps if fps > 0 else 0.0

    if duration_s <= 0:
        cap.release()
        return []

    interval_s = 1.0 / sample_fps
    n_samples = int(duration_s / interval_s) + 1
    logger.info(
        f"Full-video face scan: {duration_s:.1f}s @ {sample_fps}fps → {n_samples} samples",
    )

    samples: list[dict] = []
    face_mesh = mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True,  # one-shot per frame, no temporal tracking
        max_num_faces=1,
        refine_landmarks=False,
        min_detection_confidence=0.5,
    )

    try:
        for i in range(n_samples):
            t = i * interval_s
            if t > duration_s:
                break

            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
            ret, frame = cap.read()
            if not ret or frame is None:
                samples.append({
                    "t": round(t, 3), "face_x": 0.0, "face_y": 0.0,
                    "face_w": 0.0, "face_h": 0.0, "detected": False,
                })
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = face_mesh.process(rgb)

            if result.multi_face_landmarks:
                lms = result.multi_face_landmarks[0].landmark
                xs = [lm.x for lm in lms]
                ys = [lm.y for lm in lms]
                fx = float(min(xs))
                fy = float(min(ys))
                fw = float(max(xs) - fx)
                fh = float(max(ys) - fy)
                samples.append({
                    "t": round(t, 3),
                    "face_x": round(fx, 4), "face_y": round(fy, 4),
                    "face_w": round(fw, 4), "face_h": round(fh, 4),
                    "detected": True,
                })
            else:
                samples.append({
                    "t": round(t, 3), "face_x": 0.0, "face_y": 0.0,
                    "face_w": 0.0, "face_h": 0.0, "detected": False,
                })

            if on_progress and i % 20 == 0 and n_samples > 0:
                pct = progress_lo + (i / n_samples) * (progress_hi - progress_lo)
                on_progress(pct)
    finally:
        face_mesh.close()
        cap.release()

    detected = sum(1 for s in samples if s["detected"])
    logger.info(f"Full-video face scan complete: {detected}/{len(samples)} samples had a face")
    return samples


# ---------------------------------------------------------------------------
# Segment clustering
# ---------------------------------------------------------------------------

def cluster_into_segments(
    samples: list[dict],
    break_dist: float = SEGMENT_BREAK_DIST,
    min_duration_s: float = SEGMENT_MIN_DURATION_S,
    gap_fill_s: float = GAP_FILL_SECONDS,
) -> list[FaceSegment]:
    """Cluster consecutive samples into FaceSegments.

    A new segment starts when the face center jumps by more than `break_dist`
    or when there's been a gap of `gap_fill_s` with no detection. Each
    resulting segment carries the averaged bbox + free quadrants.
    """
    if not samples:
        return []

    segments: list[FaceSegment] = []
    cur_samples: list[dict] = []
    last_detected_t: Optional[float] = None
    cur_center: Optional[tuple[float, float]] = None

    def _center(s: dict) -> tuple[float, float]:
        return (s["face_x"] + s["face_w"] / 2, s["face_y"] + s["face_h"] / 2)

    def _flush() -> None:
        if not cur_samples:
            return
        detected = [s for s in cur_samples if s["detected"]]
        if not detected:
            return
        t_start = cur_samples[0]["t"]
        t_end = cur_samples[-1]["t"]
        if t_end - t_start < min_duration_s:
            return
        avg_x = float(np.mean([s["face_x"] for s in detected]))
        avg_y = float(np.mean([s["face_y"] for s in detected]))
        avg_w = float(np.mean([s["face_w"] for s in detected]))
        avg_h = float(np.mean([s["face_h"] for s in detected]))
        seg = FaceSegment(
            t_start=round(t_start, 3),
            t_end=round(t_end, 3),
            bbox_norm=[round(avg_x, 3), round(avg_y, 3), round(avg_w, 3), round(avg_h, 3)],
            free_regions=_compute_free_regions(avg_x, avg_y, avg_w, avg_h),
            sample_count=len(detected),
            detection_rate=round(len(detected) / max(1, len(cur_samples)), 3),
        )
        segments.append(seg)

    for s in samples:
        if not s["detected"]:
            # Tolerate short gaps within a segment
            if last_detected_t is not None and (s["t"] - last_detected_t) <= gap_fill_s:
                cur_samples.append(s)
                continue
            # Long gap → flush
            _flush()
            cur_samples = []
            cur_center = None
            last_detected_t = None
            continue

        c = _center(s)
        if cur_center is not None:
            dx = c[0] - cur_center[0]
            dy = c[1] - cur_center[1]
            if (dx * dx + dy * dy) ** 0.5 > break_dist:
                _flush()
                cur_samples = []

        cur_samples.append(s)
        # Running mean of center for stability comparison
        det_in_cur = [x for x in cur_samples if x["detected"]]
        if det_in_cur:
            cur_center = (
                float(np.mean([_center(x)[0] for x in det_in_cur])),
                float(np.mean([_center(x)[1] for x in det_in_cur])),
            )
        last_detected_t = s["t"]

    _flush()
    logger.info(f"Clustered face samples into {len(segments)} segments")
    return segments


def _compute_free_regions(x: float, y: float, w: float, h: float) -> list[str]:
    """Return canvas quadrants NOT occupied by the face bbox.

    Uses the face center to decide which side of the canvas is free, plus
    a vertical-half check so a face at the top leaves the bottom free.
    """
    cx = x + w / 2
    cy = y + h / 2
    free: list[str] = []
    # Horizontal: face on right side → left is free
    left_free = cx > 0.45
    right_free = cx < 0.55
    # Vertical: face in top half → bottom is free
    top_free = cy > 0.40
    bottom_free = cy < 0.60
    if top_free and left_free:
        free.append("top_left")
    if top_free and right_free:
        free.append("top_right")
    if bottom_free and left_free:
        free.append("bottom_left")
    if bottom_free and right_free:
        free.append("bottom_right")
    # Whole side classifiers (more useful for wide overlays)
    if left_free:
        free.append("left_half")
    if right_free:
        free.append("right_half")
    if top_free:
        free.append("top_half")
    if bottom_free:
        free.append("bottom_half")
    return free
