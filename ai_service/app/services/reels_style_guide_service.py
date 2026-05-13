"""
Phase 2b — STYLE_GUIDE stage: optional palette extraction from speaker_clip.

Default behavior (`palette='default'`): no-op. The director renders with
the hardcoded Hormozi-style palette (yellow important / green definition
/ red warning) which research §12.4 identifies as the proven retention
winner across educational + storytelling short-form.

Opt-in behavior (`palette='source_derived'`): samples 3 keyframes from
the just-built speaker_clip via a stream-decoded ffmpeg pipe, derives a
single accent hue from the dominant high-saturation hue across the three
frames, and writes the override into `ctx.extra_metadata["style_palette"]`.
The director's caption + overlay color paths read this override (with
fallback to `DEFAULT_CAPTION_PALETTE`).

Only the `important` slot is overridden — `definition` (green) and
`warning` (red) stay semantic across all reels (a red warning band reads
universally; mapping it to whatever color the speaker's clothes happen
to be would defeat the purpose). `body` (white) and `stroke` (black)
also stay fixed for caption readability.

Cost: ~1-2s of CPU per reel when source_derived is requested (three
small ffmpeg seeks + HSV histogram). Negligible vs the existing pipeline.

Graceful degradation: if cv2/numpy aren't importable, or ffmpeg fails
to extract a frame, or no high-saturation pixels exist (grayscale source),
the stage falls through to default behavior — the override stays
unwritten and the director uses DEFAULT_CAPTION_PALETTE.

A/B notes: leaving `palette='default'` as the default protects the
proven baseline. Opt-in via the API field allows side-by-side renders
("default" vs "source_derived") for A/B testing without code changes.
"""
from __future__ import annotations

import asyncio
import logging
import re
import subprocess
from typing import Optional

from ..services.reels_render_orchestrator import (
    RenderContext,
    STAGE_STYLE_GUIDE,
    register_stage_handler,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Three sample points: early / middle / late thirds of the speaker clip.
# Mid is heavily weighted (most stable framing); early/late give some
# robustness against opening/closing shots that may differ in color.
_SAMPLE_POSITIONS = (0.20, 0.50, 0.80)

# Minimum saturation + value for a pixel to count as "colorful" — OpenCV
# HSV: S/V are 0-255. 60/80 thresholds out grayish skin tones + low-light
# pixels so the accent we derive is genuinely vivid.
_MIN_SATURATION = 60
_MIN_VALUE = 80

# Minimum number of "colorful" pixels needed across the sampled frames
# before we trust the derived accent. Below this, the source is mostly
# grayscale and we fall back to the default palette.
_MIN_COLORFUL_PIXELS = 500

# Output accent saturation + value (OpenCV HSV, 0-255). Higher values
# produce a more vivid, caption-readable color regardless of source's
# own muted tones — we want to match the brightness of the Hormozi
# yellow we're replacing, not the dim wood-paneled studio it was sampled
# from.
_OUTPUT_SATURATION = 230
_OUTPUT_VALUE = 240

# Per-frame ffmpeg seek timeout. Single-frame extraction over HTTPS is
# typically <500ms; we cap at 10s so a stuck CDN doesn't stall the stage.
_FFMPEG_FRAME_TIMEOUT_S = 10


# ---------------------------------------------------------------------------
# Frame sampling — ffmpeg subprocess, no full download
# ---------------------------------------------------------------------------

def _extract_keyframe_png(source_url: str, t_seconds: float) -> Optional[bytes]:
    """Stream a single frame at `t_seconds` from `source_url` via ffmpeg
    pipe. Returns raw PNG bytes or None on any failure.

    `-ss` before `-i` does fast HTTPS-range seek; `-frames:v 1` writes
    exactly one frame; `-f image2pipe -vcodec png -` writes to stdout.
    """
    cmd = [
        "ffmpeg",
        "-hide_banner", "-loglevel", "error", "-y",
        "-ss", f"{max(0.0, t_seconds):.3f}",
        "-i", source_url,
        "-frames:v", "1",
        "-f", "image2pipe",
        "-vcodec", "png",
        "-",
    ]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=_FFMPEG_FRAME_TIMEOUT_S,
            check=False,
        )
    except subprocess.TimeoutExpired:
        logger.warning(
            f"[StyleGuide] ffmpeg frame extract timed out at t={t_seconds:.2f}s"
        )
        return None
    if result.returncode != 0 or not result.stdout:
        return None
    return result.stdout


# ---------------------------------------------------------------------------
# Color extraction — cv2 + numpy
# ---------------------------------------------------------------------------

def _try_import_color_deps():
    """Defer cv2/numpy import. Returns (cv2, np) or (None, None)."""
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
        return cv2, np
    except ImportError as e:
        logger.warning(
            f"[StyleGuide] cv2/numpy unavailable ({e}); source_derived "
            "palette will fall back to default."
        )
        return None, None


