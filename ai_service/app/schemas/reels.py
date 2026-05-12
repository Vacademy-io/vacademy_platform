"""
Pydantic schemas for the Reels-from-Long-Video pipeline.

Three-gate funnel surfaces (§3 of REELS_FROM_VIDEO plan):
  POST /external/reels/v1/scan      → ScanRequest        → ScanResponse
  POST /external/reels/v1/preview   → PreviewRequest     → PreviewResponse
  POST /external/reels/v1/render    → RenderRequest      → ReelResponse
  GET  /external/reels/v1/{id}      →                    → ReelResponse
  GET  /external/reels/v1/{id}/status                    → ReelStatusResponse
  GET  /external/reels/v1/list      →                    → list[ReelResponse]

This file is the *external contract*. Internal scoring/cut-plan structures
live alongside their compute modules.
"""
from __future__ import annotations

from typing import Optional, Literal
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Shared enums (as Literals — Pydantic v2 friendly, JSON-safe)
# ---------------------------------------------------------------------------

Aspect = Literal["9:16", "16:9", "1:1"]
Layout = Literal[
    "full_speaker_with_overlays",
    "split_top_speaker",
    "pip_corner_speaker",
    "lower_third_speaker",
    "book_quote",
    # Phase 2c.2: speaker top + user-supplied "satisfying" b-roll bottom.
    # Research §12.3 — dual-attention anchoring holds attention 30-45% longer
    # than single-frame for slower narrative moments. Background video URL
    # must be set in RenderRequest.background_video_url; otherwise director
    # falls back to full_speaker_with_overlays so the bottom half doesn't
    # render as a black bar.
    "stacked_speaker_with_broll",
]
CaptionPreset = Literal["hormozi", "karaoke", "pop", "clean"]
SilenceTrim = Literal["off", "gentle", "on", "aggressive"]
AudioStrategy = Literal["keep_speaker", "keep_speaker_plus_bgm", "tts_overdub"]
CaptionStyle = Literal["keyword_emphasis", "karaoke", "clean"]
ReelStatus = Literal["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"]


# ---------------------------------------------------------------------------
# Scoring (Gate 1 output)
# ---------------------------------------------------------------------------

class ScoreAxes(BaseModel):
    """Four-axis composite engagement score. Each axis is 0-100.

    Composite = weighted geometric mean — one weak axis tanks the whole clip.
    """
    hook: float = Field(..., ge=0, le=100, description="Strength of the first 2.5s")
    pacing: float = Field(..., ge=0, le=100, description="Cadence, density, sentence boundary quality")
    info: float = Field(..., ge=0, le=100, description="Information density per second")
    loop: float = Field(..., ge=0, le=100, description="Loop-back potential (replay-friendliness)")
    composite: float = Field(..., ge=0, le=100, description="Overall reel score (weighted geometric mean)")


class ScoreBreakdown(BaseModel):
    """Per-axis sub-signals exposed for transparency in the FE."""
    # Hook
    opener_quality: Optional[float] = None
    energy_first_2_5s: Optional[float] = None
    first_sentence_complete: Optional[bool] = None
    # Pacing
    silence_fraction: Optional[float] = None
    emphasis_density: Optional[float] = None
    # Predicted duration after silence-trim ONLY. The candidate-level
    # `predicted_output_duration_s` factors in word-cuts + speedup too —
    # these are distinct numbers; don't conflate.
    predicted_after_silence_s: Optional[float] = None
    # Info
    unique_content_words_per_s: Optional[float] = None
    numeric_token_count: Optional[int] = None
    # Loop
    first_last_mfcc_similarity: Optional[float] = None
    has_verbal_cta_end: Optional[bool] = None
    # Diversity / constraints
    word_cut_savings_needed_s: Optional[float] = None
    word_cut_savings_pct: Optional[float] = None
    speaker_moves_in_window: Optional[int] = None


class ReelCandidate(BaseModel):
    """One scan candidate returned by POST /scan.

    Gate 1 deliberately omits LLM-derived fields (rationale, word_importance,
    cut_plan). Those are populated by Gate 2 (/preview) and stored on the
    same candidate row, then echoed back from /preview.
    """
    candidate_id: str = Field(..., description="Stable id for /preview and /render to reference")
    rank: int = Field(..., ge=1)
    source_t_start: float = Field(..., description="Start in source video seconds")
    source_t_end: float = Field(..., description="End in source video seconds")
    source_duration_s: float = Field(..., description="t_end - t_start in source")
    predicted_output_duration_s: float = Field(
        ...,
        description="Predicted duration after silence + word + speedup trims (target ± tolerance)",
    )
    score: ScoreAxes
    breakdown: ScoreBreakdown
    transcript_snippet: str = Field(
        ..., description="First sentence + … + last sentence of the window, ≤140 chars"
    )
    thumbnail_strip_url: Optional[str] = Field(
        None,
        description="S3 URL to a 3-second thumbnail strip (sprite or short mp4) of the window",
    )
    low_confidence: bool = Field(
        default=False,
        description="True if composite < 60 — surfaced anyway because the user must see something",
    )


