"""
Gate 3c — SOURCE_CLIP_BUILD stage.

Re-encodes the source video to produce the speaker clip for the reel,
using the SAME kept-span boundaries that AUDIO_EDIT used so audio + video
stay in perfect sync. Aspect-cropped (9:16 face-centered or 16:9
passthrough), no audio (audio is a separate artifact from 3b).

Implemented as a single ffmpeg invocation using `filter_complex`:
  - `-ss/-t` on input for fast HTTPS-range seek to the window
  - Per kept-span `trim` + `setpts=PTS-STARTPTS` filters
  - `concat=n=K:v=1:a=0` stitches kept spans
  - `crop=W:H:X:Y` applies aspect crop (skipped for passthrough)
  - `setpts=PTS/K` applies speed_multiplier (skipped when 1.0)
  - Encoded with libx264 + yuv420p (browser-compatible MP4)

PiP layout (alpha matte from speaker_fg.webm) is deferred — Phase 1 ships
full-bleed and lower-third only.
"""
from __future__ import annotations

import asyncio
import json
import logging
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from uuid import uuid4

import httpx

from ..repositories.ai_input_asset_repository import AiInputAssetRepository
from ..services.reels_alpha_matte_service import (
    alpha_matte_enabled,
    produce_alpha_webm,
)
from ..services.reels_audio_edit_service import _resolve_source_url
from ..services.reels_render_orchestrator import (
    RenderContext,
    STAGE_SOURCE_CLIP,
    register_stage_handler,
)
from ..services.s3_service import S3Service

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Video encoding is more expensive than audio — bump the timeout. Even a
# 90s window at 1080p completes in <30s on a modern Mac.
FFMPEG_TIMEOUT_S = 180

# libx264 settings — quality/speed/size balance for short-form delivery.
X264_PRESET = "fast"     # fast = best perf/quality compromise for our scale
X264_CRF = "23"          # 23 ≈ visually lossless to most viewers
PIX_FMT = "yuv420p"      # browser-compatible 4:2:0

# Drop kept spans shorter than this (same cross-reference as audio service's
# MIN_KEPT_SPAN_S — but for video, sub-100ms produces a sub-3-frame chunk
# at 30fps which ffmpeg's `trim` filter handles poorly).
MIN_KEPT_SPAN_S = 0.1

# Fetch budget for video_context.json — same value the router uses.
CONTEXT_FETCH_TIMEOUT_S = 20
CONTEXT_FETCH_MAX_BYTES = 10 * 1024 * 1024


# ---------------------------------------------------------------------------
# Aspect ratios + crop math
# ---------------------------------------------------------------------------

# Output aspect ratios. Values are width / height as floats — convenient for
# crop math. "1:1" is a square.
ASPECT_RATIO = {
    "9:16": 9.0 / 16.0,
    "1:1":  1.0,
    "16:9": 16.0 / 9.0,
}

# Canonical delivery resolution per aspect. The crop math above operates in
# source pixels (whatever resolution the source asset happens to be); we then
# scale to one of these standard sizes so:
#   1. `meta.dimensions` in the assembled timeline matches what platforms
#      expect (TikTok/Reels/Shorts all assume 1080×1920 for vertical),
#   2. the render worker composites overlays / captions on a full-res canvas
#      (a 720p source upsampled to 1080×1920 + sharp caption layers >>>
#      everything letterboxed to a tiny 404×720 frame),
#   3. caption font sizes computed in `vw` / `%` of frame look right.
TARGET_RESOLUTION = {
    "9:16": (1080, 1920),
    "1:1":  (1080, 1080),
    "16:9": (1920, 1080),
}


@dataclass
class _CropBox:
    """Crop region in source pixels. width/height are guaranteed even
    (libx264 + yuv420p requirement)."""
    w: int
    h: int
    x: int
    y: int

    @property
    def is_passthrough(self) -> bool:
        return self.x == 0 and self.y == 0


