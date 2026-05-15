"""timeline_horizontal — 3-5 events on an axis line; date pins reveal in sequence.

Use for: historical beats, "how it evolved", roadmaps, generational change.

Layout (landscape):
   ─────●─────●─────●─────●─────
        │     │     │     │
       1945  1969  1989  2009    ← date row
       WWII  Moon  Wall  iPhone  ← label row (alternates above/below)

Layout (portrait): vertical axis on the left, pins to the right with labels
extending rightward. Same animation grammar but rotated 90°.

Reveal sequence:
   1. Axis line draws 0% → 100%       (0.25s, duration 0.6s)
   2. Pins scale-pop in sequence      (0.55s + i × 0.18s)
   3. Date + label fade in per pin    (pin_delay + 0.15s)
   4. stage-drift 12s slow drift       (back-half motion)
"""
from typing import Dict, Any, List
import html as _html


METADATA = {
    "id": "timeline_horizontal",
    "version": "1.0.0",
    "title": "Horizontal Timeline",
    "description": "3-5 events on an axis line. Pins reveal in sequence; date + label fade in per pin. Portrait rotates to vertical axis.",
    "use_when": "Historical sequences, roadmaps, 'how it evolved' beats, generational change. Best at 5-8s shot duration.",
    "compatible_shot_types": ["PROCESS_STEPS", "DATA_STORY"],
    "requires_tier": "premium",
    "requires_canvas": "any",
    "example_params": {
        "headline": "How the world changed",
        "events": [
            {"date": "1945", "label": "WWII ends"},
            {"date": "1969", "label": "Moon landing"},
            {"date": "1989", "label": "Berlin Wall"},
            {"date": "2007", "label": "iPhone"},
        ],
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["events"],
    "properties": {
        "headline": {"type": "string"},
        "events":   {"type": "array"},
    },
}


def render(shot: Dict[str, Any], params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    shot_idx = ctx.get("shot_index", 0)
    sid = f"tth{shot_idx}"

    pack = ctx.get("shot_pack") or {}
    fs = pack.get("font_scale") if isinstance(pack.get("font_scale"), dict) else {}
    sp = pack.get("spacing") if isinstance(pack.get("spacing"), dict) else {}
    ez = pack.get("ease") if isinstance(pack.get("ease"), dict) else {}

    fs_h1 = fs.get("h1", "clamp(1.6rem, min(10.5vw, 6vh), 4.75rem)")
    fs_h2 = fs.get("h2", "clamp(1.2rem, min(7vw, 4vh), 3.1rem)")
    fs_body = fs.get("body", "clamp(0.95rem, min(3.4vw, 1.9vh), 1.5rem)")
    fs_caption = fs.get("caption", "clamp(0.75rem, 1.9vmin, 0.9rem)")
    safe = sp.get("safe_area", "5%")
    gap_lg = sp.get("lg", "40px")
    ease_entry = ez.get("entry", "power3.out")
    ease_emph = ez.get("emphasis", "back.out(1.6)")

    canvas_w = int(ctx.get("canvas_w", 1920) or 1920)
    canvas_h = int(ctx.get("canvas_h", 1080) or 1080)
    is_portrait = canvas_h > canvas_w

    headline = (params.get("headline") or "").strip()
    raw_events: List[Dict[str, Any]] = params.get("events") or []
    # Clamp to 3-5 events. Fewer than 3 looks empty on a timeline; more than 5
    # crowds the axis to the point of unreadability at portrait widths.
    events = [e for e in raw_events if isinstance(e, dict)][:5]
    if len(events) < 2:
        # Defensive: pad with placeholders rather than crash. Real callers
        # always pass 3+; this is for unit tests / preview shells.
        events = events + [{"date": "—", "label": ""}] * (2 - len(events))
    n = len(events)

    headline_html = (
        f'<div class="{sid}-headline" id="{sid}-h">{_html.escape(headline)}</div>'
        if headline else ""
    )

    # Build each pin's DOM. The pin itself is a small circle; the date and
    # label are siblings positioned relative to the pin via the column flex.
    # Alternating above/below in landscape spreads labels so they don't collide.
    pin_html_parts = []
    for i, ev in enumerate(events):
        date = str(ev.get("date", "") or "")
        label = str(ev.get("label", "") or "")
        above_below = "above" if i % 2 == 0 else "below"
        pin_html_parts.append(
            f'<div class="{sid}-col {sid}-col-{above_below}" id="{sid}-col-{i}">'
            f'  <div class="{sid}-date {sid}-date-top" id="{sid}-d-top-{i}">'
            f'    {_html.escape(date) if above_below == "above" else ""}'
            f'  </div>'
            f'  <div class="{sid}-label {sid}-label-top" id="{sid}-l-top-{i}">'
            f'    {_html.escape(label) if above_below == "above" else ""}'
            f'  </div>'
            f'  <div class="{sid}-pin" id="{sid}-pin-{i}">'
            f'    <div class="{sid}-pin-dot"></div>'
            f'  </div>'
            f'  <div class="{sid}-date {sid}-date-bot" id="{sid}-d-bot-{i}">'
            f'    {_html.escape(date) if above_below == "below" else ""}'
            f'  </div>'
            f'  <div class="{sid}-label {sid}-label-bot" id="{sid}-l-bot-{i}">'
            f'    {_html.escape(label) if above_below == "below" else ""}'
            f'  </div>'
            f'</div>'
        )

    # Axis line is a single absolute-positioned div that scales from 0 → 1.
    # The pins live above/below the axis line via the columns' flex layout.
    html = (
        f'<div class="{sid}-stage stage-drift">'
        f'{headline_html}'
        f'<div class="{sid}-track" id="{sid}-track">'
        f'<div class="{sid}-axis" id="{sid}-axis"></div>'
        f'<div class="{sid}-pins">' + "".join(pin_html_parts) + '</div>'
        f'</div>'
        f'</div>'
    )

    if is_portrait:
        track_css = f"""
.{sid}-track {{
  position:relative; width:100%; min-height:60%;
  display:flex; flex-direction:row; align-items:stretch;
}}
.{sid}-axis {{
  position:absolute; left:18%; top:0; bottom:0; width:3px;
  background:var(--brand-text-secondary);
  transform:scaleY(0); transform-origin:top center;
}}
.{sid}-pins {{
  display:flex; flex-direction:column; justify-content:space-around;
  width:100%; gap:1rem;
}}
.{sid}-col {{
  display:grid; grid-template-columns:18% auto 1fr;
  align-items:center; gap:1rem;
}}
.{sid}-col .{sid}-pin {{ grid-column:2; }}
.{sid}-col .{sid}-date-top,
.{sid}-col .{sid}-date-bot {{
  grid-column:1; text-align:right; padding-right:1rem;
  font-family:'Bebas Neue','Montserrat',sans-serif;
  font-size:{fs_h2};
}}
.{sid}-col .{sid}-label-top,
.{sid}-col .{sid}-label-bot {{
  grid-column:3; text-align:left;
  font-family:'Inter',sans-serif;
  font-size:{fs_body};
}}
"""
    else:
        # Landscape: cols are evenly distributed across the track width via flex;
        # the axis is a horizontal rule across the middle. Each col is a vertical
        # stack with date+label above (even i) or below (odd i).
        track_css = f"""
.{sid}-track {{
  position:relative; width:100%; height:60%;
  display:flex; align-items:center;
}}
.{sid}-axis {{
  position:absolute; left:0; right:0; top:50%; height:3px; margin-top:-1px;
  background:var(--brand-text-secondary);
  transform:scaleX(0); transform-origin:left center;
}}
.{sid}-pins {{
  position:relative; width:100%; display:flex; flex-direction:row;
  justify-content:space-around; align-items:center; padding:0 4%;
}}
.{sid}-col {{
  display:flex; flex-direction:column; align-items:center; gap:0.4rem;
  flex:0 0 auto;
}}
.{sid}-col-below {{ flex-direction:column-reverse; }}
.{sid}-col .{sid}-date {{
  font-family:'Bebas Neue','Montserrat',sans-serif;
  font-size:{fs_h2};
  text-align:center; line-height:1;
}}
.{sid}-col .{sid}-label {{
  font-family:'Inter',sans-serif;
  font-size:{fs_body};
  text-align:center; max-width:14ch; line-height:1.2;
}}
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
  font-size:{fs_h1}; letter-spacing:0.01em; line-height:1.05;
  opacity:0; text-align:center; max-width:90%;
}}
{track_css}
.{sid}-pin {{
  width:1rem; height:1rem; border-radius:50%; position:relative;
  background:transparent; opacity:0; transform:scale(0.4);
}}
.{sid}-pin-dot {{
  position:absolute; inset:0; border-radius:50%;
  background:var(--brand-accent);
  box-shadow:0 0 0 4px rgba(255,255,255,0.06), 0 0 12px 4px rgba(255,255,255,0.04);
}}
.{sid}-date {{
  color:var(--brand-text); letter-spacing:0.03em;
  opacity:0;
}}
.{sid}-label {{
  color:var(--brand-text-secondary); font-weight:500;
  opacity:0;
}}
"""

    # Timeline:
    #  - axis: 0.25s, scale to 1 over 0.6s
    #  - pins: 0.55s + i*0.18
    #  - date/label per pin: pin_delay + 0.15
    #  - stage drift: 12s (back-half satisfied)
    axis_scale_axis = "scaleY" if is_portrait else "scaleX"
    js_parts = [
        f"gsap.to('#{sid}-h', {{opacity:1, y:-4, duration:0.5, delay:0.15, ease:'{ease_entry}'}});",
        f"gsap.to('#{sid}-axis', {{{axis_scale_axis}:1, duration:0.6, delay:0.25, ease:'{ease_entry}'}});",
    ]
    for i in range(n):
        pin_delay = 0.55 + i * 0.18
        text_delay = pin_delay + 0.15
        js_parts.append(
            f"gsap.to('#{sid}-pin-{i}', {{opacity:1, scale:1, duration:0.45, delay:{pin_delay:.2f}, ease:'{ease_emph}'}});"
        )
        # Animate whichever date/label pair has content for this column. The
        # other pair has empty text content so the tween on it is a no-op
        # (renders nothing). Cheaper than branching JS per-column.
        js_parts.append(
            f"gsap.to(['#{sid}-d-top-{i}','#{sid}-d-bot-{i}'], {{opacity:1, y:0, duration:0.4, delay:{text_delay:.2f}, ease:'power2.out'}});"
        )
        js_parts.append(
            f"gsap.to(['#{sid}-l-top-{i}','#{sid}-l-bot-{i}'], {{opacity:1, y:0, duration:0.4, delay:{text_delay + 0.08:.2f}, ease:'power2.out'}});"
        )
    js_parts.append(
        f"gsap.fromTo('.{sid}-stage', {{x:0, y:0, scale:1}}, {{x:10, y:-5, scale:1.02, duration:12, ease:'none'}});"
    )
    js = "\n".join(js_parts)

    # Audio: ui_tick per pin, ui_positive on the last one.
    audio_events = [
        {"role": "transition_in", "t": 0.15, "volume_mul": 0.80, "skill_id": "timeline_horizontal"},
    ]
    for i in range(n):
        pin_delay = 0.55 + i * 0.18
        role = "ui_positive" if i == n - 1 else "ui_tick"
        audio_events.append({
            "role": role,
            "t": round(pin_delay, 3),
            "volume_mul": 0.75 + (0.1 if i == n - 1 else 0.0),
            "skill_id": "timeline_horizontal",
        })

    return {"html": html, "css": css, "js": js, "audio_events": audio_events}
