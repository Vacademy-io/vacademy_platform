"""
External AI Video Generation API Router.
Dedicated endpoints for external consumption using API Key authentication.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, List
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
    UpdateFrameRequest,
    AddFrameRequest,
    AddAudioTrackRequest,
    UpdateAudioTrackRequest,
    DeleteAudioTrackRequest,
    AudioTrackResponse,
    VideoCostPreviewRequest,
    VideoCostPreviewResponse,
)
from ..services.video_estimation_service import estimate_video_generation
from pydantic import BaseModel, Field
from ..services.video_generation_service import VideoGenerationService
from ..repositories.ai_video_repository import AiVideoRepository
from ..services.s3_service import S3Service


# ---------------------------------------------------------------------------
# Render settings (optional body for POST /render/{video_id})
# ---------------------------------------------------------------------------

class ResumeRequest(BaseModel):
    """Body for POST /resume/{video_id} — resume generation after script review."""
    target_stage: str = Field("HTML", description="Stage to resume up to (e.g. HTML)")
    modified_script: Optional[str] = Field(None, description="User-edited script text. If provided, overwrites the existing script in S3 before resuming.")
    # Generation options (forwarded to pipeline so resume uses the same settings as the original /generate call)
    voice_gender: str = Field("female", description="Voice gender for TTS")
    tts_provider: str = Field("standard", description="TTS provider: standard or premium")
    voice_id: Optional[str] = Field(None, description="Specific voice ID for premium TTS")
    captions_enabled: bool = Field(True, description="Whether captions are enabled")
    html_quality: str = Field("advanced", description="HTML quality: classic or advanced")
    target_audience: str = Field("General/Adult", description="Target audience")
    target_duration: str = Field("2-3 minutes", description="Target content duration")
    model: Optional[str] = Field(None, description="LLM model override")
    sound_effects_enabled: bool = Field(True, description="Whether sound effects are enabled")


class RenderOptionsBody(BaseModel):
    resolution: Optional[str] = Field(None, description="720p or 1080p")
    fps: Optional[int] = Field(None, description="15, 20, 25, 30, 45, or 60")
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
    "/preview-cost",
    response_model=VideoCostPreviewResponse,
    summary="Estimate credits/cost for a video generation request before submitting",
)
def preview_video_cost(
    payload: VideoCostPreviewRequest,
    institute_id: str = Depends(get_institute_from_api_key),
    db: Session = Depends(db_dependency),
) -> VideoCostPreviewResponse:
    """
    Returns the resolved selections (so the FE can show a confirmation summary)
    plus an expected/low/high credit and USD cost estimate, plus the institute's
    current credit balance and whether it covers the worst-case high estimate.
    """
    result = estimate_video_generation(
        db,
        institute_id=institute_id,
        model=payload.model,
        quality_tier=payload.quality_tier,
        target_duration=payload.target_duration,
        target_audience=payload.target_audience,
        orientation=payload.orientation,
        voice_gender=payload.voice_gender,
        tts_provider=payload.tts_provider,
        voice_id=payload.voice_id,
        language=payload.language,
        generate_avatar=payload.generate_avatar,
        background_music_enabled=payload.background_music_enabled,
        sound_effects_enabled=payload.sound_effects_enabled,
        content_type=payload.content_type,
        visual_style=payload.visual_style,
        captions_enabled=payload.captions_enabled,
        html_quality=payload.html_quality,
        review_mode=payload.review_mode,
        attachments_count=payload.attachments_count,
        host=(payload.host.model_dump() if getattr(payload, "host", None) else None),
    )
    return VideoCostPreviewResponse(**result)


@router.post(
    "/route-preview",
    summary="Preview the auto-routing plan for a prompt (External, no side effects)",
)
async def external_route_preview(
    payload: dict,
    institute_id: str = Depends(get_institute_from_api_key),
):
    """
    Returns the RoutingPlan the pipeline would compute for this prompt + context.
    No side effects: does NOT trigger scrape, search, or generation.

    Body:
      {
        "prompt": str,
        "input_video_count": int,
        "attached_file_count": int,
        "orientation": "landscape" | "portrait",
        "content_type": str
      }
    """
    from ..config import get_settings as _get_settings
    from ..schemas.routing import RoutePreviewRequest as _RoutePreviewRequest
    from ..services.intent_router_service import IntentRouterService as _IntentRouter
    from ..services.web_content_capture_service import extract_urls as _extract_urls

    _ = institute_id  # auth gate; institute_id reserved for future per-tenant rules
    body = _RoutePreviewRequest.model_validate(payload)
    settings = _get_settings()
    api_key = getattr(settings, "openrouter_api_key", "") or ""
    urls = _extract_urls(body.prompt, max_urls=5)
    router_svc = _IntentRouter(openrouter_key=api_key)
    plan = await router_svc.route(
        prompt=body.prompt,
        input_video_count=body.input_video_count,
        attached_file_count=body.attached_file_count,
        urls_in_prompt=urls,
        orientation=body.orientation,
        content_type=body.content_type,
    )
    return plan.model_dump()


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
                        visual_style=p.visual_style,
                        sound_effects_enabled=p.sound_effects_enabled,
                        input_video_ids=p.input_video_ids,
                        input_video_audio=p.input_video_audio,
                        mute_tts_on_source_clips=p.mute_tts_on_source_clips,
                        background_music_enabled=p.background_music_enabled,
                        background_music_volume=p.background_music_volume,
                        sub_shots_enabled=p.sub_shots_enabled,
                        routing_overrides=p.routing_overrides,
                        host=p.host,
                        brand_kit_id=getattr(p, "brand_kit_id", None),
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


# ---------------------------------------------------------------------------
# Resume generation after script review
# ---------------------------------------------------------------------------

@router.post(
    "/resume/{video_id}",
    summary="Resume video generation after script review (External)",
    response_class=StreamingResponse,
)
async def resume_video_external(
    video_id: str,
    payload: ResumeRequest,
    institute_id: str = Depends(get_institute_from_api_key),
    _credits_check=Depends(require_credits("video", estimated_tokens=3000)),
    db: Session = Depends(db_dependency),
) -> StreamingResponse:
    """
    Resume a video generation that was paused after the SCRIPT stage.

    If ``modified_script`` is provided, the existing script in S3 is
    overwritten before resuming so the pipeline picks up the user's edits.

    Authentication: Requires 'X-Institute-Key' header.
    """
    repo = AiVideoRepository(session=db)
    video_record = repo.get_by_video_id(video_id)
    if not video_record:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")

    # Overwrite script in S3 if the user edited it
    if payload.modified_script is not None:
        s3_svc = S3Service()
        script_key = f"ai-videos/{video_id}/script/script.txt"
        s3_svc.upload_file_content(
            content=payload.modified_script.encode("utf-8"),
            filename="script.txt",
            s3_key=script_key,
            content_type="text/plain; charset=utf-8",
        )
        logger.info(f"[Resume] Overwrote script in S3 for {video_id}")

    # Build SSE queue + background task (same pattern as /generate)
    queue: asyncio.Queue = asyncio.Queue()

    # Reuse existing task if still running
    if video_id in _generation_tasks and not _generation_tasks[video_id].done():
        existing_queue = _generation_queues.get(video_id)
        if existing_queue is not None:
            queue = existing_queue
            logger.info(f"[Resume] Re-connecting to existing task for {video_id}")
    else:
        _generation_queues[video_id] = queue

        async def _run_resume(q: asyncio.Queue, vid: str, ts: str, inst_id: str,
                             p: ResumeRequest) -> None:
            try:
                with make_db_session() as bg_session:
                    bg_svc = VideoGenerationService(
                        repository=AiVideoRepository(session=bg_session),
                        s3_service=S3Service(),
                    )
                    # Retrieve the original record to get prompt + settings
                    rec = bg_svc.repository.get_by_video_id(vid)
                    if not rec:
                        await q.put(json.dumps({"type": "error", "message": f"Video {vid} not found", "video_id": vid}))
                        return
                    if not rec.prompt:
                        await q.put(json.dumps({"type": "error", "message": "Original prompt not found", "video_id": vid}))
                        return

                    _meta = rec.extra_metadata or {}
                    async for event in bg_svc.generate_till_stage(
                        video_id=vid,
                        prompt=rec.prompt,
                        target_stage=ts,
                        language=rec.language or "English",
                        resume=True,
                        content_type=rec.content_type or "VIDEO",
                        db_session=bg_session,
                        institute_id=inst_id,
                        orientation=_meta.get("orientation", "landscape"),
                        visual_style=_meta.get("visual_style", "standard"),
                        quality_tier=_meta.get("quality_tier", "ultra"),
                        voice_gender=p.voice_gender,
                        tts_provider=p.tts_provider,
                        voice_id=p.voice_id,
                        captions_enabled=p.captions_enabled,
                        html_quality=p.html_quality,
                        target_audience=p.target_audience,
                        target_duration=p.target_duration,
                        model=p.model or "",
                        sound_effects_enabled=p.sound_effects_enabled,
                        input_video_ids=_meta.get("input_video_ids"),
                        input_video_audio=_meta.get("input_video_audio"),
                        mute_tts_on_source_clips=_meta.get("mute_tts_on_source_clips", False),
                        background_music_enabled=_meta.get("background_music_enabled"),
                        background_music_volume=_meta.get("background_music_volume"),
                        sub_shots_enabled=bool(_meta.get("sub_shots_enabled", False)),
                    ):
                        await q.put(json.dumps(event))
            except Exception as exc:
                logger.error(f"[Resume] Background task error for {vid}: {exc}")
                try:
                    with make_db_session() as refund_session:
                        from ..services.token_usage_service import TokenUsageService
                        TokenUsageService(refund_session).refund_video_credits(vid, inst_id)
                except Exception as refund_err:
                    logger.error(f"[Resume] Failed to refund credits for {vid}: {refund_err}")
                await q.put(json.dumps({"type": "error", "message": str(exc), "video_id": vid}))
            finally:
                await q.put(None)
                _generation_tasks.pop(vid, None)
                _generation_queues.pop(vid, None)
                _institute_active_tasks.get(inst_id, set()).discard(vid)
                logger.info(f"[Resume] Background task finished for {vid}")

        task = asyncio.create_task(_run_resume(queue, video_id, payload.target_stage, institute_id, payload))
        _generation_tasks[video_id] = task
        _institute_active_tasks[institute_id].add(video_id)
        logger.info(f"[Resume] Started background task for {video_id}")

    async def sse_stream():
        try:
            while True:
                try:
                    event_json = await asyncio.wait_for(queue.get(), timeout=60.0)
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
                    continue
                if event_json is None:
                    break
                yield f"data: {event_json}\n\n"
        except (GeneratorExit, asyncio.CancelledError):
            logger.info(f"[Resume] SSE client disconnected for {video_id}; background task continues")

    return StreamingResponse(
        sse_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Video-ID": video_id,
        },
    )


# ---------------------------------------------------------------------------
# Retry a failed generation — resumes from last checkpoint
# ---------------------------------------------------------------------------

@router.post(
    "/retry/{video_id}",
    summary="Retry a failed video generation from last checkpoint (External)",
    response_class=StreamingResponse,
)
async def retry_video_external(
    video_id: str,
    institute_id: str = Depends(get_institute_from_api_key),
    _credits_check=Depends(require_credits("video", estimated_tokens=3000)),
    db: Session = Depends(db_dependency),
) -> StreamingResponse:
    """
    Retry a FAILED or STALLED video generation.

    The pipeline resumes from the HTML stage, loading the Director plan and
    per-shot HTML checkpoints uploaded to S3 after the previous run, so only
    incomplete shots are re-generated.

    Authentication: Requires 'X-Institute-Key' header.
    """
    repo = AiVideoRepository(session=db)
    video_record = repo.get_by_video_id(video_id)
    if not video_record:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")
    if video_record.status not in ("FAILED", "STALLED"):
        raise HTTPException(
            status_code=400,
            detail=f"Video {video_id} is not in a retryable state (status={video_record.status})"
        )

    queue: asyncio.Queue = asyncio.Queue()
    _generation_queues[video_id] = queue

    async def _run_retry(q: asyncio.Queue, vid: str, inst_id: str) -> None:
        try:
            with make_db_session() as bg_session:
                bg_svc = VideoGenerationService(
                    repository=AiVideoRepository(session=bg_session),
                    s3_service=S3Service(),
                )
                rec = bg_svc.repository.get_by_video_id(vid)
                if not rec:
                    await q.put(json.dumps({"type": "error", "message": f"Video {vid} not found", "video_id": vid}))
                    return

                _meta = rec.extra_metadata or {}
                # Resume from HTML stage — checkpoint download happens automatically in _run_pipeline_stages
                async for event in bg_svc.generate_till_stage(
                    video_id=vid,
                    prompt=rec.prompt or "",
                    target_stage="HTML",
                    language=rec.language or "English",
                    resume=True,
                    content_type=rec.content_type or "VIDEO",
                    db_session=bg_session,
                    institute_id=inst_id,
                    orientation=_meta.get("orientation", "landscape"),
                    visual_style=_meta.get("visual_style", "standard"),
                    quality_tier=_meta.get("quality_tier", "ultra"),
                    voice_gender=_meta.get("voice_gender", "female"),
                    tts_provider=_meta.get("tts_provider", "standard"),
                    voice_id=_meta.get("voice_id"),
                    captions_enabled=True,
                    html_quality=_meta.get("html_quality", "advanced"),
                    target_audience=_meta.get("target_audience", "General/Adult"),
                    target_duration=_meta.get("target_duration", "2-3 minutes"),
                    model=_meta.get("model", ""),
                    sound_effects_enabled=True,
                    input_video_ids=_meta.get("input_video_ids"),
                    input_video_audio=_meta.get("input_video_audio"),
                    mute_tts_on_source_clips=_meta.get("mute_tts_on_source_clips", False),
                    background_music_enabled=_meta.get("background_music_enabled"),
                    background_music_volume=_meta.get("background_music_volume"),
                    sub_shots_enabled=bool(_meta.get("sub_shots_enabled", False)),
                ):
                    await q.put(json.dumps(event))
        except Exception as exc:
            logger.error(f"[Retry] Background task error for {vid}: {exc}")
            try:
                with make_db_session() as refund_session:
                    from ..services.token_usage_service import TokenUsageService
                    TokenUsageService(refund_session).refund_video_credits(vid, inst_id)
            except Exception as refund_err:
                logger.error(f"[Retry] Failed to refund credits for {vid}: {refund_err}")
            await q.put(json.dumps({"type": "error", "message": str(exc), "video_id": vid}))
        finally:
            await q.put(None)
            _generation_tasks.pop(vid, None)
            _generation_queues.pop(vid, None)
            _institute_active_tasks.get(inst_id, set()).discard(vid)
            logger.info(f"[Retry] Background task finished for {vid}")

    task = asyncio.create_task(_run_retry(queue, video_id, institute_id))
    _generation_tasks[video_id] = task
    _institute_active_tasks[institute_id].add(video_id)
    logger.info(f"[Retry] Started background task for {video_id}")

    async def sse_stream():
        try:
            while True:
                try:
                    event_json = await asyncio.wait_for(queue.get(), timeout=60.0)
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
                    continue
                if event_json is None:
                    break
                yield f"data: {event_json}\n\n"
        except (GeneratorExit, asyncio.CancelledError):
            logger.info(f"[Retry] SSE client disconnected for {video_id}; background task continues")

    return StreamingResponse(
        sse_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Video-ID": video_id,
        },
    )


@router.get(
    "/history",
    response_model=List[VideoStatusResponse],
    summary="Get last N content generations for institute (External)"
)
async def get_institute_generations_external(
    limit: int = 10,
    offset: int = 0,
    service: VideoGenerationService = Depends(get_video_service),
    db: Session = Depends(db_dependency),
    institute_id: str = Depends(get_institute_from_api_key)
) -> List[VideoStatusResponse]:
    """
    Get list of last N content generations for the authenticated institute.
    Authentication: Requires 'X-Institute-Key' header.
    Supports pagination via `offset` query parameter.
    """
    if limit > 50:
        limit = 50 # Cap limit
    if offset < 0:
        offset = 0

    # Get returned dicts and validate with schema
    generations = service.get_institute_generations(institute_id, limit, offset)
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
    "/frame/add",
    summary="Add a new frame to the timeline (External)"
)
async def add_frame_external(
    payload: AddFrameRequest,
    service: VideoGenerationService = Depends(get_video_service),
    db: Session = Depends(db_dependency),
    institute_id: str = Depends(get_institute_from_api_key)
):
    """
    Insert a new HTML frame/entry into the video timeline.

    For time_driven videos: provide in_time and exit_time to control when the shot
    appears. The frame is inserted in chronological order. If exit_time exceeds the
    current total_duration, the timeline meta is extended automatically.

    For user_driven videos: omit in_time/exit_time — the frame is appended at the end.

    Authentication: Requires 'X-Institute-Key' header.
    """
    try:
        result = await service.add_video_frame(
            video_id=payload.video_id,
            html=payload.html,
            in_time=payload.in_time,
            exit_time=payload.exit_time,
            z=payload.z or 0,
            entry_id=payload.entry_id,
            html_start_x=payload.html_start_x,
            html_start_y=payload.html_start_y,
            html_end_x=payload.html_end_x,
            html_end_y=payload.html_end_y,
        )
        return result
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
            new_html=payload.new_html,
            in_time=payload.in_time,
            exit_time=payload.exit_time,
            z=payload.z,
            entry_id=payload.entry_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except IndexError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Sentence clips — per-sentence audio metadata for the script editor
#
# The video pipeline auto-builds these for every newly generated video
# after the HTML stage. This endpoint backfills older videos on demand:
# slice the existing global narration.mp3 along sentence boundaries
# (no re-TTS, no voice drift) and store the clip URLs in
# meta.sentences[] inside the timeline JSON.
# ---------------------------------------------------------------------------

class SentenceWordDto(BaseModel):
    word: str
    start: float
    end: float


class SentenceClipDto(BaseModel):
    id: str
    text: str
    audio_url: str
    start_time: float
    duration: float
    words: List[SentenceWordDto]


class BuildSentencesResponse(BaseModel):
    video_id: str
    timeline_url: str
    count: int
    sentences: List[SentenceClipDto]
    skipped_reason: Optional[str] = None


@router.post(
    "/sentences/build",
    response_model=BuildSentencesResponse,
    summary="Build per-sentence audio clips for a video (External)",
)
async def build_sentence_clips_external(
    payload: dict,
    service: VideoGenerationService = Depends(get_video_service),
    db: Session = Depends(db_dependency),
    institute_id: str = Depends(get_institute_from_api_key),
) -> BuildSentencesResponse:
    """
    Slice this video's narration.mp3 into per-sentence clips and persist
    the metadata into meta.sentences[] inside the timeline JSON. Idempotent
    — re-running overwrites the previous sentences[] at the same S3 keys.

    Used to backfill videos generated before per-sentence audio was a
    pipeline-default. New videos populate sentences[] automatically.

    Body: { "video_id": "vid_abc..." }
    Authentication: Requires 'X-Institute-Key' header.
    """
    from ..config import get_settings
    from ..services.render_service import RenderService
    from ..services.sentence_clip_service import SentenceClipService

    video_id = (payload or {}).get("video_id")
    if not isinstance(video_id, str) or not video_id:
        raise HTTPException(status_code=400, detail="video_id is required")

    settings = get_settings()
    if not settings.render_server_url:
        raise HTTPException(
            status_code=503,
            detail="Render server not configured. Set RENDER_SERVER_URL.",
        )

    svc = SentenceClipService(
        s3_service=service.s3_service,
        render_service=RenderService(
            render_server_url=settings.render_server_url,
            render_key=settings.render_server_key,
        ),
        repository=service.repository,
        video_gen_root=service.video_gen_root,
    )
    try:
        result = svc.build_for_video(video_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to build sentences: {exc}")

    return BuildSentencesResponse(
        video_id=result.video_id,
        timeline_url=result.timeline_url,
        count=result.count,
        sentences=[SentenceClipDto(**s) for s in result.sentences],
        skipped_reason=result.skipped_reason,
    )


class VoiceOverrides(BaseModel):
    """Optional per-request voice config. Any field left None falls back
    to the value persisted on the video record at creation time."""
    language: Optional[str] = None
    voice_gender: Optional[str] = None
    tts_provider: Optional[str] = None
    voice_id: Optional[str] = None


class RegenerateSentenceRequest(BaseModel):
    video_id: str
    sentence_id: str
    new_text: str
    voice_overrides: Optional[VoiceOverrides] = None
    crossfade_ms: int = Field(
        default=50, ge=0, le=2000,
        description="Crossfade duration at each splice join. Lower values reduce cross-sentence bleed.",
    )
    head_pad_ms: int = Field(
        default=40, ge=0, le=500,
        description="Shifts the splice boundary later by this many ms — preserves the previous word's natural acoustic tail at sentence boundaries.",
    )


class RegenerateSentenceResponse(BaseModel):
    video_id: str
    sentence: SentenceClipDto
    duration_delta: float = Field(
        ..., description="new clip duration − old; ripple downstream timestamps by this"
    )
    new_global_audio_url: str
    new_global_duration: float
    timeline_url: str


@router.post(
    "/sentence/regenerate",
    response_model=RegenerateSentenceResponse,
    summary="Re-narrate one sentence and splice it into the global audio (External)",
)
async def regenerate_sentence_external(
    payload: RegenerateSentenceRequest,
    service: VideoGenerationService = Depends(get_video_service),
    db: Session = Depends(db_dependency),
    institute_id: str = Depends(get_institute_from_api_key),
) -> RegenerateSentenceResponse:
    """
    Re-narrate a single sentence using the same voice the video was
    originally generated with.

    Flow on the server:
      1. TTS the new text → fresh per-sentence MP3 in the same voice.
      2. Render worker splices the clip into the global narration.mp3
         with crossfading on both joins.
      3. Every later sentence and entry has its timestamp shifted by the
         duration delta (ripple) so audio/visual sync is preserved.
      4. The patched timeline JSON is re-uploaded; the video record's
         audio URL is updated to the new spliced MP3.

    Returns the updated sentence plus the duration delta so the editor
    can ripple its in-memory entry list immediately.

    Errors:
      - 400 — request body invalid, or sentence not found / sentences[]
              not built yet on this video (call /sentences/build first).
      - 503 — render server not configured.
      - 500 — TTS / splice / S3 failure.

    Authentication: Requires 'X-Institute-Key' header.
    """
    from ..config import get_settings
    from ..services.render_service import RenderService
    from ..services.sentence_clip_service import SentenceClipService

    settings = get_settings()
    if not settings.render_server_url:
        raise HTTPException(
            status_code=503,
            detail="Render server not configured. Set RENDER_SERVER_URL.",
        )

    svc = SentenceClipService(
        s3_service=service.s3_service,
        render_service=RenderService(
            render_server_url=settings.render_server_url,
            render_key=settings.render_server_key,
        ),
        repository=service.repository,
        video_gen_root=service.video_gen_root,
    )
    overrides = payload.voice_overrides.dict(exclude_none=True) if payload.voice_overrides else None

    try:
        result = svc.regenerate_sentence(
            video_id=payload.video_id,
            sentence_id=payload.sentence_id,
            new_text=payload.new_text,
            voice_overrides=overrides,
            crossfade_ms=payload.crossfade_ms,
            head_pad_ms=payload.head_pad_ms,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to regenerate sentence: {exc}")

    return RegenerateSentenceResponse(
        video_id=result.video_id,
        sentence=SentenceClipDto(**result.sentence),
        duration_delta=result.duration_delta,
        new_global_audio_url=result.new_global_audio_url,
        new_global_duration=result.new_global_duration,
        timeline_url=result.timeline_url,
    )


class SilenceSentenceRequest(BaseModel):
    video_id: str
    sentence_id: str
    crossfade_ms: int = Field(default=50, ge=0, le=2000)
    head_pad_ms: int = Field(default=40, ge=0, le=500)


@router.post(
    "/sentence/silence",
    response_model=RegenerateSentenceResponse,
    summary="Mute one sentence — replace its audio with silence of equal length (External)",
)
async def silence_sentence_external(
    payload: SilenceSentenceRequest,
    service: VideoGenerationService = Depends(get_video_service),
    db: Session = Depends(db_dependency),
    institute_id: str = Depends(get_institute_from_api_key),
) -> RegenerateSentenceResponse:
    """
    Replace one sentence's audio with synthesized silence of identical
    length. Total duration and downstream timestamps are preserved — the
    response's `duration_delta` is ~0.

    The sentence stays in `meta.sentences[]` (with empty `text` + `audio_url`)
    so the editor can later re-narrate the same slot via /sentence/regenerate.

    Errors:
      - 400 — sentence not found / sentences[] not built yet.
      - 503 — render server not configured.
      - 500 — splice / S3 failure.

    Authentication: Requires 'X-Institute-Key' header.
    """
    from ..config import get_settings
    from ..services.render_service import RenderService
    from ..services.sentence_clip_service import SentenceClipService

    settings = get_settings()
    if not settings.render_server_url:
        raise HTTPException(
            status_code=503,
            detail="Render server not configured. Set RENDER_SERVER_URL.",
        )

    svc = SentenceClipService(
        s3_service=service.s3_service,
        render_service=RenderService(
            render_server_url=settings.render_server_url,
            render_key=settings.render_server_key,
        ),
        repository=service.repository,
        video_gen_root=service.video_gen_root,
    )
    try:
        result = svc.silence_sentence(
            video_id=payload.video_id,
            sentence_id=payload.sentence_id,
            crossfade_ms=payload.crossfade_ms,
            head_pad_ms=payload.head_pad_ms,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to silence sentence: {exc}")

    return RegenerateSentenceResponse(
        video_id=result.video_id,
        sentence=SentenceClipDto(**result.sentence),
        duration_delta=result.duration_delta,
        new_global_audio_url=result.new_global_audio_url,
        new_global_duration=result.new_global_duration,
        timeline_url=result.timeline_url,
    )


# ---------------------------------------------------------------------------
# Shot insertion — fill a gap in the timeline with a new HTML shot
# ---------------------------------------------------------------------------

# HTML LLM routing — mirrors VideoGenerationService's logic so the
# inserted shot uses the same model the rest of the video was built
# with. `xiaomi/mimo-v2-flash:free` (the constructor's hard-coded
# default in VideoGenerationPipeline) is deprecated and 404s, so we
# always pass a resolved model down to the pipeline here.
_TIER_FLASH_MODEL = "google/gemini-3-flash-preview"
_FLASH_TIERS = {"free", "standard", "premium"}


def _resolve_html_model(db: Session, quality_tier: str) -> str:
    """Pick the HTML LLM for an inserted shot.

    Mirrors VideoGenerationService's tier-aware routing:
      - free/standard/premium → flash (`google/gemini-3-flash-preview`)
      - ultra/super_ultra     → the AI-Models-Service default for "video"

    Falls back to `_TIER_FLASH_MODEL` end-to-end when no DB default is
    configured. Never returns None — the pipeline constructor's default
    (`xiaomi/mimo-v2-flash:free`) is deprecated and 404s, so we always
    pass an explicit model down.
    """
    if quality_tier in _FLASH_TIERS:
        return _TIER_FLASH_MODEL
    try:
        from ..services.ai_models_service import AIModelsService
        resp = AIModelsService(db).get_models_for_use_case("video")
        # `default_model` is an AIModelSummary object (or None when no
        # row in ai_model_defaults and no recommended models exist).
        default_model = getattr(resp, "default_model", None)
        if default_model is not None:
            model_id = getattr(default_model, "model_id", None)
            if model_id:
                return str(model_id)
    except Exception:
        pass
    return _TIER_FLASH_MODEL


class InsertShotRequest(BaseModel):
    video_id: str
    gap_start: float = Field(..., ge=0.0, description="Absolute timeline seconds where the new shot starts.")
    gap_end: float = Field(..., gt=0.0, description="Absolute timeline seconds where the new shot ends.")
    user_hint: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional one-line visual instruction. The narration in the gap is always passed to the LLM as context; this hint refines the visual.",
    )


class InsertShotResponse(BaseModel):
    video_id: str
    entry: Dict[str, Any]
    timeline_url: str


@router.post(
    "/shot/insert",
    response_model=InsertShotResponse,
    summary="Generate a new HTML shot to fill a gap in the timeline (External)",
)
async def insert_shot_external(
    payload: InsertShotRequest,
    service: VideoGenerationService = Depends(get_video_service),
    db: Session = Depends(db_dependency),
    institute_id: str = Depends(get_institute_from_api_key),
) -> InsertShotResponse:
    """
    Generate one HTML shot covering `[gap_start, gap_end]` and insert
    it into the video's timeline. Audio is untouched — gaps are by
    definition spans where narration plays but no visual existed, so
    no splice / ripple is needed.

    The new shot's visuals are conditioned on:
      - the spoken text inside the gap (extracted from
        `meta.sentences[]` and `words.json`), so what's drawn matches
        what's said;
      - the optional `user_hint` for explicit visual intent;
      - the original video's `style_guide.json` checkpoint, so colors
        and fonts match the rest of the video.

    Errors:
      - 400 — invalid gap (out of range, zero/negative, overlaps an
              existing entry).
      - 404 — video not found.
      - 500 — LLM, S3, or generation failure.

    Authentication: Requires 'X-Institute-Key' header.
    """
    from ..config import get_settings
    from ..services.render_service import RenderService
    from ..services.sentence_clip_service import SentenceClipService

    settings = get_settings()
    svc = SentenceClipService(
        s3_service=service.s3_service,
        render_service=RenderService(
            render_server_url=settings.render_server_url,
            render_key=settings.render_server_key,
        ),
        repository=service.repository,
        video_gen_root=service.video_gen_root,
    )

    # Resolve the HTML LLM the same way VideoGenerationService does:
    # default model from AIModelsService, with the same flash override
    # for low/mid tiers. Without this we'd fall through to the pipeline's
    # hard-coded `xiaomi/mimo-v2-flash:free` default which is deprecated.
    record = service.repository.get_by_video_id(payload.video_id)
    quality_tier = "ultra"
    if record is not None:
        quality_tier = str((record.extra_metadata or {}).get("quality_tier") or "ultra")
    html_model = _resolve_html_model(db, quality_tier)

    try:
        result = svc.insert_shot(
            video_id=payload.video_id,
            gap_start=payload.gap_start,
            gap_end=payload.gap_end,
            user_hint=payload.user_hint,
            html_model=html_model,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to insert shot: {exc}")

    return InsertShotResponse(
        video_id=result.video_id,
        entry=result.entry,
        timeline_url=result.timeline_url,
    )


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
    _fps = (body.fps if body is not None and body.fps is not None and body.fps in (15, 20, 25, 30, 45, 60) else None)
    _show_captions = body.show_captions if (body is not None and body.show_captions is not None) else True
    _show_branding = body.show_branding if (body is not None and body.show_branding is not None) else True
    _caption_position = (body.caption_position if body is not None and body.caption_position in ("top", "bottom") else None)
    _caption_text_color = (body.caption_text_color if body and body.caption_text_color else None)
    _caption_bg_color = (body.caption_bg_color if body and body.caption_bg_color else None)
    _caption_bg_opacity = (body.caption_bg_opacity if body and body.caption_bg_opacity is not None else None)
    _caption_font_size = (_CAPTION_SIZE_PX.get(body.caption_size) if body and body.caption_size else None)

    # Check if this video uses indexed source videos (for SOURCE_CLIP compositing).
    # Try metadata first; fall back to looking up ai_input_videos records directly.
    _source_video_urls = _meta.get("source_video_urls")
    if not _source_video_urls:
        # Backward compat: singular URL
        _sv_url = _meta.get("source_video_url")
        if _sv_url:
            _source_video_urls = [_sv_url]
    if not _source_video_urls:
        # Look up from input_video_ids
        _iv_ids = _meta.get("input_video_ids") or []
        if not _iv_ids and _meta.get("input_video_id"):
            _iv_ids = [_meta["input_video_id"]]
        if _iv_ids:
            try:
                from ..repositories.ai_input_video_repository import AiInputVideoRepository
                _iv_repo = AiInputVideoRepository(session=db)
                _iv_recs = _iv_repo.get_by_ids(_iv_ids)
                _source_video_urls = []
                for _iv_rec in _iv_recs:
                    _iv_assets = _iv_rec.assets_urls or {}
                    _source_video_urls.append(
                        _iv_assets.get("source_video") or _iv_rec.source_url
                    )
            except Exception:
                pass

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
            source_video_urls=_source_video_urls,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Store render job_id + start timestamp in metadata so frontend can resume
    # progress tracking after reload, AND so the watchdog in /render/status/
    # can detect stuck jobs.
    try:
        repo = AiVideoRepository(session=db)
        video_record = repo.get_by_video_id(video_id)
        if video_record:
            meta = dict(video_record.extra_metadata or {})
            meta["render_job_id"] = job_id
            from datetime import datetime, timezone
            meta["render_started_at"] = datetime.now(timezone.utc).isoformat()
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
    video_id: Optional[str] = None,
    institute_id: str = Depends(get_institute_from_api_key),
    db: Session = Depends(db_dependency),
):
    """
    Check the status and progress of a render job.

    Returns:
        - status: queued | running | completed | failed | unknown
        - progress: 0-100
        - video_url: S3 URL when completed
        - error: error message when failed

    Watchdog: when `video_id` is provided AND the job has been queued for
    longer than `RENDER_TIMEOUT_SECONDS` (default 600s, settable via env)
    AND the upstream status is still queued/running/unknown, the route
    synthesizes a "failed (timeout)" response, clears the stale render_job_id
    from the video metadata, and refunds the institute's render credits so
    the user can retry. This fires per-poll — the frontend's existing polling
    triggers it without a separate scheduler.
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

    # Watchdog: detect renders stuck past the timeout threshold and fail them
    # out so the frontend stops polling and the user can re-render.
    if video_id:
        try:
            from datetime import datetime, timezone
            timeout_seconds = int(os.environ.get("RENDER_TIMEOUT_SECONDS", "600"))
            cur_status = (result or {}).get("status", "")
            if cur_status not in ("completed", "failed"):
                repo = AiVideoRepository(session=db)
                video_record = repo.get_by_video_id(video_id)
                if video_record and video_record.extra_metadata:
                    started_iso = video_record.extra_metadata.get("render_started_at")
                    if started_iso:
                        try:
                            started_at = datetime.fromisoformat(started_iso)
                            if started_at.tzinfo is None:
                                started_at = started_at.replace(tzinfo=timezone.utc)
                            age_seconds = (datetime.now(timezone.utc) - started_at).total_seconds()
                            if age_seconds > timeout_seconds:
                                logger.error(
                                    f"[render-watchdog] Job {job_id} for video {video_id} "
                                    f"stuck for {age_seconds:.0f}s (> {timeout_seconds}s) "
                                    f"with status={cur_status} — marking failed and refunding credits"
                                )
                                # Clear the stale render_job_id so the user can re-render
                                new_meta = dict(video_record.extra_metadata)
                                new_meta.pop("render_job_id", None)
                                new_meta.pop("render_started_at", None)
                                new_meta["render_last_failed_at"] = datetime.now(timezone.utc).isoformat()
                                new_meta["render_last_failure_reason"] = (
                                    f"watchdog timeout after {age_seconds:.0f}s"
                                )
                                repo.update_metadata(video_id, new_meta)
                                # Best-effort credit refund — non-fatal if it errors
                                try:
                                    from ..services.token_usage_service import TokenUsageService
                                    TokenUsageService(db).refund_video_credits(video_id, institute_id)
                                except Exception as _refund_err:
                                    logger.warning(
                                        f"[render-watchdog] Refund failed for {video_id}: {_refund_err}"
                                    )
                                # Override the response so the frontend stops polling
                                result = {
                                    "status": "failed",
                                    "error": (
                                        f"Render timed out after {age_seconds:.0f}s "
                                        f"(threshold {timeout_seconds}s). Credits refunded; "
                                        f"please retry."
                                    ),
                                    "watchdog": True,
                                }
                        except (ValueError, TypeError) as _ts_err:
                            logger.debug(f"[render-watchdog] start timestamp parse error: {_ts_err}")
        except Exception as _wd_err:
            logger.warning(f"[render-watchdog] errored (non-fatal): {_wd_err}")

    return result


