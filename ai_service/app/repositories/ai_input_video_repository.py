"""
Repository for AI Input Video database operations.
"""
from __future__ import annotations

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime

from sqlalchemy import select, update, delete
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, PendingRollbackError

from ..models.ai_input_video import AiInputVideo
from ..db import get_engine

logger = logging.getLogger(__name__)


def _is_connection_error(exc: Exception) -> bool:
    if isinstance(exc, (OperationalError, PendingRollbackError)):
        return True
    msg = str(exc).lower()
    return any(s in msg for s in (
        "server closed the connection", "connection was reset",
        "ssl connection has been closed", "could not connect", "broken pipe",
    ))


class AiInputVideoRepository:
    """Repository for managing AI input video records."""

    def __init__(self, session: Optional[Session] = None):
        self.session = session
        self._engine = get_engine()

    def _get_session(self) -> Session:
        if self.session:
            return self.session
        return Session(self._engine)

    def _get_fresh_session(self) -> Session:
        """Always create a fresh session (for background tasks)."""
        return Session(self._engine)

    # ── CREATE ────────────────────────────────────────────────────────────

    def create(
        self,
        institute_id: str,
        name: str,
        mode: str,
        source_url: str,
        created_by_user_id: Optional[str] = None,
    ) -> AiInputVideo:
        session = self._get_session()
        try:
            record = AiInputVideo(
                institute_id=institute_id,
                name=name,
                mode=mode,
                source_url=source_url,
                status="PENDING",
                created_by_user_id=created_by_user_id,
            )
            session.add(record)
            session.commit()
            session.refresh(record)
            return record
        except Exception as e:
            session.rollback()
            logger.error(f"Error creating input video record: {e}")
            raise

    # ── READ ──────────────────────────────────────────────────────────────

    def get_by_id(self, record_id: str) -> Optional[AiInputVideo]:
        session = self._get_session()
        try:
            return session.get(AiInputVideo, record_id)
        except Exception as e:
            if _is_connection_error(e):
                session = self._get_fresh_session()
                return session.get(AiInputVideo, record_id)
            raise

    def list_by_institute(self, institute_id: str) -> List[AiInputVideo]:
        session = self._get_session()
        try:
            stmt = (
                select(AiInputVideo)
                .where(AiInputVideo.institute_id == institute_id)
                .order_by(AiInputVideo.created_at.desc())
            )
            return list(session.execute(stmt).scalars().all())
        except Exception as e:
            if _is_connection_error(e):
                session = self._get_fresh_session()
                return list(session.execute(stmt).scalars().all())
            raise

    # ── UPDATE ─────────────────────────────────────────────────────────────

    def update_status(
        self,
        record_id: str,
        status: str,
        progress: Optional[int] = None,
        error_message: Optional[str] = None,
        render_job_id: Optional[str] = None,
    ) -> None:
        """Update status fields. Uses a fresh session for background-task safety."""
        session = self._get_fresh_session()
        try:
            values: Dict[str, Any] = {"status": status}
            if progress is not None:
                values["progress"] = progress
            if error_message is not None:
                values["error_message"] = error_message
            if render_job_id is not None:
                values["render_job_id"] = render_job_id
            stmt = (
                update(AiInputVideo)
                .where(AiInputVideo.id == record_id)
                .values(**values)
            )
            session.execute(stmt)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Error updating input video status: {e}")
        finally:
            session.close()

    def update_on_completion(
        self,
        record_id: str,
        context_json_url: Optional[str] = None,
        spatial_db_url: Optional[str] = None,
        assets_urls: Optional[Dict[str, Any]] = None,
        duration_seconds: Optional[float] = None,
        resolution: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Update the record on successful indexing completion."""
        session = self._get_fresh_session()
        try:
            values: Dict[str, Any] = {
                "status": "COMPLETED",
                "progress": 100,
            }
            if context_json_url is not None:
                values["context_json_url"] = context_json_url
            if spatial_db_url is not None:
                values["spatial_db_url"] = spatial_db_url
            if assets_urls is not None:
                values["assets_urls"] = assets_urls
            if duration_seconds is not None:
                values["duration_seconds"] = duration_seconds
            if resolution is not None:
                values["resolution"] = resolution
            if metadata is not None:
                values["extra_metadata"] = metadata
            stmt = (
                update(AiInputVideo)
                .where(AiInputVideo.id == record_id)
                .values(**values)
            )
            session.execute(stmt)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Error completing input video record: {e}")
        finally:
            session.close()

    # ── DELETE ─────────────────────────────────────────────────────────────

    def delete_by_id(self, record_id: str) -> bool:
        session = self._get_session()
        try:
            stmt = delete(AiInputVideo).where(AiInputVideo.id == record_id)
            result = session.execute(stmt)
            session.commit()
            return result.rowcount > 0
        except Exception as e:
            session.rollback()
            logger.error(f"Error deleting input video record: {e}")
            raise
