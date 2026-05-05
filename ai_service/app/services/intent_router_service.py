"""
Intent Router — runs first in the pipeline, reads the user's prompt + attached
resources, and emits a structured RoutingPlan (which tools to fire, which
behavioral flags to set, plus a one-paragraph human explanation).

The plan is persisted to run_dir/routing_plan.json and exposed to the FE as
toggles. User overrides win over router decisions; failures are non-fatal —
on any error the safe default RoutingPlan is returned so the rest of the
pipeline behaves like it does today.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

import httpx

from ..constants.models import DEFAULT_MODEL as _DEFAULT_MODEL
from ..schemas.routing import (
    RoutingConfig,
    RoutingPlan,
    ToolDecision,
)

logger = logging.getLogger(__name__)

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_HTTP_TIMEOUT_S = 20.0

_SYSTEM_PROMPT = """You are an Intent Router for an AI video generation pipeline.

Read the user's prompt + attached resources, and return a JSON plan describing:
  - which tools to invoke (scrape_url, web_search)
  - how the rest of the pipeline should behave (config flags)
  - a one-paragraph human explanation users will see in the UI

OUTPUT SHAPE (strict JSON):
{
  "tools": [
    {
      "name": "scrape_url" | "web_search",
      "enabled": true | false,
      "params": { ... },              // see below
      "reason": "<short justification — 1 sentence>"
    }
  ],
  "config": {
    "mute_tts_on_source_clips": bool, // mute TTS narration during source clips
    "source_clip_priority": "low" | "medium" | "high", // how strongly Director should favor SOURCE_CLIP
    "infographic_mode": "side" | "overlay" | "sequential", // how source clips are framed
    "narration_fit_to_source": bool,  // narration must fit within sum of source video durations
    "coverage_min_pct": 0..100        // 0 = no check; e.g. 50 = warn if SOURCE_CLIP < 50% of source
  },
  "explanation": "<one short paragraph the user sees>"
}

TOOL PARAMS:
  - scrape_url: {"url": "<the URL to scrape>"} — only the FIRST URL detected
  - web_search: {"query": "<concise focused query you derive from the prompt>"}

DECISION RUBRIC:
1. INPUT VIDEOS PROVIDED + prompt says "cover the demo" / "just the videos" / "do not add extra parts" / "trim based on need":
   → DISABLE scrape_url AND web_search (videos cover the topic)
   → config: mute_tts_on_source_clips=true, source_clip_priority="high", narration_fit_to_source=true, coverage_min_pct=50
   → If prompt also says "in the same screen" / "on top of the video" / "infographics along the video": infographic_mode="overlay"
   → Otherwise infographic_mode="side"

2. PROMPT HAS A URL + NO INPUT VIDEOS:
   → ENABLE scrape_url with that URL
   → If prompt also asks for broader context (e.g. "compare X with others"): also enable web_search
   → config: source_clip_priority="medium", infographic_mode="side", narration_fit_to_source=false

3. PROMPT ASKS FOR CURRENT/FACTUAL INFO (keywords: "latest", "research", "what is", "compare", "recent", "news", "today's", "current") + NO URL/files/videos:
   → ENABLE web_search; query should be a concise focused search query derived from the prompt
   → DISABLE scrape_url
   → config: source_clip_priority="medium", infographic_mode="side"

4. INPUT VIDEOS + RICH REFERENCE FILES already cover the topic:
   → DISABLE web_search (we have grounding)
   → scrape_url decision follows rule 1 logic

5. NO URL, NO VIDEOS, NO FILES, NO research-y phrasing (basic explainer / how-to / story):
   → DISABLE both tools
   → config: defaults (medium priority, side mode)

ALWAYS:
  - Set source=router (default; the merge step sets source=user when overrides apply)
  - Reason field must be a SHORT, SPECIFIC justification a user can verify ("you have 2 demo videos so the pipeline focuses on them")
  - If a tool is DISABLED, you MUST still include it in the tools[] list with enabled=false and a reason
  - Explanation should be 1-2 sentences in friendly second-person ("I'll use your demos as the main footage and skip the website capture so the video stays focused.")

