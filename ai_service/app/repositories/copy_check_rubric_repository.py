"""Repository for the copy_check_rubric table."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from sqlalchemy.orm import Session

from ..models.copy_check import CopyCheckRubric


class CopyCheckRubricRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, assessment_id: str) -> Optional[CopyCheckRubric]:
        return self.db.query(CopyCheckRubric).filter_by(assessment_id=assessment_id).first()

    def upsert(
        self,
        assessment_id: str,
        institute_id: str,
        rubric: dict[str, Any],
        model_answers: Optional[dict[str, str]] = None,
        created_by: Optional[str] = None,
    ) -> CopyCheckRubric:
        existing = self.get(assessment_id)
        if existing:
            existing.rubric_version = existing.rubric_version + 1
            existing.rubric_json = json.dumps(rubric)
            existing.model_answers_json = json.dumps(model_answers or {})
            existing.updated_at = datetime.utcnow()
            row = existing
        else:
            row = CopyCheckRubric(
                assessment_id=assessment_id,
                institute_id=institute_id,
                rubric_version=1,
                rubric_json=json.dumps(rubric),
                model_answers_json=json.dumps(model_answers or {}),
                created_by=created_by,
            )
            self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def delete(self, assessment_id: str) -> bool:
        row = self.get(assessment_id)
        if not row:
            return False
        self.db.delete(row)
        self.db.commit()
        return True
