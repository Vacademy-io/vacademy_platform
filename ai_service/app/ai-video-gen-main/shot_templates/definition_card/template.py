"""definition_card — Term + definition framed as a single editorial card.

Use for: vocabulary explainers, jargon callouts, formal definitions. The
highest-frequency LLM-emitted pattern in educational content gets a
deterministic composition that won't drift across shots in the same run.

Layout:
   [ KICKER (optional, eyebrow)       ]
   [ TERM         | rule |  DEFINITION ]   ← landscape: 40% / rule / 55%
   [ Citation (optional, small italic) ]

Portrait stacks vertically: kicker → term → horizontal rule → definition →
citation. The shared `stage-drift` 12s tween satisfies back-half motion.

Reveal sequence (uses shot pack ease + timing tokens):
   1. Kicker fades up                    (0.05s)
   2. Term slides in from left           (0.25s)
   3. Rule draws in                      (0.50s, scaleX 0 → 1)
   4. Definition fades up                (0.70s)
   5. Citation fades in last             (1.10s)
"""
from typing import Dict, Any
import html as _html


METADATA = {
    "id": "definition_card",
    "version": "1.0.0",
    "title": "Definition Card",
    "description": "Term + definition framed as one editorial card with optional kicker and citation. Replaces the LLM's per-shot vocabulary framing.",
    "use_when": "Vocabulary explainers, jargon callouts, formal definitions, key-concept introductions. Best at 4-6s shot duration.",
    "compatible_shot_types": ["TEXT_DIAGRAM", "PROCESS_STEPS"],
    "requires_tier": "premium",
    "requires_canvas": "any",
    "example_params": {
        "kicker": "BIOLOGY 101",
        "term": "Photosynthesis",
        "definition": "The process by which green plants use sunlight to synthesize foods from carbon dioxide and water.",
        "citation": "— Oxford English Dictionary",
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["term", "definition"],
    "properties": {
        "kicker":     {"type": "string"},
        "term":       {"type": "string"},
        "definition": {"type": "string"},
        "citation":   {"type": "string"},
    },
}


def render(shot: Dict[str, Any], params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    shot_idx = ctx.get("shot_index", 0)
    sid = f"tdc{shot_idx}"  # template-definition-card

    pack = ctx.get("shot_pack") or {}
    fs = pack.get("font_scale") if isinstance(pack.get("font_scale"), dict) else {}
    sp = pack.get("spacing") if isinstance(pack.get("spacing"), dict) else {}
    ez = pack.get("ease") if isinstance(pack.get("ease"), dict) else {}

    # Fallbacks match `portrait_720` bucket from _CANVAS_TIER_RULES so the
    # template stays safe even when shot_pack is absent.
    fs_term = fs.get("display", "clamp(2rem, min(14vw, 8vh), 6.25rem)")
    fs_body = fs.get("body", "clamp(0.95rem, min(3.4vw, 1.9vh), 1.5rem)")
    fs_caption = fs.get("caption", "clamp(0.75rem, 1.9vmin, 0.9rem)")
    fs_micro = fs.get("micro", "clamp(0.75rem, 1.9vmin, 0.9rem)")
    safe = sp.get("safe_area", "5%")
    gap_lg = sp.get("lg", "40px")
    ease_entry = ez.get("entry", "power3.out")
    ease_emph = ez.get("emphasis", "back.out(1.4)")

    canvas_w = int(ctx.get("canvas_w", 1920) or 1920)
    canvas_h = int(ctx.get("canvas_h", 1080) or 1080)
    is_portrait = canvas_h > canvas_w

    kicker = (params.get("kicker") or "").strip()
    term = (params.get("term") or "").strip()
    definition = (params.get("definition") or "").strip()
    citation = (params.get("citation") or "").strip()

    kicker_html = (
        f'<div class="{sid}-kicker" id="{sid}-k">{_html.escape(kicker)}</div>'
        if kicker else ""
    )
    citation_html = (
        f'<div class="{sid}-citation" id="{sid}-c">{_html.escape(citation)}</div>'
        if citation else ""
    )

    # The layout itself: term | rule | definition (landscape) or stacked
    # (portrait). The rule's role differs by orientation:
    #   landscape — vertical 4px wide, separates the two columns
    #   portrait  — horizontal full-width-of-term, lives between term + def
    html = (
        f'<div class="{sid}-stage stage-drift">'
        f'{kicker_html}'
        f'<div class="{sid}-body">'
        f'  <div class="{sid}-term" id="{sid}-t">{_html.escape(term)}</div>'
        f'  <div class="{sid}-rule" id="{sid}-r"></div>'
        f'  <div class="{sid}-def" id="{sid}-d">{_html.escape(definition)}</div>'
        f'</div>'
        f'{citation_html}'
        f'</div>'
    )

    if is_portrait:
        body_css = f"""
.{sid}-body {{
  display:flex; flex-direction:column; align-items:flex-start;
  gap:1.4rem; width:100%; max-width:90%;
}}
.{sid}-rule {{
  width:18%; height:4px; background:var(--brand-accent); border-radius:2px;
  transform:scaleX(0); transform-origin:left center;
}}
"""
        term_align = "text-align:left;"
        def_align = "text-align:left; max-width:38ch;"
    else:
        body_css = f"""
.{sid}-body {{
  display:grid; grid-template-columns:minmax(0, 0.85fr) auto minmax(0, 1.15fr);
  align-items:center; gap:{gap_lg}; width:100%;
}}
.{sid}-rule {{
  width:4px; height:60%; background:var(--brand-accent); border-radius:2px;
  align-self:center;
  transform:scaleY(0); transform-origin:center;
}}
"""
        term_align = "text-align:right;"
        def_align = "text-align:left; max-width:46ch;"

    # Stage uses flex column so kicker, body, citation stack with consistent
    # `gap_lg` spacing — keeps vertical rhythm regardless of orientation.
    css = f"""
.{sid}-stage {{
  position:absolute; inset:0; padding:{safe};
  display:flex; flex-direction:column; align-items:flex-start; justify-content:center;
  gap:{gap_lg};
  color:var(--brand-text);
  font-family:'Inter',system-ui,sans-serif;
}}
.{sid}-kicker {{
  font-family:'Inter',sans-serif; font-size:{fs_micro};
  font-weight:700; letter-spacing:0.28em; text-transform:uppercase;
  color:var(--brand-accent); opacity:0;
}}
{body_css}
.{sid}-term {{
  font-family:'Bebas Neue','Montserrat',sans-serif; font-size:{fs_term};
  letter-spacing:0.005em; line-height:0.95;
  color:var(--brand-text);
  opacity:0; will-change:transform;
  padding-bottom:0.12em;
  {term_align}
  overflow-wrap:anywhere;
}}
.{sid}-def {{
  font-family:'Inter',sans-serif; font-size:{fs_body};
  line-height:1.45; color:var(--brand-text);
  opacity:0;
  {def_align}
  font-weight:400;
}}
.{sid}-citation {{
  font-family:'Inter',sans-serif; font-size:{fs_caption};
  letter-spacing:0.08em; color:var(--brand-text-secondary);
  font-style:italic; opacity:0;
}}
"""

    # Animation timeline:
    # - kicker  : 0.05s, fade-up
    # - term    : 0.25s, slide from -10px x (landscape) or -8px y (portrait)
    # - rule    : 0.50s, scale to 1
    # - def     : 0.70s, fade-up
    # - citation: 1.10s, fade-in
    # - stage-drift: 12s slow drift (back-half motion satisfied by composer)
    term_from = ("y:-8" if is_portrait else "x:-20")
    term_to = ("y:0" if is_portrait else "x:0")
    rule_scale_axis = ("scaleX" if is_portrait else "scaleY")
    js = f"""
gsap.to('#{sid}-k', {{opacity:1, y:-4, duration:0.45, delay:0.05, ease:'{ease_entry}'}});
gsap.fromTo('#{sid}-t', {{opacity:0, {term_from}}}, {{opacity:1, {term_to}, duration:0.55, delay:0.25, ease:'{ease_entry}'}});
gsap.to('#{sid}-r', {{{rule_scale_axis}:1, duration:0.45, delay:0.50, ease:'{ease_emph}'}});
gsap.to('#{sid}-d', {{opacity:1, y:-4, duration:0.55, delay:0.70, ease:'{ease_entry}'}});
gsap.to('#{sid}-c', {{opacity:1, duration:0.45, delay:1.10, ease:'power2.out'}});
gsap.fromTo('.{sid}-stage', {{x:0, y:0, scale:1}}, {{x:10, y:-5, scale:1.02, duration:12, ease:'none'}});
"""

    audio_events = [
        {"role": "transition_in", "t": 0.05, "volume_mul": 0.80, "skill_id": "definition_card"},
        {"role": "ui_emphasis",   "t": 0.50, "volume_mul": 0.85, "skill_id": "definition_card"},
        {"role": "ui_tick",       "t": 0.70, "volume_mul": 0.70, "skill_id": "definition_card"},
    ]

    return {"html": html, "css": css, "js": js, "audio_events": audio_events}
