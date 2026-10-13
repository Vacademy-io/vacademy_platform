"""
Internal chat completion by use case — POST /ai-service/internal/llm/v1/complete.

For Vacademy services that have no LLM gateway of their own (assessment_service,
community_service): they name a use case, ai_service resolves its model chain
from ai_model_defaults (GLM by default + the row's fallback + the non-GLM tail)
and serves it through llm_router.chat_with_chain (Isoquant → OpenRouter →
next model, reasoning effort low for GLM).

Service-to-service only (X-Internal-Service-Token). It charges NO credits —
the caller keeps its own billing — but records the call in ai_token_usage under
the registry id that answered (unless record_usage_only is false, in which case
nothing is recorded here at all).
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..constants.model_use_cases import USE_CASE_CATALOG, is_chat_use_case
from ..db import db_dependency
from ..dependencies import require_internal_service_token
from ..models.ai_token_usage import ApiProvider, RequestType

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/internal/llm/v1",
    tags=["Internal LLM"],
    dependencies=[Depends(require_internal_service_token)],
)

# ai_token_usage.request_type per use case (default CONVERSATION).
_REQUEST_TYPES: Dict[str, RequestType] = {
    "class_report": RequestType.ANALYTICS,
    "analytics": RequestType.ANALYTICS,
    "student_report": RequestType.ANALYTICS,
    "evaluation": RequestType.EVALUATION,
    "live_session_summary": RequestType.NOTES,
    "questions": RequestType.ASSESSMENT,
}


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(system|user|assistant)$")
    content: Union[str, List[Dict[str, Any]]]


class InternalCompletionRequest(BaseModel):
    use_case: str = Field(..., max_length=50)
    messages: List[ChatMessage] = Field(..., min_length=1)
    response_format: Optional[Dict[str, Any]] = None
    max_tokens: Optional[int] = Field(None, ge=1, le=32000)
    temperature: Optional[float] = Field(None, ge=0, le=2)
    reasoning_effort: Optional[str] = Field(None, pattern="^(low|medium|high|max)$")
    institute_id: Optional[str] = None
    user_id: Optional[str] = None
    record_usage_only: bool = True


class InternalCompletionResponse(BaseModel):
    content: str
    model: str
    usage: Dict[str, Any] = Field(default_factory=dict)
    # The answering model's finish_reason ("length" = cut at the token cap);
    # the Java clients read it to tell a truncated answer from a bad one.
    finish_reason: Optional[str] = None


def _record_usage(db: Session, body: InternalCompletionRequest, result) -> None:
    usage = result.usage or {}
    if not usage:
        return
    try:
        from ..services.token_usage_service import TokenUsageService
        TokenUsageService(db).record_usage(
            api_provider=ApiProvider.OPENAI,
            prompt_tokens=int(usage.get("prompt_tokens") or 0),
            completion_tokens=int(usage.get("completion_tokens") or 0),
            total_tokens=int(usage.get("total_tokens") or 0),
            request_type=_REQUEST_TYPES.get(body.use_case, RequestType.CONVERSATION),
            institute_id=body.institute_id,
            user_id=body.user_id,
            model=result.model,
            metadata={"use_case": body.use_case, "router": result.router, "source": "internal_llm",
                      "charged_by_caller": True},
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("internal llm: usage record failed for %s: %s", body.use_case, exc)


@router.post("/complete", response_model=InternalCompletionResponse,
             summary="Chat completion for a use case (service-to-service; no credit charge)")
async def internal_complete(body: InternalCompletionRequest, db: Session = Depends(db_dependency)):
    if body.use_case not in USE_CASE_CATALOG or not is_chat_use_case(body.use_case):
        raise HTTPException(status_code=422, detail=f"Unknown chat use case '{body.use_case}'")

    from ..services.llm_router import ChainExhausted, chat_with_chain

    payload: Dict[str, Any] = {"messages": [m.model_dump() for m in body.messages]}
    if body.max_tokens is not None:
        payload["max_tokens"] = body.max_tokens
    if body.temperature is not None:
        payload["temperature"] = body.temperature
    if body.response_format:
        payload["response_format"] = body.response_format

    try:
        result = await chat_with_chain(payload, use_case=body.use_case, db=db,
                                       reasoning_effort=body.reasoning_effort)
    except ChainExhausted as exc:
        logger.error("internal llm: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)[:500])

    if body.record_usage_only:
        _record_usage(db, body, result)
    return InternalCompletionResponse(content=result.content, model=result.model, usage=result.usage or {},
                                      finish_reason=result.finish_reason)


__all__ = ["router"]
