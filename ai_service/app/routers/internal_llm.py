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

POST /ai-service/internal/llm/v1/chat/completions is the raw bridge for
admin_core's LlmGatewayRouter: an OpenAI chat payload whose `model` is a
registry id goes out through llm_router.post_chat (route map, direct-Anthropic
key pool, OpenRouter failover) and the gateway's OpenAI-shaped reply comes
back with `model` = the registry id and `router` = the gateway that served
it. Non-2xx statuses pass through with an OpenAI-style error body. It records
nothing and charges nothing — Java logs its own usage.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Union

from fastapi import APIRouter, Body, Depends, Header, HTTPException
from fastapi.responses import JSONResponse
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
    # Optional usage-event attribution from the calling service (contract K2);
    # recorded on ai_usage_event only, never sent upstream.
    source_service: Optional[str] = Field(None, max_length=24)
    surface: Optional[str] = Field(None, max_length=24)
    actor_kind: Optional[str] = Field(None, max_length=16)
    actor_role_class: Optional[str] = Field(None, max_length=16)
    actor_roles_raw: Optional[List[str]] = None
    actor_display_name: Optional[str] = Field(None, max_length=255)
    subject_user_id: Optional[str] = Field(None, max_length=255)
    subject_display_name: Optional[str] = Field(None, max_length=255)
    usage_context: Optional[Dict[str, Any]] = None


class InternalCompletionResponse(BaseModel):
    content: str
    model: str
    usage: Dict[str, Any] = Field(default_factory=dict)
    # The answering model's finish_reason ("length" = cut at the token cap);
    # the Java clients read it to tell a truncated answer from a bad one.
    finish_reason: Optional[str] = None


# Model use case -> ai_use_case_catalog key, where the two names differ (from the
# V586 seed's model_use_case column + test_metering_catalog_coverage COVERED_BY).
# An explicit key that is not in the catalog is stored as 'unknown', so every chat
# model use case that is not itself a catalog key is mapped here; "" = send no
# explicit use case and let request_type decide.
_CATALOG_USE_CASE: Dict[str, str] = {
    "analytics": "learner_analytics",
    "agent": "assessment_generation",
    "assistant": "vacademy_assistant",
    "chat": "chat_with_pdf",
    "outline": "course_outline",
    "video": "lesson_video",
    "knowledge_base_qa": "knowledge_base",
    "knowledge_base_summary": "knowledge_base",
    "brand_kit": "page_builder",
    "copy_check_deduction": "evaluation",
    "image_keyword": "content_image",
    "question_metadata": "questions",
    "reels_selection": "reels",
    "reels_preview": "reels",
    "reels_director": "reels",
    "platform_default": "",
    "knowledge_base_figure": "",
}


def _metering(body: InternalCompletionRequest, source_service: Optional[str]) -> Dict[str, Any]:
    """Usage-event attribution for a record-only internal call (never charges)."""
    from ..services.ai_billing import metering_kwargs, metering_system

    ctx = metering_system(subject_user_id=body.subject_user_id, subject_display_name=body.subject_display_name,
                          surface=body.surface or "INTERNAL")
    fields: Dict[str, Any] = dict(ctx.as_fields()) if ctx is not None and hasattr(ctx, "as_fields") else {}
    if body.user_id:
        fields.update({"actor_kind": body.actor_kind or "USER", "actor_user_id": body.user_id,
                       "role_source": "CALLER" if (body.actor_role_class or body.actor_roles_raw) else "UNRESOLVED"})
        fields.pop("actor_role_class", None)
    for k in ("actor_kind", "actor_role_class", "actor_roles_raw", "actor_display_name"):
        if getattr(body, k, None):
            fields[k] = getattr(body, k)
    svc = body.source_service or source_service
    if svc:
        fields["source_service"] = svc
    return metering_kwargs(_CATALOG_USE_CASE.get(body.use_case, body.use_case) or None, fields,
                           {**(body.usage_context or {}), "model_use_case": body.use_case},
                           keep_subject=True)