def _compute_crop(
    source_w: int,
    source_h: int,
    target_aspect: str,
    face_cx_norm: float,
    face_cy_norm: float,
) -> _CropBox:
    """Compute a face-centered crop region of the target aspect from a
    source of `source_w × source_h`.

    Strategy:
      - Source aspect ≥ target aspect → crop width (keep full height)
      - Source aspect < target aspect → crop height (keep full width)
      - Center the crop on the face center; clamp to image bounds.
    """
    target_ratio = ASPECT_RATIO.get(target_aspect, ASPECT_RATIO["9:16"])
    source_ratio = source_w / max(1, source_h)

    if abs(source_ratio - target_ratio) < 0.01:
        # Passthrough — already matches.
        return _CropBox(w=_even(source_w), h=_even(source_h), x=0, y=0)

    if source_ratio > target_ratio:
        # Source is wider than target → crop width.
        crop_h = source_h
        crop_w = int(round(source_h * target_ratio))
        crop_w = _even(crop_w)
        # Center crop on face_cx. Clamp to [0, source_w - crop_w].
        crop_x = int(round(source_w * face_cx_norm - crop_w / 2))
        crop_x = max(0, min(source_w - crop_w, crop_x))
        crop_y = 0
    else:
        # Source is taller than target → crop height.
        crop_w = source_w
        crop_h = int(round(source_w / target_ratio))
        crop_h = _even(crop_h)
        crop_x = 0
        crop_y = int(round(source_h * face_cy_norm - crop_h / 2))
        crop_y = max(0, min(source_h - crop_h, crop_y))

    return _CropBox(w=_even(crop_w), h=_even(crop_h), x=crop_x, y=crop_y)


def _even(n: int) -> int:
    """Round down to the nearest even integer. libx264 + yuv420p requires
    even width AND height."""
    return n - (n % 2)


# Neighborhood window for sparse-coverage face-center fallback. When the
# indexing pipeline only densely samples face_segments inside the
# LLM-picked highlight, a reel cut from an adjacent non-highlight window
# may have <30% in-window coverage. Pulling in segments within ±NEIGHBOR_S
# of the window edges restores a stable static center for those cases
# (production audit 2026-05-13, reel-9ad0255f2bb6).
_FACE_CENTER_NEIGHBOR_S = 5.0
_FACE_CENTER_NEIGHBOR_WEIGHT = 0.25


def _compute_face_center(
    face_segments: list[dict],
    win_t_start: float,
    win_t_end: float,
) -> tuple[float, float]:
    """Average face-bbox center across segments overlapping the window,
    weighted by overlap duration. Falls back to image center (0.5, 0.5)
    if no face data is available.

    For sparse-coverage windows (indexing pipeline only densely sampled
    the highlight), also pulls in segments within ±5s of the window edges
    at reduced weight, so the static center remains anchored on the
    speaker even when in-window coverage is thin.
    """
    if not face_segments:
        return 0.5, 0.5

    total_w = 0.0
    sum_cx = 0.0
    sum_cy = 0.0
    nbr_start = win_t_start - _FACE_CENTER_NEIGHBOR_S
    nbr_end = win_t_end + _FACE_CENTER_NEIGHBOR_S
    for seg in face_segments:
        try:
            ss = float(seg.get("t_start") or 0.0)
            se = float(seg.get("t_end") or 0.0)
        except (TypeError, ValueError):
            continue
        bbox = seg.get("bbox_norm") or [0.5, 0.5, 0.0, 0.0]
        if len(bbox) < 4:
            continue
        try:
            cx = float(bbox[0]) + float(bbox[2]) / 2.0
            cy = float(bbox[1]) + float(bbox[3]) / 2.0
        except (TypeError, ValueError):
            continue
        # Full-weight overlap with window
        ov_start = max(ss, win_t_start)
        ov_end = min(se, win_t_end)
        overlap = max(0.0, ov_end - ov_start)
        if overlap > 0:
            sum_cx += cx * overlap
            sum_cy += cy * overlap
            total_w += overlap
            continue
        # Reduced-weight overlap with neighborhood (segment lies outside
        # window but within ±NEIGHBOR_S — useful when in-window coverage
        # is sparse).
        nbr_ov_start = max(ss, nbr_start)
        nbr_ov_end = min(se, nbr_end)
        nbr_overlap = max(0.0, nbr_ov_end - nbr_ov_start)
        if nbr_overlap > 0:
            w = nbr_overlap * _FACE_CENTER_NEIGHBOR_WEIGHT
            sum_cx += cx * w
            sum_cy += cy * w
            total_w += w

    if total_w <= 0:
        return 0.5, 0.5
    return sum_cx / total_w, sum_cy / total_w


