"""
Studio render-to-MP4 — submit a built timeline to the render worker + poll.

Mirrors reels_render_finalize_service (submit + poll, no callback endpoint).
Audio: the worker REQUIRES an `audio_url` (master narration) and it never
extracts SOURCE_CLIP audio (compositing is pixels-only — the unmuted <video>
in the entry HTML is audible only in the editor). P7's ASSEMBLE_AUDIO stage
therefore bakes the real soundtrack at build time (`s3_urls.audio`,
master_audio.mp3 on the composed clock) and we pass THAT. The silent-MP3
fallback remains only for image-only builds and pre-P7 builds that have no
master track. BGM rides separately in `meta.audio_tracks` (worker mixes it).

⚠️ STAGING-VERIFICATION-NEEDED: ffmpeg + the render worker can't run in dev.
The P5 silent path and the P7 master-audio path both need an end-to-end
staging render (audio audible, captions aligned, BGM mixed).

Render failures do NOT brick the build: the poll flips the row back to
AWAITING_EDIT with a `[RENDER] …` error_message, so the user can retry from
the project page (the timeline/words/audio artifacts are all still intact).

Flow:
  1. Fetch the build's timeline.json → meta.source_video_urls + total_duration + dims.
  2. audio_url = s3_urls.audio (P7 master track) or a generated silent MP3.
  3. RenderService.submit(timeline_url, audio_url, source_video_urls, w/h/fps).
  4. Background poll → on completed, build.update_on_render(video_url) → RENDERED.
"""
from __future__ import annotations

import asyncio
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

    # Master soundtrack: P7's ASSEMBLE_AUDIO bakes the source-clip audio into
    # s3_urls.audio. Fall back to a silent MP3 only when no master track exists
    # (image-only builds, pre-P7 builds) — the worker requires SOME audio_url.
    audio_url = (build.s3_urls or {}).get("audio")
    if not audio_url:
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
    # P6b: captions words track (built by ASSEMBLE_WORDS when captions are
    # enabled). The worker renders captions only when both words_url is present
    # AND show_captions is true.
    words_url = (build.s3_urls or {}).get("words")
    job_id = rs.submit(
        video_id=str(build.id),
        timeline_url=timeline_url,
        audio_url=audio_url,
        words_url=words_url,
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
            else:
                # "completed" with no URL used to leave the build in silent
                # limbo — record it so the FE can surface a retry.
                repo.update_stage(
                    build_id, status="AWAITING_EDIT",
                    error_message=f"[RENDER] worker reported completed without a video URL — retry (job {job_id})",
                )
                logger.warning(f"[StudioRender] {build_id} completed with no video URL")
            return
        if state in ("failed", "error"):
            # A failed RENDER must not brick the BUILD: the timeline/words/audio
            # artifacts are intact, so return to AWAITING_EDIT (renderable) with
            # the error surfaced. (Pre-fix this set FAILED, which the render
            # endpoint rejects forever.) The job id makes each failure's
            # message unique — the FE detects a retry's failure by comparing
            # against the previous error_message.
            err = str(status.get("error", "render failed"))[:400]
            repo.update_stage(
                build_id, status="AWAITING_EDIT",
                error_message=f"[RENDER] {err} (job {job_id})"[:500],
            )
            logger.warning(f"[StudioRender] {build_id} render FAILED (build back to AWAITING_EDIT)")
            return
    repo.update_stage(
        build_id, status="AWAITING_EDIT",
        error_message=f"[RENDER] timed out after 30 minutes — retry (job {job_id})",
    )
    logger.warning(f"[StudioRender] {build_id} render poll timed out after {_POLL_MAX_TRIES} tries")


_PENDING_RENDER_POLLS: set = set()

# Builds with a render in flight (submit + poll lifetime). Guards against a
# double-click spawning two worker jobs + two racing polls whose second
# update_on_render would clobber the first MP4 url. Process-local — ai_service
# is single-pod today (same assumption as RunStateAggregator); a multi-pod
# move would need a DB/Redis lock instead.
_ACTIVE_RENDER_BUILDS: set = set()


class RenderAlreadyInProgress(RuntimeError):
    """Raised when a render is already in flight for this build."""


async def submit_studio_render(build: AiStudioBuild, body: StudioRenderRequest) -> str:
    """Submit the render (off-loop) + kick off the background poll. Returns
    job_id. Idempotent per build: a second concurrent submit raises
    RenderAlreadyInProgress (mapped to 409 by the router) instead of starting a
    duplicate worker job."""
    bid = str(build.id)
    if bid in _ACTIVE_RENDER_BUILDS:
        raise RenderAlreadyInProgress(f"A render is already in progress for build {bid}.")
    _ACTIVE_RENDER_BUILDS.add(bid)
    try:
        job_id = await asyncio.to_thread(_prepare_and_submit, build, body)
    except Exception:
        _ACTIVE_RENDER_BUILDS.discard(bid)  # submit failed — release the slot
        raise

    task = asyncio.create_task(_poll_until_done(bid, job_id))
    _PENDING_RENDER_POLLS.add(task)

    def _done(t: "asyncio.Task") -> None:
        _PENDING_RENDER_POLLS.discard(t)
        _ACTIVE_RENDER_BUILDS.discard(bid)  # poll finished (done/failed/timeout)

    task.add_done_callback(_done)
    return job_id
