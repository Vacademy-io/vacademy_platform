"""split_comparison — Two columns side-by-side with synchronized reveals.

Use for: before/after, X vs Y, this/that, two contrasting concepts.

Layout:
   [           headline (optional)         ]
   [ left_label  | divider |  right_label  ]
   [ left_text   |   VS    |  right_text   ]
   [ accent_dot  |         |  accent_dot   ]

Reveal sequence (uses shot pack ease + timing tokens):
   1. Headline fades up (delay 0.10s)
   2. Vertical divider draws in (delay 0.35s)
   3. Left column slides in from left + Right slides in from right (stagger 0.05s, delay 0.50s)
   4. Accent underlines wipe in under each side (delay 0.95s)
"""
from typing import Dict, Any
import html as _html

METADATA = {
    "id": "split_comparison",
    "version": "1.2.0",
    "title": "Split Comparison",
    "description": "Side-by-side comparison with synchronized reveals — two columns, optional headline, center 'VS' divider.",
    "use_when": "Comparing exactly two concepts, products, options, eras, approaches, or before/after. Best at 4-7s shot duration.",
    # Explicit allow-list — composition is inherently comparative (left vs
    # right), so only shot types whose narrative beat fits a binary contrast.
    # Sequential / process beats (PROCESS_STEPS) belong on three_up_grid or
    # a dedicated timeline template, not this one.
    "compatible_shot_types": ["TEXT_DIAGRAM", "DATA_STORY"],
    "requires_tier": "premium",
    "requires_canvas": "any",
    "example_params": {
        "headline": "Two paths.",
        "left_label": "BEFORE",
        "left_text": "Pen and paper",
        "left_caption": "1990s",
        "right_label": "AFTER",
        "right_text": "Always-on cloud",
        "right_caption": "Today",
        "divider_text": "VS",
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["left_label", "left_text", "right_label", "right_text"],
    "properties": {
        "headline": {"type": "string"},
        "left_label": {"type": "string"},
        "left_text": {"type": "string"},
        "left_caption": {"type": "string"},
        "right_label": {"type": "string"},
        "right_text": {"type": "string"},
        "right_caption": {"type": "string"},
        "divider_text": {"type": "string"},
    },
}


def render(shot: Dict[str, Any], params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    shot_idx = ctx.get("shot_index", 0)
    pack = ctx.get("shot_pack") or {}
    sid = f"tsc{shot_idx}"  # template-split-comparison

    # Read shot-pack tokens with sensible fallbacks (works without a pack too)
    fs = pack.get("font_scale", {})
    sp = pack.get("spacing", {})
    ez = pack.get("ease", {})

    # Fallbacks match the conservative `portrait_720` bucket from
    # shot_type_cards._CANVAS_TIER_RULES so a missing shot_pack never produces
    # text that overflows the smallest supported canvas. When shot_pack IS
    # wired (production path), these defaults are bypassed.
    fs_display = fs.get("display", "clamp(2rem, min(14vw, 8vh), 6.25rem)")
    fs_h2 = fs.get("h2", "clamp(1.2rem, min(7vw, 4vh), 3.1rem)")
    fs_caption = fs.get("caption", "clamp(0.75rem, 1.9vmin, 0.9rem)")
    fs_micro = fs.get("micro", "clamp(0.75rem, 1.9vmin, 0.9rem)")
    safe = sp.get("safe_area", "4%")
    gap_lg = sp.get("lg", "40px")
    ease_entry = ez.get("entry", "power3.out")
    ease_emph = ez.get("emphasis", "back.out(1.6)")

    canvas_w = int(ctx.get("canvas_w", 1920) or 1920)
    canvas_h = int(ctx.get("canvas_h", 1080) or 1080)
    is_portrait = canvas_h > canvas_w

    headline = (params.get("headline") or "").strip()
    divider = (params.get("divider_text") or "VS").strip()
    L_label = (params.get("left_label") or "").strip()
    L_text = (params.get("left_text") or "").strip()
    L_cap = (params.get("left_caption") or "").strip()
    R_label = (params.get("right_label") or "").strip()
    R_text = (params.get("right_text") or "").strip()
    R_cap = (params.get("right_caption") or "").strip()

    headline_html = ""
    if headline:
        headline_html = (
            f'<div class="{sid}-headline" id="{sid}-h">{_html.escape(headline)}</div>'
        )
    L_caption_html = (
        f'<div class="{sid}-cap" id="{sid}-Lc">{_html.escape(L_cap)}</div>' if L_cap else ""
    )
    R_caption_html = (
        f'<div class="{sid}-cap" id="{sid}-Rc">{_html.escape(R_cap)}</div>' if R_cap else ""
    )

    html = (
        f'<div class="{sid}-stage stage-drift">'
        f'{headline_html}'
        f'<div class="{sid}-grid">'
        f'  <div class="{sid}-col {sid}-left" id="{sid}-L">'
        f'    <div class="{sid}-label">{_html.escape(L_label)}</div>'
        f'    <div class="{sid}-text">{_html.escape(L_text)}</div>'
        f'    <div class="{sid}-rule" id="{sid}-Lr"></div>'
        f'    {L_caption_html}'
        f'  </div>'
        f'  <div class="{sid}-divider" id="{sid}-D">'
        f'    <div class="{sid}-divider-line"></div>'
        f'    <div class="{sid}-divider-text">{_html.escape(divider)}</div>'
        f'    <div class="{sid}-divider-line"></div>'
        f'  </div>'
        f'  <div class="{sid}-col {sid}-right" id="{sid}-R">'
        f'    <div class="{sid}-label">{_html.escape(R_label)}</div>'
        f'    <div class="{sid}-text">{_html.escape(R_text)}</div>'
        f'    <div class="{sid}-rule" id="{sid}-Rr"></div>'
        f'    {R_caption_html}'
        f'  </div>'
        f'</div>'
        f'</div>'
    )

    # Orientation-aware layout — portrait stacks vertically with horizontal
    # divider; landscape keeps the classic 1fr | auto | 1fr grid.
    if is_portrait:
        grid_css = f"""
.{sid}-grid {{
  display:flex; flex-direction:column; align-items:stretch;
  width:100%; gap:{gap_lg};
}}
.{sid}-divider {{
  display:flex; flex-direction:row; align-items:center; gap:1rem;
  width:65%; align-self:center; height:auto; opacity:0;
}}
.{sid}-divider-line {{
  height:2px; flex:1; background:linear-gradient(to right,
    transparent, var(--brand-text-secondary) 30%, var(--brand-text-secondary) 70%, transparent);
}}
"""
        text_max = "max-width:18ch;"
    else:
        grid_css = f"""
.{sid}-grid {{
  display:grid; grid-template-columns:1fr auto 1fr;
  align-items:center; width:100%; gap:{gap_lg};
}}
.{sid}-divider {{
  display:flex; flex-direction:column; align-items:center; gap:1rem;
  height:60%; opacity:0;
}}
.{sid}-divider-line {{
  width:2px; flex:1; background:linear-gradient(to bottom,
    transparent, var(--brand-text-secondary) 30%, var(--brand-text-secondary) 70%, transparent);
}}
"""
        text_max = "max-width:14ch;"

    css = f"""
.{sid}-stage {{
  position:absolute; inset:0; padding:{safe}; display:flex;
  flex-direction:column; align-items:center; justify-content:center; gap:{gap_lg};
  background:transparent; color:var(--brand-text);
  font-family:'Inter',system-ui,sans-serif;
}}
.{sid}-headline {{
  font-family:'Bebas Neue','Montserrat',sans-serif; font-size:{fs_h2};
  letter-spacing:0.02em; color:var(--brand-text); opacity:0;
  text-align:center; max-width:90%;
}}
{grid_css}
.{sid}-col {{ display:flex; flex-direction:column; align-items:center; gap:0.6rem; opacity:0; }}
.{sid}-label {{
  font-family:'Inter',sans-serif; font-size:{fs_micro};
  font-weight:700; letter-spacing:0.28em; text-transform:uppercase;
  color:var(--brand-text-secondary);
}}
.{sid}-text {{
  font-family:'Bebas Neue','Montserrat',sans-serif;
  font-size:{fs_display};
  line-height:0.95; letter-spacing:0.01em; color:var(--brand-text);
  text-align:center; {text_max}
}}
.{sid}-left .{sid}-text {{ color:var(--brand-text); }}
.{sid}-right .{sid}-text {{ color:var(--brand-primary); }}
.{sid}-rule {{
  width:0%; height:4px; background:var(--brand-accent); border-radius:2px;
  transition:none;
}}
.{sid}-cap {{
  font-family:'Inter',sans-serif; font-size:{fs_caption};
  color:var(--brand-text-secondary); font-style:italic; opacity:0;
}}
.{sid}-divider-text {{
  font-family:'Bebas Neue','Montserrat',sans-serif;
  font-size:{fs_h2}; color:var(--brand-accent); letter-spacing:0.05em;
  padding:0 0.4em;
}}
"""

    # Portrait stacks vertically → slide from top/bottom. Landscape stays
    # side-by-side → slide from left/right.
    if is_portrait:
        L_from, L_to = "y:-40", "y:0"
        R_from, R_to = "y:40", "y:0"
        # On portrait the divider spans horizontally → scale on X axis.
        div_scale_from, div_scale_axis = "scaleX:0.6", "scaleX:1"
    else:
        L_from, L_to = "x:-40", "x:0"
        R_from, R_to = "x:40", "x:0"
        div_scale_from, div_scale_axis = "scaleY:0.6", "scaleY:1"

    js = f"""
gsap.to('#{sid}-h',{{opacity:1, y:-6, duration:0.5, delay:0.10, ease:'{ease_entry}'}});
gsap.fromTo('#{sid}-D',{{opacity:0, {div_scale_from}}},{{opacity:1, {div_scale_axis}, duration:0.45, delay:0.35, ease:'{ease_emph}', transformOrigin:'center center'}});
gsap.fromTo('#{sid}-L',{{opacity:0, {L_from}}},{{opacity:1, {L_to}, duration:0.55, delay:0.50, ease:'{ease_entry}'}});
gsap.fromTo('#{sid}-R',{{opacity:0, {R_from}}},{{opacity:1, {R_to}, duration:0.55, delay:0.55, ease:'{ease_entry}'}});
gsap.to('#{sid}-Lr',{{width:'70%', duration:0.45, delay:0.95, ease:'{ease_entry}'}});
gsap.to('#{sid}-Rr',{{width:'70%', duration:0.45, delay:1.00, ease:'{ease_entry}'}});
gsap.to('#{sid}-Lc',{{opacity:1, duration:0.4, delay:1.20, ease:'power2.out'}});
gsap.to('#{sid}-Rc',{{opacity:1, duration:0.4, delay:1.25, ease:'power2.out'}});
gsap.fromTo('.{sid}-stage',{{x:0, y:0, scale:1}},{{x:12, y:-6, scale:1.02, duration:12, ease:'none'}});
"""

    audio_events = [
        {"role": "transition_in", "t": 0.10, "volume_mul": 0.85, "skill_id": "split_comparison"},
        {"role": "ui_emphasis",   "t": 0.50, "volume_mul": 0.95, "skill_id": "split_comparison"},
        {"role": "ui_emphasis",   "t": 1.00, "volume_mul": 0.85, "skill_id": "split_comparison"},
    ]

    return {"html": html, "css": css, "js": js, "audio_events": audio_events}
