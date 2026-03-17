from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ContentGenerationRequest(BaseModel):
    """
    Request schema for generating content from an existing coursetree.
    Frontend will call this endpoint with the coursetree from the outline API.
    
    You can send either:
    1. Full outline response: {"explanation": "...", "tree": [...], "todos": [...], "courseMetadata": {...}}
    2. Just todos: {"todos": [...]}
    3. Direct todos array: [...]
    
    The endpoint will extract and use only the todos array.
    """
    course_tree: dict = Field(
        ...,
        description="Course tree JSON from outline API response. Can be full response or just {'todos': [...]}. Only 'todos' array is used."
    )
    institute_id: Optional[str] = Field(
        default=None,
        description="Institute identifier (optional, for logging/context)"
    )
    user_id: Optional[str] = Field(
        default=None,
        description="User identifier (optional, for logging/context)"
    )
    language: Optional[str] = Field(
        default="English",
        description="Language for content generation (e.g. 'English', 'Hindi', 'Spanish', 'French', 'Arabic')"
    )


__all__ = ["ContentGenerationRequest"]



