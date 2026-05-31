"""
Studio render-to-MP4 — submit a built timeline to the render worker + poll.

Mirrors reels_render_finalize_service (submit + poll, no callback endpoint).
The wrinkle: Studio has no TTS narration. Audio is the source clips' own
audio, captured by the worker from the unmuted <video> elements. But the
worker REQUIRES an `audio_url` (master narration), so we generate a SILENT
MP3 of the timeline duration and pass it — the final mix is then just the
source-clip audio over silence.

⚠️ STAGING-VERIFICATION-NEEDED: the ffmpeg silence generation + render-worker
submit/poll can't run in dev (no ffmpeg invocation + no worker here). The shape
mirrors the proven reels finalize path; verify end-to-end on staging.

Flow:
  1. Fetch the build's timeline.json → meta.source_video_urls + total_duration + dims.
  2. ffmpeg anullsrc → silent.mp3 (total_duration) → upload to S3.
  3. RenderService.submit(timeline_url, audio_url=silent, source_video_urls, w/h/fps).
  4. Background poll → on completed, build.update_on_render(video_url) → RENDERED.
"""
from __future__ import annotations

import asyncio
import json
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import httpx

from ..config import get_settings
from ..models.ai_studio_build import AiStudioBuild
from ..repositories.ai_studio_build_repository import AiStudioBuildRepository
from ..schemas.studio_projects import StudioRenderRequest
from .render_service import RenderService
from .s3_service import S3Service

logger = logging.getLogger(__name__)

_FETCH_TIMEOUT_S = 20.0
_POLL_INTERVAL_S = 10.0
_POLL_MAX_TRIES = 180  # 30 min ceiling, like the editor render poll
_CAPTION_SIZE_PX = {"S": 36, "M": 48, "L": 64}
_RESOLUTION_MAP = {
    ("720p", "landscape"): (1280, 720),
    ("720p", "portrait"): (720, 1280),
    ("720p", "square"): (720, 720),
    ("1080p", "landscape"): (1920, 1080),
    ("1080p", "portrait"): (1080, 1920),
    ("1080p", "square"): (1080, 1080),
}


def _fetch_timeline(url: str) -> dict:
    with httpx.Client(timeout=_FETCH_TIMEOUT_S) as client:
        resp = client.get(url, headers={"User-Agent": "VacademyStudio/1.0"})
        resp.raise_for_status()
        return resp.json()


def _orientation(width: int, height: int) -> str:
    if width == height:
        return "square"
    return "portrait" if height > width else "landscape"


def _resolve_dims(meta: dict, resolution: Optional[str]) -> Tuple[int, int]:
    dims = (meta or {}).get("dimensions") or {}
    base_w = int(dims.get("width", 1920))
    base_h = int(dims.get("height", 1080))
    orient = _orientation(base_w, base_h)
    mapped = _RESOLUTION_MAP.get((resolution or "1080p", orient))
    return mapped or (base_w, base_h)


def _make_silent_mp3(duration_s: float, out_path: Path) -> None:
    """Generate a silent stereo MP3 of `duration_s` via ffmpeg anullsrc."""
    ffmpeg = shutil.which("ffmpeg") or "ffmpeg"
    dur = max(0.1, float(duration_s))
    cmd = [
        ffmpeg, "-y", "-f", "lavfi",
        "-i", "anullsrc=r=44100:cl=stereo",
        "-t", f"{dur:.3f}", "-q:a", "9", "-acodec", "libmp3lame",
        str(out_path),
    ]
    proc = subprocess.run(cmd, capture_output=True, timeout=120)
    if proc.returncode != 0 or not out_path.exists():
        raise RuntimeError(
            f"silent-audio ffmpeg failed (rc={proc.returncode}): "
            f"{proc.stderr.decode('utf-8', 'ignore')[:300]}"
        )


