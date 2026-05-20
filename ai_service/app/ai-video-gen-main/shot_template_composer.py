"""
Shot Template Composer — renders one full shot from a template.

Unlike skill_composer (which scans HTML for `<skill>` tags and substitutes
each one), the template composer is invoked once per shot when the Director
plan sets `template_id` on a shot. There is no LLM call for template shots —
the composer produces the full HTML/CSS/JS deterministically from
`template_params`.

Input:
  shot: the shot dict from the Director plan (must contain `template_id`,
        optionally `template_params`, plus shot-pack-relevant fields like
        `narration_excerpt`, `start_time`, `end_time`)
  ctx:  rendering context — {shot_index, canvas_w, canvas_h, tier, shot_type,
                             shot_pack, transition_in, transition_css_block}

Output: dict with keys:
  - html: a complete shot HTML string ready for _ensure_fonts() injection
  - skipped: bool — True if no template_id or template invalid (caller falls
                    back to LLM path)
  - reason: str — diagnostic explaining skip/render
  - template_id: str — what was rendered (for logging)
  - audio_events: list of {role, t, volume_mul, ...} for the Sound Planner

The composer never raises on a malformed template invocation — it logs and
returns `skipped=True` so the caller can fall back to the LLM HTML path.
"""
from __future__ import annotations

from typing import Dict, Any, List

from shot_template_registry import get_registry, validate_params


# Shot types whose specialized builders in _shot_task always win over a
# template choice. Even an explicit Director `template_id` is ignored for
# these — we fall through to the LLM/builder path. Order:
#   - KINETIC_TEXT  : word-by-word pipeline build (super_ultra)
#   - KINETIC_TITLE : zoom-in convention with slam reveal
#   - SOURCE_CLIP   : composites the user's uploaded video footage
#   - IMAGE_CLIP    : LLM produces overlay HTML; post-Director injector
#                     embeds the user's uploaded image URL. Templates
#                     would produce generic HTML and bypass that injector,
#                     leaving {{IMAGE_URL}} unsubstituted.
_SPECIALIZED_SHOT_TYPES = frozenset({
    "KINETIC_TEXT",
    "KINETIC_TITLE",
    "SOURCE_CLIP",
    "IMAGE_CLIP",
    # AI_VIDEO_HERO (Phase 3b): the entire shot is a Veo-generated MP4
    # wrapped in a minimal <video> element. A shot template would emit
    # generic HTML and shadow the Veo content. Never run through templates.
    "AI_VIDEO_HERO",
})


def compose(shot: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Render a single shot from its template_id. Caller falls back if skipped."""
    template_id = shot.get("template_id")
    if not template_id or not isinstance(template_id, str):
        return _skip("no template_id on shot", "")

    reg = get_registry()
    tmpl = reg.get(template_id)
    if not tmpl:
        return _skip(f"unknown template_id '{template_id}'", template_id)

    # Shot-type compatibility check. Two layers:
    #   1. A hardcoded BLOCKLIST of specialized shot types that must NEVER run
    #      through a template — they have their own deterministic builders
    #      later in _shot_task that produce richer output:
    #        - KINETIC_TEXT  : word-by-word pipeline-built sync (super_ultra)
    #        - KINETIC_TITLE : zoom-in convention + slam reveal
    #        - SOURCE_CLIP   : composites user-uploaded video footage
    #   2. The template's own METADATA["compatible_shot_types"] allow-list.
    #
    # The blocklist is enforced first regardless of "*" wildcards so an
    # over-permissive template can never clobber a specialized builder.
    shot_type = ctx.get("shot_type") or shot.get("shot_type") or ""
    if shot_type in _SPECIALIZED_SHOT_TYPES:
        return _skip(
            f"template '{template_id}' refusing specialized shot_type "
            f"'{shot_type}' (has dedicated builder)",
            template_id,
        )
    compat = tmpl.get("compatible_shot_types") or ["*"]
    if "*" not in compat and shot_type and shot_type not in compat:
        return _skip(
            f"template '{template_id}' not compatible with shot_type '{shot_type}' "
            f"(compatible: {compat})",
            template_id,
        )

    params = shot.get("template_params") or {}
    if not isinstance(params, dict):
        return _skip(f"template_params for '{template_id}' is not a dict", template_id)

    # Validate against the template's loose schema.
    valid, issues = validate_params(template_id, params)
    if not valid:
        return _skip(
            f"template '{template_id}' invalid params: {'; '.join(issues)}",
            template_id,
        )

    # Invoke the template render. Anything thrown is caught — templates must
    # never crash the pipeline.
    try:
        rendered = tmpl["render"](shot, params, ctx)
    except Exception as e:
        return _skip(f"template '{template_id}' render error: {e}", template_id)

    if not isinstance(rendered, dict):
        return _skip(f"template '{template_id}' render() did not return a dict", template_id)

    html_frag = rendered.get("html", "") or ""
    css_frag = rendered.get("css", "") or ""
    js_frag = rendered.get("js", "") or ""

    if not html_frag.strip():
        return _skip(f"template '{template_id}' produced empty html", template_id)

    audio_events: List[Dict[str, Any]] = []
    for ev in rendered.get("audio_events", []) or []:
        if isinstance(ev, dict) and "role" in ev and "t" in ev:
            audio_events.append({**ev, "skill_id": ev.get("skill_id", template_id)})

    # Assemble the final shot HTML. Format mirrors what the LLM would emit:
    # an outer #shot-root div with optional transition tween + style + content.
    #
    # IMPORTANT: do NOT wrap inline scripts in `window.addEventListener('load')`.
    # In the render server, each shot lives in a shadow-root-scoped <div>, not
    # an iframe — there is no per-shadow `load` event. Inline scripts execute
    # synchronously when parsed; by then GSAP is already global (loaded by the
    # outer harness) so a plain IIFE with a `typeof gsap` guard is enough and
    # works identically in browser-iframe and Playwright shadow-DOM contexts.
    transition_block = ctx.get("transition_css_block") or ""
    transition_script = ""
    if transition_block:
        transition_script = (
            f"<script data-template-transition=\"{template_id}\">"
            f"(function(){{if(typeof gsap==='undefined')return;{transition_block}}})();"
            f"</script>"
        )

    css_block = f"<style data-template-css=\"{template_id}\">{css_frag}</style>" if css_frag else ""
    js_block = ""
    if js_frag:
        js_block = (
            f"<script data-template-js=\"{template_id}\">"
            f"(function(){{if(typeof gsap==='undefined')return;{js_frag}}})();"
            f"</script>"
        )

    full_html = (
        "<div id=\"shot-root\" style=\"position:relative;width:100%;height:100%;overflow:hidden\">"
        f"{css_block}"
        f"{html_frag}"
        f"{js_block}"
        f"{transition_script}"
        "</div>"
    )

    return {
        "html": full_html,
        "skipped": False,
        "reason": "rendered",
        "template_id": template_id,
        "version": tmpl.get("version", "1.0.0"),
        "audio_events": audio_events,
    }


def _skip(reason: str, template_id: str) -> Dict[str, Any]:
    return {
        "html": "",
        "skipped": True,
        "reason": reason,
        "template_id": template_id,
        "audio_events": [],
    }
