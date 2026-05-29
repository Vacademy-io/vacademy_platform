"""SQLAlchemy models for copy-check rubrics and per-question model answers.

These persist the "fixed test" mode — pre-authored rubrics that bypass the
LLM-derived criteria-generation path and let the grader prompt-cache the
rubric block across every student's copy.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, Index, Integer, String, Text

from .ai_gen_video import Base


class CopyCheckRubric(Base):
    """One rubric per (institute, assessment). Versioned so the FE can show
    a 'rubric changed since this evaluation' badge on stale evaluations."""

    __tablename__ = "copy_check_rubric"

    assessment_id = Column(String(64), primary_key=True)
    institute_id = Column(String(64), nullable=False)
    rubric_version = Column(Integer, nullable=False, default=1)
    rubric_json = Column(Text, nullable=False)            # {question_id: CriteriaRubricDto}
    model_answers_json = Column(Text, nullable=True)      # {question_id: "model answer text"}
    created_by = Column(String(64), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_copy_check_rubric_institute", "institute_id"),
    )


class CopyCheckQuestionAnswer(Base):
    """Per-question model answer + step rubric. Lets authors edit one
    question without rewriting the whole CopyCheckRubric.rubric_json blob."""

    __tablename__ = "copy_check_question_answer"

    id = Column(String(64), primary_key=True)
    assessment_id = Column(String(64), nullable=False)
    question_id = Column(String(64), nullable=False)
    model_answer = Column(Text, nullable=True)
    step_rubric_json = Column(Text, nullable=True)        # CriteriaRubricDto
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_copy_check_qa_assessment", "assessment_id"),
        Index("idx_copy_check_qa_assessment_question", "assessment_id", "question_id", unique=True),
    )


__all__ = ["CopyCheckRubric", "CopyCheckQuestionAnswer"]
