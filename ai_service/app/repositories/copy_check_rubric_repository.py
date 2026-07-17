"""Repository for the copy_check_rubric table."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from sqlalchemy.exc import IntegrityError
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

    def merge_generated_rubrics(
        self,
        assessment_id: str,
        institute_id: str,
        generated: dict[str, dict[str, Any]],
    ) -> dict[str, dict[str, Any]]:
        """Merge AI-generated per-question rubrics into the assessment's fixed
        rubric, first-writer-wins (an existing question entry is never
        overwritten), so every student's job grades against identical criteria
        instead of re-inventing a rubric per copy.

        Concurrency-safe: if a sibling job created the row first, we retry the
        merge against the now-existing row. Returns the authoritative rubric map
        for the given question_ids (the DB-stored version where present), so the
        calling job converges on the same criteria as every other job.
        """
        def _merge_into(current: dict[str, Any]) -> bool:
            added = False
            for qid, rub in generated.items():
                if qid not in current:
                    current[qid] = rub
                    added = True
            return added

        def _authoritative(current: dict[str, Any]) -> dict[str, dict[str, Any]]:
            return {qid: current.get(qid, generated[qid]) for qid in generated}

        try:
            existing = self.get(assessment_id)
            if existing:
                current = json.loads(existing.rubric_json) if existing.rubric_json else {}
                if _merge_into(current):
                    existing.rubric_json = json.dumps(current)
                    existing.rubric_version = (existing.rubric_version or 1) + 1
                    existing.updated_at = datetime.utcnow()
                self.db.commit()
                return _authoritative(current)
            row = CopyCheckRubric(
                assessment_id=assessment_id,
                institute_id=institute_id,
                rubric_version=1,
                rubric_json=json.dumps(dict(generated)),
                model_answers_json=json.dumps({}),
            )
            self.db.add(row)
            self.db.commit()
            return dict(generated)
        except IntegrityError:
            # A sibling job inserted the row between our get() and commit().
            self.db.rollback()
            existing = self.get(assessment_id)
            if existing is None:
                return dict(generated)
            current = json.loads(existing.rubric_json) if existing.rubric_json else {}
            if _merge_into(current):
                existing.rubric_json = json.dumps(current)
                existing.rubric_version = (existing.rubric_version or 1) + 1
                existing.updated_at = datetime.utcnow()
                self.db.commit()
            return _authoritative(current)

    def delete(self, assessment_id: str) -> bool:
        row = self.get(assessment_id)
        if not row:
            return False
        self.db.delete(row)
        self.db.commit()
        return True
