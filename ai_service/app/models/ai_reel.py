"""
SQLAlchemy model for AI-generated Reels (short-form clips from indexed source
videos via the reels-from-long-video pipeline).

Sibling of ai_gen_video (NOT inheriting from it) — different stage names,
different config schema, different cost accounting — but produces the same
{meta, entries} timeline contract the editor and render worker consume.

Status flow: PENDING → IN_PROGRESS → COMPLETED | FAILED
Stage flow:  PENDING → AUDIO_EDIT → SOURCE_CLIP → STYLE_GUIDE → DIRECTOR
             → HTML → ASSEMBLE → RENDER → COMPLETED | FAILED
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, Any
from uuid import uuid4

from sqlalchemy import Column, String, Text, Integer, DateTime, Index, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB

from .ai_gen_video import Base


class AiReel(Base):
    """One AI-generated reel, sourced from a single indexed input asset.

    Created when the user confirms Gate 3 (POST /reels/render). Each row
    references the source ai_input_assets row and the originating
    ai_reel_candidates row that the scorer + LLM enrichment produced.
    """
    __tablename__ = "ai_reels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4,
                server_default=text("gen_random_uuid()"))
    reel_id = Column(String(255), nullable=False, unique=True, index=True)
    institute_id = Column(Text, nullable=False, index=True)
    input_asset_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    parent_candidate_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    status = Column(String(50), nullable=False, default="PENDING", index=True)
    current_stage = Column(String(50), nullable=False, default="PENDING")
    progress = Column(Integer, nullable=False, default=0, server_default=text("0"))
    error_message = Column(Text, nullable=True)

    # Full RenderRequest as-submitted — audit + re-render.
    config = Column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    # {t_start, t_end, original_duration_s} in source video coordinates.
    source_window = Column(JSONB, nullable=False, default=dict,
                            server_default=text("'{}'::jsonb"))
    # List of {orig_t_start, orig_t_end, new_t_start, new_t_end} kept spans.
    # Populated by AUDIO_EDIT stage; nullable until then.
    trim_map = Column(JSONB, nullable=True)

    # Per-stage progress for FE stage-by-stage display (§13.11).
    # Shape: [{stage: 'AUDIO_EDIT', progress: 100}, ...]
    stages = Column(JSONB, nullable=False, default=list,
                     server_default=text("'[]'::jsonb"))

    # {speaker_clip, speaker_fg, time_based_frame, video, captions, ...}
    s3_urls = Column(JSONB, nullable=False, default=dict,
                      server_default=text("'{}'::jsonb"))
    # Token usage, model versions, scoring breakdown, render duration, etc.
    extra_metadata = Column('metadata', JSONB, nullable=False, default=dict,
                             server_default=text("'{}'::jsonb"))

    created_by_user_id = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow,
                         onupdate=datetime.utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<AiReel(reel_id={self.reel_id}, status={self.status}, stage={self.current_stage})>"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "reel_id": self.reel_id,
            "institute_id": self.institute_id,
            "input_asset_id": str(self.input_asset_id),
            "candidate_id": str(self.parent_candidate_id) if self.parent_candidate_id else None,
            "status": self.status,
            "current_stage": self.current_stage,
            "progress": self.progress or 0,
            "stages": self.stages or [],
            "error_message": self.error_message,
            "config": self.config or {},
            "source_window": self.source_window or {},
            "trim_map": self.trim_map,
            "s3_urls": self.s3_urls or {},
            "metadata": self.extra_metadata or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


# Indexes (defined out-of-line so they're picked up regardless of import order).
Index("idx_ar_institute", AiReel.institute_id)
Index("idx_ar_input_asset", AiReel.input_asset_id)
Index("idx_ar_status", AiReel.status)
Index("idx_ar_institute_created", AiReel.institute_id, AiReel.created_at.desc())
