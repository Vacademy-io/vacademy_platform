"""SQLAlchemy model for vision_review_cases — the per-shot defect bank.

One row per shot whose generated HTML was flagged by the vision reviewer (or
its corrective regen). Used by engineers to identify systemic prompt-quality
issues over a sliding window and feed those findings back into base-prompt
updates.

Schema sibling: app/migrations/add_vision_review_cases.sql
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

from .ai_gen_video import Base


class VisionReviewCase(Base):
    """One reviewer outcome per flagged shot. Append-only — never updated."""

    __tablename__ = "vision_review_cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, server_default=text("gen_random_uuid()"))

    # Locator
    video_id = Column(String(64), nullable=False, index=True)
    shot_idx = Column(Integer, nullable=False)
    shot_type = Column(String(64), nullable=True, index=True)
    quality_tier = Column(String(32), nullable=False, index=True)
    prompt_version = Column(String(32), nullable=True)

    # Reviewer outcome
    issue_codes = Column(ARRAY(Text), nullable=False, server_default=text("'{}'::text[]"))
    severity_max = Column(Integer, nullable=False, index=True)
    shipped = Column(String(16), nullable=False)

    # Artifacts
    original_html_url = Column(Text, nullable=True)
    regen_html_url = Column(Text, nullable=True)
    screenshots_pre_urls = Column(ARRAY(Text), nullable=True)
    screenshots_post_urls = Column(ARRAY(Text), nullable=True)

    # Raw reviewer responses
    reviewer_pre_json = Column(JSONB, nullable=False)
    reviewer_post_json = Column(JSONB, nullable=True)

    # Cost / latency
    review_ms = Column(Integer, nullable=True)
    review_cost_usd = Column(Numeric(10, 6), nullable=True)
    regen_ms = Column(Integer, nullable=True)
    regen_cost_usd = Column(Numeric(10, 6), nullable=True)

    # Context
    shot_meta = Column(JSONB, nullable=True)
    shot_pack = Column(JSONB, nullable=True)
    host_present = Column(Boolean, nullable=False, default=False, server_default=text("false"))

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

    def __repr__(self) -> str:
        return (
            f"<VisionReviewCase(video_id={self.video_id}, shot_idx={self.shot_idx}, "
            f"sev={self.severity_max}, codes={self.issue_codes}, shipped={self.shipped})>"
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "video_id": self.video_id,
            "shot_idx": self.shot_idx,
            "shot_type": self.shot_type,
            "quality_tier": self.quality_tier,
            "prompt_version": self.prompt_version,
            "issue_codes": list(self.issue_codes or []),
            "severity_max": self.severity_max,
            "shipped": self.shipped,
            "original_html_url": self.original_html_url,
            "regen_html_url": self.regen_html_url,
            "screenshots_pre_urls": list(self.screenshots_pre_urls or []),
            "screenshots_post_urls": list(self.screenshots_post_urls or []) if self.screenshots_post_urls is not None else None,
            "reviewer_pre_json": self.reviewer_pre_json,
            "reviewer_post_json": self.reviewer_post_json,
            "review_ms": self.review_ms,
            "review_cost_usd": float(self.review_cost_usd) if self.review_cost_usd is not None else None,
            "regen_ms": self.regen_ms,
            "regen_cost_usd": float(self.regen_cost_usd) if self.regen_cost_usd is not None else None,
            "shot_meta": self.shot_meta,
            "shot_pack": self.shot_pack,
            "host_present": bool(self.host_present),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# Index aliases mirroring the migration so ORM tooling discovers them.
Index("idx_vrc_video_id", VisionReviewCase.video_id)
Index("idx_vrc_quality_tier", VisionReviewCase.quality_tier)
Index("idx_vrc_shot_type", VisionReviewCase.shot_type)
Index("idx_vrc_severity_max", VisionReviewCase.severity_max)
Index("idx_vrc_created_at", VisionReviewCase.created_at)
