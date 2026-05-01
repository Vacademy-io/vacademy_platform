"""
Skill Composer — scans shot HTML for <skill> tags and substitutes rendered output.

The composer is the ONLY code path that turns skill references into HTML. It's
pure: same input → same output, no side effects, no hidden state.

Input: raw HTML from the shot LLM, plus a ctx dict (shot_index, canvas dims).
Output: HTML with every <skill> tag replaced by the rendered snippet, plus
aggregated CSS/JS injected into <head>/<body>, plus a report of every invocation.

Adding a new skill = drop a folder in skills/. No changes here.
"""
from __future__ import annotations

import json
import re
from typing import Dict, List, Any, Optional

from skill_registry import get_registry, validate_params

# <skill data-skill-id="..." data-params='{...}'></skill>  (also supports /> self-close
# and nested quotes inside data-params). Non-greedy body capture so multiple skill tags
# in one document don't run into each other.
_SKILL_TAG_RE = re.compile(
    r"""<skill\s+data-skill-id=["']([a-zA-Z0-9_\-]+)["']\s+data-params=(['"])(.*?)\2\s*(?:/>|></skill>)""",
    re.DOTALL,
)


def compose(shot_html: str, ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Replace <skill> tags in shot HTML with rendered snippets.

    Args:
        shot_html: Raw HTML from the shot LLM. May or may not contain skill tags.
        ctx: Rendering context — {shot_index, canvas_w, canvas_h, tier}.

    Returns:
        dict with keys:
        - html: the final HTML with skills substituted and CSS/JS injected
        - invocations: list of {skill_id, valid, issues, version?} per tag seen
        - plugins: list of plugin IDs any skill requested (e.g. ["gsap"])
        - audio_events: aggregated list of {role, t, volume_mul, skill_id}
                        from every successful skill render — consumed by the
                        Sound Planner to place concrete cues
        - succeeded: int count of valid renders
        - failed: int count of failed renders
    """
    reg = get_registry()
    invocations: List[Dict[str, Any]] = []
    plugins_needed: set = set()
    aggregated_css: List[str] = []
    aggregated_js: List[str] = []
    aggregated_audio_events: List[Dict[str, Any]] = []

    def _try_static_fallback(skill_id: str, params: Dict[str, Any], reason: str) -> Optional[Dict[str, Any]]:
        """Attempt the skill's static fallback. Returns rendered dict or None."""
        skill = reg.get(skill_id)
        if not skill:
            return None
        fb = skill.get("static_fallback")
        if not callable(fb):
            return None
        try:
            result = fb(params, ctx)
        except Exception as fe:
            print(f"[skill_composer] {skill_id} static_fallback also raised: {fe}")
            return None
        if not isinstance(result, dict) or not (result.get("html", "") or "").strip():
            return None
        print(f"[skill_composer] {skill_id} fell back to static (reason: {reason})")
        return result

    def _replace(match: re.Match) -> str:
        skill_id = match.group(1)
        params_raw = match.group(3)

        # Track whether the result came from the static fallback so the single
        # invocation append at the bottom can record it accurately.
        fallback_reason: Optional[str] = None
        rendered: Optional[Dict[str, Any]] = None
        params: Dict[str, Any] = {}

        # Parse params
        try:
            params = json.loads(params_raw)
            if not isinstance(params, dict):
                raise ValueError("params must be a JSON object")
        except (json.JSONDecodeError, ValueError) as e:
            # Bad params — try static fallback (skill is responsible for sensible defaults)
            fb = _try_static_fallback(skill_id, {}, f"params JSON error: {e}")
            if fb:
                rendered = fb
                fallback_reason = f"params JSON error: {e}"
            else:
                invocations.append({
                    "skill_id": skill_id, "valid": False,
                    "issues": [f"params JSON error: {e}"],
                })
                return f"<!-- skill {skill_id}: params JSON error -->"

        if rendered is None:
            skill = reg.get(skill_id)
            if not skill:
                invocations.append({
                    "skill_id": skill_id, "valid": False,
                    "issues": ["unknown skill (not in registry)"],
                })
                return f"<!-- skill {skill_id}: unknown -->"

            valid, issues = validate_params(skill_id, params)
            if not valid:
                fb = _try_static_fallback(skill_id, params, f"invalid params: {'; '.join(issues)}")
                if fb:
                    rendered = fb
                    fallback_reason = f"invalid params: {'; '.join(issues)}"
                else:
                    invocations.append({
                        "skill_id": skill_id, "valid": False, "issues": issues,
                    })
                    return f"<!-- skill {skill_id}: invalid params: {'; '.join(issues)} -->"
            else:
                # Invoke skill render. On any failure, try static fallback.
                try:
                    rendered = skill["render"](params, ctx)
                except Exception as e:
                    fb = _try_static_fallback(skill_id, params, f"render raised: {e}")
                    if fb:
                        rendered = fb
                        fallback_reason = f"render raised: {e}"
                    else:
                        invocations.append({
                            "skill_id": skill_id, "valid": False,
                            "issues": [f"render error: {e}"],
                        })
                        return f"<!-- skill {skill_id}: render error -->"

                if not isinstance(rendered, dict):
                    fb = _try_static_fallback(skill_id, params, "render did not return dict")
                    if fb:
                        rendered = fb
                        fallback_reason = "render did not return dict"
                    else:
                        invocations.append({
                            "skill_id": skill_id, "valid": False,
                            "issues": ["render() did not return a dict"],
                        })
                        return f"<!-- skill {skill_id}: render error -->"

        html_frag = rendered.get("html", "") or ""
        js_frag = rendered.get("js", "") or ""
        css_frag = rendered.get("css", "") or ""
        plugins = rendered.get("plugins", []) or []
        audio_events = rendered.get("audio_events", []) or []

        if css_frag:
            aggregated_css.append(css_frag)
        if js_frag:
            aggregated_js.append(js_frag)
        for p in plugins:
            plugins_needed.add(p)
        for ev in audio_events:
            if isinstance(ev, dict) and "role" in ev and "t" in ev:
                aggregated_audio_events.append(ev)

        # Single invocation append. `skill` may be unbound if we reached this
        # point via the JSON-parse fallback path — look it up if so.
        _skill_for_version = reg.get(skill_id) or {}
        invocation: Dict[str, Any] = {
            "skill_id": skill_id,
            "valid": True,
            "issues": [f"used static fallback: {fallback_reason}"] if fallback_reason else [],
            "version": _skill_for_version.get("version"),
        }
        if fallback_reason:
            invocation["fallback"] = True
            invocation["fallback_reason"] = fallback_reason
        invocations.append(invocation)
        return html_frag

    new_html = _SKILL_TAG_RE.sub(_replace, shot_html)

    # If no tags were matched, return the original HTML unchanged (with empty report)
    if not invocations:
        return {
            "html": shot_html,
            "invocations": [],
            "plugins": [],
            "audio_events": [],
            "succeeded": 0,
            "failed": 0,
        }

    # Inject aggregated CSS into <head> (fallback: prepend)
    if aggregated_css:
        css_block = "<style data-skill-css>\n" + "\n".join(aggregated_css) + "\n</style>"
        if "</head>" in new_html:
            new_html = new_html.replace("</head>", css_block + "\n</head>", 1)
        else:
            new_html = css_block + "\n" + new_html

    # Inject aggregated JS before </body>. Wrap in IIFE to isolate scope.
    if aggregated_js:
        js_block = (
            "<script data-skill-js>\n(function(){\n"
            + "\n\n".join(aggregated_js)
            + "\n})();\n</script>"
        )
        if "</body>" in new_html:
            new_html = new_html.replace("</body>", js_block + "\n</body>", 1)
        else:
            new_html = new_html + "\n" + js_block

    succeeded = sum(1 for i in invocations if i["valid"])
    failed = sum(1 for i in invocations if not i["valid"])

    return {
        "html": new_html,
        "invocations": invocations,
        "plugins": sorted(plugins_needed),
        "audio_events": aggregated_audio_events,
        "succeeded": succeeded,
        "failed": failed,
    }
