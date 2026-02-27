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
    VideoStyleConfig,
    VideoStyleResponse,
    VideoStyleUpdateRequest,
    VideoTemplateItem,
    VideoTemplatesListResponse,
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


# ============== VIDEO STYLE ENDPOINTS ==============


@router.get(
    "/video-style/v1/get",
    response_model=VideoStyleResponse,
    summary="Get institute video style settings"
)
async def get_video_style(
    institute_id: str,
    db: Session = Depends(db_dependency),
) -> VideoStyleResponse:
    """
    Get video style configuration for an institute (brand colors, fonts, layout theme).
    Returns defaults if not configured.

    Args:
        institute_id: Institute identifier

    Returns:
        Video style configuration
    """
    try:
        service = InstituteSettingsService(db)
        result = service.get_video_style(institute_id)
        return VideoStyleResponse(
            institute_id=institute_id,
            style=VideoStyleConfig(**result["style"]),
            has_custom_style=result["has_custom_style"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get video style: {str(e)}")


@router.post(
    "/video-style/v1/update",
    response_model=VideoStyleResponse,
    summary="Update institute video style settings"
)
async def update_video_style(
    institute_id: str,
    request: VideoStyleUpdateRequest,
    db: Session = Depends(db_dependency),
) -> VideoStyleResponse:
    """
    Update video style configuration for an institute.

    Sets brand colors, fonts, and layout theme used during HTML slide generation.

    Args:
        institute_id: Institute identifier
        request: Video style configuration to set

    Returns:
        Updated video style configuration
    """
    try:
        service = InstituteSettingsService(db)
        result = service.update_video_style(
            institute_id=institute_id,
            style=request.style.model_dump()
        )
        return VideoStyleResponse(
            institute_id=institute_id,
            style=VideoStyleConfig(**result["style"]),
            has_custom_style=result["has_custom_style"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update video style: {str(e)}")


# ============== VIDEO TEMPLATE ENDPOINTS ==============


@router.get(
    "/video-templates/v1/list",
    response_model=VideoTemplatesListResponse,
    summary="List all available video templates"
)
async def list_video_templates() -> VideoTemplatesListResponse:
    """
    Returns all pre-designed video templates available for AI video generation.
    No institute_id required — templates are system-level constants.

    Each template includes a preview_html for gallery display and is identified
    by an id that maps to layout_theme in the video style settings.
    """
    try:
        import sys
        import os
        pipeline_dir = os.path.join(os.path.dirname(__file__), "../ai-video-gen-main")
        if pipeline_dir not in sys.path:
            sys.path.insert(0, pipeline_dir)
        from video_templates import list_templates
        return VideoTemplatesListResponse(
            templates=[VideoTemplateItem(**t) for t in list_templates()]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list templates: {str(e)}")


__all__ = ["router"]
