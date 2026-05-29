"""
SQLAlchemy model for Vimotion Studio projects — persistent multi-asset edit
contexts that can fork many versioned builds over time.

Sibling of ai_gen_video (text→video) and ai_reels (long→short) — same {meta,
entries} timeline contract for downstream editor + render-worker consumption,
but a different planning model: per-step wizard ConfirmedPlan, mutable across
re-plans, snapshotted into ai_studio_builds at Build time.

Status flow:  DRAFT → PLANNING → READY_TO_BUILD → BUILDING → PUBLISHED → ARCHIVED
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, Any
from uuid import uuid4

from sqlalchemy import Column, String, Text, Integer, DateTime, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB

from .ai_gen_video import Base


class AiStudioProject(Base):
    """One Studio project — the persistent context the wizard mutates.

    Each project references N indexed input assets (videos + images) and
    holds the user's prompt + per-step ConfirmedPlan dict. A project can
    spawn many AiStudioBuild rows; the user picks one as `published`.
    """
    __tablename__ = "ai_studio_projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4,
                server_default=text("gen_random_uuid()"))
    institute_id = Column(Text, nullable=False, index=True)
    name = Column(String(160), nullable=True)

    # [{asset_id, handle:"v1", kind:"video"|"image", mode}].
    source_asset_refs = Column(JSONB, nullable=False, default=list,
                                server_default=text("'[]'::jsonb"))

    user_prompt = Column(Text, nullable=True)
    target_aspect = Column(String(8), nullable=True)
    target_duration_s = Column(Integer, nullable=True)

    # Per-step ConfirmedStepPlan dict keyed by wizard step
    # ("arrangement" | "cuts" | "overlays" | "audio"). Empty until the first
    # step is confirmed; mutable as the user advances or re-plans.
    confirmed_plan = Column(JSONB, nullable=False, default=dict,
                             server_default=text("'{}'::jsonb"))

    # FK to ai_studio_builds.id — the "published" build. Nullable. SET NULL
    # if that build is deleted (project survives).
    published_build_id = Column(UUID(as_uuid=True), nullable=True)

    status = Column(String(32), nullable=False, default="DRAFT", index=True)
    # DRAFT | PLANNING | READY_TO_BUILD | BUILDING | PUBLISHED | ARCHIVED

    # Snapshot of tier + model_overrides at project create time so re-plans
    # use consistent config across the project's lifetime.
    config = Column(JSONB, nullable=False, default=dict,
                     server_default=text("'{}'::jsonb"))
    # 'metadata' is reserved by SQLAlchemy — map to extra_metadata in Python.
    extra_metadata = Column('extra_metadata', JSONB, nullable=False, default=dict,
                             server_default=text("'{}'::jsonb"))
    error_message = Column(Text, nullable=True)

    created_by_user_id = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow,
                         onupdate=datetime.utcnow)
    archived_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<AiStudioProject(id={self.id}, status={self.status}, name={self.name!r})>"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "institute_id": self.institute_id,
            "name": self.name,
            "source_asset_refs": self.source_asset_refs or [],
            "user_prompt": self.user_prompt,
            "target_aspect": self.target_aspect,
            "target_duration_s": self.target_duration_s,
            "confirmed_plan": self.confirmed_plan or {},
            "published_build_id": str(self.published_build_id) if self.published_build_id else None,
            "status": self.status,
            "config": self.config or {},
            "extra_metadata": self.extra_metadata or {},
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "archived_at": self.archived_at.isoformat() if self.archived_at else None,
        }


# Indexes (defined out-of-line so they're picked up regardless of import order).
Index("idx_asp_institute", AiStudioProject.institute_id)
Index("idx_asp_status", AiStudioProject.status)
Index("idx_asp_institute_created", AiStudioProject.institute_id, AiStudioProject.created_at.desc())
