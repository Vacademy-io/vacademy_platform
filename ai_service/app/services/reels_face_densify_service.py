"""
Reels — on-demand dense face detection for SOURCE_CLIP_BUILD (Issue 2C).

The indexing pipeline (`render_worker/extractor/full_video_face.py`) samples
faces at 1fps across the whole source video. For a 40-60s reel window the
result is often sparse — typical production: 5 segments × ~5s each = 22s of
coverage over a 40s window (55%), with the remaining 18s as "untracked
gaps". The static crop has nothing to anchor on during those gaps and may
drift off the speaker.

This module re-runs FaceMesh at 5fps on JUST the reel window. The window
is short (<60s) so the extra cost is small (~5-15s of CPU + ffmpeg frame
extraction). The resulting per-frame data is clustered with a tighter
minimum-segment threshold (0.5s instead of the 2s used by the indexer's
1fps pass) so we capture short head turns that the indexer's threshold
filtered out.

Output is a list of segment dicts in the SAME SHAPE as
`video_context.face_segments` — drop-in replacement for the in-window
portion. Callers fall back to the existing sparse segments if
densification fails or yields no detections.

Cost / when to fire:
  - Coverage gate (DENSIFY_THRESHOLD = 0.70): skip if existing coverage
    already exceeds 70%.
  - Window-duration gate: skip windows > MAX_WINDOW_S (90s) — too
    expensive for the marginal gain.
  - Kill switch: env REELS_FACE_DENSIFY_DISABLED=1 disables the
    service entirely (one-line out-of-band rollback).

Graceful degradation: any failure (ffmpeg / mediapipe / opencv missing,
network error, frame-extraction crash) returns `None`. Caller falls back
to the existing sparse segments — render still succeeds, just with the
original lower-coverage data.
"""
from __future__ import annotations

import logging
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------

DENSIFY_THRESHOLD = 0.70           # skip if existing coverage already >= 70%
DENSIFY_SAMPLE_FPS = 5.0           # 5fps — 300 samples on a 60s window
MIN_SEGMENT_DURATION_S = 0.5       # tighter than indexer's 2s — catch short turns
SEGMENT_BREAK_DIST = 0.12          # face-center jump that starts a new segment
GAP_FILL_S = 1.0                   # bridge sub-1s detection gaps inside a segment
MAX_WINDOW_S = 90.0                # don't densify obscenely long windows
_DISABLE_ENV = "REELS_FACE_DENSIFY_DISABLED"
_FFMPEG_TIMEOUT_S = 60
_DETECTION_CONFIDENCE = 0.4        # slightly more lenient than indexer's 0.5
                                   # (we sample more frames; want recall > precision)


def densify_enabled() -> bool:
    """One-line kill switch for ops — set REELS_FACE_DENSIFY_DISABLED=1
    to force the SOURCE_CLIP stage back to using the sparse indexer
    segments. Useful if mediapipe starts crashing or burning CPU."""
    return os.getenv(_DISABLE_ENV, "").strip().lower() not in ("1", "true", "yes")


# ---------------------------------------------------------------------------
# Coverage check
# ---------------------------------------------------------------------------

def coverage_fraction(
    segments: list[dict],
    win_t_start: float,
    win_t_end: float,
) -> float:
    """Sum of segment-window overlap / window duration. Returns 0..1.

    Used by the caller's gate — densification only fires when this is
    below DENSIFY_THRESHOLD.
    """
    if win_t_end <= win_t_start:
        return 0.0
    win_dur = win_t_end - win_t_start
    total = 0.0
    for s in segments:
        try:
            ss = float(s.get("t_start") or 0.0)
            se = float(s.get("t_end") or 0.0)
        except (TypeError, ValueError):
            continue
        ov_start = max(ss, win_t_start)
        ov_end = min(se, win_t_end)
        overlap = max(0.0, ov_end - ov_start)
        total += overlap
    return min(1.0, total / win_dur)


