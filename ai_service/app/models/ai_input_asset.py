"""
SQLAlchemy model for AI Input Assets (videos + images).
Tracks user-uploaded assets being processed by the indexing pipeline for
metadata extraction. Videos produce transcript/visual context; images produce
caption/OCR/face/colors/foreground metadata.
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, Any
from uuid import uuid4

from sqlalchemy import Column, String, Text, Float, Integer, DateTime, Index, text
from sqlalchemy.dialects.postgresql import UUID, JSONB

from .ai_gen_video import Base


class AiInputAsset(Base):
    """
    Tracks input asset indexing lifecycle.

    Status flow: PENDING → QUEUED → PROCESSING → COMPLETED | FAILED
    Kind is fixed at creation: 'video' or 'image'. Mode is sub-mode within kind.
    """
    __tablename__ = "ai_input_assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4,
                server_default=text("gen_random_uuid()"))
    institute_id = Column(Text, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    kind = Column(String(16), nullable=False)
    mode = Column(String(20), nullable=False)
    status = Column(String(50), nullable=False, default="PENDING", index=True)
    source_url = Column(Text, nullable=False)

    # Video-only spatial descriptors. Images use width/height.
    duration_seconds = Column(Float, nullable=True)
    resolution = Column(Text, nullable=True)

    # Image-only spatial descriptors.
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)

    # Indexing output URLs (filled on completion).
    context_json_url = Column(Text, nullable=True)       # video: video_context.json
    spatial_db_url = Column(Text, nullable=True)         # video: video_spatial.sqlite
    image_metadata_url = Column(Text, nullable=True)     # image: image_metadata.json
    assets_urls = Column(JSONB, nullable=False, default=dict,
                         server_default=text("'{}'::jsonb"))

    # Render worker job tracking.
    render_job_id = Column(String(255), nullable=True)
    progress = Column(Integer, nullable=False, default=0, server_default=text("0"))
    error_message = Column(Text, nullable=True)

    extra_metadata = Column('metadata', JSONB, nullable=False, default=dict,
                            server_default=text("'{}'::jsonb"))

    created_by_user_id = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<AiInputAsset(id={self.id}, kind={self.kind}, name={self.name}, status={self.status})>"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "institute_id": self.institute_id,
            "name": self.name,
            "kind": self.kind,
            "mode": self.mode,
            "status": self.status,
            "source_url": self.source_url,
            "duration_seconds": self.duration_seconds,
            "resolution": self.resolution,
            "width": self.width,
            "height": self.height,
            "context_json_url": self.context_json_url,
            "spatial_db_url": self.spatial_db_url,
            "image_metadata_url": self.image_metadata_url,
            "assets_urls": self.assets_urls or {},
            "render_job_id": self.render_job_id,
            "progress": self.progress or 0,
            "error_message": self.error_message,
            "metadata": self.extra_metadata or {},
            "created_by_user_id": self.created_by_user_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


Index("idx_aia_institute", AiInputAsset.institute_id)
Index("idx_aia_status", AiInputAsset.status)
