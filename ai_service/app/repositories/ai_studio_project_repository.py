"""
Repository for ai_studio_projects database operations.

Mirrors the connection-handling pattern from ai_reel_repository.py:
- a fresh session is used for background-task writes;
- passed sessions are reused for request-scope reads;
- transient connection errors retry on a fresh session once.

Studio projects are the persistent root entity. Builds live in
ai_studio_build_repository.py (sibling).
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import delete, select, update
from sqlalchemy.exc import OperationalError, PendingRollbackError
from sqlalchemy.orm import Session

from ..db import get_engine
from ..models.ai_studio_project import AiStudioProject

logger = logging.getLogger(__name__)


def _is_connection_error(exc: Exception) -> bool:
    if isinstance(exc, (OperationalError, PendingRollbackError)):
        return True
    msg = str(exc).lower()
    return any(s in msg for s in (
        "server closed the connection", "connection was reset",
        "ssl connection has been closed", "could not connect", "broken pipe",
    ))


class AiStudioProjectRepository:
    """Repository for ai_studio_projects rows."""

    def __init__(self, session: Optional[Session] = None):
        self.session = session
        self._engine = get_engine()

    def _get_session(self) -> Session:
        return self.session or Session(self._engine)

    def _get_fresh_session(self) -> Session:
        return Session(self._engine)

    # ── CREATE ────────────────────────────────────────────────────────────

    def create(
        self,
        institute_id: str,
        name: Optional[str],
        source_asset_refs: List[Dict[str, Any]],
        user_prompt: Optional[str],
        target_aspect: Optional[str],
        target_duration_s: Optional[int],
        config: Optional[Dict[str, Any]] = None,
        created_by_user_id: Optional[str] = None,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> AiStudioProject:
        session = self._get_session()
        try:
            record = AiStudioProject(
                institute_id=institute_id,
                name=name,
                source_asset_refs=source_asset_refs or [],
                user_prompt=user_prompt,
                target_aspect=target_aspect,
                target_duration_s=target_duration_s,
                status="DRAFT",
                config=config or {},
                extra_metadata=extra_metadata or {},
                created_by_user_id=created_by_user_id,
            )
            session.add(record)
            session.commit()
            session.refresh(record)
            return record
        except Exception as e:
            session.rollback()
            logger.error(f"Error creating studio project: {e}")
            raise

    # ── READ ──────────────────────────────────────────────────────────────

    def get_by_id(self, project_id: str) -> Optional[AiStudioProject]:
        session = self._get_session()
        try:
            return session.get(AiStudioProject, project_id)
        except Exception as e:
            if _is_connection_error(e):
                return self._get_fresh_session().get(AiStudioProject, project_id)
            raise

    def list_by_institute(
        self,
        institute_id: str,
        include_archived: bool = False,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AiStudioProject]:
        """Paginated list, newest-first. ARCHIVED excluded by default."""
        session = self._get_session()
        stmt = (
            select(AiStudioProject)
            .where(AiStudioProject.institute_id == institute_id)
            .order_by(AiStudioProject.created_at.desc())
        )
        if not include_archived:
            stmt = stmt.where(AiStudioProject.status != "ARCHIVED")
        if status is not None:
            stmt = stmt.where(AiStudioProject.status == status)
        stmt = stmt.limit(max(1, min(200, limit))).offset(max(0, offset))
        try:
            return list(session.execute(stmt).scalars().all())
        except Exception as e:
            if _is_connection_error(e):
                return list(self._get_fresh_session().execute(stmt).scalars().all())
            raise

    # ── UPDATE ────────────────────────────────────────────────────────────

    def update_fields(
        self,
        project_id: str,
        *,
        name: Optional[str] = None,
        source_asset_refs: Optional[List[Dict[str, Any]]] = None,
        user_prompt: Optional[str] = None,
        target_aspect: Optional[str] = None,
        target_duration_s: Optional[int] = None,
        confirmed_plan: Optional[Dict[str, Any]] = None,
        published_build_id: Optional[str] = None,
        status: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
        extra_metadata: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """Partial update. Any non-None field is written; None means leave alone."""
        values: Dict[str, Any] = {}
        if name is not None:
            values["name"] = name
        if source_asset_refs is not None:
            values["source_asset_refs"] = source_asset_refs
        if user_prompt is not None:
            values["user_prompt"] = user_prompt
        if target_aspect is not None:
            values["target_aspect"] = target_aspect
        if target_duration_s is not None:
            values["target_duration_s"] = target_duration_s
        if confirmed_plan is not None:
            values["confirmed_plan"] = confirmed_plan
        if published_build_id is not None:
            values["published_build_id"] = published_build_id
        if status is not None:
            values["status"] = status
        if config is not None:
            values["config"] = config
        if extra_metadata is not None:
            values["extra_metadata"] = extra_metadata
        if error_message is not None:
            values["error_message"] = error_message
        if not values:
            return
        session = self._get_fresh_session()
        try:
            stmt = update(AiStudioProject).where(AiStudioProject.id == project_id).values(**values)
            session.execute(stmt)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Error updating studio project {project_id}: {e}")
            raise
        finally:
            session.close()

    def patch_confirmed_step(
        self,
        project_id: str,
        step: str,
        step_plan: Dict[str, Any],
    ) -> None:
        """Merge one wizard-step ConfirmedStepPlan into project.confirmed_plan[step].

        Read-modify-write under a fresh session — small payloads, low contention,
        not worth a JSONB jsonb_set RPC.
        """
        session = self._get_fresh_session()
        try:
            record = session.get(AiStudioProject, project_id)
            if record is None:
                return
            plan = dict(record.confirmed_plan or {})
            plan[step] = step_plan
            record.confirmed_plan = plan
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Error patching confirmed step {step} on project {project_id}: {e}")
            raise
        finally:
            session.close()

    # ── DELETE (soft) ────────────────────────────────────────────────────

    def archive(self, project_id: str) -> bool:
        session = self._get_fresh_session()
        try:
            stmt = (
                update(AiStudioProject)
                .where(AiStudioProject.id == project_id)
                .values(status="ARCHIVED", archived_at=datetime.utcnow())
            )
            result = session.execute(stmt)
            session.commit()
            return (result.rowcount or 0) > 0
        except Exception as e:
            session.rollback()
            logger.error(f"Error archiving studio project {project_id}: {e}")
            raise
        finally:
            session.close()

    # ── DELETE (hard — admin / cleanup only) ─────────────────────────────

    def delete_by_id(self, project_id: str) -> bool:
        """Hard delete. CASCADE drops all child builds + operation logs.

        Reserved for cleanup. UI uses archive() instead.
        """
        session = self._get_session()
        try:
            stmt = delete(AiStudioProject).where(AiStudioProject.id == project_id)
            result = session.execute(stmt)
            session.commit()
            return (result.rowcount or 0) > 0
        except Exception as e:
            session.rollback()
            logger.error(f"Error hard-deleting studio project {project_id}: {e}")
            raise
