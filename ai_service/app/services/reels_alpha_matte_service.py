"""
Phase 2d — Speaker silhouette alpha matte for PiP cutout layouts.

When `pip_corner_speaker` is the chosen layout, the speaker should
appear as a transparent silhouette layered over the bgv — not a
rectangular PiP window. This service produces `speaker_fg.webm` from
the locally-built `speaker_clip.mp4` by:

  1. Sampling RGB frames at 6fps via OpenCV
  2. Running MediaPipe SelfieSegmentation per-frame with temporal EMA
     smoothing (alpha_smooth=0.6) + 2px Gaussian edge feather
  3. Composting RGBA per-frame and streaming to ffmpeg → VP9 WebM
     (`libvpx-vp9` + `yuva420p`)

The implementation is intentionally inline (not importing from
`render_worker/extractor/matting`) so this service is self-contained
within ai_service — no `sys.path` hacks. The algorithm matches the
proven `SelfieSegMatter` from the indexing pipeline so output quality
is consistent.

Cost: ~50-200ms per matted frame on CPU. For a 25s reel = ~150 frames
@ 6fps × ~100ms = ~15s matting + ~5s encode = **~20s added to
SOURCE_CLIP_BUILD** on average.

Graceful degradation: if mediapipe / opencv fail to load at runtime
(deploy env behind requirements.txt, model download failed, no GPU
where required), `produce_alpha_webm` returns None and the director
silently falls back to rectangular PiP. The render still ships.

Env kill-switch `REELS_ALPHA_MATTE_DISABLED=1` disables this service
without a redeploy — useful when a production batch reveals a quality
regression and rectangular PiP is preferred.
"""
from __future__ import annotations

import logging
import os
import subprocess
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Defaults / tunables — mirror SelfieSegMatter so output is consistent
# ---------------------------------------------------------------------------

# Frames per second to sample for matting. SelfieSeg runs at video frame
# rate downstream via interpolation, so undersampling is fine + cheaper.
_MATTE_SAMPLE_FPS = 6.0

# Temporal EMA smoothing — closer to 1.0 = more responsive but jitterier;
# closer to 0 = smoother but laggy. 0.6 is the validated default from
# render_worker. Reduces flicker at speaker hairline / edges.
_ALPHA_SMOOTH = 0.6

# Gaussian feather radius applied to each matte to soften the silhouette
# edge — looks more natural than a binary cutout. 2 = 5x5 kernel.
_FEATHER_PX = 2

# Output WebM target FPS. Browser playback is smoother at 24-30; matting
# is at 6fps and we interpolate up — the alpha is "smeared" between
# sampled frames but the human eye doesn't notice for short clips.
_TARGET_FPS = 30

# Env kill-switch. Reads at the start of each render so an ops flip
# takes effect on the next reel without a service restart.
_DISABLE_ENV = "REELS_ALPHA_MATTE_DISABLED"


def alpha_matte_enabled() -> bool:
    """True unless ops flipped the env kill-switch. Default on."""
    return os.getenv(_DISABLE_ENV, "").strip().lower() not in ("1", "true", "yes")


