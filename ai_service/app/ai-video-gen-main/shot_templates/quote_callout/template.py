"""quote_callout — Pull quote with line-by-line slam reveal + attribution.

Use for: testimonials, citations, narrator emphasis moments, mission statements.
Renders an oversized quote with a clean attribution line below. Each line of
the quote reveals via a translateY(100%→0%) wipe inside an overflow-hidden
wrapper (the classic 'slam-text' effect).
"""
from typing import Dict, Any
import html as _html
import re

METADATA = {
    "id": "quote_callout",
    "version": "1.1.0",
    "title": "Quote Callout",
    "description": "Oversized pull quote with slam-text line reveal + small attribution. One accent word optional.",
    "use_when": "Testimonials, citations, mission statements, narrator emphasis on a memorable line. Best at 4-7s shot duration.",
    "compatible_shot_types": ["TEXT_DIAGRAM", "KINETIC_TITLE", "*"],
    "requires_tier": "premium",
    "requires_canvas": "any",
    "example_params": {
        "quote": "We don't ship features. We ship outcomes.",
        "attribution": "Founding team, 2024",
        "accent_word": "outcomes",
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["quote"],
    "properties": {
        "quote": {"type": "string"},
        "attribution": {"type": "string"},
        "accent_word": {"type": "string"},
    },
}


def render(shot: Dict[str, Any], params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    shot_idx = ctx.get("shot_index", 0)
    pack = ctx.get("shot_pack") or {}
    sid = f"tqc{shot_idx}"

    fs = pack.get("font_scale", {})
    sp = pack.get("spacing", {})
    ez = pack.get("ease", {})

    fs_display = fs.get("display", "clamp(4rem, min(18vw, 32vh), 24rem)")
    fs_caption = fs.get("caption", "clamp(1rem, min(2.4vw, 3vh), 1.8rem)")
    safe = sp.get("safe_area", "5%")
    ease_entry = ez.get("entry", "power3.out")

    quote = (params.get("quote") or "").strip()
    attribution = (params.get("attribution") or "").strip()
    accent_word = (params.get("accent_word") or "").strip()

    # Split quote into lines for slam reveal. Prefer explicit newlines, then
    # split at strong punctuation (em-dash / comma / semicolon), then fall back
    # to balanced word-count chunks. This avoids the old 4-words-per-line
    # heuristic producing awkward orphan tails like "still in place" / "— for
    # now." when the natural break is at the em-dash.
    if "\n" in quote:
        lines = [l.strip() for l in quote.split("\n") if l.strip()]
    else:
        words = quote.split()
        n = len(words)
        if n <= 4:
            lines = [quote]
        else:
            # Try strong-punctuation split first.
            punct_parts = [p.strip() for p in re.split(r"(?<=[—;])\s+|(?<=,)\s+", quote) if p.strip()]
            usable = punct_parts and all(2 <= len(p.split()) <= 8 for p in punct_parts)
            if usable and 2 <= len(punct_parts) <= 4:
                lines = punct_parts
            elif n <= 8:
                # 2 balanced lines.
                mid = (n + 1) // 2
                lines = [" ".join(words[:mid]), " ".join(words[mid:])]
            elif n <= 12:
                # 3 balanced lines.
                third = (n + 2) // 3
                lines = [
                    " ".join(words[:third]),
                    " ".join(words[third:2 * third]),
                    " ".join(words[2 * third:]),
                ]
            else:
                per_line = 5 if n > 16 else 4
                lines = [" ".join(words[i:i + per_line]) for i in range(0, n, per_line)]

    def _wrap_accent(text: str) -> str:
        if not accent_word:
            return _html.escape(text)
        # Word-boundary substitution; case-insensitive; preserve punctuation around word.
        pattern = re.compile(rf"\b({re.escape(accent_word)})\b", re.IGNORECASE)
        escaped = _html.escape(text)
        # Re-substitute on the escaped string. accent_word is short — escape it for regex match.
        escaped_pattern = re.compile(
            rf"\b({re.escape(_html.escape(accent_word))})\b", re.IGNORECASE
        )
        return escaped_pattern.sub(
            lambda m: f'<span class="{sid}-accent">{m.group(1)}</span>', escaped
        )

    line_divs = []
    for i, line in enumerate(lines):
        line_divs.append(
            f'<div class="{sid}-slam-wrap">'
            f'<div class="{sid}-slam-text" id="{sid}-l{i}">'
            f'<span class="{sid}-quotemark">{("“" if i == 0 else "")}</span>'
            f'{_wrap_accent(line)}'
            f'<span class="{sid}-quotemark">{("”" if i == len(lines) - 1 else "")}</span>'
            f'</div></div>'
        )

    attribution_html = ""
    if attribution:
        attribution_html = (
            f'<div class="{sid}-attr" id="{sid}-a">'
            f'<span class="{sid}-attr-mark">—</span> '
            f'{_html.escape(attribution)}'
            f'</div>'
        )

    html = (
        f'<div class="{sid}-stage stage-drift">'
        f'<div class="{sid}-quote-block">' + "".join(line_divs) + '</div>'
        f'{attribution_html}'
        f'</div>'
    )

    css = f"""
.{sid}-stage {{
  position:absolute; inset:0; padding:{safe}; display:flex;
  flex-direction:column; align-items:flex-start; justify-content:center;
  gap:2rem; color:var(--brand-text);
  font-family:'Inter',system-ui,sans-serif;
}}
.{sid}-quote-block {{ display:flex; flex-direction:column; gap:0.1em; max-width:96%; }}
.{sid}-slam-wrap {{ overflow:hidden; line-height:0.95; }}
.{sid}-slam-text {{
  font-family:'Bebas Neue','Montserrat',sans-serif;
  font-size:{fs_display};
  font-weight:400; letter-spacing:0.005em;
  color:var(--brand-text);
  transform:translateY(105%); will-change:transform;
}}
.{sid}-quotemark {{ color:var(--brand-accent); margin:0 0.04em; }}
.{sid}-accent {{ color:var(--brand-accent); }}
.{sid}-attr {{
  font-family:'Inter',sans-serif; font-size:{fs_caption};
  letter-spacing:0.18em; text-transform:uppercase;
  color:var(--brand-text-secondary); opacity:0;
}}
.{sid}-attr-mark {{ color:var(--brand-accent); margin-right:0.4em; }}
"""

    # Slam reveal each line at +0.10s; attribution typewriter-fades in after last line.
    js_lines = []
    for i in range(len(lines)):
        delay = 0.20 + i * 0.18
        js_lines.append(
            f"gsap.to('#{sid}-l{i}',{{y:'0%', duration:0.55, delay:{delay:.2f}, ease:'{ease_entry}'}});"
        )
    if attribution:
        attr_delay = 0.20 + len(lines) * 0.18 + 0.30
        js_lines.append(
            f"gsap.to('#{sid}-a',{{opacity:1, x:6, duration:0.50, delay:{attr_delay:.2f}, ease:'power2.out'}});"
        )
    js_lines.append(
        f"gsap.fromTo('.{sid}-stage',{{x:0, y:0, scale:1}},{{x:10, y:-5, scale:1.02, duration:12, ease:'none'}});"
    )
    js = "\n".join(js_lines)

    audio_events = []
    for i in range(len(lines)):
        audio_events.append({
            "role": "ui_emphasis",
            "t": round(0.20 + i * 0.18, 3),
            "volume_mul": 0.80 + 0.05 * i,
            "skill_id": "quote_callout",
        })

    return {"html": html, "css": css, "js": js, "audio_events": audio_events}