@router.delete("/render/{video_id}")
async def clear_rendered_video(
    video_id: str,
    institute_id: str = Depends(get_institute_from_api_key),
    db: Session = Depends(db_dependency),
):
    """
    Clear the rendered video URL for a video so it can be re-rendered.

    Removes `video` from s3_urls and file_ids, and removes `render_job_id`
    from metadata. The next call to /render/{video_id} will start a fresh
    render. Useful when the user wants to re-download with different settings.
    """
    repo = AiVideoRepository(session=db)
    updated = repo.clear_video_url(video_id)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")
    return {"status": "ok", "video_id": video_id, "message": "Rendered video cleared"}


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

# Google Cloud TTS voices (curated per language+gender for premium tier).
#
# Voice classes included (ordered by quality): Chirp3-HD > Neural2 > WaveNet > Standard.
# Studio voices are intentionally excluded — they do not support SSML timepoints,
# which breaks our word-level timestamp flow (see GoogleCloudTTSClient.synthesize).
#
# Canonical Chirp3-HD voice set (applied uniformly across supported locales):
#   female: Aoede, Kore, Leda, Zephyr
#   male:   Charon, Fenrir, Orus, Puck
#
# The list_voices() endpoint on Google's API is the authoritative source; the
# sample-generation script (scripts/generate_google_tts_samples.py) verifies
# each voice id exists before synthesizing a sample.
_CHIRP3_FEMALE = ["Aoede", "Kore", "Leda", "Zephyr"]
_CHIRP3_MALE = ["Charon", "Fenrir", "Orus", "Puck"]


