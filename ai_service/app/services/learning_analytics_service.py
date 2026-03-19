"""
Service for tracking and querying learning analytics.
"""
from __future__ import annotations

import logging
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session

from ..repositories.learning_analytics_repository import LearningAnalyticsRepository

logger = logging.getLogger(__name__)


class LearningAnalyticsService:
    """Tracks and queries learning analytics events."""

    def __init__(self, db_session: Session):
        self.repo = LearningAnalyticsRepository(db_session)

    def track_doubt(
        self,
        user_id: str,
        institute_id: str,
        topic: str,
        content: str,
        session_id: Optional[str] = None,
    ):
        """Track a doubt/question event."""
        try:
            self.repo.create_event(
                user_id=user_id,
                institute_id=institute_id,
                event_type="doubt",
                topic=topic,
                session_id=session_id,
                metadata={"content_preview": content[:200]},
            )
        except Exception as e:
            logger.warning(f"Failed to track doubt: {e}")

    def track_quiz_score(
        self,
        user_id: str,
        institute_id: str,
        topic: str,
        score: float,
        total: int,
        session_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Track a quiz score event."""
        try:
            self.repo.create_event(
                user_id=user_id,
                institute_id=institute_id,
                event_type="quiz_score",
                topic=topic,
                score=score,
                total=total,
                session_id=session_id,
                metadata=metadata,
            )
        except Exception as e:
            logger.warning(f"Failed to track quiz score: {e}")

    def get_analytics_summary(self, user_id: str) -> str:
        """Get formatted analytics summary for AI tool consumption."""
        doubts = self.repo.get_doubt_patterns(user_id)
        quizzes = self.repo.get_quiz_performance(user_id)
        topics = self.repo.get_topic_coverage(user_id)

        lines = ["Student Learning Analytics:\n"]

        if doubts:
            lines.append("Frequently Asked Topics (Doubts):")
            for d in doubts[:10]:
                lines.append(f"  - {d['topic']}: {d['count']} questions")
            lines.append("")

        if quizzes:
            lines.append("Recent Quiz Performance:")
            for q in quizzes[:10]:
                lines.append(f"  - {q['topic']}: {q['score']}/{q['total']} ({q['percentage']}%) on {q['date']}")
            lines.append("")

            # Calculate average by topic
            topic_scores: Dict[str, list] = {}
            for q in quizzes:
                t = q['topic']
                if t not in topic_scores:
                    topic_scores[t] = []
                topic_scores[t].append(q['percentage'])
            lines.append("Average Quiz Scores by Topic:")
            for t, scores in sorted(topic_scores.items(), key=lambda x: sum(x[1])/len(x[1])):
                avg = sum(scores) / len(scores)
                lines.append(f"  - {t}: {avg:.1f}% (from {len(scores)} quizzes)")
            lines.append("")

        if topics:
            lines.append("Topic Engagement:")
            for t in topics[:15]:
                lines.append(f"  - {t['topic']} ({t['type']}): {t['interactions']} interactions")

        if not doubts and not quizzes and not topics:
            lines.append("No analytics data available yet for this student.")

        return "\n".join(lines)


__all__ = ["LearningAnalyticsService"]