EXAMPLE — User has 2 input videos + URL https://vacademy.io + prompt about covering the demo:
{
  "tools": [
    {"name": "scrape_url", "enabled": false, "params": {"url": "https://vacademy.io"},
     "reason": "You have 2 demo videos covering the content; skipping the website capture keeps the focus on your footage."},
    {"name": "web_search", "enabled": false, "params": {},
     "reason": "Your demo videos provide the grounding; no extra search needed."}
  ],
  "config": {
    "mute_tts_on_source_clips": true,
    "source_clip_priority": "high",
    "infographic_mode": "overlay",
    "narration_fit_to_source": true,
    "coverage_min_pct": 50
  },
  "explanation": "I'll use your 2 demo videos as the primary footage with infographic overlays floating on top, mute TTS during clips so you hear the original demo audio, and keep the narration within the demo length."
}

EXAMPLE — Prompt "create a 90s video about latest Mars rover findings":
{
  "tools": [
    {"name": "scrape_url", "enabled": false, "params": {},
     "reason": "No URL provided in the prompt."},
    {"name": "web_search", "enabled": true, "params": {"query": "latest NASA Mars rover findings 2026"},
     "reason": "Prompt asks for current findings — searching the web for up-to-date sources."}
  ],
  "config": {
    "mute_tts_on_source_clips": false,
    "source_clip_priority": "medium",
    "infographic_mode": "side",
    "narration_fit_to_source": false,
    "coverage_min_pct": 0
  },
  "explanation": "I'll search the web for the latest Mars rover findings so the script is grounded in current sources."
}