# ---------------------------------------------------------------------------
# Time-varying crop trajectory
#
# Phase 1 used a single static crop center (overlap-weighted average across
# face_segments). On windows where the speaker moves — leans forward,
# gestures, switches sides — the static crop drifts off-center because the
# box never follows them.
#
# The trajectory approach emits one keyframe per face_segment that overlaps
# the window, at the segment's midpoint, and feeds them to ffmpeg's `crop`
# filter as **expressions** that interpolate linearly between keyframes.
# Smoothing is implicit (linear interp between segment centers); when the
# face is stationary, consecutive keyframes carry the same coords and the
# expression degenerates to a constant.
#
# Falls back to the Phase-1 static crop when face data is sparse (≤1
# segment in window) — single static crop is more stable than a one-point
# trajectory.
# ---------------------------------------------------------------------------

# Don't emit a keyframe for source-time movements smaller than this in
# either axis. Sub-pixel jitter looks worse than a stable center.
TRAJECTORY_MIN_MOVE_NORM = 0.01    # 1% of frame dimension

# Cap the number of keyframes to keep the ffmpeg expression manageable.
# Real face_segments rarely exceed ~30 over a 60s window; this is a
# safety valve for pathological inputs.
TRAJECTORY_MAX_KEYFRAMES = 24

# Minimum fraction of the window covered by face_segments before we trust
# the trajectory. Below this, gaps between keyframes are large enough
# that linear interpolation drifts off the speaker (audit issue #6).
# Falls back to the (now neighborhood-aware) static crop.
TRAJECTORY_MIN_COVERAGE = 0.5


def _source_to_crop_time(t_source: float, trim_map: dict) -> Optional[float]:
    """Translate a source-video timestamp to the time INSIDE the crop filter
    (post-trim+concat, **pre**-atempo). Returns None if `t_source` falls
    outside every kept span.

    Crop runs BEFORE the `setpts=PTS/speed` step in the filter chain, so the
    `t` variable in crop expressions is window-relative pre-atempo time.
    That's `sum(kept_span_orig_durations) + offset_into_current_span`.
    """
    spans = trim_map.get("spans") or []
    running_pre_atempo = 0.0
    for s in spans:
        try:
            os_ = float(s["orig_t_start"])
            oe = float(s["orig_t_end"])
        except (KeyError, TypeError, ValueError):
            continue
        if oe <= os_:
            continue
        if os_ <= t_source <= oe:
            return running_pre_atempo + (t_source - os_)
        running_pre_atempo += (oe - os_)
    return None


