"""
SQLAlchemy model for learning_analytics table.
"""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, Float, Integer, Index
from sqlalchemy.dialects.postgresql import JSONB

from .ai_gen_video import Base


class LearningAnalytics(Base):
    """
    Tracks learning analytics events: doubts, quiz scores, topic coverage, time spent.
    """
    __tablename__ = "learning_analytics"

    id = Column(String(255), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(255), nullable=False, index=True)
    institute_id = Column(String(255), nullable=False, index=True)
    session_id = Column(String(255), nullable=True)
    event_type = Column(String(50), nullable=False)  # doubt, quiz_score, topic_coverage, time_spent
    topic = Column(String(500), nullable=True)
    score = Column(Float, nullable=True)
    total = Column(Integer, nullable=True)
    meta_data = Column("meta_data", JSONB, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_learning_analytics_user', 'user_id', 'event_type'),
        Index('idx_learning_analytics_topic', 'user_id', 'topic'),
        Index('idx_learning_analytics_created', 'created_at'),
    )

    def __repr__(self) -> str:
        return f"<LearningAnalytics(id={self.id}, user_id={self.user_id}, event_type={self.event_type})>"


__all__ = ["LearningAnalytics"]
