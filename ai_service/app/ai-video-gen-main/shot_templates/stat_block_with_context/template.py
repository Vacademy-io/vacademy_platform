"""stat_block_with_context — Hero stat with title above + supporting context below.

Composes the same 'big number rolling up' pattern as the number_counter skill,
but wraps it in a labeled context block. Pattern:

   [        EYEBROW (label)         ]
   [          $ 2.3M               ]    ← big number
   [        Annual savings          ]
   [   per team using the platform  ]    ← supporting context

The number rolls from `value_from` → `value_to` over `duration`. Optional
prefix and suffix keep tabular alignment (so digit width doesn't jitter).
"""
from typing import Dict, Any
import html as _html

METADATA = {
    "id": "stat_block_with_context",
    "version": "1.2.0",
    "title": "Stat Block With Context",
    "description": "Hero animated number with eyebrow label, headline, and supporting context line. Locale-formatted, tabular digits.",
    "use_when": "Headline statistics that need framing — KPIs, savings figures, percentages, counts. Best at 3-6s shot duration.",
    # Explicit allow-list — works for any shot whose narrative beat is "the
    # number is the point". IMAGE_HERO is OK because the stat can sit over
    # the image as an overlay.
    "compatible_shot_types": ["DATA_STORY", "TEXT_DIAGRAM", "IMAGE_HERO"],
    "requires_tier": "premium",
    "requires_canvas": "any",
    "example_params": {
        "eyebrow": "ANNUAL SAVINGS",
        "value_from": 0,
        "value_to": 2.3,
        "decimals": 1,
        "prefix": "$",
        "suffix": "M",
        "headline": "per team",
        "context": "Median across 1,200 customers in 2025.",
        "duration": 1.6,
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["value_to"],
    "properties": {
        "eyebrow": {"type": "string"},
        "value_from": {"type": "number"},
        "value_to": {"type": "number"},
        "decimals": {"type": "integer"},
        "prefix": {"type": "string"},
        "suffix": {"type": "string"},
        "headline": {"type": "string"},
        "context": {"type": "string"},
        "duration": {"type": "number"},
    },
}


def render(shot: Dict[str, Any], params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    shot_idx = ctx.get("shot_index", 0)
    pack = ctx.get("shot_pack") or {}
    sid = f"tsb{shot_idx}"

    fs = pack.get("font_scale", {})
    sp = pack.get("spacing", {})
    ez = pack.get("ease", {})

    # Fallbacks match `portrait_720` bucket from _CANVAS_TIER_RULES so a missing
    # shot_pack never overflows the smallest supported canvas.
    fs_display = fs.get("display", "clamp(2rem, min(14vw, 8vh), 6.25rem)")
    fs_h2 = fs.get("h2", "clamp(1.2rem, min(7vw, 4vh), 3.1rem)")
    fs_caption = fs.get("caption", "clamp(0.75rem, 1.9vmin, 0.9rem)")
    fs_micro = fs.get("micro", "clamp(0.75rem, 1.9vmin, 0.9rem)")
    safe = sp.get("safe_area", "5%")
    ease_entry = ez.get("entry", "power3.out")

    eyebrow = (params.get("eyebrow") or "").strip()
    value_from = float(params.get("value_from", 0) or 0)
    value_to = float(params.get("value_to", 0) or 0)
    decimals = int(params.get("decimals", 0) or 0)
    prefix = (params.get("prefix") or "").strip()
    suffix = (params.get("suffix") or "").strip()
    headline = (params.get("headline") or "").strip()
    context = (params.get("context") or "").strip()
    duration = float(params.get("duration", 1.5) or 1.5)
    duration = max(0.6, min(3.0, duration))

    eyebrow_html = (
        f'<div class="{sid}-eyebrow" id="{sid}-e">{_html.escape(eyebrow)}</div>'
        if eyebrow else ""
    )
    headline_html = (
        f'<div class="{sid}-headline" id="{sid}-h">{_html.escape(headline)}</div>'
        if headline else ""
    )
    context_html = (
        f'<div class="{sid}-context" id="{sid}-c">{_html.escape(context)}</div>'
        if context else ""
    )

    # Format the start value so the initial render isn't blank.
    def _fmt(v: float) -> str:
        if decimals > 0:
            return f"{v:,.{decimals}f}"
        return f"{int(round(v)):,}"

    html = (
        f'<div class="{sid}-stage stage-drift">'
        f'<div class="{sid}-rule" id="{sid}-r"></div>'
        f'{eyebrow_html}'
        f'<div class="{sid}-number" id="{sid}-n">'
        f'<span class="{sid}-prefix">{_html.escape(prefix)}</span>'
        f'<span class="{sid}-value" id="{sid}-v">{_fmt(value_from)}</span>'
        f'<span class="{sid}-suffix">{_html.escape(suffix)}</span>'
        f'</div>'
        f'{headline_html}'
        f'{context_html}'
        f'</div>'
    )

    css = f"""
.{sid}-stage {{
  position:absolute; inset:0; padding:{safe}; display:flex;
  flex-direction:column; align-items:center; justify-content:center;
  gap:clamp(0.8rem, 2.4vmin, 2.6rem); color:var(--brand-text);
  font-family:'Inter',system-ui,sans-serif;
}}
.{sid}-rule {{
  width:clamp(3rem, 9vmin, 9rem); height:clamp(3px, 0.6vmin, 8px);
  background:var(--brand-accent);
  border-radius:2px; transform-origin:center; transform:scaleX(0);
}}
.{sid}-eyebrow {{
  font-family:'Inter',sans-serif; font-size:{fs_micro};
  font-weight:700; letter-spacing:0.32em; text-transform:uppercase;
  color:var(--brand-text-secondary); opacity:0;
}}
.{sid}-number {{
  font-family:'Bebas Neue','Montserrat',sans-serif;
  font-size:{fs_display};
  line-height:0.9; color:var(--brand-primary);
  font-variant-numeric:tabular-nums;
  display:flex; align-items:baseline; gap:0.04em; opacity:0;
}}
.{sid}-prefix, .{sid}-suffix {{
  color:var(--brand-accent); font-size:0.55em; font-weight:700;
}}
.{sid}-value {{ font-weight:900; }}
.{sid}-headline {{
  font-family:'Bebas Neue','Montserrat',sans-serif;
  font-size:{fs_h2};
  letter-spacing:0.01em; line-height:1.05;
  color:var(--brand-text); opacity:0; text-align:center; max-width:24ch;
}}
.{sid}-context {{
  font-family:'Inter',sans-serif; font-size:{fs_caption};
  color:var(--brand-text-secondary); opacity:0;
  text-align:center; max-width:48ch; line-height:1.45;
  font-style:italic;
}}
"""

    js = f"""
gsap.to('#{sid}-r',{{scaleX:1, duration:0.45, delay:0.10, ease:'{ease_entry}'}});
gsap.to('#{sid}-e',{{opacity:1, y:-4, duration:0.5, delay:0.25, ease:'{ease_entry}'}});
gsap.fromTo('#{sid}-n',{{opacity:0, scale:0.92}},{{opacity:1, scale:1, duration:0.55, delay:0.45, ease:'back.out(1.4)'}});
{{
  var v=document.getElementById('{sid}-v');
  if(v){{
    gsap.to({{n:{value_from}}},{{n:{value_to}, duration:{duration}, delay:0.55, ease:'power2.out',
      onUpdate:function(){{
        var x=this.targets()[0].n;
        v.textContent=({decimals}>0 ? x.toFixed({decimals}) : Math.round(x)).toLocaleString();
      }}
    }});
  }}
}}
gsap.to('#{sid}-h',{{opacity:1, y:-4, duration:0.5, delay:{0.55 + duration + 0.15:.2f}, ease:'{ease_entry}'}});
gsap.to('#{sid}-c',{{opacity:1, duration:0.5, delay:{0.55 + duration + 0.35:.2f}, ease:'power2.out'}});
gsap.fromTo('.{sid}-stage',{{x:0, y:0, scale:1}},{{x:10, y:-5, scale:1.02, duration:12, ease:'none'}});
"""

    audio_events = [
        {"role": "data_reveal", "t": 0.45,                                "volume_mul": 0.95, "skill_id": "stat_block_with_context"},
        {"role": "ui_positive", "t": round(0.55 + duration, 3),           "volume_mul": 0.95, "skill_id": "stat_block_with_context"},
    ]
    if headline:
        audio_events.append({
            "role": "ui_tick",
            "t": round(0.55 + duration + 0.15, 3),
            "volume_mul": 0.70,
            "skill_id": "stat_block_with_context",
        })

    return {"html": html, "css": css, "js": js, "audio_events": audio_events}
