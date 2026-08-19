"""Support visuals — narration-synced imagery + a bundled inline icon set.

The video pipeline was typography-first: a 2.5-minute educational video
shipped with TWO real images. This module implements "visual beats": the
ShotPlanner authors per-shot `support_visuals` (concrete concepts tied to
narration phrases), a pipeline pre-pass resolves each to a real image URL
(AI-generated) or an inline SVG icon, and the per-shot HTML contract embeds
them revealed IN SYNC with the spoken phrase.

Design constraints:
  - Icons must work in BOTH the browser preview and the offline renderer →
    inline SVG only (no CDN, no sprite files). Stroke-based, currentColor,
    24x24 viewBox so shots can size/tint them freely.
  - Reveal timing is computed from the phrase's word position inside the
    shot's narration (word-index fraction × shot duration) — approximate but
    robust, and needs no access to the TTS timing files at HTML-gen time.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

# ─────────────────────────────────────────────────────────────────────────────
# Inline icon library (stroke, currentColor, 24x24). Deliberately generic —
# concept keywords map many topics onto few shapes.
# ─────────────────────────────────────────────────────────────────────────────

_I = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'

ICONS: Dict[str, str] = {
    "check":     f'<svg {_I}><path d="M20 6 9 17l-5-5"/></svg>',
    "cross":     f'<svg {_I}><path d="M18 6 6 18M6 6l12 12"/></svg>',
    "arrow":     f'<svg {_I}><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    "clock":     f'<svg {_I}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    "chart":     f'<svg {_I}><path d="M3 21h18M7 17V9M12 17V5M17 17v-6"/></svg>',
    "trend":     f'<svg {_I}><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>',
    "document":  f'<svg {_I}><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h7M9 17h7"/></svg>',
    "clipboard": f'<svg {_I}><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 2h6v4H9zM9 11h6M9 15h6"/></svg>',
    "person":    f'<svg {_I}><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>',
    "people":    f'<svg {_I}><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c1-3.5 3.5-5 6-5s5 1.5 6 5M15 15.5c2 .3 3.7 1.8 4.5 4.5"/></svg>',
    "heart":     f'<svg {_I}><path d="M12 21S4 14.5 4 9a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 5.5-8 12-8 12z"/><path d="M4 12h4l2-3 2 5 2-4 1 2h5"/></svg>',
    "gear":      f'<svg {_I}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>',
    "target":    f'<svg {_I}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
    "bulb":      f'<svg {_I}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 4 12.7c-.7.6-1 1.4-1 2.3H9c0-.9-.3-1.7-1-2.3A7 7 0 0 1 12 2z"/></svg>',
    "book":      f'<svg {_I}><path d="M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 0 2 2h14"/><path d="M9 7h7"/></svg>',
    "gradcap":   f'<svg {_I}><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v5"/></svg>',
    "play":      f'<svg {_I}><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z"/></svg>',
    "star":      f'<svg {_I}><path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z"/></svg>',
    "shield":    f'<svg {_I}><path d="M12 2 4 5v6c0 5 3.5 9.3 8 11 4.5-1.7 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/></svg>',
    "warning":   f'<svg {_I}><path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18v.5"/></svg>',
    "search":    f'<svg {_I}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.5-4.5"/></svg>',
    "steps":     f'<svg {_I}><path d="M4 20h5v-4h5v-4h5V8h5"/></svg>',
    "calendar":  f'<svg {_I}><rect x="3" y="5" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v5M16 2v5"/></svg>',
    "quiz":      f'<svg {_I}><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5A2.5 2.5 0 1 1 12 14.5M12 17.5v.5"/></svg>',
    "measure":   f'<svg {_I}><path d="m3 17 4-4 4 4 4-8 6 6"/><path d="M3 21h18"/></svg>',
    "stethoscope": f'<svg {_I}><path d="M5 3v5a5 5 0 0 0 10 0V3"/><path d="M10 13v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/></svg>',
}

_ICON_KEYWORDS = {
    "check": ("correct", "right", "success", "complete", "done", "solution", "answer", "tick", "valid"),
    "cross": ("wrong", "incorrect", "avoid", "myth", "not ", "no ", "error"),
    "arrow": ("next", "then", "flow", "progress", "forward", "transition"),
    "clock": ("time", "timed", "duration", "minutes", "schedule", "history", "wait"),
    "chart": ("chart", "data", "measure", "score", "metric", "statistic", "number", "outcome", "result", "track"),
    "trend": ("growth", "improve", "increase", "trend", "recovery", "gain"),
    "document": ("document", "report", "notes", "record", "plan", "form", "file"),
    "clipboard": ("clipboard", "checklist", "assessment", "questionnaire", "exam", "test", "assignment"),
    "person": ("patient", "person", "individual", "student", "clinician", "founder", "user"),
    "people": ("team", "people", "group", "community", "together", "shared", "communica"),
    "heart": ("heart", "health", "vital", "clinical", "medical", "care"),
    "gear": ("process", "system", "method", "mechanism", "technique", "setting", "framework"),
    "target": ("goal", "target", "objective", "focus", "aim", "precision", "diagnos"),
    "bulb": ("idea", "insight", "reasoning", "concept", "think", "learn", "understand"),
    "book": ("lesson", "course", "study", "read", "theory", "foundation", "knowledge", "section"),
    "gradcap": ("graduate", "master", "certif", "qualif", "education"),
    "play": ("video", "watch", "demo", "start"),
    "star": ("best", "quality", "excellen", "premium", "key"),
    "shield": ("safe", "protect", "trust", "reliab", "complian"),
    "warning": ("risk", "danger", "caution", "mistake", "misconception", "alert"),
    "search": ("find", "search", "identify", "observe", "detect", "reveal", "look"),
    "steps": ("step", "stage", "phase", "level", "stairs", "climb"),
    "calendar": ("week", "day", "month", "session", "appointment"),
    "quiz": ("quiz", "question", "why", "what", "how"),
    "measure": ("range", "motion", "angle", "goniometer", "movement", "walk", "gait", "function"),
    "stethoscope": ("examination", "palpation", "physio", "therapy", "doctor", "clinic", "diagnosis"),
}


def pick_icon(concept: str) -> Optional[str]:
    """Best-effort keyword → inline SVG. None when nothing matches (caller
    should then treat the item as a photo instead)."""
    c = (concept or "").lower()
    best, best_len = None, 0
    for name, kws in _ICON_KEYWORDS.items():
        for kw in kws:
            if kw in c and len(kw) > best_len:
                best, best_len = name, len(kw)
    return ICONS.get(best) if best else None


# ─────────────────────────────────────────────────────────────────────────────
# Normalization + reveal timing
# ─────────────────────────────────────────────────────────────────────────────

def normalize_support_visuals(raw: Any, cap: int = 4) -> List[Dict[str, str]]:
    """Coerce planner output into [{concept, phrase, kind}]. Empty on junk."""
    out: List[Dict[str, str]] = []
    if not isinstance(raw, list):
        return out
    for it in raw[:cap]:
        if not isinstance(it, dict):
            continue
        concept = str(it.get("concept") or "").strip()[:80]
        if not concept:
            continue
        kind = str(it.get("kind") or "photo").strip().lower()
        out.append({
            "concept": concept,
            "phrase": str(it.get("phrase") or "").strip()[:120],
            "kind": kind if kind in ("photo", "icon") else "photo",
            # `url` / `icon_svg` are attached by the resolver pre-pass.
        })
    return out


def _norm_words(text: str) -> List[str]:
    return re.sub(r"[^a-z0-9 ]", " ", (text or "").lower()).split()


def reveal_seconds(phrase: str, narration: str, duration_s: float, idx: int, total: int) -> float:
    """When (in seconds from shot start) the phrase is spoken — approximated
    by its word position in the narration. Falls back to an even stagger."""
    dur = max(1.0, float(duration_s or 0.0))
    nwords = _norm_words(narration)
    pwords = _norm_words(phrase)
    if nwords and pwords:
        first = pwords[0]
        for i, w in enumerate(nwords):
            if w == first:
                # confirm loose match of the next word too, when present
                if len(pwords) < 2 or (i + 1 < len(nwords) and nwords[i + 1] == pwords[1]):
                    return round(min(dur - 0.8, (i / max(1, len(nwords))) * dur), 2)
    # even stagger across the middle 70% of the shot
    return round(min(dur - 0.8, 0.15 * dur + (idx / max(1, total)) * 0.7 * dur), 2)


def build_support_visuals_block(shot: Dict[str, Any]) -> str:
    """The prompt block handed to the per-shot HTML LLM. Empty string when the
    shot has no RESOLVED visuals (never block generation on missing assets)."""
    items = shot.get("support_visuals") or []
    resolved = [it for it in items if isinstance(it, dict) and (it.get("url") or it.get("icon_svg"))]
    if not resolved:
        return ""
    narration = str(shot.get("narration_excerpt") or shot.get("narration_text") or "")
    try:
        dur = float(shot.get("end_time", 0) or 0) - float(shot.get("start_time", 0) or 0)
    except (TypeError, ValueError):
        dur = 0.0
    if dur <= 0:
        dur = float(shot.get("duration_estimate_s") or 8.0)
    lines = [
        "\n\n**🖼️ SUPPORT VISUALS (MANDATORY — embed EVERY item below):**",
        "These are pre-resolved, ready-to-use visual assets for concepts the "
        "narrator speaks in THIS shot. Embedding all of them is REQUIRED — a "
        "text-only layout is a FAILED shot. Rules:",
        "  - Reveal each visual AT its reveal_at time (seconds from shot start) "
        "with a GSAP tween (fade+rise or scale-in, 0.5-0.7s, expo.out) so imagery "
        "appears exactly as the narrator says it.",
        "  - Photos: use the EXACT url in an <img> (object-fit:cover, rounded "
        "corners, subtle shadow). Size them as real content (240-480px chips/"
        "panels integrated into the layout) — not tiny thumbnails, not full-bleed "
        "wallpaper unless the layout calls for it.",
        "  - Icons: paste the given inline <svg> EXACTLY as provided inside a "
        "styled container (tinted circle/rounded square); size 40-72px via CSS; "
        "color via `color:` (they use currentColor). Do NOT redraw or replace them.",
    ]
    for i, it in enumerate(resolved):
        t = reveal_seconds(it.get("phrase", ""), narration, dur, i, len(resolved))
        if it.get("url"):
            lines.append(f'  {i+1}. PHOTO "{it["concept"]}" — reveal_at={t}s — url: {it["url"]}')
        else:
            lines.append(f'  {i+1}. ICON "{it["concept"]}" — reveal_at={t}s — svg: {it["icon_svg"]}')
    return "\n".join(lines)
