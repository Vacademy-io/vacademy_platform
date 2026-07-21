"""
Translation endpoints (i18n Phase 1 Wave 1 — Arabic-first content translation).

  POST /translation/v1/estimate                    parametric cost + balance
  POST /translation/v1/course/{package_session_id} kick off a course job (async)
  POST /translation/v1/strings                     synchronous UI/notification batch
  POST /translation/v1/job/{job_id}/approve        resume WRITE_BACK from REVIEW
  GET  /translation/v1/job/{job_id}                job status/progress

Auth: triple — a signed-in dashboard user (Bearer JWT + clientId), an
institute API key (X-Institute-Key) OR the internal service token
(X-Internal-Service-Token, admin_core server-to-server; institute_id then comes
from the body). Delivery of translated content to learners is unchanged Java
territory (COALESCE LEFT JOINs) — these endpoints only produce sidecar rows via
admin_core's internal batch-upsert, so requesting 'en' or having no
translations behaves exactly as today.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import db_dependency
from ..dependencies import get_institute_id_or_internal_or_user
from ..models.ai_translation_job import (
    AiTranslationJob,
    TranslationJobMode,
    TranslationJobStage,
    TranslationJobStatus,
)
from ..services import translation_service
from ..services.ai_billing import preflight_tool_credits

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/translation/v1", tags=["translation"])

SUPPORTED_LOCALES = set(translation_service.LOCALE_NAMES)


def _resolve_institute(auth: tuple, body_institute_id: Optional[str], required: bool = True) -> Optional[str]:
    """INSTITUTE mode → from the API key or the caller's pinned clientId; INTERNAL mode → body field."""
    resolved_institute_id, auth_mode = auth
    if auth_mode == "INTERNAL":
        if required and not body_institute_id:
            raise HTTPException(
                status_code=400,
                detail="institute_id is required in request body when using X-Internal-Service-Token",
            )
        return body_institute_id
    return resolved_institute_id


def _require_locale(locale: str, field: str) -> str:
    if locale not in SUPPORTED_LOCALES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported {field} '{locale}'. Supported: {', '.join(sorted(SUPPORTED_LOCALES))}",
        )
    return locale


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class EstimateRequest(BaseModel):
    scope: str = Field("FULL", description="FULL | STRINGS | QUESTIONS")
    package_session_id: Optional[str] = Field(
        None, description="When set (and item_counts absent), a bounded read-only "
                          "content-tree walk supplies the char counts.")
    target_locale: str
    item_counts: Optional[Dict[str, int]] = Field(
        None, description="Optional precomputed counts: chars / questions / strings_chars.")
    institute_id: Optional[str] = Field(
        None, description="Required only with X-Internal-Service-Token auth.")


class CourseTranslationRequest(BaseModel):
    target_locale: str
    scope: str = Field("FULL", description="v1 supports FULL only.")
    mode: str = Field("DRAFT", description="DRAFT (park at REVIEW) | AUTO_PUBLISH")
    source_locale: str = Field("en", description="v1 source is the canonical (English) content.")
    institute_id: Optional[str] = Field(
        None, description="Required only with X-Internal-Service-Token auth.")
    created_by: Optional[str] = Field(None, description="Acting admin user id (credit attribution).")


class StringItem(BaseModel):
    key: str
    text: str


class StringsRequest(BaseModel):
    items: List[StringItem] = Field(..., max_length=translation_service.MAX_STRING_ITEMS)
    source_locale: str = "en"
    target_locale: str
    institute_id: Optional[str] = Field(
        None, description="Optional — scopes the TM and the credit charge.")
    domain: str = Field("UI", description="UI | NOTIFICATION")


class ApproveRequest(BaseModel):
    item_decisions: Optional[Dict[str, Any]] = Field(
        None,
        description='Per-item review decisions: {item_id: "REJECT"} or '
                    '{item_id: {"action": "REJECT"|"EDIT", "content": "..."}}.',
    )
    acting_user: Optional[str] = Field(None, description="Reviewer user id (stamped on EDITs).")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/estimate")
