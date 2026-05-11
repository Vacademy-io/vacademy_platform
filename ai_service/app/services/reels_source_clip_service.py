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


def _compute_face_center(
    face_segments: list[dict],
    win_t_start: float,
    win_t_end: float,
) -> tuple[float, float]:
    """Average face-bbox center across segments overlapping the window,
    weighted by overlap duration. Falls back to image center (0.5, 0.5)
    if no face data is available.

    A static center for the entire clip (vs time-varying crop) is the
    Phase-1 simplification — produces a stable, predictable frame.
    Time-varying crop is a polish item for later (Ken Burns on long
    speaker-moves windows).
    """
    if not face_segments:
        return 0.5, 0.5

    total_overlap = 0.0
    sum_cx = 0.0
    sum_cy = 0.0
    for seg in face_segments:
        ss = float(seg.get("t_start") or 0.0)
        se = float(seg.get("t_end") or 0.0)
        # Overlap with the window.
        ov_start = max(ss, win_t_start)
        ov_end = min(se, win_t_end)
        overlap = max(0.0, ov_end - ov_start)
        if overlap <= 0:
            continue
        bbox = seg.get("bbox_norm") or [0.5, 0.5, 0.0, 0.0]
        if len(bbox) < 4:
            continue
        cx = float(bbox[0]) + float(bbox[2]) / 2.0
        cy = float(bbox[1]) + float(bbox[3]) / 2.0
        sum_cx += cx * overlap
        sum_cy += cy * overlap
        total_overlap += overlap

    if total_overlap <= 0:
        return 0.5, 0.5
    return sum_cx / total_overlap, sum_cy / total_overlap


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
        face_cx, face_cy = _compute_face_center(face_segments, win_t_start, win_t_end)
        crop = _compute_crop(source_w, source_h, aspect, face_cx, face_cy)

        logger.info(
            f"[SourceClip] {ctx.reel_id} {source_w}x{source_h} → {crop.w}x{crop.h} "
            f"at ({crop.x},{crop.y}), face_center=({face_cx:.2f},{face_cy:.2f}), "
            f"spans={len(kept_spans_relative)}, speed={speed}"
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
                out_path=out_path,
            )

            if not out_path.exists() or out_path.stat().st_size == 0:
                raise RuntimeError("ffmpeg produced no video output")

            # 5. Upload.
            s3 = self._ensure_s3()
            s3_key = f"ai-reels/{ctx.reel_id}/speaker_clip-{uuid4().hex[:8]}.mp4"
            url = s3.upload_file(out_path, s3_key=s3_key, content_type="video/mp4")

        # 6. Write back.
        ctx.s3_urls["speaker_clip"] = url
        # Track the output dimensions on the metadata so DIRECTOR + HTML
        # stages know the final reel dimensions without re-parsing.
        ctx.extra_metadata["output_resolution"] = {"width": crop.w, "height": crop.h}
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
        out_path: Path,
    ) -> None:
        """Single ffmpeg invocation. Filter graph shape:

          [0:v]trim=...,setpts=PTS-STARTPTS[v0]
          [0:v]trim=...,setpts=PTS-STARTPTS[v1]
          ...
          [v0][v1]...concat=n=N:v=1:a=0[vc]   (skipped if N==1)
          [vc]crop=W:H:X:Y[vcrop]             (skipped for passthrough)
          [vcrop]setpts=PTS/K[vout]           (skipped when speed==1.0)
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

        # Crop — skip when output dimensions match source (passthrough).
        if crop.is_passthrough and crop.w == source_w and crop.h == source_h:
            cropped_label = concat_out
        else:
            cropped_label = "[vcrop]"
            filter_lines.append(
                f"{concat_out}crop={crop.w}:{crop.h}:{crop.x}:{crop.y}{cropped_label}"
            )

        # Speed via setpts. PTS/K speeds up by factor K.
        if abs(speed - 1.0) < 1e-6:
            final_label = cropped_label
        else:
            filter_lines.append(f"{cropped_label}setpts=PTS/{speed:.4f}[vout]")
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
