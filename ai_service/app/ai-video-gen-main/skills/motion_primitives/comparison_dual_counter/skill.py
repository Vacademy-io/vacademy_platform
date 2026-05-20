"""comparison_dual_counter — two big numbers side-by-side, both roll in sync.

Use for: before/after stats, A-vs-B comparisons, "from X to Y" deltas. Each
side has a number, an optional prefix/suffix, and a label below. A central
divider ("vs", "→", "to") separates them.

This skill exists because the most common "two-stat" beat today requires the
LLM to drop TWO `number_counter` skills and align them by hand. Half the time
the centering drifts, the labels don't align, or the divider is missing /
placed badly. Bundling into one skill makes the composition deterministic.

Orientation-aware: portrait stacks vertically with a horizontal divider;
landscape keeps side-by-side with a vertical divider.
"""
from typing import Dict, Any
import html as _html


METADATA = {
    "id": "comparison_dual_counter",
    "version": "1.0.0",
    "category": "motion_primitive",
    "title": "Comparison Dual Counter",
    "description": "Two big numbers rolling in sync, each with label, separated by a central divider ('vs' / '→' / 'to').",
    "use_when": "Before/after stats, A-vs-B comparisons, transformation deltas. The narrative beat is 'this number, vs this number'.",
    "compatible_shot_types": ["DATA_STORY", "TEXT_DIAGRAM"],
    "requires_tier": "ultra",
    "requires_plugins": ["gsap"],
    "requires_canvas": "any",
    "example_params": {
        "left":  {"from": 0, "to": 23, "label": "BEFORE", "suffix": "%",  "color": "var(--brand-text-secondary)"},
        "right": {"from": 0, "to": 87, "label": "AFTER",  "suffix": "%",  "color": "var(--brand-primary)"},
        "divider_text": "vs",
        "duration": 1.5,
        "delay": 0.45,
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["left", "right"],
    "properties": {
        "left":          {"type": "object"},
        "right":         {"type": "object"},
        "divider_text":  {"type": "string"},
        "duration":      {"type": "number"},
        "delay":         {"type": "number"},
    },
}


def _read_side(side: Dict[str, Any]) -> Dict[str, Any]:
    """Pull and sanitize one side's params. Returns dict with stable keys."""
    if not isinstance(side, dict):
        side = {}
    return {
        "from":     float(side.get("from", 0) or 0),
        "to":       float(side.get("to", 0) or 0),
        "prefix":   str(side.get("prefix", "") or ""),
        "suffix":   str(side.get("suffix", "") or ""),
        "label":    str(side.get("label", "") or ""),
        "color":    str(side.get("color", "") or "var(--brand-text)"),
        "decimals": int(side.get("decimals", 0) or 0),
    }


def _format_value(v: float, decimals: int) -> str:
    if decimals > 0:
        return f"{v:.{decimals}f}"
    return f"{int(round(v))}"


def render(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    left = _read_side(params.get("left"))
    right = _read_side(params.get("right"))
    divider_text = str(params.get("divider_text", "vs") or "vs")
    duration = float(params.get("duration", 1.5) or 1.5)
    delay = float(params.get("delay", 0.4) or 0.4)
    shot_idx = ctx.get("shot_index", 0)
    sid = f"cdc{shot_idx}"

    pack = ctx.get("shot_pack") or {}
    fs = (pack.get("font_scale") or {}) if isinstance(pack, dict) else {}
    fs_display = fs.get("display") or "clamp(2.5rem, min(13vw, 7.5vh), 9rem)"
    fs_label = fs.get("label") or "1.1rem"
    fs_divider = fs.get("h2") or "3rem"
    shot_duration = float(ctx.get("shot_duration", 5.0) or 5.0)

    canvas_w = int(ctx.get("canvas_w", 1920) or 1920)
    canvas_h = int(ctx.get("canvas_h", 1080) or 1080)
    is_portrait = canvas_h > canvas_w

    def side_html(key: str, s: Dict[str, Any]) -> str:
        label_html = (
            f'<div class="{sid}-label" style="color:var(--brand-text-secondary)">'
            f'{_html.escape(s["label"])}</div>' if s["label"] else ""
        )
        return (
            f'<div class="{sid}-side {sid}-{key}" id="{sid}-{key}">'
            f'<div class="{sid}-number" style="color:{s["color"]}">'
            f'<span class="{sid}-prefix">{_html.escape(s["prefix"])}</span>'
            f'<span class="{sid}-value" id="{sid}-{key}-v">'
            f'{_format_value(s["from"], s["decimals"])}'
            f'</span>'
            f'<span class="{sid}-suffix">{_html.escape(s["suffix"])}</span>'
            f'</div>'
            f'{label_html}'
            f'</div>'
        )

    html = (
        f'<div class="{sid}-wrap" id="{sid}-root">'
        f'{side_html("left", left)}'
        f'<div class="{sid}-divider" id="{sid}-div">'
        f'<span class="{sid}-divider-rule {sid}-divider-rule-top"></span>'
        f'<span class="{sid}-divider-text">{_html.escape(divider_text)}</span>'
        f'<span class="{sid}-divider-rule {sid}-divider-rule-bot"></span>'
        f'</div>'
        f'{side_html("right", right)}'
        f'</div>'
    )

    # Portrait → column flex with horizontal rules in the divider.
    # Landscape → row flex with vertical rules in the divider.
    if is_portrait:
        layout_css = f"""
.{sid}-wrap {{
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:1.4rem; padding:1.2rem 0; width:100%;
}}
.{sid}-divider {{
  display:flex; flex-direction:row; align-items:center; gap:0.8rem;
  width:62%; opacity:0;
}}
.{sid}-divider-rule {{
  flex:1; height:2px;
  background:linear-gradient(to right, transparent,
    var(--brand-text-secondary) 30%, var(--brand-text-secondary) 70%, transparent);
}}
"""
    else:
        layout_css = f"""
.{sid}-wrap {{
  display:flex; flex-direction:row; align-items:center; justify-content:center;
  gap:2rem; padding:1.2rem 0; width:100%;
}}
.{sid}-divider {{
  display:flex; flex-direction:column; align-items:center; gap:0.6rem;
  height:60%; opacity:0;
}}
.{sid}-divider-rule {{
  width:2px; flex:1;
  background:linear-gradient(to bottom, transparent,
    var(--brand-text-secondary) 30%, var(--brand-text-secondary) 70%, transparent);
}}
"""

    css = f"""
{layout_css}
.{sid}-side {{
  display:flex; flex-direction:column; align-items:center; gap:0.5rem;
  opacity:0; will-change:transform;
}}
.{sid}-number {{
  font-family:'Bebas Neue','Montserrat',sans-serif;
  font-size:{fs_display};
  line-height:0.9;
  font-variant-numeric:tabular-nums;
  display:flex; align-items:baseline; gap:0.04em;
  padding-bottom:0.12em;
}}
.{sid}-prefix, .{sid}-suffix {{
  color:var(--brand-accent); font-size:0.48em; font-weight:700;
}}
.{sid}-value {{ font-weight:900; }}
.{sid}-label {{
  font-family:'Inter',sans-serif;
  font-size:{fs_label};
  font-weight:700; letter-spacing:0.18em; text-transform:uppercase;
}}
.{sid}-divider-text {{
  font-family:'Bebas Neue','Montserrat',sans-serif;
  font-size:{fs_divider};
  color:var(--brand-accent); letter-spacing:0.04em;
  padding:0 0.3em; line-height:1;
}}
"""

    # Animation timeline.
    # 0.10s — divider scales in from a tighter axis (rotational feel via scaleY on
    #         landscape, scaleX on portrait).
    # `delay`  — both sides simultaneously fade up + the rolling number begins.
    # back-half — subtle scale breath on the whole wrap.
    if is_portrait:
        div_from, div_to = "scaleX:0.5", "scaleX:1"
        side_y_from, side_y_to = "y:18", "y:0"
    else:
        div_from, div_to = "scaleY:0.5", "scaleY:1"
        side_y_from, side_y_to = "y:14", "y:0"

    js_parts = [
        # Divider scales in early so it's visible before the numbers land.
        f"gsap.fromTo('#{sid}-div',"
        f"{{opacity:0, {div_from}}},"
        f"{{opacity:1, {div_to}, duration:0.45, delay:0.10, ease:'back.out(1.4)', transformOrigin:'center'}});",
        # Both sides slide up + fade together at `delay`.
        f"gsap.fromTo('#{sid}-left',"
        f"{{opacity:0, {side_y_from}}},"
        f"{{opacity:1, {side_y_to}, duration:0.55, delay:{delay:.3f}, ease:'power3.out'}});",
        f"gsap.fromTo('#{sid}-right',"
        f"{{opacity:0, {side_y_from}}},"
        f"{{opacity:1, {side_y_to}, duration:0.55, delay:{delay:.3f}, ease:'power3.out'}});",
    ]

    # Number rolls — one tween per side, synchronized.
    for key, s in (("left", left), ("right", right)):
        js_parts.append(
            f"{{var el=document.getElementById('{sid}-{key}-v');"
            f"if(el){{gsap.to({{v:{s['from']}}},"
            f"{{v:{s['to']}, duration:{duration}, delay:{delay:.3f}, ease:'power2.out',"
            f"onUpdate:function(){{var x=this.targets()[0].v;"
            f"el.textContent=({s['decimals']}>0?x.toFixed({s['decimals']}):Math.round(x)).toLocaleString();}}"
            f"}});}}}}"
        )

    # Back-half motion — subtle breath after numbers land.
    roll_finish = delay + duration
    back_half_delay = max(roll_finish + 0.3, shot_duration * 0.55)
    back_half_dur = max(0.8, shot_duration - back_half_delay)
    js_parts.append(
        f"gsap.fromTo('#{sid}-root',"
        f"{{scale:1}},"
        f"{{scale:1.012, duration:{back_half_dur:.2f}, delay:{back_half_delay:.2f}, ease:'sine.inOut'}});"
    )
    js = "\n".join(js_parts)

    # Audio: divider chime when it lands, two data_reveals when numbers start,
    # a positive sting when both finish rolling.
    audio_events = [
        {"role": "ui_emphasis", "t": 0.10,                              "volume_mul": 0.80, "skill_id": "comparison_dual_counter"},
        {"role": "data_reveal", "t": round(delay, 3),                    "volume_mul": 0.95, "skill_id": "comparison_dual_counter"},
        {"role": "ui_positive", "t": round(delay + duration, 3),         "volume_mul": 0.90, "skill_id": "comparison_dual_counter"},
    ]

    return {"html": html, "css": css, "js": js, "plugins": ["gsap"], "audio_events": audio_events}


def static_fallback(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """No-animation static version: both numbers rendered at final targets, no GSAP."""
    left = _read_side(params.get("left"))
    right = _read_side(params.get("right"))
    divider_text = str(params.get("divider_text", "vs") or "vs")
    shot_idx = ctx.get("shot_index", 0)
    sid = f"cdc{shot_idx}fb"

    pack = ctx.get("shot_pack") or {}
    fs = (pack.get("font_scale") or {}) if isinstance(pack, dict) else {}
    fs_display = fs.get("display") or "clamp(2.5rem, min(13vw, 7.5vh), 9rem)"
    fs_label = fs.get("label") or "1.1rem"
    fs_divider = fs.get("h2") or "3rem"

    def side_html(s: Dict[str, Any]) -> str:
        label_html = f'<div class="{sid}-label">{_html.escape(s["label"])}</div>' if s["label"] else ""
        return (
            f'<div class="{sid}-side">'
            f'<div class="{sid}-number" style="color:{s["color"]}">'
            f'<span class="{sid}-prefix">{_html.escape(s["prefix"])}</span>'
            f'<span class="{sid}-value">{_format_value(s["to"], s["decimals"])}</span>'
            f'<span class="{sid}-suffix">{_html.escape(s["suffix"])}</span>'
            f'</div>'
            f'{label_html}'
            f'</div>'
        )

    html = (
        f'<div class="{sid}-wrap">'
        f'{side_html(left)}'
        f'<div class="{sid}-divider">'
        f'<span class="{sid}-divider-rule"></span>'
        f'<span class="{sid}-divider-text">{_html.escape(divider_text)}</span>'
        f'<span class="{sid}-divider-rule"></span>'
        f'</div>'
        f'{side_html(right)}'
        f'</div>'
    )
    css = f"""
.{sid}-wrap {{ display:flex; flex-direction:row; align-items:center; justify-content:center; gap:2rem; padding:1.2rem 0; width:100%; }}
.{sid}-side {{ display:flex; flex-direction:column; align-items:center; gap:0.5rem; }}
.{sid}-number {{ font-family:'Bebas Neue','Montserrat',sans-serif; font-size:{fs_display}; line-height:0.9; font-variant-numeric:tabular-nums; display:flex; align-items:baseline; gap:0.04em; padding-bottom:0.12em; }}
.{sid}-prefix, .{sid}-suffix {{ color:var(--brand-accent); font-size:0.48em; font-weight:700; }}
.{sid}-value {{ font-weight:900; }}
.{sid}-label {{ font-family:'Inter',sans-serif; font-size:{fs_label}; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:var(--brand-text-secondary); }}
.{sid}-divider {{ display:flex; flex-direction:column; align-items:center; gap:0.6rem; height:60%; }}
.{sid}-divider-rule {{ width:2px; flex:1; background:linear-gradient(to bottom, transparent, var(--brand-text-secondary) 30%, var(--brand-text-secondary) 70%, transparent); }}
.{sid}-divider-text {{ font-family:'Bebas Neue','Montserrat',sans-serif; font-size:{fs_divider}; color:var(--brand-accent); letter-spacing:0.04em; padding:0 0.3em; line-height:1; }}
"""
    return {"html": html, "css": css, "js": "", "plugins": [], "audio_events": []}
