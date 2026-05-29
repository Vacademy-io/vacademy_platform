"""Copy-check endpoints. Owns:
  - POST /copy-check/grade            (Java triggers a copy grade)
  - POST /copy-check/{job_id}/cancel
  - GET  /copy-check/{job_id}/status
  - GET  /copy-check/rubric/{assessment_id}
  - POST /copy-check/rubric           (upsert assessment rubric)
  - DELETE /copy-check/rubric/{assessment_id}
  - PUT  /copy-check/rubric/{assessment_id}/question/{question_id}
  - DELETE /copy-check/rubric/{assessment_id}/question/{question_id}

All gated by X-Internal-Service-Token (Java assessment_service is the only
intended caller). The rubric endpoints will be proxied through Java for the FE.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import db_dependency, db_session
from ..dependencies import require_internal_service_token
from ..repositories.copy_check_question_answer_repository import (
    CopyCheckQuestionAnswerRepository,
)
from ..repositories.copy_check_rubric_repository import CopyCheckRubricRepository
from ..schemas.copy_check import (
    CopyCheckGradeRequest,
    CopyCheckGradeResponse,
    RubricResponse,
    UpsertQuestionAnswerRequest,
    UpsertRubricRequest,
)
from ..services.copy_check import cancellation
from ..services.copy_check.orchestrator import grade_copy, run

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copy-check", tags=["copy-check"])


# In-memory job tracker — Java has the authoritative state, this is just so
# the /status endpoint can answer "is it still running" without a DB hit.
_jobs: dict[str, dict] = {}


@router.post(
    "/grade",
    response_model=CopyCheckGradeResponse,
    dependencies=[Depends(require_internal_service_token)],
)
async def submit_grade_job(
    req: CopyCheckGradeRequest,
    background: BackgroundTasks,
):
    payload = req.model_dump()
    job_id = await grade_copy(process_id=req.process_id)
    _jobs[job_id] = {
        "job_id": job_id,
        "process_id": req.process_id,
        "status": "PROCESSING",
        "started_at": datetime.utcnow().isoformat(),
    }
    # FastAPI BackgroundTasks creates a fresh DB session per request; we want
    # the BG task to own its own session that survives the response cycle.
    background.add_task(_run_with_session, payload, job_id)
    return CopyCheckGradeResponse(job_id=job_id, status="PROCESSING")


async def _run_with_session(payload: dict, job_id: str) -> None:
    try:
        with db_session() as bg_db:
            await run(payload, job_id, bg_db)
    finally:
        _jobs.pop(job_id, None)


@router.post(
    "/{job_id}/cancel",
    dependencies=[Depends(require_internal_service_token)],
)
async def cancel_job(job_id: str):
    cancellation.cancel(job_id)
    return {"job_id": job_id, "cancelled": True}


@router.post(
    "/by-process/{process_id}/cancel",
    dependencies=[Depends(require_internal_service_token)],
)
async def cancel_by_process(process_id: str):
    """Cancel by process_id — closes the race where Java's stop endpoint
    fires before ai_service has echoed back the job_id (#16)."""
    cancellation.cancel_by_process(process_id)
    return {"process_id": process_id, "cancelled": True}


@router.get(
    "/{job_id}/status",
    dependencies=[Depends(require_internal_service_token)],
)
async def get_status(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(status_code=404, detail="Job not found or already completed")
    return _jobs[job_id]


# --------------------------- Rubric CRUD ------------------------------------

@router.get(
    "/rubric/{assessment_id}",
    response_model=RubricResponse,
    dependencies=[Depends(require_internal_service_token)],
)
async def get_rubric(assessment_id: str, db: Session = Depends(db_dependency)):
    repo = CopyCheckRubricRepository(db)
    row = repo.get(assessment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Rubric not found")
    return RubricResponse(
        assessment_id=row.assessment_id,
        institute_id=row.institute_id,
        rubric_version=row.rubric_version,
        rubric=json.loads(row.rubric_json),
        model_answers=json.loads(row.model_answers_json) if row.model_answers_json else {},
        updated_at=row.updated_at.isoformat() if row.updated_at else "",
    )


@router.post(
    "/rubric",
    response_model=RubricResponse,
    dependencies=[Depends(require_internal_service_token)],
)
async def upsert_rubric(req: UpsertRubricRequest, db: Session = Depends(db_dependency)):
    repo = CopyCheckRubricRepository(db)
    rubric_dict = {qid: r.model_dump() for qid, r in req.rubric.items()}
    row = repo.upsert(
        assessment_id=req.assessment_id,
        institute_id=req.institute_id,
        rubric=rubric_dict,
        model_answers=req.model_answers,
        created_by=req.created_by,
    )
    return RubricResponse(
        assessment_id=row.assessment_id,
        institute_id=row.institute_id,
        rubric_version=row.rubric_version,
        rubric=json.loads(row.rubric_json),
        model_answers=json.loads(row.model_answers_json) if row.model_answers_json else {},
        updated_at=row.updated_at.isoformat() if row.updated_at else "",
    )


@router.delete(
    "/rubric/{assessment_id}",
    dependencies=[Depends(require_internal_service_token)],
)
async def delete_rubric(assessment_id: str, db: Session = Depends(db_dependency)):
    repo = CopyCheckRubricRepository(db)
    deleted = repo.delete(assessment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Rubric not found")
    return {"assessment_id": assessment_id, "deleted": True}


@router.put(
    "/rubric/{assessment_id}/question/{question_id}",
    dependencies=[Depends(require_internal_service_token)],
)
async def upsert_question_answer(
    assessment_id: str,
    question_id: str,
    req: UpsertQuestionAnswerRequest,
    db: Session = Depends(db_dependency),
):
    repo = CopyCheckQuestionAnswerRepository(db)
    step_rubric = req.step_rubric.model_dump() if req.step_rubric else None
    row = repo.upsert(assessment_id, question_id, req.model_answer, step_rubric)
    # Bump the assessment-level rubric_version so the FE can show a 'rubric
    # changed' badge on past evaluations.
    rubric_repo = CopyCheckRubricRepository(db)
    existing = rubric_repo.get(assessment_id)
    if existing:
        existing.rubric_version = existing.rubric_version + 1
        existing.updated_at = datetime.utcnow()
        db.commit()
    return {
        "assessment_id": assessment_id,
        "question_id": question_id,
        "model_answer": row.model_answer,
        "updated_at": row.updated_at.isoformat() if row.updated_at else "",
    }


@router.delete(
    "/rubric/{assessment_id}/question/{question_id}",
    dependencies=[Depends(require_internal_service_token)],
)
async def delete_question_answer(
    assessment_id: str,
    question_id: str,
    db: Session = Depends(db_dependency),
):
    repo = CopyCheckQuestionAnswerRepository(db)
    deleted = repo.delete(assessment_id, question_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Question answer not found")
    return {"assessment_id": assessment_id, "question_id": question_id, "deleted": True}
