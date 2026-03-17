"""
SQLAlchemy model for chat_messages table.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Column, String, DateTime, Text, BigInteger, Index, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from .ai_gen_video import Base


class ChatMessage(Base):
    """
    Stores conversation messages including user, assistant, tool_call, and tool_result types.
    
    Message types:
    - user: Message from the student
    - assistant: Response from the AI tutor
    - tool_call: Request to execute a tool
    - tool_result: Result from tool execution
    """
    __tablename__ = "chat_messages"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    session_id = Column(String(255), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    message_type = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    meta_data = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship to session
    session = relationship("ChatSession", back_populates="messages")
    
    __table_args__ = (
        Index('idx_chat_messages_session_id', 'session_id', 'id'),
        Index('idx_chat_messages_created_at', 'created_at'),
        Index('idx_chat_messages_type', 'session_id', 'message_type'),
    )
    
    def __repr__(self) -> str:
        return f"<ChatMessage(id={self.id}, session_id={self.session_id}, type={self.message_type})>"


__all__ = ["ChatMessage"]