# Deferred imports — cv2 + mediapipe are heavy and only needed when this
# stage actually fires. We probe availability lazily so module import is
# fast and ai_service can still boot if the deps aren't installed.
def _try_import_deps():
    """Returns (cv2, np) on success or (None, None) if either dep is missing.

    Logs a warning at import-failure time so deployment misconfigs are
    visible in logs without crashing the service.
    """
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
        return cv2, np
    except ImportError as e:
        logger.warning(
            f"[AlphaMatte] cv2/numpy unavailable ({e}); PiP cutout will "
            "fall back to rectangular layout. Add mediapipe + "
            "opencv-python-headless to ai_service requirements.txt."
        )
        return None, None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def produce_alpha_webm(
    speaker_clip_path: Path,
    out_path: Path,
    *,
    sample_fps: float = _MATTE_SAMPLE_FPS,
    target_fps: int = _TARGET_FPS,
) -> Optional[Path]:
    """Run SelfieSeg matting on `speaker_clip_path` → write VP9 WebM with
    alpha channel to `out_path`. Returns `out_path` on success or None on
    any failure (caller falls back to rectangular PiP).

    `speaker_clip_path` MUST be the reel's already-built speaker_clip.mp4
    (post-trim, post-aspect-crop). Matting on the pre-trim source would
    desynchronize alpha vs RGB at cut boundaries.
    """
    if not alpha_matte_enabled():
        logger.info("[AlphaMatte] disabled via env kill-switch — skipping")
        return None

    cv2, np = _try_import_deps()
    if cv2 is None or np is None:
        return None

    if not speaker_clip_path.exists() or speaker_clip_path.stat().st_size == 0:
        logger.warning(
            f"[AlphaMatte] speaker_clip missing or empty: {speaker_clip_path}"
        )
        return None

    try:
        import mediapipe as mp  # type: ignore
    except ImportError as e:
        logger.warning(
            f"[AlphaMatte] mediapipe unavailable ({e}); PiP cutout disabled"
        )
        return None

    # 1. Probe video metadata (duration, fps, dims).
    cap = cv2.VideoCapture(str(speaker_clip_path))
    if not cap.isOpened():
        logger.warning(f"[AlphaMatte] cannot open {speaker_clip_path}")
        return None
    try:
        src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if total_frames <= 0 or src_fps <= 0:
            logger.warning(
                f"[AlphaMatte] degenerate metadata fps={src_fps} frames={total_frames}"
            )
            return None
        duration_s = total_frames / src_fps

        # 2. Sample frames at `sample_fps` (every Nth video frame) for matting.
        # Cheaper than running matting at full video fps — alpha is then
        # interpolated up to `target_fps` during compositing.
        stride = max(1, int(round(src_fps / sample_fps)))
        sampled_rgb: list = []
        idx = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if idx % stride == 0:
                sampled_rgb.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            idx += 1
    finally:
        cap.release()

    if not sampled_rgb:
        logger.warning("[AlphaMatte] no frames sampled")
        return None

    # 3. Matte each sampled frame. Temporal EMA + Gaussian feather match
    # the SelfieSegMatter defaults from render_worker for visual consistency.
    seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)
    mattes_uint8: list = []
    prev: Optional["np.ndarray"] = None
    try:
        for rgb in sampled_rgb:
            res = seg.process(rgb)
            raw = res.segmentation_mask  # float32 [0,1]
            if prev is not None:
                alpha = _ALPHA_SMOOTH * raw + (1.0 - _ALPHA_SMOOTH) * prev
            else:
                alpha = raw.copy()
            prev = alpha.copy()
            if _FEATHER_PX > 0:
                k = _FEATHER_PX * 2 + 1
                alpha = cv2.GaussianBlur(alpha, (k, k), 0)
            mattes_uint8.append(
                (np.clip(alpha, 0.0, 1.0) * 255).astype(np.uint8)
            )
    finally:
        seg.close()
    # Free the RGB buffer — we re-read from disk during encoding.
    sampled_count = len(sampled_rgb)
    del sampled_rgb

    if not mattes_uint8:
        logger.warning("[AlphaMatte] matting produced no mattes")
        return None

    logger.info(
        f"[AlphaMatte] matted {sampled_count} frames "
        f"({duration_s:.1f}s @ {sample_fps}fps sample)"
    )

    # 4. Encode RGBA stream → VP9 WebM. Re-open the clip and stream frames
    # one at a time, interpolating alpha from the sparse matte sequence
    # to the dense video frame timeline.
    return _encode_alpha_webm(
        speaker_clip_path=speaker_clip_path,
        mattes_uint8=mattes_uint8,
        out_path=out_path,
        sample_fps=sample_fps,
        target_fps=target_fps,
        cv2_module=cv2,
        np_module=np,
    )


# ---------------------------------------------------------------------------
# Encoder — inline-translated from extractor/encode.py:encode_alpha_webm
# ---------------------------------------------------------------------------

