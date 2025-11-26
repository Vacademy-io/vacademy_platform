from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
import uuid
import json
from typing import Optional

from ..config import get_settings
from ..dependencies import get_course_outline_service
from ..schemas.course_outline import CourseOutlineRequest, CourseOutlineResponse, CourseUserPromptRequest
from ..services.course_outline_service import CourseOutlineGenerationService


router = APIRouter(prefix="/course", tags=["course-outline"])


@router.post(
    "/outline/v1/generate",
    response_model=CourseOutlineResponse,
    summary="Generate a course outline using AI",
)
async def generate_course_outline(
    payload: CourseOutlineRequest,
    service: CourseOutlineGenerationService = Depends(get_course_outline_service),
) -> CourseOutlineResponse:
    """
    Generate an abstract course outline (headings, subjects, chapters, slides)
    based on user prompt, optional existing course tree, and optional course
    metadata from admin-core-service.
    """
    return await service.generate_outline(payload)


@router.post(
    "/ai/v1/generate",
    summary="Generate course outline with SSE streaming (matches media-service pattern)",
    response_class=StreamingResponse,
)
async def stream_course_outline(
    institute_id: str,
    payload: CourseUserPromptRequest,
    model: Optional[str] = None,
    service: CourseOutlineGenerationService = Depends(get_course_outline_service),
) -> StreamingResponse:
    """
    Generate course outline using streaming SSE events (matches media-service endpoint pattern).
    Returns Server-Sent Events stream with outline generation progress.

    Args:
        model: Optional LLM model to use. Defaults to LLM_DEFAULT_MODEL from environment.
        payload: Request containing user prompt, course tree, and course depth.
        institute_id: Institute identifier.
    """
    # Convert CourseUserPromptRequest to internal CourseOutlineRequest
    # Use provided model or fall back to settings default
    final_model = model or get_settings().llm_default_model

    internal_request = CourseOutlineRequest(
        institute_id=institute_id,
        user_prompt=payload.user_prompt,
        existing_course_tree=json.loads(payload.course_tree) if payload.course_tree else None,
        model=final_model,
        course_depth=payload.course_depth,
        generation_options=payload.generation_options
    )

    request_id = str(uuid.uuid4())

    async def event_generator():
        async for event in service.stream_outline_events(internal_request, request_id):
            # Format as SSE: "data: <content>\n\n"
            yield f"data: {event}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


__all__ = ["router"]


