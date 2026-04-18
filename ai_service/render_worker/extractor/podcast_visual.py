"""
Stage 3A: Podcast mode visual extraction.

Runs on the highlight window only. Extracts:
- Face landmarks + head pose per frame (MediaPipe FaceMesh)
- Body pose + gesture classification (MediaPipe Pose lite)
- Speaker foreground alpha matte (Matter interface)
- Encodes transparent speaker_fg.webm
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional

import cv2
import numpy as np

from .encode import encode_alpha_webm
from .matting.base import Matter
from .schemas import FaceInfo, HighlightWindow

logger = logging.getLogger(__name__)

SAMPLE_FPS = 6.0


@dataclass
class PodcastVisualResult:
    frame_data: list[dict] = field(default_factory=list)
    speaker_fg_path: Optional[Path] = None
    typical_face_bbox: Optional[list[float]] = None
    free_regions: list[str] = field(default_factory=list)


def extract_podcast_visuals(
    video_path: Path,
    highlight: HighlightWindow,
    output_dir: Path,
    matter: Matter,
    on_progress: Optional[Callable[[float], None]] = None,
) -> PodcastVisualResult:
    """Extract face/pose/matting data for the highlight window.

    Samples at 6fps, runs face/pose detection, then matting, then encodes
    the alpha-composited speaker_fg.webm.
    """
    import mediapipe as mp

    t_start = highlight.t_start
    t_end = highlight.t_end
    duration = t_end - t_start

    # Extract frames at sample fps
    logger.info(f"Extracting podcast frames: {t_start:.1f}-{t_end:.1f}s @ {SAMPLE_FPS}fps")
    frames = _extract_sampled_frames(video_path, t_start, t_end, SAMPLE_FPS)
    if not frames:
        logger.warning("No frames extracted for podcast visual")
        return PodcastVisualResult()

    total_frames = len(frames)
    logger.info(f"Extracted {total_frames} frames for visual analysis")

    # Face + pose analysis
    frame_data: list[dict] = []
    face_bboxes: list[list[float]] = []

    face_mesh = mp.solutions.face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=False,
        min_detection_confidence=0.5,
    )
    pose = mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=0,  # lite
        min_detection_confidence=0.5,
    )

    try:
        for i, frame in enumerate(frames):
            t = t_start + i / SAMPLE_FPS
            h, w = frame.shape[:2]
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # Face detection
            face_result = face_mesh.process(rgb)
            face_x, face_y, face_w, face_h = 0.0, 0.0, 0.0, 0.0
            head_yaw, head_pitch = 0.0, 0.0

            if face_result.multi_face_landmarks:
                lms = face_result.multi_face_landmarks[0].landmark
                xs = [lm.x for lm in lms]
                ys = [lm.y for lm in lms]
                face_x = min(xs)
                face_y = min(ys)
                face_w = max(xs) - face_x
                face_h = max(ys) - face_y
                face_bboxes.append([face_x, face_y, face_w, face_h])
                head_yaw, head_pitch = _estimate_head_pose(lms)

            # Pose detection
            pose_result = pose.process(rgb)
            gesture = "neutral"
            if pose_result.pose_landmarks:
                gesture = _classify_gesture(pose_result.pose_landmarks.landmark)

            frame_data.append({
                "frame_num": i,
                "t": round(t, 3),
                "face_x": round(face_x, 4),
                "face_y": round(face_y, 4),
                "face_w": round(face_w, 4),
                "face_h": round(face_h, 4),
                "head_yaw": round(head_yaw, 2),
                "head_pitch": round(head_pitch, 2),
                "gesture": gesture,
                "rms": 0.0,
                "pitch": 0.0,
            })

            if on_progress and i % 10 == 0:
                pct = 40 + (i / total_frames) * 20  # 40-60%
                on_progress(pct)

    finally:
        face_mesh.close()
        pose.close()

    if on_progress:
        on_progress(60)

    # Matting — store as uint8 to save 75% memory (747MB vs 2.9GB for 60s)
    logger.info(f"Running matting on {total_frames} frames")
    alpha_mattes: list[np.ndarray] = []
    for alpha in matter.process(iter(frames)):
        # Convert float32 [0,1] → uint8 [0,255] immediately
        alpha_mattes.append((np.clip(alpha, 0.0, 1.0) * 255).astype(np.uint8))

    # Free the BGR frames (~2GB) before encoding starts
    del frames

    if on_progress:
        on_progress(75)

    # Encode speaker_fg.webm (streaming — reads video frames one at a time)
    speaker_fg_path = output_dir / "assets" / "speaker_fg.webm"
    encode_alpha_webm(
        video_path=video_path,
        alpha_mattes_sampled=alpha_mattes,
        output_path=speaker_fg_path,
        t_start=t_start,
        t_end=t_end,
        sample_fps=SAMPLE_FPS,
        target_fps=30,
    )

    if on_progress:
        on_progress(88)

    # Compute typical face bbox and free regions
    typical_bbox = None
    free_regions: list[str] = []
    if face_bboxes:
        avg_x = sum(b[0] for b in face_bboxes) / len(face_bboxes)
        avg_y = sum(b[1] for b in face_bboxes) / len(face_bboxes)
        avg_w = sum(b[2] for b in face_bboxes) / len(face_bboxes)
        avg_h = sum(b[3] for b in face_bboxes) / len(face_bboxes)
        typical_bbox = [round(avg_x, 3), round(avg_y, 3), round(avg_w, 3), round(avg_h, 3)]

        # Determine free regions (quadrants not occupied by the face)
        cx = avg_x + avg_w / 2
        cy = avg_y + avg_h / 2
        if cx > 0.4:
            free_regions.append("top_left")
            free_regions.append("bottom_left")
        if cx < 0.6:
            free_regions.append("top_right")
            free_regions.append("bottom_right")

    return PodcastVisualResult(
        frame_data=frame_data,
        speaker_fg_path=speaker_fg_path if speaker_fg_path.exists() else None,
        typical_face_bbox=typical_bbox,
        free_regions=free_regions,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_sampled_frames(
    video_path: Path, t_start: float, t_end: float, fps: float,
) -> list[np.ndarray]:
    """Extract frames at given fps from the time window."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []
    cap.set(cv2.CAP_PROP_POS_MSEC, t_start * 1000)
    frames: list[np.ndarray] = []
    interval = 1.0 / fps
    next_t = t_start
    while next_t < t_end:
        ret, frame = cap.read()
        if not ret:
            break
        cur_t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
        if cur_t >= next_t:
            frames.append(frame)
            next_t += interval
    cap.release()
    return frames


