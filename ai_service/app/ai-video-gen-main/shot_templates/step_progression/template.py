"""step_progression — Numbered steps with arrows between, animated in sequence.

Use for: onboarding flows, how-to-X explainers, multi-stage processes,
funnels. The shot's narrative is "do A, then B, then C" — the template
makes the sequence visually explicit so the LLM doesn't have to.

Layout (landscape):
   ┌─────┐    ┌─────┐    ┌─────┐
   │  1  │ → │  2  │ → │  3  │
   │Sign │    │Build│    │Ship │
   │up   │    │     │    │     │
   └─────┘    └─────┘    └─────┘

Layout (portrait): vertical stack with down-arrows between cards.

Reveal sequence:
   1. Headline fades up                 (0.15s)
   2. Each step slides + scales in      (0.40s + i × 0.32s)
   3. Each arrow strokes in AFTER its preceding step's body lands
                                        (step_delay + 0.30s)
   4. Last step gets an emphasis pulse  (final_step_delay + 0.5s)
   5. stage-drift                       (back-half motion)
"""
from typing import Dict, Any, List
import html as _html


METADATA = {
    "id": "step_progression",
    "version": "1.0.0",
    "title": "Step Progression",
    "description": "Numbered steps with animated arrows between. Step 1 → Step 2 → Step 3. Landscape flows right; portrait flows down.",
    "use_when": "Onboarding flows, how-to-X explainers, multi-stage processes, funnels. 2-5 steps. Best at 5-9s shot duration.",
    "compatible_shot_types": ["PROCESS_STEPS"],
    "requires_tier": "premium",
    "requires_canvas": "any",
    "example_params": {
        "headline": "How it works.",
        "steps": [
            {"number": "1", "title": "Sign up", "description": "Create your account in seconds."},
            {"number": "2", "title": "Connect data", "description": "Link your sources, no SQL needed."},
            {"number": "3", "title": "Ship it", "description": "Publish a live dashboard your team can use."},
        ],
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["steps"],
    "properties": {
        "headline": {"type": "string"},
        "steps":    {"type": "array"},
    },
}


def render(shot: Dict[str, Any], params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    shot_idx = ctx.get("shot_index", 0)
    sid = f"tsp{shot_idx}"

    pack = ctx.get("shot_pack") or {}
    fs = pack.get("font_scale") if isinstance(pack.get("font_scale"), dict) else {}
    sp = pack.get("spacing") if isinstance(pack.get("spacing"), dict) else {}
    ez = pack.get("ease") if isinstance(pack.get("ease"), dict) else {}

    fs_h1 = fs.get("h1", "clamp(1.6rem, min(10.5vw, 6vh), 4.75rem)")
    fs_h2 = fs.get("h2", "clamp(1.2rem, min(7vw, 4vh), 3.1rem)")
    fs_body = fs.get("body", "clamp(0.95rem, min(3.4vw, 1.9vh), 1.5rem)")
    fs_caption = fs.get("caption", "clamp(0.75rem, 1.9vmin, 0.9rem)")
    safe = sp.get("safe_area", "5%")
    gap_md = sp.get("md", "24px")
    gap_lg = sp.get("lg", "40px")
    ease_entry = ez.get("entry", "power3.out")
    ease_emph = ez.get("emphasis", "back.out(1.5)")

    canvas_w = int(ctx.get("canvas_w", 1920) or 1920)
    canvas_h = int(ctx.get("canvas_h", 1080) or 1080)
    is_portrait = canvas_h > canvas_w

    headline = (params.get("headline") or "").strip()
    raw_steps: List[Dict[str, Any]] = params.get("steps") or []
    # Clamp to 2-5 steps; defensively pad if caller passes 0-1.
    steps = [s for s in raw_steps if isinstance(s, dict)][:5]
    if len(steps) < 2:
        steps = steps + [{"number": "", "title": "", "description": ""}] * (2 - len(steps))
    n = len(steps)

    headline_html = (
        f'<div class="{sid}-headline" id="{sid}-h">{_html.escape(headline)}</div>'
        if headline else ""
    )

    # Each cell holds a numbered badge, title, and description. The arrow
    # between cells is a separate sibling (one fewer than cells). We render
    # cells and arrows interleaved so the grid/flex picks up the natural order.
    items_html = []
    for i, step in enumerate(steps):
        num = str(step.get("number", "") or f"{i + 1}").strip()
        title = str(step.get("title", "") or "").strip()
        desc = str(step.get("description", "") or "").strip()
        items_html.append(
            f'<div class="{sid}-cell" id="{sid}-cell-{i}">'
            f'  <div class="{sid}-badge"><span class="{sid}-badge-num">{_html.escape(num)}</span></div>'
            f'  <div class="{sid}-title">{_html.escape(title)}</div>'
            f'  <div class="{sid}-desc">{_html.escape(desc)}</div>'
            f'</div>'
        )
        if i < n - 1:
            # Arrow between this cell and the next. SVG path with stroke-dasharray
            # so we can animate stroke-dashoffset → 0 (draw-in).
            if is_portrait:
                # Vertical down-arrow. viewBox 0 0 24 48, path from top center to bottom with arrowhead.
                arrow_svg = (
                    f'<svg class="{sid}-arrow-svg" viewBox="0 0 24 48" preserveAspectRatio="none">'
                    f'<path id="{sid}-arrow-path-{i}" '
                    f'd="M12 2 L12 36 M6 30 L12 38 L18 30" '
                    f'fill="none" stroke="var(--brand-accent)" stroke-width="3" '
                    f'stroke-linecap="round" stroke-linejoin="round" '
                    f'pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>'
                    f'</svg>'
                )
            else:
                # Horizontal right-arrow. viewBox 0 0 48 24.
                arrow_svg = (
                    f'<svg class="{sid}-arrow-svg" viewBox="0 0 48 24" preserveAspectRatio="none">'
                    f'<path id="{sid}-arrow-path-{i}" '
                    f'd="M2 12 L36 12 M30 6 L38 12 L30 18" '
                    f'fill="none" stroke="var(--brand-accent)" stroke-width="3" '
                    f'stroke-linecap="round" stroke-linejoin="round" '
                    f'pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>'
                    f'</svg>'
                )
            items_html.append(
                f'<div class="{sid}-arrow" id="{sid}-arrow-{i}">{arrow_svg}</div>'
            )

    html = (
        f'<div class="{sid}-stage stage-drift">'
        f'{headline_html}'
        f'<div class="{sid}-flow">' + "".join(items_html) + '</div>'
        f'</div>'
    )

    if is_portrait:
        # Portrait → column flex; cells full-width but capped via max-width;
        # arrows are tall + thin between cells. Description uses left-align so
        # multi-line body reads naturally.
        flow_css = f"""
.{sid}-flow {{
  display:flex; flex-direction:column; align-items:stretch;
  gap:0.8rem; width:100%; max-width:88%; margin:0 auto;
}}
.{sid}-cell {{
  display:flex; flex-direction:row; align-items:flex-start; gap:1rem;
  padding:1rem 1.1rem;
  border-radius:14px; background:rgba(255,255,255,0.04);
  border:1px solid rgba(255,255,255,0.08);
  opacity:0; will-change:transform;
}}
.{sid}-badge {{
  flex:0 0 auto; width:2.6rem; height:2.6rem;
  border-radius:50%; display:flex; align-items:center; justify-content:center;
  background:var(--brand-accent);
}}
.{sid}-badge-num {{
  font-family:'Bebas Neue','Montserrat',sans-serif; font-size:1.5rem;
  color:#000; font-weight:900; line-height:1; padding-top:0.05em;
}}
.{sid}-title {{
  font-family:'Bebas Neue','Montserrat',sans-serif; font-size:{fs_h2};
  letter-spacing:0.005em; line-height:1.05;
  color:var(--brand-text); padding-bottom:0.1em;
}}
.{sid}-desc {{
  font-family:'Inter',sans-serif; font-size:{fs_body};
  color:var(--brand-text-secondary); line-height:1.45;
  margin-top:0.25rem;
}}
.{sid}-cell > .{sid}-title,
.{sid}-cell > .{sid}-desc {{ flex:1; min-width:0; overflow-wrap:anywhere; }}
.{sid}-cell {{ display:grid; grid-template-columns:auto 1fr; grid-template-rows:auto auto; column-gap:1rem; }}
.{sid}-cell .{sid}-badge {{ grid-row:1 / span 2; align-self:center; }}
.{sid}-arrow {{
  align-self:center; height:2.2rem; width:1.5rem; opacity:0;
}}
.{sid}-arrow-svg {{ width:100%; height:100%; display:block; }}
"""
    else:
        # Landscape → row grid; equal flex per cell, arrows in between as
        # auto-width columns. Cell stacks badge + title + desc vertically.
        flow_css = f"""
.{sid}-flow {{
  display:flex; flex-direction:row; align-items:stretch;
  justify-content:center; gap:0;
  width:100%;
}}
.{sid}-cell {{
  flex:1 1 0; min-width:0;
  display:flex; flex-direction:column; align-items:center;
  gap:0.8rem; padding:1.4rem 1.1rem;
  border-radius:18px; background:rgba(255,255,255,0.04);
  border:1px solid rgba(255,255,255,0.08);
  opacity:0; will-change:transform;
  text-align:center;
}}
.{sid}-badge {{
  width:3.4rem; height:3.4rem;
  border-radius:50%; display:flex; align-items:center; justify-content:center;
  background:var(--brand-accent);
}}
.{sid}-badge-num {{
  font-family:'Bebas Neue','Montserrat',sans-serif; font-size:2rem;
  color:#000; font-weight:900; line-height:1; padding-top:0.05em;
}}
.{sid}-title {{
  font-family:'Bebas Neue','Montserrat',sans-serif; font-size:{fs_h2};
  letter-spacing:0.005em; line-height:1.05;
  color:var(--brand-text); padding-bottom:0.1em;
  overflow-wrap:anywhere;
}}
.{sid}-desc {{
  font-family:'Inter',sans-serif; font-size:{fs_body};
  color:var(--brand-text-secondary); line-height:1.45;
  max-width:24ch;
}}
.{sid}-arrow {{
  flex:0 0 auto; align-self:center; width:3.6rem; height:1.6rem;
  margin:0 0.6rem; opacity:0;
}}
.{sid}-arrow-svg {{ width:100%; height:100%; display:block; }}
"""

    css = f"""
.{sid}-stage {{
  position:absolute; inset:0; padding:{safe};
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:{gap_lg};
  color:var(--brand-text);
  font-family:'Inter',system-ui,sans-serif;
}}
.{sid}-headline {{
  font-family:'Bebas Neue','Montserrat',sans-serif;
  font-size:{fs_h1}; letter-spacing:0.005em; line-height:1.05;
  opacity:0; text-align:center; max-width:90%;
}}
{flow_css}
"""

    # Timeline:
    #   0.15s — headline fade up
    #   step i: 0.40 + i*0.32s slide+scale in
    #   arrow i: step_i_delay + 0.30 draw in (stroke-dashoffset 100→0)
    #   last step gets a final emphasis pulse at last_step_delay + 0.55
    #   stage-drift 12s — back-half motion
    js_parts = [
        f"gsap.to('#{sid}-h', {{opacity:1, y:-4, duration:0.5, delay:0.15, ease:'{ease_entry}'}});",
    ]
    step_from = ("y:18, scale:0.94" if is_portrait else "y:14, scale:0.94")
    step_to = ("y:0, scale:1" if is_portrait else "y:0, scale:1")
    last_cell_delay = 0.4
    for i in range(n):
        cell_delay = 0.40 + i * 0.32
        last_cell_delay = cell_delay
        js_parts.append(
            f"gsap.fromTo('#{sid}-cell-{i}', "
            f"{{opacity:0, {step_from}}}, "
            f"{{opacity:1, {step_to}, duration:0.55, delay:{cell_delay:.2f}, ease:'{ease_emph}'}});"
        )
        if i < n - 1:
            arrow_delay = cell_delay + 0.30
            js_parts.append(
                f"gsap.to('#{sid}-arrow-{i}', {{opacity:1, duration:0.2, delay:{arrow_delay:.2f}}});"
            )
            js_parts.append(
                f"gsap.to('#{sid}-arrow-path-{i}', "
                f"{{strokeDashoffset:0, duration:0.45, delay:{arrow_delay:.2f}, ease:'power2.out'}});"
            )
    # Last-cell emphasis pulse (subtle).
    js_parts.append(
        f"gsap.fromTo('#{sid}-cell-{n - 1}', "
        f"{{boxShadow:'0 0 0 0 rgba(255,255,255,0)'}}, "
        f"{{boxShadow:'0 0 0 8px rgba(255,255,255,0.06)', "
        f"duration:0.5, delay:{last_cell_delay + 0.55:.2f}, "
        f"yoyo:true, repeat:1, ease:'sine.inOut'}});"
    )
    js_parts.append(
        f"gsap.fromTo('.{sid}-stage', {{x:0, y:0, scale:1}}, {{x:10, y:-5, scale:1.02, duration:12, ease:'none'}});"
    )
    js = "\n".join(js_parts)

    audio_events = [
        {"role": "transition_in", "t": 0.15, "volume_mul": 0.80, "skill_id": "step_progression"},
    ]
    for i in range(n):
        cell_delay = 0.40 + i * 0.32
        role = "ui_positive" if i == n - 1 else "ui_tick"
        audio_events.append({
            "role": role,
            "t": round(cell_delay, 3),
            "volume_mul": 0.75 + (0.1 if i == n - 1 else 0.0),
            "skill_id": "step_progression",
        })

    return {"html": html, "css": css, "js": js, "audio_events": audio_events}
