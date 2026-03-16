"""
External AI Video Generation API Router.
Dedicated endpoints for external consumption using API Key authentication.
"""
from __future__ import annotations

import asyncio
import json
import logging
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
    
    return VideoUrlsResponse(
        video_id=video_id,
        html_url=s3_urls.get("timeline"),
        audio_url=s3_urls.get("audio"),
        words_url=s3_urls.get("words"),
        status=status.get("status", "UNKNOWN"),
        current_stage=status.get("current_stage", "UNKNOWN")
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

