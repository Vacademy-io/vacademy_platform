"""One model call for companions: glm-5.3-flash with low reasoning effort.

GLM-5.x refuses `reasoning: {enabled: false}` and, left at its default effort,
thought for ~8 minutes before writing an HTML page (2026-09-25). `effort=low`
starts output in seconds. The shared OpenRouter outline client sends no
reasoning field at all, so companions build their own request here.

Calls go through the platform model router (services/llm_router.py), so a
route set in the portal (e.g. GLM served by Isoquant, whose default effort is
max) still gets low effort. A failed call falls back once to a fast
non-reasoning model so a learner is never left with nothing because one
provider hiccupped.
"""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

from ...config import get_settings
from ..llm_router import post_chat

logger = logging.getLogger(__name__)

PRIMARY_MODEL = os.getenv("KB_COMPANION_MODEL", "z-ai/glm-5.3-flash")
FALLBACK_MODEL = os.getenv("KB_COMPANION_FALLBACK_MODEL", "google/gemini-2.5-flash")
REASONING_EFFORT = os.getenv("KB_COMPANION_REASONING_EFFORT", "low").strip().lower()
TIMEOUT_SECONDS = float(os.getenv("KB_COMPANION_LLM_TIMEOUT", "180"))
# Thinking tokens count against max_tokens on reasoning models: add headroom so
# a card is not cut off mid-tag (glm-5.3-flash returned 3 × "length" on a
# 12k budget in the tutor compiler, 2026-09-05).
_REASONING_HEADROOM = 4000


@dataclass
class LlmResult:
    content: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    finish_reason: Optional[str] = None
    extra: Dict[str, Any] = field(default_factory=dict)


def _is_reasoning_model(model: str) -> bool:
    return model.startswith("z-ai/glm")


def _payload(model: str, messages: List[Dict[str, str]], *, max_tokens: int, temperature: float, json_mode: bool) -> Dict[str, Any]:
    p: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        p["response_format"] = {"type": "json_object"}
    if _is_reasoning_model(model):
        p["reasoning"] = {"enabled": True, **({"effort": REASONING_EFFORT} if REASONING_EFFORT else {})}
        p["max_tokens"] = max_tokens + _REASONING_HEADROOM
    return p


async def _call(model: str, messages: List[Dict[str, str]], *, max_tokens: int, temperature: float, json_mode: bool) -> LlmResult:
    settings = get_settings()
    key = settings.openrouter_api_key or os.getenv("OPENROUTER_API_KEY")
    if not key:
        raise RuntimeError("OpenRouter key is not configured")
    # Through the platform model router: a model mapped to another gateway
    # (llm.model_routes, e.g. GLM → Isoquant) goes there, with our low effort
    # translated to its reasoning shape, and falls back to OpenRouter on failure.
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        resp = await post_chat(
            client,
            _payload(model, messages, max_tokens=max_tokens, temperature=temperature, json_mode=json_mode),
            key,
        )
    if resp.status_code >= 400:
        raise RuntimeError(f"OpenRouter {resp.status_code} for {model}: {resp.text[:300]}")
    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError(f"OpenRouter returned no choices for {model}")
    msg = choices[0].get("message") or {}
    content = msg.get("content") or ""
    if not content.strip():
        raise RuntimeError(f"{model} returned empty content (finish={choices[0].get('finish_reason')})")
    usage = data.get("usage") or {}
    return LlmResult(
        content=content,
        model=data.get("model") or model,
        prompt_tokens=int(usage.get("prompt_tokens") or 0),
        completion_tokens=int(usage.get("completion_tokens") or 0),
        finish_reason=choices[0].get("finish_reason"),
    )


async def complete(
    messages: List[Dict[str, str]],
    *,
    max_tokens: int = 4000,
    temperature: float = 0.4,
    json_mode: bool = False,
    label: str = "kb-companion",
) -> LlmResult:
    last: Optional[Exception] = None
    for model in dict.fromkeys([PRIMARY_MODEL, FALLBACK_MODEL]):
        try:
            return await _call(model, messages, max_tokens=max_tokens, temperature=temperature, json_mode=json_mode)
        except Exception as exc:  # noqa: BLE001
            last = exc
            logger.warning("%s: %s failed: %s", label, model, exc)
    raise RuntimeError(f"{label}: every model failed: {last}")


_FENCE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)


def parse_json(text: str) -> Dict[str, Any]:
    """A bare object, a fenced object, or prose around one object."""
    s = _FENCE.sub("", (text or "").strip())
    try:
        val = json.loads(s)
        if isinstance(val, dict):
            return val
    except ValueError:
        pass
    start, end = s.find("{"), s.rfind("}")
    if start >= 0 and end > start:
        val = json.loads(s[start:end + 1])
        if isinstance(val, dict):
            return val
    raise ValueError("no JSON object in model output")


async def complete_json(messages: List[Dict[str, str]], *, max_tokens: int = 6000, temperature: float = 0.4,
                        label: str = "kb-companion") -> tuple[Dict[str, Any], LlmResult]:
    """complete() + parse, with one retry when the output is not valid JSON."""
    last: Optional[Exception] = None
    for _ in range(2):
        res = await complete(messages, max_tokens=max_tokens, temperature=temperature, json_mode=True, label=label)
        try:
            return parse_json(res.content), res
        except ValueError as exc:
            last = exc
            logger.warning("%s: unparseable JSON from %s (finish=%s)", label, res.model, res.finish_reason)
    raise RuntimeError(f"{label}: no valid JSON: {last}")
