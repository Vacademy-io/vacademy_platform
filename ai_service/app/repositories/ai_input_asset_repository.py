"""
Repository for AI Input Asset (videos + images) database operations.
"""
from __future__ import annotations

import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, update, delete
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, PendingRollbackError

from ..models.ai_input_asset import AiInputAsset
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


class AiInputAssetRepository:
    """Repository for managing AI input asset records (videos and images)."""

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
        kind: str = "video",
    ) -> AiInputAsset:
        session = self._get_session()
        try:
            record = AiInputAsset(
                institute_id=institute_id,
                name=name,
                kind=kind,
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
            logger.error(f"Error creating input asset record: {e}")
            raise

    # ── READ ──────────────────────────────────────────────────────────────

    def get_by_id(self, record_id: str) -> Optional[AiInputAsset]:
        session = self._get_session()
        try:
            return session.get(AiInputAsset, record_id)
        except Exception as e:
            if _is_connection_error(e):
                session = self._get_fresh_session()
                return session.get(AiInputAsset, record_id)
            raise

    def get_by_ids(self, record_ids: List[str]) -> List[AiInputAsset]:
        """Fetch multiple records by ID, preserving the order of record_ids."""
        if not record_ids:
            return []
        session = self._get_session()
        try:
            stmt = select(AiInputAsset).where(AiInputAsset.id.in_(record_ids))
            rows = {str(r.id): r for r in session.execute(stmt).scalars().all()}
            return [rows[rid] for rid in record_ids if rid in rows]
        except Exception as e:
            if _is_connection_error(e):
                session = self._get_fresh_session()
                stmt = select(AiInputAsset).where(AiInputAsset.id.in_(record_ids))
                rows = {str(r.id): r for r in session.execute(stmt).scalars().all()}
                return [rows[rid] for rid in record_ids if rid in rows]
            raise

    def list_by_institute(
        self,
        institute_id: str,
        kind: Optional[str] = None,
    ) -> List[AiInputAsset]:
        """List assets for an institute, newest first. Optionally filter by kind."""
        session = self._get_session()
        stmt = (
            select(AiInputAsset)
            .where(AiInputAsset.institute_id == institute_id)
            .order_by(AiInputAsset.created_at.desc())
        )
        if kind is not None:
            stmt = stmt.where(AiInputAsset.kind == kind)
        try:
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
                update(AiInputAsset)
                .where(AiInputAsset.id == record_id)
                .values(**values)
            )
            session.execute(stmt)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Error updating input asset status: {e}")
        finally:
            session.close()

    def update_on_completion(
        self,
        record_id: str,
        context_json_url: Optional[str] = None,
        spatial_db_url: Optional[str] = None,
        image_metadata_url: Optional[str] = None,
        assets_urls: Optional[Dict[str, Any]] = None,
        duration_seconds: Optional[float] = None,
        resolution: Optional[str] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
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
            if image_metadata_url is not None:
                values["image_metadata_url"] = image_metadata_url
            if assets_urls is not None:
                values["assets_urls"] = assets_urls
            if duration_seconds is not None:
                values["duration_seconds"] = duration_seconds
            if resolution is not None:
                values["resolution"] = resolution
            if width is not None:
                values["width"] = width
            if height is not None:
                values["height"] = height
            if metadata is not None:
                values["extra_metadata"] = metadata
            stmt = (
                update(AiInputAsset)
                .where(AiInputAsset.id == record_id)
                .values(**values)
            )
            session.execute(stmt)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Error completing input asset record: {e}")
        finally:
            session.close()

    # ── DELETE ─────────────────────────────────────────────────────────────

    def delete_by_id(self, record_id: str) -> bool:
        session = self._get_session()
        try:
            stmt = delete(AiInputAsset).where(AiInputAsset.id == record_id)
            result = session.execute(stmt)
            session.commit()
            return result.rowcount > 0
        except Exception as e:
            session.rollback()
            logger.error(f"Error deleting input asset record: {e}")
            raise
