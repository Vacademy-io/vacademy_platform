"""Question-paper PDF → gradable questions, for offline tests.

    POST /paper-digitise/v1/estimate      what reading this PDF will cost (pages, credits, balance)
    POST /paper-digitise/v1/start         202 → task id; 402 when the institute cannot afford it
    GET  /paper-digitise/v1/jobs/{id}     poll; the questions + what was charged once COMPLETED

Charged on delivery: the task bills `paper_digitise` (per page + base, floored
by the parametric estimate the teacher saw) only after questions come back, and
the amount is written into the result so the UI can show exactly what was
deducted. Keyed on the task id, so a retried job never charges twice.
"""
from __future__ import annotations

import json
import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import db_dependency, db_session
from ..models.ai_task import AiTaskInputType, AiTaskType
from ..models.ai_token_usage import RequestType
from ..repositories.ai_task_repository import AiTaskRepository
from ..services import ai_task_service, paper_digitise
from ..services.ai_billing import charge_tool, preflight_tool_credits
from ..services.ai_task_service import AiTaskService
from ..services.model_selection import resolve_models
from ..services.question_gen_service import QUESTIONS_USE_CASE
from .knowledge_base import Caller, get_caller

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/paper-digitise/v1", tags=["Question paper digitisation"])


class EstimateRequest(BaseModel):
    pdf_url: str = Field(..., description="The paper as attached to the test description")
    institute_id: Optional[str] = Field(None, description="INTERNAL callers only")


class StartRequest(EstimateRequest):
    expected_total_marks: Optional[float] = Field(
        None, description="What the teacher typed as the test's total; used to sanity-check the marks read"
    )
    title: Optional[str] = None
    preferred_model: Optional[str] = None


def _pdf_or_400(exc: paper_digitise.PaperPdfError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _estimate_or_402(db: Session, *, pages: int, institute_id: str) -> Dict[str, Any]:
    estimate = preflight_tool_credits(
        db, tool_key=paper_digitise.TOOL_KEY,
        tool_params=paper_digitise.tool_params(pages), institute_id=institute_id,
    )
    if estimate.get("sufficient") is False:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "message": (
                    f"Reading this paper needs about {estimate['estimated_credits']:.0f} credits but "
                    f"only {estimate.get('current_balance', 0):.0f} are available. Top up to continue."
                ),
                "estimate": estimate,
            },
        )
    return estimate


def _charge(
    *, pages: int, paper: paper_digitise.DigitisedPaper, institute_id: str,
    user_id: Optional[str], task_id: str,
) -> Dict[str, Any]:
    """Deduct for the delivered paper and report what happened.

    Returns {credits_charged, balance_after, billed}. A billing failure never
    fails the job — the questions exist and the teacher is mid-flow — but it is
    reported as billed=False rather than shown as a zero charge.
    """
    try:
        with db_session() as db:
            charged = charge_tool(
                db,
                tool_key=paper_digitise.TOOL_KEY,
                tool_params=paper_digitise.tool_params(pages),
                request_type=RequestType.ASSESSMENT,
                model=paper.model or "unknown",
                prompt_tokens=paper.prompt_tokens,
                completion_tokens=paper.completion_tokens,
                institute_id=institute_id,
                user_id=user_id,
                user_role="ADMIN",
                request_id=task_id,
                idempotency_key=f"paper_digitise:{task_id}",
            )
            from ..services.credit_service import CreditService  # local: avoids an import cycle
            balance = CreditService(db).get_balance(institute_id)
            after = float(balance.current_balance) if balance else None
        return {"credits_charged": float(Decimal(charged)), "balance_after": after, "billed": True}
    except Exception as exc:  # noqa: BLE001
        logger.warning("paper_digitise billing failed for task %s: %s", task_id, exc)
        return {"credits_charged": None, "balance_after": None, "billed": False}


