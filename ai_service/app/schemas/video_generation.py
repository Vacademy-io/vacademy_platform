"""
Schemas for AI Video Generation API.
"""
from __future__ import annotations

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class VideoGenerationRequest(BaseModel):
    """Request for generating AI video."""
    
    prompt: str = Field(..., description="Text prompt for video generation")
    language: str = Field(default="English", description="Language for video content (e.g., English, Spanish, French)")
    captions_enabled: bool = Field(default=True, description="Enable/disable captions in the video")
    html_quality: str = Field(default="advanced", description="HTML quality mode: 'classic' (frames/animation only) or 'advanced' (all features)")
    video_id: Optional[str] = Field(default=None, description="Optional video ID (generated if not provided)")
    target_audience: str = Field(
        default="General/Adult", 
        description="Target audience for age-appropriate content. Examples: 'Class 3 (Ages 7-8)', 'Class 9-10 (Ages 14-15)', 'College/Adult'"
    )
    target_duration: str = Field(
        default="2-3 minutes", 
        description="Target video duration. Examples: '2-3 minutes', '5 minutes', '7 minutes', '10 minutes'"
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
    
    class Config:
        json_schema_extra = {
            "example": {
                "prompt": "Explain the concept of quantum entanglement to a 5 year old",
                "language": "English",
                "captions_enabled": True,
                "html_quality": "advanced",
                "video_id": "quantum-entanglement-101",
                "target_audience": "Class 3 (Ages 7-8)",
                "target_duration": "5 minutes"
            }
        }


class VideoGenerationResumeRequest(BaseModel):
    """Request for resuming video generation from a checkpoint."""
    
    video_id: str = Field(..., description="Video ID to resume")
    
    class Config:
        json_schema_extra = {
            "example": {
                "video_id": "quantum-entanglement-101"
            }
        }


class VideoStatusResponse(BaseModel):
    """Response for video generation status."""
    
    id: str
    video_id: str
    current_stage: str
    status: str
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
    status: str = Field(..., description="Current video generation status")
    current_stage: str = Field(..., description="Current generation stage")
    
    class Config:
        json_schema_extra = {
            "example": {
                "video_id": "quantum-entanglement-101",
                "html_url": "https://bucket.s3.amazonaws.com/ai-videos/quantum-entanglement-101/timeline/time_based_frame.json",
                "audio_url": "https://bucket.s3.amazonaws.com/ai-videos/quantum-entanglement-101/audio/narration.mp3",
                "words_url": "https://bucket.s3.amazonaws.com/ai-videos/quantum-entanglement-101/audio/words.json",
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
