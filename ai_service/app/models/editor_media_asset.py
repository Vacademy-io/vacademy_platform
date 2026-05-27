"""
SQLAlchemy model for the AI video editor's saved media library.

Each row is a reusable image/video asset for an institute — uploaded,
generated with AI, or picked from a stock provider (Pexels/Pixabay) and
re-hosted to our S3. Auto-populated whenever a user inserts an asset via the
editor's media picker, so the Library tab shows recently-used media.
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, Any
from uuid import uuid4

<<<<<<< HEAD
from sqlalchemy import (
    Column, String, Text, Float, Integer, DateTime, Index, CheckConstraint, text,
)
=======
from sqlalchemy import Column, String, Text, Float, Integer, DateTime, Index, text
>>>>>>> origin
from sqlalchemy.dialects.postgresql import UUID, JSONB

from .ai_gen_video import Base


class EditorMediaAsset(Base):
    """A reusable media asset in an institute's editor library."""
    __tablename__ = "editor_media_asset"
<<<<<<< HEAD
    __table_args__ = (
        CheckConstraint("kind IN ('image', 'video')", name="editor_media_asset_kind_chk"),
        CheckConstraint(
            "source IN ('upload', 'pexels', 'pixabay', 'ai')",
            name="editor_media_asset_source_chk",
        ),
    )
=======
>>>>>>> origin

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4,
                server_default=text("gen_random_uuid()"))
    institute_id = Column(Text, nullable=False, index=True)
    created_by_user_id = Column(Text, nullable=True)

    url = Column(Text, nullable=False)
    thumb_url = Column(Text, nullable=True)

    kind = Column(String(16), nullable=False)    # 'image' | 'video'
    source = Column(String(16), nullable=False)  # 'upload' | 'pexels' | 'pixabay' | 'ai'

    prompt = Column(Text, nullable=True)         # for AI-generated assets
    source_url = Column(Text, nullable=True)     # provider page / attribution link
    photographer = Column(Text, nullable=True)

    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)

    tags = Column(JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb"))
    extra_metadata = Column('metadata', JSONB, nullable=False, default=dict,
                            server_default=text("'{}'::jsonb"))

    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<EditorMediaAsset(id={self.id}, kind={self.kind}, source={self.source})>"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "institute_id": self.institute_id,
            "created_by_user_id": self.created_by_user_id,
            "url": self.url,
            "thumb_url": self.thumb_url,
            "kind": self.kind,
            "source": self.source,
            "prompt": self.prompt,
            "source_url": self.source_url,
            "photographer": self.photographer,
            "width": self.width,
            "height": self.height,
            "duration": self.duration,
            "tags": self.tags or [],
            "metadata": self.extra_metadata or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


Index("idx_ema_institute", EditorMediaAsset.institute_id)
Index(
    "idx_ema_institute_kind_created",
    EditorMediaAsset.institute_id,
    EditorMediaAsset.kind,
    EditorMediaAsset.created_at.desc(),
)