@router.post("/estimate")
async def estimate(
    body: EstimateRequest,
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Fetch + validate the PDF and price the read, before anything is charged."""
    resolved = caller.require_institute(body.institute_id)
    try:
        pdf = await paper_digitise.fetch_paper_pdf(body.pdf_url)
    except paper_digitise.PaperPdfError as exc:
        raise _pdf_or_400(exc) from exc
    est = preflight_tool_credits(
        db, tool_key=paper_digitise.TOOL_KEY,
        tool_params=paper_digitise.tool_params(pdf.pages), institute_id=resolved,
    )
    return {
        "file_name": pdf.file_name,
        "pages": pdf.pages,
        "size_bytes": pdf.size_bytes,
        "estimate": est,
    }


@router.post("/start", status_code=status.HTTP_202_ACCEPTED)
async def start(
    body: StartRequest,
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Read the paper in the background. Poll GET /jobs/{task_id}."""
    resolved = caller.require_institute(body.institute_id)
    try:
        pdf = await paper_digitise.fetch_paper_pdf(body.pdf_url)
    except paper_digitise.PaperPdfError as exc:
        raise _pdf_or_400(exc) from exc
    est = _estimate_or_402(db, pages=pdf.pages, institute_id=resolved)

    primary_model, fallback_models = resolve_models(db, QUESTIONS_USE_CASE, body.preferred_model)
    models: List[str] = [primary_model, *fallback_models]
    task = AiTaskService(AiTaskRepository(db)).create(
        task_type=AiTaskType.PDF_TO_QUESTIONS,
        input_id=pdf.file_name[:255],
        input_type=AiTaskInputType.PDF_ID,
        task_name=f"Question paper — {body.title or pdf.file_name}"[:255],
        institute_id=resolved,
        dynamic_values={
            "model": primary_model,
            "params": {"pdf_url": body.pdf_url, "pages": pdf.pages, "tool": paper_digitise.TOOL_KEY},
        },
    )
    task_id = task.id
    user_id = caller.user_id
    expected_total = body.expected_total_marks

    async def _work() -> str:
        paper = await paper_digitise.digitise(pdf, models, expected_total=expected_total)
        if not paper.questions:
            # Nothing usable → the job FAILS and nothing is charged (MathPix cost is ours).
            raise RuntimeError(
                "No questions could be read from this PDF. If it is a scan, make sure the text is "
                "legible; otherwise create the test without AI checking."
            )
        billing = _charge(
            pages=pdf.pages, paper=paper, institute_id=resolved, user_id=user_id, task_id=task_id,
        )
        # `questions` in the LLM shape keeps this task readable in the AI Center
        # history (its converter expects that shape); the builder-ready payload
        # the offline-test form needs lives under `digitised`.
        return json.dumps(
            {
                "title": paper.title,
                "questions": paper.raw_questions,
                "digitised": {
                    **paper.to_dict(),
                    "pages": pdf.pages,
                    "file_name": pdf.file_name,
                    "estimate": est,
                    **billing,
                },
            },
            ensure_ascii=False,
        )

    ai_task_service.schedule(task_id, _work)
    logger.info("paper_digitise started task=%s pages=%s institute=%s", task_id, pdf.pages, resolved)
    return {
        "task_id": task_id,
        "file_name": pdf.file_name,
        "pages": pdf.pages,
        "estimate": est,
    }


@router.get("/jobs/{task_id}")
async def get_job(
    task_id: str,
    institute_id: Optional[str] = Query(None),
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Poll. `result` is the digitised paper (questions, warnings, credits) once COMPLETED."""
    resolved = caller.require_institute(institute_id)
    task = AiTaskRepository(db).get(task_id)
    if not task or task.institute_id != resolved:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    result: Optional[Dict[str, Any]] = None
    if task.result_json:
        try:
            result = (json.loads(task.result_json) or {}).get("digitised")
        except Exception:  # noqa: BLE001
            result = None
    return {
        "task_id": task_id,
        "status": task.status,
        "status_message": task.status_message,
        "result": result,
    }