def _interpolate_alpha_uint8(
    mattes: list,
    np_module,
    sample_fps: float,
    t_rel: float,
):
    """Linear interpolation between two adjacent sampled alpha mattes for
    `t_rel` seconds into the matte sequence. Returns float32 [0,1] HxW."""
    src_idx = t_rel * sample_fps
    lo = max(0, min(int(src_idx), len(mattes) - 1))
    hi = min(lo + 1, len(mattes) - 1)
    if lo == hi:
        return mattes[lo].astype(np_module.float32) / 255.0
    frac = src_idx - lo
    a_lo = mattes[lo].astype(np_module.float32) / 255.0
    a_hi = mattes[hi].astype(np_module.float32) / 255.0
    return ((1.0 - frac) * a_lo + frac * a_hi).astype(np_module.float32)


def _encode_alpha_webm(
    *,
    speaker_clip_path: Path,
    mattes_uint8: list,
    out_path: Path,
    sample_fps: float,
    target_fps: int,
    cv2_module,
    np_module,
) -> Optional[Path]:
    """Stream RGBA frames to ffmpeg subprocess. Output is VP9 with alpha.

    Memory footprint stays at ~1 RGB frame + the matte sequence (~750MB
    for 60s @ 6fps uint8). We don't load all frames at once.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)

    cap = cv2_module.VideoCapture(str(speaker_clip_path))
    if not cap.isOpened():
        return None

    try:
        ok, first_frame = cap.read()
        if not ok:
            logger.warning("[AlphaMatte] cannot read first frame for encode")
            return None
        height, width = first_frame.shape[:2]
        src_fps = cap.get(cv2_module.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2_module.CAP_PROP_FRAME_COUNT) or 0)
        duration_s = total_frames / src_fps if src_fps > 0 else 0.0

        # ffmpeg pipe: receive raw RGBA, encode VP9 with alpha
        ffmpeg_cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "rawvideo",
            "-pix_fmt", "rgba",
            "-s", f"{width}x{height}",
            "-r", str(target_fps),
            "-i", "pipe:",
            "-c:v", "libvpx-vp9",
            "-pix_fmt", "yuva420p",
            # 1Mbps target — produces clean VP9 alpha at PiP resolutions.
            # We can revisit if file sizes balloon at 1080p source clips.
            "-b:v", "1M",
            "-an",
            str(out_path),
        ]
        proc = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        # Rewind the capture so we start emitting from frame 0 again.
        cap.set(cv2_module.CAP_PROP_POS_FRAMES, 0)

        try:
            frame_dt = 1.0 / target_fps
            t_abs = 0.0
            frames_written = 0
            while t_abs < duration_s + 1e-3:
                # Seek to the source frame closest to t_abs
                cap.set(cv2_module.CAP_PROP_POS_MSEC, t_abs * 1000.0)
                ok, frame = cap.read()
                if not ok:
                    break
                if frame.shape[:2] != (height, width):
                    # Defensive — some codecs report inconsistent dims
                    # between probe + read. Resize the frame to match.
                    frame = cv2_module.resize(frame, (width, height))

                alpha = _interpolate_alpha_uint8(
                    mattes_uint8, np_module, sample_fps, t_abs
                )
                if alpha.shape[:2] != (height, width):
                    alpha = cv2_module.resize(alpha, (width, height))
                alpha_u8 = (np_module.clip(alpha, 0.0, 1.0) * 255).astype(np_module.uint8)
                rgb = cv2_module.cvtColor(frame, cv2_module.COLOR_BGR2RGB)
                rgba = np_module.dstack([rgb, alpha_u8])
                proc.stdin.write(rgba.tobytes())
                frames_written += 1
                t_abs += frame_dt
        finally:
            try:
                proc.stdin.close()
            except (BrokenPipeError, OSError):
                pass
            proc.wait(timeout=60)

        if proc.returncode != 0:
            stderr = (proc.stderr.read() or b"").decode("utf-8", errors="replace")[:400]
            logger.warning(f"[AlphaMatte] ffmpeg encode failed: {stderr}")
            return None

        if not out_path.exists() or out_path.stat().st_size == 0:
            logger.warning("[AlphaMatte] ffmpeg produced empty webm")
            return None

        logger.info(
            f"[AlphaMatte] encoded {out_path.name} "
            f"({frames_written} frames, {out_path.stat().st_size} bytes)"
        )
        return out_path
    finally:
        cap.release()
