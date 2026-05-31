"""Shared 'prompt → sanitized JSON' LLM call with model fallback.

Used by every migrated feature that asks an LLM for a JSON document. Tries each
model in order (primary then fallbacks); for each, retries up to `attempts`
times on transient errors before moving on. Returns the sanitized JSON string,
the model that produced it, and token usage (for billing).
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

from ..adapters.openrouter_llm_client import OpenRouterOutlineLLMClient
from ..utils.json_extract import extract_and_sanitize_json

logger = logging.getLogger(__name__)

_MAX_ATTEMPTS = 3


async def generate_json(
    prompt: str,
    models: List[str],
    *,
    attempts: int = _MAX_ATTEMPTS,
    label: str = "llm",
) -> Tuple[str, str, Dict[str, int]]:
    """Returns (sanitized_json, model_used, usage_dict). Raises RuntimeError if
    every model fails or no parseable JSON is produced."""
    client = OpenRouterOutlineLLMClient()
    last_error: Optional[Exception] = None

    for model in models:
        for attempt in range(attempts):
            try:
                raw, usage = await client.generate_outline_with_usage(prompt, model)
                sanitized = extract_and_sanitize_json(raw)
                if sanitized:
                    return sanitized, model, usage
                logger.warning("%s: empty/unparseable output (model=%s attempt=%d)", label, model, attempt + 1)
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                logger.warning("%s: LLM call failed (model=%s attempt=%d): %s", label, model, attempt + 1, exc)
                break  # next model rather than retry a hard error

    raise RuntimeError(f"{label}: failed after trying {models}: {last_error}")
