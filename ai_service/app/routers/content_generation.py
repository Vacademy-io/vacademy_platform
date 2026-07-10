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
    # Resolve the billing institute the same way the generation service does —
    # the top-level field, else courseMetadata (a supported payload shape).
    # Otherwise the pre-flight could be bypassed while charges still land.
    course_metadata = (payload.course_tree or {}).get("courseMetadata") or {}
    billing_institute_id = (
        payload.institute_id
        or course_metadata.get("instituteId")
        or course_metadata.get("institute_id")
    )

    # Pre-flight credit check: sum the parametric per-slide prices for the
    # requested todos (DB-tunable in ai_tool_pricing). AI_VIDEO-family slides
    # are excluded — the video pipeline meters their actual usage separately.
    if billing_institute_id:
        from decimal import Decimal
        from ..services.credit_service import CreditService
        from ..services.tool_cost_estimator import ToolCostEstimator

        estimated_total = Decimal("0")
        try:
            todos = (payload.course_tree or {}).get("todos") or []
            counts = {"course_slide_document": 0, "course_slide_assessment": 0, "course_slide_video": 0}
            for todo in todos:
                todo_type = (todo or {}).get("type") if isinstance(todo, dict) else None
                if todo_type == "DOCUMENT":
                    counts["course_slide_document"] += 1
                elif todo_type == "ASSESSMENT":
                    counts["course_slide_assessment"] += 1
                elif todo_type in ("VIDEO", "VIDEO_CODE"):
                    counts["course_slide_video"] += 1
            estimator = ToolCostEstimator(db)
            for tool_key, count in counts.items():
                if count:
                    per_slide = Decimal(str(estimator.estimate(tool_key, {})["estimated_credits"]))
                    estimated_total += per_slide * count
        except Exception as exc:  # estimation must never block generation
            import logging
            logging.getLogger(__name__).warning(f"Content credit pre-flight estimation failed: {exc}")

        if estimated_total > 0:
            balance = CreditService(db).get_balance(billing_institute_id)
            if balance and balance.current_balance < estimated_total:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail=(
                        f"Insufficient credits: generating this content needs ≈{estimated_total} "
                        f"credits, balance is {balance.current_balance}. Please top up."
                    ),
                )

    # Client-minted run id (stable across transport retries) keys idempotent
    # per-slide charges; fall back to a per-request UUID for older clients.
    request_id = payload.generation_run_id or str(uuid.uuid4())

    async def event_generator():
        try:
            last_event_time = time.monotonic()
            async for event in service.generate_content_from_coursetree(
                course_tree=payload.course_tree,
                request_id=request_id,
                institute_id=payload.institute_id,
                user_id=payload.user_id,
                language=payload.language,
                video_settings=payload.video_settings,
                reference_document_file_ids=payload.reference_document_file_ids,
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



