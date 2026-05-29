"""
SQLAlchemy model for Vimotion Studio builds — immutable versioned snapshots
of a Studio project's ConfirmedPlan at the moment Build was clicked.

Each build owns its own editor session (the /frame/* endpoints scope to
build_id) so the user can switch between Build v1 and Build v2 without
losing refinements on either.

Status flow: PENDING → BUILDING → AWAITING_EDIT → RENDERED | FAILED
Build stage:  PENDING → ASSEMBLE_AUDIO → ASSEMBLE_WORDS → ASSEMBLE_TIMELINE
              → COMPOSE_HTML → UPLOAD → HANDOFF → (RENDERED | FAILED)
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, Any
from uuid import uuid4

from sqlalchemy import Column, String, Text, Integer, DateTime, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB

from .ai_gen_video import Base


class AiStudioBuild(Base):
    """One versioned build snapshot of a Studio project.

    plan_snapshot is the immutable copy of the project's ConfirmedPlan at
    the time the user clicked Build. The project's plan can mutate after;
    this snapshot preserves "what this build was actually built from".
    """
    __tablename__ = "ai_studio_builds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4,
                server_default=text("gen_random_uuid()"))
    project_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    version = Column(Integer, nullable=False)

    # Frozen copy of ConfirmedPlan at Build time.
    plan_snapshot = Column(JSONB, nullable=False, default=dict,
                            server_default=text("'{}'::jsonb"))

    status = Column(String(32), nullable=False, default="PENDING", index=True)
    # PENDING | BUILDING | AWAITING_EDIT | RENDERED | FAILED
    build_stage = Column(String(64), nullable=False, default="PENDING")
    progress = Column(Integer, nullable=False, default=0, server_default=text("0"))

    # [{stage: 'ASSEMBLE_AUDIO', progress: 100}, ...] for FE stage-by-stage UI.
    stages = Column(JSONB, nullable=False, default=list,
                     server_default=text("'[]'::jsonb"))

    # { timeline, audio, words, video, thumbnail }.
    s3_urls = Column(JSONB, nullable=False, default=dict,
                      server_default=text("'{}'::jsonb"))
    # { aspect, fps, render_config_hash } — controls re-render + dedup.
    config = Column(JSONB, nullable=False, default=dict,
                     server_default=text("'{}'::jsonb"))
    # { live snapshot, cost digest, build-stage timings, ... }
    extra_metadata = Column('extra_metadata', JSONB, nullable=False, default=dict,
                             server_default=text("'{}'::jsonb"))
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow,
                         onupdate=datetime.utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return (
            f"<AiStudioBuild(id={self.id}, project={self.project_id}, "
            f"v{self.version}, status={self.status}, stage={self.build_stage})>"
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "project_id": str(self.project_id),
            "version": self.version,
            "plan_snapshot": self.plan_snapshot or {},
            "status": self.status,
            "build_stage": self.build_stage,
            "progress": self.progress or 0,
            "stages": self.stages or [],
            "s3_urls": self.s3_urls or {},
            "config": self.config or {},
            "extra_metadata": self.extra_metadata or {},
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "archived_at": self.archived_at.isoformat() if self.archived_at else None,
        }


# Composite indexes mirror the SQL migration for parity.
Index("uq_studio_build_version_orm", AiStudioBuild.project_id, AiStudioBuild.version, unique=True)
Index("idx_asb_project_status", AiStudioBuild.project_id, AiStudioBuild.status)
Index("idx_asb_project_created", AiStudioBuild.project_id, AiStudioBuild.created_at.desc())
