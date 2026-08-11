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
from ..services.kb import generations as kb_generations
from ..services.kb import paper as kb_paper
from ..services.kb.repository import KbRepository
from .knowledge_base import Caller, get_caller, require_usable

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge-base/v1", tags=["knowledge-base-paper"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PaperSpec(BaseModel):
    """What the teacher asked for, from the short intake form."""
    # A teacher thinks in QUESTIONS ("I want a 20-question test"); marks fall out
    # of the blueprint they then edit. total_marks stays accepted for callers
    # that prefer it, but total_questions is what the UI asks for.
    total_questions: Optional[int] = Field(None, ge=1, le=200)
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
    """Load a KB the caller may actually generate from.

    Every paper endpoint funnels through here, so the entitlement gate lives
    here too: a shared library the institute has not unlocked is a 402, and a
    new endpoint added later cannot forget the check.
    """
    repo = KbRepository(db)
    kb = repo.get_kb(kb_id, institute_id)
    if not kb:
        raise HTTPException(404, "Knowledge base not found")
    require_usable(repo, kb, institute_id)
    return kb


def _topic_label(repo: KbRepository, kb_id: str, node_ids: Optional[List[str]]) -> str:
    """Human name for the chosen topics, used as the retrieval subject.

    Retrieval is far sharper when it queries "Rotational Motion" than the name
    of a 400-page book, so the picked topics — not the knowledge base — decide
    what gets searched. Subtopics collapse to their parents to keep the label
    short when someone selects a whole branch.
    """
    if not node_ids:
        return ""
    wanted = set(node_ids)
    tree = repo.get_topic_tree(kb_id)
    picked_parents = [n["title"] for n in tree if n["id"] in wanted and n["title"]]
    if not picked_parents:
        # Only subtopics were selected — name them directly.
        picked_parents = [
            c["title"]
            for n in tree
            for c in (n.get("children") or [])
            if c["id"] in wanted and c.get("title")
        ]
    if not picked_parents:
        return ""
    if len(picked_parents) <= 3:
        return ", ".join(picked_parents)
    return f"{', '.join(picked_parents[:3])} and {len(picked_parents) - 3} more"


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

    # Record the run BEFORE it starts, so a generation that fails or that the
    # user navigates away from is still visible and resumable. input_json keeps
    # the blueprint — resuming restores the PLAN, not just the output.
    generation_id = kb_generations.create(
        db,
        kb_id=kb_id,
        institute_id=resolved,
        artifact_type="QUESTION_PAPER",
        title=blueprint.title,
        status="GENERATING",
        input_payload={"blueprint": blueprint.to_dict(), "grade": grade},
        ai_task_id=task_id,
        items_planned=blueprint.total_questions,
        created_by=user_id,
    )

    async def work() -> str:
        try:
            return await _run_generation()
        except Exception as exc:
            # ai_task records FAILED too, but that row is not surfaced anywhere.
            # THIS is what the teacher sees, so it must never be left stuck on
            # GENERATING — a spinner that never resolves is the exact failure
            # mode this history exists to remove.
            if generation_id:
                with db_session() as hist_db:
                    kb_generations.update(
                        hist_db, generation_id, status="FAILED",
                        error_message=str(exc)[:2000],
                    )
            raise

    async def _run_generation() -> str:
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
        payload = {
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
        }
        if generation_id:
            with db_session() as hist_db:
                kb_generations.update(
                    hist_db, generation_id,
                    status="READY" if formatted else "FAILED",
                    progress=100,
                    result_payload=payload,
                    items_delivered=len(formatted),
                    error_message=None if formatted else
                    "No questions could be written from the selected material.",
                )
        return json.dumps(payload)

    ai_task_service.schedule(task_id, work)
    return {"task_id": task_id, "status": "PROGRESS", "planned": blueprint.total_questions}


class SectionRequest(BaseModel):
    """Fill ONE assessment section from a knowledge base.

    Deliberately not a blueprint: the assessment already has sections with their
    own marks and duration, so re-planning sections inside one of them would
    fight the existing UI. The teacher states what this section needs and it is
    generated directly — which also skips the planning LLM call entirely.
    """
    selected_node_ids: Optional[List[str]] = None   # topics/subtopics; empty = whole KB
    count: int = Field(10, ge=1, le=60)
    question_type: str = "MCQS"
    difficulty: str = "MEDIUM"
    marks_each: float = Field(1, ge=0)
    section_title: Optional[str] = Field(None, max_length=200)
    grade: Optional[str] = None
    language: Optional[str] = None
    institute_id: Optional[str] = None