def _derive_accent_hex(frame_pngs: list[bytes]) -> Optional[str]:
    """Aggregate sampled PNG frames into a single accent hex color.

    Strategy:
      1. Decode each PNG with cv2.imdecode (handles any size — we don't
         require the frames to be uniformly sized).
      2. Convert each to HSV; mask to pixels above
         (_MIN_SATURATION, _MIN_VALUE).
      3. Concatenate masked hue arrays across frames.
      4. Take median hue (robust to outliers from background variation).
      5. Re-render at (_OUTPUT_SATURATION, _OUTPUT_VALUE) for caption
         readability.

    Returns "#RRGGBB" or None if the source has too few colorful pixels
    (mostly grayscale / very low light).
    """
    cv2, np = _try_import_color_deps()
    if cv2 is None or np is None:
        return None

    hues: list = []
    for blob in frame_pngs:
        if not blob:
            continue
        arr = np.frombuffer(blob, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            continue
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        mask = (s > _MIN_SATURATION) & (v > _MIN_VALUE)
        if not mask.any():
            continue
        hues.append(h[mask].ravel())

    if not hues:
        logger.info("[StyleGuide] no colorful pixels across sampled frames")
        return None
    all_h = np.concatenate(hues)
    if all_h.size < _MIN_COLORFUL_PIXELS:
        logger.info(
            f"[StyleGuide] only {all_h.size} colorful pixels "
            f"(< {_MIN_COLORFUL_PIXELS}); using default palette"
        )
        return None

    # Hue is circular (0-179 in OpenCV); a plain median works fine because
    # the dominant cluster typically falls inside a single 0-179 band. If
    # the dominant hue happens to straddle the wrap (e.g. reds at 0 + 179),
    # the median would pick a yellow-green midpoint instead, but that's
    # rare for podcast-style footage and the worst-case is a slightly-off
    # accent — not a broken render.
    median_h = int(np.median(all_h))
    accent_hsv = np.array(
        [[[median_h, _OUTPUT_SATURATION, _OUTPUT_VALUE]]], dtype=np.uint8
    )
    bgr = cv2.cvtColor(accent_hsv, cv2.COLOR_HSV2BGR)[0][0]
    # bgr is [B, G, R]; web hex is RGB
    return f"#{int(bgr[2]):02X}{int(bgr[1]):02X}{int(bgr[0]):02X}"


# ---------------------------------------------------------------------------
# Stage handler
# ---------------------------------------------------------------------------

def _looks_like_https_url(s: str) -> bool:
    """Cheap URL gate so we don't pipe `file:///etc/passwd`-style URLs
    into ffmpeg. Same defense-in-depth pattern as the audio service."""
    if not isinstance(s, str):
        return False
    lower = s.strip().lower()
    return lower.startswith("https://") or lower.startswith("http://")


def _palette_mode(ctx: RenderContext) -> str:
    """Read the config-driven mode, defaulting to 'default'."""
    return str((ctx.config or {}).get("palette") or "default")


def run_style_guide(ctx: RenderContext) -> None:
    """Sync handler. Reads the speaker_clip URL + palette mode from ctx,
    runs derivation when mode is `source_derived`, writes the override
    into `ctx.extra_metadata["style_palette"]`. No-op otherwise.

    Failures at any step (missing speaker_clip URL, ffmpeg error, cv2
    import failure, low colorful-pixel count) silently downgrade to the
    default palette — the override stays unwritten and the director uses
    `DEFAULT_CAPTION_PALETTE`. The user's render still ships.
    """
    mode = _palette_mode(ctx)
    if mode != "source_derived":
        ctx.extra_metadata["palette_mode"] = "default"
        return

    speaker_clip_url = (ctx.s3_urls or {}).get("speaker_clip")
    if not speaker_clip_url or not _looks_like_https_url(speaker_clip_url):
        logger.info(
            f"[StyleGuide] {ctx.reel_id} source_derived requested but "
            f"no valid speaker_clip URL; downgrading to default"
        )
        ctx.extra_metadata["palette_mode"] = "default"
        ctx.extra_metadata["palette_downgrade_reason"] = "no_speaker_clip"
        return

    duration_s = float((ctx.trim_map or {}).get("total_new_duration_s") or 0.0)
    if duration_s < 1.0:
        # Too short to sample three frames meaningfully.
        ctx.extra_metadata["palette_mode"] = "default"
        ctx.extra_metadata["palette_downgrade_reason"] = "clip_too_short"
        return

    # Sample three keyframes from the clip. Skip frames where ffmpeg
    # failed (None) but still derive from whatever we got — even one
    # frame is usable as long as we hit _MIN_COLORFUL_PIXELS.
    frames: list[bytes] = []
    for pct in _SAMPLE_POSITIONS:
        t = duration_s * pct
        png = _extract_keyframe_png(speaker_clip_url, t)
        if png:
            frames.append(png)
    if not frames:
        ctx.extra_metadata["palette_mode"] = "default"
        ctx.extra_metadata["palette_downgrade_reason"] = "no_frames"
        return

    accent_hex = _derive_accent_hex(frames)
    if not accent_hex or not re.fullmatch(r"#[0-9A-Fa-f]{6}", accent_hex):
        ctx.extra_metadata["palette_mode"] = "default"
        ctx.extra_metadata["palette_downgrade_reason"] = "no_accent"
        return

    # ONLY override the `important` accent — keep semantic colors fixed.
    # Definition (green) means "breakthrough / aha"; warning (red) means
    # "caution". Remapping those by source would lose their semantic
    # contract. Body (white) + stroke (black) stay for readability.
    ctx.extra_metadata["style_palette"] = {"important": accent_hex}
    ctx.extra_metadata["palette_mode"] = "source_derived"
    logger.info(
        f"[StyleGuide] {ctx.reel_id} derived important={accent_hex} "
        f"from {len(frames)} keyframes"
    )


async def _style_guide_stage(ctx: RenderContext) -> None:
    """Async wrapper. Offloads the blocking subprocess + cv2 work to a
    worker thread so the asyncio loop stays responsive for any concurrent
    renders running on the same process."""
    await asyncio.to_thread(run_style_guide, ctx)


register_stage_handler(STAGE_STYLE_GUIDE, _style_guide_stage)
