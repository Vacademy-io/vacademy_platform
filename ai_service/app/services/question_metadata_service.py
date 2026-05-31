"""Question-metadata extraction — migrated from media_service
ExternalAIApiService.getQuestionsMetadata + QuestionMetadataManager.

Builds the two newline-joined prompt blocks exactly as Java does (question text
HTML-stripped; topics raw), calls the LLM, re-projects the output into the fixed
response shape, bills usage/credits.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Dict, Optional

from sqlalchemy.orm import Session

from ..models.ai_token_usage import RequestType
from ..schemas.question_metadata import QuestionMetadataExtractResponse
from ..utils.html_text import remove_media_tags
from . import ai_billing, llm_json
from .ai_prompts import question_metadata as prompts
from .model_selection import resolve_models

logger = logging.getLogger(__name__)

QUESTION_METADATA_USE_CASE = "question_metadata"


def _build_id_and_questions(preview_id_and_question_text: Dict[str, str]) -> str:
    # Mirror ExternalAIApiService: "question_id:<key> text : <html-stripped value>"
    return "\n".join(
        f"question_id:{k} text : {remove_media_tags(v)}"
        for k, v in preview_id_and_question_text.items()
    )


def _build_id_and_topics(id_and_topics: Dict[str, str]) -> str:
    # Mirror ExternalAIApiService: "topic_id:<key> name : <value>" (topics not stripped)
    return "\n".join(f"topic_id:{k} name : {v}" for k, v in id_and_topics.items())


async def extract(
    db: Session,
    *,
    id_and_topics: Dict[str, str],
    preview_id_and_question_text: Dict[str, str],
    institute_id: Optional[str],
    user_id: Optional[str],
) -> QuestionMetadataExtractResponse:
    prompt = prompts.build_prompt(
        _build_id_and_questions(preview_id_and_question_text),
        _build_id_and_topics(id_and_topics),
    )
    primary, fallbacks = resolve_models(db, QUESTION_METADATA_USE_CASE, None)
    sanitized, model_used, usage = await llm_json.generate_json(
        prompt, [primary, *fallbacks], label="question_metadata"
    )
    await asyncio.to_thread(
        ai_billing.record_llm_billing,
        request_type=RequestType.QUESTION_METADATA,
        model=model_used,
        prompt_tokens=usage.get("prompt_tokens", 0),
        completion_tokens=usage.get("completion_tokens", 0),
        total_tokens=usage.get("total_tokens", 0),
        institute_id=institute_id,
        user_id=user_id,
        metadata={"feature": "question_metadata"},
    )
    return QuestionMetadataExtractResponse.model_validate(json.loads(sanitized))
