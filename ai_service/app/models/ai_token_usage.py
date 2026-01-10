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
    Numeric,
    TypeDecorator,
)
from sqlalchemy.dialects.postgresql import UUID
import enum

from .ai_gen_video import Base


class EnumValueType(TypeDecorator):
    """Type decorator to ensure enum values (not names) are stored in database."""
    impl = String
    cache_ok = True
    
    def __init__(self, enum_class, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.enum_class = enum_class
    
    def process_bind_param(self, value, dialect):
        """Convert enum to its value (string) when binding to database."""
        if value is None:
            return None
        
        # Handle enum instances - get the value
        if isinstance(value, enum.Enum):
            return value.value
        
        # Handle strings - check if it's an enum name or value
        if isinstance(value, str):
            # First check if it's already a valid enum value (lowercase)
            valid_values = [e.value for e in self.enum_class]
            if value.lower() in [v.lower() for v in valid_values]:
                # Return the correct lowercase value
                for v in valid_values:
                    if v.lower() == value.lower():
                        return v
            
            # If it's an enum name (uppercase), convert to value
            try:
                # Try to find enum by name (case-insensitive)
                for enum_member in self.enum_class:
                    if enum_member.name.upper() == value.upper():
                        return enum_member.value
                # Try direct lookup
                enum_member = self.enum_class[value]
                return enum_member.value
            except (KeyError, AttributeError):
                # If not found, return lowercase version if it looks like an enum name
                if value.isupper() and len(value) > 1:
                    # Might be an enum name, try to convert
                    try:
                        return self.enum_class[value].value
                    except KeyError:
                        pass
                return value.lower() if value else value
        
        # For other types, convert to string and lowercase
        return str(value).lower() if value else None
    
    def process_result_value(self, value, dialect):
        """Convert database value back to enum when reading."""
        if value is None:
            return None
        try:
            return self.enum_class(value)
        except ValueError:
            return value


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
    # Use EnumValueType to ensure enum values (lowercase strings) are stored, not enum names
    api_provider = Column(EnumValueType(ApiProvider, 50), nullable=False, index=True)
    model = Column(String(255), nullable=True, index=True)
    
    # Token usage metrics
    # Note: prompt_tokens = input tokens, completion_tokens = output tokens
    prompt_tokens = Column(Integer, nullable=False, default=0, comment="Input tokens (prompt tokens)")
    completion_tokens = Column(Integer, nullable=False, default=0, comment="Output tokens (completion tokens)")
    total_tokens = Column(Integer, nullable=False, default=0, index=True)
    
    # Pricing information (per token pricing for input and output)
    # input_token_price applies to prompt_tokens, output_token_price applies to completion_tokens
    input_token_price = Column(Numeric(20, 10), nullable=True, comment="Price per input token (applies to prompt_tokens) for this model")
    output_token_price = Column(Numeric(20, 10), nullable=True, comment="Price per output token (applies to completion_tokens) for this model")
    total_price = Column(Numeric(20, 10), nullable=True, comment="Total price: (input_token_price * prompt_tokens) + (output_token_price * completion_tokens)")
    
    # Request context
    # Use EnumValueType to ensure enum values (lowercase strings) are stored, not enum names
    request_type = Column(EnumValueType(RequestType, 50), nullable=False, index=True)
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
            "input_token_price": float(self.input_token_price) if self.input_token_price is not None else None,
            "output_token_price": float(self.output_token_price) if self.output_token_price is not None else None,
            "total_price": float(self.total_price) if self.total_price is not None else None,
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





