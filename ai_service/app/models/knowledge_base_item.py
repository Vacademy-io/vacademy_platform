"""
SQLAlchemy model for knowledge_base_items table.
Stores institute-specific knowledge that gets embedded for RAG search.
"""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, Text, Boolean, Index
from sqlalchemy.dialects.postgresql import JSONB, ARRAY

from .ai_gen_video import Base


class KnowledgeBaseItem(Base):
    """
    Institute knowledge items — events, policies, processes, FAQs, etc.
    Content is auto-embedded into content_embeddings for semantic search.
    """
    __tablename__ = "knowledge_base_items"

    id = Column(String(255), primary_key=True, default=lambda: str(uuid4()))
    institute_id = Column(String(255), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50), nullable=False, default="general")
    tags = Column(ARRAY(String), nullable=True, default=[])
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_kb_items_institute', 'institute_id'),
        Index('idx_kb_items_category', 'institute_id', 'category'),
    )

    def __repr__(self) -> str:
        return f"<KnowledgeBaseItem(id={self.id}, title={self.title[:30]})>"


__all__ = ["KnowledgeBaseItem"]
