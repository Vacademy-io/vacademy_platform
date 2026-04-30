"""
Pydantic models for video_context.json — the prompt-facing metadata file.

This is the primary output artifact consumed by the AI video generation
pipeline when creating reel-style outputs from user-uploaded videos.
All bounding boxes are normalized to [0,1].
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Transcript
# ---------------------------------------------------------------------------

class WordTimestamp(BaseModel):
    word: str
    start: float
    end: float


class Sentence(BaseModel):
    text: str
    start: float
    end: float
    words: list[WordTimestamp] = Field(default_factory=list)
    energy_mean: Optional[float] = None
    pitch_mean_hz: Optional[float] = None
    pitch_std_hz: Optional[float] = None
    speech_rate_wps: Optional[float] = None


# ---------------------------------------------------------------------------
# Prosody & emphasis
# ---------------------------------------------------------------------------

class EmphasisMark(BaseModel):
    t: float
    word: str
    reason: str  # "energy_spike", "pitch_rise", "long_pause_before"


class ProsodySummary(BaseModel):
    mean_rms: float
    peak_rms: float
    mean_pitch_hz: float
    pause_count: int
    pauses: list[dict] = Field(default_factory=list)  # [{start, end, duration_s}]
    energy_series: list[dict] = Field(default_factory=list)  # downsampled [{t, rms}] @ 1s
    pitch_series: list[dict] = Field(default_factory=list)   # downsampled [{t, hz}] @ 1s, NaN→null


# ---------------------------------------------------------------------------
# Scene & highlight
# ---------------------------------------------------------------------------

class SceneBoundary(BaseModel):
    t: float
    frame_num: int


class HighlightWindow(BaseModel):
    t_start: float
    t_end: float
    reason: str  # LLM explanation or "energy_heuristic"


# ---------------------------------------------------------------------------
# Podcast-specific
# ---------------------------------------------------------------------------

class FaceInfo(BaseModel):
    """Representative face info per scene or per sampled frame."""
    bbox_norm: list[float]  # [x, y, w, h] normalized 0-1
    head_yaw: float = 0.0
    head_pitch: float = 0.0


class SpeakerForeground(BaseModel):
    asset_path: str  # relative: "assets/speaker_fg.webm"
    has_alpha: bool = True
    typical_bbox_norm: Optional[list[float]] = None  # [x, y, w, h]
    free_regions: list[str] = Field(default_factory=list)  # ["top_left", "top_right", ...]


class FaceSegment(BaseModel):
    """Time-bounded segment where the speaker's face is in a stable position.

    Built by clustering consecutive 1fps face-detection samples across the
    FULL video. Used by future placement pipelines to decide which canvas
    region is safe for an overlay (infographic, lower-third, etc.) at any
    given timestamp.
    """
    t_start: float
    t_end: float
    bbox_norm: list[float]   # [x, y, w, h] — averaged over the segment
    free_regions: list[str] = Field(default_factory=list)  # ["top_left", ...]
    sample_count: int = 0    # number of frames that contributed to this segment
    detection_rate: float = 1.0  # fraction of sampled frames where a face was detected


# ---------------------------------------------------------------------------
# Demo-specific
# ---------------------------------------------------------------------------

class PipRegion(BaseModel):
    present: bool
    roi_norm: Optional[list[float]] = None  # [x, y, w, h] normalized
    pip_fg_asset: Optional[str] = None  # "assets/pip_fg.webm"


class DynamicCrop(BaseModel):
    t_start: float
    t_end: float
    crop_bbox_norm: list[float]  # [x, y, w, h] normalized
    follows: str = ""  # e.g. "cursor", "active_region"


class UiCutout(BaseModel):
    id: str
    t: float
    bbox_norm: list[float]
    asset_path: str  # "assets/ui_cutouts/cut_001.webm"
    label: str = ""


class KeyOnscreenEvent(BaseModel):
    t: float
    kind: str  # "click", "type", "scroll"
    near_text: str = ""
    ui_cutout_id: Optional[str] = None


class DemoContext(BaseModel):
    """Demo-mode specific fields. Omitted entirely in podcast mode."""
    ui_elements_seen: list[str] = Field(default_factory=list)
    cursor_path_summary: str = ""
    key_onscreen_events: list[KeyOnscreenEvent] = Field(default_factory=list)
    dynamic_crops: list[DynamicCrop] = Field(default_factory=list)
    pip: Optional[PipRegion] = None
    ui_cutouts: list[UiCutout] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Top-level
# ---------------------------------------------------------------------------

class VideoMeta(BaseModel):
    mode: str  # "podcast" or "demo"
    duration_s: float
    resolution: list[int]  # [width, height]
    fps_original: float
    fps_sampled_visual: float
    highlight_window: HighlightWindow


class VideoContext(BaseModel):
    """Top-level schema written to video_context.json."""
    meta: VideoMeta
    transcript: list[Sentence] = Field(default_factory=list)
    emphasis: list[EmphasisMark] = Field(default_factory=list)
    prosody: Optional[ProsodySummary] = None
    scenes: list[SceneBoundary] = Field(default_factory=list)
    foreground: Optional[SpeakerForeground] = None
    face_segments: list[FaceSegment] = Field(default_factory=list)  # full-video face track (podcast mode)
    demo_only: Optional[DemoContext] = None