async def estimate(
    request: EstimateRequest,
    auth: tuple = Depends(get_institute_id_or_internal_or_user),
    db: Session = Depends(db_dependency),
) -> Dict[str, Any]:
    """Parametric credit estimate + affordability for a translation run."""
    institute_id = _resolve_institute(auth, request.institute_id, required=False)
    _require_locale(request.target_locale, "target_locale")
    try:
        return translation_service.estimate_translation(
            db,
            scope=request.scope,
            package_session_id=request.package_session_id,
            item_counts=request.item_counts,
            institute_id=institute_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/course/{package_session_id}")
async def translate_course(
    package_session_id: str,
    request: CourseTranslationRequest,
    auth: tuple = Depends(get_institute_id_or_internal_or_user),
    db: Session = Depends(db_dependency),
) -> Dict[str, Any]:
    """Kick off an async course-translation job (stage machine). Returns the
    job id immediately; poll GET /translation/v1/job/{job_id}."""
    institute_id = _resolve_institute(auth, request.institute_id)
    _require_locale(request.target_locale, "target_locale")
    _require_locale(request.source_locale, "source_locale")
    if request.target_locale == request.source_locale:
        raise HTTPException(status_code=400, detail="target_locale must differ from source_locale")
    if (request.scope or "FULL").upper() != "FULL":
        raise HTTPException(status_code=400, detail="v1 supports scope 'FULL' only")
    mode = (request.mode or "DRAFT").upper()
    if mode not in (TranslationJobMode.DRAFT.value, TranslationJobMode.AUTO_PUBLISH.value):
        raise HTTPException(status_code=400, detail="mode must be DRAFT or AUTO_PUBLISH")

    # 402 pre-flight (parametric whole-course base) — block before any LLM spend.
    estimate_result = preflight_tool_credits(
        db, tool_key="translate_course", tool_params={}, institute_id=institute_id
    )
    if estimate_result.get("sufficient") is False:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: this translation needs ~{estimate_result['estimated_credits']} "
                f"credits but the balance is {estimate_result.get('current_balance')}."
            ),
        )

    job = AiTranslationJob(
        institute_id=institute_id,
        package_session_id=package_session_id,
        source_locale=request.source_locale,
        target_locale=request.target_locale,
        scope="FULL",
        mode=mode,
        status=TranslationJobStatus.PENDING.value,
        current_stage=TranslationJobStage.PENDING.value,
        items_done=0,
        artifacts={},
        created_by=request.created_by,
    )
    db.add(job)
    # Commit BEFORE scheduling — the background leg reads the row on a fresh
    # session, so the insert must be visible when the machine starts.
    db.commit()

    translation_service.schedule_job(job.id, start_stage="EXTRACT")
    logger.info(
        "[translation] [%s] job %s scheduled (ps=%s, %s→%s, mode=%s)",
        institute_id, job.id, package_session_id,
        request.source_locale, request.target_locale, mode,
    )
    return {
        "job_id": job.id,
        "status": job.status,
        "current_stage": job.current_stage,
        "estimated_credits": estimate_result.get("estimated_credits"),
    }