def _estimate_head_pose(landmarks) -> tuple[float, float]:
    """Rough yaw/pitch from FaceMesh landmarks."""
    nose = landmarks[1]
    left_eye = landmarks[33]
    right_eye = landmarks[263]
    eye_mid_x = (left_eye.x + right_eye.x) / 2
    yaw = (nose.x - eye_mid_x) * 100  # crude degrees approximation
    pitch = (nose.y - (left_eye.y + right_eye.y) / 2) * 100
    return float(yaw), float(pitch)


def _classify_gesture(pose_landmarks) -> str:
    """Simple heuristic gesture from MediaPipe Pose landmarks."""
    left_shoulder = pose_landmarks[11]
    right_shoulder = pose_landmarks[12]
    left_wrist = pose_landmarks[15]
    right_wrist = pose_landmarks[16]

    shoulder_y = (left_shoulder.y + right_shoulder.y) / 2

    # Both hands raised above shoulders
    if left_wrist.y < shoulder_y and right_wrist.y < shoulder_y:
        return "hands_up"

    # One hand extended far from body
    shoulder_width = abs(right_shoulder.x - left_shoulder.x)
    left_ext = abs(left_wrist.x - left_shoulder.x)
    right_ext = abs(right_wrist.x - right_shoulder.x)
    if left_ext > shoulder_width * 1.5 or right_ext > shoulder_width * 1.5:
        return "pointing"

    return "neutral"
