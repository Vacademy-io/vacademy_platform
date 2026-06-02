"""Retry router — migrated from media_service RetryController.

  POST /ai-service/ai/retry/task?taskId=          (re-run a failed task)
  GET  /ai-service/ai/retry/available-models       (model picker data)

Retry reconstructs the original work from the task's persisted params
(dynamic_values_map.params), optionally swaps the model, creates a fresh task,
and schedules it — same flow as media. The new task is itself retryable (it
carries the same params).
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from ..core.security import get_optional_user
from ..db import db_dependency
from ..models.ai_task import AiTaskInputType, AiTaskStatus, AiTaskType
from ..repositories.ai_task_repository import AiTaskRepository
from ..services import ai_task_service, retry_dispatch
from ..services.ai_models_service import AIModelsService
from ..services.ai_task_service import AiTaskService
from ..services.model_selection import resolve_models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/retry", tags=["AI Retry"])


class RetryRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    preferredModel: Optional[str] = None
    maxRetries: Optional[int] = None
    enableFallback: Optional[bool] = None


@router.post("/task")
async def retry_task(
    taskId: str = Query(...),
    body: Optional[RetryRequest] = Body(None),
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
) -> Dict[str, Any]:
    """Re-run a failed task with an optional model override."""
    repo = AiTaskRepository(db)
    old = repo.get(taskId)
    if not old:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task not found: {taskId}")

    if not old.dynamic_values_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task does not have saved parameters for retry. Please create a new request.",
        )
    try:
        saved = json.loads(old.dynamic_values_map)
    except Exception:  # noqa: BLE001
        saved = {}
    params = saved.get("params")
    if not isinstance(params, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task does not have saved parameters for retry. Please create a new request.",
        )

    task_type = old.task_type
    preferred = body.preferredModel if body else None
    primary_model, fallback_models = resolve_models(
        db, retry_dispatch.use_case_for(task_type), preferred
    )
    models = [primary_model, *fallback_models]
    user_id = getattr(user, "user_id", None)

    # Create the retry task (same inputs; name suffixed; carries params so it's
    # itself retryable).
    new_task = AiTaskService(repo).create(
        task_type=AiTaskType(task_type),
        input_id=old.input_id or "",
        input_type=AiTaskInputType(old.input_type) if old.input_type else AiTaskInputType.PROMPT_ID,
        task_name=f"{old.task_name or ''}_retry",
        institute_id=old.institute_id,
        dynamic_values={"model": primary_model, "params": params},
    )

    try:
        work = retry_dispatch.make_work(
            task_type, params, models,
            institute_id=old.institute_id, user_id=user_id, task_id=new_task.id,
        )
    except retry_dispatch.NotRetryable as exc:
        # Roll the just-created row to FAILED so it doesn't dangle in PROGRESS.
        repo.update_status(new_task.id, AiTaskStatus.FAILED, status_message=str(exc))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    ai_task_service.schedule(new_task.id, work)
    logger.info("Retry: new taskId=%s from original=%s type=%s model=%s",
                new_task.id, taskId, task_type, primary_model)
    return {
        "taskId": new_task.id,
        "originalTaskId": taskId,
        "status": "STARTED",
        "message": "Retry initiated successfully",
    }


@router.get("/available-models")
def available_models(db: Session = Depends(db_dependency)) -> Dict[str, Any]:
    """Model-picker data — {defaultModel, availableModels, fallbackModels} from
    the DB registry (replaces media's hardcoded AiModelConfig lists)."""
    default_model, fallbacks = resolve_models(db, "questions", None)
    try:
        models = AIModelsService(db).get_all_models(active_only=True).models
        available = [m.model_id for m in models]
    except Exception as exc:  # noqa: BLE001
        logger.warning("available-models registry read failed: %s", exc)
        available = [default_model, *fallbacks]
    return {
        "defaultModel": default_model,
        "availableModels": available,
        "fallbackModels": fallbacks,
    }
