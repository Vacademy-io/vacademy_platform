"""
Schemas for AI Video Generation API.
"""
from __future__ import annotations

from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


# Content types supported by the generation pipeline
ContentTypeEnum = Literal[
    "VIDEO",              # Time-synced HTML overlays with audio (default)
    "QUIZ",               # Question-based assessments  
    "STORYBOOK",          # Page-by-page narratives
    "INTERACTIVE_GAME",   # Self-contained HTML games
    "PUZZLE_BOOK",        # Collection of puzzles
    "SIMULATION",         # Physics/economic sandboxes
    "FLASHCARDS",         # Spaced-repetition cards
    "MAP_EXPLORATION",    # Interactive SVG maps
    # New content types
    "WORKSHEET",          # Printable/interactive homework
    "CODE_PLAYGROUND",    # Interactive code exercises
    "TIMELINE",           # Chronological event visualization
    "CONVERSATION"        # Language learning dialogues
]


class VideoGenerationRequest(BaseModel):
    """Request for generating AI video or interactive content."""
    
    prompt: str = Field(..., description="Text prompt for content generation")
    content_type: ContentTypeEnum = Field(
        default="VIDEO",
        description="Type of content to generate. Determines navigation mode and required libraries."
    )
    language: str = Field(default="English", description="Language for content (e.g., English, Spanish, French)")
    captions_enabled: bool = Field(default=True, description="Enable/disable captions (primarily for VIDEO type)")
    html_quality: str = Field(default="advanced", description="HTML quality mode: 'classic' (frames/animation only) or 'advanced' (all features)")
    video_id: Optional[str] = Field(default=None, description="Optional content ID (generated if not provided)")
    target_audience: str = Field(
        default="General/Adult", 
        description="Target audience for age-appropriate content. Examples: 'Class 3 (Ages 7-8)', 'Class 9-10 (Ages 14-15)', 'College/Adult'"
    )
    target_duration: str = Field(
        default="2-3 minutes", 
        description="Target duration for VIDEO type. For other types, controls content length."
    )
    institute_id: Optional[str] = Field(
        default=None,
        description="Institute identifier (optional, for logging/context)"
    )
    user_id: Optional[str] = Field(
        default=None,
        description="User identifier (optional, for logging/context)"
    )
    model: Optional[str] = Field(
        default=None, 
        description="AI Model to use for generation (e.g. 'xiaomi/mimo-v2-flash:free')"
    )
    voice_gender: str = Field(
        default="female",
        description="Voice gender for TTS (VIDEO/STORYBOOK): 'male' or 'female'. Default is 'female'."
    )
    tts_provider: str = Field(
        default="edge",
        description="TTS Provider: 'edge' (Microsoft Edge TTS, default) or 'google' (Google Cloud TTS)."
    )
    generate_avatar: bool = Field(
        default=False,
        description="Whether to generate a talking head avatar. Defaults to False."
    )
    avatar_image_url: Optional[str] = Field(
        default=None,
        description="URL of a face/portrait image for the speaking avatar. If not provided, a default teacher image is used. Only applies to VIDEO content type."
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "prompt": "Explain the concept of quantum entanglement to a 5 year old",
                "content_type": "VIDEO",
                "language": "English",
                "captions_enabled": True,
                "html_quality": "advanced",
                "video_id": "quantum-entanglement-101",
                "target_audience": "Class 3 (Ages 7-8)",
                "target_duration": "5 minutes",
                "voice_gender": "female",
                "tts_provider": "edge",
                "avatar_image_url": None
            }
        }


class VideoGenerationResumeRequest(BaseModel):
    """Request for resuming video generation from a checkpoint."""
    
    video_id: str = Field(..., description="Video ID to resume")
    generate_avatar: bool = Field(
        default=False,
        description="Whether to generate a talking head avatar. Defaults to False."
    )
    avatar_image_url: Optional[str] = Field(
        default=None,
        description="URL of a face/portrait image for the speaking avatar. If not provided, a default teacher image is used."
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "video_id": "quantum-entanglement-101",
                "avatar_image_url": None
            }
        }