# ---------------------------------------------------------------------------
# Scan (Gate 1)
# ---------------------------------------------------------------------------

class TimeRange(BaseModel):
    """A pinned anchor in the source video."""
    t_start: float = Field(..., ge=0)
    t_end: float = Field(..., gt=0)


class ScanRequest(BaseModel):
    input_asset_id: str = Field(..., description="ai_input_assets.id with status=COMPLETED")
    target_duration_sec: int = Field(default=25, ge=10, le=120, description="Hard target. Default 25s (research-anchored §12.2).")
    duration_tolerance_sec: int = Field(default=3, ge=1, le=15)
    scan_limit: int = Field(default=30, ge=5, le=50)
    aspect: Aspect = Field(default="9:16")
    topic_keywords: list[str] = Field(default_factory=list, max_length=20)
    must_include_ranges: list[TimeRange] = Field(default_factory=list, max_length=5)


class ScanResponse(BaseModel):
    input_asset_id: str
    config_hash: str = Field(..., description="Idempotency key for re-scans within TTL")
    candidates: list[ReelCandidate]
    total_returned: int = Field(
        ...,
        description=(
            "Count of candidates in this response. Same as len(candidates) — "
            "exposed for symmetry with the planned future `total_evaluated` "
            "(pre-rank scan size) and pagination metadata."
        ),
    )
    cache_ttl_seconds: int = Field(default=3600)


# ---------------------------------------------------------------------------
# Preview (Gate 2) — schemas land here ahead of implementation to lock the contract
# ---------------------------------------------------------------------------

class CutSpan(BaseModel):
    """A contiguous range to remove from source audio + video."""
    t_start: float
    t_end: float
    kind: Literal["silence", "word", "filler"] = "word"


class WordImportance(BaseModel):
    word: str
    t_start: float
    t_end: float
    importance: int = Field(..., ge=0, le=3, description="0 filler, 1 routine, 2 important, 3 keyword")
    keyword_type: Optional[Literal["important", "definition", "warning"]] = None


class EnrichedCandidate(BaseModel):
    """Returned by /preview — adds LLM-derived fields to a scan candidate."""
    candidate_id: str
    title: str = Field(..., description="≤8-word working title")
    rationale: str = Field(..., description="≤20-word reason this clip is worth rendering")
    word_importance: list[WordImportance]
    cut_plan: list[CutSpan]
    predicted_output_duration_s: float = Field(
        ..., description="Recomputed after the cut plan is finalized"
    )


class PreviewRequest(BaseModel):
    input_asset_id: str
    candidate_ids: list[str] = Field(..., min_length=1, max_length=10)


class PreviewResponse(BaseModel):
    enriched: list[EnrichedCandidate]


# ---------------------------------------------------------------------------
# Render (Gate 3) — contract only; impl in later phase
# ---------------------------------------------------------------------------

class PaceConfig(BaseModel):
    silence_trim: SilenceTrim = "on"
    speed_multiplier: float = Field(default=1.0, ge=1.0, le=1.5)
    word_trim: bool = True


class VisualPreferences(BaseModel):
    stock_video: Literal["no", "auto", "high"] = "auto"
    ai_imagery: Literal["no", "auto", "high"] = "auto"
    svg_illustrated: Literal["no", "auto", "high"] = "auto"
    motion_graphics: Literal["no", "auto", "high"] = "auto"
    app_ui_mockup: Literal["no", "auto", "high"] = "auto"
    text_density: Literal["minimal", "low", "auto", "rich"] = "auto"


class CaptionConfig(BaseModel):
    enabled: bool = True
    preset: CaptionPreset = "hormozi"
    keyword_palette: dict = Field(
        default_factory=lambda: {
            "important": "#F7C204",
            "definition": "#02FB23",
            "warning": "#FF3B30",
        },
    )


class BrandingConfig(BaseModel):
    logo_url: Optional[str] = None
    accent_color: Optional[str] = None
    font_family: Optional[str] = None


