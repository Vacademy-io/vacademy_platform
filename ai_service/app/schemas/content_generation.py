from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ContentGenerationRequest(BaseModel):
    """
    Request schema for generating content from an existing coursetree.
    Frontend will call this endpoint with the coursetree from the outline API.
    
    You can send either:
    1. Full outline response: {"explanation": "...", "tree": [...], "todos": [...], "courseMetadata": {...}}
    2. Just todos: {"todos": [...]}
    3. Direct todos array: [...]
    
    The endpoint will extract and use only the todos array.
    """
    course_tree: dict = Field(
        ...,
        description="Course tree JSON from outline API response. Can be full response or just {'todos': [...]}. Only 'todos' array is used."
    )
    institute_id: Optional[str] = Field(
        default=None,
        description="Institute identifier (optional, for logging/context)"
    )
    user_id: Optional[str] = Field(
        default=None,
        description="User identifier (optional, for logging/context)"
    )
    language: Optional[str] = Field(
        default="English",
        description="Language for content generation (e.g. 'English', 'Hindi', 'Spanish', 'French', 'Arabic')"
    )
    generation_run_id: Optional[str] = Field(
        default=None,
        max_length=64,
        description=(
            "Client-minted id, stable across transport retries of the same run. "
            "Keys idempotent per-slide credit charges so a retried request never "
            "double-bills already-generated slides."
        ),
    )
    video_settings: Optional[dict] = Field(
        default=None,
        description=(
            "Course-level AI-video settings applied to AI_VIDEO / AI_VIDEO_CODE / "
            "AI_SLIDES / AI_STORYBOOK todos (override auto-injected defaults for "
            "these todos). Recognized keys: model, voice_gender, voice_id, "
            "tts_provider, quality_tier, target_duration, language (video-narration "
            "language, e.g. 'English (India)', 'Hindi' — drives the TTS voice)."
        ),
    )
    model: Optional[str] = Field(
        default=None,
        description=(
            "The LLM the user chose when creating the course. Applied to EVERY "
            "content leg (documents, assessments, code) unless a per-todo or "
            "per-family override says otherwise. Omit (or send nothing) to let "
            "each content type use its own tuned default."
        ),
    )
    document_settings: Optional[dict] = Field(
        default=None,
        description=(
            "Course-level document settings applied to every DOCUMENT (HTML) todo. "
            "Key: content_types — a list of enrichments to weave into each generated "
            "document page: notes, flashcards, practical_examples, interactive_games, quiz."
        ),
    )
    reference_document_file_ids: Optional[list] = Field(
        default=None,
        description=(
            "Media fileIds of the uploaded reference PDFs (same ones sent to the "
            "outline). Their real figures are made available to DOCUMENT slides so "
            "the generator can embed the actual diagrams/tables instead of "
            "AI-generated stand-ins."
        ),
    )
    kb_grounding: Optional[dict] = Field(
        default=None,
        description=(
            "Knowledge base grounding for this course, the same object the outline "
            "received: {knowledge_base_id, node_ids, mode}. Each slide retrieves "
            "the passages about its own topic instead of writing from model "
            "knowledge, and carries the page it came from."
        ),
    )


__all__ = ["ContentGenerationRequest"]



