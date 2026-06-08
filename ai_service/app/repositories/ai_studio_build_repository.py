"""
Repository for ai_studio_builds database operations.

Builds are versioned snapshots of a Studio project's ConfirmedPlan. Each
build owns its own editor session (the /frame/* endpoints scope to build_id)
so switching between Build v1 and Build v2 preserves both editor save states.

Same connection-handling pattern as ai_studio_project_repository / reels:
fresh session for background-task writes, passed session for request reads.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError, OperationalError, PendingRollbackError
from sqlalchemy.orm import Session

from ..db import get_engine
from ..models.ai_studio_build import AiStudioBuild

logger = logging.getLogger(__name__)


def _is_connection_error(exc: Exception) -> bool:
    if isinstance(exc, (OperationalError, PendingRollbackError)):
        return True
    msg = str(exc).lower()
    return any(s in msg for s in (
        "server closed the connection", "connection was reset",
        "ssl connection has been closed", "could not connect", "broken pipe",
    ))


class AiStudioBuildRepository:
    """Repository for ai_studio_builds rows."""

    def __init__(self, session: Optional[Session] = None):
        self.session = session
        self._engine = get_engine()

    def _get_session(self) -> Session:
        return self.session or Session(self._engine)

    def _get_fresh_session(self) -> Session:
        return Session(self._engine)

    # ── CREATE ────────────────────────────────────────────────────────────

    def _next_version(self, session: Session, project_id: str) -> int:
        """Returns the next monotonic version number for a project's build.

        The UNIQUE INDEX uq_studio_build_version on (project_id, version)
        catches the rare double-submit race; callers retry on IntegrityError.
        """
        stmt = (
            select(func.coalesce(func.max(AiStudioBuild.version), 0))
            .where(AiStudioBuild.project_id == project_id)
        )
        return int(session.execute(stmt).scalar_one() or 0) + 1

    def create(
        self,
        project_id: str,
        plan_snapshot: Dict[str, Any],
        config: Dict[str, Any],
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> AiStudioBuild:
        """Insert a new Build vN. Application-side picks vN via _next_version;
        UNIQUE constraint on (project_id, version) catches concurrent races.
        On IntegrityError, retries once with a fresh max+1.
        """
        for attempt in range(2):
            session = self._get_session()
            try:
                version = self._next_version(session, project_id)
                record = AiStudioBuild(
                    project_id=project_id,
                    version=version,
                    plan_snapshot=plan_snapshot or {},
                    status="PENDING",
                    build_stage="PENDING",
                    progress=0,
                    config=config or {},
                    extra_metadata=extra_metadata or {},
                )
                session.add(record)
                session.commit()
                session.refresh(record)
                return record
            except IntegrityError as e:
                session.rollback()
                if attempt == 0:
                    logger.info(
                        f"Studio build version race on project {project_id} — retrying with fresh max+1"
                    )
                    continue
                logger.error(f"Studio build version race exhausted on project {project_id}: {e}")
                raise
            except Exception as e:
                session.rollback()
                logger.error(f"Error creating studio build for project {project_id}: {e}")
                raise
        # Unreachable — both branches above either return or raise.
        raise RuntimeError("unreachable")

    # ── READ ──────────────────────────────────────────────────────────────

    def get_by_id(self, build_id: str) -> Optional[AiStudioBuild]:
        session = self._get_session()
        try:
            return session.get(AiStudioBuild, build_id)
        except Exception as e:
            if _is_connection_error(e):
                return self._get_fresh_session().get(AiStudioBuild, build_id)
            raise

    def list_by_project(
        self,
        project_id: str,
        include_archived: bool = False,
    ) -> List[AiStudioBuild]:
        session = self._get_session()
        stmt = (
            select(AiStudioBuild)
            .where(AiStudioBuild.project_id == project_id)
            .order_by(AiStudioBuild.version.desc())
        )
        if not include_archived:
            stmt = stmt.where(AiStudioBuild.archived_at.is_(None))
        try:
            return list(session.execute(stmt).scalars().all())
        except Exception as e:
            if _is_connection_error(e):
                return list(self._get_fresh_session().execute(stmt).scalars().all())
            raise

    def find_active_for_plan(
        self,
        project_id: str,
        render_config_hash: str,
    ) -> Optional[AiStudioBuild]:
        """Return any non-terminal build for (project, render_config_hash).

        Used by POST /projects/{id}/builds to dedup double-clicks: if a build
        with this plan snapshot is still PENDING or BUILDING, return it instead
        of forking a parallel one. AWAITING_EDIT / RENDERED / FAILED do NOT
        match — the user MAY legitimately want a fresh build from the same plan
        after refining one and wanting a clean fork.
        """
        session = self._get_session()
        stmt = (
            select(AiStudioBuild)
            .where(
                AiStudioBuild.project_id == project_id,
                AiStudioBuild.status.in_(("PENDING", "BUILDING")),
                AiStudioBuild.config["render_config_hash"].astext == render_config_hash,
            )
            .order_by(AiStudioBuild.created_at.desc())
            .limit(1)
        )
        try:
            return session.execute(stmt).scalar_one_or_none()
        except Exception as e:
            if _is_connection_error(e):
                return self._get_fresh_session().execute(stmt).scalar_one_or_none()
            raise

    # ── UPDATE ────────────────────────────────────────────────────────────

    def update_stage(
        self,
        build_id: str,
        *,
        build_stage: Optional[str] = None,
        progress: Optional[int] = None,
        stages: Optional[List[Dict[str, Any]]] = None,
        status: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """In-progress update during a build. Uses a fresh session — typically
        called from background tasks."""
        values: Dict[str, Any] = {}
        if build_stage is not None:
            values["build_stage"] = build_stage
        if progress is not None:
            values["progress"] = max(0, min(100, progress))
        if stages is not None:
            values["stages"] = stages
        if status is not None:
            values["status"] = status
        if error_message is not None:
            values["error_message"] = error_message
        if not values:
            return
        session = self._get_fresh_session()
        try:
            stmt = update(AiStudioBuild).where(AiStudioBuild.id == build_id).values(**values)
            session.execute(stmt)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Error updating studio build stage {build_id}: {e}")
        finally:
            session.close()

    def update_on_handoff(
        self,
        build_id: str,
        s3_urls: Dict[str, Any],
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Build executor completed — flip to AWAITING_EDIT and attach output
        artifact URLs. RENDERED is a later state set after the user clicks
        Render inside the editor and an MP4 lands."""
        session = self._get_fresh_session()
        try:
            values: Dict[str, Any] = {
                "status": "AWAITING_EDIT",
                "build_stage": "HANDOFF",
                "progress": 100,
                "s3_urls": s3_urls,
                "completed_at": datetime.utcnow(),
            }
            if extra_metadata is not None:
                values["extra_metadata"] = extra_metadata
            stmt = update(AiStudioBuild).where(AiStudioBuild.id == build_id).values(**values)
            session.execute(stmt)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Error handing off studio build {build_id}: {e}")
        finally:
            session.close()

    def update_on_render(
        self,
        build_id: str,
        video_url: str,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Editor finished rendering this build to MP4. s3_urls.video gets
        populated; status flips to RENDERED."""
        session = self._get_fresh_session()
        try:
            existing = session.get(AiStudioBuild, build_id)
            if existing is None:
                return
            urls = dict(existing.s3_urls or {})
            urls["video"] = video_url
            values: Dict[str, Any] = {
                "status": "RENDERED",
                "s3_urls": urls,
            }
            if extra_metadata is not None:
                # MERGE, don't replace: render passes only {render_job_id}, and a
                # full replace would wipe build-time metadata (entry_count,
                # total_duration, build name/notes, overlay_count). s3_urls above
                # is already merged — keep extra_metadata symmetric.
                meta = dict(existing.extra_metadata or {})
                meta.update(extra_metadata)
                values["extra_metadata"] = meta
            stmt = update(AiStudioBuild).where(AiStudioBuild.id == build_id).values(**values)
            session.execute(stmt)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Error marking studio build {build_id} rendered: {e}")
        finally:
            session.close()

    # ── DELETE (soft) ────────────────────────────────────────────────────

    def archive(self, build_id: str) -> bool:
        session = self._get_fresh_session()
        try:
            stmt = (
                update(AiStudioBuild)
                .where(AiStudioBuild.id == build_id)
                .values(archived_at=datetime.utcnow())
            )
            result = session.execute(stmt)
            session.commit()
            return (result.rowcount or 0) > 0
        except Exception as e:
            session.rollback()
            logger.error(f"Error archiving studio build {build_id}: {e}")
            raise
        finally:
            session.close()
