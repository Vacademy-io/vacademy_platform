"""Presentation AI — migrated from media_service PresentationAIController.

Both operations are synchronous (LLM call → sanitized JSON returned directly).
Model is resolved from the registry (use case 'presentation'); usage/credits are
billed best-effort after a successful generation.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from sqlalchemy.orm import Session

from ..models.ai_token_usage import RequestType
from . import ai_billing, llm_json
from .ai_prompts import presentation as prompts
from .model_selection import resolve_models

logger = logging.getLogger(__name__)

PRESENTATION_USE_CASE = "presentation"


async def _generate(
    db: Session,
    *,
    prompt: str,
    preferred_model: Optional[str],
    institute_id: Optional[str],
    user_id: Optional[str],
    label: str,
) -> str:
    primary, fallbacks = resolve_models(db, PRESENTATION_USE_CASE, preferred_model)
    sanitized, model_used, usage = await llm_json.generate_json(
        prompt, [primary, *fallbacks], label=label
    )
    await asyncio.to_thread(
        ai_billing.record_llm_billing,
        request_type=RequestType.PRESENTATION,
        model=model_used,
        prompt_tokens=usage.get("prompt_tokens", 0),
        completion_tokens=usage.get("completion_tokens", 0),
        total_tokens=usage.get("total_tokens", 0),
        institute_id=institute_id,
        user_id=user_id,
        metadata={"feature": label},
    )
    return sanitized


async def generate_from_data(
    db: Session,
    *,
    language: Optional[str],
    text: str,
    preferred_model: Optional[str],
    institute_id: Optional[str],
    user_id: Optional[str],
) -> str:
    prompt = prompts.build_generate_prompt(text, language or "ENGLISH")
    return await _generate(
        db, prompt=prompt, preferred_model=preferred_model,
        institute_id=institute_id, user_id=user_id, label="presentation_generate",
    )


async def regenerate_slide(
    db: Session,
    *,
    initial_data: str,
    text: str,
    preferred_model: Optional[str],
    institute_id: Optional[str],
    user_id: Optional[str],
) -> str:
    prompt = prompts.build_regenerate_prompt(initial_data, text)
    return await _generate(
        db, prompt=prompt, preferred_model=preferred_model,
        institute_id=institute_id, user_id=user_id, label="presentation_regenerate",
    )
