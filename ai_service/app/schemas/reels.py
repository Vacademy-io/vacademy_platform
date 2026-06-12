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
    """Five-axis composite engagement score. Each axis is 0-100.

    Composite = weighted geometric mean — one weak axis tanks the whole clip.
    A3 (2026-05-22): added `topic` axis (TF-IDF concentration).
    """
    hook: float = Field(..., ge=0, le=100, description="Strength of the first 2.5s")
    pacing: float = Field(..., ge=0, le=100, description="Cadence, density, sentence boundary quality")
    info: float = Field(..., ge=0, le=100, description="Information density per second")
    loop: float = Field(..., ge=0, le=100, description="Loop-back potential (replay-friendliness)")
    topic: float = Field(0.0, ge=0, le=100, description="Topic concentration (TF-IDF top-5 share)")
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
    # A4 (2026-05-22): ratio of window's info-density to the source-level
    # baseline. >1.0 = denser than the speaker's average; <1.0 = sparser.
    info_density_ratio: Optional[float] = None
    numeric_token_count: Optional[int] = None
    # A2 (2026-05-22): per-candidate LLM rationale + the factor by which the
    # rerank pass adjusted the composite. Both None when rerank didn't run
    # (no API key, transport error, etc.) — heuristic composite stands.
    llm_rerank_factor: Optional[float] = None
    llm_rerank_reason: Optional[str] = None
    # A3 (2026-05-22): topic-coherence diagnostic. Share of top-5 tokens'
    # TF-IDF mass in the window, and the single highest-TF-IDF token.
    topic_top5_share: Optional[float] = None
    topic_top_token: Optional[str] = None
    # Loop
    first_last_mfcc_similarity: Optional[float] = None
    has_verbal_cta_end: Optional[bool] = None
    # Diversity / constraints
    word_cut_savings_needed_s: Optional[float] = None
    word_cut_savings_pct: Optional[float] = None
    speaker_moves_in_window: Optional[int] = None
    # A5 — fraction of the window covered by at least one face_segment.
    # None when indexer didn't run face detection (screen recordings).
    face_coverage_fraction: Optional[float] = None
    # End-quality (Issue 4A — measures whether the snapped window opens
    # and closes at real sentence boundaries vs trailing mid-thought).
    end_quality_score: Optional[float] = None
    end_last_word: Optional[str] = None
    # CR1 (2026-05-22): tightened from Optional[str] to a literal so the FE
    # type narrowing (which expects exactly these three) can't silently drift
    # if a future emit-path adds a new bucket without updating the FE.
    end_terminator: Optional[Literal["punctuation", "continuator", "no_punct"]] = None
    start_first_word: Optional[str] = None
    start_bad_opener: Optional[bool] = None


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
    """A contiguous range to remove from source audio + video.

    `user` cuts come from the FE trim UI (Phase 2 B3) and can run up to
    MAX_USER_CUT_SPAN_S (~15s). Auto `filler` cuts (whole disfluency runs)
    are capped at MAX_CUT_SPAN_S (~2s); `silence` cuts span however much
    of a pause is trimmed, and window-edge sentence drops (kind="word")
    can run longer than 2s — nothing meaningful is inside either.
    """
    t_start: float
    t_end: float
    kind: Literal["silence", "word", "filler", "user"] = "word"


class WordImportance(BaseModel):
    word: str
    t_start: float
    t_end: float
    importance: int = Field(..., ge=0, le=3, description="0 filler, 1 routine, 2 important, 3 keyword")
    keyword_type: Optional[Literal["important", "definition", "warning"]] = None
    # Phase 2c.7: optional single-emoji decoration the LLM picks for 0-3
    # high-impact words per reel. Always None for heuristic-fallback.
    emoji: Optional[str] = None


class TranscriptCorrection(BaseModel):
    """LLM-applied transcript fix (Issue 1B' — Raven→Ravana class).

    Emitted by the same /preview LLM call that scores importance. Each
    entry documents one token replacement that was actually applied to
    the word_importance list (i.e. `count >= 1`).
    """
    original: str = Field(..., description="ASR token before correction")
    corrected: str = Field(..., description="What the LLM replaced it with")
    reason: str = Field("", description="One-line cultural / topical justification")
    count: int = Field(1, description="How many times the token was replaced in this window")


class EnrichedCandidate(BaseModel):
    """Returned by /preview — adds LLM-derived fields to a scan candidate."""
    candidate_id: str
    method: Optional[str] = Field(
        default=None,
        description='"llm" when the LLM call succeeded, "heuristic_fallback" when '
        "we synthesized importance/title without an LLM call. Surface this on "
        "the FE so users can see when enrichment quality is degraded.",
    )
    title: str = Field(..., description="≤8-word spoken-style hook line")
    rationale: str = Field(..., description="≤20-word reason this clip is worth rendering")
    word_importance: list[WordImportance]
    cut_plan: list[CutSpan]
    predicted_output_duration_s: float = Field(
        ..., description="Recomputed after the cut plan is finalized"
    )
    transcript_corrections: list[TranscriptCorrection] = Field(
        default_factory=list,
        description="LLM-suggested token rewrites that were applied "
        "(e.g. ASR 'raven' → 'Ravana' when context implies Ramayana). "
        "Empty when nothing needed correcting.",
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
    # Phase 2b — palette mode.
    #   "default" (default): hardcoded Hormozi yellow / definition green /
    #              warning red palette. Research §12.4 proven retention winner.
    #   "source_derived": STYLE_GUIDE samples 3 frames of the speaker_clip
    #              and derives an `important`-slot accent from dominant
    #              high-saturation hue. `definition`/`warning` stay
    #              semantic (red = warnings, green = breakthroughs). Body
    #              stays white. **Risk-flagged**: source-derived palette
    #              may underperform Hormozi yellow on retention; ship as
    #              A/B opt-in only.
    palette: Literal["default", "source_derived"] = "default"
    # B3 (2026-05-22) — user-toggled cuts from the FE trim UI. Merged with
    # the enriched candidate's auto cut_plan at /render time. Each span:
    #   * kind must be "user"
    #   * 0.08 <= duration <= MAX_USER_CUT_SPAN_S (15.0s)
    #   * within [source_window.t_start, source_window.t_end]
    #   * no overlap with another override
    #   * no overlap with any importance>=2 word from the enriched payload
    # Total override duration capped at 40% of window duration; beyond that,
    # the user should re-scan with different params rather than salvage.
    # PB4: max_length=50 caps the validator's input — a 25s clip at one cut
    # per word would emit ~50-80 cuts, so 50 is a soft real-world ceiling
    # and a hard DoS guard.
    cut_plan_overrides: Optional[list[CutSpan]] = Field(default=None, max_length=50)


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