class RenderRequest(BaseModel):
    input_asset_id: str
    candidate_id: str
    aspect: Aspect = "9:16"
    layout: Layout = "full_speaker_with_overlays"
    pace: PaceConfig = Field(default_factory=PaceConfig)
    audio_strategy: AudioStrategy = "keep_speaker"
    background_music_url: Optional[str] = None
    ducking: bool = True
    # Only consumed when layout=stacked_speaker_with_broll. Plays in the
    # bottom half of the reel as ambient "engagement glue" footage. Director
    # ignores when layout is anything else.
    background_video_url: Optional[str] = None
    captions: CaptionConfig = Field(default_factory=CaptionConfig)
    branding: BrandingConfig = Field(default_factory=BrandingConfig)
    visual_preferences: VisualPreferences = Field(default_factory=VisualPreferences)


# ---------------------------------------------------------------------------
# Reel record (used by GET endpoints and POST /render response)
# ---------------------------------------------------------------------------

class StageProgress(BaseModel):
    """Per-stage progress so the FE can show stage-by-stage advancement
    (§13.11 FE requirement — not just an overall %)."""
    stage: str
    progress: int = Field(..., ge=0, le=100)


class ReelResponse(BaseModel):
    id: str
    reel_id: str
    institute_id: str
    input_asset_id: str
    candidate_id: Optional[str] = None
    status: ReelStatus
    current_stage: str
    progress: int = 0
    stages: list[StageProgress] = Field(default_factory=list)
    error_message: Optional[str] = None
    config: dict = Field(default_factory=dict)
    source_window: dict = Field(default_factory=dict)
    trim_map: Optional[dict] = None
    s3_urls: dict = Field(default_factory=dict)
    metadata: dict = Field(default_factory=dict)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None


class ReelStatusResponse(BaseModel):
    id: str
    status: ReelStatus
    current_stage: str
    progress: int = 0
    stages: list[StageProgress] = Field(default_factory=list)
    error_message: Optional[str] = None


# ---------------------------------------------------------------------------
# Frame editing — POST /frame/{add,update,delete}
#
# Lets the editor (`/vim/edit/$videoId?kind=reel`) persist user edits back
# into the reel's `time_based_frame.json` on S3. Mirrors the AI-gen-video
# frame endpoints field-for-field, except the identifier is `reel_id` and
# the target file is `AiReel.s3_urls.time_based_frame`.
# ---------------------------------------------------------------------------

class AddReelFrameRequest(BaseModel):
    """Insert a new entry into a reel's timeline."""
    reel_id: str = Field(..., description="User-facing reel id (not the UUID pk)")
    html: str = Field(..., description="HTML body fragment for the new shot")
    in_time: Optional[float] = Field(None, description="Start time in reel seconds")
    exit_time: Optional[float] = Field(None, description="End time in reel seconds")
    entry_id: Optional[str] = Field(None, description="Client-generated entry id (optional)")
    z: Optional[int] = Field(0, description="Z-index layer (0=base, 500+=overlay, 8000+=caption)")
    html_start_x: Optional[int] = Field(None, description="Left edge in pixels (defaults to 0)")
    html_start_y: Optional[int] = Field(None, description="Top edge in pixels (defaults to 0)")
    html_end_x: Optional[int] = Field(None, description="Right edge in pixels (defaults to frame width)")
    html_end_y: Optional[int] = Field(None, description="Bottom edge in pixels (defaults to frame height)")


class UpdateReelFrameRequest(BaseModel):
    """Update a single entry's HTML and optionally its timing/z."""
    reel_id: str = Field(..., description="User-facing reel id")
    frame_index: int = Field(..., description="Position of the entry in the timeline")
    new_html: str = Field(..., description="Replacement HTML body fragment")
    in_time: Optional[float] = Field(None, description="New start time (reel seconds)")
    exit_time: Optional[float] = Field(None, description="New end time (reel seconds)")
    z: Optional[int] = Field(None, description="New z-index")
    entry_id: Optional[str] = Field(None, description="Stable entry id for verification")


class DeleteReelFrameRequest(BaseModel):
    """Remove an entry from a reel's timeline. `entry_id` is order-independent
    and preferred; `frame_index` is accepted as a fallback."""
    reel_id: str = Field(..., description="User-facing reel id")
    entry_id: Optional[str] = Field(None, description="Stable entry id to remove")
    frame_index: Optional[int] = Field(None, description="Position fallback when entry_id is missing")


class ReelFrameResponse(BaseModel):
    status: str
    reel_id: str
    entry_id: Optional[str] = None
    frame_index: int
    message: str
