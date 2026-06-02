"""Shared token-usage logging + credit deduction for migrated AI features.

Wraps TokenUsageService.record_usage_and_deduct_credits on a fresh DB session so
it works equally from sync request handlers and background workers. Best-effort:
a billing failure never propagates — the generation has already happened.
"""
from __future__ import annotations

import logging
from typing import Optional

from ..db import db_session
from ..models.ai_token_usage import ApiProvider, RequestType
from .token_usage_service import TokenUsageService

logger = logging.getLogger(__name__)


def provider_for_model(model: str) -> ApiProvider:
    """OpenRouter exposes both; attribute by model family (matches the
    convention in content_generation_service / course_outline_service)."""
    return ApiProvider.GEMINI if "gemini" in (model or "").lower() else ApiProvider.OPENAI


def record_llm_billing(
    *,
    request_type: RequestType,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    institute_id: Optional[str] = None,
    user_id: Optional[str] = None,
    request_id: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> None:
    """Log usage + deduct institute credits. Swallows all errors."""
    try:
        with db_session() as db:
            TokenUsageService(db).record_usage_and_deduct_credits(
                api_provider=provider_for_model(model),
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                request_type=request_type,
                institute_id=institute_id,
                user_id=user_id,
                model=model,
                request_id=request_id,
                metadata=metadata,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM billing failed (request_type=%s, request_id=%s): %s", request_type, request_id, exc)
