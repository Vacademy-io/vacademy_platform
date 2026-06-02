"""Question-generation router — migrated from media_service
PDFQuestionGeneratorController (text + HTML entry points).

  POST /ai-service/ai/get-question-pdf/math-parser/html-to-questions  (sync)
  POST /ai-service/ai/get-question-pdf/from-text                      (async)

PDF/image/audio entry points are added in later workstreams; they reuse the same
question_gen_service + question_format engine and the same /task-status/get-result.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from ..core.security import get_optional_user
from ..db import db_dependency
from ..models.ai_task import AiTaskInputType, AiTaskType
from ..repositories.ai_task_repository import AiTaskRepository
from ..schemas.ai_task import LecturePlanKickoffResponse  # reused generic kickoff shape
from ..schemas.question_paper import AutoQuestionPaperResponse
from ..services import ai_task_service, question_gen_service
from ..services.ai_task_service import AiTaskService
from ..services.model_selection import resolve_models
from ..services.question_format import convert_to_question_paper_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/get-question-pdf", tags=["AI Question Generation"])


class HtmlResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    html: Optional[str] = None
    taskId: Optional[str] = None  # accepted for FE parity; sync endpoint ignores it


class TextQuestionsRequest(BaseModel):
    """Mirror of media_service TextDTO (snake_case + camelCase taskName/taskId)."""
    model_config = ConfigDict(extra="ignore")
    text: Optional[str] = None
    num: Optional[int] = None
    class_level: Optional[str] = None
    topics: Optional[str] = None
    question_language: Optional[str] = None
    question_type: Optional[str] = None
    taskName: Optional[str] = None
    taskId: Optional[str] = None
    generate_image: bool = True
    preferredModel: Optional[str] = None


@router.post("/math-parser/html-to-questions", response_model=AutoQuestionPaperResponse)
async def html_to_questions(
    body: HtmlResponse,
    userPrompt: Optional[str] = Query(None),
    generateImage: bool = Query(True),
    instituteId: Optional[str] = Query(None),
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
) -> AutoQuestionPaperResponse:
    """Sync: HTML → questions → AutoQuestionPaperResponse (matches Java)."""
    try:
        primary, fallbacks = resolve_models(db, question_gen_service.QUESTIONS_USE_CASE, None)
        raw = await question_gen_service.questions_from_html(
            html=body.html or "",
            user_prompt=userPrompt,
            generate_image=generateImage,
            models=[primary, *fallbacks],
            institute_id=instituteId,
            user_id=getattr(user, "user_id", None),
        )
        return convert_to_question_paper_response(raw)
    except Exception as exc:  # noqa: BLE001
        logger.exception("html-to-questions failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post("/from-text", response_model=LecturePlanKickoffResponse)
async def from_text(
    body: TextQuestionsRequest,
    instituteId: str = Query(...),
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
):
    """Async: text → questions. Returns a taskId; poll /task-status/get-result."""
    primary_model, fallback_models = resolve_models(
        db, question_gen_service.QUESTIONS_USE_CASE, body.preferredModel
    )
    task = AiTaskService(AiTaskRepository(db)).create(
        task_type=AiTaskType.TEXT_TO_QUESTIONS,
        input_id=(body.text or "")[:200],
        input_type=AiTaskInputType.PROMPT_ID,
        task_name=body.taskName or "",
        institute_id=instituteId,
        dynamic_values={
            "model": primary_model,
            "params": {
                "text": body.text,
                "num": body.num,
                "class_level": body.class_level,
                "topics": body.topics,
                "question_language": body.question_language,
                "question_type": body.question_type,
                # camelCase to match the other question types' retry params
                # (retry_dispatch still accepts the old snake_case key too).
                "generateImage": body.generate_image,
            },
        },
    )
    user_id = getattr(user, "user_id", None)

    models = [primary_model, *fallback_models]

    async def _work() -> str:
        return await question_gen_service.questions_from_text(
            text=body.text or "",
            number_of_questions=str(body.num) if body.num is not None else None,
            type_of_question=body.question_type,
            class_level=body.class_level,
            topics=body.topics,
            question_language=body.question_language,
            generate_image=body.generate_image,
            models=models,
            institute_id=instituteId,
            user_id=user_id,
        )

    ai_task_service.schedule(task.id, _work)
    logger.info("Started text-to-questions: taskId=%s model=%s", task.id, primary_model)
    return LecturePlanKickoffResponse(
        taskId=task.id, model=primary_model, message="Text question generation started"
    )