@router.post("/bases/{kb_id}/paper/section", status_code=202)
async def generate_for_section(
    kb_id: str,
    body: SectionRequest,
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Generate questions for one assessment section. Poll GET /paper-jobs/{id}.

    Returns the same result shape as whole-paper generation, so the review board
    is shared between the standalone builder and the assessment flow.
    """
    resolved = caller.require_institute(body.institute_id)
    kb = _assert_kb(db, kb_id, resolved)
    repo = KbRepository(db)

    qtype = (body.question_type or "MCQS").upper()
    if qtype not in kb_paper.QUESTION_TYPES:
        raise HTTPException(400, f"question_type must be one of {kb_paper.QUESTION_TYPES}")

    # Name the row after the topics actually chosen, so retrieval queries the
    # subject the teacher picked rather than the knowledge base as a whole.
    topic_label = _topic_label(repo, kb_id, body.selected_node_ids) or kb["name"]

    blueprint = kb_paper.Blueprint(
        title=body.section_title or f"{topic_label} — {body.count} questions",
        language=body.language,
        rows=[
            kb_paper.BlueprintRow(
                id="section-1",
                section=body.section_title or "Section",
                topic=topic_label,
                node_ids=list(body.selected_node_ids or []),
                question_type=qtype,
                count=body.count,
                marks_each=body.marks_each,
                difficulty=(body.difficulty or "MEDIUM").upper(),
            )
        ],
    )
    _preflight_or_402(
        db, tool_key="kb_paper_questions",
        params={"num_questions": body.count}, institute_id=resolved,
    )

    task = AiTaskService(AiTaskRepository(db)).create(
        task_type=AiTaskType.KB_PAPER_GENERATE,
        input_id=kb_id,
        input_type=AiTaskInputType.PROMPT_ID,
        task_name=f"Assessment section — {topic_label}",
        institute_id=resolved,
        dynamic_values={"kb_id": kb_id, "user_id": caller.user_id, "mode": "section"},
    )
    task_id = str(task.id)
    user_id = caller.user_id
    grade = body.grade

    generation_id = kb_generations.create(
        db,
        kb_id=kb_id, institute_id=resolved,
        artifact_type="ASSESSMENT",
        title=blueprint.title,
        status="GENERATING",
        input_payload={
            "blueprint": blueprint.to_dict(),
            "grade": grade,
            "mode": "section",
            "selected_node_ids": body.selected_node_ids or [],
        },
        ai_task_id=task_id,
        items_planned=body.count,
        created_by=user_id,
    )

    async def work() -> str:
        try:
            with db_session() as job_db:
                generated = await kb_paper.generate_questions(
                    job_db, kb_id=kb_id, institute_id=resolved,
                    blueprint=blueprint, grade=grade,
                )
                issues = kb_paper.validate_paper(blueprint, generated.questions)

            if generated.questions:
                _bill(
                    "kb_paper_questions", {"num_questions": len(generated.questions)},
                    model=generated.model,
                    usage={
                        "prompt_tokens": generated.prompt_tokens,
                        "completion_tokens": generated.completion_tokens,
                    },
                    institute_id=resolved, user_id=user_id,
                    idempotency_key=f"kb_paper:{task_id}",
                )

            raw_kept, formatted, format_warnings = kb_paper.pair_with_formatted(
                generated.questions
            )
            payload = {
                "blueprint": blueprint.to_dict(),
                "questions": formatted,
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
                "planned": body.count,
            }
            if generation_id:
                with db_session() as hist_db:
                    kb_generations.update(
                        hist_db, generation_id,
                        status="READY" if formatted else "FAILED",
                        progress=100, result_payload=payload,
                        items_delivered=len(formatted),
                        error_message=None if formatted else
                        "No questions could be written from the selected topics.",
                    )
            return json.dumps(payload)
        except Exception as exc:
            if generation_id:
                with db_session() as hist_db:
                    kb_generations.update(
                        hist_db, generation_id, status="FAILED",
                        error_message=str(exc)[:2000],
                    )
            raise

    ai_task_service.schedule(task_id, work)
    return {
        "task_id": task_id,
        "status": "PROGRESS",
        "generation_id": generation_id,
        "planned": body.count,
    }


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
# History — what this knowledge base has produced
#
# Artifact-agnostic on purpose: these endpoints know nothing about question
# papers. A future course generator writes rows with artifact_type='COURSE' and
# gets listing, resume and deletion for free.
# ---------------------------------------------------------------------------

class GenerationUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=500)
    status: Optional[str] = None
    external_id: Optional[str] = None
    external_type: Optional[str] = None
    institute_id: Optional[str] = None


@router.get("/bases/{kb_id}/generations")
async def list_generations(
    kb_id: str,
    artifact_type: Optional[str] = Query(None, description="e.g. QUESTION_PAPER"),
    limit: int = Query(50, ge=1, le=200),
    institute_id: Optional[str] = Query(None),
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Everything created from this knowledge base, newest first.

    Result payloads are omitted — a list of 50 papers would otherwise be
    megabytes. Fetch one record to get its blueprint and questions.
    """
    resolved = caller.require_institute(institute_id)
    _assert_kb(db, kb_id, resolved)
    return {
        "generations": kb_generations.list_for_kb(
            db, kb_id, resolved, artifact_type=artifact_type, limit=limit
        )
    }


@router.get("/generations/{generation_id}")
async def get_generation(
    generation_id: str,
    institute_id: Optional[str] = Query(None),
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """One record WITH its input and result — this is what Resume reads."""
    resolved = caller.require_institute(institute_id)
    record = kb_generations.get(db, generation_id, resolved)
    if not record:
        raise HTTPException(404, "Not found")
    return record


@router.patch("/generations/{generation_id}")
async def update_generation(
    generation_id: str,
    body: GenerationUpdate,
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Rename, or record where the artifact ended up once saved.

    The FE calls this after a successful save to the question bank so the history
    can link straight to the saved paper instead of offering to save it again.
    """
    resolved = caller.require_institute(body.institute_id)
    if not kb_generations.get(db, generation_id, resolved):
        raise HTTPException(404, "Not found")
    if body.status is not None and body.status not in kb_generations.STATUSES:
        raise HTTPException(400, f"status must be one of {kb_generations.STATUSES}")
    kb_generations.update(
        db, generation_id,
        title=body.title, status=body.status,
        external_id=body.external_id, external_type=body.external_type,
    )
    return kb_generations.get(db, generation_id, resolved)


@router.delete("/generations/{generation_id}")
async def delete_generation(
    generation_id: str,
    institute_id: Optional[str] = Query(None),
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Remove a history entry. Does NOT delete anything already saved elsewhere —
    a paper in the question bank stays there."""
    resolved = caller.require_institute(institute_id)
    if not kb_generations.delete(db, generation_id, resolved):
        raise HTTPException(404, "Not found")
    return {"deleted": True}


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
