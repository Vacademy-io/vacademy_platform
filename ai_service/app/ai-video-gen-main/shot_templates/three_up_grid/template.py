"""three_up_grid — Three (or 2-4) equal cells with staggered entry.

Use for: "three reasons why," "three pillars," feature triplets, step summaries.
Emits a clean grid with optional headline, numbered cells (01/02/03), each
with a title + short description. Staggered slide-up reveal.
"""
from typing import Dict, Any, List
import html as _html

METADATA = {
    "id": "three_up_grid",
    "version": "1.0.0",
    "title": "Three-Up Grid",
    "description": "2-4 equal cells with numbered headers, optional headline. Staggered slide-up reveal.",
    "use_when": "Listing 2-4 parallel concepts ('three reasons', 'three pillars', 'three benefits', step summaries). Best at 5-8s shot duration.",
    "compatible_shot_types": ["TEXT_DIAGRAM", "PROCESS_STEPS", "DATA_STORY", "*"],
    "requires_tier": "premium",
    "requires_canvas": "any",
    "example_params": {
        "headline": "Three reasons it works.",
        "items": [
            {"title": "Speed", "description": "Sub-100ms responses to any query."},
            {"title": "Memory", "description": "Remembers your last 30 days of work."},
            {"title": "Trust", "description": "Every fact is sourced and citable."},
        ],
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["items"],
    "properties": {
        "headline": {"type": "string"},
        "items": {"type": "array"},
        "show_numbers": {"type": "boolean"},
    },
}


def render(shot: Dict[str, Any], params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    shot_idx = ctx.get("shot_index", 0)
    pack = ctx.get("shot_pack") or {}
    sid = f"ttg{shot_idx}"

    fs = pack.get("font_scale", {})
    sp = pack.get("spacing", {})
    ez = pack.get("ease", {})

    fs_h1 = fs.get("h1", "5rem")
    fs_h2 = fs.get("h2", "3rem")
    fs_body = fs.get("body", "1.6rem")
    fs_caption = fs.get("caption", "1.2rem")
    fs_micro = fs.get("micro", "0.95rem")
    safe = sp.get("safe_area", "4%")
    gap_md = sp.get("md", "24px")
    gap_lg = sp.get("lg", "40px")
    ease_entry = ez.get("entry", "power3.out")

    headline = (params.get("headline") or "").strip()
    show_numbers = params.get("show_numbers", True) is not False
    items: List[Dict[str, Any]] = params.get("items") or []
    # Defensive: clamp to 2-4
    items = items[:4]
    if len(items) < 2:
        items = items + [{"title": "", "description": ""}] * (2 - len(items))

    headline_html = ""
    if headline:
        headline_html = (
            f'<div class="{sid}-headline" id="{sid}-h">{_html.escape(headline)}</div>'
        )

    cell_html = []
    for i, item in enumerate(items):
        title = (item.get("title") or "").strip()
        desc = (item.get("description") or "").strip()
        num_html = ""
        if show_numbers:
            num_html = f'<div class="{sid}-num">{i + 1:02d}</div>'
        cell_html.append(
            f'<div class="{sid}-cell" id="{sid}-c{i}">'
            f'  {num_html}'
            f'  <div class="{sid}-rule"></div>'
            f'  <div class="{sid}-ctitle">{_html.escape(title)}</div>'
            f'  <div class="{sid}-cdesc">{_html.escape(desc)}</div>'
            f'</div>'
        )

    n = len(items)
    grid_cols = "1fr " * n
    html = (
        f'<div class="{sid}-stage stage-drift" data-cells="{n}">'
        f'{headline_html}'
        f'<div class="{sid}-grid" style="grid-template-columns:{grid_cols.strip()}">'
        + "".join(cell_html)
        + '</div>'
        '</div>'
    )

    css = f"""
.{sid}-stage {{
  position:absolute; inset:0; padding:{safe}; display:flex;
  flex-direction:column; justify-content:center; gap:{gap_lg};
  font-family:'Inter',system-ui,sans-serif; color:var(--brand-text);
}}
.{sid}-headline {{
  font-family:'Bebas Neue','Montserrat',sans-serif;
  font-size:clamp(2rem,{fs_h1},6rem);
  letter-spacing:0.01em; line-height:1.05; opacity:0;
  text-align:center; max-width:90%; margin:0 auto;
}}
.{sid}-grid {{
  display:grid; gap:{gap_lg}; width:100%; align-items:start;
}}
.{sid}-cell {{
  display:flex; flex-direction:column; gap:{gap_md};
  padding:1.6rem 1.2rem; opacity:0;
  border-top:1px solid rgba(255,255,255,0.06);
}}
.{sid}-num {{
  font-family:'Bebas Neue','Montserrat',sans-serif;
  font-size:{fs_caption}; letter-spacing:0.18em;
  color:var(--brand-accent); font-weight:700;
}}
.{sid}-rule {{
  width:2.5rem; height:3px; background:var(--brand-accent);
  border-radius:2px; transform-origin:left center;
}}
.{sid}-ctitle {{
  font-family:'Bebas Neue','Montserrat',sans-serif;
  font-size:clamp(1.6rem,{fs_h2},3.5rem);
  line-height:1.05; color:var(--brand-text);
}}
.{sid}-cdesc {{
  font-family:'Inter',sans-serif;
  font-size:clamp(1rem,{fs_body},1.7rem);
  line-height:1.5; color:var(--brand-text-secondary);
  max-width:36ch;
}}
"""

    # Stagger: 0.55s base + 0.12s per cell. Headline lands at 0.20s.
    # Rule wipes in 0.10s after each cell.
    js_lines = [
        f"gsap.to('#{sid}-h',{{opacity:1, y:-6, duration:0.55, delay:0.20, ease:'{ease_entry}'}});",
    ]
    for i in range(n):
        delay_cell = 0.55 + i * 0.12
        delay_rule = delay_cell + 0.18
        js_lines.append(
            f"gsap.fromTo('#{sid}-c{i}',{{opacity:0, y:24}},"
            f"{{opacity:1, y:0, duration:0.50, delay:{delay_cell:.2f}, ease:'{ease_entry}'}});"
        )
        js_lines.append(
            f"gsap.fromTo('#{sid}-c{i} .{sid}-rule',{{scaleX:0}},"
            f"{{scaleX:1, duration:0.40, delay:{delay_rule:.2f}, ease:'{ease_entry}'}});"
        )
    js_lines.append(
        f"gsap.fromTo('.{sid}-stage',{{x:0, y:0, scale:1}},{{x:14, y:-7, scale:1.02, duration:12, ease:'none'}});"
    )
    js = "\n".join(js_lines)

    audio_events = [
        {"role": "transition_in", "t": 0.20, "volume_mul": 0.80, "skill_id": "three_up_grid"},
    ]
    for i in range(n):
        audio_events.append({
            "role": "ui_tick",
            "t": round(0.55 + i * 0.12, 3),
            "volume_mul": 0.75,
            "skill_id": "three_up_grid",
        })

    return {"html": html, "css": css, "js": js, "audio_events": audio_events}
