"""
SQLAlchemy model for AI Reel Candidates — Gate 1 scan results with TTL.

A candidate is a (source_window, score, breakdown) tuple produced by the
engagement scorer over an indexed input video. Gate 2 (/preview) enriches
the row with LLM-derived word_importance + cut_plan + rationale + title.
Gate 3 (/render) references a candidate by id to produce an AiReel.

We persist candidates so:
- /preview can reference them by candidate_id (avoids large client echoes).
- /render can fetch the locked-in cut_plan instead of recomputing it.
- /scan can be idempotent within the TTL via config_hash + input_asset_id.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Any
from uuid import uuid4

from sqlalchemy import Column, String, Text, Integer, DateTime, Float, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB

from .ai_gen_video import Base


class AiReelCandidate(Base):
    """One scan candidate. TTL'd row — auto-expires 24h after creation."""
    __tablename__ = "ai_reel_candidates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4,
                server_default=text("gen_random_uuid()"))
    institute_id = Column(Text, nullable=False, index=True)
    input_asset_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # SHA-256 of (input_asset_id + scan-request fields) — enables /scan
    # idempotency: a re-scan with identical config returns cached rows when
    # they haven't expired yet.
    config_hash = Column(String(64), nullable=False, index=True)

    rank = Column(Integer, nullable=False)

    # Source video window (original, pre-cut).
    source_t_start = Column(Float, nullable=False)
    source_t_end = Column(Float, nullable=False)
    source_duration_s = Column(Float, nullable=False)
    predicted_output_duration_s = Column(Float, nullable=False)

    # Composite + axis scores + per-axis breakdown (ScoreAxes + ScoreBreakdown).
    score = Column(JSONB, nullable=False)
    breakdown = Column(JSONB, nullable=False, default=dict,
                        server_default=text("'{}'::jsonb"))

    # First sentence + … + last sentence of the window, ≤140 chars.
    transcript_snippet = Column(Text, nullable=False)

    # 3-second thumbnail strip URL (sprite or short mp4) — filled by the
    # thumbnail service when the candidate is materialized.
    thumbnail_strip_url = Column(Text, nullable=True)

    # Populated by Gate 2 (/preview) — null until then.
    # {title, rationale, word_importance: [...], cut_plan: [...]}
    enriched = Column(JSONB, nullable=True)

    # 24h after creation. Reaper job (later phase) deletes expired rows.
    ttl_at = Column(DateTime(timezone=True), nullable=False,
                    default=lambda: datetime.utcnow() + timedelta(hours=24))
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    def __repr__(self) -> str:
        return (
            f"<AiReelCandidate(id={self.id}, asset={self.input_asset_id}, "
            f"rank={self.rank}, t={self.source_t_start:.1f}-{self.source_t_end:.1f})>"
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "candidate_id": str(self.id),
            "rank": self.rank,
            "source_t_start": self.source_t_start,
            "source_t_end": self.source_t_end,
            "source_duration_s": self.source_duration_s,
            "predicted_output_duration_s": self.predicted_output_duration_s,
            "score": self.score or {},
            "breakdown": self.breakdown or {},
            "transcript_snippet": self.transcript_snippet,
            "thumbnail_strip_url": self.thumbnail_strip_url,
            "low_confidence": bool(
                isinstance(self.score, dict) and (self.score.get("composite") or 0) < 60
            ),
            "enriched": self.enriched,
            "ttl_at": self.ttl_at.isoformat() if self.ttl_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# Composite index for the most common lookup: cache hit during /scan
# (input_asset + config_hash + rank ordering).
Index(
    "idx_arc_lookup",
    AiReelCandidate.input_asset_id,
    AiReelCandidate.config_hash,
    AiReelCandidate.rank,
)
Index("idx_arc_ttl", AiReelCandidate.ttl_at)
