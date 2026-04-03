from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
import uuid
import json
import asyncio
import time

from ..dependencies import get_course_outline_service
from ..schemas.content_generation import ContentGenerationRequest
from ..services.course_outline_service import CourseOutlineGenerationService
from ..core.exceptions import PaymentRequiredError
from ..db import db_dependency
from sqlalchemy.orm import Session


router = APIRouter(prefix="/course", tags=["content-generation"])


@router.post(
    "/content/v1/generate",
    summary="Generate content for todos in an existing coursetree",
    response_class=StreamingResponse,
)
async def generate_content_from_coursetree(
    payload: ContentGenerationRequest,
    service: CourseOutlineGenerationService = Depends(get_course_outline_service),
    db: Session = Depends(db_dependency),
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
    # Pre-flight credit check
    if payload.institute_id:
        from ..services.credit_service import CreditService
        from ..schemas.credits import CreditCheckRequest
        credit_svc = CreditService(db)
        check = credit_svc.check_credits(CreditCheckRequest(
            institute_id=payload.institute_id,
            request_type="content",
            estimated_tokens=1000,
        ))
        if not check.has_sufficient_credits:
            raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=check.message)

    request_id = str(uuid.uuid4())

    async def event_generator():
        try:
            last_event_time = time.monotonic()
            async for event in service.generate_content_from_coursetree(
                course_tree=payload.course_tree,
                request_id=request_id,
                institute_id=payload.institute_id,
                user_id=payload.user_id,
                language=payload.language,
            ):
                yield f"data: {event}\n\n"
                last_event_time = time.monotonic()
        except PaymentRequiredError as exc:
            error_payload = json.dumps({
                "type": "ERROR",
                "code": 402,
                "message": str(exc),
            })
            yield f"data: {error_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


__all__ = ["router"]



