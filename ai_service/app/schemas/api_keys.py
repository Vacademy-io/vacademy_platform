"""
Schemas for API key management endpoints.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class ApiKeyCreateRequest(BaseModel):
    """Request to create or update API keys."""
    openai_key: Optional[str] = Field(
        default=None,
        description="OpenAI/OpenRouter API key"
    )
    gemini_key: Optional[str] = Field(
        default=None,
        description="Google Gemini API key"
    )
    default_model: Optional[str] = Field(
        default=None,
        description="Default model preference"
    )
    notes: Optional[str] = Field(
        default=None,
        description="Optional notes about the key configuration"
    )


class ApiKeyResponse(BaseModel):
    """Response for API key information (keys are not returned for security)."""
    id: str
    institute_id: Optional[str] = None
    user_id: Optional[str] = None
    has_openai_key: bool
    has_gemini_key: bool
    default_model: Optional[str] = None
    is_active: bool
    notes: Optional[str] = None
    created_at: str
    updated_at: str


class ApiKeyUpdateRequest(BaseModel):
    """Request to update existing API keys."""
    openai_key: Optional[str] = Field(
        default=None,
        description="OpenAI/OpenRouter API key (set to empty string to remove)"
    )
    gemini_key: Optional[str] = Field(
        default=None,
        description="Google Gemini API key (set to empty string to remove)"
    )
    default_model: Optional[str] = Field(
        default=None,
        description="Default model preference"
    )
    notes: Optional[str] = Field(
        default=None,
        description="Optional notes"
    )
    is_active: Optional[bool] = Field(
        default=None,
        description="Whether the key is active"
    )


__all__ = [
    "ApiKeyCreateRequest",
    "ApiKeyResponse",
    "ApiKeyUpdateRequest",
]




