"""
Alpha frame sequence → transparent VP9 WebM via ffmpeg.

STREAMING DESIGN: never holds more than 1 RGB frame in memory at a time.
Alpha mattes (at 6fps) are kept in memory as uint8 arrays (~750MB for 60s)
and interpolated on-the-fly during encoding.
"""
from __future__ import annotations

import logging
import subprocess
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def _interpolate_alpha_at(
    mattes: list[np.ndarray],
    source_fps: float,
    t_relative: float,
) -> np.ndarray:
    """Interpolate alpha matte for a single timestamp (on-the-fly).

    mattes: list of uint8 or float32 HxW arrays sampled at source_fps.
    t_relative: seconds since the start of the matte sequence.
    """
    src_idx = t_relative * source_fps
    idx_low = int(src_idx)
    idx_low = min(idx_low, len(mattes) - 1)
    idx_high = min(idx_low + 1, len(mattes) - 1)

    if idx_low == idx_high or idx_low >= len(mattes) - 1:
        return mattes[idx_low].astype(np.float32) if mattes[idx_low].dtype == np.uint8 else mattes[idx_low]

    frac = src_idx - idx_low
    low = mattes[idx_low].astype(np.float32)
    high = mattes[idx_high].astype(np.float32)

    # If stored as uint8 [0,255], normalize to [0,1] for interpolation
    if mattes[idx_low].dtype == np.uint8:
        low = low / 255.0
        high = high / 255.0

    return ((1.0 - frac) * low + frac * high).astype(np.float32)


def encode_alpha_webm(
    video_path: Path,
    alpha_mattes_sampled: list[np.ndarray],
    output_path: Path,
    t_start: float,
    t_end: float,
    sample_fps: float = 6.0,
    target_fps: int = 30,
    crop_bbox: Optional[tuple[int, int, int, int]] = None,
) -> None:
    """Produce a transparent VP9 WebM from source video + alpha mattes.

    STREAMING: reads one RGB frame at a time from the source video via
    OpenCV, interpolates the alpha on-the-fly from the sampled mattes,
    composites RGBA, and pipes directly to ffmpeg. Peak memory usage is
    ~1 frame (~6MB) plus the alpha matte list (~750MB for 60s@6fps uint8).
    """
    duration = t_end - t_start
    if duration <= 0 or not alpha_mattes_sampled:
        logger.warning("Empty alpha sequence or zero duration — skipping encode")
        return

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Open source video
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video for encoding: {video_path}")

    cap.set(cv2.CAP_PROP_POS_MSEC, t_start * 1000)

    # Read first frame to determine dimensions
    ret, first_frame = cap.read()
    if not ret:
        cap.release()
        raise RuntimeError("Cannot read first frame for encoding")

    if crop_bbox:
        x, y, w, h = crop_bbox
        x = max(0, x)
        y = max(0, y)
        w = min(w, first_frame.shape[1] - x)
        h = min(h, first_frame.shape[0] - y)
        width, height = w, h
    else:
        height, width = first_frame.shape[:2]

    # Start ffmpeg process
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-pix_fmt", "rgba",
        "-s", f"{width}x{height}",
        "-r", str(target_fps),
        "-i", "pipe:",
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        "-b:v", "1M",
        "-an",
        str(output_path),
    ]

    logger.info(f"Encoding WebM (streaming): {width}x{height} @ {target_fps}fps, {duration:.1f}s")
    proc = subprocess.Popen(
        ffmpeg_cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    try:
        # Process first frame we already read
        frame_interval = 1.0 / target_fps
        next_t = t_start
        frames_written = 0

        def _process_frame(frame: np.ndarray, t_abs: float) -> None:
            nonlocal frames_written
            t_rel = t_abs - t_start

            # Interpolate alpha for this timestamp
            alpha = _interpolate_alpha_at(alpha_mattes_sampled, sample_fps, t_rel)

            # Crop if needed
            if crop_bbox:
                frame = frame[y:y+h, x:x+w]
                alpha = alpha[y:y+h, x:x+w]

            # Resize alpha to match frame if needed
            fh, fw = frame.shape[:2]
            if alpha.shape[:2] != (fh, fw):
                alpha = cv2.resize(alpha, (fw, fh))

            # Ensure alpha is [0,1] float32
            if alpha.dtype == np.uint8:
                alpha = alpha.astype(np.float32) / 255.0

            alpha_u8 = (np.clip(alpha, 0.0, 1.0) * 255).astype(np.uint8)
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgba = np.dstack([rgb, alpha_u8])
            proc.stdin.write(rgba.tobytes())
            frames_written += 1

        # Handle the first frame
        current_t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
        if current_t >= next_t:
            _process_frame(first_frame, current_t)
            next_t += frame_interval

        # Stream remaining frames
        while next_t < t_end:
            ret, frame = cap.read()
            if not ret:
                break
            current_t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
            if current_t >= next_t:
                _process_frame(frame, current_t)
                next_t += frame_interval

        proc.stdin.close()
        proc.wait(timeout=300)

        if proc.returncode != 0:
            stderr = proc.stderr.read().decode(errors="replace")
            raise RuntimeError(f"ffmpeg VP9 encode failed: {stderr[:500]}")

        logger.info(f"Encoded: {output_path} ({frames_written} frames, {output_path.stat().st_size / 1024:.0f} KB)")

    except Exception:
        proc.kill()
        raise
    finally:
        cap.release()
