"""
External AI Video Generation API Router.
Dedicated endpoints for external consumption using API Key authentication.
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session

from ..db import db_dependency, db_session as make_db_session
from ..dependencies import get_institute_from_api_key, require_credits
from ..schemas.video_generation import (
    VideoGenerationRequest,
    VideoStatusResponse,
    VideoUrlsResponse,
    RegenerateFrameRequest,
    RegenerateFrameResponse,
    UpdateFrameRequest
)
from pydantic import BaseModel, Field
from ..services.video_generation_service import VideoGenerationService
from ..repositories.ai_video_repository import AiVideoRepository
from ..services.s3_service import S3Service


# ---------------------------------------------------------------------------
# Render settings (optional body for POST /render/{video_id})
# ---------------------------------------------------------------------------

class RenderOptionsBody(BaseModel):
    resolution: Optional[str] = Field(None, description="720p or 1080p")
    fps: Optional[int] = Field(None, description="15, 20, or 25")
    show_captions: Optional[bool] = Field(None)
    show_branding: Optional[bool] = Field(None)
    caption_position: Optional[str] = Field(None, description="top or bottom")
    caption_text_color: Optional[str] = Field(None, description="Hex color e.g. #ffffff")
    caption_bg_color: Optional[str] = Field(None, description="Hex color e.g. #000000")
    caption_bg_opacity: Optional[int] = Field(None, description="0-100")
    caption_size: Optional[str] = Field(None, description="S, M, or L")


_RESOLUTION_MAP = {
    ("720p", "landscape"): (1280, 720),
    ("720p", "portrait"): (720, 1280),
    ("1080p", "landscape"): (1920, 1080),
    ("1080p", "portrait"): (1080, 1920),
}

# Caption sizes for 1920px render canvas (NOT browser display sizes).
# These are ~2.5x the client-side values to look correct in rendered video.
_CAPTION_SIZE_PX = {"S": 36, "M": 48, "L": 64}

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/external/video/v1", tags=["external-ai-video"])

# ---------------------------------------------------------------------------
# Background task registry – survives SSE disconnects
# ---------------------------------------------------------------------------
# Maps video_id -> asyncio.Task (the running generation coroutine)
_generation_tasks: Dict[str, asyncio.Task] = {}
# Maps video_id -> asyncio.Queue (SSE event stream for the active connection)
_generation_queues: Dict[str, asyncio.Queue] = {}

# ---------------------------------------------------------------------------
# Per-institute concurrency & rate limiting
# ---------------------------------------------------------------------------
MAX_CONCURRENT_PER_INSTITUTE = 3  # Max simultaneous generation tasks per institute
RATE_LIMIT_WINDOW_SECONDS = 60   # Rolling window for rate limiting
MAX_REQUESTS_PER_WINDOW = 10     # Max /generate requests per institute per window

# Maps institute_id -> set of active video_ids (for concurrency tracking)
_institute_active_tasks: Dict[str, set] = defaultdict(set)
# Maps institute_id -> list of request timestamps (for rate limiting)
_institute_request_times: Dict[str, List[float]] = defaultdict(list)


def _check_concurrency_limit(institute_id: str) -> None:
    """Raise 429 if the institute has too many concurrent generation tasks."""
    # Clean up completed tasks
    active = _institute_active_tasks.get(institute_id, set())
    still_running = {vid for vid in active if vid in _generation_tasks and not _generation_tasks[vid].done()}
    _institute_active_tasks[institute_id] = still_running

    if len(still_running) >= MAX_CONCURRENT_PER_INSTITUTE:
        raise HTTPException(
            status_code=429,
            detail=f"Concurrency limit reached: {MAX_CONCURRENT_PER_INSTITUTE} "
                   f"video generations already running for this institute. "
                   f"Wait for a current generation to finish before starting a new one.",
        )


def _check_rate_limit(institute_id: str) -> None:
    """Raise 429 if the institute exceeds the request rate limit."""
    import time
    now = time.monotonic()
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS

    # Prune old timestamps
    times = _institute_request_times[institute_id]
    _institute_request_times[institute_id] = [t for t in times if t > cutoff]
    times = _institute_request_times[institute_id]

    if len(times) >= MAX_REQUESTS_PER_WINDOW:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: max {MAX_REQUESTS_PER_WINDOW} requests "
                   f"per {RATE_LIMIT_WINDOW_SECONDS}s. Try again shortly.",
        )

    times.append(now)


def get_video_service(db: Session = Depends(db_dependency)) -> VideoGenerationService:
    """Dependency to get video generation service."""
    return VideoGenerationService(
        repository=AiVideoRepository(session=db),
        s3_service=S3Service()
    )


@router.post(
    "/generate",
    summary="Generate AI video (External)",
    response_class=StreamingResponse
)
async def generate_video_external(
    payload: VideoGenerationRequest,
    target_stage: str = "HTML",
    institute_id: str = Depends(get_institute_from_api_key),
    _credits_check=Depends(require_credits("video", estimated_tokens=5000)),
) -> StreamingResponse:
    """
    Generate AI video.

    Authentication: Requires 'X-Institute-Key' header.

    Generation runs as a **background task** so it continues even if the SSE
    connection is closed (browser tab closed / page refresh). The frontend can
    re-connect by polling ``/status/{video_id}`` or ``/urls/{video_id}``.
    """
    # Enforce per-institute rate limit and concurrency cap
    _check_rate_limit(institute_id)
    _check_concurrency_limit(institute_id)

    video_id = payload.video_id or str(uuid4())

    # Build a per-request event queue that the SSE generator will drain.
    queue: asyncio.Queue = asyncio.Queue()

    # ------------------------------------------------------------------
    # If a task is already running for this video_id (rare re-connect),
    # reuse the existing queue so both connections share the same stream.
    # ------------------------------------------------------------------
    if video_id in _generation_tasks and not _generation_tasks[video_id].done():
        existing_queue = _generation_queues.get(video_id)
        if existing_queue is not None:
            queue = existing_queue
            logger.info(f"[BG-Gen] Re-connecting to existing task for {video_id}")
    else:
        # ------------------------------------------------------------------
        # Start a new background task.  It owns its own DB session so it
        # keeps running after this HTTP request / SSE connection is closed.
        # ------------------------------------------------------------------
        _generation_queues[video_id] = queue

        async def _run_generation(q: asyncio.Queue, vid: str, p: VideoGenerationRequest,
                                   ts: str, inst_id: str) -> None:
            try:
                with make_db_session() as bg_session:
                    bg_svc = VideoGenerationService(
                        repository=AiVideoRepository(session=bg_session),
                        s3_service=S3Service()
                    )
                    async for event in bg_svc.generate_till_stage(
                        video_id=vid,
                        prompt=p.prompt,
                        target_stage=ts,
                        language=p.language,
                        captions_enabled=p.captions_enabled,
                        html_quality=p.html_quality,
                        resume=False,
                        target_audience=p.target_audience,
                        target_duration=p.target_duration,
                        voice_gender=p.voice_gender,
                        tts_provider=p.tts_provider,
                        voice_id=p.voice_id,
                        content_type=p.content_type,
                        db_session=bg_session,
                        model=p.model or "",  # Empty = let service pick based on quality_tier
                        quality_tier=p.quality_tier,
                        institute_id=inst_id,
                        user_id=None,
                        reference_files=[rf.model_dump() for rf in p.reference_files] if p.reference_files else None,
                        orientation=p.orientation,
                    ):
                        await q.put(json.dumps(event))
            except Exception as exc:
                logger.error(f"[BG-Gen] Background task error for {vid}: {exc}")
                # Refund all credits charged for this failed video
                try:
                    with make_db_session() as refund_session:
                        from ..services.token_usage_service import TokenUsageService
                        TokenUsageService(refund_session).refund_video_credits(vid, inst_id)
                except Exception as refund_err:
                    logger.error(f"[BG-Gen] Failed to refund credits for {vid}: {refund_err}")
                await q.put(json.dumps({
                    "type": "error",
                    "message": str(exc),
                    "video_id": vid,
                }))
            finally:
                # Sentinel – tells the SSE generator the stream is done
                await q.put(None)
                _generation_tasks.pop(vid, None)
                _generation_queues.pop(vid, None)
                # Remove from institute concurrency tracker
                _institute_active_tasks.get(inst_id, set()).discard(vid)
                logger.info(f"[BG-Gen] Background task finished for {vid}")

        task = asyncio.create_task(
            _run_generation(queue, video_id, payload, target_stage, institute_id)
        )
        _generation_tasks[video_id] = task
        _institute_active_tasks[institute_id].add(video_id)
        logger.info(f"[BG-Gen] Started background task for {video_id}")

    # ------------------------------------------------------------------
    # SSE generator – drains the queue.
    # When the browser closes the connection this generator is cancelled,
    # but the background task above keeps running independently.
    # ------------------------------------------------------------------
    async def sse_stream() -> None:
        try:
            while True:
                try:
                    event_json = await asyncio.wait_for(queue.get(), timeout=60.0)
                except asyncio.TimeoutError:
                    # Send a comment-line heartbeat to keep proxies alive
                    yield ": heartbeat\n\n"
                    continue

                if event_json is None:
                    # Sentinel – generation finished
                    break
                yield f"data: {event_json}\n\n"
        except (GeneratorExit, asyncio.CancelledError):
            # SSE connection dropped – background task continues unaffected
            logger.info(f"[BG-Gen] SSE client disconnected for {video_id}; background task continues")

    return StreamingResponse(
        sse_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Video-ID": video_id,
            "X-Content-Type": payload.content_type,
        }
    )


@router.get(
    "/history",
    response_model=List[VideoStatusResponse],
    summary="Get last N content generations for institute (External)"
)
async def get_institute_generations_external(
    limit: int = 10,
    service: VideoGenerationService = Depends(get_video_service),
    db: Session = Depends(db_dependency),
    institute_id: str = Depends(get_institute_from_api_key)
) -> List[VideoStatusResponse]:
    """
    Get list of last N content generations for the authenticated institute.
    Authentication: Requires 'X-Institute-Key' header.
    """
    if limit > 50:
        limit = 50 # Cap limit
    
    # Get returned dicts and validate with schema
    generations = service.get_institute_generations(institute_id, limit)
    return [VideoStatusResponse(**gen) for gen in generations]


@router.get(
    "/status/{video_id}",
    response_model=VideoStatusResponse,
    summary="Get video generation status (External)"
)
async def get_video_status_external(
    video_id: str,
    service: VideoGenerationService = Depends(get_video_service),
    db: Session = Depends(db_dependency),
    institute_id: str = Depends(get_institute_from_api_key)
) -> VideoStatusResponse:
    """
    Get current status and files for a video generation.
    Authentication: Requires 'X-Institute-Key' header.
    """
    # TODO: In future, verify video belongs to institute
    status = service.get_video_status(video_id)
    
    if not status:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")
    
    return VideoStatusResponse(**status)


@router.get(
    "/urls/{video_id}",
    response_model=VideoUrlsResponse,
    summary="Get HTML timeline and audio URLs for a video (External)"
)
async def get_video_urls_external(
    video_id: str,
    service: VideoGenerationService = Depends(get_video_service),
    db: Session = Depends(db_dependency),
    institute_id: str = Depends(get_institute_from_api_key)
) -> VideoUrlsResponse:
    """
    Get HTML timeline and audio URLs for a video.
    Authentication: Requires 'X-Institute-Key' header.
    """
    status = service.get_video_status(video_id)

    if not status:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")

    s3_urls = status.get("s3_urls", {})
    raw_status = status.get("status", "UNKNOWN")
    error_message = status.get("error_message")
    updated_at_str = status.get("updated_at")

    # ── Staleness detection ──
    # If the job is still IN_PROGRESS but hasn't been updated in >15 min,
    # the pipeline likely died silently.  Report STALLED so the frontend
    # can show a meaningful message instead of polling forever.
    STALE_THRESHOLD = timedelta(minutes=15)
    if raw_status == "IN_PROGRESS" and updated_at_str:
        try:
            updated_at_dt = datetime.fromisoformat(
                updated_at_str.replace("Z", "+00:00")
            )
            if updated_at_dt.tzinfo is None:
                updated_at_dt = updated_at_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - updated_at_dt > STALE_THRESHOLD:
                raw_status = "STALLED"
                error_message = (
                    error_message
                    or f"Generation has not progressed since {updated_at_str}. "
                       f"Last stage reached: {status.get('current_stage', 'UNKNOWN')}."
                )
                logger.warning(
                    f"[urls] Video {video_id} detected as stalled "
                    f"(last update: {updated_at_str})"
                )
        except (ValueError, TypeError):
            pass  # unparseable timestamp — fall through with original status

    # Include render_job_id from metadata (if render is in progress)
    _metadata = status.get("metadata", {}) or {}
    _render_job_id = _metadata.get("render_job_id") if not s3_urls.get("video") else None

    return VideoUrlsResponse(
        video_id=video_id,
        html_url=s3_urls.get("timeline"),
        audio_url=s3_urls.get("audio"),
        words_url=s3_urls.get("words"),
        avatar_url=s3_urls.get("avatar"),
        video_url=s3_urls.get("video"),
        status=raw_status,
        current_stage=status.get("current_stage", "UNKNOWN"),
        updated_at=updated_at_str,
        error_message=error_message,
        render_job_id=_render_job_id,
    )


@router.post(
    "/frame/regenerate",
    response_model=RegenerateFrameResponse,
    summary="Regenerate a specific frame's HTML using AI (External)"
)
async def regenerate_frame_external(
    payload: RegenerateFrameRequest,
    service: VideoGenerationService = Depends(get_video_service),
    db: Session = Depends(db_dependency),
    institute_id: str = Depends(get_institute_from_api_key)
) -> RegenerateFrameResponse:
    """
    Regenerate HTML content for a specific frame based on user prompt.
    Returns the new HTML for preview.
    Authentication: Requires 'X-Institute-Key' header.
    """
    try:
        result = await service.regenerate_video_frame(
            video_id=payload.video_id,
            timestamp=payload.timestamp,
            user_prompt=payload.user_prompt,
            db_session=db,
            institute_id=institute_id
        )
        return RegenerateFrameResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/frame/update",
    summary="Update a specific frame's HTML (External)"
)
async def update_frame_external(
    payload: UpdateFrameRequest,
    service: VideoGenerationService = Depends(get_video_service),
    db: Session = Depends(db_dependency),
    institute_id: str = Depends(get_institute_from_api_key)
):
    """
    Update a frame's HTML in the timeline.
    Call this after previewing the regenerated frame to confirm changes.
    Authentication: Requires 'X-Institute-Key' header.
    """
    try:
        result = await service.update_video_frame(
            video_id=payload.video_id,
            frame_index=payload.frame_index,
            new_html=payload.new_html
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except IndexError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Video Render (offloaded to dedicated Hetzner render server)
# ---------------------------------------------------------------------------

@router.post("/render/{video_id}")
async def request_video_render(
    video_id: str,
    body: Optional[RenderOptionsBody] = None,
    service: VideoGenerationService = Depends(get_video_service),
    institute_id: str = Depends(get_institute_from_api_key),
    db: Session = Depends(db_dependency),
):
    """
    Trigger MP4 rendering for a completed video (HTML stage must be done).

    Submits a render job to the dedicated render server. The frontend can
    poll /urls/{video_id} to check when `video_url` becomes available.

    Accepts an optional JSON body with render settings (resolution, fps,
    caption options). If omitted, uses defaults (1080p, 22fps, captions on).
    """
    from ..config import get_settings
    from ..services.render_service import RenderService

    settings = get_settings()
    if not settings.render_server_url:
        raise HTTPException(
            status_code=503,
            detail="Render server not configured. Set RENDER_SERVER_URL.",
        )

    # Validate video exists and has required stages completed
    status = service.get_video_status(video_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")

    s3_urls = status.get("s3_urls", {})
    if not s3_urls.get("timeline"):
        raise HTTPException(
            status_code=400,
            detail="Video must have HTML stage completed before rendering. Missing timeline URL.",
        )
    if not s3_urls.get("audio"):
        raise HTTPException(
            status_code=400,
            detail="Video must have audio (TTS stage) before rendering. Missing audio URL.",
        )

    render_svc = RenderService(
        render_server_url=settings.render_server_url,
        render_key=settings.render_server_key,
    )

    # Derive dimensions from orientation stored in metadata
    _meta = status.get("metadata", {}) or {}
    _orientation = _meta.get("orientation", "landscape")

    # Apply resolution from request body if provided
    if body and body.resolution and body.resolution in ("720p", "1080p"):
        _render_width, _render_height = _RESOLUTION_MAP.get(
            (body.resolution, _orientation), (1920, 1080)
        )
    else:
        _render_width = 1080 if _orientation == "portrait" else 1920
        _render_height = 1920 if _orientation == "portrait" else 1080

    # Build optional render params — explicit None checks so `False` / `0` values are respected
    _fps = (body.fps if body is not None and body.fps is not None and body.fps in (15, 20, 25) else None)
    _show_captions = body.show_captions if (body is not None and body.show_captions is not None) else True
    _show_branding = body.show_branding if (body is not None and body.show_branding is not None) else True
    _caption_position = (body.caption_position if body is not None and body.caption_position in ("top", "bottom") else None)
    _caption_text_color = (body.caption_text_color if body and body.caption_text_color else None)
    _caption_bg_color = (body.caption_bg_color if body and body.caption_bg_color else None)
    _caption_bg_opacity = (body.caption_bg_opacity if body and body.caption_bg_opacity is not None else None)
    _caption_font_size = (_CAPTION_SIZE_PX.get(body.caption_size) if body and body.caption_size else None)

    try:
        job_id = render_svc.submit(
            video_id=video_id,
            timeline_url=s3_urls["timeline"],
            audio_url=s3_urls["audio"],
            words_url=s3_urls.get("words"),
            branding_meta_url=s3_urls.get("branding_meta"),
            avatar_video_url=s3_urls.get("avatar"),
            show_captions=_show_captions,
            show_branding=_show_branding,
            width=_render_width,
            height=_render_height,
            fps=_fps,
            caption_position=_caption_position,
            caption_text_color=_caption_text_color,
            caption_bg_color=_caption_bg_color,
            caption_bg_opacity=_caption_bg_opacity,
            caption_font_size=_caption_font_size,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Store render job_id in metadata so frontend can resume progress tracking after reload
    try:
        repo = AiVideoRepository(session=db)
        video_record = repo.get_by_video_id(video_id)
        if video_record:
            meta = video_record.metadata or {}
            meta["render_job_id"] = job_id
            repo.update_metadata(video_id, meta)
    except Exception as e:
        logger.warning(f"[render] Failed to store render_job_id in metadata: {e}")

    # Poll the render worker in background and update DB on completion
    async def _poll_render(vid: str, jid: str):
        import asyncio as _aio
        try:
            deadline = 5400  # 90 min
            elapsed = 0
            while elapsed < deadline:
                await _aio.sleep(15)
                elapsed += 15
                status_resp = render_svc.check_status(jid)
                rs = status_resp.get("status", "")
                if rs == "completed":
                    video_url = status_resp.get("video_url", "")
                    if video_url:
                        with make_db_session() as bg_session:
                            repo = AiVideoRepository(session=bg_session)
                            repo.update_files(
                                video_id=vid,
                                file_ids={"video": f"{vid}-video"},
                                s3_urls={"video": video_url},
                            )
                        logger.info(f"[render-poll] Video {vid} render done, DB updated: {video_url}")
                    return
                elif rs == "failed":
                    logger.error(f"[render-poll] Video {vid} render failed: {status_resp.get('error')}")
                    return
        except Exception as e:
            logger.error(f"[render-poll] Polling error for {vid}: {e}")

    asyncio.create_task(_poll_render(video_id, job_id))

    return {"job_id": job_id, "status": "queued", "video_id": video_id}


@router.get("/render/status/{job_id}")
async def get_render_status(
    job_id: str,
    _: str = Depends(get_institute_from_api_key),
):
    """
    Check the status and progress of a render job.

    Returns:
        - status: queued | running | completed | failed | unknown
        - progress: 0-100
        - video_url: S3 URL when completed
        - error: error message when failed
    """
    from ..config import get_settings
    from ..services.render_service import RenderService

    settings = get_settings()
    if not settings.render_server_url:
        raise HTTPException(status_code=503, detail="Render server not configured.")

    render_svc = RenderService(
        render_server_url=settings.render_server_url,
        render_key=settings.render_server_key,
    )

    result = render_svc.check_status(job_id)
    return result


@router.post("/render-callback/{video_id}")
async def render_callback(
    video_id: str,
    payload: dict,
    x_render_key: str = Header(""),
    db: Session = Depends(db_dependency),
):
    """
    Callback from the render worker when a render job completes or fails.
    Auth: X-Render-Key header must match RENDER_SERVER_KEY.
    """
    from ..config import get_settings

    settings = get_settings()
    if settings.render_server_key and x_render_key != settings.render_server_key:
        raise HTTPException(status_code=401, detail="Invalid render key")

    repo = AiVideoRepository(session=db)
    video = repo.get_by_video_id(video_id)
    if not video:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")

    cb_status = payload.get("status")
    video_url = payload.get("video_url")
    error = payload.get("error")

    if cb_status == "completed" and video_url:
        repo.update_files(
            video_id=video_id,
            file_ids={"video": f"{video_id}-video"},
            s3_urls={"video": video_url},
        )
        logger.info(f"[render-callback] Video {video_id} render completed: {video_url}")
        return {"status": "ok"}
    elif cb_status == "failed":
        logger.error(f"[render-callback] Video {video_id} render failed: {error}")
        return {"status": "ok", "note": "failure recorded"}
    else:
        return {"status": "ok"}


# ---------------------------------------------------------------------------
# TTS Voice Catalog
# ---------------------------------------------------------------------------

# Sarvam AI voices (bulbul:v3) — all voices work across all supported languages
_SARVAM_VOICES = {
    "male": [
        {"id": "shubh", "name": "Shubh"}, {"id": "aditya", "name": "Aditya"},
        {"id": "rahul", "name": "Rahul"}, {"id": "rohan", "name": "Rohan"},
        {"id": "amit", "name": "Amit"}, {"id": "dev", "name": "Dev"},
        {"id": "ratan", "name": "Ratan"}, {"id": "varun", "name": "Varun"},
        {"id": "manan", "name": "Manan"}, {"id": "sumit", "name": "Sumit"},
        {"id": "kabir", "name": "Kabir"}, {"id": "aayan", "name": "Aayan"},
        {"id": "ashutosh", "name": "Ashutosh"}, {"id": "advait", "name": "Advait"},
        {"id": "anand", "name": "Anand"}, {"id": "tarun", "name": "Tarun"},
        {"id": "sunny", "name": "Sunny"}, {"id": "mani", "name": "Mani"},
        {"id": "gokul", "name": "Gokul"}, {"id": "vijay", "name": "Vijay"},
        {"id": "mohit", "name": "Mohit"}, {"id": "rehan", "name": "Rehan"},
        {"id": "soham", "name": "Soham"},
    ],
    "female": [
        {"id": "ritu", "name": "Ritu"}, {"id": "priya", "name": "Priya"},
        {"id": "neha", "name": "Neha"}, {"id": "pooja", "name": "Pooja"},
        {"id": "simran", "name": "Simran"}, {"id": "kavya", "name": "Kavya"},
        {"id": "ishita", "name": "Ishita"}, {"id": "shreya", "name": "Shreya"},
        {"id": "roopa", "name": "Roopa"}, {"id": "amelia", "name": "Amelia"},
        {"id": "sophia", "name": "Sophia"}, {"id": "tanya", "name": "Tanya"},
        {"id": "shruti", "name": "Shruti"}, {"id": "suhani", "name": "Suhani"},
        {"id": "kavitha", "name": "Kavitha"}, {"id": "rupali", "name": "Rupali"},
    ],
}

# Google Cloud TTS voices (curated per language+gender for premium tier)
_GOOGLE_VOICES = {
    "english (us)": {
        "female": [
            {"id": "en-US-Journey-F", "name": "Journey (Natural)"},
            {"id": "en-US-Neural2-F", "name": "Neural2"},
        ],
        "male": [
            {"id": "en-US-Journey-D", "name": "Journey (Natural)"},
            {"id": "en-US-Neural2-D", "name": "Neural2"},
        ],
    },
    "english (uk)": {
        "female": [
            {"id": "en-GB-Neural2-A", "name": "Neural2"},
            {"id": "en-GB-Wavenet-A", "name": "WaveNet"},
        ],
        "male": [
            {"id": "en-GB-Neural2-B", "name": "Neural2"},
            {"id": "en-GB-Wavenet-B", "name": "WaveNet"},
        ],
    },
    "spanish": {
        "female": [{"id": "es-ES-Neural2-A", "name": "Neural2"}],
        "male": [{"id": "es-ES-Neural2-B", "name": "Neural2"}],
    },
    "french": {
        "female": [{"id": "fr-FR-Neural2-A", "name": "Neural2"}],
        "male": [{"id": "fr-FR-Neural2-B", "name": "Neural2"}],
    },
    "german": {
        "female": [{"id": "de-DE-Neural2-A", "name": "Neural2"}],
        "male": [{"id": "de-DE-Neural2-B", "name": "Neural2"}],
    },
    "japanese": {
        "female": [{"id": "ja-JP-Neural2-B", "name": "Neural2"}],
        "male": [{"id": "ja-JP-Neural2-C", "name": "Neural2"}],
    },
    "chinese": {
        "female": [{"id": "zh-CN-Neural2-C", "name": "Neural2"}],
        "male": [{"id": "zh-CN-Neural2-D", "name": "Neural2"}],
    },
}

# Edge TTS voices (one per language+gender, standard tier)
_EDGE_VOICES = {
    "english (us)": {"female": "en-US-AriaNeural", "male": "en-US-ChristopherNeural"},
    "english (uk)": {"female": "en-GB-SoniaNeural", "male": "en-GB-RyanNeural"},
    "english (india)": {"female": "en-IN-NeerjaNeural", "male": "en-IN-PrabhatNeural"},
    "hindi": {"female": "hi-IN-SwaraNeural", "male": "hi-IN-MadhurNeural"},
    "bengali": {"female": "bn-IN-TanishaaNeural", "male": "bn-IN-BashkarNeural"},
    "tamil": {"female": "ta-IN-PallaviNeural", "male": "ta-IN-ValluvarNeural"},
    "telugu": {"female": "te-IN-ShrutiNeural", "male": "te-IN-MohanNeural"},
    "marathi": {"female": "mr-IN-AarohiNeural", "male": "mr-IN-ManoharNeural"},
    "kannada": {"female": "kn-IN-SapnaNeural", "male": "kn-IN-GaganNeural"},
    "gujarati": {"female": "gu-IN-DhwaniNeural", "male": "gu-IN-NiranjanNeural"},
    "malayalam": {"female": "ml-IN-SobhanaNeural", "male": "ml-IN-MidhunNeural"},
    "spanish": {"female": "es-ES-ElviraNeural", "male": "es-ES-AlvaroNeural"},
    "french": {"female": "fr-FR-DeniseNeural", "male": "fr-FR-HenriNeural"},
    "german": {"female": "de-DE-KatjaNeural", "male": "de-DE-ConradNeural"},
    "japanese": {"female": "ja-JP-NanamiNeural", "male": "ja-JP-KeitaNeural"},
    "chinese": {"female": "zh-CN-XiaoxiaoNeural", "male": "zh-CN-YunxiNeural"},
}

_INDIAN_LANGUAGES = {
    "hindi", "bengali", "tamil", "telugu", "marathi", "kannada",
    "gujarati", "malayalam", "punjabi", "odia", "english (india)",
}

# Pre-recorded voice sample URLs (hosted on S3 via Vacademy media service)
_SARVAM_SAMPLE_URLS = {
    "aayan": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/af27be2f-86ab-42ed-8479-cb381d8faeb5-aayan.mp3",
    "aditya": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/9badf126-8277-47f6-a027-6c2125938f1d-aditya.mp3",
    "advait": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/81536e8e-f9ea-4eb1-9c6d-c4a1331ae703-advait.mp3",
    "amelia": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/58b632f9-99a9-4dcf-9bef-9a66b9b2a537-amelia.mp3",
    "amit": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/f6194632-1ab6-4981-98c7-6cdcd4fada95-amit.mp3",
    "anand": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/bc064296-bc27-48db-bc4f-583a24d215c4-anand.mp3",
    "ashutosh": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/875419e5-da05-40a3-b611-cd2def044a46-ashutosh.mp3",
    "dev": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/58c208ed-53f8-4790-bf88-d0247b05769e-dev.mp3",
    "gokul": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/f64af8bc-b692-4cf7-9bfc-c9772de747d2-gokul.mp3",
    "ishita": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/2be6712b-b736-496d-96db-69b50ce71e56-ishita.mp3",
    "kabir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/28d6a62a-a283-44f6-9a26-0bf3ecb9d94c-kabir.mp3",
    "kavitha": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/b784166e-7512-4c90-a39b-497f64bf1811-kavitha.mp3",
    "kavya": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/25fc67e7-f5f5-457a-a501-2d0b0260bd9a-kavya.mp3",
    "manan": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/47a0a396-ab1c-4531-bbb5-9cd67a8562b0-manan.mp3",
    "mani": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/e6f5225b-f076-4af7-b569-4e5ecf59a5b7-mani.mp3",
    "mohit": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/9df6d3cc-7e9d-45cd-9a5f-66f99d501ae1-mohit.mp3",
    "neha": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/18b7cdd9-dfd5-4603-b554-329215007355-neha.mp3",
    "pooja": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/d65b3c3e-0645-4458-bd18-833339ff6de8-pooja.mp3",
    "priya": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/b2ce2fc8-2cf7-40d4-b09e-09b4b1a4cace-priya.mp3",
    "rahul": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/8517e2f3-e30f-47bb-ace6-e4ab5a3252ba-rahul.mp3",
    "ratan": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/5a192620-b45d-4026-9ef7-18741a25d45b-ratan.mp3",
    "rehan": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/03107cfe-2e7e-4678-a894-cd4f780b826e-rehan.mp3",
    "ritu": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/3996b1ce-8ca0-43d4-aae0-b1af436e8db3-ritu.mp3",
    "rohan": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/6936bd6a-ffa7-4026-a82f-aff5516f5f90-rohan.mp3",
    "roopa": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/ccd72cb8-e5f3-470c-93da-02245572e3a7-roopa.mp3",
    "rupali": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/b84cbb84-ba23-4076-bf24-09e510d4e7b6-rupali.mp3",
    "shreya": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/c18e4948-ecfa-4930-b662-4a0a0c4860b7-shreya.mp3",
    "shruti": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/0f9da9a2-f993-4619-bf9f-88240196b40c-shruti.mp3",
    "shubh": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/5644f3bf-d378-4cee-afc6-8c4001f27364-shubh.mp3",
    "simran": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/7419dd84-8aea-43b0-8b8f-c828ce138383-simran.mp3",
    "soham": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/d2883100-030d-416e-95e0-2e28350e82ac-soham.mp3",
    "sophia": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/887ed89e-0a3b-445a-8c03-f7b76ee89454-sophia.mp3",
    "suhani": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/e52ba58c-78d4-44c0-9925-9bfbc3c3c586-suhani.mp3",
    "sumit": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/f40dd450-3927-43e5-bcff-fbcfbe61caee-sumit.mp3",
    "sunny": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/f9232984-917e-494f-9c70-cc7b94dbae2b-sunny.mp3",
    "tanya": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/813ebb58-ff02-4128-bb3f-e32fb7e76070-tanya.mp3",
    "tarun": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/d88dbe63-e7d9-4aac-8eca-91eb661e0364-tarun.mp3",
    "varun": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/a8fd7e3c-d342-4f7f-85d5-d33f7d014a9e-varun.mp3",
    "vijay": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/SARVAM/5bc1a29e-970f-425a-abdf-90d2b39f51ab-vijay.mp3",
}

_EDGE_SAMPLE_URLS = {
    "bn-IN-BashkarNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/9e67b75a-30a1-49c6-8cd8-8adb755ffc06-bn-IN-BashkarNeural.mp3",
    "bn-IN-TanishaaNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/177d56be-29b2-44b9-b9c0-09e1f2c4f5b1-bn-IN-TanishaaNeural.mp3",
    "de-DE-ConradNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/7c57dc29-3971-4b69-acf7-50a82b47a2c0-de-DE-ConradNeural.mp3",
    "de-DE-KatjaNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/74c4eec9-b98e-4f3d-b8ed-bca5441465e8-de-DE-KatjaNeural.mp3",
    "en-GB-RyanNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/91cc684d-c1fe-4c81-986d-0aed4a249309-en-GB-RyanNeural.mp3",
    "en-GB-SoniaNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/a0c33adf-984d-48ba-93a9-ba8a1e0e661d-en-GB-SoniaNeural.mp3",
    "en-IN-NeerjaNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/97906395-b534-4702-b699-14e7f258101d-en-IN-NeerjaNeural.mp3",
    "en-IN-PrabhatNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/240c4846-4359-46a5-8616-82f337b3b19c-en-IN-PrabhatNeural.mp3",
    "en-US-AriaNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/ad9e6d16-6744-49c4-a9bb-3e18c0b751c7-en-US-AriaNeural.mp3",
    "en-US-ChristopherNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/8d9c98c8-a20a-41fd-80c3-f40456fd17ca-en-US-ChristopherNeural.mp3",
    "es-ES-AlvaroNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/48de9d79-3a76-4d3b-ba4d-4a9c78e3edaf-es-ES-AlvaroNeural.mp3",
    "es-ES-ElviraNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/48b6f2d8-6f5d-4c5c-80fd-ee2f21d89772-es-ES-ElviraNeural.mp3",
    "fr-FR-DeniseNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/3db79b9c-a424-40b0-8dca-d3fd572db1e2-fr-FR-DeniseNeural.mp3",
    "fr-FR-HenriNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/7e241e72-ea76-4f0a-b34e-a16a438d3cd6-fr-FR-HenriNeural.mp3",
    "gu-IN-DhwaniNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/b3e55a52-861f-44b9-a9df-683e79ea98b6-gu-IN-DhwaniNeural.mp3",
    "gu-IN-NiranjanNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/0a2fb66b-9ad5-476d-824d-33ad963c76e6-gu-IN-NiranjanNeural.mp3",
    "hi-IN-MadhurNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/3c830ee7-2bd3-46fb-99fb-d8a810c93519-hi-IN-MadhurNeural.mp3",
    "hi-IN-SwaraNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/01697cae-493f-4215-bb43-f7f9513290ba-hi-IN-SwaraNeural.mp3",
    "ja-JP-KeitaNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/dbfcdeed-4f78-47c0-af02-602c478975f3-ja-JP-KeitaNeural.mp3",
    "ja-JP-NanamiNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/01b45e8b-e615-4730-80ac-3d5c1783b091-ja-JP-NanamiNeural.mp3",
    "kn-IN-GaganNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/ed9da038-1b0f-47e9-89ea-7f56a9f869b5-kn-IN-GaganNeural.mp3",
    "kn-IN-SapnaNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/c24822ce-fe7a-4352-b4c9-654251774232-kn-IN-SapnaNeural.mp3",
    "ml-IN-MidhunNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/fb017ef4-c70c-4a93-b50d-97867cdf1336-ml-IN-MidhunNeural.mp3",
    "ml-IN-SobhanaNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/3a167e0c-736e-44c2-9d87-de73192bdeea-ml-IN-SobhanaNeural.mp3",
    "mr-IN-AarohiNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/b464e29f-97e9-4433-8147-5dcc3053690f-mr-IN-AarohiNeural.mp3",
    "mr-IN-ManoharNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/da0cbdf4-ab65-4a7b-8d8b-84bf571c02f5-mr-IN-ManoharNeural.mp3",
    "ta-IN-PallaviNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/d8447ff1-0bba-416a-bc16-6e722de8805d-ta-IN-PallaviNeural.mp3",
    "ta-IN-ValluvarNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/dedb9fda-b209-4234-888e-91e83bff946f-ta-IN-ValluvarNeural.mp3",
    "te-IN-MohanNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/852dacc3-df32-4b7e-99e4-97d73d9eb9d1-te-IN-MohanNeural.mp3",
    "te-IN-ShrutiNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/ea9dd7b7-adf3-4f99-a1fb-e8e587f3f063-te-IN-ShrutiNeural.mp3",
    "zh-CN-XiaoxiaoNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/36f7402b-cf48-401c-bc69-39c8c9459656-zh-CN-XiaoxiaoNeural.mp3",
    "zh-CN-YunxiNeural": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/EDGE/ecb0a3b3-72b5-45ba-b0fe-feede2f49f64-zh-CN-YunxiNeural.mp3",
}


@router.get(
    "/tts/voices",
    summary="List available TTS voices for a language, gender, and tier",
)
async def list_tts_voices(
    language: str = "English (US)",
    gender: str = "female",
    tier: str = "standard",
):
    """
    Returns available TTS voices for the given combination.

    - **standard** tier: Single Edge TTS voice per language+gender (free).
    - **premium** tier: Multiple voices — Sarvam AI for Indian languages,
      Google Cloud TTS for global languages.

    Each voice includes a `sample_url` for audio preview (placeholder until
    samples are generated).
    """
    lang_key = language.lower().strip()
    gender_key = gender.lower().strip()
    if gender_key not in ("male", "female"):
        gender_key = "female"

    if tier == "premium":
        if lang_key in _INDIAN_LANGUAGES:
            # Sarvam voices — same set for all Indian languages
            raw_voices = _SARVAM_VOICES.get(gender_key, [])
            voices = [
                {
                    "id": v["id"],
                    "name": v["name"],
                    "provider": "sarvam",
                    "sample_url": _SARVAM_SAMPLE_URLS.get(v["id"], ""),
                }
                for v in raw_voices
            ]
            return {"tier": "premium", "provider": "sarvam", "language": language, "gender": gender_key, "voices": voices}
        else:
            # Google voices
            lang_voices = _GOOGLE_VOICES.get(lang_key, {})
            raw_voices = lang_voices.get(gender_key, [])
            voices = [
                {
                    "id": v["id"],
                    "name": v["name"],
                    "provider": "google",
                    "sample_url": "",  # Google samples not yet generated
                }
                for v in raw_voices
            ]
            return {"tier": "premium", "provider": "google", "language": language, "gender": gender_key, "voices": voices}
    else:
        # Standard — single Edge TTS voice
        edge_lang = _EDGE_VOICES.get(lang_key, _EDGE_VOICES.get("english (us)", {}))
        voice_name = edge_lang.get(gender_key, "en-US-AriaNeural")
        return {
            "tier": "standard",
            "provider": "edge",
            "language": language,
            "gender": gender_key,
            "voices": [
                {
                    "id": voice_name,
                    "name": voice_name.replace("Neural", "").split("-")[-1],
                    "provider": "edge",
                    "sample_url": _EDGE_SAMPLE_URLS.get(voice_name, ""),
                }
            ],
        }