@router.post("/strings")
async def translate_strings(
    request: StringsRequest,
    auth: tuple = Depends(get_institute_id_or_internal_or_user),
    db: Session = Depends(db_dependency),
) -> Dict[str, Any]:
    """Synchronous UI/notification string batch: exact-hash TM per item, one
    batched LLM call for the misses, TM write-through, translate_strings charge."""
    institute_id = _resolve_institute(auth, request.institute_id, required=False)
    _require_locale(request.target_locale, "target_locale")
    _require_locale(request.source_locale, "source_locale")
    if not request.items:
        return {"translations": {}, "failed_keys": [], "tm_hits": 0, "model_used": None}
    if len(request.items) > translation_service.MAX_STRING_ITEMS:
        raise HTTPException(
            status_code=400,
            detail=f"At most {translation_service.MAX_STRING_ITEMS} items per call",
        )
    domain = (request.domain or "UI").upper()
    if domain not in ("UI", "NOTIFICATION"):
        raise HTTPException(status_code=400, detail="domain must be UI or NOTIFICATION")

    # 402 pre-flight on the worst case (every item missing the TM).
    total_chars = sum(len(it.text or "") for it in request.items)
    estimate_result = preflight_tool_credits(
        db,
        tool_key="translate_strings",
        tool_params={"transcript_chars": total_chars},
        institute_id=institute_id,
    )
    if estimate_result.get("sufficient") is False:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: this batch needs ~{estimate_result['estimated_credits']} "
                f"credits but the balance is {estimate_result.get('current_balance')}."
            ),
        )

    try:
        return await translation_service.translate_strings(
            items=[{"key": it.key, "text": it.text} for it in request.items],
            source_locale=request.source_locale,
            target_locale=request.target_locale,
            institute_id=institute_id,
            domain=domain,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/job/{job_id}/approve")
async def approve_job(
    job_id: str,
    request: ApproveRequest,
    auth: tuple = Depends(get_institute_id_or_internal_or_user),
    db: Session = Depends(db_dependency),
) -> Dict[str, Any]:
    """Resume a DRAFT job parked at REVIEW: record decisions, run WRITE_BACK."""
    job = db.get(AiTranslationJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Translation job not found: {job_id}")
    resolved_institute_id, auth_mode = auth
    if auth_mode == "INSTITUTE" and job.institute_id != resolved_institute_id:
        raise HTTPException(status_code=403, detail="Job belongs to a different institute")
    if job.status != TranslationJobStatus.AWAITING_INPUT.value or (
        job.current_stage != TranslationJobStage.REVIEW.value
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Job is not awaiting review (status={job.status}, "
                f"stage={job.current_stage}); approve is only valid from AWAITING_INPUT/REVIEW."
            ),
        )

    translation_service.apply_review_decisions(job_id, request.item_decisions, request.acting_user)
    job = db.get(AiTranslationJob, job_id)  # re-read after decision write
    job.status = TranslationJobStatus.IN_PROGRESS.value
    db.commit()

    translation_service.schedule_job(job_id, start_stage="WRITE_BACK")
    logger.info("[translation] job %s approved; resuming WRITE_BACK", job_id)
    return {"job_id": job_id, "status": TranslationJobStatus.IN_PROGRESS.value, "resumed_stage": "WRITE_BACK"}


@router.get("/job/{job_id}")
async def get_job(
    job_id: str,
    include_items: bool = Query(
        False, description="Include the per-item translations (review UI payload)."
    ),
    auth: tuple = Depends(get_institute_id_or_internal_or_user),
    db: Session = Depends(db_dependency),
) -> Dict[str, Any]:
    """Job status/progress (items_done / items_total tick during TRANSLATE)."""
    job = db.get(AiTranslationJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Translation job not found: {job_id}")
    resolved_institute_id, auth_mode = auth
    if auth_mode == "INSTITUTE" and job.institute_id != resolved_institute_id:
        raise HTTPException(status_code=403, detail="Job belongs to a different institute")

    payload = job.to_status_dict()
    if include_items:
        artifacts = job.artifacts or {}
        payload["items"] = [
            {
                "item_id": item.get("item_id"),
                "target_type": item.get("target_type"),
                "rich_text_id": item.get("rich_text_id"),
                "entity_type": item.get("entity_type"),
                "entity_id": item.get("entity_id"),
                "field": item.get("field"),
                "source_text": item.get("text"),
                "translation": (artifacts.get("translations") or {}).get(item.get("item_id")),
            }
            for item in (artifacts.get("manifest") or [])
        ]
        payload["rejected_items"] = artifacts.get("rejected_items") or []
    return payload
