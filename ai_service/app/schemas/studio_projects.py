"""
Pydantic schemas for the Vimotion Studio multi-asset video editing pipeline.

Endpoint surfaces (see AI_VIDEO_STUDIO.md §4 for the full table):
  POST   /external/studio/v1/projects                       → CreateProjectRequest    → ProjectResponse
  GET    /external/studio/v1/projects                       → list[ProjectSummary]
  GET    /external/studio/v1/projects/{id}                  → ProjectResponse
  PATCH  /external/studio/v1/projects/{id}                  → UpdateProjectRequest    → ProjectResponse
  DELETE /external/studio/v1/projects/{id}                  → 204

  POST   /external/studio/v1/projects/{id}/wizard/{step}/plan     → WizardPlanRequest      → WizardStepPlan
  POST   /external/studio/v1/projects/{id}/wizard/{step}/confirm  → ConfirmStepRequest     → ProjectResponse
  POST   /external/studio/v1/projects/{id}/wizard/{step}/refine   → RefineStepRequest      → WizardStepPlan

  POST   /external/studio/v1/projects/{id}/builds           → CreateBuildRequest      → BuildResponse
  GET    /external/studio/v1/projects/{id}/builds           → list[BuildSummary]
  GET    /external/studio/v1/builds/{id}                    → BuildResponse
  GET    /external/studio/v1/builds/{id}/status             → BuildStatusResponse
  POST   /external/studio/v1/builds/{id}/publish            → ProjectResponse
  DELETE /external/studio/v1/builds/{id}                    → 204

  POST   /external/studio/v1/builds/{id}/frame/add          → AddStudioFrameRequest   → FrameResponse
  POST   /external/studio/v1/builds/{id}/frame/update       → UpdateStudioFrameRequest → FrameResponse
  POST   /external/studio/v1/builds/{id}/frame/delete       → DeleteStudioFrameRequest → FrameResponse
  POST   /external/studio/v1/builds/{id}/frame/reorder      → ReorderStudioFrameRequest → FrameResponse
  POST   /external/studio/v1/builds/{id}/render             → StudioRenderRequest      → StudioRenderResponse

This file is the external contract; internal tool/executor structures live
alongside their compute modules (services/studio_tools/, services/studio_executors/).

User-control surface — see AI_VIDEO_STUDIO.md §13 for the rationale + per-field
intent. Briefly, every layer of decision-making is overridable:
  • per-asset: AssetOverrides on each AssetRef
  • per-project: ProjectPreferences + ModelOverrides on CreateProjectRequest
  • per-wizard-step: WizardPlanRequest.{tools_disabled, tools_enabled, extra_context}
  • per-operation: ConfirmedStepPlan.{decisions, manual_operations, operation_order, skipped}
  • per-build: CreateBuildRequest.{name, notes, from_build_id, aspect, fps}
  • per-render: StudioRenderRequest with the full RenderOptionsBody-equivalent surface
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Shared enums
# ---------------------------------------------------------------------------

AssetKind = Literal["video", "image"]
AssetMode = Literal["podcast", "demo", "photo", "screenshot", "diagram"]
TargetAspect = Literal["9:16", "16:9", "1:1"]
WizardStep = Literal["arrangement", "cuts", "overlays", "audio"]
ProjectStatus = Literal["DRAFT", "PLANNING", "READY_TO_BUILD", "BUILDING", "PUBLISHED", "ARCHIVED"]
BuildStatus = Literal["PENDING", "BUILDING", "AWAITING_EDIT", "RENDERED", "FAILED"]
BuildStage = Literal[
    "PENDING", "ASSEMBLE_AUDIO", "ASSEMBLE_WORDS", "ASSEMBLE_TIMELINE",
    "COMPOSE_HTML", "UPLOAD", "HANDOFF", "RENDERED", "FAILED",
]
ToolUserAction = Literal["accepted", "rejected", "edited", "auto"]

# Project-level preference enums. All optional; absent = server default.
CutAggressiveness = Literal["light", "medium", "aggressive"]
CaptionPreset = Literal["hormozi", "karaoke", "pop", "clean", "none"]
BgmPolicy = Literal["auto", "always", "never"]
SfxPolicy = Literal["auto", "always", "never"]
TransitionStyle = Literal["cuts_only", "smooth", "energetic"]


# ---------------------------------------------------------------------------
# Per-asset overrides — user control at ingest time
# ---------------------------------------------------------------------------

class AssetOverrides(BaseModel):
    """User-declared hints applied to a single source asset across all wizard
    steps. Every field is optional; absent = LLM/tools decide freely.

    These let the user pre-empt the wizard when they already know what they
    want from a given asset (e.g. "only use minutes 2-5 of v1" → no need to
    wait for the Arrangement step to surface that).
    """
    # "Treat the asset as if it only spans [start, end] seconds." Tools that
    # consume the asset (pick_segments, detect_silences, face_track_reframe,
    # ...) clip their input to this range when set.
    initial_range_s: Optional[Tuple[float, float]] = Field(
        None, description="Pre-clip the asset to [start, end] seconds"
    )
    # Ranges that the user knows up front they want to skip — regardless of
    # what the cut detectors find. Applied additively.
    exclude_ranges_s: List[Tuple[float, float]] = Field(
        default_factory=list,
        description="Ranges (in source seconds) the user wants excluded a priori",
    )
    # Asset-stream override. audio_only = use the audio track, no video;
    # video_only = strip the source audio (master narration owns the audio).
    audio_only: bool = False
    video_only: bool = False
    # Face-tracking hint for reframe tools. Free-form string the user assigns
    # (e.g. "alice" / "host"); the face_track_reframe tool resolves it via
    # the indexer's face_segments / detection.
    primary_speaker_face_id: Optional[str] = None
    # Free-form per-asset note shown to the LLM verbatim ("the part where I
    # mention the partnership starts around 7:30 — emphasize that").
    notes: Optional[str] = Field(None, max_length=2000)

    @model_validator(mode="after")
    def _validate_ranges(self) -> "AssetOverrides":
        if self.audio_only and self.video_only:
            raise ValueError("audio_only and video_only are mutually exclusive")
        if self.initial_range_s is not None:
            s, e = self.initial_range_s
            if not (e > s >= 0):
                raise ValueError("initial_range_s must satisfy 0 <= start < end")
        for s, e in self.exclude_ranges_s:
            if not (e > s >= 0):
                raise ValueError(f"exclude range must satisfy 0 <= start < end ({s},{e})")
        return self


class AssetRef(BaseModel):
    """One indexed input asset that the project references.

    The `handle` is the user-facing reference name in their prompt (e.g.
    "give me the part where v1 talks about scaling"). Auto-numbered on
    project create (v1, v2, i1, i2…) and editable thereafter.
    """
    asset_id: str = Field(..., description="UUID of ai_input_assets.id")
    handle: str = Field(..., min_length=1, max_length=16,
                        description="User-facing reference name, e.g. 'v1' / 'i1'")
    kind: AssetKind
    mode: Optional[AssetMode] = None
    overrides: Optional[AssetOverrides] = None

    @field_validator("handle")
    @classmethod
    def _handle_no_spaces(cls, v: str) -> str:
        if any(c.isspace() for c in v):
            raise ValueError("handle must not contain whitespace")
        return v

    @field_validator("asset_id")
    @classmethod
    def _asset_id_is_uuid(cls, v: str) -> str:
        # asset_id maps to ai_input_assets.id (a UUID column). Validating the
        # format here turns a malformed id into a clean 422 instead of letting
        # it reach the `.in_()` query where psycopg2 raises → 500.
        from uuid import UUID
        try:
            UUID(v)
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"asset_id must be a valid UUID, got {v!r}")
        return v


# ---------------------------------------------------------------------------
# Project-level preferences — user-declared style/intent
# ---------------------------------------------------------------------------

class ProjectPreferences(BaseModel):
    """User-declared style/intent applied across every wizard step.

    All fields optional. The LLM's per-step prompt template includes any
    set fields verbatim so the model respects them at every decision point.
    Per-step refinements (RefineStepRequest) can override these locally.
    """
    cut_aggressiveness: Optional[CutAggressiveness] = Field(
        None,
        description=(
            "How surgical the cut detectors should be. "
            "light = only obvious silences; aggressive = also drop low-energy stretches."
        ),
    )
    caption_preset: Optional[CaptionPreset] = Field(
        None, description="Preferred caption preset. 'none' disables captions entirely."
    )
    bgm_policy: Optional[BgmPolicy] = Field(
        None, description="auto = LLM decides per project; always/never = hard rule."
    )
    sfx_policy: Optional[SfxPolicy] = None
    transition_style: Optional[TransitionStyle] = Field(
        None, description="cuts_only = no transitions; smooth/energetic = different presets."
    )
    color_scheme_hints: List[str] = Field(
        default_factory=list,
        description="Free-form color tokens the LLM should prefer (['indigo','white']).",
        max_length=8,
    )
    tone: Optional[str] = Field(
        None,
        max_length=120,
        description="Free-form tone hint ('energetic', 'calm', 'professional').",
    )
    notes: Optional[str] = Field(
        None,
        max_length=4000,
        description="Catch-all hints fed verbatim to every step's LLM prompt.",
    )


# ---------------------------------------------------------------------------
# V200 stage routing — per-project model overrides
# ---------------------------------------------------------------------------

class ModelOverrides(BaseModel):
    """Per-stage LLM model override for this project.

    Mirrors the AI-video `model_overrides` contract so the same FE control
    works for both pipelines. `default` applies to every user-overridable
    stage; `per_stage` wins where set. Pinned stages (vision_review, etc.)
    are silently ignored per V200 routing rules.

    Studio's user-overridable stages: studio_arrangement, studio_cuts,
    studio_overlays, studio_audio.
    """
    default: Optional[str] = Field(
        None,
        max_length=200,
        description="Default model id ('provider/model'); applied to every user-overridable stage.",
    )
    per_stage: Optional[Dict[str, str]] = Field(
        None,
        description="Per-stage override map {stage_id: model_id}; wins over `default`.",
    )

    @field_validator("default")
    @classmethod
    def _validate_default(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and "/" not in v:
            raise ValueError("model id must be in 'provider/model' format")
        return v

    @field_validator("per_stage")
    @classmethod
    def _validate_per_stage(cls, v: Optional[Dict[str, str]]) -> Optional[Dict[str, str]]:
        if v is None:
            return v
        for stage, model in v.items():
            if not isinstance(model, str) or "/" not in model or len(model) > 200:
                raise ValueError(f"per_stage[{stage}] must be 'provider/model', ≤200 chars")
        return v


# ---------------------------------------------------------------------------
# Create / update project
# ---------------------------------------------------------------------------

class CreateProjectRequest(BaseModel):
    name: Optional[str] = Field(
        None,
        max_length=160,
        description="Optional project name; server auto-derives from user_prompt if absent.",
    )
    source_asset_refs: List[AssetRef] = Field(..., min_length=1)
    user_prompt: Optional[str] = Field(None, max_length=8000)
    target_aspect: Optional[TargetAspect] = None
    target_duration_s: Optional[int] = Field(None, ge=5, le=3600)
    preferences: Optional[ProjectPreferences] = Field(
        None,
        description="Project-level style/intent applied to every wizard step.",
    )
    model_overrides: Optional[ModelOverrides] = Field(
        None,
        description="Per-stage LLM model overrides; V200 stage routing matrix.",
    )

    @model_validator(mode="after")
    def _unique_handles(self) -> "CreateProjectRequest":
        handles = [r.handle for r in self.source_asset_refs]
        if len(handles) != len(set(handles)):
            duplicates = sorted({h for h in handles if handles.count(h) > 1})
            raise ValueError(
                f"AssetRef handles must be unique within a project; duplicates: {duplicates}"
            )
        return self


class UpdateProjectRequest(BaseModel):
    """Partial update — any field None means leave alone.

    NOTE: clearing a field (e.g. removing user_prompt) is not currently
    supported through this endpoint; the repo's update_fields skips None.
    Use a dedicated future endpoint or send empty-string-as-sentinel pending
    a follow-up that introduces an UNSET sentinel.
    """
    name: Optional[str] = Field(None, max_length=160)
    source_asset_refs: Optional[List[AssetRef]] = None
    user_prompt: Optional[str] = Field(None, max_length=8000)
    target_aspect: Optional[TargetAspect] = None
    target_duration_s: Optional[int] = Field(None, ge=5, le=3600)
    preferences: Optional[ProjectPreferences] = None
    model_overrides: Optional[ModelOverrides] = None

    @model_validator(mode="after")
    def _unique_handles(self) -> "UpdateProjectRequest":
        if self.source_asset_refs is None:
            return self
        handles = [r.handle for r in self.source_asset_refs]
        if len(handles) != len(set(handles)):
            duplicates = sorted({h for h in handles if handles.count(h) > 1})
            raise ValueError(
                f"AssetRef handles must be unique within a project; duplicates: {duplicates}"
            )
        return self


# ---------------------------------------------------------------------------
# Plan + confirm (per-step wizard surface)
# ---------------------------------------------------------------------------

class OperationSpec(BaseModel):
    """A single LLM-emitted operation within a wizard step's plan.

    `tool` is the registry key from studio_tools/ (e.g. "pick_segments",
    "detect_silences", "propose_titles"). `params` is the tool-specific
    payload — each tool's validator coerces and rejects bad shapes.
    """
    tool: str = Field(..., max_length=64)
    params: Dict[str, Any] = Field(default_factory=dict)
    reason: Optional[str] = Field(None, max_length=1000)


class WizardStepPlan(BaseModel):
    """Output of POST /wizard/{step}/plan — the LLM's proposed operations.

    Returned unchanged from /refine. Confirmation is a separate step so the
    user can toggle individual operations on/off before persisting.
    """
    step: WizardStep
    operations: List[OperationSpec] = Field(default_factory=list)
    notes: Optional[str] = Field(None, description="Free-form LLM explanation shown above the cards.")


class WizardPlanRequest(BaseModel):
    """Body of POST /wizard/{step}/plan.

    Most calls need no body — the project's stored state is enough. Optional
    fields let the user constrain the LLM's tool catalog or feed a one-shot
    extra context hint without persisting it on the project.
    """
    extra_context: Optional[str] = Field(
        None,
        max_length=2000,
        description="One-shot context hint appended to the LLM prompt for THIS call only.",
    )
    tools_disabled: List[str] = Field(
        default_factory=list,
        description="Tool ids the LLM is forbidden from proposing for this step (e.g. ['propose_motion_graphics']).",
        max_length=32,
    )
    tools_enabled: List[str] = Field(
        default_factory=list,
        description="If non-empty, ONLY these tools may be proposed (tier filter still applies).",
        max_length=32,
    )

    @model_validator(mode="after")
    def _disjoint_tool_lists(self) -> "WizardPlanRequest":
        if self.tools_disabled and self.tools_enabled:
            overlap = set(self.tools_disabled) & set(self.tools_enabled)
            if overlap:
                raise ValueError(
                    f"tool ids cannot appear in both tools_disabled and tools_enabled: {sorted(overlap)}"
                )
        return self


class RefineStepRequest(BaseModel):
    """Body of POST /wizard/{step}/refine — user's free-form refinement intent."""
    refinement_prompt: str = Field(..., min_length=1, max_length=2000)