def _build_crop_trajectory(
    face_segments: list[dict],
    win_t_start: float,
    win_t_end: float,
    trim_map: dict,
) -> list[tuple[float, float, float]]:
    """Build a list of keyframes `(crop_t, cx_norm, cy_norm)` from
    `face_segments` overlapping the window.

    One keyframe per segment, placed at the segment's mid-point inside the
    window (clipped to the window edges). `crop_t` is in the crop filter's
    own time coordinate (post-trim+concat pre-atempo). Adjacent keyframes
    that differ by less than `TRAJECTORY_MIN_MOVE_NORM` in both axes get
    merged — silent stretches with no movement collapse to constants.

    Returns an empty list if there's no usable face data — caller falls
    back to the static crop. Returns a 1-element list if the entire window
    is covered by a single segment — caller can still use it as a static
    crop with no expression cost.
    """
    if not face_segments:
        return []

    win_duration = max(1e-6, win_t_end - win_t_start)
    raw: list[tuple[float, float, float]] = []
    total_overlap = 0.0
    for seg in face_segments:
        try:
            ss = float(seg.get("t_start") or 0.0)
            se = float(seg.get("t_end") or 0.0)
        except (TypeError, ValueError):
            continue
        ov_start = max(ss, win_t_start)
        ov_end = min(se, win_t_end)
        if ov_end <= ov_start:
            continue
        bbox = seg.get("bbox_norm") or [0.5, 0.5, 0.0, 0.0]
        if len(bbox) < 4:
            continue
        try:
            cx = float(bbox[0]) + float(bbox[2]) / 2.0
            cy = float(bbox[1]) + float(bbox[3]) / 2.0
        except (TypeError, ValueError):
            continue
        mid_source = (ov_start + ov_end) / 2.0
        crop_t = _source_to_crop_time(mid_source, trim_map)
        if crop_t is None:
            continue
        raw.append((crop_t, max(0.0, min(1.0, cx)), max(0.0, min(1.0, cy))))
        total_overlap += (ov_end - ov_start)

    if not raw:
        return []

    # Sparse coverage → trajectory will interpolate over big gaps and
    # drift off the speaker. Prefer the (neighborhood-aware) static crop.
    coverage = total_overlap / win_duration
    if coverage < TRAJECTORY_MIN_COVERAGE:
        return []

    raw.sort(key=lambda k: k[0])

    # Merge sub-threshold consecutive keyframes — keep the earliest of a run.
    smoothed: list[tuple[float, float, float]] = [raw[0]]
    for t, cx, cy in raw[1:]:
        _, last_cx, last_cy = smoothed[-1]
        if (abs(cx - last_cx) < TRAJECTORY_MIN_MOVE_NORM
                and abs(cy - last_cy) < TRAJECTORY_MIN_MOVE_NORM):
            continue
        smoothed.append((t, cx, cy))

    # Hard cap — keep evenly-spaced keyframes if we somehow blew past the
    # safety limit. Real input never trips this; defensive.
    if len(smoothed) > TRAJECTORY_MAX_KEYFRAMES:
        step = len(smoothed) / TRAJECTORY_MAX_KEYFRAMES
        smoothed = [smoothed[int(i * step)] for i in range(TRAJECTORY_MAX_KEYFRAMES)]

    return smoothed


def _crop_pos_from_norm(
    center_norm: float,
    source_dim: int,
    crop_dim: int,
) -> float:
    """Convert a normalized face center (0..1 of source dimension) to a
    crop-position value (top-left of the crop box, in source pixels),
    clamped so the box stays inside the source frame."""
    center_px = source_dim * center_norm - crop_dim / 2.0
    return max(0.0, min(float(source_dim - crop_dim), center_px))


