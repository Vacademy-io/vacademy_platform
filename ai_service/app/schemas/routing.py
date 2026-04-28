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
