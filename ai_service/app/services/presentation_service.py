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

from ..config import get_settings
from ..models.ai_token_usage import RequestType
from . import ai_billing, llm_json
from .ai_prompts import presentation as prompts
from .model_selection import resolve_models
from .render_service import RenderService

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


# ---------------------------------------------------------------------------
# PPTX -> animated-HTML conversion. Thin proxy to the render worker's
# /pptx-anim-jobs: no DB row here — the worker tracks job state (with its own
# TTL sweeper) and the admin client polls through get_pptx_anim_status. Heavy
# work (LibreOffice render) runs on the worker, off this process entirely.
# ---------------------------------------------------------------------------

def _render_service() -> RenderService:
    settings = get_settings()
    if not settings.render_server_url:
        raise RuntimeError("render server not configured (RENDER_SERVER_URL unset)")
    return RenderService(settings.render_server_url, settings.render_server_key)


async def submit_pptx_anim(
    *, pptx_url: str, dpi: int = 110, deck_id: Optional[str] = None
) -> str:
    """Submit a .pptx (public URL) to the render worker. Returns the job_id."""
    rs = _render_service()
    return await asyncio.to_thread(rs.submit_pptx_anim, pptx_url, dpi, deck_id)


async def get_pptx_anim_status(job_id: str) -> dict:
    """Poll the render worker for a pptx-anim job. Returns the worker's status
    dict: {job_id, status, progress, result:{deck_base, slide_count, ...}, error}."""
    rs = _render_service()
    return await asyncio.to_thread(rs.check_pptx_anim_status, job_id)