def _record_usage(db: Session, body: InternalCompletionRequest, result,
                  source_service: Optional[str] = None) -> None:
    usage = result.usage or {}
    if not usage:
        return
    try:
        from ..services.ai_billing import supported_kwargs
        from ..services.token_usage_service import TokenUsageService
        tus = TokenUsageService(db)
        try:
            meter = supported_kwargs(tus.record_usage, _metering(body, source_service))
        except Exception:  # noqa: BLE001 - attribution must never cost the record
            meter = {}
        tus.record_usage(
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
            **meter,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("internal llm: usage record failed for %s: %s", body.use_case, exc)


@router.post("/complete", response_model=InternalCompletionResponse,
             summary="Chat completion for a use case (service-to-service; no credit charge)")
async def internal_complete(
    body: InternalCompletionRequest,
    db: Session = Depends(db_dependency),
    x_source_service: Optional[str] = Header(None, description="Calling service, for usage attribution"),
):
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
        _record_usage(db, body, result, source_service=x_source_service)
    return InternalCompletionResponse(content=result.content, model=result.model, usage=result.usage or {},
                                      finish_reason=result.finish_reason)


# Metadata the Java caller may attach; never sent upstream.
_BRIDGE_METADATA_KEYS = ("institute_id", "user_id", "use_case")
# The bridge answers with one JSON body; streaming is not offered.
_BRIDGE_DROPPED_KEYS = ("stream", "stream_options")
# At least admin_core's longest per-attempt timeout (600 s for background jobs):
# a shorter cut here would make Java retry the whole call on OpenRouter.
_BRIDGE_TIMEOUT_SECONDS = 600.0


def _bridge_error(status: int, message: str, err_type: str = "bridge_error") -> JSONResponse:
    return JSONResponse(status_code=status,
                        content={"error": {"message": message, "type": err_type, "code": status}})


@router.post("/chat/completions",
             summary="OpenAI chat completion through the platform model router (service-to-service; no charge)")
async def bridge_chat_completions(body: Dict[str, Any] = Body(...)):
    import httpx

    from ..services.llm_router import _router_of, post_chat

    model = body.get("model")
    if not isinstance(model, str) or not model.strip():
        return _bridge_error(422, "model (a registry model id) is required", "invalid_request_error")
    messages = body.get("messages")
    if not isinstance(messages, list) or not messages:
        return _bridge_error(422, "messages must be a non-empty list", "invalid_request_error")

    meta = {k: body.get(k) for k in _BRIDGE_METADATA_KEYS if body.get(k) is not None}
    payload = {k: v for k, v in body.items()
               if k not in _BRIDGE_METADATA_KEYS and k not in _BRIDGE_DROPPED_KEYS}
    payload["model"] = model.strip()

    try:
        async with httpx.AsyncClient(timeout=_BRIDGE_TIMEOUT_SECONDS) as client:
            resp = await post_chat(client, payload)
    except httpx.HTTPError as exc:
        logger.warning("internal llm bridge: %s unreachable for %s (%s)", type(exc).__name__, payload["model"],
                       meta.get("use_case"))
        return _bridge_error(502, f"gateway unreachable: {type(exc).__name__}")

    router_name = _router_of(resp)
    if resp.status_code >= 400:
        try:
            err = resp.json()
        except Exception:  # noqa: BLE001
            err = None
        if not (isinstance(err, dict) and err.get("error")):
            err = {"error": {"message": (resp.text or "")[:500] or f"HTTP {resp.status_code}",
                             "type": "upstream_error", "code": resp.status_code}}
        err["router"] = router_name
        return JSONResponse(status_code=resp.status_code, content=err)
    try:
        data = resp.json()
    except Exception:  # noqa: BLE001
        return _bridge_error(502, f"unreadable gateway reply: {(resp.text or '')[:200]}", "upstream_error")
    if not isinstance(data, dict):
        return _bridge_error(502, "gateway reply is not a JSON object", "upstream_error")
    data["model"] = payload["model"]
    data["router"] = router_name
    return JSONResponse(status_code=resp.status_code, content=data)


__all__ = ["router"]
