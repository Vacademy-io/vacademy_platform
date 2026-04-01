"""
External AI Video Generation API Router.
Dedicated endpoints for external consumption using API Key authentication.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session

from ..db import db_dependency, db_session as make_db_session
from ..dependencies import get_institute_from_api_key
from ..schemas.video_generation import (
    VideoGenerationRequest,
    VideoStatusResponse,
    VideoUrlsResponse,
    RegenerateFrameRequest,
    RegenerateFrameResponse,
    UpdateFrameRequest
)
from ..services.video_generation_service import VideoGenerationService
from ..repositories.ai_video_repository import AiVideoRepository
from ..services.s3_service import S3Service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/external/video/v1", tags=["external-ai-video"])

# ---------------------------------------------------------------------------
# Background task registry – survives SSE disconnects
# ---------------------------------------------------------------------------
# Maps video_id -> asyncio.Task (the running generation coroutine)
_generation_tasks: Dict[str, asyncio.Task] = {}
# Maps video_id -> asyncio.Queue (SSE event stream for the active connection)
_generation_queues: Dict[str, asyncio.Queue] = {}


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
    institute_id: str = Depends(get_institute_from_api_key)
) -> StreamingResponse:
    """
    Generate AI video.

    Authentication: Requires 'X-Institute-Key' header.

    Generation runs as a **background task** so it continues even if the SSE
    connection is closed (browser tab closed / page refresh). The frontend can
    re-connect by polling ``/status/{video_id}`` or ``/urls/{video_id}``.
    """
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
                        content_type=p.content_type,
                        db_session=bg_session,
                        model=p.model or "",  # Empty = let service pick based on quality_tier
                        quality_tier=getattr(p, "quality_tier", "ultra"),
                        institute_id=inst_id,
                        user_id=None,
                        reference_files=[rf.model_dump() for rf in p.reference_files] if p.reference_files else None,
                        orientation=getattr(p, "orientation", "landscape"),
                    ):
                        await q.put(json.dumps(event))
            except Exception as exc:
                logger.error(f"[BG-Gen] Background task error for {vid}: {exc}")
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
                logger.info(f"[BG-Gen] Background task finished for {vid}")

        task = asyncio.create_task(
            _run_generation(queue, video_id, payload, target_stage, institute_id)
        )
        _generation_tasks[video_id] = task
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
    service: VideoGenerationService = Depends(get_video_service),
    institute_id: str = Depends(get_institute_from_api_key),
    db: Session = Depends(db_dependency),
):
    """
    Trigger MP4 rendering for a completed video (HTML stage must be done).

    Submits a render job to the dedicated render server. The frontend can
    poll /urls/{video_id} to check when `video_url` becomes available.
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
    _render_width = 1080 if _orientation == "portrait" else 1920
    _render_height = 1920 if _orientation == "portrait" else 1080

    try:
        job_id = render_svc.submit(
            video_id=video_id,
            timeline_url=s3_urls["timeline"],
            audio_url=s3_urls["audio"],
            words_url=s3_urls.get("words"),
            branding_meta_url=s3_urls.get("branding_meta"),
            avatar_video_url=s3_urls.get("avatar"),
            show_captions=True,
            width=_render_width,
            height=_render_height,
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