# ---------------------------------------------------------------------------
# Public entry — async wrapper around the blocking ffmpeg+mediapipe path
# ---------------------------------------------------------------------------

def densify_face_segments(
    source_url: str,
    win_t_start: float,
    win_t_end: float,
    existing_segments: list[dict],
) -> Optional[list[dict]]:
    """Run FaceMesh at 5fps on the window. Returns a merged segment list
    (same shape as `face_segments` in video_context) — in-window data
    replaced by the dense pass, out-of-window kept as-is. Returns None
    on any failure path; caller falls back to existing_segments.

    Sync — called from SOURCE_CLIP_BUILD which is itself running in a
    worker thread via `asyncio.to_thread`. No event-loop entanglement
    needed.
    """
    if not densify_enabled():
        return None
    if win_t_end - win_t_start > MAX_WINDOW_S:
        logger.info(
            f"[FaceDensify] window {win_t_end - win_t_start:.1f}s exceeds "
            f"MAX_WINDOW_S={MAX_WINDOW_S}; skipping"
        )
        return None
    existing_cov = coverage_fraction(existing_segments, win_t_start, win_t_end)
    if existing_cov >= DENSIFY_THRESHOLD:
        return None
    try:
        result = _densify_blocking(
            source_url=source_url,
            win_t_start=win_t_start,
            win_t_end=win_t_end,
        )
    except Exception as e:
        logger.warning(f"[FaceDensify] unexpected error: {e}; falling back to sparse")
        return None
    if not result:
        return None
    # Merge: keep existing segments OUTSIDE the window, replace the
    # in-window portion with the dense data.
    merged: list[dict] = [
        s for s in existing_segments
        if (float(s.get("t_end") or 0.0) <= win_t_start
            or float(s.get("t_start") or 0.0) >= win_t_end)
    ]
    merged.extend(result)
    merged.sort(key=lambda s: float(s.get("t_start") or 0.0))
    new_cov = coverage_fraction(result, win_t_start, win_t_end)
    logger.info(
        f"[FaceDensify] coverage {existing_cov:.2f} → {new_cov:.2f}, "
        f"added {len(result)} dense segments in window"
    )
    return merged


# ---------------------------------------------------------------------------
# Blocking core — runs in a thread via asyncio.to_thread
# ---------------------------------------------------------------------------

def _densify_blocking(
    source_url: str,
    win_t_start: float,
    win_t_end: float,
) -> Optional[list[dict]]:
    """ffmpeg-extract frames at 5fps → mediapipe FaceMesh → cluster.
    All blocking IO + CPU work happens here."""
    try:
        import cv2  # type: ignore
        import mediapipe as mp  # type: ignore
        import numpy as np  # type: ignore
    except ImportError as e:
        logger.warning(f"[FaceDensify] missing dependency: {e}; skipping")
        return None

    duration = win_t_end - win_t_start
    samples: list[dict] = []

    with tempfile.TemporaryDirectory(prefix="reels-face-densify-") as tmp:
        tmpdir = Path(tmp)
        # Extract frames at DENSIFY_SAMPLE_FPS into a numbered PNG sequence.
        # -ss BEFORE -i for fast seek; -copyts is unnecessary because we
        # compute frame-time from the index + sample interval, not the
        # ffmpeg-emitted timestamp.
        cmd = [
            "ffmpeg", "-y", "-loglevel", "error",
            "-ss", f"{win_t_start:.3f}",
            "-i", source_url,
            "-t", f"{duration:.3f}",
            "-an",  # skip audio demux — we only need video frames
            "-vf", f"fps={DENSIFY_SAMPLE_FPS}",
            "-f", "image2", str(tmpdir / "f_%05d.jpg"),
        ]
        try:
            subprocess.run(
                cmd, check=True, capture_output=True,
                timeout=_FFMPEG_TIMEOUT_S,
            )
        except subprocess.CalledProcessError as e:
            logger.warning(
                f"[FaceDensify] ffmpeg extract failed: rc={e.returncode} "
                f"stderr={e.stderr.decode('utf-8', errors='ignore')[:200]!r}"
            )
            return None
        except subprocess.TimeoutExpired:
            logger.warning(f"[FaceDensify] ffmpeg timeout after {_FFMPEG_TIMEOUT_S}s")
            return None

        frame_paths = sorted(tmpdir.glob("f_*.jpg"))
        if not frame_paths:
            logger.warning("[FaceDensify] ffmpeg produced no frames")
            return None

        interval_s = 1.0 / DENSIFY_SAMPLE_FPS
        face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=False,
            min_detection_confidence=_DETECTION_CONFIDENCE,
        )
        try:
            for i, fp in enumerate(frame_paths):
                t = win_t_start + i * interval_s
                if t > win_t_end:
                    break
                frame = cv2.imread(str(fp))
                if frame is None:
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
        finally:
            face_mesh.close()

    if not samples:
        return None
    detected = sum(1 for s in samples if s["detected"])
    if detected == 0:
        logger.info(
            f"[FaceDensify] {len(samples)} frames, 0 detections "
            f"(speaker likely off-camera in window); skipping"
        )
        return None

    segments = _cluster_into_segments(samples)
    logger.info(
        f"[FaceDensify] {detected}/{len(samples)} frames detected → "
        f"{len(segments)} dense segments"
    )
    return segments