class OperationDecision(BaseModel):
    """User's per-operation choice in the confirm step."""
    operation_index: int = Field(..., ge=0)
    action: ToolUserAction
    edited_params: Optional[Dict[str, Any]] = None


class ConfirmedStepPlan(BaseModel):
    """What the FE submits to /wizard/{step}/confirm — and what gets persisted
    inside ai_studio_projects.confirmed_plan[step].

    User control surface:
      • `decisions`           — per-operation accept / reject / edit
      • `manual_operations`   — user-authored operations on top of the LLM's
      • `operation_order`     — reorder the LLM's operations (indices into
                                `operations`); manual_operations always come
                                after (in their submitted order)
      • `skipped`             — explicit "the user skipped this step entirely";
                                disambiguates from "user confirmed nothing"
    """
    step: WizardStep
    operations: List[OperationSpec] = Field(default_factory=list)
    decisions: List[OperationDecision] = Field(default_factory=list)
    manual_operations: List[OperationSpec] = Field(default_factory=list)
    operation_order: Optional[List[int]] = Field(
        None,
        description=(
            "Optional explicit ordering of `operations` (indices). If None, "
            "operations apply in their original LLM-emitted order."
        ),
    )
    skipped: bool = Field(
        False,
        description="True when the user explicitly skipped this step (build uses sensible defaults).",
    )

    @model_validator(mode="after")
    def _validate_order(self) -> "ConfirmedStepPlan":
        if self.operation_order is None:
            return self
        n = len(self.operations)
        if sorted(self.operation_order) != list(range(n)):
            raise ValueError(
                f"operation_order must be a permutation of range({n}); got {self.operation_order}"
            )
        return self


