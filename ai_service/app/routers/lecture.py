"""
Lecture AI router — migrated from media_service AiLectureController.

Kick-off endpoint mirrors GET /media-service/ai/lecture/generate-plan exactly
(same query params, same {taskId, status, model, message} response), so the
frontend cutover is a base-URL flip in urls.ts with no payload changes.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.security import get_optional_user
from ..db import db_dependency
from ..models.ai_task import AiTaskInputType, AiTaskType
from ..repositories.ai_task_repository import AiTaskRepository
from ..schemas.ai_task import LectureFeedbackKickoffResponse, LecturePlanKickoffResponse
from ..services import ai_task_service, lecture_feedback_service, lecture_planner_service
from ..services.ai_task_service import AiTaskService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/lecture", tags=["AI Lecture"])


# NOTE: async def is REQUIRED — the kick-off schedules background work via
# asyncio.create_task, which needs a running event loop in the current thread.
# A sync (`def`) handler runs in a threadpool with no loop and would crash.
@router.get("/generate-plan", response_model=LecturePlanKickoffResponse)
async def generate_plan(
    userPrompt: str = Query(...),
    lectureDuration: str = Query(...),
    taskName: str = Query(...),
    instituteId: str = Query(...),
    language: Optional[str] = Query(None),
    methodOfTeaching: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    preferredModel: Optional[str] = Query(None),
    # Accepted for FE parity; media_service ignores these too.
    isQuestionGenerated: Optional[bool] = Query(None),
    isAssignmentHomeworkGenerated: Optional[bool] = Query(None),
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
):
    """Start async lecture-plan generation; returns a taskId to poll."""
    primary_model, fallback_models = lecture_planner_service.resolve_model(db, preferredModel)

    # input_id mirrors media_service's "PROMPT_ID" reference. We store a hash of
    # the prompt (not the prompt itself) — the prompt can exceed the column's
    # 255 chars, which would error the insert.
    prompt_ref = hashlib.sha256(userPrompt.encode("utf-8")).hexdigest()

    task = AiTaskService(AiTaskRepository(db)).create(
        task_type=AiTaskType.LECTURE_PLANNER,
        input_id=prompt_ref,
        input_type=AiTaskInputType.PROMPT_ID,
        task_name=taskName,
        institute_id=instituteId,
        dynamic_values={
            "model": primary_model,
            # Full params for retry (userPrompt kept here, not in input_id which
            # is a length-capped hash). Consumed by retry_dispatch.make_work.
            "params": {
                "userPrompt": userPrompt,
                "lectureDuration": lectureDuration,
                "language": language,
                "methodOfTeaching": methodOfTeaching,
                "level": level,
            },
        },
    )

    prompt = lecture_planner_service.build_prompt(
        user_prompt=userPrompt,
        lecture_duration=lectureDuration,
        language=language,
        method_of_teaching=methodOfTeaching,
        level=level,
    )

    user_id = getattr(user, "user_id", None)

    async def _work() -> str:
        result = await lecture_planner_service.generate(
            prompt=prompt,
            primary_model=primary_model,
            fallback_models=fallback_models,
        )
        # Charge institute credits via the parametric tool path so the charge
        # matches the previewed price (best-effort, off-loop).
        await asyncio.to_thread(
            lecture_planner_service.record_lecture_billing,
            institute_id=instituteId,
            user_id=user_id,
            task_id=task.id,
            result=result,
            generate_questions=bool(isQuestionGenerated),
            generate_homework=bool(isAssignmentHomeworkGenerated),
        )
        return result.content_json

    ai_task_service.schedule(task.id, _work)

    logger.info("Started lecture planner: taskId=%s, model=%s", task.id, primary_model)
    return LecturePlanKickoffResponse(taskId=task.id, model=primary_model)


# NOTE: async def required (schedules background work via asyncio.create_task).
@router.get("/generate-feedback", response_model=LectureFeedbackKickoffResponse)
async def generate_feedback(
    fileId: str = Query(..., description="media fileId of the uploaded audio/video"),
    instituteId: str = Query(...),
    taskName: str = Query(...),
    language: Optional[str] = Query(None),
    preferredModel: Optional[str] = Query(None),
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
):
    """Start async lecture-feedback generation from an uploaded audio file.

    Single-step (migrated): resolves the fileId → URL, transcribes in-house, then
    runs the feedback prompt. Replaces the old AssemblyAI two-step flow.
    """
    primary_model, fallback_models = lecture_planner_service.resolve_model(db, preferredModel)

    task = AiTaskService(AiTaskRepository(db)).create(
        task_type=AiTaskType.LECTURE_FEEDBACK,
        input_id=fileId,
        input_type=AiTaskInputType.AUDIO_ID,
        task_name=taskName,
        institute_id=instituteId,
        dynamic_values={
            "model": primary_model,
            "params": {"fileId": fileId, "language": language},
        },
    )

    user_id = getattr(user, "user_id", None)

    async def _work() -> str:
        return await lecture_feedback_service.generate_feedback_result(
            file_id=fileId,
            primary_model=primary_model,
            fallback_models=fallback_models,
            institute_id=instituteId,
            user_id=user_id,
            language=language,
        )

    ai_task_service.schedule(task.id, _work)

    logger.info("Started lecture feedback: taskId=%s, fileId=%s, model=%s", task.id, fileId, primary_model)
    return LectureFeedbackKickoffResponse(taskId=task.id, fileId=fileId, model=primary_model)
