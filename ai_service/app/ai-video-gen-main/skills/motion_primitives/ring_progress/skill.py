"""ring_progress — circular SVG progress arc filling from 0 to a target percent.

Use for: completion rates, scores, fractions-as-percents, any single-number
visualization where a gauge reads better than a bar. The center number
counts up in sync with the ring's stroke-dashoffset animation.
"""
from typing import Dict, Any
import math

METADATA = {
    "id": "ring_progress",
    "version": "1.1.0",
    "category": "motion_primitive",
    "title": "Ring Progress Arc",
    "description": "Circular SVG stroke arc filling from 0 to a target percent, with a synced number counter in the center.",
    "use_when": "Completion rates, scores out of 100, fraction visualization, single-metric hero reveals.",
    "compatible_shot_types": ["DATA_STORY", "TEXT_DIAGRAM", "IMAGE_HERO", "*"],
    "requires_tier": "ultra",
    "requires_plugins": ["gsap"],
    "requires_canvas": "any",
    "example_params": {
        "percent": 87,
        "label": "Completion",
        "duration": 1.3,
        "delay": 0.4,
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["percent"],
    "properties": {
        "percent": {"type": "number"},
        "label": {"type": "string"},
        "duration": {"type": "number"},
        "delay": {"type": "number"},
        "size": {"type": "number"},
    },
}


def render(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    percent = max(0.0, min(100.0, float(params.get("percent", 0) or 0)))
    label = str(params.get("label", ""))
    duration = float(params.get("duration", 1.2) or 1.2)
    delay = float(params.get("delay", 0.3) or 0.3)
    shot_idx = ctx.get("shot_index", 0)
    sid = f"rp{shot_idx}"

    # Default ring size scales with canvas short-side so the center number
    # ends up at ~13% of canvas short-side (matches the display tier ceiling
    # in `_CANVAS_TIER_RULES`). Caller can still pass an explicit `size`.
    canvas_w = int(ctx.get("canvas_w", 1920) or 1920)
    canvas_h = int(ctx.get("canvas_h", 1080) or 1080)
    auto_size = max(220, min(640, int(min(canvas_w, canvas_h) * 0.46)))
    size = float(params.get("size") or auto_size)
    shot_duration = float(ctx.get("shot_duration", 5.0) or 5.0)

    radius = (size / 2.0) - 24.0
    circumference = 2.0 * math.pi * radius
    cx = size / 2.0
    cy = size / 2.0
    stroke_w = 22.0

    label_html = f'<div class="{sid}-label">{label}</div>' if label else ""
    html = (
        f'<div class="{sid}-wrap" id="{sid}-root">'
        f'<svg class="{sid}-svg" width="{size:.0f}" height="{size:.0f}" viewBox="0 0 {size:.0f} {size:.0f}">'
        f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{radius:.0f}" fill="none" '
        f'stroke="rgba(255,255,255,0.08)" stroke-width="{stroke_w:.0f}"/>'
        f'<circle id="{sid}-arc" cx="{cx:.0f}" cy="{cy:.0f}" r="{radius:.0f}" fill="none" '
        f'stroke="var(--brand-primary)" stroke-width="{stroke_w:.0f}" stroke-linecap="round" '
        f'transform="rotate(-90 {cx:.0f} {cy:.0f})" '
        f'stroke-dasharray="{circumference:.2f}" stroke-dashoffset="{circumference:.2f}"/>'
        f'</svg>'
        f'<div class="{sid}-center">'
        f'<span class="{sid}-value" id="{sid}-val">0</span><span class="{sid}-unit">%</span>'
        f'{label_html}'
        f'</div>'
        f'</div>'
    )

    css = f"""
.{sid}-wrap {{ position:relative; display:inline-block; }}
.{sid}-svg {{ display:block; }}
.{sid}-center {{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.4rem; }}
.{sid}-value {{ font-family:'Bebas Neue',sans-serif; font-size:{int(size*0.28)}px; font-weight:900; line-height:1; color:var(--brand-text); font-variant-numeric:tabular-nums; }}
.{sid}-unit {{ font-family:'Bebas Neue',sans-serif; font-size:{int(size*0.11)}px; color:var(--brand-accent); font-weight:700; margin-top:-0.3em; }}
.{sid}-label {{ font-size:{int(size*0.04)}px; font-weight:700; color:var(--brand-text-secondary); text-transform:uppercase; letter-spacing:0.14em; margin-top:0.8rem; }}
"""

    offset_target = circumference * (1 - percent / 100.0)
    # Back-half motion: after the arc completes, give the whole ring a subtle
    # breath so the shot doesn't go static. Satisfies the back-half rule on
    # shots where the ring is the dominant visual.
    arc_finish = delay + duration
    back_half_delay = max(arc_finish + 0.3, shot_duration * 0.55)
    back_half_dur = max(0.8, shot_duration - back_half_delay)
    js = (
        f'{{'
        f'var arc=document.getElementById("{sid}-arc");'
        f'var val=document.getElementById("{sid}-val");'
        f'if(arc){{'
        f'gsap.to(arc,{{'
        f'attr:{{"stroke-dashoffset":{offset_target:.2f}}}, '
        f'duration:{duration}, delay:{delay}, ease:"power3.out"'
        f'}});'
        f'}}'
        f'if(val){{'
        f'gsap.to({{v:0}},{{v:{percent}, duration:{duration}, delay:{delay}, ease:"power2.out", '
        f'onUpdate:function(){{val.textContent=Math.round(this.targets()[0].v);}}}});'
        f'}}'
        f'gsap.fromTo("#{sid}-root",'
        f'{{scale:1}},'
        f'{{scale:1.012, duration:{back_half_dur:.2f}, delay:{back_half_delay:.2f}, ease:"sine.inOut"}});'
        f'}}'
    )

    # Audio events: whoosh-like start as the arc begins filling, positive
    # chime as it completes at the target percent.
    audio_events = [
        {"role": "data_reveal", "t": round(delay, 3),            "volume_mul": 0.90, "skill_id": "ring_progress"},
        {"role": "ui_positive", "t": round(delay + duration, 3), "volume_mul": 0.95, "skill_id": "ring_progress"},
    ]

    return {"html": html, "css": css, "js": js, "plugins": ["gsap"], "audio_events": audio_events}


def static_fallback(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """No-animation static version: ring rendered at the target percent, value displayed directly."""
    import html as _h
    percent = max(0.0, min(100.0, float(params.get("percent", 0) or 0)))
    label = str(params.get("label", "") or "")
    size = float(params.get("size", 380) or 380)
    shot_idx = ctx.get("shot_index", 0)
    sid = f"rp{shot_idx}fb"
    radius = (size / 2.0) - 24.0
    circumference = 2.0 * math.pi * radius
    cx = cy = size / 2.0
    stroke_w = 22.0
    offset = circumference * (1 - percent / 100.0)
    label_html = f'<div class="{sid}-label">{_h.escape(label)}</div>' if label else ""
    html = (
        f'<div class="{sid}-wrap">'
        f'<svg class="{sid}-svg" width="{size:.0f}" height="{size:.0f}" viewBox="0 0 {size:.0f} {size:.0f}">'
        f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{radius:.0f}" fill="none" '
        f'stroke="rgba(255,255,255,0.08)" stroke-width="{stroke_w:.0f}"/>'
        f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{radius:.0f}" fill="none" '
        f'stroke="var(--brand-primary)" stroke-width="{stroke_w:.0f}" stroke-linecap="round" '
        f'transform="rotate(-90 {cx:.0f} {cy:.0f})" '
        f'stroke-dasharray="{circumference:.2f}" stroke-dashoffset="{offset:.2f}"/>'
        f'</svg>'
        f'<div class="{sid}-center">'
        f'<span class="{sid}-value">{int(round(percent))}</span><span class="{sid}-unit">%</span>'
        f'{label_html}'
        f'</div></div>'
    )
    css = f"""
.{sid}-wrap {{ position:relative; display:inline-block; }}
.{sid}-svg {{ display:block; }}
.{sid}-center {{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.4rem; }}
.{sid}-value {{ font-family:'Bebas Neue',sans-serif; font-size:{int(size*0.28)}px; font-weight:900; line-height:1; color:var(--brand-text); font-variant-numeric:tabular-nums; }}
.{sid}-unit {{ font-family:'Bebas Neue',sans-serif; font-size:{int(size*0.11)}px; color:var(--brand-accent); font-weight:700; margin-top:-0.3em; }}
.{sid}-label {{ font-size:{int(size*0.04)}px; font-weight:700; color:var(--brand-text-secondary); text-transform:uppercase; letter-spacing:0.14em; margin-top:0.8rem; }}
"""
    return {"html": html, "css": css, "js": "", "plugins": [], "audio_events": []}
