"""Does a finished timeline actually contain the film that was planned?

Extracted so it can be tested without the service's database imports — these
are pure functions over a timeline JSON and its HTML.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, Optional

__all__ = ["_frame_is_substantive", "_timeline_coverage"]


def _frame_is_substantive(html: str) -> bool:
    """True when a timeline entry actually shows something.

    The pipeline's empty fallback is a few hundred bytes carrying only a GSAP
    fade — no text, no image, no vector. It renders as a white screen and is
    indistinguishable from a real shot in every status field, so it shipped.
    """
    if not html:
        return False
    body = html
    for marker in ('<div id="shot-root"', "<div id='shot-root'"):
        i = body.find(marker)
        if i != -1:
            body = body[i:]
            break
    # Length is not the test. A compact frame can be perfectly good, and the
    # empty fallback is only ~640 bytes — but what makes it empty is that it
    # carries no text and no media, not that it is short.
    stripped = re.sub(r"<(script|style)\b.*?</\1>", "", body, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", stripped)
    if len(re.sub(r"\s+", " ", text).strip()) >= 40:
        return True
    return ("<img" in body) or ("<svg" in body) or ("<video" in body)


def _timeline_coverage(run_dir) -> Optional[Dict[str, Any]]:
    """Compare planned shots against timeline entries that actually render.

    Returns None when the timeline is unreadable — an unknown answer must not
    be reported as a failure.
    """
    tl = Path(run_dir) / "timeline" / "time_based_frame.json"
    if not tl.exists():
        for cand in Path(run_dir).rglob("time_based_frame.json"):
            tl = cand
            break
    if not tl.exists():
        return None
    try:
        data = json.loads(tl.read_text())
    except Exception:
        return None
    planned = [s for s in (data.get("meta", {}) or {}).get("shots", []) or []]
    if not planned:
        return None
    entries = {e.get("id"): e for e in (data.get("entries") or [])}
    missing = []
    for s in planned:
        idx = s.get("shot_idx")
        if idx is None:
            continue
        e = entries.get(f"shot-{idx + 1}")
        if e is None or not _frame_is_substantive(e.get("html") or ""):
            missing.append(idx)
    return {"planned": len(planned), "present": len(planned) - len(missing), "missing": missing}


