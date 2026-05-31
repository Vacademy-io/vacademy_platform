"""DS_TAG protector — port of media_service HtmlJsonProcessor.removeTags /
restoreTagsInJson.

Protects media/math markup (img, svg, mjx-container) from the LLM round-trip:
`protect()` swaps each such element for an HTML comment `<!--DS_TAG:uuid-->` and
stashes the original; `restore_in_json()` walks the LLM's returned JSON and swaps
the comments back to the stored originals. Stateful per instance (like the Java
class), so the same instance must do both halves.
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict
from uuid import uuid4

# Match whole media/math elements. Order mirrors Java (mjx-container, img, svg).
_PATTERNS = [
    re.compile(r"<mjx-container\b[^>]*>.*?</mjx-container>", re.IGNORECASE | re.DOTALL),
    re.compile(r"<img\b[^>]*?/?>", re.IGNORECASE),
    re.compile(r"<svg\b[^>]*>.*?</svg>", re.IGNORECASE | re.DOTALL),
]
_MARKER_RE = re.compile(r"<!--DS_TAG:([0-9a-fA-F]+)-->")


class HtmlTagProtector:
    def __init__(self) -> None:
        self._store: Dict[str, str] = {}

    def protect(self, html: str) -> str:
        """Replace media/math elements with DS_TAG comments; stash originals."""
        self._store.clear()
        if not html:
            return html or ""
        out = html
        for pattern in _PATTERNS:
            def _sub(m: "re.Match[str]") -> str:
                uuid = uuid4().hex[:8]
                self._store[uuid] = m.group(0)
                return f"<!--DS_TAG:{uuid}-->"
            out = pattern.sub(_sub, out)
        return out

    def restore_in_json(self, json_str: str) -> str:
        """Parse JSON, swap DS_TAG comments in every string value back to the
        original HTML, re-serialize (re-escaping handled by json)."""
        if not json_str:
            return json_str
        try:
            root = json.loads(json_str)
        except Exception:  # noqa: BLE001
            return self._restore_in_text(json_str)  # fall back to raw-string swap
        return json.dumps(self._restore_in_obj(root), ensure_ascii=False)

    def _restore_in_obj(self, obj: Any) -> Any:
        if isinstance(obj, str):
            return self._restore_in_text(obj)
        if isinstance(obj, list):
            return [self._restore_in_obj(x) for x in obj]
        if isinstance(obj, dict):
            return {k: self._restore_in_obj(v) for k, v in obj.items()}
        return obj

    def _restore_in_text(self, text: str) -> str:
        return _MARKER_RE.sub(lambda m: self._store.get(m.group(1), m.group(0)), text)
