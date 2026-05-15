"""typewriter_text — character-by-character text reveal synced to duration.

Use for: hooks, quote callouts, code reveals, dramatic line delivery. The
reveal rate is derived from the requested duration so the animation always
finishes exactly when the shot expects it to, regardless of text length.
"""
from typing import Dict, Any
import json

METADATA = {
    "id": "typewriter_text",
    "version": "1.1.0",
    "category": "motion_primitive",
    "title": "Typewriter Text Reveal",
    "description": "Character-by-character text appearance with a blinking caret and natural jitter.",
    "use_when": "Hooks, quotes, code reveals, dramatic single-line statements.",
    "compatible_shot_types": ["IMAGE_HERO", "TEXT_DIAGRAM", "KINETIC_TITLE", "*"],
    "requires_tier": "ultra",
    "requires_plugins": [],
    "requires_canvas": "any",
    "example_params": {
        "text": "The best interface feels inevitable.",
        "duration": 2.0,
        "delay": 0.3,
        "size": "display",
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["text"],
    "properties": {
        "text": {"type": "string"},
        "duration": {"type": "number"},
        "delay": {"type": "number"},
        "size": {"type": "string"},
        "caret": {"type": "boolean"},
    },
}

# Size-key fallbacks used when shot_pack isn't passed (legacy callers, tests).
# In production, ctx["shot_pack"]["font_scale"][size_key] takes precedence
# so the typography respects the canvas-aware caps.
_SIZE_MAP_FALLBACK = {
    "display": "6.5rem",
    "h1": "4.5rem",
    "h2": "3rem",
    "body": "1.8rem",
    "caption": "1.2rem",
}


def render(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    text = str(params.get("text", "") or "")
    duration = float(params.get("duration", 1.5) or 1.5)
    delay = float(params.get("delay", 0.2) or 0.2)
    size_key = str(params.get("size", "h1"))
    caret = bool(params.get("caret", True))
    shot_idx = ctx.get("shot_index", 0)
    sid = f"tw{shot_idx}"

    # Pull the canvas-aware clamp for the requested size tier; fall back to
    # the static map only when shot_pack isn't wired through.
    pack = ctx.get("shot_pack") or {}
    fs = (pack.get("font_scale") or {}) if isinstance(pack, dict) else {}
    font_size = fs.get(size_key) or _SIZE_MAP_FALLBACK.get(size_key, _SIZE_MAP_FALLBACK["h1"])
    shot_duration = float(ctx.get("shot_duration", 5.0) or 5.0)

    caret_html = f'<span class="{sid}-caret"></span>' if caret else ""
    html = (
        f'<div class="{sid}-wrap" id="{sid}-root">'
        f'<span class="{sid}-text" id="{sid}-target"></span>'
        f'{caret_html}'
        f'</div>'
    )

    css = f"""
.{sid}-wrap {{ font-family:'Bebas Neue','Montserrat',sans-serif; font-size:{font_size}; line-height:1.1; color:var(--brand-text); font-weight:700; letter-spacing:0.01em; display:inline-flex; align-items:baseline; padding-bottom:0.12em; }}
.{sid}-text {{ white-space:pre-wrap; overflow-wrap:anywhere; }}
.{sid}-caret {{ display:inline-block; width:0.06em; height:1em; background:var(--brand-accent); margin-left:0.08em; animation:{sid}-blink 0.9s steps(1) infinite; }}
@keyframes {sid}-blink {{ 0%,49%{{opacity:1}} 50%,100%{{opacity:0}} }}
"""

    text_json = json.dumps(text, ensure_ascii=False)
    # Back-half motion: drift after typewriter completes so the shot still has
    # motion through to the end (validator: tween with delay >= 0.55 × shot_dur).
    type_finish = delay + duration
    back_half_delay = max(type_finish + 0.2, shot_duration * 0.55)
    back_half_dur = max(0.8, shot_duration - back_half_delay)
    js = (
        f'{{'
        f'var el=document.getElementById("{sid}-target");'
        f'if(el){{'
        f'var _txt={text_json};'
        f'var _len=_txt.length;'
        f'var _dur={duration*1000:.0f};'
        f'var _step=_len>0?_dur/_len:0;'
        f'var _start=performance.now()+{delay*1000:.0f};'
        f'function _tick(now){{'
        f'if(now<_start){{requestAnimationFrame(_tick);return;}}'
        f'var _elapsed=now-_start;'
        f'var _i=Math.min(_len,Math.floor(_elapsed/_step));'
        f'el.textContent=_txt.slice(0,_i);'
        f'if(_i<_len)requestAnimationFrame(_tick);'
        f'}}'
        f'requestAnimationFrame(_tick);'
        f'}}'
        f'if(typeof gsap!=="undefined"){{'
        f'gsap.fromTo("#{sid}-root",'
        f'{{x:0, opacity:1}},'
        f'{{x:6, opacity:1, duration:{back_half_dur:.2f}, delay:{back_half_delay:.2f}, ease:"sine.inOut"}});'
        f'}}'
        f'}}'
    )

    return {"html": html, "css": css, "js": js, "plugins": []}


def static_fallback(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """No-animation static version: full text rendered immediately, no caret."""
    import html as _h
    text = str(params.get("text", "") or "Text")
    size_key = str(params.get("size", "h1"))
    pack = ctx.get("shot_pack") or {}
    fs = (pack.get("font_scale") or {}) if isinstance(pack, dict) else {}
    font_size = fs.get(size_key) or _SIZE_MAP_FALLBACK.get(size_key, _SIZE_MAP_FALLBACK["h1"])
    shot_idx = ctx.get("shot_index", 0)
    sid = f"tw{shot_idx}fb"
    html = f'<div class="{sid}-wrap"><span class="{sid}-text">{_h.escape(text)}</span></div>'
    css = f"""
.{sid}-wrap {{ font-family:'Bebas Neue','Montserrat',sans-serif; font-size:{font_size}; line-height:1.1; color:var(--brand-text); font-weight:700; letter-spacing:0.01em; }}
.{sid}-text {{ white-space:pre-wrap; }}
"""
    return {"html": html, "css": css, "js": "", "plugins": [], "audio_events": []}
