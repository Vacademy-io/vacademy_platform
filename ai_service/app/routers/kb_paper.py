"""Question papers generated from a knowledge base (V441).

Three moments, three endpoints, and the credit cost is previewed at each one so
the number on screen always matches the button about to be pressed:

    POST /bases/{kb_id}/paper/blueprint   plan (or revise) — cheap, iterate freely
    POST /bases/{kb_id}/paper/generate    write the questions — async, the big spend
    POST /bases/{kb_id}/paper/regenerate  redo ONE question the teacher rejected

Generation is async because a 60-question paper is roughly ten batched LLM calls:
minutes, not seconds. It returns a task id; poll GET /paper-jobs/{task_id}.

Questions come back already run through `question_format.format_questions`, i.e.
the exact QuestionDTO shape the assessment builder consumes from every other AI
source — so saving to the question bank is the FE's existing
`POST /assessment-service/question-paper/manage/v1/add` call with no new Java.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import db_dependency, db_session
from ..models.ai_task import AiTaskInputType, AiTaskType
from ..models.ai_token_usage import RequestType
from ..repositories.ai_task_repository import AiTaskRepository
from ..services import ai_task_service
from ..services.ai_billing import preflight_tool_credits, record_tool_billing
from ..services.ai_task_service import AiTaskService
from ..services.kb import paper as kb_paper
from ..services.kb.repository import KbRepository
from .knowledge_base import Caller, get_caller

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge-base/v1", tags=["knowledge-base-paper"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PaperSpec(BaseModel):
    """What the teacher asked for, from the short intake form."""
    total_marks: Optional[int] = Field(None, ge=1, le=500)
    duration_minutes: Optional[int] = Field(None, ge=5, le=600)
    difficulty: Optional[str] = None          # EASY | MEDIUM | HARD | MIXED
    question_types: Optional[List[str]] = None
    grade: Optional[str] = None
    language: Optional[str] = None
    exam_style: Optional[str] = None          # e.g. "CBSE board pattern"


class BlueprintRequest(BaseModel):
    spec: PaperSpec = Field(default_factory=PaperSpec)
    selected_node_ids: Optional[List[str]] = None
    # Present on a REFINE: the blueprint currently on screen plus what to change.
    current_blueprint: Optional[Dict[str, Any]] = None
    instruction: Optional[str] = None
    institute_id: Optional[str] = None


class GenerateRequest(BaseModel):
    blueprint: Dict[str, Any]
    grade: Optional[str] = None
    institute_id: Optional[str] = None


class RegenerateRequest(BaseModel):
    """Redo one question, optionally nudged ('make it harder', 'use a diagram')."""
    blueprint_row: Dict[str, Any]
    instruction: Optional[str] = None
    grade: Optional[str] = None
    institute_id: Optional[str] = None


class ValidateRequest(BaseModel):
    blueprint: Dict[str, Any]
    questions: List[Dict[str, Any]]
    institute_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _preflight_or_402(db: Session, *, tool_key: str, params: dict, institute_id: str) -> dict:
    estimate = preflight_tool_credits(
        db, tool_key=tool_key, tool_params=params, institute_id=institute_id
    )
    if estimate.get("sufficient") is False:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "message": (
                    f"This needs about {estimate['estimated_credits']:.0f} credits but "
                    f"only {estimate.get('current_balance', 0):.0f} are available. "
                    "Top up to continue."
                ),
                "estimate": estimate,
            },
        )
    return estimate


def _bill(
    tool_key: str, params: dict, *, model: Optional[str], usage: Dict[str, int],
    institute_id: str, user_id: Optional[str], idempotency_key: Optional[str] = None,
) -> None:
    record_tool_billing(
        tool_key=tool_key,
        tool_params=params,
        request_type=RequestType.ASSESSMENT,
        model=model or "unknown",
        prompt_tokens=int((usage or {}).get("prompt_tokens") or 0),
        completion_tokens=int((usage or {}).get("completion_tokens") or 0),
        institute_id=institute_id,
        user_id=user_id,
        user_role="ADMIN",
        idempotency_key=idempotency_key,
    )


def _assert_kb(db: Session, kb_id: str, institute_id: str) -> Dict[str, Any]:
    kb = KbRepository(db).get_kb(kb_id, institute_id)
    if not kb:
        raise HTTPException(404, "Knowledge base not found")
    return kb


# ---------------------------------------------------------------------------
# 1. Blueprint
# ---------------------------------------------------------------------------

@router.post("/bases/{kb_id}/paper/blueprint")
async def build_or_refine_blueprint(
    kb_id: str,
    body: BlueprintRequest,
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Plan a paper from the KB's chapter tree, or revise the current plan.

    The same endpoint serves the first build and every chat refinement — a
    refinement just carries `current_blueprint` plus `instruction`, and the
    planner returns the FULL updated plan so the teacher's earlier edits survive.
    """
    resolved = caller.require_institute(body.institute_id)
    _assert_kb(db, kb_id, resolved)
    _preflight_or_402(db, tool_key="kb_paper_blueprint", params={}, institute_id=resolved)

    current = (
        kb_paper.Blueprint.from_dict(body.current_blueprint)
        if body.current_blueprint
        else None
    )
    try:
        blueprint, usage, model = await kb_paper.build_blueprint(
            db,
            kb_id=kb_id,
            institute_id=resolved,
            spec=body.spec.model_dump(exclude_none=True),
            selected_node_ids=body.selected_node_ids,
            current=current,
            instruction=body.instruction,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Blueprint failed for kb=%s", kb_id)
        raise HTTPException(502, "The paper plan could not be generated. Please try again.") from exc

    _bill("kb_paper_blueprint", {}, model=model, usage=usage,
          institute_id=resolved, user_id=caller.user_id)

    # What generating THIS plan will cost, so the teacher sees it on the button
    # before committing rather than after.
    estimate = preflight_tool_credits(
        db, tool_key="kb_paper_questions",
        tool_params={"num_questions": blueprint.total_questions},
        institute_id=resolved,
    )
    return {"blueprint": blueprint.to_dict(), "generation_estimate": estimate}


# ---------------------------------------------------------------------------
# 2. Generate
# ---------------------------------------------------------------------------

@router.post("/bases/{kb_id}/paper/generate", status_code=202)
async def generate_paper(
    kb_id: str,
    body: GenerateRequest,
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Write every question in the blueprint. Async — poll GET /paper-jobs/{id}."""
    resolved = caller.require_institute(body.institute_id)
    _assert_kb(db, kb_id, resolved)

    blueprint = kb_paper.Blueprint.from_dict(body.blueprint)
    if blueprint.total_questions <= 0:
        raise HTTPException(400, "This plan has no questions in it")
    if blueprint.total_questions > kb_paper.MAX_QUESTIONS_PER_PAPER:
        raise HTTPException(
            400,
            f"This plan has {blueprint.total_questions} questions; the limit per paper "
            f"is {kb_paper.MAX_QUESTIONS_PER_PAPER}. Reduce some counts first.",
        )
    _preflight_or_402(
        db, tool_key="kb_paper_questions",
        params={"num_questions": blueprint.total_questions}, institute_id=resolved,
    )

    task = AiTaskService(AiTaskRepository(db)).create(
        task_type=AiTaskType.KB_PAPER_GENERATE,
        input_id=kb_id,
        input_type=AiTaskInputType.PROMPT_ID,
        task_name=f"Question paper — {blueprint.title}",
        institute_id=resolved,
        dynamic_values={"kb_id": kb_id, "user_id": caller.user_id},
    )
    task_id = str(task.id)
    user_id = caller.user_id
    grade = body.grade

    async def work() -> str:
        with db_session() as job_db:
            generated = await kb_paper.generate_questions(
                job_db, kb_id=kb_id, institute_id=resolved,
                blueprint=blueprint, grade=grade,
            )
            issues = kb_paper.validate_paper(blueprint, generated.questions)

        # Charge on questions DELIVERED, never on questions planned — a paper
        # the material could only half-support must not cost a full paper.
        if generated.questions:
            _bill(
                "kb_paper_questions",
                {"num_questions": len(generated.questions)},
                model=generated.model,
                usage={
                    "prompt_tokens": generated.prompt_tokens,
                    "completion_tokens": generated.completion_tokens,
                },
                institute_id=resolved, user_id=user_id,
                # Keyed on the task, so a retry of the same job cannot double-charge.
                idempotency_key=f"kb_paper:{task_id}",
            )

        # Paired so `questions[i]` always describes `raw_questions[i]`. The review
        # board maps a rewritten question back by index, so a silent skip inside
        # the formatter would otherwise replace the WRONG question.
        raw_kept, formatted, format_warnings = kb_paper.pair_with_formatted(
            generated.questions
        )
        return json.dumps({
            "blueprint": blueprint.to_dict(),
            # Assessment-builder shape, identical to every other AI source.
            "questions": formatted,
            # The raw shape keeps kb_meta (citations, figures) for the review board.
            "raw_questions": raw_kept,
            "issues": [
                {
                    "question_number": i.question_number, "severity": i.severity,
                    "kind": i.kind, "message": i.message,
                }
                for i in issues
            ],
            "warnings": generated.warnings + format_warnings,
            "delivered": len(formatted),
            "planned": blueprint.total_questions,
        })

    ai_task_service.schedule(task_id, work)
    return {"task_id": task_id, "status": "PROGRESS", "planned": blueprint.total_questions}


@router.get("/paper-jobs/{task_id}")
async def get_paper_job(
    task_id: str,
    institute_id: Optional[str] = Query(None),
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Poll a generation job. Returns the paper once status is COMPLETED."""
    resolved = caller.require_institute(institute_id)
    task = AiTaskRepository(db).get(task_id)
    if not task or task.institute_id != resolved:
        raise HTTPException(404, "Job not found")

    payload: Optional[Dict[str, Any]] = None
    if task.result_json:
        try:
            payload = json.loads(task.result_json)
        except Exception:  # noqa: BLE001
            payload = None
    return {
        "task_id": task_id,
        "status": task.status,
        "status_message": task.status_message,
        "result": payload,
    }


# ---------------------------------------------------------------------------
# 3. Regenerate one question
# ---------------------------------------------------------------------------

@router.post("/bases/{kb_id}/paper/regenerate")
async def regenerate_question(
    kb_id: str,
    body: RegenerateRequest,
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Rewrite a single question the teacher rejected.

    Deliberately cheap and synchronous: one question is a few seconds, and if
    fixing a bad question felt expensive teachers would keep it instead — which
    is exactly what makes generated papers feel untrustworthy.
    """
    resolved = caller.require_institute(body.institute_id)
    _assert_kb(db, kb_id, resolved)
    _preflight_or_402(db, tool_key="kb_paper_regenerate", params={}, institute_id=resolved)

    row = kb_paper.BlueprintRow.from_dict(body.blueprint_row)
    row.count = 1
    if body.instruction:
        row.instruction = f"{row.instruction or ''} {body.instruction}".strip()

    single = kb_paper.Blueprint(
        title="regenerate", rows=[row],
        language=body.blueprint_row.get("language"),
    )
    generated = await kb_paper.generate_questions(
        db, kb_id=kb_id, institute_id=resolved, blueprint=single, grade=body.grade
    )
    if not generated.questions:
        raise HTTPException(
            422,
            "No suitable question could be written for that topic from this material. "
            "Try widening the chapter selection or changing the question type.",
        )

    # Format BEFORE billing: a question that cannot be converted is not a
    # delivered question, and charging for it would be charging for nothing.
    raw_kept, formatted, _ = kb_paper.pair_with_formatted(generated.questions[:1])
    if not formatted:
        raise HTTPException(
            422,
            "The rewritten question came back malformed. Please try again.",
        )

    _bill("kb_paper_regenerate", {}, model=generated.model,
          usage={"prompt_tokens": generated.prompt_tokens,
                 "completion_tokens": generated.completion_tokens},
          institute_id=resolved, user_id=caller.user_id)

    return {"question": formatted[0], "raw_question": raw_kept[0]}


# ---------------------------------------------------------------------------
# 4. Validate (free — deterministic, no LLM)
# ---------------------------------------------------------------------------

@router.post("/bases/{kb_id}/paper/validate")
async def validate_paper(
    kb_id: str,
    body: ValidateRequest,
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Re-check a paper after the teacher has edited it. Not metered: this is
    arithmetic and string comparison, not a model call."""
    resolved = caller.require_institute(body.institute_id)
    _assert_kb(db, kb_id, resolved)
    issues = kb_paper.validate_paper(
        kb_paper.Blueprint.from_dict(body.blueprint), body.questions
    )
    return {
        "issues": [
            {
                "question_number": i.question_number, "severity": i.severity,
                "kind": i.kind, "message": i.message,
            }
            for i in issues
        ],
        "error_count": sum(1 for i in issues if i.severity == "error"),
        "warning_count": sum(1 for i in issues if i.severity == "warning"),
    }
