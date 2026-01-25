"""
AI Video Generation API Router.
Provides endpoints for generating AI videos with stage-based control.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from uuid import uuid4
from typing import Optional

from ..schemas.video_generation import (
    VideoGenerationRequest,
    VideoGenerationResumeRequest,
    VideoStatusResponse,
    VideoUrlsResponse,
)
from ..services.video_generation_service import VideoGenerationService
from ..repositories.ai_video_repository import AiVideoRepository
from ..services.s3_service import S3Service


router = APIRouter(prefix="/video", tags=["ai-video-generation"])


def get_video_service() -> VideoGenerationService:
    """Dependency to get video generation service."""
    import logging
    logger = logging.getLogger(__name__)
    logger.info("[VIDEO_GEN_ROUTER] Creating VideoGenerationService instance")
    try:
        service = VideoGenerationService(
            repository=AiVideoRepository(),
            s3_service=S3Service()
        )
        logger.info("[VIDEO_GEN_ROUTER] VideoGenerationService created successfully")
        return service
    except Exception as e:
        logger.error(f"[VIDEO_GEN_ROUTER] Failed to create VideoGenerationService: {e}")
        raise


@router.post(
    "/generate/till-script",
    summary="Generate video till script stage",
    response_class=StreamingResponse
)
async def generate_till_script(
    payload: VideoGenerationRequest,
    service: VideoGenerationService = Depends(get_video_service)
) -> StreamingResponse:
    """
    Generate AI video up to script stage only.
    Returns SSE stream with progress updates.
    
    **Stages completed**: SCRIPT
    
    **Output files**: script.txt
    """
    video_id = payload.video_id or str(uuid4())
    
    async def event_generator():
        async for event in service.generate_till_stage(
            video_id=video_id,
            prompt=payload.prompt,
            target_stage="SCRIPT",
            language=payload.language,
            captions_enabled=payload.captions_enabled,
            html_quality=payload.html_quality,
            resume=False,
            target_audience=payload.target_audience,
            target_duration=payload.target_duration
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


@router.post(
    "/generate/till-mp3",
    summary="Generate video till audio (MP3) stage",
    response_class=StreamingResponse
)
async def generate_till_mp3(
    payload: VideoGenerationRequest,
    service: VideoGenerationService = Depends(get_video_service)
) -> StreamingResponse:
    """
    Generate AI video up to TTS (Text-to-Speech) stage.
    Returns SSE stream with progress updates.
    
    **Stages completed**: SCRIPT, TTS
    
    **Output files**: script.txt, narration.mp3
    """
    video_id = payload.video_id or str(uuid4())
    
    async def event_generator():
        async for event in service.generate_till_stage(
            video_id=video_id,
            prompt=payload.prompt,
            target_stage="TTS",
            language=payload.language,
            captions_enabled=payload.captions_enabled,
            html_quality=payload.html_quality,
            resume=False
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


@router.post(
    "/generate/till-html",
    summary="Generate video till HTML/timeline stage",
    response_class=StreamingResponse
)
async def generate_till_html(
    payload: VideoGenerationRequest,
    service: VideoGenerationService = Depends(get_video_service)
) -> StreamingResponse:
    """
    Generate AI video up to HTML generation stage.
    Returns SSE stream with progress updates.
    
    **Stages completed**: SCRIPT, TTS, WORDS, HTML
    
    **Output files**: 
    - script.txt
    - narration.mp3
    - narration.words.json
    - alignment.json
    - time_based_frame.json (HTML timeline)
    
    This is the recommended endpoint for frontend video players that can
    render HTML overlays with synchronized audio.
    """
    video_id = payload.video_id or str(uuid4())
    
    async def event_generator():
        async for event in service.generate_till_stage(
            video_id=video_id,
            prompt=payload.prompt,
            target_stage="HTML",
            language=payload.language,
            captions_enabled=payload.captions_enabled,
            html_quality=payload.html_quality,
            resume=False
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


@router.post(
    "/generate/till-render",
    summary="Generate complete video with rendering",
    response_class=StreamingResponse
)
async def generate_till_render(
    payload: VideoGenerationRequest,
    service: VideoGenerationService = Depends(get_video_service)
) -> StreamingResponse:
    """
    Generate complete AI video including final rendering.
    Returns SSE stream with progress updates.
    
    **Stages completed**: SCRIPT, TTS, WORDS, HTML, RENDER
    
    **Output files**: All intermediate files + final output.mp4
    
    **Note**: This is the most resource-intensive operation and may take
    several minutes depending on video length.
    """
    video_id = payload.video_id or str(uuid4())
    
    async def event_generator():
        async for event in service.generate_till_stage(
            video_id=video_id,
            prompt=payload.prompt,
            target_stage="RENDER",
            language=payload.language,
            captions_enabled=payload.captions_enabled,
            html_quality=payload.html_quality,
            resume=False
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


@router.post(
    "/resume/after-script",
    summary="Resume generation after script stage",
    response_class=StreamingResponse
)
async def resume_after_script(
    payload: VideoGenerationResumeRequest,
    target_stage: str = "HTML",
    service: VideoGenerationService = Depends(get_video_service)
) -> StreamingResponse:
    """
    Resume video generation from script stage.
    Useful when script generation completed but subsequent stages failed.
    
    **Query Parameters**:
    - target_stage: Target stage to generate up to (TTS, WORDS, HTML, RENDER)
    """
    async def event_generator():
        async for event in service.generate_till_stage(
            video_id=payload.video_id,
            prompt="",  # Not needed for resume
            target_stage=target_stage,
            language="English",  # Will use existing from DB
            resume=True
        ):
            yield f"data: {event}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post(
    "/resume/after-mp3",
    summary="Resume generation after audio (MP3) stage",
    response_class=StreamingResponse
)
async def resume_after_mp3(
    payload: VideoGenerationResumeRequest,
    target_stage: str = "HTML",
    service: VideoGenerationService = Depends(get_video_service)
) -> StreamingResponse:
    """
    Resume video generation from TTS stage.
    Useful when audio generation completed but subsequent stages failed.
    
    **Query Parameters**:
    - target_stage: Target stage to generate up to (WORDS, HTML, RENDER)
    """
    async def event_generator():
        async for event in service.generate_till_stage(
            video_id=payload.video_id,
            prompt="",
            target_stage=target_stage,
            language="English",
            resume=True
        ):
            yield f"data: {event}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post(
    "/resume/after-html",
    summary="Resume generation after HTML stage",
    response_class=StreamingResponse
)
async def resume_after_html(
    payload: VideoGenerationResumeRequest,
    service: VideoGenerationService = Depends(get_video_service)
) -> StreamingResponse:
    """
    Resume video generation from HTML stage to final rendering.
    Useful when HTML generation completed but rendering failed.
    
    Only generates the final RENDER stage.
    """
    async def event_generator():
        async for event in service.generate_till_stage(
            video_id=payload.video_id,
            prompt="",
            target_stage="RENDER",
            language="English",
            resume=True
        ):
            yield f"data: {event}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.get(
    "/status/{video_id}",
    response_model=VideoStatusResponse,
    summary="Get video generation status"
)
async def get_video_status(
    video_id: str,
    service: VideoGenerationService = Depends(get_video_service)
) -> VideoStatusResponse:
    """
    Get current status and files for a video generation.
    
    Returns all available file URLs and current generation stage.
    """
    status = service.get_video_status(video_id)
    
    if not status:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")
    
    return VideoStatusResponse(**status)


@router.get(
    "/urls/{video_id}",
    response_model=VideoUrlsResponse,
    summary="Get HTML timeline and audio URLs for a video"
)
async def get_video_urls(
    video_id: str,
    service: VideoGenerationService = Depends(get_video_service)
) -> VideoUrlsResponse:
    """
    Get HTML timeline and audio URLs for a video by video_id.
    
    Returns:
    - html_url: URL to the HTML timeline file (time_based_frame.json)
    - audio_url: URL to the audio file (narration.mp3)
    - words_url: URL to time-synced words JSON for captions
    - status: Current video generation status
    - current_stage: Current generation stage
    
    These URLs can be used directly in frontend video players.
    The words_url contains word-level timestamps for displaying captions.
    """
    status = service.get_video_status(video_id)
    
    if not status:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")
    
    s3_urls = status.get("s3_urls", {})
    
    return VideoUrlsResponse(
        video_id=video_id,
        html_url=s3_urls.get("timeline"),  # HTML timeline file
        audio_url=s3_urls.get("audio"),     # Audio file
        words_url=s3_urls.get("words"),     # Time-synced words for captions
        status=status.get("status", "UNKNOWN"),
        current_stage=status.get("current_stage", "UNKNOWN")
    )


__all__ = ["router"]

