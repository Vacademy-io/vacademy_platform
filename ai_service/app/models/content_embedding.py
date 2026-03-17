"""
SQLAlchemy model for content_embeddings table (pgvector).
"""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, Text, Integer, Index
from sqlalchemy.dialects.postgresql import JSONB
from pgvector.sqlalchemy import Vector

from .ai_gen_video import Base


class ContentEmbedding(Base):
    """
    Stores vector embeddings of course content for semantic search.
    Uses pgvector extension for efficient similarity search.
    """
    __tablename__ = "content_embeddings"

    id = Column(String(255), primary_key=True, default=lambda: str(uuid4()))
    institute_id = Column(String(255), nullable=False, index=True)
    source_type = Column(String(50), nullable=False)  # slide, chapter, question
    source_id = Column(String(255), nullable=False)
    content_text = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False, default=0)  # For chunked content
    embedding = Column(Vector(768), nullable=False)  # 768-dim for text-embedding-004
    meta_data = Column("meta_data", JSONB, nullable=True)  # title, subject, chapter, etc.
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_content_embeddings_institute', 'institute_id'),
        Index('idx_content_embeddings_source', 'source_type', 'source_id'),
    )

    def __repr__(self) -> str:
        return f"<ContentEmbedding(id={self.id}, source_type={self.source_type}, source_id={self.source_id})>"


__all__ = ["ContentEmbedding"]