class ConfirmStepRequest(BaseModel):
    confirmed: ConfirmedStepPlan


# ---------------------------------------------------------------------------
# Builds (versioned snapshots)
# ---------------------------------------------------------------------------

class CreateBuildRequest(BaseModel):
    """Body of POST /projects/{id}/builds.

    `name` + `notes` give versioned builds human-readable labels (otherwise
    they're just v1/v2/v3). `from_build_id` lets the user fork from an
    EXISTING build's plan_snapshot rather than the project's current plan —
    useful when iterating from "v1 was great except the audio" without
    re-doing the whole wizard.

    aspect + fps override the project defaults for THIS build only; the
    project's stored target_aspect stays untouched.
    """
    name: Optional[str] = Field(
        None,
        max_length=120,
        description="Human-readable label ('Test 1', 'Final cut'). Persisted in extra_metadata.",
    )
    notes: Optional[str] = Field(
        None,
        max_length=2000,
        description="Why this build exists / what's different about it.",
    )
    from_build_id: Optional[str] = Field(
        None,
        description=(
            "Optional source build id whose plan_snapshot becomes the new build's "
            "starting plan. Default: project.confirmed_plan."
        ),
    )
    aspect: Optional[TargetAspect] = None
    fps: Optional[int] = Field(None, ge=15, le=60)


