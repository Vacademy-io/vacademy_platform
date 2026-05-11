"""
Schemas for AI Video Generation API.
"""
from __future__ import annotations

import logging
from typing import Optional, Dict, Any, List, Literal
from pydantic import BaseModel, Field, model_validator

_log = logging.getLogger(__name__)


class VideoCostPreviewRequest(BaseModel):
    """
    Request for the pre-generation credit/cost preview. Mirrors VideoGenerationRequest
    but allows omitting prompt/files (estimate is heuristic, doesn't need them).
    """
    quality_tier: str = "ultra"
    model: Optional[str] = None
    target_duration: str = "2-3 minutes"
    target_audience: str = "General/Adult"
    orientation: Literal["landscape", "portrait"] = "landscape"
    visual_style: str = "standard"
    voice_gender: str = "female"
    tts_provider: str = "standard"
    voice_id: Optional[str] = None
    language: str = "English"
    generate_avatar: bool = False
    background_music_enabled: Optional[bool] = None
    sound_effects_enabled: bool = True
    content_type: str = "VIDEO"
    captions_enabled: bool = True
    html_quality: str = "advanced"
    review_mode: bool = False
    attachments_count: int = 0
    host: Optional["HostConfig"] = None


class VideoCostPreviewResponse(BaseModel):
    selections: Dict[str, Any]
    estimate: Dict[str, Any]
    balance: Dict[str, Any]


class ReferenceFileItem(BaseModel):
    """A reference file (image or PDF) attached to a generation request."""
    url: str = Field(..., description="Public S3 URL of the file")
    name: str = Field(..., description="Original filename (e.g., 'diagram.png')")
    type: Literal["image", "pdf"] = Field(..., description="File type: 'image' or 'pdf'")


# ---------------------------------------------------------------------------
# Host (on-screen narrator) — first-class concept added in this round.
# Two host kinds:
#   • avatar — AI talking head (per-shot Seedream image-to-image conditioned on
#     the user's face image, then fal.ai turns each (image + audio slice) into
#     a lip-synced video).
#   • raw    — splice clips from already-indexed input videos (uses
#     face_segments[].free_regions for overlay placement). Plumbing only this
#     round; generation path returns 501 until we ship raw-host logic.
#
# Tier-gated: ultra / super_ultra only. Lower tiers reject at the API layer.
# ---------------------------------------------------------------------------

AvatarModelLiteral = Literal[
    "fal-ai/kling-video/ai-avatar/v2/standard",
    "veed/fabric-1.0",
]

# Provider for studio_avatar / saved-avatar resolution. Single source of truth —
# referenced by HostAvatarPlan.provider in routing.py and by
# vimotion_resolver._ALLOWED_PROVIDERS so the resolver allow-list cannot drift.
AvatarProviderLiteral = Literal["custom", "argil", "veed"]


class HostAvatarConfig(BaseModel):
    """Avatar-host inputs. Required when host.type='avatar'.

    Two valid shapes:

    1. **Custom (legacy)** — caller supplies `face_image_url` (+ optional
       `details_prompt`, `avatar_model`, `quality`). Pipeline runs the full
       Seedream image-to-image → Kling/Fabric talking-head path.

    2. **Saved (vim)** — caller supplies `saved_avatar_id`. Server resolves
       the studio_avatar row, fills `face_image_url`/`details_prompt`/voice
       overrides from it, and (for non-custom providers) routes per-shot
       generation to the matching fal.ai built-in catalog endpoint
       (Argil / VEED Avatars), skipping Seedream entirely.
    """
    face_image_url: Optional[str] = Field(
        default=None,
        description="Public S3 URL of a clear, front-facing face photo. Required for custom avatars; ignored for built-ins (Argil/VEED) since identity is locked to the catalog enum.",
    )
    details_prompt: str = Field(
        default="",
        description="User-supplied description of the host: clothing, demeanour, background hints. Threaded into per-shot Seedream prompts (custom only).",
    )
    avatar_model: AvatarModelLiteral = Field(
        default="fal-ai/kling-video/ai-avatar/v2/standard",
        description="fal.ai model used for custom-avatar talking-head video. Ignored when the resolved provider is argil or veed (their endpoints are fixed).",
    )
    quality: Literal["480p", "720p"] = Field(
        default="480p",
        description="Avatar video resolution. Same per-second price for both qualities.",
    )
    saved_avatar_id: Optional[str] = Field(
        default=None,
        description="Vimotion studio_avatar.id — when set, server-resolves provider/face_image_url/voice from the row and overrides the matching fields in this config.",
    )
    use_avatar_voice: bool = Field(
        default=True,
        description="When a saved avatar carries voice metadata (voice_id/provider/language/gender), apply it on top of the request's voice fields. Set false to keep the request's voice and ignore the avatar's saved voice.",
    )