class VideoStatusResponse(BaseModel):
    """Response for video/content generation status."""
    
    id: str
    video_id: str
    current_stage: str
    status: str
    content_type: str = Field(default="VIDEO", description="Content type: VIDEO, QUIZ, STORYBOOK, etc.")
    file_ids: Dict[str, str]
    s3_urls: Dict[str, str]
    prompt: Optional[str]
    language: str
    error_message: Optional[str]
    metadata: Dict[str, Any]
    created_at: Optional[str]
    updated_at: Optional[str]
    completed_at: Optional[str]
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "video_id": "quantum-entanglement-101",
                "current_stage": "HTML",
                "status": "COMPLETED",
                "content_type": "VIDEO",
                "file_ids": {
                    "script": "file-uuid-1",
                    "audio": "file-uuid-2",
                    "words": "file-uuid-3",
                    "timeline": "file-uuid-4"
                },
                "s3_urls": {
                    "script": "https://bucket.s3.amazonaws.com/ai-videos/quantum-entanglement-101/script/script.txt",
                    "audio": "https://bucket.s3.amazonaws.com/ai-videos/quantum-entanglement-101/audio/narration.mp3",
                    "words": "https://bucket.s3.amazonaws.com/ai-videos/quantum-entanglement-101/words/narration.words.json",
                    "timeline": "https://bucket.s3.amazonaws.com/ai-videos/quantum-entanglement-101/timeline/time_based_frame.json"
                },
                "prompt": "Explain the concept of quantum entanglement to a 5 year old",
                "language": "English",
                "error_message": None,
                "metadata": {},
                "created_at": "2024-01-15T10:30:00Z",
                "updated_at": "2024-01-15T10:35:00Z",
                "completed_at": "2024-01-15T10:35:00Z"
            }
        }


class VideoUrlsResponse(BaseModel):
    """Response for video HTML and audio URLs."""
    
    video_id: str
    html_url: Optional[str] = Field(None, description="URL to HTML timeline file (time_based_frame.json)")
    audio_url: Optional[str] = Field(None, description="URL to audio file (narration.mp3)")
    words_url: Optional[str] = Field(None, description="URL to time-synced words JSON for captions")
    avatar_url: Optional[str] = Field(None, description="URL to avatar talking-head video (MP4)")
    status: str = Field(..., description="Current video generation status")
    current_stage: str = Field(..., description="Current generation stage")
    
    class Config:
        json_schema_extra = {
            "example": {
                "video_id": "quantum-entanglement-101",
                "html_url": "https://bucket.s3.amazonaws.com/ai-videos/quantum-entanglement-101/timeline/time_based_frame.json",
                "audio_url": "https://bucket.s3.amazonaws.com/ai-videos/quantum-entanglement-101/audio/narration.mp3",
                "words_url": "https://bucket.s3.amazonaws.com/ai-videos/quantum-entanglement-101/audio/words.json",
                "avatar_url": None,
                "status": "COMPLETED",
                "current_stage": "HTML"
            }
        }


class RegenerateFrameRequest(BaseModel):
    """Request for regenerating a specific frame's HTML."""
    video_id: str = Field(..., description="Video ID")
    timestamp: float = Field(..., description="Timestamp of the frame in seconds")
    user_prompt: str = Field(..., description="User's instruction for modification")
    institute_id: Optional[str] = Field(None, description="Institute ID (optional)")


class RegenerateFrameResponse(BaseModel):
    """Response with new HTML content."""
    video_id: str
    frame_index: int
    timestamp: float
    original_html: str
    new_html: str


class UpdateFrameRequest(BaseModel):
    """Request for updating a specific frame's HTML."""
    video_id: str = Field(..., description="Video ID")
    frame_index: int = Field(..., description="Index of the frame to update")
    new_html: str = Field(..., description="New HTML content")
