"""
Schemas for institute settings management endpoints.
"""
from __future__ import annotations

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class AISettings(BaseModel):
    """AI settings for institute."""
    AI_COURSE_PROMPT: Optional[str] = Field(
        default=None,
        description="Custom prompt for course outline generation that provides institute-specific context"
    )


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
]