class HostRawConfig(BaseModel):
    """Raw-host inputs. Required when host.type='raw'. Generation path is plumbed only this round."""
    input_video_ids: List[str] = Field(
        ...,
        min_length=1,
        description="One or more already-indexed input video IDs (must be COMPLETED). Director picks clips from these.",
    )


class HostConfig(BaseModel):
    """Optional on-screen host. ultra / super_ultra only."""
    type: Literal["avatar", "raw"] = Field(
        default="avatar",
        description="'avatar' = AI talking head per shot. 'raw' = clips from indexed input videos.",
    )
    host_in_video_percentage: int = Field(
        default=100, ge=0, le=100,
        description=(
            "Percentage of shots that feature the host on screen. "
            "100 = host on screen for every shot. "
            "Lower values = host appears in N% of shots, picked by the Director "
            "with emphasis weighting (Hook, Recap, CTA, high-emphasis beats). "
            "Narration audio plays continuously regardless."
        ),
    )
    avatar: Optional[HostAvatarConfig] = None
    raw: Optional[HostRawConfig] = None

    @model_validator(mode="after")
    def _validate(self):
        if self.type == "avatar" and not self.avatar:
            raise ValueError("host.avatar is required when host.type == 'avatar'")
        if self.type == "raw" and not self.raw:
            raise ValueError("host.raw is required when host.type == 'raw'")
        # Avatar identity must come from somewhere: either a face image URL
        # (custom path) or a saved_avatar_id the server can resolve to one.
        # Resolution happens server-side at request entry, before the
        # pipeline runs — so validation here just enforces that *some*
        # identity hook is present.
        if self.type == "avatar" and self.avatar is not None:
            if not self.avatar.face_image_url and not self.avatar.saved_avatar_id:
                raise ValueError(
                    "host.avatar requires either face_image_url (custom upload) "
                    "or saved_avatar_id (resolved server-side)."
                )
        return self


# ---------------------------------------------------------------------------
# Visual preferences — soft per-family bias hints + on-screen text density.
#
# Set either by the FE Advanced Settings sliders OR detected from the user's
# prompt by the IntentRouter free-text scanner (free-text wins on overlap).
# Slice A only PERSISTS these signals into extra_metadata; Slices B/C/D
# inject them into the Script LLM, Director, and per-shot HTML prompts.
# ---------------------------------------------------------------------------

FamilyBias = Literal["no", "auto", "high"]
TextDensity = Literal["minimal", "low", "auto", "rich"]


