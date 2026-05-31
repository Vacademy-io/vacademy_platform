"""Question-metadata router — migrated from media_service QuestionMetadataController.

POST /ai-service/ai/question-metadata/extract. Request body is snake_case
(id_and_topics, preview_id_and_question_text); response is a structured object
with the literal keys questions[].{question_id,topic_ids,tags,difficulty,problem_type}.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..core.security import get_optional_user
from ..db import db_dependency
from ..schemas.question_metadata import (
    QuestionMetadataExtractRequest,
    QuestionMetadataExtractResponse,
)
from ..services import question_metadata_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/question-metadata", tags=["AI Question Metadata"])


@router.post("/extract", response_model=QuestionMetadataExtractResponse)
async def extract(
    req: QuestionMetadataExtractRequest,
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
) -> QuestionMetadataExtractResponse:
    try:
        return await question_metadata_service.extract(
            db,
            id_and_topics=req.id_and_topics,
            preview_id_and_question_text=req.preview_id_and_question_text,
            institute_id=req.institute_id,
            user_id=getattr(user, "user_id", None),
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Question metadata extraction failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
