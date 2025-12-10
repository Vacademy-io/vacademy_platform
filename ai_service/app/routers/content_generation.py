from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
import uuid

from ..dependencies import get_course_outline_service
from ..schemas.content_generation import ContentGenerationRequest
from ..services.course_outline_service import CourseOutlineGenerationService


router = APIRouter(prefix="/course", tags=["content-generation"])


@router.post(
    "/content/v1/generate",
    summary="Generate content for todos in an existing coursetree",
    response_class=StreamingResponse,
)
async def generate_content_from_coursetree(
    payload: ContentGenerationRequest,
    service: CourseOutlineGenerationService = Depends(get_course_outline_service),
) -> StreamingResponse:
    """
    Generate content for todos in an existing coursetree.
    
    This endpoint is called by the frontend when the user clicks "Generate Content" button.
    
    **Payload Options:**
    - You can send the full outline response: `{"explanation": "...", "tree": [...], "todos": [...], "courseMetadata": {...}}`
    - Or just the todos: `{"todos": [...]}`
    - The endpoint will extract and use only the `todos` array
    
    **Recommended:** Send just `{"todos": [...]}` for efficiency, or the full response for convenience.
    
    Returns Server-Sent Events stream with content generation progress for each todo.
    
    Args:
        payload: Request containing course_tree (from outline API) and optional institute_id.
    """
    request_id = str(uuid.uuid4())

    async def event_generator():
        async for event in service.generate_content_from_coursetree(
            course_tree=payload.course_tree,
            request_id=request_id
        ):
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