def _build_crop_pos_expr(
    keyframes: list[tuple[float, float, float]],
    axis: str,            # "x" or "y"
    source_dim: int,
    crop_dim: int,
) -> str:
    """Generate an ffmpeg expression for the crop x or y position that
    linearly interpolates between trajectory keyframes.

    Form, for keyframes (t0,p0), (t1,p1), (t2,p2), ..., (tN,pN):

        if(lt(t,t1), p0+(p1-p0)*(t-t0)/(t1-t0),
        if(lt(t,t2), p1+(p2-p1)*(t-t1)/(t2-t1),
        ...
        pN))

    Before the first keyframe the expression returns p0 (held constant);
    after the last it holds pN. That avoids extrapolating outside the
    sampled range, which could push the crop out of the source frame at
    the very start/end of the clip.

    The expression value is in source pixels — it goes straight into
    `crop=W:H:x=<expr>:y=<expr>`. Result is single-quoted by the caller so
    the embedded commas + colons survive ffmpeg's filter-graph parser.
    """
    if not keyframes:
        return "0"
    axis_idx = 1 if axis == "x" else 2

    def pos_at(kf: tuple[float, float, float]) -> float:
        return _crop_pos_from_norm(kf[axis_idx], source_dim, crop_dim)

    if len(keyframes) == 1:
        return f"{pos_at(keyframes[0]):.2f}"

    # Build the chain from the tail inward so the innermost `else` is the
    # last keyframe's value and each outer `if` clamps "below this t,
    # interpolate the prev segment".
    expr = f"{pos_at(keyframes[-1]):.2f}"
    for i in range(len(keyframes) - 1, 0, -1):
        t0, _, _ = keyframes[i - 1]
        t1, _, _ = keyframes[i]
        p0 = pos_at(keyframes[i - 1])
        p1 = pos_at(keyframes[i])
        # Guard against zero/negative interval — emit constant.
        dt = max(1e-6, t1 - t0)
        delta = p1 - p0
        interp = f"{p0:.2f}+({delta:.2f})*(t-{t0:.4f})/{dt:.4f}"
        expr = f"if(lt(t,{t1:.4f}),{interp},{expr})"
    # Hold p0 before the first keyframe.
    t_first = keyframes[0][0]
    if t_first > 0.0:
        p_first = pos_at(keyframes[0])
        expr = f"if(lt(t,{t_first:.4f}),{p_first:.2f},{expr})"
    return expr


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class ReelsSourceClipService:
    """Runs the SOURCE_CLIP_BUILD stage."""

    def __init__(self, s3: Optional[S3Service] = None):
        self._s3 = s3
        self._ffmpeg = shutil.which("ffmpeg") or "ffmpeg"

    def _ensure_s3(self) -> S3Service:
        if self._s3 is None:
            self._s3 = S3Service()
        return self._s3

    def run(self, ctx: RenderContext) -> None:
        """Execute SOURCE_CLIP on the given render context. Writes
        `ctx.s3_urls['speaker_clip']`. Raises on any error — orchestrator
        catches and writes FAILED.

        Sync method — ffmpeg + boto3 both block. The async wrapper offloads
        to a thread so the asyncio loop stays responsive.
        """
        # 1. Resolve source asset + URL.
        asset_repo = AiInputAssetRepository()
        asset = asset_repo.get_by_id(ctx.input_asset_id)
        if asset is None:
            raise RuntimeError(f"Source asset {ctx.input_asset_id} not found")
        source_url = _resolve_source_url(asset)
        if not source_url:
            raise RuntimeError(
                f"Source asset {ctx.input_asset_id} has no usable source URL"
            )

        # 2. Resolve window + trim_map (set by AUDIO_EDIT in 3b).
        win_t_start = float(ctx.source_window.get("t_start", 0.0))
        win_t_end = float(ctx.source_window.get("t_end", 0.0))
        if win_t_end <= win_t_start:
            raise RuntimeError(f"Invalid source window: {win_t_start} → {win_t_end}")

        if not ctx.trim_map or not ctx.trim_map.get("spans"):
            raise RuntimeError(
                "trim_map not set — AUDIO_EDIT must run before SOURCE_CLIP "
                "to define kept-span boundaries"
            )
        # Use the SAME kept-span boundaries that AUDIO_EDIT used. Re-derive
        # window-relative timestamps from the trim_map's orig_t_* values.
        kept_spans_relative: list[tuple[float, float]] = []
        for s in ctx.trim_map["spans"]:
            ts = float(s["orig_t_start"]) - win_t_start
            te = float(s["orig_t_end"]) - win_t_start
            if te - ts >= MIN_KEPT_SPAN_S:
                kept_spans_relative.append((ts, te))
        if not kept_spans_relative:
            raise RuntimeError("All kept spans were sub-MIN_KEPT_SPAN_S after trim_map mapping")

        speed = float(ctx.trim_map.get("speed_multiplier") or 1.0)
        speed = max(1.0, min(1.5, speed))

        # 3. Resolve aspect (default 9:16) + crop region.
        aspect = (ctx.config or {}).get("aspect", "9:16")
        if aspect not in ASPECT_RATIO:
            logger.warning(f"[SourceClip] unknown aspect {aspect!r}; defaulting to 9:16")
            aspect = "9:16"

        # Source resolution + face_segments come from video_context.json.
        # We fetch on-demand here rather than passing through ctx — keeps
        # the orchestrator clean and the fetch is cheap (~60KB, ~200ms).
        context = self._fetch_context_json(asset.context_json_url)
        source_resolution = (context.get("meta") or {}).get("resolution") or [1280, 720]
        source_w = int(source_resolution[0])
        source_h = int(source_resolution[1])
        face_segments = context.get("face_segments") or []

        # Static crop center is used for sizing the crop box (size is FIXED
        # for the whole reel — only position varies over time). Centered on
        # the overlap-weighted face position so the BOX shape never goes
        # off-source even if a keyframe pushes it to an edge.
        face_cx, face_cy = _compute_face_center(face_segments, win_t_start, win_t_end)
        crop = _compute_crop(source_w, source_h, aspect, face_cx, face_cy)

        # Build the per-segment trajectory. If we end up with <2 keyframes
        # (one segment in window, or none) the box stays static — matches
        # Phase-1 behavior and saves ffmpeg from parsing a trivial
        # expression. With ≥2 keyframes, ffmpeg's crop x/y become piecewise-
        # linear expressions of the filter's `t` variable.
        trajectory = _build_crop_trajectory(
            face_segments,
            win_t_start=win_t_start,
            win_t_end=win_t_end,
            trim_map=ctx.trim_map or {"spans": [{
                "orig_t_start": win_t_start,
                "orig_t_end": win_t_end,
            }]},
        )

        # Canonical delivery dims for the aspect — speaker_clip is scaled up
        # to this so meta.dimensions matches platform expectations and the
        # render worker has a full-res canvas (see TARGET_RESOLUTION comment).
        target_w, target_h = TARGET_RESOLUTION.get(aspect, TARGET_RESOLUTION["9:16"])

        logger.info(
            f"[SourceClip] {ctx.reel_id} {source_w}x{source_h} → crop "
            f"{crop.w}x{crop.h} at static ({crop.x},{crop.y}) → scale "
            f"{target_w}x{target_h}, face_center=({face_cx:.2f},{face_cy:.2f}), "
            f"spans={len(kept_spans_relative)}, speed={speed}, "
            f"trajectory_keyframes={len(trajectory)}"
        )

        # 4. Run ffmpeg.
        with tempfile.TemporaryDirectory(prefix="reels-clip-") as tmpdir:
            out_path = Path(tmpdir) / f"{ctx.reel_id}.mp4"
            self._run_ffmpeg(
                source_url=source_url,
                win_t_start=win_t_start,
                win_duration=win_t_end - win_t_start,
                kept_spans_relative=kept_spans_relative,
                speed=speed,
                crop=crop,
                source_w=source_w,
                source_h=source_h,
                target_w=target_w,
                target_h=target_h,
                trajectory=trajectory,
                out_path=out_path,
            )

            if not out_path.exists() or out_path.stat().st_size == 0:
                raise RuntimeError("ffmpeg produced no video output")

            # 5. Upload.
            s3 = self._ensure_s3()
            s3_key = f"ai-reels/{ctx.reel_id}/speaker_clip-{uuid4().hex[:8]}.mp4"
            url = s3.upload_file(out_path, s3_key=s3_key, content_type="video/mp4")

            # 5b. Alpha-matte cutout for PiP layouts (Phase 2d). Runs ONLY
            # when the user picked `pip_corner_speaker` — matting adds
            # ~20s to the stage, so we don't pay the cost for layouts
            # that don't render an alpha cutout. The matter consumes the
            # local speaker_clip.mp4 (still in the tempdir at this point)
            # and produces speaker_fg.webm; we upload that too. If
            # matting fails (deps missing, model load fail, env disabled),
            # the result is None and the director silently falls back to
            # the existing rectangular PiP HTML.
            requested_layout = str(
                (ctx.config or {}).get("layout") or "full_speaker_with_overlays"
            )
            if requested_layout == "pip_corner_speaker" and alpha_matte_enabled():
                fg_path = out_path.parent / f"{ctx.reel_id}_fg.webm"
                fg_result = produce_alpha_webm(out_path, fg_path)
                if fg_result is not None:
                    fg_key = (
                        f"ai-reels/{ctx.reel_id}/speaker_fg-{uuid4().hex[:8]}.webm"
                    )
                    fg_url = s3.upload_file(
                        fg_result, s3_key=fg_key, content_type="video/webm"
                    )
                    ctx.s3_urls["speaker_fg"] = fg_url
                    ctx.extra_metadata["alpha_matte"] = "selfie_seg"
                    logger.info(
                        f"[SourceClip] {ctx.reel_id} alpha matte uploaded "
                        f"→ {fg_url[:80]}…"
                    )
                else:
                    # Matter returned None — log the fallback path so audit
                    # can tell whether we shipped alpha or rectangular PiP.
                    ctx.extra_metadata["alpha_matte"] = "skipped"
                    logger.info(
                        f"[SourceClip] {ctx.reel_id} alpha matte produced "
                        "no output — PiP layout will render rectangular"
                    )

        # 6. Write back.
        ctx.s3_urls["speaker_clip"] = url
        # `output_resolution` is the **delivery** resolution (post-scale), not
        # the source-pixel crop. DIRECTOR uses this to set the canvas in the
        # assembled timeline; ASSEMBLE forwards it to meta.dimensions. The
        # raw crop dims (`crop.w × crop.h`) are kept for debugging only.
        ctx.extra_metadata["output_resolution"] = {"width": target_w, "height": target_h}
        ctx.extra_metadata["source_crop"] = {
            "w": crop.w, "h": crop.h, "x": crop.x, "y": crop.y,
        }
        ctx.extra_metadata["output_aspect"] = aspect

    # ── Helpers ───────────────────────────────────────────────────────────

    def _fetch_context_json(self, context_url: Optional[str]) -> dict:
        """Fetch video_context.json with the same size cap as the router."""
        if not context_url:
            raise RuntimeError(
                "Source asset has no context_json_url — cannot determine crop"
            )
        try:
            with httpx.Client(timeout=CONTEXT_FETCH_TIMEOUT_S) as client:
                with client.stream("GET", context_url) as resp:
                    resp.raise_for_status()
                    declared = resp.headers.get("content-length")
                    if declared and declared.isdigit() and int(declared) > CONTEXT_FETCH_MAX_BYTES:
                        raise RuntimeError(
                            f"context.json too large ({int(declared)} > {CONTEXT_FETCH_MAX_BYTES})"
                        )
                    buf = bytearray()
                    for chunk in resp.iter_bytes(chunk_size=65536):
                        buf.extend(chunk)
                        if len(buf) > CONTEXT_FETCH_MAX_BYTES:
                            raise RuntimeError("context.json exceeded cap during stream")
                    return json.loads(bytes(buf))
        except httpx.HTTPError as e:
            raise RuntimeError(f"context.json fetch failed: {e}")
        except json.JSONDecodeError as e:
            raise RuntimeError(f"context.json malformed: {e}")

    def _run_ffmpeg(
        self,
        *,
        source_url: str,
        win_t_start: float,
        win_duration: float,
        kept_spans_relative: list[tuple[float, float]],
        speed: float,
        crop: _CropBox,
        source_w: int,
        source_h: int,
        target_w: int,
        target_h: int,
        trajectory: list[tuple[float, float, float]],
        out_path: Path,
    ) -> None:
        """Single ffmpeg invocation. Filter graph shape:

          [0:v]trim=...,setpts=PTS-STARTPTS[v0]
          [0:v]trim=...,setpts=PTS-STARTPTS[v1]
          ...
          [v0][v1]...concat=n=N:v=1:a=0[vc]   (skipped if N==1)
          [vc]crop=W:H:X:Y[vcrop]             (skipped for passthrough)
          [vcrop]scale=tw:th:flags=lanczos[vscale]  (skipped when crop==target)
          [vscale]setpts=PTS/K[vout]          (skipped when speed==1.0)

        When `trajectory` has ≥2 keyframes, the crop X and Y become piecewise-
        linear expressions of the filter's `t` variable so the box follows
        the speaker. With ≤1 keyframe we use the static crop.x / crop.y.
        """
        filter_lines: list[str] = []
        span_labels: list[str] = []
        for i, (ts, te) in enumerate(kept_spans_relative):
            label = f"v{i}"
            span_labels.append(f"[{label}]")
            filter_lines.append(
                f"[0:v]trim=start={ts:.4f}:end={te:.4f},setpts=PTS-STARTPTS[{label}]"
            )

        # Concat (only when >1 span).
        if len(span_labels) == 1:
            concat_out = span_labels[0]
        else:
            concat_out = "[vc]"
            filter_lines.append(
                f"{''.join(span_labels)}concat=n={len(span_labels)}:v=1:a=0{concat_out}"
            )

        # Crop — skip when crop region == source dimensions (passthrough).
        if crop.is_passthrough and crop.w == source_w and crop.h == source_h:
            cropped_label = concat_out
        else:
            cropped_label = "[vcrop]"
            # Resolve x and y. Multi-keyframe trajectory → expressions
            # tracking the face. Otherwise → static values from `crop`.
            if len(trajectory) >= 2:
                x_val = _build_crop_pos_expr(trajectory, "x", source_w, crop.w)
                y_val = _build_crop_pos_expr(trajectory, "y", source_h, crop.h)
                # Single-quote the expressions so embedded commas don't get
                # consumed by ffmpeg's filter-arg splitter. exprs only use
                # printable ASCII, no nested quotes.
                x_arg = f"'{x_val}'"
                y_arg = f"'{y_val}'"
            else:
                x_arg = str(crop.x)
                y_arg = str(crop.y)
            filter_lines.append(
                f"{concat_out}crop={crop.w}:{crop.h}:{x_arg}:{y_arg}{cropped_label}"
            )

        # Scale crop pixels up (or down) to the canonical delivery size.
        # Skip the noop case where crop already matches target. lanczos gives
        # the cleanest upsample of speaker faces — bicubic blurs hair/eyes.
        if crop.w == target_w and crop.h == target_h:
            scaled_label = cropped_label
        else:
            scaled_label = "[vscale]"
            filter_lines.append(
                f"{cropped_label}scale={target_w}:{target_h}:flags=lanczos{scaled_label}"
            )

        # Speed via setpts. PTS/K speeds up by factor K.
        if abs(speed - 1.0) < 1e-6:
            final_label = scaled_label
        else:
            filter_lines.append(f"{scaled_label}setpts=PTS/{speed:.4f}[vout]")
            final_label = "[vout]"

        filter_complex = ";".join(filter_lines)

        cmd = [
            self._ffmpeg,
            "-hide_banner", "-loglevel", "error", "-y",
            "-ss", f"{max(0.0, win_t_start):.3f}",
            "-t", f"{max(0.0, win_duration):.3f}",
            "-i", source_url,
            "-filter_complex", filter_complex,
            "-map", final_label,
            "-an",                              # no audio — comes from 3b separately
            "-c:v", "libx264",
            "-preset", X264_PRESET,
            "-crf", X264_CRF,
            "-pix_fmt", PIX_FMT,
            "-movflags", "+faststart",          # web-streaming friendly mp4
            str(out_path),
        ]

        try:
            subprocess.run(
                cmd, check=True, capture_output=True, timeout=FFMPEG_TIMEOUT_S
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError(
                f"SOURCE_CLIP ffmpeg timed out after {FFMPEG_TIMEOUT_S}s"
            )
        except subprocess.CalledProcessError as e:
            stderr = (e.stderr or b"").decode("utf-8", errors="replace")[:500]
            raise RuntimeError(f"SOURCE_CLIP ffmpeg failed: {stderr}")


# ---------------------------------------------------------------------------
# Stage registration
# ---------------------------------------------------------------------------

async def _source_clip_stage(ctx: RenderContext) -> None:
    """Async handler — offloads the blocking ffmpeg + S3 work to a thread."""
    svc = ReelsSourceClipService()
    await asyncio.to_thread(svc.run, ctx)


register_stage_handler(STAGE_SOURCE_CLIP, _source_clip_stage)
