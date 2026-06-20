"""Presentation AI router — migrated from media_service PresentationAIController.

Mirrors POST /media-service/ai/presentation/{generateFromData,regenerateASlide}.
Returns the raw sanitized JSON body (like Java's ResponseEntity<String>) so the
admin slide editor's axios client parses it straight into an object.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from ..core.security import get_optional_user
from ..db import db_dependency
from ..services import presentation_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/presentation", tags=["AI Presentation"])


class PresentationAiGenerateRequest(BaseModel):
    """Mirror of media_service PresentationAiGenerateRequest. Extra fields the FE
    sends (e.g. institute_id) are accepted and used for billing."""
    model_config = ConfigDict(extra="ignore", protected_namespaces=())

    language: Optional[str] = None
    text: Optional[str] = None
    initialData: Optional[str] = None
    model: Optional[str] = None
    institute_id: Optional[str] = None


@router.post("/generateFromData")
async def generate_from_data(
    req: PresentationAiGenerateRequest,
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
) -> Response:
    if not req.text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="text is required")
    try:
        valid_json = await presentation_service.generate_from_data(
            db,
            language=req.language,
            text=req.text,
            preferred_model=req.model,
            institute_id=req.institute_id,
            user_id=getattr(user, "user_id", None),
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Presentation generate failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    return Response(content=valid_json, media_type="application/json")


@router.post("/regenerateASlide")
async def regenerate_slide(
    req: PresentationAiGenerateRequest,
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
) -> Response:
    if not req.initialData or not req.text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="initialData and text are required",
        )
    try:
        valid_json = await presentation_service.regenerate_slide(
            db,
            initial_data=req.initialData,
            text=req.text,
            preferred_model=req.model,
            institute_id=req.institute_id,
            user_id=getattr(user, "user_id", None),
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Presentation regenerate failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    return Response(content=valid_json, media_type="application/json")


class AnimatePptxRequest(BaseModel):
    """Convert an uploaded .pptx (public S3 URL) into build-step snapshots."""
    model_config = ConfigDict(extra="ignore", protected_namespaces=())

    pptx_url: str
    dpi: Optional[int] = 110
    deck_id: Optional[str] = None


@router.post("/animate-pptx")
async def animate_pptx(req: AnimatePptxRequest) -> dict:
    """Kick off PPTX -> animated-HTML conversion on the render worker. Returns
    {job_id}; poll GET /animate-pptx/{job_id} until status == "completed", then
    read result.deck_base + result.slide_count for the slide."""
    if not req.pptx_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="pptx_url is required")
    try:
        job_id = await presentation_service.submit_pptx_anim(
            pptx_url=req.pptx_url, dpi=req.dpi or 110, deck_id=req.deck_id,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("animate-pptx submit failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    return {"job_id": job_id, "status": "queued"}


@router.get("/animate-pptx/{job_id}")
async def animate_pptx_status(job_id: str) -> dict:
    """Poll a pptx-anim job's status (proxied from the render worker)."""
    return await presentation_service.get_pptx_anim_status(job_id)
