"""
SQLAlchemy models for the content-translation pipeline (i18n Phase 1).

Both tables live in the admin_core_service database ai_service already connects
to; they are created by admin_core Flyway migration V384__Translation_pipeline.sql
(same ownership pattern as copy_check / ai_tool_pricing — no boot-time
ensure-schema here, the migration is the source of truth).

  • ai_translation_job — one row per translation job. Stage machine
    PENDING → EXTRACT → TRANSLATE → REVIEW → WRITE_BACK → COMPLETED, resumable
    by stage (translation_service.schedule_job). REVIEW parks the job with
    status AWAITING_INPUT when mode=DRAFT (mirrors ai_gen_video's assist gate);
    /translation/v1/job/{id}/approve resumes WRITE_BACK.
  • translation_memory — exact source-hash translation cache. A TM hit is
    served free; only LLM misses are billed. institute_id NULL = global row.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict
from uuid import uuid4

from sqlalchemy import Column, Integer, String, Text, DateTime, Index, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class TranslationJobStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    # Human gate: TRANSLATE finished in DRAFT mode; parked at REVIEW waiting on
    # /approve. Same semantics as ai_gen_video AWAITING_INPUT (clean pause, not
    # a failure).
    AWAITING_INPUT = "AWAITING_INPUT"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class TranslationJobStage(str, Enum):
    PENDING = "PENDING"
    EXTRACT = "EXTRACT"
    TRANSLATE = "TRANSLATE"
    REVIEW = "REVIEW"
    WRITE_BACK = "WRITE_BACK"
    COMPLETED = "COMPLETED"


class TranslationJobMode(str, Enum):
    DRAFT = "DRAFT"                # park at REVIEW; write back as DRAFT sidecars
    AUTO_PUBLISH = "AUTO_PUBLISH"  # skip REVIEW; write back as PUBLISHED sidecars


class AiTranslationJob(Base):
    """One course/package-session translation job (see V384)."""

    __tablename__ = "ai_translation_job"

    id = Column(String(255), primary_key=True, default=lambda: str(uuid4()))
    institute_id = Column(String(255), nullable=False, index=True)
    package_session_id = Column(String(255), nullable=True, index=True)
    source_locale = Column(String(10), nullable=False, default="en")
    target_locale = Column(String(10), nullable=False)
    scope = Column(String(40), nullable=False)
    mode = Column(String(20), nullable=False, default=TranslationJobMode.DRAFT.value)
    status = Column(String(30), nullable=False, default=TranslationJobStatus.PENDING.value, index=True)
    current_stage = Column(String(30), nullable=False, default=TranslationJobStage.PENDING.value)
    items_total = Column(Integer, nullable=True)
    items_done = Column(Integer, nullable=False, default=0)
    # {manifest: [...], translations: {item_id: {...}}, failed_items: [...],
    #  rejected_items: [...], write_back: {...}} — written once per stage (the
    #  per-item progress ticks only touch items_done, so a big course doesn't
    #  rewrite a multi-MB JSONB on every item).
    artifacts = Column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    error_message = Column(Text, nullable=True)
    created_by = Column(String(255), nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return (
            f"<AiTranslationJob(id={self.id}, target={self.target_locale}, "
            f"stage={self.current_stage}, status={self.status})>"
        )

    def to_status_dict(self) -> Dict[str, Any]:
        """snake_case status payload for GET /translation/v1/job/{id}."""
        artifacts = self.artifacts or {}
        return {
            "job_id": self.id,
            "institute_id": self.institute_id,
            "package_session_id": self.package_session_id,
            "source_locale": self.source_locale,
            "target_locale": self.target_locale,
            "scope": self.scope,
            "mode": self.mode,
            "status": self.status,
            "current_stage": self.current_stage,
            "items_total": self.items_total,
            "items_done": self.items_done,
            "failed_items": artifacts.get("failed_items") or [],
            "write_back": artifacts.get("write_back"),
            "error_message": self.error_message,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class TranslationMemory(Base):
    """Exact-hash translation cache (see V384). institute_id NULL = global."""

    __tablename__ = "translation_memory"

    id = Column(String(255), primary_key=True, default=lambda: str(uuid4()))
    institute_id = Column(String(255), nullable=True)
    source_locale = Column(String(10), nullable=False)
    target_locale = Column(String(10), nullable=False)
    source_hash = Column(String(64), nullable=False)
    source_text = Column(Text, nullable=False)
    target_text = Column(Text, nullable=False)
    quality = Column(String(20), nullable=False, default="AI")
    domain = Column(String(40), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self) -> str:
        return (
            f"<TranslationMemory({self.source_locale}->{self.target_locale}, "
            f"hash={self.source_hash[:8] if self.source_hash else None})>"
        )


Index("idx_translation_memory_lookup", TranslationMemory.source_hash, TranslationMemory.target_locale)
Index("idx_ai_translation_job_status", AiTranslationJob.status)
Index("idx_ai_translation_job_ps", AiTranslationJob.package_session_id)