class BuildSummary(BaseModel):
    id: str
    project_id: str
    version: int
    name: Optional[str] = None
    notes: Optional[str] = None
    status: BuildStatus
    build_stage: BuildStage
    progress: int = Field(..., ge=0, le=100)
    has_video: bool = False
    is_published: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class BuildResponse(BaseModel):
    id: str
    project_id: str
    version: int
    name: Optional[str] = None
    notes: Optional[str] = None
    plan_snapshot: Dict[str, Any] = Field(default_factory=dict)
    status: BuildStatus
    build_stage: BuildStage
    progress: int = Field(..., ge=0, le=100)
    stages: List[Dict[str, Any]] = Field(default_factory=list)
    s3_urls: Dict[str, Any] = Field(default_factory=dict)
    config: Dict[str, Any] = Field(default_factory=dict)
    extra_metadata: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    is_published: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None


class BuildStatusResponse(BaseModel):
    id: str
    project_id: str
    version: int
    status: BuildStatus
    build_stage: BuildStage
    progress: int = Field(..., ge=0, le=100)
    error_message: Optional[str] = None
    # Live aggregator snapshot — same shape as ai_gen_video / ai_reels live.
    live: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Project response (full record)
# ---------------------------------------------------------------------------

class ProjectSummary(BaseModel):
    id: str
    institute_id: str
    name: Optional[str] = None
    status: ProjectStatus
    asset_count: int
    build_count: int
    published_build_id: Optional[str] = None
    target_aspect: Optional[TargetAspect] = None
    target_duration_s: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    institute_id: str
    name: Optional[str] = None
    source_asset_refs: List[AssetRef] = Field(default_factory=list)
    user_prompt: Optional[str] = None
    target_aspect: Optional[TargetAspect] = None
    target_duration_s: Optional[int] = None
    preferences: Optional[ProjectPreferences] = None
    model_overrides: Optional[ModelOverrides] = None
    confirmed_plan: Dict[str, Any] = Field(default_factory=dict)
    published_build_id: Optional[str] = None
    builds: List[BuildSummary] = Field(default_factory=list)
    status: ProjectStatus
    config: Dict[str, Any] = Field(default_factory=dict)
    extra_metadata: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    archived_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Editor /frame/* (per-build) — mirrors reels' frame contract
# ---------------------------------------------------------------------------

class AddStudioFrameRequest(BaseModel):
    html: str
    in_time: Optional[float] = None
    exit_time: Optional[float] = None
    z: Optional[int] = Field(0, description="0=base, 500+=overlay, 8000+=caption")
    entry_id: Optional[str] = Field(None, description="Client-generated entry id (optional)")
    insert_after_entry_id: Optional[str] = None
    html_start_x: Optional[int] = None
    html_start_y: Optional[int] = None
    html_end_x: Optional[int] = None
    html_end_y: Optional[int] = None
    entry_meta: Optional[Dict[str, Any]] = None


class UpdateStudioFrameRequest(BaseModel):
    entry_id: Optional[str] = Field(None, description="Stable entry id for verification")
    frame_index: Optional[int] = Field(None, description="Position in the timeline (fallback when entry_id missing)")
    # The shared editor store sends `new_html` (reels/video convention);
    # direct studio callers may send `html`. Accept both — no store fork needed.
    new_html: Optional[str] = None
    html: Optional[str] = None
    in_time: Optional[float] = None
    exit_time: Optional[float] = None
    z: Optional[int] = None
    entry_meta: Optional[Dict[str, Any]] = None

    @property
    def resolved_html(self) -> Optional[str]:
        """Prefer new_html (store) then html (direct callers)."""
        return self.new_html if self.new_html is not None else self.html

    @model_validator(mode="after")
    def _need_id_or_index(self) -> "UpdateStudioFrameRequest":
        if self.entry_id is None and self.frame_index is None:
            raise ValueError("either entry_id or frame_index is required")
        return self


class DeleteStudioFrameRequest(BaseModel):
    entry_id: Optional[str] = None
    frame_index: Optional[int] = None

    @model_validator(mode="after")
    def _need_id_or_index(self) -> "DeleteStudioFrameRequest":
        if self.entry_id is None and self.frame_index is None:
            raise ValueError("either entry_id or frame_index is required")
        return self


class ReorderStudioFrameRequest(BaseModel):
    entry_id: str
    to_index: int = Field(..., ge=0)


class FrameResponse(BaseModel):
    status: str = "ok"
    build_id: str
    entry_id: Optional[str] = None
    frame_index: Optional[int] = None
    timeline_url: Optional[str] = None
    total_duration: Optional[float] = None
    entry_count: Optional[int] = None
    message: Optional[str] = None


# ---------------------------------------------------------------------------
# Render (per-build) — matches AI-video RenderOptionsBody so the editor
# render UI works uniformly across pipelines.
# ---------------------------------------------------------------------------

CaptionFontFamily = Literal["system", "inter", "montserrat", "noto-sans", "fira-code"]
CaptionStyleKind = Literal["phrase", "karaoke"]
CaptionPosition = Literal["top", "bottom"]
CaptionSizeBucket = Literal["S", "M", "L"]
ResolutionBucket = Literal["720p", "1080p"]


class StudioRenderRequest(BaseModel):
    """Body of POST /builds/{id}/render.

    Mirrors the AI-video RenderOptionsBody contract exactly so a shared FE
    render dialog can drive both pipelines. Every caption knob is optional;
    the render worker falls back to its defaults when a field is absent.
    """
    resolution: Optional[ResolutionBucket] = "1080p"
    fps: Optional[int] = Field(None, ge=15, le=60, description="15, 20, 25, 30, 45, or 60")
    show_captions: Optional[bool] = True
    show_branding: Optional[bool] = True
    caption_position: Optional[CaptionPosition] = None
    caption_text_color: Optional[str] = Field(None, description="Hex color e.g. #ffffff")
    caption_bg_color: Optional[str] = Field(None, description="Hex color e.g. #000000")
    caption_bg_opacity: Optional[int] = Field(None, ge=0, le=100)
    caption_size: Optional[CaptionSizeBucket] = None
    caption_style: Optional[CaptionStyleKind] = None
    caption_font_family: Optional[CaptionFontFamily] = None
    caption_font_weight: Optional[int] = Field(
        None, description="400, 500, 600, 700, 800, or 900"
    )
    caption_text_stroke_width: Optional[int] = Field(
        None, ge=0, description="Outline width in px at 1920w canvas; 0 = no stroke"
    )
    caption_text_stroke_color: Optional[str] = Field(None, description="Hex stroke color")
    caption_highlight_color: Optional[str] = Field(
        None, description="Hex color for the active word in karaoke style"
    )
    caption_preset: Optional[str] = Field(
        None,
        description=(
            "Informational: which preset the client picked "
            "(youtube|tiktok|karaoke|cinema|branded|custom). Server resolves from field values."
        ),
    )


class StudioRenderResponse(BaseModel):
    job_id: str
    status: str