def _chirp3_voices(locale: str, gender: str) -> List[Dict[str, str]]:
    names = _CHIRP3_FEMALE if gender == "female" else _CHIRP3_MALE
    return [
        {"id": f"{locale}-Chirp3-HD-{n}", "name": f"Chirp3 HD ({n})"}
        for n in names
    ]


def _neural2(locale: str, suffix: str) -> Dict[str, str]:
    return {"id": f"{locale}-Neural2-{suffix}", "name": f"Neural2 ({suffix})"}


def _wavenet(locale: str, suffix: str) -> Dict[str, str]:
    return {"id": f"{locale}-Wavenet-{suffix}", "name": f"WaveNet ({suffix})"}


def _standard(locale: str, suffix: str) -> Dict[str, str]:
    return {"id": f"{locale}-Standard-{suffix}", "name": f"Standard ({suffix})"}


def _news(locale: str, suffix: str) -> Dict[str, str]:
    return {"id": f"{locale}-News-{suffix}", "name": f"News ({suffix})"}


_GOOGLE_VOICES: Dict[str, Dict[str, List[Dict[str, str]]]] = {
    "afrikaans": {
        "female": [
            {"id": "af-ZA-Standard-A", "name": "Standard (A)"},
        ],
        "male": [],
    },
    "arabic": {
        "female": [
            {"id": "ar-XA-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "ar-XA-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "ar-XA-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "ar-XA-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "ar-XA-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "ar-XA-Wavenet-C", "name": "WaveNet (C)"},
            {"id": "ar-XA-Wavenet-D", "name": "WaveNet (D)"},
        ],
        "male": [
            {"id": "ar-XA-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "ar-XA-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "ar-XA-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "ar-XA-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "ar-XA-Wavenet-B", "name": "WaveNet (B)"},
        ],
    },
    "chinese": {
        "female": [
            {"id": "cmn-CN-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "cmn-CN-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "cmn-CN-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "cmn-CN-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "cmn-CN-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "cmn-CN-Wavenet-D", "name": "WaveNet (D)"},
            {"id": "cmn-CN-Standard-A", "name": "Standard (A)"},
            {"id": "cmn-CN-Standard-D", "name": "Standard (D)"},
        ],
        "male": [
            {"id": "cmn-CN-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "cmn-CN-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "cmn-CN-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "cmn-CN-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "cmn-CN-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "cmn-CN-Wavenet-C", "name": "WaveNet (C)"},
            {"id": "cmn-CN-Standard-B", "name": "Standard (B)"},
            {"id": "cmn-CN-Standard-C", "name": "Standard (C)"},
        ],
    },
    "chinese (taiwan)": {
        "female": [
            {"id": "cmn-TW-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "cmn-TW-Standard-A", "name": "Standard (A)"},
        ],
        "male": [
            {"id": "cmn-TW-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "cmn-TW-Wavenet-C", "name": "WaveNet (C)"},
            {"id": "cmn-TW-Standard-B", "name": "Standard (B)"},
            {"id": "cmn-TW-Standard-C", "name": "Standard (C)"},
        ],
    },
    "danish": {
        "female": [],
        "male": [
            {"id": "da-DK-Wavenet-G", "name": "WaveNet (G)"},
        ],
    },
    "dutch": {
        "female": [
            {"id": "nl-NL-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "nl-NL-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "nl-NL-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "nl-NL-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
        ],
        "male": [
            {"id": "nl-NL-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "nl-NL-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "nl-NL-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "nl-NL-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
        ],
    },
    "english (australia)": {
        "female": [
            {"id": "en-AU-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "en-AU-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "en-AU-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "en-AU-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "en-AU-Neural2-A", "name": "Neural2 (A)"},
            {"id": "en-AU-Neural2-C", "name": "Neural2 (C)"},
            {"id": "en-AU-News-E", "name": "News (E)"},
            {"id": "en-AU-News-F", "name": "News (F)"},
            {"id": "en-AU-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "en-AU-Wavenet-C", "name": "WaveNet (C)"},
        ],
        "male": [
            {"id": "en-AU-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "en-AU-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "en-AU-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "en-AU-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "en-AU-Neural2-B", "name": "Neural2 (B)"},
            {"id": "en-AU-Neural2-D", "name": "Neural2 (D)"},
            {"id": "en-AU-News-G", "name": "News (G)"},
            {"id": "en-AU-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "en-AU-Wavenet-D", "name": "WaveNet (D)"},
        ],
    },
    "english (india)": {
        "female": [
            {"id": "en-IN-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "en-IN-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "en-IN-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "en-IN-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "en-IN-Neural2-A", "name": "Neural2 (A)"},
            {"id": "en-IN-Neural2-D", "name": "Neural2 (D)"},
            {"id": "en-IN-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "en-IN-Wavenet-D", "name": "WaveNet (D)"},
        ],
        "male": [
            {"id": "en-IN-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "en-IN-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "en-IN-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "en-IN-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "en-IN-Neural2-B", "name": "Neural2 (B)"},
            {"id": "en-IN-Neural2-C", "name": "Neural2 (C)"},
            {"id": "en-IN-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "en-IN-Wavenet-C", "name": "WaveNet (C)"},
        ],
    },
    "english (uk)": {
        "female": [
            {"id": "en-GB-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "en-GB-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "en-GB-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "en-GB-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "en-GB-Neural2-A", "name": "Neural2 (A)"},
            {"id": "en-GB-Neural2-C", "name": "Neural2 (C)"},
            {"id": "en-GB-Neural2-F", "name": "Neural2 (F)"},
            {"id": "en-GB-News-G", "name": "News (G)"},
            {"id": "en-GB-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "en-GB-Wavenet-C", "name": "WaveNet (C)"},
        ],
        "male": [
            {"id": "en-GB-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "en-GB-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "en-GB-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "en-GB-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "en-GB-Neural2-B", "name": "Neural2 (B)"},
            {"id": "en-GB-Neural2-D", "name": "Neural2 (D)"},
            {"id": "en-GB-News-J", "name": "News (J)"},
            {"id": "en-GB-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "en-GB-Wavenet-D", "name": "WaveNet (D)"},
        ],
    },
    "english (us)": {
        "female": [
            {"id": "en-US-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "en-US-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "en-US-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "en-US-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "en-US-Neural2-C", "name": "Neural2 (C)"},
            {"id": "en-US-Neural2-F", "name": "Neural2 (F)"},
            {"id": "en-US-Neural2-H", "name": "Neural2 (H)"},
            {"id": "en-US-News-K", "name": "News (K)"},
            {"id": "en-US-News-L", "name": "News (L)"},
            {"id": "en-US-Wavenet-C", "name": "WaveNet (C)"},
            {"id": "en-US-Wavenet-F", "name": "WaveNet (F)"},
        ],
        "male": [
            {"id": "en-US-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "en-US-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "en-US-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "en-US-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "en-US-Neural2-A", "name": "Neural2 (A)"},
            {"id": "en-US-Neural2-D", "name": "Neural2 (D)"},
            {"id": "en-US-Neural2-I", "name": "Neural2 (I)"},
            {"id": "en-US-Neural2-J", "name": "Neural2 (J)"},
            {"id": "en-US-News-N", "name": "News (N)"},
            {"id": "en-US-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "en-US-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "en-US-Wavenet-D", "name": "WaveNet (D)"},
        ],
    },
    "filipino": {
        "female": [
            {"id": "fil-PH-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "fil-PH-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "fil-PH-Standard-A", "name": "Standard (A)"},
        ],
        "male": [
            {"id": "fil-PH-Wavenet-C", "name": "WaveNet (C)"},
            {"id": "fil-PH-Wavenet-D", "name": "WaveNet (D)"},
        ],
    },
    "french": {
        "female": [
            {"id": "fr-FR-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "fr-FR-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "fr-FR-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "fr-FR-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
        ],
        "male": [
            {"id": "fr-FR-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "fr-FR-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "fr-FR-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "fr-FR-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
        ],
    },
    "french (canada)": {
        "female": [
            {"id": "fr-CA-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "fr-CA-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "fr-CA-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "fr-CA-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "fr-CA-Neural2-A", "name": "Neural2 (A)"},
            {"id": "fr-CA-Neural2-C", "name": "Neural2 (C)"},
            {"id": "fr-CA-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "fr-CA-Wavenet-C", "name": "WaveNet (C)"},
        ],
        "male": [
            {"id": "fr-CA-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "fr-CA-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "fr-CA-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "fr-CA-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "fr-CA-Neural2-B", "name": "Neural2 (B)"},
            {"id": "fr-CA-Neural2-D", "name": "Neural2 (D)"},
            {"id": "fr-CA-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "fr-CA-Wavenet-D", "name": "WaveNet (D)"},
        ],
    },
    "german": {
        "female": [
            {"id": "de-DE-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "de-DE-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "de-DE-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "de-DE-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
        ],
        "male": [
            {"id": "de-DE-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "de-DE-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "de-DE-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "de-DE-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
        ],
    },
    "hebrew": {
        "female": [
            {"id": "he-IL-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "he-IL-Wavenet-C", "name": "WaveNet (C)"},
            {"id": "he-IL-Standard-A", "name": "Standard (A)"},
        ],
        "male": [
            {"id": "he-IL-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "he-IL-Wavenet-D", "name": "WaveNet (D)"},
            {"id": "he-IL-Standard-B", "name": "Standard (B)"},
        ],
    },
    "indonesian": {
        "female": [
            {"id": "id-ID-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "id-ID-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "id-ID-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "id-ID-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "id-ID-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "id-ID-Wavenet-D", "name": "WaveNet (D)"},
        ],
        "male": [
            {"id": "id-ID-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "id-ID-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "id-ID-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "id-ID-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "id-ID-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "id-ID-Wavenet-C", "name": "WaveNet (C)"},
        ],
    },
    "italian": {
        "female": [
            {"id": "it-IT-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "it-IT-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "it-IT-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "it-IT-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "it-IT-Neural2-A", "name": "Neural2 (A)"},
        ],
        "male": [
            {"id": "it-IT-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "it-IT-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "it-IT-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "it-IT-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
        ],
    },
    "japanese": {
        "female": [
            {"id": "ja-JP-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "ja-JP-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "ja-JP-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "ja-JP-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "ja-JP-Neural2-B", "name": "Neural2 (B)"},
            {"id": "ja-JP-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "ja-JP-Wavenet-B", "name": "WaveNet (B)"},
        ],
        "male": [
            {"id": "ja-JP-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "ja-JP-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "ja-JP-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "ja-JP-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "ja-JP-Neural2-C", "name": "Neural2 (C)"},
            {"id": "ja-JP-Neural2-D", "name": "Neural2 (D)"},
            {"id": "ja-JP-Wavenet-C", "name": "WaveNet (C)"},
            {"id": "ja-JP-Wavenet-D", "name": "WaveNet (D)"},
        ],
    },
    "korean": {
        "female": [
            {"id": "ko-KR-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "ko-KR-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "ko-KR-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "ko-KR-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "ko-KR-Neural2-A", "name": "Neural2 (A)"},
            {"id": "ko-KR-Neural2-B", "name": "Neural2 (B)"},
            {"id": "ko-KR-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "ko-KR-Wavenet-B", "name": "WaveNet (B)"},
        ],
        "male": [
            {"id": "ko-KR-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "ko-KR-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "ko-KR-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "ko-KR-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "ko-KR-Neural2-C", "name": "Neural2 (C)"},
            {"id": "ko-KR-Wavenet-C", "name": "WaveNet (C)"},
            {"id": "ko-KR-Wavenet-D", "name": "WaveNet (D)"},
        ],
    },
    "malay": {
        "female": [
            {"id": "ms-MY-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "ms-MY-Wavenet-C", "name": "WaveNet (C)"},
            {"id": "ms-MY-Standard-A", "name": "Standard (A)"},
        ],
        "male": [
            {"id": "ms-MY-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "ms-MY-Wavenet-D", "name": "WaveNet (D)"},
            {"id": "ms-MY-Standard-B", "name": "Standard (B)"},
        ],
    },
    "polish": {
        "female": [
            {"id": "pl-PL-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "pl-PL-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "pl-PL-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "pl-PL-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
        ],
        "male": [
            {"id": "pl-PL-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "pl-PL-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "pl-PL-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "pl-PL-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
        ],
    },
    "portuguese (brazil)": {
        "female": [
            {"id": "pt-BR-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "pt-BR-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "pt-BR-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "pt-BR-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "pt-BR-Neural2-A", "name": "Neural2 (A)"},
            {"id": "pt-BR-Neural2-C", "name": "Neural2 (C)"},
            {"id": "pt-BR-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "pt-BR-Wavenet-C", "name": "WaveNet (C)"},
        ],
        "male": [
            {"id": "pt-BR-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "pt-BR-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "pt-BR-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "pt-BR-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "pt-BR-Neural2-B", "name": "Neural2 (B)"},
            {"id": "pt-BR-Wavenet-B", "name": "WaveNet (B)"},
        ],
    },
    "russian": {
        "female": [
            {"id": "ru-RU-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "ru-RU-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "ru-RU-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "ru-RU-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "ru-RU-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "ru-RU-Wavenet-C", "name": "WaveNet (C)"},
            {"id": "ru-RU-Wavenet-E", "name": "WaveNet (E)"},
        ],
        "male": [
            {"id": "ru-RU-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "ru-RU-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "ru-RU-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "ru-RU-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "ru-RU-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "ru-RU-Wavenet-D", "name": "WaveNet (D)"},
        ],
    },
    "spanish": {
        "female": [
            {"id": "es-ES-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "es-ES-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "es-ES-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "es-ES-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "es-ES-Neural2-A", "name": "Neural2 (A)"},
        ],
        "male": [
            {"id": "es-ES-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "es-ES-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "es-ES-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "es-ES-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "es-ES-Neural2-F", "name": "Neural2 (F)"},
        ],
    },
    "spanish (us)": {
        "female": [
            {"id": "es-US-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "es-US-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "es-US-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "es-US-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "es-US-Neural2-A", "name": "Neural2 (A)"},
            {"id": "es-US-News-F", "name": "News (F)"},
            {"id": "es-US-News-G", "name": "News (G)"},
            {"id": "es-US-Wavenet-A", "name": "WaveNet (A)"},
        ],
        "male": [
            {"id": "es-US-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "es-US-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "es-US-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "es-US-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "es-US-Neural2-B", "name": "Neural2 (B)"},
            {"id": "es-US-Neural2-C", "name": "Neural2 (C)"},
            {"id": "es-US-News-D", "name": "News (D)"},
            {"id": "es-US-News-E", "name": "News (E)"},
            {"id": "es-US-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "es-US-Wavenet-C", "name": "WaveNet (C)"},
        ],
    },
    "swedish": {
        "female": [
            {"id": "sv-SE-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "sv-SE-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "sv-SE-Wavenet-D", "name": "WaveNet (D)"},
        ],
        "male": [
            {"id": "sv-SE-Wavenet-C", "name": "WaveNet (C)"},
            {"id": "sv-SE-Wavenet-E", "name": "WaveNet (E)"},
            {"id": "sv-SE-Wavenet-F", "name": "WaveNet (F)"},
        ],
    },
    "thai": {
        "female": [
            {"id": "th-TH-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "th-TH-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "th-TH-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "th-TH-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "th-TH-Neural2-C", "name": "Neural2 (C)"},
            {"id": "th-TH-Standard-A", "name": "Standard (A)"},
        ],
        "male": [
            {"id": "th-TH-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "th-TH-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "th-TH-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "th-TH-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
        ],
    },
    "turkish": {
        "female": [
            {"id": "tr-TR-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "tr-TR-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "tr-TR-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "tr-TR-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "tr-TR-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "tr-TR-Wavenet-C", "name": "WaveNet (C)"},
            {"id": "tr-TR-Wavenet-D", "name": "WaveNet (D)"},
            {"id": "tr-TR-Wavenet-E", "name": "WaveNet (E)"},
        ],
        "male": [
            {"id": "tr-TR-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "tr-TR-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "tr-TR-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "tr-TR-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "tr-TR-Wavenet-B", "name": "WaveNet (B)"},
        ],
    },
    "ukrainian": {
        "female": [
            {"id": "uk-UA-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "uk-UA-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "uk-UA-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "uk-UA-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
        ],
        "male": [
            {"id": "uk-UA-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "uk-UA-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "uk-UA-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "uk-UA-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
        ],
    },
    "urdu": {
        "female": [
            {"id": "ur-IN-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "ur-IN-Standard-A", "name": "Standard (A)"},
        ],
        "male": [
            {"id": "ur-IN-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "ur-IN-Standard-B", "name": "Standard (B)"},
        ],
    },
    "vietnamese": {
        "female": [
            {"id": "vi-VN-Chirp3-HD-Aoede", "name": "Chirp3 HD (Aoede)"},
            {"id": "vi-VN-Chirp3-HD-Kore", "name": "Chirp3 HD (Kore)"},
            {"id": "vi-VN-Chirp3-HD-Leda", "name": "Chirp3 HD (Leda)"},
            {"id": "vi-VN-Chirp3-HD-Zephyr", "name": "Chirp3 HD (Zephyr)"},
            {"id": "vi-VN-Wavenet-A", "name": "WaveNet (A)"},
            {"id": "vi-VN-Wavenet-C", "name": "WaveNet (C)"},
        ],
        "male": [
            {"id": "vi-VN-Chirp3-HD-Charon", "name": "Chirp3 HD (Charon)"},
            {"id": "vi-VN-Chirp3-HD-Fenrir", "name": "Chirp3 HD (Fenrir)"},
            {"id": "vi-VN-Chirp3-HD-Orus", "name": "Chirp3 HD (Orus)"},
            {"id": "vi-VN-Chirp3-HD-Puck", "name": "Chirp3 HD (Puck)"},
            {"id": "vi-VN-Wavenet-B", "name": "WaveNet (B)"},
            {"id": "vi-VN-Wavenet-D", "name": "WaveNet (D)"},
        ],
    },
}

# language-key → BCP-47 locale code used by Google TTS.
# Canonical source for picking locale when voice_id is not pre-mapped.
_GOOGLE_LANG_CODES: Dict[str, str] = {
    "english (us)": "en-US",
    "english (uk)": "en-GB",
    "english (australia)": "en-AU",
    "english (india)": "en-IN",
    "spanish": "es-ES",
    "spanish (us)": "es-US",
    "portuguese (brazil)": "pt-BR",
    "portuguese (portugal)": "pt-PT",
    "french": "fr-FR",
    "french (canada)": "fr-CA",
    "german": "de-DE",
    "italian": "it-IT",
    "dutch": "nl-NL",
    "dutch (belgium)": "nl-BE",
    "danish": "da-DK",
    "finnish": "fi-FI",
    "norwegian": "nb-NO",
    "swedish": "sv-SE",
    "icelandic": "is-IS",
    "polish": "pl-PL",
    "russian": "ru-RU",
    "ukrainian": "uk-UA",
    "czech": "cs-CZ",
    "slovak": "sk-SK",
    "hungarian": "hu-HU",
    "romanian": "ro-RO",
    "bulgarian": "bg-BG",
    "greek": "el-GR",
    "arabic": "ar-XA",
    "hebrew": "he-IL",
    "turkish": "tr-TR",
    "afrikaans": "af-ZA",
    "catalan": "ca-ES",
    "indonesian": "id-ID",
    "malay": "ms-MY",
    "filipino": "fil-PH",
    "vietnamese": "vi-VN",
    "thai": "th-TH",
    "urdu": "ur-IN",
    "japanese": "ja-JP",
    "korean": "ko-KR",
    "chinese": "cmn-CN",
    "chinese (taiwan)": "cmn-TW",
}

# Google Cloud TTS voice sample URLs (S3-hosted mp3 previews).
# Populated by scripts/generate_google_tts_samples.py — paste the dict it emits here.
_GOOGLE_SAMPLE_URLS: Dict[str, str] = {
    "af-ZA-Standard-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/0ee00995-26f2-40a6-b40f-99d3ab099195-af-ZA-Standard-A.mp3",
    "ar-XA-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/9daad59a-9a33-42de-b4a5-264a1150e317-ar-XA-Chirp3-HD-Aoede.mp3",
    "ar-XA-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/2484a85f-27e0-459e-8092-e387cb92ed24-ar-XA-Chirp3-HD-Charon.mp3",
    "ar-XA-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/6ada24f4-d3c5-443f-bc63-c10b1b3fe3f2-ar-XA-Chirp3-HD-Fenrir.mp3",
    "ar-XA-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c6a68b3b-8a3a-45cf-a503-f7843637ac7a-ar-XA-Chirp3-HD-Kore.mp3",
    "ar-XA-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/da76a122-b60d-4173-a6bf-879644441379-ar-XA-Chirp3-HD-Leda.mp3",
    "ar-XA-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b5936c33-c289-4e59-8861-26f5223b2f75-ar-XA-Chirp3-HD-Orus.mp3",
    "ar-XA-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c71ba9f4-bcf0-40ae-879d-25075a5b1e53-ar-XA-Chirp3-HD-Puck.mp3",
    "ar-XA-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/7375e736-c7b7-46eb-be6a-1620ace4f477-ar-XA-Chirp3-HD-Zephyr.mp3",
    "ar-XA-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/2e6d9d07-7f30-4e9d-ac98-28d852c38716-ar-XA-Wavenet-A.mp3",
    "ar-XA-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/81ece4df-b779-4512-ab6f-210ed9d4368c-ar-XA-Wavenet-B.mp3",
    "ar-XA-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/167bd65c-7023-460d-8a12-21309774b5ad-ar-XA-Wavenet-C.mp3",
    "ar-XA-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/41c2df1b-3ec1-4f34-9971-d6ea00af8b83-ar-XA-Wavenet-D.mp3",
    "cmn-CN-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/429574bb-5782-4f37-9902-41817c9cc78d-cmn-CN-Chirp3-HD-Aoede.mp3",
    "cmn-CN-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/0d05e2dc-43aa-4fe5-93d5-207144a2b9f1-cmn-CN-Chirp3-HD-Charon.mp3",
    "cmn-CN-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/25b1da26-05e8-4a51-91f7-019400fc7ae5-cmn-CN-Chirp3-HD-Fenrir.mp3",
    "cmn-CN-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/e940c408-bbeb-4b1c-b99d-e53732c85ef2-cmn-CN-Chirp3-HD-Kore.mp3",
    "cmn-CN-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/2627efcf-fd5d-439e-8afb-b954ed53435c-cmn-CN-Chirp3-HD-Leda.mp3",
    "cmn-CN-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/95bc748a-58b4-4753-852d-aee2a2a56cc8-cmn-CN-Chirp3-HD-Orus.mp3",
    "cmn-CN-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/ec40d815-5e5a-4bfb-b9d1-7585c24ec78c-cmn-CN-Chirp3-HD-Puck.mp3",
    "cmn-CN-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/37ecf09e-2f0e-4571-9b73-d27c021b38cd-cmn-CN-Chirp3-HD-Zephyr.mp3",
    "cmn-CN-Standard-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/144fbbde-3b5a-40a5-bcb5-285fc1791e27-cmn-CN-Standard-A.mp3",
    "cmn-CN-Standard-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/70b96d72-cd8a-4dc9-93d4-5eb828e9cac2-cmn-CN-Standard-B.mp3",
    "cmn-CN-Standard-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b02e75b5-81c7-459c-a470-e0e7c881d29c-cmn-CN-Standard-C.mp3",
    "cmn-CN-Standard-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/da55db27-c61f-447e-bdd5-90cb86b6e12a-cmn-CN-Standard-D.mp3",
    "cmn-CN-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b14cd813-dbca-4494-bc4b-e9de743ebf5d-cmn-CN-Wavenet-A.mp3",
    "cmn-CN-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/42dcb358-e03e-42d4-9334-4cffe37e1434-cmn-CN-Wavenet-B.mp3",
    "cmn-CN-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/58b50caa-54f1-413a-b32b-7364b4b26a0d-cmn-CN-Wavenet-C.mp3",
    "cmn-CN-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/85fee933-6085-4b9b-970c-314aef41548a-cmn-CN-Wavenet-D.mp3",
    "cmn-TW-Standard-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/0a4c33ab-ab9f-4f53-bc11-29a41e08af88-cmn-TW-Standard-A.mp3",
    "cmn-TW-Standard-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/4b07bc85-08b2-4844-9fd0-395989c21f20-cmn-TW-Standard-B.mp3",
    "cmn-TW-Standard-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/116d64e1-52ab-49ea-90e5-85a708c101a2-cmn-TW-Standard-C.mp3",
    "cmn-TW-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/38d592a5-1200-4ab4-a551-1ed10035f09d-cmn-TW-Wavenet-A.mp3",
    "cmn-TW-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b6d70ea4-0f52-47e2-be17-a15d9cfc4430-cmn-TW-Wavenet-B.mp3",
    "cmn-TW-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/5247d64f-403a-4989-9c30-fab22cfc36be-cmn-TW-Wavenet-C.mp3",
    "da-DK-Wavenet-G": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/bc0e0a04-cd66-43e8-9715-728a675efc1c-da-DK-Wavenet-G.mp3",
    "de-DE-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/14735762-277c-4dac-8209-b8961b27e920-de-DE-Chirp3-HD-Aoede.mp3",
    "de-DE-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/6db3f3e6-e6a8-45cd-a2e9-9ca5e75aaa6e-de-DE-Chirp3-HD-Charon.mp3",
    "de-DE-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/9f261ca3-a0e9-40bb-9272-59c5afbe5cff-de-DE-Chirp3-HD-Fenrir.mp3",
    "de-DE-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/83fd205a-9977-41ea-a334-cd727a25be0c-de-DE-Chirp3-HD-Kore.mp3",
    "de-DE-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b0dfb527-96ed-4e59-8256-9482444ae08f-de-DE-Chirp3-HD-Leda.mp3",
    "de-DE-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/ffd4ba75-4200-4583-a547-ebb28ba39486-de-DE-Chirp3-HD-Orus.mp3",
    "de-DE-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/059b1da2-de2e-41fe-8964-04b6805f03a3-de-DE-Chirp3-HD-Puck.mp3",
    "de-DE-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/d1660d00-3a17-4de8-a2f9-713ab0df3f10-de-DE-Chirp3-HD-Zephyr.mp3",
    "en-AU-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/59430f63-f0a7-4966-9134-2340c5d6feea-en-AU-Chirp3-HD-Aoede.mp3",
    "en-AU-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/f3953950-3f8b-4b8d-a630-ad53dfb5e14d-en-AU-Chirp3-HD-Charon.mp3",
    "en-AU-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/7b061204-ef71-4b59-aa60-3ce2e40159b1-en-AU-Chirp3-HD-Fenrir.mp3",
    "en-AU-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/7f90f8f5-3e6c-4a16-8208-93fb893cacb6-en-AU-Chirp3-HD-Kore.mp3",
    "en-AU-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/f0623fe5-b332-4b0c-bffc-d38a46fad765-en-AU-Chirp3-HD-Leda.mp3",
    "en-AU-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/167408c8-5a36-4cb4-8a8b-ea78bfe6e265-en-AU-Chirp3-HD-Orus.mp3",
    "en-AU-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/8ace3b09-b8d3-430d-bf4f-db9f965f35b9-en-AU-Chirp3-HD-Puck.mp3",
    "en-AU-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/73b8a2d2-0736-4933-9054-b83105d394d2-en-AU-Chirp3-HD-Zephyr.mp3",
    "en-AU-Neural2-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/278923e3-2853-432f-b529-fffebd62bf63-en-AU-Neural2-A.mp3",
    "en-AU-Neural2-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/0e739728-750a-4268-8f09-fd137e9db1cd-en-AU-Neural2-B.mp3",
    "en-AU-Neural2-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/6af8cc14-2dd0-48ef-bfac-2d8fe429f2be-en-AU-Neural2-C.mp3",
    "en-AU-Neural2-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/42d0d119-bbc9-4fc3-a4f4-6475734990e2-en-AU-Neural2-D.mp3",
    "en-AU-News-E": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/88dd23c9-4fbc-4e9b-a194-d3485d028bde-en-AU-News-E.mp3",
    "en-AU-News-F": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/3eb444b3-f75c-4821-95f4-573854e9cc8f-en-AU-News-F.mp3",
    "en-AU-News-G": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/1c4082bd-5438-4946-87cf-0fd6edf4156e-en-AU-News-G.mp3",
    "en-AU-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/97b0be7c-45a9-410f-824c-58c0e6f347b8-en-AU-Wavenet-A.mp3",
    "en-AU-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b51638d3-d1ae-4bd7-8933-af9382c897fd-en-AU-Wavenet-B.mp3",
    "en-AU-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/34275b40-206a-4a1b-9ead-d0845927dc18-en-AU-Wavenet-C.mp3",
    "en-AU-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/e34291b6-1632-4893-80bd-bdfbe5a6a32c-en-AU-Wavenet-D.mp3",
    "en-GB-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/d6a01244-034f-4141-907f-9aa6c4c11775-en-GB-Chirp3-HD-Aoede.mp3",
    "en-GB-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/55f00ce9-281f-461d-96f8-264d930c5be8-en-GB-Chirp3-HD-Charon.mp3",
    "en-GB-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c7387d71-b221-4600-a75a-8c6dc86c619e-en-GB-Chirp3-HD-Fenrir.mp3",
    "en-GB-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/90595982-5cb9-48f0-a1aa-5bbf34e7488b-en-GB-Chirp3-HD-Kore.mp3",
    "en-GB-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c912cf12-4248-4a94-ae61-a81168fc4b66-en-GB-Chirp3-HD-Leda.mp3",
    "en-GB-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/69e90f92-a700-4a14-b112-68e68dadf485-en-GB-Chirp3-HD-Orus.mp3",
    "en-GB-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/d6f8f8e0-2e5c-4ca8-ab8c-4434f5eabbbd-en-GB-Chirp3-HD-Puck.mp3",
    "en-GB-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/8c56d25c-bfe6-4eef-aa42-f3968beb83e3-en-GB-Chirp3-HD-Zephyr.mp3",
    "en-GB-Neural2-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/1357d789-38a8-43c1-bfa0-3c1a6be2d8cd-en-GB-Neural2-A.mp3",
    "en-GB-Neural2-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/78ba490c-10fb-42d1-aac2-7a04020b2501-en-GB-Neural2-B.mp3",
    "en-GB-Neural2-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/d3842387-160c-427c-8196-4cb69a863326-en-GB-Neural2-C.mp3",
    "en-GB-Neural2-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/2c88f194-2ca5-45af-8bfd-98d821710d98-en-GB-Neural2-D.mp3",
    "en-GB-Neural2-F": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/d0ca05c6-6330-43f9-a882-083d9982a369-en-GB-Neural2-F.mp3",
    "en-GB-News-G": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/7a8917b0-7139-425c-914b-0192f5d1c279-en-GB-News-G.mp3",
    "en-GB-News-J": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/7d1f6390-76f7-43d8-ac75-b205338dfd34-en-GB-News-J.mp3",
    "en-GB-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/8993e60f-263d-462f-9b62-9db51930805c-en-GB-Wavenet-A.mp3",
    "en-GB-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/f078c423-4cfc-4728-8981-af0d2ac90f25-en-GB-Wavenet-B.mp3",
    "en-GB-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b395a98b-fdea-45e7-9e57-ac0e51c941ad-en-GB-Wavenet-C.mp3",
    "en-GB-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/58cedbd8-3a19-417e-9af5-c1b36a5bfce5-en-GB-Wavenet-D.mp3",
    "en-IN-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/da2d58f2-33a8-41be-b1df-74f7a6151f15-en-IN-Chirp3-HD-Aoede.mp3",
    "en-IN-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/bfd5805d-887a-4526-bd38-c5cf5e04b3f5-en-IN-Chirp3-HD-Charon.mp3",
    "en-IN-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b038b8ba-399e-4271-9689-85085a616855-en-IN-Chirp3-HD-Fenrir.mp3",
    "en-IN-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/cf94b7d9-0cc8-4c89-a9e1-d5c9a6580982-en-IN-Chirp3-HD-Kore.mp3",
    "en-IN-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/230ae0b8-fb11-4cd0-bdde-388c9e08ab65-en-IN-Chirp3-HD-Leda.mp3",
    "en-IN-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/7ac2ce0f-0ddd-4e45-8ead-7f1835dc0476-en-IN-Chirp3-HD-Orus.mp3",
    "en-IN-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/50235ced-2e03-41f5-ac46-82095dc290a5-en-IN-Chirp3-HD-Puck.mp3",
    "en-IN-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c7b25b16-6da2-4437-a793-51b85fa5726a-en-IN-Chirp3-HD-Zephyr.mp3",
    "en-IN-Neural2-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/2479eea4-aec0-4d1c-ad45-f09687fb447e-en-IN-Neural2-A.mp3",
    "en-IN-Neural2-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/5acc029e-9d35-4c62-b874-0317596f13a5-en-IN-Neural2-B.mp3",
    "en-IN-Neural2-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/29c80db2-d36c-4c80-a6b6-90a2d0087e62-en-IN-Neural2-C.mp3",
    "en-IN-Neural2-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/943ec606-2391-480b-9ff3-5471cd0075ee-en-IN-Neural2-D.mp3",
    "en-IN-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/7ea7a226-9136-4913-a49d-ab79089658ef-en-IN-Wavenet-A.mp3",
    "en-IN-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/0d61d73b-c7d1-4d68-b248-b1e3d0f7b6a3-en-IN-Wavenet-B.mp3",
    "en-IN-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/ddf65a88-bb40-4870-9904-648ed6e71c30-en-IN-Wavenet-C.mp3",
    "en-IN-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/1e1c47c2-ff64-488a-80e1-f19a40b8a032-en-IN-Wavenet-D.mp3",
    "en-US-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/3b2ef76f-202f-4a94-a978-92f8c252c229-en-US-Chirp3-HD-Aoede.mp3",
    "en-US-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/e6da6651-b80f-4c94-9c7e-c30b48432cc3-en-US-Chirp3-HD-Charon.mp3",
    "en-US-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c23d8ba6-36bd-45d9-b6ad-bc0afa4fabc7-en-US-Chirp3-HD-Fenrir.mp3",
    "en-US-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/6494e1a5-fe7e-4dca-99ac-abfcb286ab24-en-US-Chirp3-HD-Kore.mp3",
    "en-US-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/8846ce2b-826b-445a-861f-ba0d61f88002-en-US-Chirp3-HD-Leda.mp3",
    "en-US-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c981f8eb-5a3c-43f5-acf2-5f5d448fbecf-en-US-Chirp3-HD-Orus.mp3",
    "en-US-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/5f19d305-0772-4dab-a83e-6cbae8324a99-en-US-Chirp3-HD-Puck.mp3",
    "en-US-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/51d3a726-a29c-442f-bf9d-a40c31949a08-en-US-Chirp3-HD-Zephyr.mp3",
    "en-US-Neural2-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/05bd2072-9513-40e5-864f-f0ff9d146e91-en-US-Neural2-A.mp3",
    "en-US-Neural2-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/6744636b-a1f1-43b9-ab15-796e5b1c2a32-en-US-Neural2-C.mp3",
    "en-US-Neural2-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/08c535d2-9fc2-4bfd-87c5-7dc97fdf5d07-en-US-Neural2-D.mp3",
    "en-US-Neural2-F": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/03dcfc43-73b3-4171-ace3-25a8d1807f53-en-US-Neural2-F.mp3",
    "en-US-Neural2-H": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/af97f9af-c47e-4090-9acb-06b53cf68477-en-US-Neural2-H.mp3",
    "en-US-Neural2-I": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/5c9f486c-1f0c-42ce-8fe5-da09db37abe8-en-US-Neural2-I.mp3",
    "en-US-Neural2-J": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/624663eb-a055-401b-90fb-ba559989f709-en-US-Neural2-J.mp3",
    "en-US-News-K": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/dc746bf3-26ae-4a85-a0e4-ace0ad2cec14-en-US-News-K.mp3",
    "en-US-News-L": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c78a1934-d9d3-43aa-a8fa-fe6886311587-en-US-News-L.mp3",
    "en-US-News-N": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/e221607b-7a80-41ce-9d19-8d0684793a19-en-US-News-N.mp3",
    "en-US-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c8510ce2-088c-4e8d-a28e-84b16a8c6bf4-en-US-Wavenet-A.mp3",
    "en-US-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/4d2612fe-b5ea-464c-b382-5fde310813ca-en-US-Wavenet-B.mp3",
    "en-US-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/3e7ad80a-6cdb-45bf-998a-2cbf4588184b-en-US-Wavenet-C.mp3",
    "en-US-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b4790b7f-f680-41dd-906e-2d7404ea5fa7-en-US-Wavenet-D.mp3",
    "en-US-Wavenet-F": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/daf83e63-01c4-48fa-af80-51505b8f2c8d-en-US-Wavenet-F.mp3",
    "es-ES-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c14db99f-5cda-485a-a27d-b90f26e52c2a-es-ES-Chirp3-HD-Aoede.mp3",
    "es-ES-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/e12cc162-4263-40b4-90b7-c6fd05158e9e-es-ES-Chirp3-HD-Charon.mp3",
    "es-ES-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/724e7cc3-2645-47ae-9566-abd9aa318155-es-ES-Chirp3-HD-Fenrir.mp3",
    "es-ES-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/d575fd5f-0743-4e83-9a59-ca6409e71df2-es-ES-Chirp3-HD-Kore.mp3",
    "es-ES-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/8c151a01-7891-41c5-9435-60b2202b01fc-es-ES-Chirp3-HD-Leda.mp3",
    "es-ES-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/dfb7a42b-59f3-495d-ab85-44640b38e223-es-ES-Chirp3-HD-Orus.mp3",
    "es-ES-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/88910e52-ed5a-41ea-8cd2-c2f2371f7089-es-ES-Chirp3-HD-Puck.mp3",
    "es-ES-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/018395ae-0f60-4195-8e47-cae68004322b-es-ES-Chirp3-HD-Zephyr.mp3",
    "es-ES-Neural2-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/588b36fc-b4a3-44db-bc22-15990d707d70-es-ES-Neural2-A.mp3",
    "es-ES-Neural2-F": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/d9ee6ca6-78ef-43f1-9cd2-d2ef3073bee9-es-ES-Neural2-F.mp3",
    "es-US-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/48fa0246-e720-4986-ba79-89bc5dc0600c-es-US-Chirp3-HD-Aoede.mp3",
    "es-US-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/ca2c3ce5-8451-46bb-87ed-1fb6a190a8b2-es-US-Chirp3-HD-Charon.mp3",
    "es-US-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/60281423-629a-46a9-b942-f2286d813f06-es-US-Chirp3-HD-Fenrir.mp3",
    "es-US-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/54a7cbcc-c816-4528-8a4c-51e4c9eb9608-es-US-Chirp3-HD-Kore.mp3",
    "es-US-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/af2da2f0-048a-4568-a780-bf99da4a9463-es-US-Chirp3-HD-Leda.mp3",
    "es-US-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/e6a80cf1-8bf8-4a40-bf97-70d7a41902c3-es-US-Chirp3-HD-Orus.mp3",
    "es-US-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/4bae8eda-4295-4e28-86fa-edd109170801-es-US-Chirp3-HD-Puck.mp3",
    "es-US-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/6d479d7e-3d79-447a-b00a-b00e69fe86c6-es-US-Chirp3-HD-Zephyr.mp3",
    "es-US-Neural2-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/5171d360-7dc4-4aeb-a751-8559fa886639-es-US-Neural2-A.mp3",
    "es-US-Neural2-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/a7418702-b9c7-484d-a46d-96306c31857d-es-US-Neural2-B.mp3",
    "es-US-Neural2-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/23d26183-ac83-4ed6-86a0-47f3c86f8e71-es-US-Neural2-C.mp3",
    "es-US-News-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/8ac2b900-ba71-4612-98de-7e6b602a4fa9-es-US-News-D.mp3",
    "es-US-News-E": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/3ab80f14-1106-445c-b9d7-cd0c2b4e9d44-es-US-News-E.mp3",
    "es-US-News-F": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/53bdb66a-f37b-42d6-99c0-93cd23a8ba34-es-US-News-F.mp3",
    "es-US-News-G": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/5f48c495-373f-436c-9793-a04fd6b76fab-es-US-News-G.mp3",
    "es-US-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/2f7c43aa-d384-466b-a5c9-a6410a9f6695-es-US-Wavenet-A.mp3",
    "es-US-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/6ef4313e-3efe-471e-80cc-8a9ccd9c7b2d-es-US-Wavenet-B.mp3",
    "es-US-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/8acea364-f598-4730-a03d-d31399d74ee4-es-US-Wavenet-C.mp3",
    "fil-PH-Standard-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/95dec118-ff89-4a2d-af11-c806daf495af-fil-PH-Standard-A.mp3",
    "fil-PH-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/29741809-2e2c-4fc9-accf-068d8351763d-fil-PH-Wavenet-A.mp3",
    "fil-PH-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/70f47724-11a9-4a7b-af49-de296b02cb65-fil-PH-Wavenet-B.mp3",
    "fil-PH-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/2eea8635-10cb-4f3a-aaba-d4c7a723f4bc-fil-PH-Wavenet-C.mp3",
    "fil-PH-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/492f75b4-cc60-4449-b19e-6afc0cefa0d1-fil-PH-Wavenet-D.mp3",
    "fr-CA-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/0f262fab-9f9c-4b83-bd73-9e447920ca17-fr-CA-Chirp3-HD-Aoede.mp3",
    "fr-CA-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/cfa9307b-e7c3-4890-856a-f2b01a8240e8-fr-CA-Chirp3-HD-Charon.mp3",
    "fr-CA-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/2c5ba467-a053-4b19-bc60-6dad8e40da57-fr-CA-Chirp3-HD-Fenrir.mp3",
    "fr-CA-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b8a67a6c-7270-428f-bafb-7d9179dc4e21-fr-CA-Chirp3-HD-Kore.mp3",
    "fr-CA-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/cbfaa970-f4f2-45db-839f-a9689d5ef828-fr-CA-Chirp3-HD-Leda.mp3",
    "fr-CA-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/1ad00780-fe76-4e23-b7df-86620479617f-fr-CA-Chirp3-HD-Orus.mp3",
    "fr-CA-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/fee6c340-67ec-4214-94da-8baf4225bd1c-fr-CA-Chirp3-HD-Puck.mp3",
    "fr-CA-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/af82edd8-344a-40f5-8bb5-869c6f9fa93b-fr-CA-Chirp3-HD-Zephyr.mp3",
    "fr-CA-Neural2-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/0a6c5ba2-350a-452d-8ce9-1c70a9a63d9d-fr-CA-Neural2-A.mp3",
    "fr-CA-Neural2-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/e9d3f07c-c661-4b04-a2b8-b09eb94a53f9-fr-CA-Neural2-B.mp3",
    "fr-CA-Neural2-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/1b188990-ac6c-434b-bbba-7481f9fd8bdb-fr-CA-Neural2-C.mp3",
    "fr-CA-Neural2-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/3ab79cdb-37d7-4494-8c3f-19f9745917cc-fr-CA-Neural2-D.mp3",
    "fr-CA-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/731db591-4f0d-4def-b7cc-5cf82f1a9bb6-fr-CA-Wavenet-A.mp3",
    "fr-CA-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/8b2146b4-e6eb-41d7-857c-409398e4fb14-fr-CA-Wavenet-B.mp3",
    "fr-CA-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/1c66b452-f9a8-4f03-9b2f-74f883fe7881-fr-CA-Wavenet-C.mp3",
    "fr-CA-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/561f2c9c-dd7f-4738-a408-6c0b723590fa-fr-CA-Wavenet-D.mp3",
    "fr-FR-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/714ec230-0daf-4dc6-9cef-ff9c66550221-fr-FR-Chirp3-HD-Aoede.mp3",
    "fr-FR-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/7bbe8bf1-b224-402a-b2d0-b6b82d767105-fr-FR-Chirp3-HD-Charon.mp3",
    "fr-FR-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/66943661-4dcc-45fd-bcd7-f3e05fc2baa5-fr-FR-Chirp3-HD-Fenrir.mp3",
    "fr-FR-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b3372405-a88a-4a9e-aa47-00b6d424228d-fr-FR-Chirp3-HD-Kore.mp3",
    "fr-FR-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/a26a77b7-370b-467f-bd79-78828effda71-fr-FR-Chirp3-HD-Leda.mp3",
    "fr-FR-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/985e296e-e45b-4bd3-a8e1-578a5697aa55-fr-FR-Chirp3-HD-Orus.mp3",
    "fr-FR-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/f00a3b85-600b-4b1c-9880-e720b17ee85d-fr-FR-Chirp3-HD-Puck.mp3",
    "fr-FR-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b49e2349-5b8c-48f4-a580-ecd362b6d763-fr-FR-Chirp3-HD-Zephyr.mp3",
    "he-IL-Standard-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/011f1228-48b8-42f7-9214-e22c762c0d48-he-IL-Standard-A.mp3",
    "he-IL-Standard-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/d358c017-4cc0-415f-b794-0422fd77308f-he-IL-Standard-B.mp3",
    "he-IL-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b23abc08-33a1-4256-9231-7b5792d70e2d-he-IL-Wavenet-A.mp3",
    "he-IL-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/78bfc2be-13f0-47d3-9507-38f1a6e4884f-he-IL-Wavenet-B.mp3",
    "he-IL-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/3ecec8f8-7e18-44c8-b3f1-bc178dc182c1-he-IL-Wavenet-C.mp3",
    "he-IL-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/be378c1e-1bb1-48ac-93fd-29d4329c16cf-he-IL-Wavenet-D.mp3",
    "id-ID-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/482a6b98-07ae-4acf-b77f-b08cb684d182-id-ID-Chirp3-HD-Aoede.mp3",
    "id-ID-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/ca9a4a17-4852-44ee-b559-5d3fab34f145-id-ID-Chirp3-HD-Charon.mp3",
    "id-ID-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/ca738563-5a66-4ecf-9627-2558383b4907-id-ID-Chirp3-HD-Fenrir.mp3",
    "id-ID-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c7fbd272-ba42-47df-ac55-45ffe08fcd17-id-ID-Chirp3-HD-Kore.mp3",
    "id-ID-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/2060abd9-c90c-4386-815f-a4f1ef148dbb-id-ID-Chirp3-HD-Leda.mp3",
    "id-ID-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/bcbca2c0-bcf5-450c-ac35-d662f7324280-id-ID-Chirp3-HD-Orus.mp3",
    "id-ID-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c0849e17-3540-4dc3-ad14-862b2a7ca3f7-id-ID-Chirp3-HD-Puck.mp3",
    "id-ID-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b1e29b7b-b0d4-4b28-a2e9-f101fc14efc7-id-ID-Chirp3-HD-Zephyr.mp3",
    "id-ID-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/7b65ba2d-3f62-47d4-b3d7-babf90dd36fd-id-ID-Wavenet-A.mp3",
    "id-ID-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/601964b5-207f-4d04-a817-313593955682-id-ID-Wavenet-B.mp3",
    "id-ID-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/3c05d532-f4af-4df0-8ab2-38e76333b9c9-id-ID-Wavenet-C.mp3",
    "id-ID-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/28aa7b71-348f-43ad-95d1-311ea95a0312-id-ID-Wavenet-D.mp3",
    "it-IT-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/4d8c4a84-26fc-46d1-ba91-ab9870247831-it-IT-Chirp3-HD-Aoede.mp3",
    "it-IT-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/17573add-0eeb-4c07-9702-5ab391aaece2-it-IT-Chirp3-HD-Charon.mp3",
    "it-IT-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/25f8c7e5-d7ac-445b-bcf3-88f4b5d53974-it-IT-Chirp3-HD-Fenrir.mp3",
    "it-IT-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/bcacf1d6-4782-4276-b8b8-d910f79e726b-it-IT-Chirp3-HD-Kore.mp3",
    "it-IT-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/6dd8124d-f378-4fed-a399-643d658754da-it-IT-Chirp3-HD-Leda.mp3",
    "it-IT-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/01f70d11-6d50-4122-abd8-d8f13d06317e-it-IT-Chirp3-HD-Orus.mp3",
    "it-IT-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/f8f7b0ba-780a-4acb-96c1-0aefec505f0e-it-IT-Chirp3-HD-Puck.mp3",
    "it-IT-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/03194472-dda5-4b55-ab44-9edaa63813c4-it-IT-Chirp3-HD-Zephyr.mp3",
    "it-IT-Neural2-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/1b3cd5db-d99c-4a2e-b7a7-93691ecca1aa-it-IT-Neural2-A.mp3",
    "ja-JP-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/cfe342cd-17ee-4d63-8939-d76740383527-ja-JP-Chirp3-HD-Aoede.mp3",
    "ja-JP-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/fcc876d9-4563-48c9-bc73-2daac12a12f0-ja-JP-Chirp3-HD-Charon.mp3",
    "ja-JP-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/7fd0bda9-e5e6-4304-a67d-9a00aaf088d7-ja-JP-Chirp3-HD-Fenrir.mp3",
    "ja-JP-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/ac3a2c85-efc6-45f9-9175-dededa483f58-ja-JP-Chirp3-HD-Kore.mp3",
    "ja-JP-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/3496071a-0789-40f2-92cf-1eba3cfd5813-ja-JP-Chirp3-HD-Leda.mp3",
    "ja-JP-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/619896eb-c7db-43b0-8bc1-975d32c36948-ja-JP-Chirp3-HD-Orus.mp3",
    "ja-JP-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/3375d9d7-6dd2-46d2-b413-63441de8ce3c-ja-JP-Chirp3-HD-Puck.mp3",
    "ja-JP-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/45a4a213-0ae7-4316-b57f-987c695aac27-ja-JP-Chirp3-HD-Zephyr.mp3",
    "ja-JP-Neural2-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/331383cd-91c5-4428-8c93-c38eae72aa6f-ja-JP-Neural2-B.mp3",
    "ja-JP-Neural2-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/05c787c1-ce06-4e45-99cc-2c79a27d8b7c-ja-JP-Neural2-C.mp3",
    "ja-JP-Neural2-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c8a4ac66-c355-4891-8b52-4c8ef16f5ad8-ja-JP-Neural2-D.mp3",
    "ja-JP-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/595d7633-6906-475c-9e24-92426c5d95a4-ja-JP-Wavenet-A.mp3",
    "ja-JP-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/7d071b00-8e60-4609-a3bb-ce134f100660-ja-JP-Wavenet-B.mp3",
    "ja-JP-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/933e9939-86f0-4ecf-b701-8ecb5b4421bb-ja-JP-Wavenet-C.mp3",
    "ja-JP-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/72940261-ca48-4fd5-a8d5-810193cc158c-ja-JP-Wavenet-D.mp3",
    "ko-KR-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/6befb712-65f5-400a-bb8e-7427c33e116e-ko-KR-Chirp3-HD-Aoede.mp3",
    "ko-KR-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/2030fa6b-3444-466b-a512-4114f73466de-ko-KR-Chirp3-HD-Charon.mp3",
    "ko-KR-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/48273744-7a17-4fa2-b560-81bbc532a35c-ko-KR-Chirp3-HD-Fenrir.mp3",
    "ko-KR-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/71b1d44b-4e18-4ed2-b86c-c474a9fcde3b-ko-KR-Chirp3-HD-Kore.mp3",
    "ko-KR-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/2ffa6df6-1fe2-4f35-9697-75a9caefbf0d-ko-KR-Chirp3-HD-Leda.mp3",
    "ko-KR-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/ac7416f3-120a-48aa-92af-cbaa89e34470-ko-KR-Chirp3-HD-Orus.mp3",
    "ko-KR-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/99ded46f-1a67-42ce-80e7-4ee97959f9e8-ko-KR-Chirp3-HD-Puck.mp3",
    "ko-KR-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/1504a268-fdd9-4721-a8d6-581c9825e90c-ko-KR-Chirp3-HD-Zephyr.mp3",
    "ko-KR-Neural2-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/10d74377-9dda-4285-94f4-724d69a2f1a3-ko-KR-Neural2-A.mp3",
    "ko-KR-Neural2-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/e9c4000c-1844-451e-aba3-45de8a58470b-ko-KR-Neural2-B.mp3",
    "ko-KR-Neural2-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/0b05aaed-576e-4775-accd-33645f5fb3c8-ko-KR-Neural2-C.mp3",
    "ko-KR-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/0786f6a0-7ab8-496c-8b8e-026da09a68cb-ko-KR-Wavenet-A.mp3",
    "ko-KR-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/5df1b3ac-6b9d-4298-a62c-9122ec2fa9dc-ko-KR-Wavenet-B.mp3",
    "ko-KR-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/975ea92a-e9b9-455c-ae86-7ce2f8a1e8ef-ko-KR-Wavenet-C.mp3",
    "ko-KR-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/44d34597-d086-46b6-b6cf-a53f4932210d-ko-KR-Wavenet-D.mp3",
    "ms-MY-Standard-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/cba3df60-cb13-4ee7-ba44-af3afe6102b8-ms-MY-Standard-A.mp3",
    "ms-MY-Standard-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/de9c3aa1-f2ae-4bcf-8933-226c4e6e089e-ms-MY-Standard-B.mp3",
    "ms-MY-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/e22830d4-69fa-4254-85f4-a4852ec7e5d6-ms-MY-Wavenet-A.mp3",
    "ms-MY-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/3731ce00-69b9-4738-94cf-83ce8f740fc5-ms-MY-Wavenet-B.mp3",
    "ms-MY-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/3013edfb-0f8a-42da-abab-67e7db9f4bf8-ms-MY-Wavenet-C.mp3",
    "ms-MY-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/0d18f1e4-3c81-4327-885b-5a7c22b59432-ms-MY-Wavenet-D.mp3",
    "nl-NL-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/a24bfca9-d2d4-40e5-a712-8aeba4e07fc8-nl-NL-Chirp3-HD-Aoede.mp3",
    "nl-NL-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/9b394840-2e7b-4669-93f0-37514623af41-nl-NL-Chirp3-HD-Charon.mp3",
    "nl-NL-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/6ebb11d5-7847-41b0-b917-cf3f1dc3555d-nl-NL-Chirp3-HD-Fenrir.mp3",
    "nl-NL-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/0af09b1c-21e4-4937-b2f5-84d3d85bd9fd-nl-NL-Chirp3-HD-Kore.mp3",
    "nl-NL-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/781f3686-9f99-4cdb-923e-6577d523b0cc-nl-NL-Chirp3-HD-Leda.mp3",
    "nl-NL-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/f5046b24-10e3-4fd9-b39f-a1c07adaadaf-nl-NL-Chirp3-HD-Orus.mp3",
    "nl-NL-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/71282d45-c8d1-4195-82a5-2af0cd4fae22-nl-NL-Chirp3-HD-Puck.mp3",
    "nl-NL-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/5c42a5b8-bd57-4928-93fa-bcfb80eb1a96-nl-NL-Chirp3-HD-Zephyr.mp3",
    "pl-PL-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/0b19040c-d312-4462-ba62-73341de6293c-pl-PL-Chirp3-HD-Aoede.mp3",
    "pl-PL-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/4aeca0ea-49ae-458d-82d5-1edd0eec304d-pl-PL-Chirp3-HD-Charon.mp3",
    "pl-PL-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/88dd417d-8bf2-4d3b-a78d-1ce523d8f2e7-pl-PL-Chirp3-HD-Fenrir.mp3",
    "pl-PL-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/f87162d9-0e2a-4775-b953-d75d6685d23f-pl-PL-Chirp3-HD-Kore.mp3",
    "pl-PL-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/3056b7b4-02b9-4a49-8d2b-d073bed370fc-pl-PL-Chirp3-HD-Leda.mp3",
    "pl-PL-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/96a02787-1afc-4367-9bff-b465cd32ac06-pl-PL-Chirp3-HD-Orus.mp3",
    "pl-PL-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/349bf2e7-3775-4fca-8e0f-93645a43895b-pl-PL-Chirp3-HD-Puck.mp3",
    "pl-PL-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/03a2aaee-0c74-4f91-be5e-7cc5a0bbafe8-pl-PL-Chirp3-HD-Zephyr.mp3",
    "pt-BR-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/5bee9df3-5194-4c6e-af81-8ed5dd3cf1bd-pt-BR-Chirp3-HD-Aoede.mp3",
    "pt-BR-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/2749335b-e574-4084-a346-02f7cc34f633-pt-BR-Chirp3-HD-Charon.mp3",
    "pt-BR-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/faf4444d-bbb1-4ad1-a27d-85c76a59b0f0-pt-BR-Chirp3-HD-Fenrir.mp3",
    "pt-BR-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/24c18bba-fe9e-4940-a584-3e02fcea1c2d-pt-BR-Chirp3-HD-Kore.mp3",
    "pt-BR-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/de65623f-4707-4c8c-8f81-6d933d4d3e6c-pt-BR-Chirp3-HD-Leda.mp3",
    "pt-BR-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/eca38dfd-0611-42c4-9c01-62e8c10d6f6b-pt-BR-Chirp3-HD-Orus.mp3",
    "pt-BR-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b2407bcb-c5f1-4c3b-be5b-c4281e0af0ab-pt-BR-Chirp3-HD-Puck.mp3",
    "pt-BR-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/d6ee7bf2-ccb6-4da5-8162-df5f510ac017-pt-BR-Chirp3-HD-Zephyr.mp3",
    "pt-BR-Neural2-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/0c419649-a066-4a19-be7f-798851f4ac11-pt-BR-Neural2-A.mp3",
    "pt-BR-Neural2-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/010f04ca-e7bd-48e0-8bdc-5ef823b88c79-pt-BR-Neural2-B.mp3",
    "pt-BR-Neural2-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/d644f414-6f90-4188-80bf-923afe8ddd0f-pt-BR-Neural2-C.mp3",
    "pt-BR-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/ec53fe3a-22fc-4ea4-9c9d-f0baeeac592a-pt-BR-Wavenet-A.mp3",
    "pt-BR-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/328bdae6-ef65-4083-9978-352dba37326b-pt-BR-Wavenet-B.mp3",
    "pt-BR-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c1d93712-5c09-4466-9c1e-ea518af1ff5f-pt-BR-Wavenet-C.mp3",
    "ru-RU-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/0a7d452a-b256-4666-91f7-d6ebb61cbbab-ru-RU-Chirp3-HD-Aoede.mp3",
    "ru-RU-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/e9f07195-c8ac-45ef-9cc7-1d3805f2518a-ru-RU-Chirp3-HD-Charon.mp3",
    "ru-RU-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/10df5aef-1175-4e20-befd-da542ce6c871-ru-RU-Chirp3-HD-Fenrir.mp3",
    "ru-RU-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/ca4d4b2a-8855-4516-a8db-aad3b773d4e4-ru-RU-Chirp3-HD-Kore.mp3",
    "ru-RU-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/029f1521-31f3-4a07-b026-8b33d675e4ff-ru-RU-Chirp3-HD-Leda.mp3",
    "ru-RU-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/825601d9-207c-4b92-baac-354c2afd394b-ru-RU-Chirp3-HD-Orus.mp3",
    "ru-RU-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/0ac88eac-e4cf-4ff8-9c15-1969c57132d4-ru-RU-Chirp3-HD-Puck.mp3",
    "ru-RU-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/14815893-c9ba-465c-a0f7-a03147c58225-ru-RU-Chirp3-HD-Zephyr.mp3",
    "ru-RU-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/fd7bfa8f-cab3-476c-8aeb-62956ff625ea-ru-RU-Wavenet-A.mp3",
    "ru-RU-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/fe0a82bc-8038-4356-8666-72310f7c7bda-ru-RU-Wavenet-B.mp3",
    "ru-RU-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/6384402d-995f-40aa-b18f-2db1d7d792b1-ru-RU-Wavenet-C.mp3",
    "ru-RU-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/49fb8464-1716-4cea-b64e-78880450ab41-ru-RU-Wavenet-D.mp3",
    "ru-RU-Wavenet-E": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/e8fa0c3d-bc37-4dd3-8efb-f313e3ed5fb7-ru-RU-Wavenet-E.mp3",
    "sv-SE-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/bc22bae7-0287-4ae2-aaaa-a0d553e22b77-sv-SE-Wavenet-A.mp3",
    "sv-SE-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/a7481ecd-e900-4a2f-9a4a-29ea24c9b2fd-sv-SE-Wavenet-B.mp3",
    "sv-SE-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/2f7d1d0b-91aa-4136-99c5-f1b37cd4a930-sv-SE-Wavenet-C.mp3",
    "sv-SE-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/303a33f1-d6c3-4fbf-8110-e4a860117650-sv-SE-Wavenet-D.mp3",
    "sv-SE-Wavenet-E": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/515aa724-fd50-4108-82e1-523275b6d31c-sv-SE-Wavenet-E.mp3",
    "sv-SE-Wavenet-F": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/53bffe68-a5b5-491b-a8e9-4fc0394c98e4-sv-SE-Wavenet-F.mp3",
    "th-TH-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/9073127a-d567-47ce-aff1-81a04974069f-th-TH-Chirp3-HD-Aoede.mp3",
    "th-TH-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/6a2d97db-e5bc-4d8d-a4d9-020b91c01cfd-th-TH-Chirp3-HD-Charon.mp3",
    "th-TH-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/601ed7c5-c2eb-496f-aeac-7e48173efc1a-th-TH-Chirp3-HD-Fenrir.mp3",
    "th-TH-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/ce7ee676-4e59-4b89-9af7-de238ebf239e-th-TH-Chirp3-HD-Kore.mp3",
    "th-TH-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/1363d3f4-0bc1-44e9-b748-94093dc7315f-th-TH-Chirp3-HD-Leda.mp3",
    "th-TH-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/16e33f05-13d7-49bb-8579-832542a0f9c9-th-TH-Chirp3-HD-Orus.mp3",
    "th-TH-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/1704990d-5598-475f-87cb-6b1946120ddf-th-TH-Chirp3-HD-Puck.mp3",
    "th-TH-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/e2723358-f232-4085-bdfe-3042e4eac931-th-TH-Chirp3-HD-Zephyr.mp3",
    "th-TH-Neural2-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/76821e4b-e324-400b-b614-6f65c292d9f1-th-TH-Neural2-C.mp3",
    "th-TH-Standard-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/e31e7f8d-4cb1-4ba6-8a18-8e727c86c87f-th-TH-Standard-A.mp3",
    "tr-TR-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/875fb3d9-f98b-4deb-901e-c94f01b122fd-tr-TR-Chirp3-HD-Aoede.mp3",
    "tr-TR-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c620923e-0205-4d62-9b42-f2314cee5e10-tr-TR-Chirp3-HD-Charon.mp3",
    "tr-TR-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/d9b3ff0e-4813-489d-a07a-a37e3f764795-tr-TR-Chirp3-HD-Fenrir.mp3",
    "tr-TR-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/1821c452-26e6-4d68-b0d4-0aef95a28dea-tr-TR-Chirp3-HD-Kore.mp3",
    "tr-TR-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/90e0b67b-c8f5-4e72-af79-b23cec65f1af-tr-TR-Chirp3-HD-Leda.mp3",
    "tr-TR-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/04f16c60-5191-490a-b7d6-111b667c6710-tr-TR-Chirp3-HD-Orus.mp3",
    "tr-TR-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/300537a7-e1e9-49b3-9481-b19c0427dffa-tr-TR-Chirp3-HD-Puck.mp3",
    "tr-TR-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/3bfc10df-c9ea-4d28-bb54-b59251d35bf8-tr-TR-Chirp3-HD-Zephyr.mp3",
    "tr-TR-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/fc602492-6a29-4e1b-a0b8-f84727877426-tr-TR-Wavenet-A.mp3",
    "tr-TR-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/82c9925a-cc01-43fc-8108-f059dc07f6c4-tr-TR-Wavenet-B.mp3",
    "tr-TR-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/8e56c286-5735-4d5b-a70c-57070c4296c8-tr-TR-Wavenet-C.mp3",
    "tr-TR-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/15074e33-ec38-4f86-bd94-94f5dc5fd8f3-tr-TR-Wavenet-D.mp3",
    "tr-TR-Wavenet-E": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/a55e913d-d869-402b-85c3-bfb4cb4a6e6d-tr-TR-Wavenet-E.mp3",
    "uk-UA-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/e67d0768-2973-4a8d-b8b9-e84106ae97b7-uk-UA-Chirp3-HD-Aoede.mp3",
    "uk-UA-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/333017f5-9103-40da-94e7-5eb65ae918e4-uk-UA-Chirp3-HD-Charon.mp3",
    "uk-UA-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/12ee4488-00db-4c33-a7e6-dcf20d59bcdf-uk-UA-Chirp3-HD-Fenrir.mp3",
    "uk-UA-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/20af264b-1082-48fc-b603-09dfe8fff7c4-uk-UA-Chirp3-HD-Kore.mp3",
    "uk-UA-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/f8779242-6b7e-40ef-8494-2ab5e2196225-uk-UA-Chirp3-HD-Leda.mp3",
    "uk-UA-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/7d6cb900-41f7-4333-858a-e3a0abb1db85-uk-UA-Chirp3-HD-Orus.mp3",
    "uk-UA-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/d0e8d9d0-3094-4e54-bda4-8acba2b5f325-uk-UA-Chirp3-HD-Puck.mp3",
    "uk-UA-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/bbaaa647-90c6-4e53-9d3a-a7a85ef71fb9-uk-UA-Chirp3-HD-Zephyr.mp3",
    "ur-IN-Standard-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/8cc82518-0d60-4e20-ad75-c84f69ed3f7e-ur-IN-Standard-A.mp3",
    "ur-IN-Standard-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/f1e0d1bd-041b-47d0-a00d-5569400bf8e3-ur-IN-Standard-B.mp3",
    "ur-IN-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/8a0f0ad5-bcf2-4b01-a102-847fb929e376-ur-IN-Wavenet-A.mp3",
    "ur-IN-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/5dde66e1-ace1-4302-9a02-310aba5315bd-ur-IN-Wavenet-B.mp3",
    "vi-VN-Chirp3-HD-Aoede": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/e883fa11-fee1-445f-81e2-3231375dff75-vi-VN-Chirp3-HD-Aoede.mp3",
    "vi-VN-Chirp3-HD-Charon": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/91063044-ea40-48a8-88dc-d8bf53ba45ef-vi-VN-Chirp3-HD-Charon.mp3",
    "vi-VN-Chirp3-HD-Fenrir": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/b63e19a1-7433-4ed8-a6e5-c67d516ae507-vi-VN-Chirp3-HD-Fenrir.mp3",
    "vi-VN-Chirp3-HD-Kore": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/86eb1923-e323-4ed2-a0b5-a9f9641f2e4b-vi-VN-Chirp3-HD-Kore.mp3",
    "vi-VN-Chirp3-HD-Leda": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/94038e93-ee82-4091-89d0-3700ee14ab58-vi-VN-Chirp3-HD-Leda.mp3",
    "vi-VN-Chirp3-HD-Orus": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/4b95fd3c-7445-42a7-af45-d830bdfa6815-vi-VN-Chirp3-HD-Orus.mp3",
    "vi-VN-Chirp3-HD-Puck": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/02e347f9-4290-47ae-afde-fbe1c529166c-vi-VN-Chirp3-HD-Puck.mp3",
    "vi-VN-Chirp3-HD-Zephyr": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c19d10bd-001c-4e83-a538-8b68dd6b193a-vi-VN-Chirp3-HD-Zephyr.mp3",
    "vi-VN-Wavenet-A": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/330d883d-1075-4337-a246-7b7407bde15a-vi-VN-Wavenet-A.mp3",
    "vi-VN-Wavenet-B": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/c4382fbc-25aa-49c7-bd00-69585a183390-vi-VN-Wavenet-B.mp3",
    "vi-VN-Wavenet-C": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/355b2317-c017-446d-9a2a-176fab57f37e-vi-VN-Wavenet-C.mp3",
    "vi-VN-Wavenet-D": "https://vacademy-media-storage.s3.amazonaws.com/TTS_SAMPLES/GOOGLE/943701a5-1e07-41a5-b882-9310fd1d2e47-vi-VN-Wavenet-D.mp3",
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
    "spanish (us)": {"female": "es-US-PalomaNeural", "male": "es-US-AlonsoNeural"},
    "french": {"female": "fr-FR-DeniseNeural", "male": "fr-FR-HenriNeural"},
    "french (canada)": {"female": "fr-CA-SylvieNeural", "male": "fr-CA-AntoineNeural"},
    "german": {"female": "de-DE-KatjaNeural", "male": "de-DE-ConradNeural"},
    "italian": {"female": "it-IT-ElsaNeural", "male": "it-IT-DiegoNeural"},
    "portuguese (brazil)": {"female": "pt-BR-FranciscaNeural", "male": "pt-BR-AntonioNeural"},
    "portuguese (portugal)": {"female": "pt-PT-RaquelNeural", "male": "pt-PT-DuarteNeural"},
    "dutch": {"female": "nl-NL-ColetteNeural", "male": "nl-NL-MaartenNeural"},
    "dutch (belgium)": {"female": "nl-BE-DenaNeural", "male": "nl-BE-ArnaudNeural"},
    "danish": {"female": "da-DK-ChristelNeural", "male": "da-DK-JeppeNeural"},
    "finnish": {"female": "fi-FI-SelmaNeural", "male": "fi-FI-HarriNeural"},
    "norwegian": {"female": "nb-NO-PernilleNeural", "male": "nb-NO-FinnNeural"},
    "swedish": {"female": "sv-SE-SofieNeural", "male": "sv-SE-MattiasNeural"},
    "icelandic": {"female": "is-IS-GudrunNeural", "male": "is-IS-GunnarNeural"},
    "polish": {"female": "pl-PL-ZofiaNeural", "male": "pl-PL-MarekNeural"},
    "russian": {"female": "ru-RU-SvetlanaNeural", "male": "ru-RU-DmitryNeural"},
    "ukrainian": {"female": "uk-UA-PolinaNeural", "male": "uk-UA-OstapNeural"},
    "czech": {"female": "cs-CZ-VlastaNeural", "male": "cs-CZ-AntoninNeural"},
    "slovak": {"female": "sk-SK-ViktoriaNeural", "male": "sk-SK-LukasNeural"},
    "hungarian": {"female": "hu-HU-NoemiNeural", "male": "hu-HU-TamasNeural"},
    "romanian": {"female": "ro-RO-AlinaNeural", "male": "ro-RO-EmilNeural"},
    "bulgarian": {"female": "bg-BG-KalinaNeural", "male": "bg-BG-BorislavNeural"},
    "greek": {"female": "el-GR-AthinaNeural", "male": "el-GR-NestorasNeural"},
    "arabic": {"female": "ar-SA-ZariyahNeural", "male": "ar-SA-HamedNeural"},
    "hebrew": {"female": "he-IL-HilaNeural", "male": "he-IL-AvriNeural"},
    "turkish": {"female": "tr-TR-EmelNeural", "male": "tr-TR-AhmetNeural"},
    "afrikaans": {"female": "af-ZA-AdriNeural", "male": "af-ZA-WillemNeural"},
    "catalan": {"female": "ca-ES-JoanaNeural", "male": "ca-ES-EnricNeural"},
    "indonesian": {"female": "id-ID-GadisNeural", "male": "id-ID-ArdiNeural"},
    "malay": {"female": "ms-MY-YasminNeural", "male": "ms-MY-OsmanNeural"},
    "filipino": {"female": "fil-PH-BlessicaNeural", "male": "fil-PH-AngeloNeural"},
    "vietnamese": {"female": "vi-VN-HoaiMyNeural", "male": "vi-VN-NamMinhNeural"},
    "thai": {"female": "th-TH-PremwadeeNeural", "male": "th-TH-NiwatNeural"},
    "urdu": {"female": "ur-PK-UzmaNeural", "male": "ur-PK-AsadNeural"},
    "english (australia)": {"female": "en-AU-NatashaNeural", "male": "en-AU-WilliamNeural"},
    "japanese": {"female": "ja-JP-NanamiNeural", "male": "ja-JP-KeitaNeural"},
    "korean": {"female": "ko-KR-SunHiNeural", "male": "ko-KR-InJoonNeural"},
    "chinese": {"female": "zh-CN-XiaoxiaoNeural", "male": "zh-CN-YunxiNeural"},
    "chinese (taiwan)": {"female": "zh-TW-HsiaoChenNeural", "male": "zh-TW-YunJheNeural"},
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
            if not raw_voices:
                # Google offers no voice for this (lang, gender) — degrade to Edge.
                # Keeps the language usable on the "premium" tier (at standard quality)
                # instead of returning an empty dropdown.
                edge_lang = _EDGE_VOICES.get(lang_key, _EDGE_VOICES.get("english (us)", {}))
                voice_name = edge_lang.get(gender_key, "en-US-AriaNeural")
                return {
                    "tier": "premium",
                    "provider": "edge",
                    "language": language,
                    "gender": gender_key,
                    "voices": [
                        {
                            "id": voice_name,
                            "name": f"{voice_name.replace('Neural', '').split('-')[-1]} (Standard fallback)",
                            "provider": "edge",
                            "sample_url": _EDGE_SAMPLE_URLS.get(voice_name, ""),
                        }
                    ],
                }
            voices = [
                {
                    "id": v["id"],
                    "name": v["name"],
                    "provider": "google",
                    "sample_url": _GOOGLE_SAMPLE_URLS.get(v["id"], ""),
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


# ---------------------------------------------------------------------------
# Audio track management
# ---------------------------------------------------------------------------

@router.post(
    "/audio-track/add",
    response_model=AudioTrackResponse,
    summary="Add an extra audio track to the video (External)"
)
async def add_audio_track_external(
    payload: AddAudioTrackRequest,
    service: VideoGenerationService = Depends(get_video_service),
    institute_id: str = Depends(get_institute_from_api_key),
):
    """
    Append a new audio track (background music, SFX, etc.) to the video's
    meta.audio_tracks list.  The track is stored in the timeline JSON on S3.
    During render it will be mixed with the narration via FFmpeg amix.
    In the learner player it is played via Web Audio API for perfect sync.
    """
    try:
        result = await service.add_audio_track(
            video_id=payload.video_id,
            label=payload.label,
            url=payload.url,
            volume=payload.volume,
            delay=payload.delay,
            fade_in=payload.fade_in,
            fade_out=payload.fade_out,
            track_id=payload.track_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch(
    "/audio-track/update",
    response_model=AudioTrackResponse,
    summary="Update an existing audio track (External)"
)
async def update_audio_track_external(
    payload: UpdateAudioTrackRequest,
    service: VideoGenerationService = Depends(get_video_service),
    institute_id: str = Depends(get_institute_from_api_key),
):
    """Patch one or more fields of an audio track (label, url, volume, delay, fades)."""
    try:
        result = await service.update_audio_track(
            video_id=payload.video_id,
            track_id=payload.track_id,
            label=payload.label,
            url=payload.url,
            volume=payload.volume,
            delay=payload.delay,
            fade_in=payload.fade_in,
            fade_out=payload.fade_out,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/audio-track/delete",
    response_model=AudioTrackResponse,
    summary="Delete an audio track (External)"
)
async def delete_audio_track_external(
    payload: DeleteAudioTrackRequest,
    service: VideoGenerationService = Depends(get_video_service),
    institute_id: str = Depends(get_institute_from_api_key),
):
    """Remove an audio track from the video's meta.audio_tracks list."""
    try:
        result = await service.delete_audio_track(
            video_id=payload.video_id,
            track_id=payload.track_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
