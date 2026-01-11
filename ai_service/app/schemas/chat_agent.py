"""
Pydantic schemas for chat agent API endpoints.
"""
from __future__ import annotations

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class ContextType(str, Enum):
    """Enumeration of supported context types."""
    SLIDE = "slide"
    COURSE_DETAILS = "course_details"
    GENERAL = "general"


class MessageType(str, Enum):
    """Enumeration of message types."""
    USER = "user"
    ASSISTANT = "assistant"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"


class SessionStatus(str, Enum):
    """Enumeration of session statuses."""
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"


class AIStatus(str, Enum):
    """Enumeration of AI processing statuses."""
    IDLE = "idle"
    THINKING = "thinking"
    TOOL_EXECUTING = "tool_executing"


# Request Schemas

class InitSessionRequest(BaseModel):
    """Request to initialize a new chat session."""
    user_id: str = Field(..., description="User ID from client")
    institute_id: str = Field(..., description="Institute ID from client")
    user_name: Optional[str] = Field(None, description="User's name for personalized greeting")
    context_type: Optional[ContextType] = Field(None, description="Type of context for the chat session (can be set later via context API)")
    context_meta: Optional[Dict[str, Any]] = Field(
        None, 
        description="Complete metadata with all data from frontend (can be set later via context API)"
    )
    initial_message: Optional[str] = Field(None, description="Optional initial message from the user")
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_id": "user-123",
                "institute_id": "inst-456",
                "user_name": "John Doe",
                "context_type": None,
                "context_meta": None,
                "initial_message": None
            }
        }
        
    class Config:
        json_schema_extra = {
            "example_with_context": {
                "user_id": "user-123",
                "institute_id": "inst-456",
                "user_name": "John Doe",
                "context_type": "slide",
                "context_meta": {
                    "name": "Introduction to Photosynthesis",
                    "content": "<p>Photosynthesis is...</p>",
                    "level": "2",
                    "order": 5,
                    "chapter": "Plant Biology",
                    "module": "Biology 101",
                    "subject": "Biology",
                    "course": "Science",
                    "progress": "45%"
                },
                "initial_message": "I don't understand how chlorophyll works"
            }
        }


class SendMessageRequest(BaseModel):
    """Request to send a message in an existing session."""
    message: str = Field(..., description="The message content from the user", min_length=1)
    
    class Config:
        json_schema_extra = {
            "example": {
                "message": "Can you explain this in simple terms?"
            }
        }


class UpdateContextRequest(BaseModel):
    """Request to update context for an existing session without triggering AI response."""
    context_type: ContextType = Field(..., description="Type of context for the chat session")
    context_meta: Dict[str, Any] = Field(
        ..., 
        description="Complete metadata with all data from frontend"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "context_type": "slide",
                "context_meta": {
                    "name": "Cell Division",
                    "content": "<p>Cell division is...</p>",
                    "level": "3",
                    "order": 6,
                    "chapter": "Cell Biology",
                    "module": "Biology 101",
                    "subject": "Biology",
                    "course": "Science",
                    "progress": "50%"
                }
            }
        }


# Response Schemas

class InitSessionResponse(BaseModel):
    """Response after initializing a chat session."""
    session_id: str = Field(..., description="Unique identifier for the chat session")
    status: AIStatus = Field(..., description="Current AI processing status")
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "session-uuid-123",
                "status": "thinking"
            }
        }


class SendMessageResponse(BaseModel):
    """Response after sending a message."""
    message_id: int = Field(..., description="ID of the created message")
    status: AIStatus = Field(..., description="Current AI processing status")
    
    class Config:
        json_schema_extra = {
            "example": {
                "message_id": 42,
                "status": "thinking"
            }
        }


class UpdateContextResponse(BaseModel):
    """Response after updating session context."""
    session_id: str = Field(..., description="Session identifier")
    context_type: str = Field(..., description="Updated context type")
    success: bool = Field(..., description="Whether the context was updated successfully")
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "session-uuid-123",
                "context_type": "slide",
                "success": True
            }
        }


class ChatMessageSchema(BaseModel):
    """Schema for a single chat message."""
    id: int = Field(..., description="Message ID")
    type: MessageType = Field(..., description="Type of message")
    content: str = Field(..., description="Message content")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Optional metadata")
    created_at: datetime = Field(..., description="Message creation timestamp")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": 121,
                "type": "user",
                "content": "Can you explain this?",
                "metadata": None,
                "created_at": "2026-01-08T10:00:00Z"
            }
        }


class GetUpdatesResponse(BaseModel):
    """Response for polling updates."""
    messages: List[ChatMessageSchema] = Field(default_factory=list, description="New messages since last poll")
    ai_status: AIStatus = Field(..., description="Current AI processing status")
    session_status: SessionStatus = Field(..., description="Session status (ACTIVE or CLOSED)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "messages": [
                    {
                        "id": 121,
                        "type": "user",
                        "content": "Can you explain this?",
                        "metadata": None,
                        "created_at": "2026-01-08T10:00:00Z"
                    },
                    {
                        "id": 122,
                        "type": "assistant",
                        "content": "Sure! Here's an explanation...",
                        "metadata": None,
                        "created_at": "2026-01-08T10:00:03Z"
                    }
                ],
                "ai_status": "idle",
                "session_status": "ACTIVE"
            }
        }


class CloseSessionResponse(BaseModel):
    """Response after closing a session."""
    session_id: str = Field(..., description="ID of the closed session")
    status: SessionStatus = Field(..., description="Final session status")
    message_count: int = Field(..., description="Total number of messages in the session")
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "session-uuid-123",
                "status": "CLOSED",
                "message_count": 15
            }
        }


__all__ = [
    "ContextType",
    "MessageType",
    "SessionStatus",
    "AIStatus",
    "InitSessionRequest",
    "SendMessageRequest",
    "InitSessionResponse",
    "SendMessageResponse",
    "ChatMessageSchema",
    "GetUpdatesResponse",
    "CloseSessionResponse",
]
