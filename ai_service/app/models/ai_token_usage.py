"""
SQLAlchemy model for tracking AI API token usage.
This model connects to the admin-core-service database.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Index,
    text,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
import enum

from .ai_gen_video import Base


class ApiProvider(str, enum.Enum):
    """Enum for API provider types."""
    OPENAI = "openai"
    GEMINI = "gemini"


class RequestType(str, enum.Enum):
    """Enum for request types."""
    OUTLINE = "outline"
    IMAGE = "image"
    CONTENT = "content"
    VIDEO = "video"


class AiTokenUsage(Base):
    """
    Tracks token usage for AI API calls (OpenAI/OpenRouter and Gemini).
    
    Records token consumption per request to enable:
    - Usage tracking and billing
    - Cost analysis
    - Rate limiting
    - Usage reporting
    """
    __tablename__ = "ai_token_usage"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, server_default=text("gen_random_uuid()"))
    
    # Entity identification (optional, for tracking usage per institute/user)
    institute_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # API provider and model information
    api_provider = Column(SQLEnum(ApiProvider), nullable=False, index=True)
    model = Column(String(255), nullable=True, index=True)
    
    # Token usage metrics
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0, index=True)
    
    # Request context
    request_type = Column(SQLEnum(RequestType), nullable=False, index=True)
    request_id = Column(String(255), nullable=True, index=True, comment="Optional request identifier for correlation")
    
    # Additional metadata (Python attribute is 'request_metadata' to avoid SQLAlchemy reserved name conflict,
    # but maps to database column 'metadata' for backward compatibility)
    request_metadata = Column("metadata", String(500), nullable=True, comment="Optional JSON string for additional context")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    
    def __repr__(self) -> str:
        entity = f"institute_id={self.institute_id}" if self.institute_id else f"user_id={self.user_id}"
        return f"<AiTokenUsage({entity}, provider={self.api_provider}, tokens={self.total_tokens})>"
    
    def to_dict(self) -> dict:
        """Convert model to dictionary for API responses."""
        return {
            "id": str(self.id),
            "institute_id": str(self.institute_id) if self.institute_id else None,
            "user_id": str(self.user_id) if self.user_id else None,
            "api_provider": self.api_provider.value if self.api_provider else None,
            "model": self.model,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
            "request_type": self.request_type.value if self.request_type else None,
            "request_id": self.request_id,
            "request_metadata": self.request_metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# Create indexes for efficient queries
Index("idx_ai_token_usage_institute_created", AiTokenUsage.institute_id, AiTokenUsage.created_at)
Index("idx_ai_token_usage_user_created", AiTokenUsage.user_id, AiTokenUsage.created_at)
Index("idx_ai_token_usage_provider_created", AiTokenUsage.api_provider, AiTokenUsage.created_at)
Index("idx_ai_token_usage_type_created", AiTokenUsage.request_type, AiTokenUsage.created_at)





