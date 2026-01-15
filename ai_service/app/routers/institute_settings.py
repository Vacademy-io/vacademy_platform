"""
Router for institute settings management.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..dependencies import db_dependency
from ..schemas.institute_settings import (
    InstituteAISettingsRequest,
    InstituteAISettingsResponse,
    InstituteAISettingsUpdateRequest,
    AISettings
)
from ..services.institute_settings_service import InstituteSettingsService


router = APIRouter(prefix="/institute", tags=["institute-settings"])


@router.get(
    "/ai-settings/v1/get",
    response_model=InstituteAISettingsResponse,
    summary="Get institute AI settings"
)
async def get_institute_ai_settings(
    institute_id: str,
    db: Session = Depends(db_dependency),
) -> InstituteAISettingsResponse:
    """
    Get AI settings for an institute, including the AI_COURSE_PROMPT.

    Args:
        institute_id: Institute identifier

    Returns:
        Institute AI settings including AI_COURSE_PROMPT
    """
    try:
        service = InstituteSettingsService(db)
        ai_settings = service.get_ai_course_settings(institute_id)

        return InstituteAISettingsResponse(
            institute_id=institute_id,
            ai_settings=AISettings(AI_COURSE_PROMPT=ai_settings.get("AI_COURSE_PROMPT")),
            has_custom_prompt=bool(ai_settings.get("AI_COURSE_PROMPT"))
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get AI settings: {str(e)}")


@router.post(
    "/ai-settings/v1/update",
    response_model=InstituteAISettingsResponse,
    summary="Update institute AI settings"
)
async def update_institute_ai_settings(
    institute_id: str,
    request: InstituteAISettingsUpdateRequest,
    db: Session = Depends(db_dependency),
) -> InstituteAISettingsResponse:
    """
    Update AI settings for an institute, including the AI_COURSE_PROMPT.

    Args:
        institute_id: Institute identifier
        request: AI settings to update

    Returns:
        Updated institute AI settings
    """
    try:
        service = InstituteSettingsService(db)
        updated_settings = service.update_ai_course_settings(
            institute_id=institute_id,
            ai_course_prompt=request.ai_settings.AI_COURSE_PROMPT
        )

        return InstituteAISettingsResponse(
            institute_id=institute_id,
            ai_settings=AISettings(AI_COURSE_PROMPT=updated_settings.get("AI_COURSE_PROMPT")),
            has_custom_prompt=bool(updated_settings.get("AI_COURSE_PROMPT"))
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update AI settings: {str(e)}")


__all__ = ["router"]
