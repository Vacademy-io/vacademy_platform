"""How hard a reasoning-mandatory model should think on a video pipeline call.

GLM 5.x thinks on every request and cannot be told not to. The video pipeline's
OpenRouterClient used to send no reasoning setting at all, so the model thought
at its own default. Measured on the same 18-shot plan for the same model
(z-ai/glm-5.3-flash, 2026-10-01):

    no reasoning setting   188 s   5,654 reasoning tokens   $0.0046
    effort "high"          228 s     688 reasoning tokens   $0.00087

Both returned a complete, valid 18/18 plan. Saying "high" explicitly is about
five times cheaper than saying nothing, because "nothing" is not "off" - it is
the model's own, much heavier default. Routed to Isoquant (see
app/services/llm_router.py) the same "high" request took 49 s.

The setting is OpenRouter's `reasoning` object. The router translates it into
Isoquant's top-level `reasoning_effort` when a model is routed there, and it is
honoured as-is when the call stays on OpenRouter or fails over to it.
"""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

__all__ = ["REASONING_MANDATORY_PREFIXES", "DEFAULT_EFFORT", "video_reasoning_effort", "reasoning_for"]

# Models whose endpoint thinks whether or not it is asked to.
REASONING_MANDATORY_PREFIXES = ("z-ai/glm-5", "z-ai/glm-4.6v")

DEFAULT_EFFORT = "high"
# Efforts OpenRouter's reasoning object accepts. Isoquant's "max" is deliberately
# absent: if the gateway fails over, OpenRouter must still accept the request.
_VALID = ("low", "medium", "high")
_OFF = ("", "none", "off", "default")


def video_reasoning_effort() -> Optional[str]:
    """The configured effort, or None to send no reasoning setting at all.

    VIDEO_REASONING_EFFORT=off restores the old behaviour. An unrecognised value
    falls back to the default rather than producing a request that 400s.
    """
    raw = os.getenv("VIDEO_REASONING_EFFORT", DEFAULT_EFFORT).strip().lower()
    if raw in _OFF:
        return None
    return raw if raw in _VALID else DEFAULT_EFFORT


def reasoning_for(model: Optional[str]) -> Optional[Dict[str, Any]]:
    """OpenRouter-shaped reasoning object for `model`, or None to leave it out.

    Only reasoning-mandatory models get one. Everything else in the fallback
    chain (Gemini, Claude, ...) is sent exactly what it was sent before.
    """
    if not model or not any(model.startswith(p) for p in REASONING_MANDATORY_PREFIXES):
        return None
    effort = video_reasoning_effort()
    if effort is None:
        return None
    return {"enabled": True, "effort": effort}
