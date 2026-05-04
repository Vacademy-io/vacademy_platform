"""
Routing schemas for the Intent Router.

The router runs at the top of the pipeline, reads the user's prompt + attached
resources, and emits a structured plan describing which tools to invoke and how
the rest of the pipeline should behave. The plan is exposed to the FE as a row
of toggles; user overrides win over router decisions.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


# Supported tools — adding a new tool is a one-line registry change here + a
# branch in video_generation_service.py to execute it.
ToolName = Literal["scrape_url", "web_search"]


class ToolDecision(BaseModel):
    """One tool the router decided to enable or disable."""
    name: ToolName
    enabled: bool
    params: Dict[str, Any] = Field(default_factory=dict)
    reason: str = ""
    source: Literal["router", "user"] = "router"


class RoutingConfig(BaseModel):
    """Pipeline behavior flags driven by the router (or user overrides)."""
    mute_tts_on_source_clips: bool = False
    source_clip_priority: Literal["low", "medium", "high"] = "medium"
    infographic_mode: Literal["side", "overlay", "sequential"] = "side"
    narration_fit_to_source: bool = False
    # 0 = no coverage check; e.g. 50 = warn if SOURCE_CLIP coverage < 50% of source duration
    coverage_min_pct: int = 0


class RoutingPlan(BaseModel):
    """Structured output of the IntentRouter, persisted to run_dir/routing_plan.json."""
    tools: List[ToolDecision] = Field(default_factory=list)
    config: RoutingConfig = Field(default_factory=RoutingConfig)
    explanation: str = ""

    def get_tool(self, name: ToolName) -> Optional[ToolDecision]:
        for t in self.tools:
            if t.name == name:
                return t
        return None

    def is_tool_enabled(self, name: ToolName) -> bool:
        t = self.get_tool(name)
        return bool(t and t.enabled)


class RoutePreviewRequest(BaseModel):
    """Lightweight body for POST /video/route-preview — no side effects."""
    prompt: str
    input_video_count: int = 0
    attached_file_count: int = 0
    orientation: Literal["landscape", "portrait"] = "landscape"
    content_type: str = "VIDEO"


# ---------------------------------------------------------------------------
# Video type classification (runs alongside IntentRouter, before SCRIPT)
# ---------------------------------------------------------------------------

# 11 canonical video types. Picked once per fresh video, threaded into
# pacing/cadence/Director/script prompts. Adding a new type = add label here +
# extend the rubric in video_type_classifier_service._SYSTEM_PROMPT.
VideoTypeLabel = Literal[
    "explainer",          # general educational concept walkthrough
    "tutorial",           # step-by-step how-to
    "news_recap",         # summarize an article / event / news story
    "product_promo",      # SaaS / consumer product marketing reel
    "case_study",         # business outcome storytelling
    "documentary",        # long-form factual narration
    "story",              # narrative / fictional storytelling
    "listicle",           # top-N / countdown-style
    "reel",               # short social-media-style hook
    "demo_walkthrough",   # UI / app / feature demo
    "pitch",              # investor / sales pitch
]


class VideoTypePlan(BaseModel):
    """Structured output of the VideoTypeClassifier, persisted to run_dir/video_type.json."""
    type: VideoTypeLabel = "explainer"
    confidence: float = 0.5  # 0..1
    reason: str = ""
    # Cadence preference *suggested* by the type, expressed in shot-density terms.
    # Director cadence still reads (duration, orientation, type) — this is a hint,
    # not an override.
    cadence_hint: Literal["reel", "marketing", "education", "documentary"] = "education"
    source: Literal["router", "user", "default"] = "router"


# ---------------------------------------------------------------------------
# Host plan (output of HostPlannerService — runs in pre-script preamble)
# ---------------------------------------------------------------------------

# HostConfig (the request shape) lives in schemas/video_generation.py to keep
# request-side schemas grouped. HostPlan is the *derived* runtime shape the
# pipeline operates on after tier-gating + normalisation. Persisted to
# run_dir/host_plan.json + extra_metadata.host (inputs block).

class HostAvatarPlan(BaseModel):
    """Resolved avatar config the pipeline consumes.

    `provider` decides the per-shot generation path:
      • 'custom'  → Seedream image-to-image conditioned on `face_image_url`,
                    then `avatar_model` (Kling v2 / VEED Fabric) for talking-head.
      • 'argil'   → fal.ai `argil/avatars/audio-to-video` keyed by
                    `external_avatar_id`. No Seedream, no face image. Locked
                    identity + scene per the catalog enum.
      • 'veed'    → fal.ai `veed/avatars/audio-to-video` keyed by
                    `external_avatar_id`. Same shape as Argil.

    For built-in providers, `face_image_url` is empty and `avatar_model` is
    irrelevant — the provider's endpoint is fixed.
    """
    provider: Literal["custom", "argil", "veed"] = "custom"
    external_avatar_id: Optional[str] = None
    face_image_url: str = ""
    details_prompt: str = ""
    avatar_model: Literal[
        "fal-ai/kling-video/ai-avatar/v2/standard",
        "veed/fabric-1.0",
    ] = "fal-ai/kling-video/ai-avatar/v2/standard"
    quality: Literal["480p", "720p"] = "480p"


class HostRawPlan(BaseModel):
    input_video_ids: List[str]


class HostPlan(BaseModel):
    """Pipeline-side host plan. Built once in the pre-script preamble.

    `enabled=False` means: request had no host OR tier-gate dropped it.
    Downstream stages branch on `enabled` and on `type`.
    """
    enabled: bool = False
    type: Literal["avatar", "raw"] = "avatar"
    host_in_video_percentage: int = 100
    avatar: Optional[HostAvatarPlan] = None
    raw: Optional[HostRawPlan] = None

    def is_avatar(self) -> bool:
        return self.enabled and self.type == "avatar" and self.avatar is not None

    def is_raw(self) -> bool:
        return self.enabled and self.type == "raw" and self.raw is not None
