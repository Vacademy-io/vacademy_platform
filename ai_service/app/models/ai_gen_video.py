"""
SQLAlchemy model for AI Generated Video tracking.
This model connects to the admin-core-service database.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import uuid4
from enum import Enum

from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    Index,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class ContentType(str, Enum):
    """
    Content types supported by the AI generation pipeline.
    
    Each type determines:
    - How the frontend navigates between entries (time-driven vs user-driven)
    - Which libraries are injected (GSAP, Matter.js, Swiper, etc.)
    - The structure of entry_meta in the timeline JSON
    """
    VIDEO = "VIDEO"                       # Time-synced HTML overlays with audio (default)
    QUIZ = "QUIZ"                         # Question-based assessments
    STORYBOOK = "STORYBOOK"               # Page-by-page narratives
    INTERACTIVE_GAME = "INTERACTIVE_GAME" # Self-contained HTML games
    PUZZLE_BOOK = "PUZZLE_BOOK"           # Collection of puzzles
    SIMULATION = "SIMULATION"             # Physics/economic sandboxes
    FLASHCARDS = "FLASHCARDS"             # Spaced-repetition cards
    MAP_EXPLORATION = "MAP_EXPLORATION"   # Interactive SVG maps
    # New content types
    WORKSHEET = "WORKSHEET"               # Printable/interactive homework
    CODE_PLAYGROUND = "CODE_PLAYGROUND"   # Interactive code exercises
    TIMELINE = "TIMELINE"                 # Chronological event visualization
    CONVERSATION = "CONVERSATION"         # Language learning dialogues


class NavigationType(str, Enum):
    """
    How the frontend navigates between timeline entries.
    """
    TIME_DRIVEN = "time_driven"           # Synced with audio playback (VIDEO)
    USER_DRIVEN = "user_driven"           # User clicks prev/next (QUIZ, STORYBOOK)
    SELF_CONTAINED = "self_contained"     # Single entry, internal state (GAME)


class AiGenVideo(Base):
    """
    Tracks AI-generated video creation progress and associated files.
    
    Stages: PENDING -> SCRIPT -> TTS -> WORDS -> HTML -> RENDER -> COMPLETED
    Status: PENDING, IN_PROGRESS, COMPLETED, FAILED
    """
    __tablename__ = "ai_gen_video"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, server_default=text("gen_random_uuid()"))
    video_id = Column(String(255), nullable=False, unique=True, index=True)
    
    # Current stage of video generation
    current_stage = Column(String(50), nullable=False, default="PENDING", index=True)
    
    # Overall status
    status = Column(String(50), nullable=False, default="PENDING", index=True)
    
    # JSON objects for file tracking
    file_ids = Column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    s3_urls = Column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    
    # Generation details
    prompt = Column(Text, nullable=True)
    language = Column(String(50), nullable=False, default="English")
    
    # Content type for multi-format support (VIDEO, QUIZ, STORYBOOK, etc.)
    # VIDEO is the default for backward compatibility
    content_type = Column(String(50), nullable=False, default="VIDEO", index=True)
    
    error_message = Column(Text, nullable=True)
    
    # Additional metadata (can store generation options, resolution, etc.)
    # Using 'extra_metadata' as Python attribute, mapped to 'metadata' column in DB
    extra_metadata = Column('metadata', JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self) -> str:
        return f"<AiGenVideo(video_id={self.video_id}, stage={self.current_stage}, status={self.status})>"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary for API responses."""
        return {
            "id": str(self.id),
            "video_id": self.video_id,
            "current_stage": self.current_stage,
            "status": self.status,
            "content_type": self.content_type or "VIDEO",
            "file_ids": self.file_ids or {},
            "s3_urls": self.s3_urls or {},
            "prompt": self.prompt,
            "language": self.language,
            "error_message": self.error_message,
            "metadata": self.extra_metadata or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


# Create indexes (these are also in the migration, but defining here for ORM awareness)
Index("idx_ai_gen_video_video_id", AiGenVideo.video_id)
Index("idx_ai_gen_video_status", AiGenVideo.status)
Index("idx_ai_gen_video_current_stage", AiGenVideo.current_stage)
Index("idx_ai_gen_video_created_at", AiGenVideo.created_at)
Index("idx_ai_gen_video_content_type", AiGenVideo.content_type)

