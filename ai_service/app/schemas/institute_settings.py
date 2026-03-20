"""
Schemas for institute settings management endpoints.
"""
from __future__ import annotations

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class AISettings(BaseModel):
    """AI settings for institute."""
    AI_COURSE_PROMPT: Optional[str] = Field(
        default=None,
        description="Custom prompt for course outline generation that provides institute-specific context"
    )


# ============== VIDEO BRANDING SCHEMAS ==============

class VideoBrandingIntro(BaseModel):
    """Configuration for video intro branding."""
    enabled: bool = Field(default=True, description="Whether intro is enabled")
    duration_seconds: float = Field(default=3.0, description="Duration of intro in seconds")
    html: str = Field(
        default="<div style='display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);'><h1 style='color:#fff; font-size:72px; font-family:Inter,sans-serif; margin:0;'>Vacademy</h1><p style='color:rgba(255,255,255,0.8); font-size:24px; margin-top:16px;'>Learn Smarter</p></div>",
        description="HTML content for intro screen (full-screen centered)"
    )


class VideoBrandingOutro(BaseModel):
    """Configuration for video outro branding."""
    enabled: bool = Field(default=True, description="Whether outro is enabled")
    duration_seconds: float = Field(default=4.0, description="Duration of outro in seconds")
    html: str = Field(
        default="<div style='display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; background:#111;'><h2 style='color:#fff; font-size:56px; font-family:Inter,sans-serif; margin:0;'>Thank You for Watching</h2><p style='color:#888; font-size:28px; margin-top:24px;'>Powered by Vacademy</p></div>",
        description="HTML content for outro screen (full-screen centered)"
    )


class VideoBrandingWatermark(BaseModel):
    """Configuration for in-video watermark."""
    enabled: bool = Field(default=True, description="Whether watermark is enabled")
    position: str = Field(
        default="top-right",
        description="Position of watermark: top-left, top-right, bottom-left, bottom-right"
    )
    max_width: int = Field(default=200, description="Maximum width in pixels")
    max_height: int = Field(default=80, description="Maximum height in pixels")
    margin: int = Field(default=40, description="Margin from edge in pixels")
    opacity: float = Field(default=0.7, description="Opacity (0.0 to 1.0)")
    html: str = Field(
        default="<div style='font-family:Inter,sans-serif; font-weight:bold; color:rgba(170,170,170,0.7); font-size:18px; text-align:right;'>Vacademy</div>",
        description="HTML content for watermark"
    )


class VideoBrandingConfig(BaseModel):
    """Complete video branding configuration for an institute."""
    intro: VideoBrandingIntro = Field(default_factory=VideoBrandingIntro)
    outro: VideoBrandingOutro = Field(default_factory=VideoBrandingOutro)
    watermark: VideoBrandingWatermark = Field(default_factory=VideoBrandingWatermark)


class VideoBrandingResponse(BaseModel):
    """Response for video branding settings."""
    institute_id: str
    branding: VideoBrandingConfig
    has_custom_branding: bool = Field(
        default=False,
        description="Whether the institute has custom branding configured"
    )


class VideoBrandingUpdateRequest(BaseModel):
    """Request to update video branding settings."""
    branding: VideoBrandingConfig = Field(description="Video branding configuration to set")


# ============== VIDEO STYLE SCHEMAS ==============

class VideoStyleConfig(BaseModel):
    """Brand colors, fonts, and layout theme for AI-generated video slides."""
    background_type: str = Field(
        default="white",
        description="Background theme: 'white' (light) or 'black' (dark)"
    )
    primary_color: str = Field(
        default="#6366f1",
        description="Primary/accent color as a hex code (e.g. #6366f1)"
    )
    heading_font: str = Field(
        default="Inter",
        description="Font family for headings in generated slides"
    )
    body_font: str = Field(
        default="Inter",
        description="Font family for body text in generated slides"
    )
    layout_theme: str = Field(
        default="clean_light",
        description="Layout preset name: clean_light, dark_pro, minimal, academic, vibrant"
    )


class VideoStyleResponse(BaseModel):
    """Response for video style settings."""
    institute_id: str
    style: VideoStyleConfig
    has_custom_style: bool = Field(
        default=False,
        description="Whether the institute has custom style configured"
    )


class VideoStyleUpdateRequest(BaseModel):
    """Request to update video style settings."""
    style: VideoStyleConfig = Field(description="Video style configuration to set")


# ============== VIDEO TEMPLATE SCHEMAS ==============

class VideoTemplateItem(BaseModel):
    """Metadata for a single pre-designed video template (no style_injection)."""
    id: str = Field(description="Unique template identifier stored as layout_theme value")
    name: str = Field(description="Display name e.g. 'Whiteboard'")
    description: str = Field(description="One-line description of the template style")
    tags: List[str] = Field(description="Style/category tags")
    background_type: str = Field(description="'white' or 'black'")
    preview_html: str = Field(description="Complete HTML page for gallery iframe preview")


class VideoTemplatesListResponse(BaseModel):
    """Response for the templates list endpoint."""
    templates: List[VideoTemplateItem]


class InstituteAISettingsRequest(BaseModel):
    """Request to get institute AI settings."""
    institute_id: str = Field(
        description="Institute identifier"
    )


class InstituteAISettingsResponse(BaseModel):
    """Response for institute AI settings."""
    institute_id: str
    ai_settings: AISettings
    has_custom_prompt: bool


class InstituteAISettingsUpdateRequest(BaseModel):
    """Request to update institute AI settings."""
    ai_settings: AISettings = Field(
        description="AI settings to update"
    )


__all__ = [
    "AISettings",
    "InstituteAISettingsRequest",
    "InstituteAISettingsResponse",
    "InstituteAISettingsUpdateRequest",
    "VideoBrandingIntro",
    "VideoBrandingOutro",
    "VideoBrandingWatermark",
    "VideoBrandingConfig",
    "VideoBrandingResponse",
    "VideoBrandingUpdateRequest",
    "VideoStyleConfig",
    "VideoStyleResponse",
    "VideoStyleUpdateRequest",
    "VideoTemplateItem",
    "VideoTemplatesListResponse",
]

