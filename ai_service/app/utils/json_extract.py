"""Shared JSON extraction/sanitization — Python analogue of media_service
JsonUtils.extractAndSanitizeJson. Used by every migrated AI feature that asks
an LLM for JSON and must tolerate markdown fences / surrounding prose.
"""
from __future__ import annotations

import json
import re
from typing import List, Optional

_FENCE_RE = re.compile(r"^```[a-zA-Z]*\s*|\s*```$", re.MULTILINE)


def extract_and_sanitize_json(raw: Optional[str]) -> Optional[str]:
    """Strip markdown fences, extract the outermost {...} (or [...]) span, and
    validate it parses. Returns the JSON string, or None if nothing valid found.
    """
    if not raw:
        return None

    text = _FENCE_RE.sub("", raw).strip()

    obj_start = text.find("{")
    arr_start = text.find("[")

    candidates: List[str] = []
    if arr_start != -1 and (obj_start == -1 or arr_start < obj_start):
        end = text.rfind("]")
        if end > arr_start:
            candidates.append(text[arr_start : end + 1])
    if obj_start != -1:
        end = text.rfind("}")
        if end > obj_start:
            candidates.append(text[obj_start : end + 1])
    candidates.append(text)  # clean JSON with no prose

    for candidate in candidates:
        try:
            json.loads(candidate)
            return candidate
        except Exception:  # noqa: BLE001
            continue
    return None
