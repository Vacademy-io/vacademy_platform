"""PDF question-generation router — migrated from media_service
PDFQuestionGeneratorController (core PDF entry points).

  POST /ai-service/ai/get-question-pdf/math-parser/start-process-pdf          (multipart → pdfId)
  POST /ai-service/ai/get-question-pdf/math-parser/start-process-pdf-file-id  (fileId → pdfId)
  GET  /ai-service/ai/get-question-pdf/math-parser/pdf-to-html                (pdfId → html)
  GET  /ai-service/ai/get-question-pdf/math-parser/pdf-to-questions           (async → taskId)

MathPix submit/poll lives in pdf_questions_service; the async question step
reuses the shared question engine (question_gen_service + question_format).
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from ..core.security import get_optional_user
from ..db import db_dependency
from ..models.ai_task import AiTaskInputType, AiTaskType
from ..repositories.ai_task_repository import AiTaskRepository
from ..schemas.ai_task import LecturePlanKickoffResponse
from ..services import ai_task_service, pdf_questions_service, question_gen_service
from ..services.ai_task_service import AiTaskService
from ..services.model_selection import resolve_models
from ..services.pdf_questions_service import StillProcessing
from ..services.s3_service import S3Service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/get-question-pdf", tags=["AI Question Generation"])


class AutoDocumentSubmitResponse(BaseModel):
    pdf_id: Optional[str] = None


class PdfFileIdRequest(BaseModel):
    """Mirror of FileIdSubmitRequest (@JsonNaming snake → file_id). Accept the
    camelCase fileId too, defensively."""
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    file_id: Optional[str] = Field(default=None, validation_alias="file_id")
    fileId: Optional[str] = None

    def resolved(self) -> Optional[str]:
        return self.file_id or self.fileId


class PdfHtmlResponse(BaseModel):
    html: Optional[str] = None


@router.post("/math-parser/start-process-pdf", response_model=AutoDocumentSubmitResponse)
async def start_process_pdf(
    file: UploadFile = File(...),
    user=Depends(get_optional_user),
) -> AutoDocumentSubmitResponse:
    """Upload a PDF to S3, submit it to MathPix, return the pdfId."""
    try:
        content = await file.read()
        url = await asyncio.to_thread(
            S3Service().upload_file_content, content, file.filename or "upload.pdf",
            None, file.content_type or "application/pdf",
        )
        if not url:
            raise RuntimeError("File upload failed")
        pdf_id = await pdf_questions_service.start_from_url(url)
        return AutoDocumentSubmitResponse(pdf_id=pdf_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("start-process-pdf failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post("/math-parser/start-process-pdf-file-id", response_model=AutoDocumentSubmitResponse)
async def start_process_pdf_from_file_id(
    body: PdfFileIdRequest,
    user=Depends(get_optional_user),
) -> AutoDocumentSubmitResponse:
    """Resolve a media fileId → URL, submit to MathPix, return the pdfId."""
    file_id = body.resolved()
    if not file_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="fileId is required")
    try:
        pdf_id = await pdf_questions_service.start_from_file_id(file_id)
        return AutoDocumentSubmitResponse(pdf_id=pdf_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("start-process-pdf-file-id failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.get("/math-parser/pdf-to-html", response_model=PdfHtmlResponse)
async def pdf_to_html(pdfId: str = Query(...)) -> PdfHtmlResponse:
    """Return the converted HTML for a pdfId (cached). 425 while still converting."""
    try:
        html = await pdf_questions_service.fetch_or_convert_html(pdfId, allow_poll=False)
        return PdfHtmlResponse(html=html)
    except StillProcessing:
        raise HTTPException(status_code=status.HTTP_425_TOO_EARLY, detail=f"PDF {pdfId} is still processing")
    except Exception as exc:  # noqa: BLE001
        logger.exception("pdf-to-html failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.get("/math-parser/pdf-to-questions", response_model=LecturePlanKickoffResponse)
async def pdf_to_questions(
    pdfId: str = Query(...),
    userPrompt: Optional[str] = Query(None),
    taskName: Optional[str] = Query(None),
    instituteId: Optional[str] = Query(None),
    preferredModel: Optional[str] = Query(None),
    generateImage: bool = Query(True),
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
):
    """Async: poll MathPix for the PDF HTML, then generate questions. Poll
    /task-status/get-result for the AutoQuestionPaperResponse."""
    primary_model, fallback_models = resolve_models(
        db, question_gen_service.QUESTIONS_USE_CASE, preferredModel
    )
    task = AiTaskService(AiTaskRepository(db)).create(
        task_type=AiTaskType.PDF_TO_QUESTIONS,
        input_id=pdfId,
        input_type=AiTaskInputType.PDF_ID,
        task_name=taskName or "",
        institute_id=instituteId,
        dynamic_values={
            "model": primary_model,
            "params": {"pdfId": pdfId, "userPrompt": userPrompt, "generateImage": generateImage},
        },
    )
    user_id = getattr(user, "user_id", None)
    models = [primary_model, *fallback_models]

    async def _work() -> str:
        html = await pdf_questions_service.fetch_or_convert_html(pdfId, allow_poll=True)
        return await question_gen_service.questions_from_html(
            html=html, user_prompt=userPrompt, generate_image=generateImage,
            models=models, institute_id=instituteId, user_id=user_id,
        )

    ai_task_service.schedule(task.id, _work)
    logger.info("Started pdf-to-questions: taskId=%s pdfId=%s model=%s", task.id, pdfId, primary_model)
    return LecturePlanKickoffResponse(
        taskId=task.id, model=primary_model, message="PDF question generation started"
    )


@router.get("/math-parser/image-to-questions", response_model=LecturePlanKickoffResponse)
async def image_to_questions(
    pdfId: str = Query(...),
    userPrompt: Optional[str] = Query(None),
    taskName: Optional[str] = Query(None),
    instituteId: Optional[str] = Query(None),
    preferredModel: Optional[str] = Query(None),
    generateImage: bool = Query(True),
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
):
    """Async image→questions. Identical pipeline to pdf-to-questions (the image
    is MathPix-converted to a pdfId via start-process), only the task type
    differs (IMAGE_TO_QUESTIONS / IMAGE_ID)."""
    primary_model, fallback_models = resolve_models(
        db, question_gen_service.QUESTIONS_USE_CASE, preferredModel
    )
    task = AiTaskService(AiTaskRepository(db)).create(
        task_type=AiTaskType.IMAGE_TO_QUESTIONS,
        input_id=pdfId,
        input_type=AiTaskInputType.IMAGE_ID,
        task_name=taskName or "",
        institute_id=instituteId,
        dynamic_values={
            "model": primary_model,
            "params": {"pdfId": pdfId, "userPrompt": userPrompt, "generateImage": generateImage},
        },
    )
    user_id = getattr(user, "user_id", None)
    models = [primary_model, *fallback_models]

    async def _work() -> str:
        html = await pdf_questions_service.fetch_or_convert_html(pdfId, allow_poll=True)
        return await question_gen_service.questions_from_html(
            html=html, user_prompt=userPrompt, generate_image=generateImage,
            models=models, institute_id=instituteId, user_id=user_id,
        )

    ai_task_service.schedule(task.id, _work)
    logger.info("Started image-to-questions: taskId=%s pdfId=%s model=%s", task.id, pdfId, primary_model)
    return LecturePlanKickoffResponse(
        taskId=task.id, model=primary_model, message="Image question generation started"
    )


@router.get("/math-parser/topic-wise/pdf-to-questions", response_model=LecturePlanKickoffResponse)
async def topic_wise_pdf_to_questions(
    pdfId: str = Query(...),
    userPrompt: Optional[str] = Query(None),
    instituteId: Optional[str] = Query(None),
    taskName: Optional[str] = Query(None),
    generateImage: bool = Query(True),
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
):
    """Async: PDF → questions grouped by topic (SORT_QUESTIONS_TOPIC_WISE)."""
    primary_model, fallback_models = resolve_models(db, question_gen_service.QUESTIONS_USE_CASE, None)
    task = AiTaskService(AiTaskRepository(db)).create(
        task_type=AiTaskType.SORT_QUESTIONS_TOPIC_WISE,
        input_id=pdfId, input_type=AiTaskInputType.PDF_ID,
        task_name=taskName or "", institute_id=instituteId,
        dynamic_values={
            "model": primary_model,
            "params": {"pdfId": pdfId, "generateImage": generateImage},
        },
    )
    user_id = getattr(user, "user_id", None)
    models = [primary_model, *fallback_models]

    async def _work() -> str:
        html = await pdf_questions_service.fetch_or_convert_html(pdfId, allow_poll=True)
        return await question_gen_service.questions_topic_wise(
            html=html, generate_image=generateImage, models=models,
            institute_id=instituteId, user_id=user_id,
        )

    ai_task_service.schedule(task.id, _work)
    return LecturePlanKickoffResponse(taskId=task.id, model=primary_model, message="Topic sorting started")


@router.get("/math-parser/pdf-to-extract-topic-questions", response_model=LecturePlanKickoffResponse)
async def pdf_extract_topic_questions(
    pdfId: str = Query(...),
    requiredTopics: str = Query(...),
    taskName: Optional[str] = Query(None),
    instituteId: Optional[str] = Query(None),
    generateImage: bool = Query(True),
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
):
    """Async: extract only questions matching requiredTopics (PDF_TO_QUESTIONS_WITH_TOPIC)."""
    primary_model, fallback_models = resolve_models(db, question_gen_service.QUESTIONS_USE_CASE, None)
    task = AiTaskService(AiTaskRepository(db)).create(
        task_type=AiTaskType.PDF_TO_QUESTIONS_WITH_TOPIC,
        input_id=pdfId, input_type=AiTaskInputType.PDF_ID,
        task_name=taskName or "", institute_id=instituteId,
        dynamic_values={
            "model": primary_model,
            "params": {"pdfId": pdfId, "requiredTopics": requiredTopics, "generateImage": generateImage},
        },
    )
    user_id = getattr(user, "user_id", None)
    models = [primary_model, *fallback_models]

    async def _work() -> str:
        html = await pdf_questions_service.fetch_or_convert_html(pdfId, allow_poll=True)
        return await question_gen_service.questions_extract_topic(
            html=html, required_topics=requiredTopics, generate_image=generateImage,
            models=models, institute_id=instituteId, user_id=user_id,
        )

    ai_task_service.schedule(task.id, _work)
    return LecturePlanKickoffResponse(taskId=task.id, model=primary_model, message="Topic extraction started")
