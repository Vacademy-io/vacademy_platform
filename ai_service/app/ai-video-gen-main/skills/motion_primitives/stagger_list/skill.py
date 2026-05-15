"""stagger_list — list items sliding up with a tight stagger.

Use for: bullet points, feature lists, step enumerations, pros/cons, any
vertical list where the reader should feel each item land. Icons and
sub-captions are optional per item.
"""
from typing import Dict, Any

METADATA = {
    "id": "stagger_list",
    "version": "1.1.0",
    "category": "motion_primitive",
    "title": "Stagger List Reveal",
    "description": "Vertical list items sliding up and fading in with a tight stagger; supports icons and sub-captions.",
    "use_when": "Bullet points, feature lists, step enumerations, pros/cons comparisons, rule sets.",
    "compatible_shot_types": ["TEXT_DIAGRAM", "PROCESS_STEPS", "LOWER_THIRD", "*"],
    "requires_tier": "ultra",
    "requires_plugins": ["gsap"],
    "requires_canvas": "any",
    "example_params": {
        "items": [
            {"text": "Deterministic renders", "icon": "✓"},
            {"text": "Version-locked skills", "icon": "✓"},
            {"text": "Zero pipeline changes per skill", "icon": "✓"},
        ],
        "entry_delay": 0.3,
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["items"],
    "properties": {
        "items": {"type": "array"},
        "entry_delay": {"type": "number"},
        "stagger": {"type": "number"},
        "numbered": {"type": "boolean"},
    },
}


def render(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    items = params.get("items") or []
    entry_delay = float(params.get("entry_delay", 0.3) or 0.3)
    stagger = float(params.get("stagger", 0.14) or 0.14)
    numbered = bool(params.get("numbered", False))
    shot_idx = ctx.get("shot_index", 0)
    sid = f"sl{shot_idx}"

    # Canvas-aware fonts via shot_pack. List items are body-scale; captions are
    # smaller (label tier). Markers (numbers / icons) scale with h2.
    pack = ctx.get("shot_pack") or {}
    fs = (pack.get("font_scale") or {}) if isinstance(pack, dict) else {}
    fs_text = fs.get("body") or "1.75rem"
    fs_caption = fs.get("label") or "1.15rem"
    fs_marker = fs.get("h2") or "2.4rem"
    fs_icon = fs.get("h2") or "1.9rem"
    shot_duration = float(ctx.get("shot_duration", 5.0) or 5.0)

    rows = []
    for i, item in enumerate(items):
        text = str(item.get("text", "") or "")
        icon = str(item.get("icon", "") or "")
        caption = str(item.get("caption", "") or "")
        marker = (
            f'<span class="{sid}-num">{i + 1:02d}</span>'
            if numbered
            else (f'<span class="{sid}-icon">{icon}</span>' if icon else "")
        )
        caption_html = f'<div class="{sid}-caption">{caption}</div>' if caption else ""
        rows.append(
            f'<li class="{sid}-item" id="{sid}-i-{i}">'
            f'{marker}'
            f'<div class="{sid}-body"><div class="{sid}-text">{text}</div>{caption_html}</div>'
            f'</li>'
        )
    html = f'<ul class="{sid}-list" id="{sid}-root">' + "".join(rows) + "</ul>"

    css = f"""
.{sid}-list {{ list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:1.1rem; }}
.{sid}-item {{ display:flex; align-items:flex-start; gap:1.1rem; opacity:0; transform:translateY(24px); }}
.{sid}-num {{ flex:0 0 auto; font-family:'Bebas Neue',sans-serif; font-size:{fs_marker}; line-height:1; color:var(--brand-accent); font-weight:900; min-width:3.2rem; }}
.{sid}-icon {{ flex:0 0 auto; font-size:{fs_icon}; color:var(--brand-accent); min-width:2.4rem; }}
.{sid}-body {{ flex:1; min-width:0; }}
.{sid}-text {{ font-size:{fs_text}; font-weight:700; color:var(--brand-text); line-height:1.25; overflow-wrap:anywhere; }}
.{sid}-caption {{ font-size:{fs_caption}; font-weight:500; color:var(--brand-text-secondary); margin-top:0.25rem; line-height:1.4; }}
"""

    js_parts = []
    last_item_finish = entry_delay
    for i, _ in enumerate(items):
        d = entry_delay + i * stagger
        last_item_finish = d + 0.5
        js_parts.append(
            f'gsap.to("#{sid}-i-{i}", {{opacity:1, y:0, duration:0.5, delay:{d:.3f}, ease:"power3.out"}});'
        )
    # Back-half motion: drift the list subtly so the shot stays alive after
    # the last item lands.
    back_half_delay = max(last_item_finish + 0.3, shot_duration * 0.55)
    back_half_dur = max(0.8, shot_duration - back_half_delay)
    js_parts.append(
        f'gsap.fromTo("#{sid}-root",'
        f'{{x:0}},'
        f'{{x:6, duration:{back_half_dur:.2f}, delay:{back_half_delay:.2f}, ease:"sine.inOut"}});'
    )
    js = "\n".join(js_parts)

    return {"html": html, "css": css, "js": js, "plugins": ["gsap"]}


def static_fallback(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """No-animation static version: all items at full opacity, no slide-in."""
    import html as _h
    items = params.get("items") or []
    if not isinstance(items, list) or not items:
        items = [{"text": "—"}]
    numbered = bool(params.get("numbered", False))
    shot_idx = ctx.get("shot_index", 0)
    sid = f"sl{shot_idx}fb"
    pack = ctx.get("shot_pack") or {}
    fs = (pack.get("font_scale") or {}) if isinstance(pack, dict) else {}
    fs_text = fs.get("body") or "1.75rem"
    fs_caption = fs.get("label") or "1.15rem"
    fs_marker = fs.get("h2") or "2.4rem"
    fs_icon = fs.get("h2") or "1.9rem"
    rows = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            item = {}
        text = str(item.get("text", "") or "")
        icon = str(item.get("icon", "") or "")
        caption = str(item.get("caption", "") or "")
        marker = (
            f'<span class="{sid}-num">{i + 1:02d}</span>'
            if numbered
            else (f'<span class="{sid}-icon">{_h.escape(icon)}</span>' if icon else "")
        )
        caption_html = f'<div class="{sid}-caption">{_h.escape(caption)}</div>' if caption else ""
        rows.append(
            f'<li class="{sid}-item">{marker}'
            f'<div class="{sid}-body"><div class="{sid}-text">{_h.escape(text)}</div>{caption_html}</div>'
            f'</li>'
        )
    html = f'<ul class="{sid}-list">' + "".join(rows) + '</ul>'
    css = f"""
.{sid}-list {{ list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:1.1rem; }}
.{sid}-item {{ display:flex; align-items:flex-start; gap:1.1rem; }}
.{sid}-num {{ flex:0 0 auto; font-family:'Bebas Neue',sans-serif; font-size:{fs_marker}; line-height:1; color:var(--brand-accent); font-weight:900; min-width:3.2rem; }}
.{sid}-icon {{ flex:0 0 auto; font-size:{fs_icon}; color:var(--brand-accent); min-width:2.4rem; }}
.{sid}-body {{ flex:1; min-width:0; }}
.{sid}-text {{ font-size:{fs_text}; font-weight:700; color:var(--brand-text); line-height:1.25; overflow-wrap:anywhere; }}
.{sid}-caption {{ font-size:{fs_caption}; font-weight:500; color:var(--brand-text-secondary); margin-top:0.25rem; line-height:1.4; }}
"""
    return {"html": html, "css": css, "js": "", "plugins": [], "audio_events": []}
