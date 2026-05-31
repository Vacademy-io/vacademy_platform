"""AI evaluation-tool router — migrated from media_service AiEvaluationController.

  POST /ai-service/ai/evaluation-tool/evaluate-assessment   (async kickoff)
  GET  /ai-service/ai/evaluation-tool/status/{taskId}        (poll)

Kickoff returns {task_id, status:"PROCESSING", response:<initial WAITING json>}
immediately; the per-student extract→score work runs in the background and
updates the task's result_json incrementally, which the FE re-parses on each
5s poll. (details/assessment/{id} + learner-account provisioning are out of the
lean scope — see evaluation_service docstring.)
"""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.security import get_optional_user
from ..db import db_dependency
from ..schemas.evaluation import EvaluationRequestResponse, EvaluationUserDTO
from ..services import evaluation_service
from ..services.model_selection import resolve_models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/evaluation-tool", tags=["AI Evaluation Tool"])


@router.post("/evaluate-assessment", response_model=EvaluationRequestResponse)
async def evaluate_assessment(
    users: List[EvaluationUserDTO] = Body(...),
    assessmentId: str = Query(...),
    instituteId: Optional[str] = Query(None),
    preferredModel: Optional[str] = Query(None),
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
) -> EvaluationRequestResponse:
    """Kick off evaluation for a list of students against an assessment."""
    primary_model, fallback_models = resolve_models(
        db, evaluation_service.EVALUATION_USE_CASE, preferredModel
    )
    user_id = getattr(user, "user_id", None)
    try:
        result = await evaluation_service.start_evaluation(
            assessment_id=assessmentId,
            users=users,
            models=[primary_model, *fallback_models],
            institute_id=instituteId,
            user_id=user_id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("evaluate-assessment kickoff failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    return EvaluationRequestResponse(**result)


@router.get("/status/{taskId}", response_model=EvaluationRequestResponse)
def get_status(taskId: str, db: Session = Depends(db_dependency)) -> EvaluationRequestResponse:
    """Poll evaluation progress/result. resultJson grows as students finish."""
    result = evaluation_service.get_task_update(db, taskId)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return EvaluationRequestResponse(**result)
