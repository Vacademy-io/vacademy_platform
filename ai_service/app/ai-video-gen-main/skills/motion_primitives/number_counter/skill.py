"""number_counter — big hero number rolling from `from` to `to` over duration.

Use for: stat callouts, KPIs, headline numbers, metric reveals. The number
uses tabular-nums so the digit width doesn't jitter during the roll.
"""
from typing import Dict, Any

METADATA = {
    "id": "number_counter",
    "version": "1.1.0",
    "category": "motion_primitive",
    "title": "Number Counter Roll",
    "description": "Large hero number rolling from a starting value to a target, with optional prefix/suffix.",
    "use_when": "Headline stats, KPIs, metric reveals, countdowns ('75 BPM', '$2.3M', '99.9%').",
    "compatible_shot_types": ["DATA_STORY", "TEXT_DIAGRAM", "IMAGE_HERO", "*"],
    "requires_tier": "ultra",
    "requires_plugins": ["gsap"],
    "requires_canvas": "any",
    "example_params": {
        "from": 0,
        "to": 75,
        "duration": 1.5,
        "delay": 0.4,
        "suffix": " BPM",
        "label": "Resting heart rate",
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["to"],
    "properties": {
        "from": {"type": "number"},
        "to": {"type": "number"},
        "duration": {"type": "number"},
        "delay": {"type": "number"},
        "prefix": {"type": "string"},
        "suffix": {"type": "string"},
        "label": {"type": "string"},
        "decimals": {"type": "integer"},
    },
}


def render(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    start = float(params.get("from", 0) or 0)
    end = float(params.get("to", 0) or 0)
    duration = float(params.get("duration", 1.2) or 1.2)
    delay = float(params.get("delay", 0.3) or 0.3)
    prefix = str(params.get("prefix", ""))
    suffix = str(params.get("suffix", ""))
    label = str(params.get("label", ""))
    decimals = int(params.get("decimals", 0) or 0)
    shot_idx = ctx.get("shot_index", 0)
    sid = f"nc{shot_idx}"

    # Canvas-aware font sizes via shot_pack (4-bucket caps). Falls back to the
    # old hardcoded values when shot_pack isn't wired (tests / older callers).
    pack = ctx.get("shot_pack") or {}
    fs = (pack.get("font_scale") or {}) if isinstance(pack, dict) else {}
    fs_display = fs.get("display") or "9rem"
    fs_label = fs.get("label") or "1.1rem"
    shot_duration = float(ctx.get("shot_duration", 5.0) or 5.0)

    label_html = f'<div class="{sid}-label">{label}</div>' if label else ""
    html = (
        f'<div class="{sid}-wrap" id="{sid}-root">'
        f'{label_html}'
        f'<div class="{sid}-number">'
        f'<span class="{sid}-prefix">{prefix}</span>'
        f'<span class="{sid}-value" id="{sid}-val">{_format_value(start, decimals)}</span>'
        f'<span class="{sid}-suffix">{suffix}</span>'
        f'</div>'
        f'</div>'
    )

    css = f"""
.{sid}-wrap {{ display:flex; flex-direction:column; align-items:center; gap:0.8rem; padding:1rem 0; will-change:transform; }}
.{sid}-label {{ font-size:{fs_label}; font-weight:600; color:var(--brand-text-secondary); text-transform:uppercase; letter-spacing:0.12em; }}
.{sid}-number {{ font-family:'Bebas Neue','Montserrat',sans-serif; font-size:{fs_display}; line-height:0.9; color:var(--brand-primary); font-variant-numeric:tabular-nums; display:flex; align-items:baseline; gap:0.06em; padding-bottom:0.12em; }}
.{sid}-prefix, .{sid}-suffix {{ color:var(--brand-accent); font-size:0.5em; font-weight:700; }}
.{sid}-value {{ font-weight:900; }}
"""

    # Back-half motion: after the counter lands, drift the wrap subtly so the
    # shot doesn't go static for the rest of its duration (validator requires
    # a tween with delay >= 0.55 × shot_duration).
    back_half_delay = max(delay + duration + 0.2, shot_duration * 0.55)
    back_half_dur = max(0.8, shot_duration - back_half_delay)
    js = (
        f'{{'
        f'var el=document.getElementById("{sid}-val");'
        f'if(el){{'
        f'gsap.to({{v:{start}}},{{v:{end}, duration:{duration}, delay:{delay}, ease:"power2.out", '
        f'onUpdate:function(){{'
        f'var v=this.targets()[0].v;'
        f'el.textContent=({decimals}>0?v.toFixed({decimals}):Math.round(v)).toLocaleString();'
        f'}}}});'
        f'}}'
        f'gsap.fromTo("#{sid}-root",'
        f'{{scale:1, y:0}},'
        f'{{scale:1.012, y:-2, duration:{back_half_dur:.2f}, delay:{back_half_delay:.2f}, ease:"sine.inOut"}});'
        f'}}'
    )

    # Audio events: counter-start beep at the moment the number begins rolling,
    # positive sting at the moment it lands on the target.
    audio_events = [
        {"role": "data_reveal", "t": round(delay, 3),            "volume_mul": 1.00, "skill_id": "number_counter"},
        {"role": "ui_positive", "t": round(delay + duration, 3), "volume_mul": 0.90, "skill_id": "number_counter"},
    ]

    return {"html": html, "css": css, "js": js, "plugins": ["gsap"], "audio_events": audio_events}


def _format_value(v: float, decimals: int) -> str:
    if decimals > 0:
        return f"{v:.{decimals}f}"
    return f"{int(round(v))}"


def static_fallback(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """No-animation static version: number shown at its final target value.
    Used when render() raises or params are invalid."""
    end = float(params.get("to", 0) or 0)
    prefix = str(params.get("prefix", ""))
    suffix = str(params.get("suffix", ""))
    label = str(params.get("label", ""))
    decimals = int(params.get("decimals", 0) or 0)
    shot_idx = ctx.get("shot_index", 0)
    sid = f"nc{shot_idx}fb"
    pack = ctx.get("shot_pack") or {}
    fs = (pack.get("font_scale") or {}) if isinstance(pack, dict) else {}
    fs_display = fs.get("display") or "9rem"
    fs_label = fs.get("label") or "1.1rem"
    label_html = f'<div class="{sid}-label">{label}</div>' if label else ""
    html = (
        f'<div class="{sid}-wrap">'
        f'{label_html}'
        f'<div class="{sid}-number">'
        f'<span class="{sid}-prefix">{prefix}</span>'
        f'<span class="{sid}-value">{_format_value(end, decimals)}</span>'
        f'<span class="{sid}-suffix">{suffix}</span>'
        f'</div>'
        f'</div>'
    )
    css = f"""
.{sid}-wrap {{ display:flex; flex-direction:column; align-items:center; gap:0.8rem; padding:1rem 0; }}
.{sid}-label {{ font-size:{fs_label}; font-weight:600; color:var(--brand-text-secondary); text-transform:uppercase; letter-spacing:0.12em; }}
.{sid}-number {{ font-family:'Bebas Neue','Montserrat',sans-serif; font-size:{fs_display}; line-height:0.9; color:var(--brand-primary); font-variant-numeric:tabular-nums; display:flex; align-items:baseline; gap:0.06em; padding-bottom:0.12em; }}
.{sid}-prefix, .{sid}-suffix {{ color:var(--brand-accent); font-size:0.5em; font-weight:700; }}
.{sid}-value {{ font-weight:900; }}
"""
    return {"html": html, "css": css, "js": "", "plugins": [], "audio_events": []}
