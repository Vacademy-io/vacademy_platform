"""Request/response schemas for the Vacademy Assistant (admin) surface."""
from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class AssistantInitRequest(BaseModel):
    """Start a new Assistant session. Identity is taken from the JWT, NOT this body."""
    initial_message: Optional[str] = Field(
        None, description="Optional first message from the user."
    )
    context_meta: Optional[Dict[str, Any]] = Field(
        None,
        description="Optional UI context (e.g. the page the user is on) to help the Assistant.",
    )


class AssistantInitResponse(BaseModel):
    session_id: str
    status: str = "idle"


class AssistantMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, description="The user's message.")


class AssistantMessageResponse(BaseModel):
    message_id: int
    status: str = "processing"


class AssistantCloseResponse(BaseModel):
    session_id: str
    status: str = "CLOSED"
    message_count: int
