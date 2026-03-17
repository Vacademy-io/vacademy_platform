"""
SQLAlchemy model for chat_sessions table.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, Text, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from .ai_gen_video import Base


class ChatSession(Base):
    """
    Stores AI chatbot session state with passive context.
    
    A chat session represents a conversation between a student and the AI tutor.
    Each session is tied to a specific context (e.g., a slide, question, or general chat).
    """
    __tablename__ = "chat_sessions"
    
    id = Column(String(255), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(255), nullable=False, index=True)
    institute_id = Column(String(255), nullable=False, index=True)
    context_type = Column(String(50), nullable=False)
    context_meta = Column(JSONB, nullable=False)
    status = Column(String(20), nullable=False, default="ACTIVE")
    last_active = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to messages
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_chat_sessions_user_id', 'user_id', 'status'),
        Index('idx_chat_sessions_status', 'status'),
        Index('idx_chat_sessions_last_active', 'last_active'),
    )
    
    def __repr__(self) -> str:
        return f"<ChatSession(id={self.id}, user_id={self.user_id}, context_type={self.context_type}, status={self.status})>"


__all__ = ["ChatSession"]
