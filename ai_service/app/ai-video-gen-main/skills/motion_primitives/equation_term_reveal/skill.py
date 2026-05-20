"""equation_term_reveal — math equation terms appearing sequentially with scale-in.

Use for: math formulas, physics laws, chemical equations, any symbolic content
where showing each term one-at-a-time helps comprehension. Each term gets a
labeled annotation that fades in shortly after the term appears.
"""
from typing import Dict, Any

METADATA = {
    "id": "equation_term_reveal",
    "version": "1.1.0",
    "category": "motion_primitive",
    "title": "Equation Term Reveal",
    "description": "Math equation with terms appearing one-by-one (scale + fade), each with an optional labeled annotation.",
    "use_when": "Physics laws (F=ma, E=mc²), formulas, chemical equations, any symbolic content where term-by-term exposition helps.",
    "compatible_shot_types": ["EQUATION_BUILD", "TEXT_DIAGRAM", "*"],
    "requires_tier": "ultra",
    "requires_plugins": ["gsap"],
    "requires_canvas": "any",
    "example_params": {
        "terms": [
            {"symbol": "F", "label": "Force"},
            {"symbol": "=", "label": ""},
            {"symbol": "m", "label": "Mass"},
            {"symbol": "·", "label": ""},
            {"symbol": "a", "label": "Acceleration"},
        ],
        "entry_delay": 0.4,
        "stagger": 0.6,
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["terms"],
    "properties": {
        "terms": {"type": "array"},
        "entry_delay": {"type": "number"},
        "stagger": {"type": "number"},
    },
}


def render(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    terms = params.get("terms") or []
    entry_delay = float(params.get("entry_delay", 0.3) or 0.3)
    stagger = float(params.get("stagger", 0.5) or 0.5)
    shot_idx = ctx.get("shot_index", 0)
    sid = f"eqn{shot_idx}"

    # Canvas-aware font sizes via shot_pack. Equations are usually the shot's
    # focal element; map to h1 (slightly conservative vs display so labels can
    # breathe below). Fallback to old hardcoded 7rem.
    pack = ctx.get("shot_pack") or {}
    fs = (pack.get("font_scale") or {}) if isinstance(pack, dict) else {}
    fs_equation = fs.get("h1") or "7rem"
    fs_label = fs.get("label") or "1.3rem"
    shot_duration = float(ctx.get("shot_duration", 5.0) or 5.0)

    term_html = []
    label_html = []
    for i, t in enumerate(terms):
        symbol = str(t.get("symbol", ""))
        label = str(t.get("label", ""))
        term_html.append(
            f'<span class="{sid}-term" id="{sid}-t-{i}">{symbol}</span>'
        )
        if label:
            label_html.append(
                f'<div class="{sid}-labelwrap" id="{sid}-l-{i}">'
                f'<div class="{sid}-linkline"></div>'
                f'<div class="{sid}-label">{label}</div>'
                f'</div>'
            )

    html = (
        f'<div class="{sid}-wrap" id="{sid}-root">'
        f'<div class="{sid}-equation">' + "".join(term_html) + '</div>'
        f'<div class="{sid}-labels">' + "".join(label_html) + '</div>'
        f'</div>'
    )

    css = f"""
.{sid}-wrap {{ display:flex; flex-direction:column; align-items:center; gap:3rem; padding:2rem 0; }}
.{sid}-equation {{ font-family:'Fira Code','DM Mono',monospace; font-size:{fs_equation}; font-weight:700; color:var(--brand-primary); display:flex; gap:0.6rem; align-items:center; line-height:1; padding-bottom:0.12em; }}
.{sid}-term {{ display:inline-block; opacity:0; transform:scale(3); }}
.{sid}-labels {{ display:flex; gap:2.5rem; flex-wrap:wrap; justify-content:center; }}
.{sid}-labelwrap {{ display:flex; flex-direction:column; align-items:center; gap:0.6rem; opacity:0; }}
.{sid}-linkline {{ width:2px; height:1.8rem; background:var(--brand-accent); }}
.{sid}-label {{ font-size:{fs_label}; font-weight:700; color:var(--brand-accent); text-transform:uppercase; letter-spacing:0.08em; }}
"""

    js_parts = []
    last_term_delay = entry_delay
    for i, t in enumerate(terms):
        d = entry_delay + i * stagger
        last_term_delay = d
        has_label = bool(str(t.get("label", "")))
        js_parts.append(
            f'gsap.to("#{sid}-t-{i}", {{opacity:1, scale:1, duration:0.45, delay:{d:.3f}, ease:"back.out(1.8)"}});'
        )
        if has_label:
            js_parts.append(
                f'gsap.to("#{sid}-l-{i}", {{opacity:1, y:0, duration:0.4, delay:{d+0.25:.3f}, ease:"power2.out"}});'
            )
    # Back-half motion: after the last term lands, give the whole equation a
    # subtle scale-emphasis breath. Satisfies the back-half rule on shots
    # where the equation is the dominant visual.
    last_finish = last_term_delay + 0.5
    back_half_delay = max(last_finish + 0.2, shot_duration * 0.55)
    back_half_dur = max(0.8, shot_duration - back_half_delay)
    js_parts.append(
        f'gsap.fromTo("#{sid}-root",'
        f'{{scale:1}},'
        f'{{scale:1.015, duration:{back_half_dur:.2f}, delay:{back_half_delay:.2f}, ease:"sine.inOut"}});'
    )
    js = "\n".join(js_parts)

    # Audio events: one ui_chime as each term scales in. Skip entirely for
    # equations with >6 terms to avoid sonic clutter.
    audio_events = []
    if terms and len(terms) <= 6:
        for i, _t in enumerate(terms):
            d = entry_delay + i * stagger
            audio_events.append({
                "role": "ui_chime",
                "t": round(d, 3),
                "volume_mul": 0.75,
                "skill_id": "equation_term_reveal",
            })

    return {"html": html, "css": css, "js": js, "plugins": ["gsap"], "audio_events": audio_events}


def static_fallback(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """No-animation static version: full equation visible immediately, labels visible."""
    import html as _h
    terms = params.get("terms") or []
    if not isinstance(terms, list) or not terms:
        terms = [{"symbol": "—", "label": ""}]
    shot_idx = ctx.get("shot_index", 0)
    sid = f"eqn{shot_idx}fb"
    pack = ctx.get("shot_pack") or {}
    fs = (pack.get("font_scale") or {}) if isinstance(pack, dict) else {}
    fs_equation = fs.get("h1") or "7rem"
    fs_label = fs.get("label") or "1.3rem"
    term_html = "".join(
        f'<span class="{sid}-term">{_h.escape(str((t or {}).get("symbol", "")))}</span>'
        for t in terms
    )
    label_html = "".join(
        f'<div class="{sid}-labelwrap"><div class="{sid}-linkline"></div>'
        f'<div class="{sid}-label">{_h.escape(str((t or {}).get("label", "")))}</div></div>'
        for t in terms if str((t or {}).get("label", ""))
    )
    html = (
        f'<div class="{sid}-wrap">'
        f'<div class="{sid}-equation">{term_html}</div>'
        f'<div class="{sid}-labels">{label_html}</div>'
        f'</div>'
    )
    css = f"""
.{sid}-wrap {{ display:flex; flex-direction:column; align-items:center; gap:3rem; padding:2rem 0; }}
.{sid}-equation {{ font-family:'Fira Code','DM Mono',monospace; font-size:{fs_equation}; font-weight:700; color:var(--brand-primary); display:flex; gap:0.6rem; align-items:center; line-height:1; padding-bottom:0.12em; }}
.{sid}-term {{ display:inline-block; }}
.{sid}-labels {{ display:flex; gap:2.5rem; flex-wrap:wrap; justify-content:center; }}
.{sid}-labelwrap {{ display:flex; flex-direction:column; align-items:center; gap:0.6rem; }}
.{sid}-linkline {{ width:2px; height:1.8rem; background:var(--brand-accent); }}
.{sid}-label {{ font-size:{fs_label}; font-weight:700; color:var(--brand-accent); text-transform:uppercase; letter-spacing:0.08em; }}
"""
    return {"html": html, "css": css, "js": "", "plugins": [], "audio_events": []}
