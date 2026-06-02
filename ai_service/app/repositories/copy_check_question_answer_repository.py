"""Repository for the copy_check_question_answer table."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from ..models.copy_check import CopyCheckQuestionAnswer


class CopyCheckQuestionAnswerRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, assessment_id: str, question_id: str) -> Optional[CopyCheckQuestionAnswer]:
        return (
            self.db.query(CopyCheckQuestionAnswer)
            .filter_by(assessment_id=assessment_id, question_id=question_id)
            .first()
        )

    def list_for_assessment(self, assessment_id: str) -> list[CopyCheckQuestionAnswer]:
        return (
            self.db.query(CopyCheckQuestionAnswer)
            .filter_by(assessment_id=assessment_id)
            .all()
        )

    def upsert(
        self,
        assessment_id: str,
        question_id: str,
        model_answer: Optional[str],
        step_rubric: Optional[dict[str, Any]],
    ) -> CopyCheckQuestionAnswer:
        existing = self.get(assessment_id, question_id)
        if existing:
            existing.model_answer = model_answer
            existing.step_rubric_json = json.dumps(step_rubric) if step_rubric else None
            existing.updated_at = datetime.utcnow()
            row = existing
        else:
            row = CopyCheckQuestionAnswer(
                id=str(uuid4()),
                assessment_id=assessment_id,
                question_id=question_id,
                model_answer=model_answer,
                step_rubric_json=json.dumps(step_rubric) if step_rubric else None,
            )
            self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def delete(self, assessment_id: str, question_id: str) -> bool:
        row = self.get(assessment_id, question_id)
        if not row:
            return False
        self.db.delete(row)
        self.db.commit()
        return True