class VisualPreferences(BaseModel):
    """Soft per-family bias hints + on-screen text density.

    All fields are optional. None = "field not set" (caller can treat as
    "auto"). Slices B/C/D distinguish "explicitly set to auto" from
    "untouched" so logging/observability can show what the user actually
    requested vs what we inferred.
    """
    stock_video: Optional[FamilyBias] = Field(
        default=None,
        description="Bias for VIDEO_HERO + IMAGE_HERO with stock footage / real video.",
    )
    ai_imagery: Optional[FamilyBias] = Field(
        default=None,
        description="Bias for shots with AI-generated images (Seedream).",
    )
    svg_illustrated: Optional[FamilyBias] = Field(
        default=None,
        description="Bias for INFOGRAPHIC_SVG / KINETIC_TITLE / ANNOTATION_MAP.",
    )
    motion_graphics: Optional[FamilyBias] = Field(
        default=None,
        description=(
            "Bias for TEXT_DIAGRAM / PROCESS_STEPS / DATA_STORY / "
            "EQUATION_BUILD / ANIMATED_ASSET / KINETIC_TEXT."
        ),
    )
    app_ui_mockup: Optional[FamilyBias] = Field(
        default=None,
        description="Bias for DEVICE_MOCKUP (HTML-rendered app/web/mobile UI).",
    )
    text_density: Optional[TextDensity] = Field(
        default=None,
        description=(
            "On-screen visible text density (does NOT affect narration length). "
            "minimal = title-only on hooks, no body anywhere. "
            "low = short headlines, no body, drop subtitles. "
            "auto = pipeline default. "
            "rich = full headlines + supporting labels (current behavior). "
            "On minimal/low, KINETIC_TEXT is forbidden by the Director."
        ),
    )


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
    "CONVERSATION",       # Language learning dialogues
    "SLIDES"              # HTML-based presentation / PPT-style slide deck
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
    quality_tier: str = Field(
        default="ultra",
        description="Quality tier: 'free', 'standard', 'premium', 'ultra', 'super_ultra'. Controls two-pass script review, HTML validation, image prompt enhancement, crossfade transitions, kinetic text shots, and other quality features."
    )
    brand_kit_id: Optional[str] = Field(
        default=None,
        description=(
            "Vimotion brand_kit.id — when set, the kit's palette/fonts/layout/intro/outro/watermark "
            "REPLACE the institute-wide VIDEO_STYLE + VIDEO_BRANDING for this run (no merge). Server "
            "resolves the row scoped by institute_id; an unresolved id falls back to institute defaults."
        )
    )
    voice_gender: str = Field(
        default="female",
        description="Voice gender for TTS (VIDEO/STORYBOOK): 'male' or 'female'. Default is 'female'."
    )
    tts_provider: str = Field(
        default="standard",
        description="TTS tier: 'standard' (Microsoft Edge TTS, free) or 'premium' (Google Cloud / Sarvam AI). Premium auto-routes: Indian languages → Sarvam AI, global languages → Google Cloud TTS."
    )
    voice_id: Optional[str] = Field(
        default=None,
        description="Specific voice ID for premium TTS. For Sarvam (Indian): e.g. 'ritu', 'shubh', 'priya'. For Google: e.g. 'en-US-Journey-F'. If not provided, a default voice is chosen based on language and gender."
    )
    generate_avatar: bool = Field(
        default=False,
        description="Whether to generate a talking head avatar. Defaults to False."
    )
    avatar_image_url: Optional[str] = Field(
        default=None,
        description="URL of a face/portrait image for the speaking avatar. If not provided, a default teacher image is used. Only applies to VIDEO content type."
    )
    reference_files: Optional[List[ReferenceFileItem]] = Field(
        default=None,
        description="List of reference files (images/PDFs) to include in generation"
    )
    routing_overrides: Optional[Dict[str, Any]] = Field(
        default=None,
        description=(
            "Sparse override for the auto-routing plan. "
            "Example: {'tools': {'scrape_url': false}, 'config': {'mute_tts_on_source_clips': true}}. "
            "User toggles win over router decisions."
        )
    )
    orientation: Literal["landscape", "portrait"] = Field(
        default="landscape",
        description="Video orientation: 'landscape' (1920x1080, 16:9) or 'portrait' (1080x1920, 9:16)"
    )
    visual_style: str = Field(
        default="standard",
        description=(
            "DEPRECATED — accepted for API back-compat but no longer gates behavior. "
            "The Director LLM now picks theme, background, and animation language "
            "per-shot based on content, and can shift styles across a long video's "
            "timeline. Kept on the request schema so existing clients don't break."
        )
    )
    sound_effects_enabled: bool = Field(
        default=True,
        description=(
            "Enable automatic sound effects (transitions, chimes, impacts) baked "
            "into the video timeline. When True (default at premium+), the Sound "
            "Planner derives cues from shot types, sync points, skill audio events "
            "and narration emphasis — no extra Director burden. When False, all "
            "cues are suppressed regardless of tier."
        )
    )
    input_video_id: Optional[str] = Field(
        default=None,
        description=(
            "ID of a COMPLETED indexed video (from ai_input_videos table). "
            "When provided, the Director can plan SOURCE_CLIP shots that play "
            "clips from the source video with HTML overlays on top. "
            "Deprecated — use input_video_ids instead. Kept for backward compat."
        )
    )
    input_video_ids: Optional[List[str]] = Field(
        default=None,
        description=(
            "List of COMPLETED indexed video IDs (max 5). The Director can plan "
            "SOURCE_CLIP shots referencing any of these via source_video_index. "
            "Supersedes input_video_id when both are provided."
        )
    )
    input_video_audio: Optional[str] = Field(
        default=None,
        description=(
            "Audio source when input videos are set. "
            "'original' = use source video audio as narration (single video only). "
            "'tts' = generate AI narration (script+TTS run normally). "
            "Forced to 'tts' when multiple input videos are provided."
        )
    )
    background_music_enabled: Optional[bool] = Field(
        default=None,
        description=(
            "Enable auto-generated background music (Google Lyria). "
            "None = use tier default (on for ultra/super_ultra, off otherwise). "
            "True/False overrides. Requires ultra+ tier — ignored on lower tiers. "
            "The generated score appears as a single 'Background Music' entry in "
            "meta.audio_tracks[] and is editable/deletable via the audio tracks UI."
        )
    )
    background_music_volume: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description=(
            "Initial volume multiplier (0.0-1.0) for the generated background music "
            "track. If omitted, uses the tier default (0.20). Users can adjust post-"
            "generation via the audio-tracks UI."
        )
    )
    sub_shots_enabled: bool = Field(
        default=False,
        description=(
            "Experimental: when True, the pipeline runs a quick decomposer on each "
            "shot and may split dense shots into 2 focused sub-shots before HTML "
            "generation. Improves visual precision on motion-heavy scenes at the "
            "cost of one extra small LLM call per qualifying shot."
        )
    )
    mute_tts_on_source_clips: bool = Field(
        default=False,
        description=(
            "When True and audio is 'tts', source video audio is mixed INTO the "
            "TTS narration during SOURCE_CLIP shots (muting TTS during those clips). "
            "Default False: TTS narration plays continuously throughout the video; "
            "source video clips are visual-only. Use True for podcast-style videos "
            "where you want to hear the speaker. Use False for marketing/explainer "
            "videos where the TTS script is the main content."
        )
    )
    host: Optional[HostConfig] = Field(
        default=None,
        description=(
            "Optional on-screen host (narrator). Available on ultra / super_ultra "
            "tiers only — request is rejected on lower tiers when host is set. "
            "When set, the script is rewritten in 1st person and the host appears "
            "in `host_in_video_percentage`%% of shots, full-frame, with motion "
            "graphics overlaid in free regions."
        )
    )
    visual_preferences: Optional[VisualPreferences] = Field(
        default=None,
        description=(
            "Soft per-family bias hints + on-screen text density. Set by the FE "
            "Advanced Settings sliders. Free-text phrases in the prompt "
            "(e.g. 'use more SVG diagrams', 'less text on screen') override "
            "individual fields via the IntentRouter free-text scanner."
        ),
    )

    @model_validator(mode="after")
    def _normalize_input_videos(self):
        """Normalize input_video_id → input_video_ids and enforce multi-source rules."""
        # Backward compat: wrap singular into list
        if self.input_video_id and not self.input_video_ids:
            self.input_video_ids = [self.input_video_id]
        # If both set, list takes precedence
        if self.input_video_ids:
            self.input_video_ids = self.input_video_ids[:5]  # cap at 5
            # Set singular to first for backward compat downstream
            self.input_video_id = self.input_video_ids[0]
            # Multi-source forces TTS (can't splice different audio tracks)
            if len(self.input_video_ids) > 1 and self.input_video_audio == "original":
                _log.warning(
                    "Multi-source input videos force TTS audio "
                    "(cannot splice multiple source audio tracks)"
                )
                self.input_video_audio = "tts"
        return self

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
                "tts_provider": "standard",
                "voice_id": None,
                "avatar_image_url": None,
                "orientation": "landscape",
                "reference_files": [
                    {"url": "https://bucket.s3.amazonaws.com/file1.png", "name": "diagram.png", "type": "image"},
                    {"url": "https://bucket.s3.amazonaws.com/file2.pdf", "name": "notes.pdf", "type": "pdf"}
                ]
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
    file_ids: Dict[str, Optional[str]]
    s3_urls: Dict[str, Optional[str]]
    prompt: Optional[str]
    language: str
    error_message: Optional[str]
    metadata: Dict[str, Any]
    token_usage: Optional[Dict[str, Any]] = Field(
        None,
        description="Token/cost breakdown for this generation (prompt_tokens, completion_tokens, estimated_cost_usd, model, etc.)"
    )
    generation_progress: Optional[Dict[str, Any]] = Field(
        None,
        description=(
            "Real-time sub-stage progress, updated every ~250ms during generation and persisted to DB. "
            "Fields: "
            "sub_stage (str — current label e.g. 'Shot 4/18 ready (VIDEO_HERO)'), "
            "shots_completed (int), shots_total (int), "
            "shot_plan (list[{shot_index, shot_type, duration_s, start_time, end_time, narration_excerpt}] "
            "— full Director plan, set once when planning completes), "
            "shots_history (list[{shot_index, shot_type, duration_s, start_time, end_time, "
            "model, token_delta:{prompt_tokens,completion_tokens,estimated_cost_usd}, "
            "cumulative_tokens}] — every completed shot, capped at 200, for post-run analysis), "
            "cumulative_tokens ({prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd} "
            "— running total updated after every shot), "
            "last_shot ({shot_index, shot_type, duration_s} — quick access to last completed shot), "
            "errors (list[{shot_index, shot_type, error, retrying, attempt, timestamp}] — shot errors, capped at 50), "
            "last_event (raw last pipeline event dict)."
        )
    )
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
    video_url: Optional[str] = Field(None, description="URL to rendered MP4 video (from render server)")
    status: str = Field(..., description="Current video generation status (PENDING, IN_PROGRESS, COMPLETED, FAILED, STALLED)")
    current_stage: str = Field(..., description="Current generation stage")
    updated_at: Optional[str] = Field(None, description="Last time the record was updated (ISO 8601)")
    error_message: Optional[str] = Field(None, description="Error message if generation failed or stalled")
    render_job_id: Optional[str] = Field(None, description="Active render job ID (for tracking render progress)")
    audio_tracks: Optional[List[Dict[str, Any]]] = Field(None, description="Extra audio tracks from meta.audio_tracks")

    class Config:
        json_schema_extra = {
            "example": {
                "video_id": "quantum-entanglement-101",
                "html_url": "https://bucket.s3.amazonaws.com/ai-videos/quantum-entanglement-101/timeline/time_based_frame.json",
                "audio_url": "https://bucket.s3.amazonaws.com/ai-videos/quantum-entanglement-101/audio/narration.mp3",
                "words_url": "https://bucket.s3.amazonaws.com/ai-videos/quantum-entanglement-101/audio/words.json",
                "avatar_url": None,
                "status": "COMPLETED",
                "current_stage": "HTML",
                "updated_at": "2024-01-15T10:35:00Z",
                "error_message": None
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
    """Request for updating a specific frame's HTML and optionally its timing."""
    video_id: str = Field(..., description="Video ID")
    frame_index: int = Field(..., description="Index of the frame to update")
    new_html: str = Field(..., description="New HTML content")
    in_time: Optional[float] = Field(None, description="New start time in seconds (time_driven)")
    exit_time: Optional[float] = Field(None, description="New end time in seconds (time_driven)")
    z: Optional[int] = Field(None, description="Z-index layer")
    entry_id: Optional[str] = Field(None, description="Client entry ID for verification")


class AddFrameRequest(BaseModel):
    """Request for inserting a new frame into the timeline."""
    video_id: str = Field(..., description="Video ID")
    html: str = Field(..., description="HTML content for the new frame")
    # Time-driven fields (optional — omit for user_driven videos)
    in_time: Optional[float] = Field(None, description="Start time in seconds (time_driven)")
    exit_time: Optional[float] = Field(None, description="End time in seconds (time_driven)")
    # Optional explicit ID so the frontend can correlate the response
    entry_id: Optional[str] = Field(None, description="Client-generated entry ID (optional)")
    z: Optional[int] = Field(0, description="Z-index layer (0=base, 500+=overlay)")
    # Position / bounding box (defaults to full-screen when omitted)
    html_start_x: Optional[int] = Field(None, description="Left edge in pixels (default 0)")
    html_start_y: Optional[int] = Field(None, description="Top edge in pixels (default 0)")
    html_end_x: Optional[int] = Field(None, description="Right edge in pixels (default video width)")
    html_end_y: Optional[int] = Field(None, description="Bottom edge in pixels (default video height)")


class AddFrameResponse(BaseModel):
    status: str
    video_id: str
    entry_id: str
    frame_index: int
    message: str


class DeleteFrameRequest(BaseModel):
    """Request for removing a frame from the timeline.

    Prefer `entry_id` — it's order-independent. `frame_index` is accepted as
    a fallback for callers that only know the position. If both are given,
    `entry_id` wins and `frame_index` is treated as a hint.
    """
    video_id: str = Field(..., description="Video ID")
    entry_id: Optional[str] = Field(None, description="Stable entry ID to remove")
    frame_index: Optional[int] = Field(
        None, description="Position of the frame to remove (fallback when entry_id is missing)"
    )


class DeleteFrameResponse(BaseModel):
    status: str
    video_id: str
    entry_id: Optional[str]
    frame_index: int
    message: str


# ── Audio track schemas ──────────────────────────────────────────────────────

class AudioTrackItem(BaseModel):
    """An extra audio track stored in meta.audio_tracks[]."""
    id: str = Field(..., description="Unique track ID (e.g. 'track-1')")
    label: str = Field(..., description="Display label (e.g. 'Background Music')")
    url: str = Field(..., description="Public S3 URL of the audio file")
    volume: float = Field(default=1.0, ge=0.0, le=2.0, description="Playback volume multiplier (0–2)")
    delay: float = Field(default=0.0, ge=0.0, description="Seconds to wait before starting")
    fade_in: float = Field(default=0.0, ge=0.0, description="Fade-in duration in seconds")
    fade_out: float = Field(default=0.0, ge=0.0, description="Fade-out duration in seconds")


class AddAudioTrackRequest(BaseModel):
    video_id: str = Field(..., description="Video ID")
    label: str = Field(..., description="Track display label")
    url: str = Field(..., description="Public S3 URL of the audio file")
    volume: float = Field(default=1.0, ge=0.0, le=2.0)
    delay: float = Field(default=0.0, ge=0.0)
    fade_in: float = Field(default=0.0, ge=0.0)
    fade_out: float = Field(default=0.0, ge=0.0)
    track_id: Optional[str] = Field(None, description="Client-provided track ID (auto-generated if absent)")


class UpdateAudioTrackRequest(BaseModel):
    video_id: str = Field(..., description="Video ID")
    track_id: str = Field(..., description="Track ID to update")
    label: Optional[str] = None
    url: Optional[str] = None
    volume: Optional[float] = Field(None, ge=0.0, le=2.0)
    delay: Optional[float] = Field(None, ge=0.0)
    fade_in: Optional[float] = Field(None, ge=0.0)
    fade_out: Optional[float] = Field(None, ge=0.0)


class DeleteAudioTrackRequest(BaseModel):
    video_id: str = Field(..., description="Video ID")
    track_id: str = Field(..., description="Track ID to delete")


class AudioTrackResponse(BaseModel):
    status: str
    video_id: str
    track_id: str
    message: str
