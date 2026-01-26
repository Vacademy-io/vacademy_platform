"""
External AI Video Generation API Router.
Dedicated endpoints for external consumption using API Key authentication.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse, JSONResponse
from uuid import uuid4
from sqlalchemy.orm import Session
from typing import Optional

from ..db import db_dependency
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

router = APIRouter(prefix="/external/video/v1", tags=["external-ai-video"])


def get_video_service() -> VideoGenerationService:
    """Dependency to get video generation service."""
    return VideoGenerationService(
        repository=AiVideoRepository(),
        s3_service=S3Service()
    )


@router.post(
    "/generate",
    summary="Generate AI video (External)",
    response_class=StreamingResponse
)
async def generate_video_external(
    payload: VideoGenerationRequest,
    target_stage: str = "RENDER",
    service: VideoGenerationService = Depends(get_video_service),
    db: Session = Depends(db_dependency),
    institute_id: str = Depends(get_institute_from_api_key)
) -> StreamingResponse:
    """
    Generate AI video.
    
    Authentication: Requires 'X-Institute-Key' header.
    
    This endpoint allows you to generate a video up to a specific stage.
    By default, it runs until 'RENDER' (complete video).
    """
    video_id = payload.video_id or str(uuid4())
    
    # Ensure usage tracking uses the authenticated institute_id
    # We ignore payload.institute_id/user_id from external calls for security
    
    async def event_generator():
        async for event in service.generate_till_stage(
            video_id=video_id,
            prompt=payload.prompt,
            target_stage=target_stage,
            language=payload.language,
            captions_enabled=payload.captions_enabled,
            html_quality=payload.html_quality,
            resume=False,
            target_audience=payload.target_audience,
            target_duration=payload.target_duration,
            db_session=db,
            institute_id=institute_id, # Authenticated institute
            user_id=None # External calls don't map to platform internal users easily
        ):
            yield f"data: {event}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Video-ID": video_id
        }
    )


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

