"""
SQLAlchemy model for storing institute-level and user-level API keys.
This model connects to the admin-core-service database.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    Index,
    text,
    Boolean,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base

from .ai_gen_video import Base


class AiApiKeys(Base):
    """
    Stores API keys for AI services at institute or user level.
    
    Priority order for key resolution:
    1. Request-level keys (passed directly in API call)
    2. User-level keys (if user_id is provided)
    3. Institute-level keys (if institute_id is provided)
    4. System default keys (from environment variables)
    
    Key types:
    - openai_key: OpenAI/OpenRouter API key
    - gemini_key: Google Gemini API key
    - model: Default model preference (optional)
    """
    __tablename__ = "ai_api_keys"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, server_default=text("gen_random_uuid()"))
    
    # Entity identification - either institute_id OR user_id should be set, not both
    institute_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # API Keys (encrypted or plain text - encryption should be handled at application level)
    openai_key = Column(Text, nullable=True, comment="OpenAI/OpenRouter API key")
    gemini_key = Column(Text, nullable=True, comment="Google Gemini API key")
    
    # Default model preference (optional)
    default_model = Column(String(255), nullable=True, comment="Default LLM model preference")
    
    # Metadata
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    notes = Column(Text, nullable=True, comment="Optional notes about the key configuration")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), nullable=True, comment="User who created this key entry")
    
    def __repr__(self) -> str:
        entity = f"institute_id={self.institute_id}" if self.institute_id else f"user_id={self.user_id}"
        return f"<AiApiKeys({entity}, active={self.is_active})>"
    
    def to_dict(self) -> dict:
        """Convert model to dictionary for API responses (excluding sensitive keys)."""
        return {
            "id": str(self.id),
            "institute_id": str(self.institute_id) if self.institute_id else None,
            "user_id": str(self.user_id) if self.user_id else None,
            "has_openai_key": bool(self.openai_key),
            "has_gemini_key": bool(self.gemini_key),
            "default_model": self.default_model,
            "is_active": self.is_active,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# Create indexes for efficient lookups
Index("idx_ai_api_keys_institute_id", AiApiKeys.institute_id, AiApiKeys.is_active)
Index("idx_ai_api_keys_user_id", AiApiKeys.user_id, AiApiKeys.is_active)
Index("idx_ai_api_keys_institute_user", AiApiKeys.institute_id, AiApiKeys.user_id, AiApiKeys.is_active)