# ---------------------------------------------------------------------------
# Clustering — same shape as full_video_face.cluster_into_segments but
# with TIGHTER min_duration_s so short head-turns aren't filtered out.
# ---------------------------------------------------------------------------

def _cluster_into_segments(samples: list[dict]) -> list[dict]:
    """Cluster per-frame samples into face_segments dicts (same shape as
    `video_context.face_segments`). Tight min_duration + smaller gap_fill
    than the indexer so the dense pass captures short head turns."""
    if not samples:
        return []
    import numpy as np  # type: ignore

    out: list[dict] = []
    cur: list[dict] = []
    cur_center: Optional[tuple[float, float]] = None
    last_detected_t: Optional[float] = None

    def _center(s: dict) -> tuple[float, float]:
        return (s["face_x"] + s["face_w"] / 2, s["face_y"] + s["face_h"] / 2)

    def _flush() -> None:
        if not cur:
            return
        det = [s for s in cur if s["detected"]]
        if not det:
            return
        t_start = cur[0]["t"]
        t_end = cur[-1]["t"]
        if t_end - t_start < MIN_SEGMENT_DURATION_S:
            return
        avg_x = float(np.mean([s["face_x"] for s in det]))
        avg_y = float(np.mean([s["face_y"] for s in det]))
        avg_w = float(np.mean([s["face_w"] for s in det]))
        avg_h = float(np.mean([s["face_h"] for s in det]))
        out.append({
            "t_start": round(t_start, 3),
            "t_end": round(t_end, 3),
            "bbox_norm": [round(avg_x, 3), round(avg_y, 3),
                          round(avg_w, 3), round(avg_h, 3)],
            "free_regions": [],
            "sample_count": len(det),
            "detection_rate": round(len(det) / max(1, len(cur)), 3),
        })

    for s in samples:
        if not s["detected"]:
            if last_detected_t is not None and (s["t"] - last_detected_t) <= GAP_FILL_S:
                cur.append(s)
                continue
            _flush()
            cur = []
            cur_center = None
            last_detected_t = None
            continue

        c = _center(s)
        if cur_center is not None:
            dx = c[0] - cur_center[0]
            dy = c[1] - cur_center[1]
            if (dx * dx + dy * dy) ** 0.5 > SEGMENT_BREAK_DIST:
                _flush()
                cur = []

        cur.append(s)
        det_in_cur = [x for x in cur if x["detected"]]
        if det_in_cur:
            cur_center = (
                float(np.mean([_center(x)[0] for x in det_in_cur])),
                float(np.mean([_center(x)[1] for x in det_in_cur])),
            )
        last_detected_t = s["t"]

    _flush()
    return out
