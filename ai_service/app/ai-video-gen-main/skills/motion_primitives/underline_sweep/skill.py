"""underline_sweep — text with an accent underline that sweeps in left-to-right.

Use for: heading emphasis, key term highlights, phrase callouts. Replaces the
hand-rolled `@keyframes` pattern the per-shot LLM tends to reinvent (and times
inconsistently). Three rule styles: solid (one bar), double (thick bar with a
thin shadow line below for editorial weight), gradient (accent → transparent
fade for a softer landing).

The skill emits a self-contained `<span>` that wraps the text plus an `::after`
pseudo-element animated via stroke-width / scaleX. Drop it inline anywhere.
"""
from typing import Dict, Any
import html as _html


METADATA = {
    "id": "underline_sweep",
    "version": "1.0.0",
    "category": "motion_primitive",
    "title": "Underline Sweep",
    "description": "Inline text with an accent underline that sweeps 0% → 100% width left-to-right (or RTL).",
    "use_when": "Heading emphasis, key-term highlights, phrase callouts. Best when you want one word/phrase inside a longer line to feel land-marked.",
    "compatible_shot_types": ["TEXT_DIAGRAM", "KINETIC_TITLE", "DATA_STORY", "LOWER_THIRD"],
    "requires_tier": "ultra",
    "requires_plugins": ["gsap"],
    "requires_canvas": "any",
    "example_params": {
        "text": "outcomes",
        "delay": 0.4,
        "duration": 0.55,
        "direction": "ltr",
        "style": "solid",
        "thickness": "0.12em",
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["text"],
    "properties": {
        "text":      {"type": "string"},
        "delay":     {"type": "number"},
        "duration":  {"type": "number"},
        "direction": {"type": "string"},   # "ltr" | "rtl"
        "style":     {"type": "string"},   # "solid" | "double" | "gradient"
        "thickness": {"type": "string"},
        "color":     {"type": "string"},
        "offset":    {"type": "string"},   # vertical gap between text baseline and rule
    },
}


def render(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    text = str(params.get("text", "") or "")
    delay = float(params.get("delay", 0.3) or 0.3)
    duration = float(params.get("duration", 0.55) or 0.55)
    direction = str(params.get("direction", "ltr") or "ltr").lower()
    style = str(params.get("style", "solid") or "solid").lower()
    thickness = str(params.get("thickness", "0.12em") or "0.12em")
    color = str(params.get("color", "") or "var(--brand-accent)")
    offset = str(params.get("offset", "0.06em") or "0.06em")
    shot_idx = ctx.get("shot_index", 0)
    sid = f"us{shot_idx}"

    # Sanitise: text is dropped directly into HTML and used as the visual
    # content. Skill output bypasses the per-shot LLM's escaping pass.
    safe_text = _html.escape(text)

    # Direction governs both the transform-origin AND the initial scaleX side.
    # LTR sweeps from left (origin:left, scaleX 0→1). RTL sweeps from right.
    origin = "left center" if direction != "rtl" else "right center"

    # Style governs the rule's appearance.
    if style == "double":
        rule_css = (
            f"background:{color};"
            f"box-shadow:0 calc({thickness} * 1.4) 0 0 {color};"
        )
    elif style == "gradient":
        # Direction-aware gradient — fades the trailing edge to soften the landing.
        gradient_dir = "to right" if direction != "rtl" else "to left"
        rule_css = (
            f"background:linear-gradient({gradient_dir}, {color} 0%, "
            f"{color} 65%, rgba(255,255,255,0) 100%);"
        )
    else:  # solid
        rule_css = f"background:{color};"

    html = (
        f'<span class="{sid}-wrap" id="{sid}-root">'
        f'<span class="{sid}-text">{safe_text}</span>'
        f'<span class="{sid}-rule" id="{sid}-rule"></span>'
        f'</span>'
    )

    # Inline-block on the wrapper so the rule width matches the text width
    # exactly (not the line width). `bottom: -offset` positions the rule just
    # below the text baseline. transform-origin from direction.
    css = f"""
.{sid}-wrap {{
  position:relative; display:inline-block; padding-bottom:{offset};
  /* descender clearance so g/y/p/q never get clipped by an aggressive parent */
  line-height:1.15;
}}
.{sid}-text {{ display:inline; color:inherit; }}
.{sid}-rule {{
  position:absolute; left:0; right:0; bottom:0;
  height:{thickness}; border-radius:calc({thickness} * 0.5);
  transform:scaleX(0); transform-origin:{origin};
  will-change:transform; pointer-events:none;
  {rule_css}
}}
"""

    js = (
        f'{{'
        f'gsap.to("#{sid}-rule",'
        f'{{scaleX:1, duration:{duration}, delay:{delay}, ease:"power3.out"}});'
        f'}}'
    )

    # Single audio event at sweep-start — paired with visual emphasis.
    audio_events = [
        {"role": "ui_emphasis", "t": round(delay, 3), "volume_mul": 0.85, "skill_id": "underline_sweep"},
    ]

    return {"html": html, "css": css, "js": js, "plugins": ["gsap"], "audio_events": audio_events}


def static_fallback(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """No-animation static version: rule rendered at full width, no GSAP."""
    text = str(params.get("text", "") or "")
    style = str(params.get("style", "solid") or "solid").lower()
    thickness = str(params.get("thickness", "0.12em") or "0.12em")
    color = str(params.get("color", "") or "var(--brand-accent)")
    offset = str(params.get("offset", "0.06em") or "0.06em")
    shot_idx = ctx.get("shot_index", 0)
    sid = f"us{shot_idx}fb"

    if style == "double":
        rule_css = f"background:{color};box-shadow:0 calc({thickness} * 1.4) 0 0 {color};"
    elif style == "gradient":
        rule_css = f"background:linear-gradient(to right, {color} 0%, {color} 65%, rgba(255,255,255,0) 100%);"
    else:
        rule_css = f"background:{color};"

    html = (
        f'<span class="{sid}-wrap">'
        f'<span class="{sid}-text">{_html.escape(text)}</span>'
        f'<span class="{sid}-rule"></span>'
        f'</span>'
    )
    css = f"""
.{sid}-wrap {{ position:relative; display:inline-block; padding-bottom:{offset}; line-height:1.15; }}
.{sid}-text {{ display:inline; color:inherit; }}
.{sid}-rule {{ position:absolute; left:0; right:0; bottom:0; height:{thickness}; border-radius:calc({thickness} * 0.5); {rule_css} }}
"""
    return {"html": html, "css": css, "js": "", "plugins": [], "audio_events": []}
