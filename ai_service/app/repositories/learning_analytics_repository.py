"""
Repository for learning_analytics table operations.
"""
from __future__ import annotations

import logging
from typing import List, Dict, Any, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..models.learning_analytics import LearningAnalytics

logger = logging.getLogger(__name__)


class LearningAnalyticsRepository:
    """CRUD operations for learning analytics events."""

    def __init__(self, db_session: Session):
        self.db = db_session

    def create_event(
        self,
        user_id: str,
        institute_id: str,
        event_type: str,
        topic: Optional[str] = None,
        score: Optional[float] = None,
        total: Optional[int] = None,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> LearningAnalytics:
        """Create a new analytics event."""
        try:
            event = LearningAnalytics(
                user_id=user_id,
                institute_id=institute_id,
                session_id=session_id,
                event_type=event_type,
                topic=topic,
                score=score,
                total=total,
                meta_data=metadata or {},
            )
            self.db.add(event)
            self.db.commit()
            self.db.refresh(event)
            return event
        except Exception as e:
            self.db.rollback()
            logger.warning(f"Failed to create analytics event: {e}")
            return None

    def get_doubt_patterns(self, user_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get doubt frequency by topic for the last N days."""
        try:
            stmt = text("""
                SELECT topic, COUNT(*) as count, MAX(created_at) as last_asked
                FROM learning_analytics
                WHERE user_id = :user_id
                AND event_type = 'doubt'
                AND created_at >= NOW() - make_interval(days => :days)
                AND topic IS NOT NULL
                GROUP BY topic
                ORDER BY count DESC
                LIMIT 20
            """)
            result = self.db.execute(stmt, {"user_id": user_id, "days": days})
            return [{"topic": r[0], "count": r[1], "last_asked": r[2].isoformat() if r[2] else None} for r in result.fetchall()]
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error getting doubt patterns: {e}")
            return []

    def get_quiz_performance(self, user_id: str, topic: Optional[str] = None, days: int = 30) -> List[Dict[str, Any]]:
        """Get quiz scores over time, optionally filtered by topic."""
        try:
            params: Dict[str, Any] = {"user_id": user_id, "days": days}
            topic_filter = ""
            if topic:
                topic_filter = "AND topic ILIKE :topic"
                params["topic"] = f"%{topic}%"

            stmt = text(f"""
                SELECT topic, score, total,
                       ROUND((score / NULLIF(total, 0)) * 100, 1) as percentage,
                       created_at
                FROM learning_analytics
                WHERE user_id = :user_id
                AND event_type = 'quiz_score'
                AND created_at >= NOW() - make_interval(days => :days)
                {topic_filter}
                ORDER BY created_at DESC
                LIMIT 50
            """)
            result = self.db.execute(stmt, params)
            return [{
                "topic": r[0],
                "score": r[1],
                "total": r[2],
                "percentage": float(r[3]) if r[3] else 0,
                "date": r[4].isoformat() if r[4] else None,
            } for r in result.fetchall()]
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error getting quiz performance: {e}")
            return []

    def get_topic_coverage(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all topics the student has engaged with."""
        try:
            stmt = text("""
                SELECT topic, event_type, COUNT(*) as interactions, MAX(created_at) as last_interaction
                FROM learning_analytics
                WHERE user_id = :user_id
                AND topic IS NOT NULL
                GROUP BY topic, event_type
                ORDER BY interactions DESC
                LIMIT 50
            """)
            result = self.db.execute(stmt, {"user_id": user_id})
            return [{
                "topic": r[0],
                "type": r[1],
                "interactions": r[2],
                "last_interaction": r[3].isoformat() if r[3] else None,
            } for r in result.fetchall()]
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error getting topic coverage: {e}")
            return []


__all__ = ["LearningAnalyticsRepository"]
