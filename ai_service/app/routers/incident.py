"""Incident/LL router — migrated from media_service LlController.

POST /ai-service/ai/ll/generate-incident-structure. Body: {"data": "<raw text>"}
(media_service read only request.get("data")). Returns the structured incident
object (snake_case, nulls included) — a real JSON object, like Java's typed DTO.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from ..core.security import get_optional_user
from ..db import db_dependency
from ..schemas.incident import IncidentAIStructureResponse
from ..services import incident_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/ll", tags=["AI Incident"])


class IncidentRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    data: Optional[str] = None
    institute_id: Optional[str] = None


@router.post("/generate-incident-structure", response_model=IncidentAIStructureResponse)
async def generate_incident_structure(
    req: IncidentRequest,
    db: Session = Depends(db_dependency),
    user=Depends(get_optional_user),
) -> IncidentAIStructureResponse:
    try:
        return await incident_service.generate_incident_structure(
            db,
            incident_text=req.data or "",
            institute_id=req.institute_id,
            user_id=getattr(user, "user_id", None),
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Incident structure generation failed")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
