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


# ============== VIDEO BRANDING ENDPOINTS ==============

from ..schemas.institute_settings import (
    VideoBrandingConfig,
    VideoBrandingResponse,
    VideoBrandingUpdateRequest,
)


@router.get(
    "/video-branding/v1/get",
    response_model=VideoBrandingResponse,
    summary="Get institute video branding settings"
)
async def get_video_branding(
    institute_id: str,
    db: Session = Depends(db_dependency),
) -> VideoBrandingResponse:
    """
    Get video branding configuration for an institute.
    Returns default Vacademy branding if not configured.
    
    Branding includes:
    - **intro**: Pre-video branding screen (shown before audio starts)
    - **outro**: Post-video branding screen (shown after audio ends)
    - **watermark**: Corner watermark shown throughout the video

    Args:
        institute_id: Institute identifier

    Returns:
        Video branding configuration
    """
    try:
        service = InstituteSettingsService(db)
        result = service.get_video_branding(institute_id)
        
        return VideoBrandingResponse(
            institute_id=institute_id,
            branding=VideoBrandingConfig(**result["branding"]),
            has_custom_branding=result["has_custom_branding"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get video branding: {str(e)}")


@router.post(
    "/video-branding/v1/update",
    response_model=VideoBrandingResponse,
    summary="Update institute video branding settings"
)
async def update_video_branding(
    institute_id: str,
    request: VideoBrandingUpdateRequest,
    db: Session = Depends(db_dependency),
) -> VideoBrandingResponse:
    """
    Update video branding configuration for an institute.
    
    Set custom intro, outro, and watermark HTML for branded video generation.
    
    **Note**: Audio will be silent during intro and outro screens.

    Args:
        institute_id: Institute identifier
        request: Video branding configuration to set

    Returns:
        Updated video branding configuration
    """
    try:
        service = InstituteSettingsService(db)
        result = service.update_video_branding(
            institute_id=institute_id,
            branding=request.branding.model_dump()
        )
        
        return VideoBrandingResponse(
            institute_id=institute_id,
            branding=VideoBrandingConfig(**result["branding"]),
            has_custom_branding=result["has_custom_branding"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update video branding: {str(e)}")


__all__ = ["router"]