def _prepare_and_submit(build: AiStudioBuild, body: StudioRenderRequest) -> str:
    """Sync worker: fetch timeline, gen silent audio, upload, submit. Returns job_id."""
    settings = get_settings()
    if not settings.render_server_url:
        raise RuntimeError("render server not configured (RENDER_SERVER_URL unset)")

    timeline_url = (build.s3_urls or {}).get("timeline")
    if not timeline_url:
        raise RuntimeError("build has no timeline URL")

    timeline = _fetch_timeline(timeline_url)
    meta = timeline.get("meta") or {}
    source_video_urls = meta.get("source_video_urls") or []
    total_duration = float(meta.get("total_duration") or 0) or 1.0
    width, height = _resolve_dims(meta, body.resolution)

    # Silent master narration (the worker requires audio_url; source-clip audio
    # rides the browser-captured channel).
    with tempfile.TemporaryDirectory(prefix="studio-render-") as tmp:
        silent = Path(tmp) / "silent.mp3"
        _make_silent_mp3(total_duration, silent)
        audio_url = S3Service().upload_file(
            silent,
            s3_key=f"ai-studio/{build.id}/silent_narration.mp3",
            content_type="audio/mpeg",
        )

    rs = RenderService(settings.render_server_url, settings.render_server_key)
    caption_font_size = _CAPTION_SIZE_PX.get(body.caption_size) if body.caption_size else None
    job_id = rs.submit(
        video_id=str(build.id),
        timeline_url=timeline_url,
        audio_url=audio_url,
        source_video_urls=source_video_urls or None,
        callback_url=None,  # we poll, like reels
        show_captions=bool(body.show_captions),
        show_branding=bool(body.show_branding),
        width=width,
        height=height,
        fps=body.fps,
        caption_position=body.caption_position,
        caption_text_color=body.caption_text_color,
        caption_bg_color=body.caption_bg_color,
        caption_bg_opacity=body.caption_bg_opacity,
        caption_font_size=caption_font_size,
        caption_style=body.caption_style,
        caption_font_family=body.caption_font_family,
        caption_font_weight=body.caption_font_weight,
        caption_text_stroke_width=body.caption_text_stroke_width,
        caption_text_stroke_color=body.caption_text_stroke_color,
        caption_highlight_color=body.caption_highlight_color,
    )
    return job_id


async def _poll_until_done(build_id: str, job_id: str) -> None:
    """Background poll: update the build to RENDERED with the MP4 URL on
    success, or record the error on failure."""
    settings = get_settings()
    rs = RenderService(settings.render_server_url, settings.render_server_key)
    repo = AiStudioBuildRepository()
    for _ in range(_POLL_MAX_TRIES):
        await asyncio.sleep(_POLL_INTERVAL_S)
        try:
            status: Dict[str, Any] = await asyncio.to_thread(rs.check_status, job_id)
        except Exception as e:
            logger.warning(f"[StudioRender] {build_id} poll error: {e}")
            continue
        state = (status.get("status") or "").lower()
        if state in ("completed", "complete", "done", "success"):
            video_url = status.get("video_url") or status.get("output_url")
            if video_url:
                repo.update_on_render(build_id, video_url=video_url,
                                      extra_metadata={"render_job_id": job_id})
                logger.info(f"[StudioRender] {build_id} RENDERED → {video_url}")
            return
        if state in ("failed", "error"):
            repo.update_stage(build_id, status="FAILED",
                              error_message=f"[RENDER] {status.get('error', 'render failed')}"[:500])
            logger.warning(f"[StudioRender] {build_id} render FAILED")
            return
    logger.warning(f"[StudioRender] {build_id} render poll timed out after {_POLL_MAX_TRIES} tries")


_PENDING_RENDER_POLLS: set = set()


async def submit_studio_render(build: AiStudioBuild, body: StudioRenderRequest) -> str:
    """Submit the render (off-loop) + kick off the background poll. Returns job_id."""
    job_id = await asyncio.to_thread(_prepare_and_submit, build, body)
    task = asyncio.create_task(_poll_until_done(str(build.id), job_id))
    _PENDING_RENDER_POLLS.add(task)
    task.add_done_callback(_PENDING_RENDER_POLLS.discard)
    return job_id
