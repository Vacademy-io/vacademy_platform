"""
Router for learning analytics endpoints.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db import db_dependency
from ..services.learning_analytics_service import LearningAnalyticsService
from ..repositories.learning_analytics_repository import LearningAnalyticsRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["learning-analytics"])


@router.get("/{user_id}/summary")
async def get_analytics_summary(
    user_id: str,
    db: Session = Depends(db_dependency),
):
    """Get analytics dashboard data for a user."""
    repo = LearningAnalyticsRepository(db)

    return {
        "doubts": repo.get_doubt_patterns(user_id),
        "quiz_performance": repo.get_quiz_performance(user_id),
        "topic_coverage": repo.get_topic_coverage(user_id),
    }


@router.get("/{user_id}/doubts")
async def get_doubt_patterns(
    user_id: str,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(db_dependency),
):
    """Get doubt frequency by topic."""
    repo = LearningAnalyticsRepository(db)
    return {"doubts": repo.get_doubt_patterns(user_id, days)}


@router.get("/{user_id}/quiz-scores")
async def get_quiz_scores(
    user_id: str,
    topic: Optional[str] = None,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(db_dependency),
):
    """Get quiz scores over time."""
    repo = LearningAnalyticsRepository(db)
    return {"quiz_scores": repo.get_quiz_performance(user_id, topic, days)}