Return ONLY the JSON object. No prose, no markdown fences.
"""


class IntentRouterService:
    """Single LLM call → structured RoutingPlan."""

    def __init__(self, openrouter_key: str, model: str = _DEFAULT_MODEL):
        self._openrouter_key = openrouter_key
        self._model = model

    async def route(
        self,
        prompt: str,
        *,
        input_video_count: int = 0,
        attached_file_count: int = 0,
        urls_in_prompt: Optional[List[str]] = None,
        orientation: str = "landscape",
        content_type: str = "VIDEO",
    ) -> RoutingPlan:
        """Return a RoutingPlan. On any failure: return safe defaults."""
        urls_in_prompt = urls_in_prompt or []
        if not self._openrouter_key:
            logger.warning("[IntentRouter] No OpenRouter key — returning default plan")
            return _default_plan(urls_in_prompt, input_video_count)

        user_msg = (
            f"USER PROMPT:\n{prompt}\n\n"
            f"ATTACHED RESOURCES:\n"
            f"  - input_videos: {input_video_count}\n"
            f"  - reference_files: {attached_file_count}\n"
            f"  - urls_in_prompt: {urls_in_prompt}\n"
            f"  - orientation: {orientation}\n"
            f"  - content_type: {content_type}\n"
        )

        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            "temperature": 0.1,
            "max_tokens": 800,
            "response_format": {"type": "json_object"},
        }
        headers = {
            "Authorization": f"Bearer {self._openrouter_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
                resp = await client.post(_OPENROUTER_URL, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
            content = data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.warning(f"[IntentRouter] LLM call failed (using defaults): {e}")
            return _default_plan(urls_in_prompt, input_video_count)

        # Tolerate stray markdown fences just in case
        content_clean = content.strip()
        if content_clean.startswith("```"):
            content_clean = content_clean.strip("`")
            if content_clean.lower().startswith("json"):
                content_clean = content_clean[4:].strip()

        try:
            raw = json.loads(content_clean)
            plan = RoutingPlan.model_validate(raw)
        except Exception as e:
            logger.warning(f"[IntentRouter] Parse failed (using defaults): {e}; raw={content[:300]!r}")
            return _default_plan(urls_in_prompt, input_video_count)

        # Backstop: ensure both known tools are represented in the plan
        plan = _ensure_tool_present(plan, "scrape_url", urls_in_prompt)
        plan = _ensure_tool_present(plan, "web_search", urls_in_prompt)
        logger.info(f"[IntentRouter] Plan: {plan.explanation}")
        return plan


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _default_plan(urls_in_prompt: List[str], input_video_count: int) -> RoutingPlan:
    """Safe default when the router LLM is unavailable or failed.

    Mirrors the pre-router hardcoded behavior: scrape if there's a URL and
    no input videos; never search; medium priority; side layout.
    """
    tools: List[ToolDecision] = []
    if urls_in_prompt and input_video_count == 0:
        tools.append(ToolDecision(
            name="scrape_url",
            enabled=True,
            params={"url": urls_in_prompt[0]},
            reason="Default: URL detected and no input videos.",
        ))
    else:
        tools.append(ToolDecision(
            name="scrape_url",
            enabled=False,
            params={"url": urls_in_prompt[0]} if urls_in_prompt else {},
            reason="Default: input videos provided, skipping URL capture." if input_video_count else "Default: no URL detected.",
        ))
    tools.append(ToolDecision(
        name="web_search",
        enabled=False,
        params={},
        reason="Default: web search not enabled without router LLM.",
    ))
    config = RoutingConfig(
        mute_tts_on_source_clips=bool(input_video_count),
        source_clip_priority="medium",
        infographic_mode="side",
        narration_fit_to_source=False,
        coverage_min_pct=0,
    )
    return RoutingPlan(
        tools=tools,
        config=config,
        explanation="Using default routing (router unavailable).",
    )


def _ensure_tool_present(plan: RoutingPlan, name: str, urls_in_prompt: List[str]) -> RoutingPlan:
    """If the LLM omitted a tool, add it as disabled so FE always sees both toggles."""
    if any(t.name == name for t in plan.tools):
        return plan
    if name == "scrape_url":
        params = {"url": urls_in_prompt[0]} if urls_in_prompt else {}
        plan.tools.append(ToolDecision(
            name="scrape_url", enabled=False, params=params,
            reason="Not selected by router.",
        ))
    elif name == "web_search":
        plan.tools.append(ToolDecision(
            name="web_search", enabled=False, params={},
            reason="Not selected by router.",
        ))
    return plan


def apply_overrides(plan: RoutingPlan, overrides: Optional[Dict[str, Any]]) -> RoutingPlan:
    """Sparse override merge.

    Shape:
      {
        "tools": {"scrape_url": true, "web_search": false},  // bool only flips enabled
        "config": {"mute_tts_on_source_clips": true, ...}
      }

    Overridden ToolDecision.source becomes 'user'. Config overrides replace
    individual fields only; unset fields keep router's choice.
    """
    if not overrides:
        return plan

    # Tool overrides — only `enabled` is overridable; reason gets a marker
    tool_overrides = (overrides.get("tools") or {}) if isinstance(overrides, dict) else {}
    if isinstance(tool_overrides, dict):
        for tool in plan.tools:
            if tool.name in tool_overrides:
                new_enabled = bool(tool_overrides[tool.name])
                if new_enabled != tool.enabled:
                    tool.enabled = new_enabled
                    tool.source = "user"
                    tool.reason = f"User override → {'enabled' if new_enabled else 'disabled'}."

    # Config overrides — replace fields one by one
    cfg_overrides = (overrides.get("config") or {}) if isinstance(overrides, dict) else {}
    if isinstance(cfg_overrides, dict) and cfg_overrides:
        cfg_dict = plan.config.model_dump()
        for key, val in cfg_overrides.items():
            if key in cfg_dict:
                cfg_dict[key] = val
        try:
            plan.config = RoutingConfig.model_validate(cfg_dict)
        except Exception as e:
            logger.warning(f"[IntentRouter] Bad config override {cfg_overrides}: {e}")

    return plan
