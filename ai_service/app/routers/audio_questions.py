"""Audio question-generation router — migrated from media_service
AudioQuestionGeneratorController.

  GET /ai-service/ai/get-question-audio/audio-parser/audio-to-questions  (async)

Single-step (migrated): pass the uploaded audio fileId; ai_service resolves it,
transcribes in-house, and generates questions. Replaces the old
start-process-audio (AssemblyAI) → audio-to-questions(audioId) two-step flow.
Poll /task-status/get-result for the AutoQuestionPaperResponse.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..core.security import get_optional_user
from ..db import db_dependency
from ..models.ai_task import AiTaskInputType, AiTaskType
from ..repositories.ai_task_repository import AiTaskRepository
from ..schemas.ai_task import LecturePlanKickoffResponse
from ..services import ai_task_service, audio_questions_service, question_gen_service
from ..services.ai_task_service import AiTaskService
from ..services.model_selection import resolve_models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/get-question-audio", tags=["AI Question Generation"])

_DEFAULT_DIFFICULTY = "hard and medium"
_DEFAULT_NUM_QUESTIONS = "20"
_DEFAULT_LANGUAGE = "english"


@router.get("/audio-parser/audio-to-questions", response_model=LecturePlanKickoffResponse)
async def audio_to_questions(
    fileId: str = Query(..., description="media fileId of the uploaded audio"),
    numQuestions: Optional[str] = Query(None),
    prompt: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    taskName: Optional[str] = Query(None),
    instituteId: Optional[str] = Query(None),
    preferredModel: Optional[str] = Query(None),
    generateImage: bool = Query(True),
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
):
    primary_model, fallback_models = resolve_models(
        db, question_gen_service.QUESTIONS_USE_CASE, preferredModel
    )
    task = AiTaskService(AiTaskRepository(db)).create(
        task_type=AiTaskType.AUDIO_TO_QUESTIONS,
        input_id=fileId,
        input_type=AiTaskInputType.AUDIO_ID,
        task_name=taskName or "",
        institute_id=instituteId,
        dynamic_values={
            "model": primary_model,
            "params": {
                "fileId": fileId,
                "numQuestions": numQuestions or _DEFAULT_NUM_QUESTIONS,
                "difficulty": difficulty or _DEFAULT_DIFFICULTY,
                "language": language or _DEFAULT_LANGUAGE,
                "prompt": prompt or "",
                "generateImage": generateImage,
            },
        },
    )
    user_id = getattr(user, "user_id", None)
    models = [primary_model, *fallback_models]
    num = numQuestions or _DEFAULT_NUM_QUESTIONS
    diff = difficulty or _DEFAULT_DIFFICULTY
    lang = language or _DEFAULT_LANGUAGE
    opt = prompt or ""

    async def _work() -> str:
        return await audio_questions_service.transcribe_and_generate(
            file_id=fileId, num_questions=num, difficulty=diff, language=lang,
            optional_prompt=opt, generate_image=generateImage, models=models,
            institute_id=instituteId, user_id=user_id,
        )

    ai_task_service.schedule(task.id, _work)
    logger.info("Started audio-to-questions: taskId=%s fileId=%s model=%s", task.id, fileId, primary_model)
    return LecturePlanKickoffResponse(
        taskId=task.id, model=primary_model, message="Audio question generation started"
    )
