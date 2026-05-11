"""Shared shot-HTML preprocessing for the renderer + preview paths.

Used by:
  - worker.py:render() (production /jobs)        — applies on every timeline entry
  - screenshot_worker.py:record_shot_mp4()       — applies on the single input shot

The transforms are the same for both paths so a shot rendered through
/shot/preview-mp4 looks identical to that shot inside a full /jobs render.
Without this shared helper, single-shot preview and production diverge: shots
that depend on FE-editor timing tricks (e.g. <script data-vx-timescale>) look
correct in preview but break in production because production strips the tag.

Five transforms, in order:
  1. SOURCE_CLIP shots: strip <video data-source-clip>     (compositor adds it)
  2. ALL shots:         strip gsap.fromTo('.stage-drift')  (drift looks bad in scrub render)
  3. ALL shots:         rewrite <script data-vx-timescale="X"> by scaling tween
                        timing literals (duration/delay/positional offset/
                        delayedCall) by 1/X, then strip the script
  4. ALL shots:         strip <script src="...gsap*.js">   (duplicate gsap orphans harness)
  5. ALL shots:         convert `animation: vx-fade-in 0.5s ...` CSS shorthand
                        on `<div data-vx-shot=...>` wrappers into GSAP tweens
                        (CSS clock != renderer scrub clock)

Build identifier — bump on any behavioral change so deploys can be verified
from the logs. Search for `[shot-preprocess] build=…` in the render-worker
container output to confirm this version is the one running.
"""
from __future__ import annotations

import logging
import re
from typing import Optional

PREPROCESS_BUILD = "2026-05-08-v2 (per-shot child timeline; timescale carried as entry field)"

_logger = logging.getLogger("shot_preprocess")


# ---------------------------------------------------------------------------
# 1. SOURCE_CLIP video stripper
# ---------------------------------------------------------------------------

_VIDEO_TAG_RE = re.compile(
    r'<video\b[^>]*data-source-clip[^>]*>(?:</video>)?',
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# 2. Stage-drift gsap.fromTo stripper
# ---------------------------------------------------------------------------

_DRIFT_RE = re.compile(
    r"gsap\.fromTo\(\s*['\"]\.stage-drift['\"].*?\);",
    re.DOTALL,
)


# ---------------------------------------------------------------------------
# 3. Per-shot timescale rewriter
# ---------------------------------------------------------------------------

_TIMESCALE_TAG_RE = re.compile(
    r'<script\s[^>]*\bdata-vx-timescale="([^"]+)"[^>]*>[\s\S]*?</script>',
    re.IGNORECASE,
)

# (Removed in v2: _scale_script_timing / _rewrite_timescale — the per-shot
# child timeline in the dispatcher now handles ALL tween timing scaling,
# including variable expressions the regex couldn't reach. We just extract
# the timescale value via _extract_timescale below and the dispatcher applies
# it via Timeline.timeScale().)


# ---------------------------------------------------------------------------
# 4. Duplicate GSAP CDN loader stripper
# ---------------------------------------------------------------------------

_GSAP_CDN_RE = re.compile(
    r'<script\s[^>]*\bsrc="[^"]*\bgsap[^"]*\.js[^"]*"[^>]*>\s*</script>',
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# 5. vx-shot CSS-animation → GSAP tween conversion
# (verbatim port of worker.py:render's _convert_vx_wrapper)
# ---------------------------------------------------------------------------

_VX_SHOT_OPEN_RE = re.compile(
    r'(<div\s+data-vx-shot="[^"]*"\s+style=")([^"]*)("\s*>)',
    re.IGNORECASE,
)
_ANIM_PROP_RE = re.compile(r'animation\s*:[^;]*;?', re.IGNORECASE)
_VX_ANIM_TOKEN_RE = re.compile(
    r'(vx-(?:fade|slide-[lrud]|zoom-in|zoom-out)-(?:in|out))\s+'
    r'([\d.]+)s\s+(\S+?)\s+([-\d.]+)s\s+both',
    re.IGNORECASE,
)
_VX_STATE0 = {
    'fade':     {'opacity': 0},
    'slide-l':  {'opacity': 0, 'xPercent': -100},
    'slide-r':  {'opacity': 0, 'xPercent': 100},
    'slide-u':  {'opacity': 0, 'yPercent': -100},
    'slide-d':  {'opacity': 0, 'yPercent': 100},
    'zoom-in':  {'opacity': 0, 'scale': 0.6},
    'zoom-out': {'opacity': 0, 'scale': 1.4},
}
_VX_STATE1 = {'opacity': 1, 'xPercent': 0, 'yPercent': 0, 'scale': 1}
_CSS_TO_GSAP_EASE = {
    'ease':        'power2.inOut',
    'linear':      'none',
    'ease-in':     'power2.in',
    'ease-out':    'power2.out',
    'ease-in-out': 'power2.inOut',
}


def _vars_to_js(d: dict) -> str:
    return '{' + ','.join(f'{k}:{v}' for k, v in d.items()) + '}'


def _convert_vx_wrapper(html: str) -> str:
    """Convert `animation: vx-fade-in 0.5s ease-out 0s both` shorthand on
    `<div data-vx-shot=...>` wrappers into equivalent GSAP tweens.
    """
    def _repl(m: re.Match) -> str:
        opening, style, closing = m.group(1), m.group(2), m.group(3)
        am = _ANIM_PROP_RE.search(style)
        if not am:
            return m.group(0)
        anim_value = am.group(0).split(':', 1)[1].rstrip(';').strip()
        new_style = _ANIM_PROP_RE.sub('', style).strip(';').strip()
        tweens_js = []
        for tok in _VX_ANIM_TOKEN_RE.finditer(anim_value):
            name = tok.group(1)
            dur = float(tok.group(2))
            easing = tok.group(3)
            delay = float(tok.group(4))
            if name.endswith('-in'):
                type_, direction = name[3:-3], 'in'
            elif name.endswith('-out'):
                type_, direction = name[3:-4], 'out'
            else:
                continue
            if type_ not in _VX_STATE0:
                continue
            s0 = _VX_STATE0[type_]
            s1 = {k: _VX_STATE1[k] for k in s0.keys()}
            from_v, to_v = (s0, s1) if direction == 'in' else (s1, s0)
            ease = _CSS_TO_GSAP_EASE.get(easing.lower(), 'power2.inOut')
            to_with_meta = dict(to_v)
            to_with_meta['duration'] = dur
            to_with_meta['delay'] = delay
            to_with_meta['ease'] = f'"{ease}"'
            tweens_js.append(
                f'gsap.fromTo(__vxw,{_vars_to_js(from_v)},{_vars_to_js(to_with_meta)});'
            )
        if not tweens_js:
            return f'{opening}{new_style}{closing}'
        script = (
            '<script data-vx-render-transition="1">'
            'var __vxw=scope.querySelector(\'[data-vx-shot="1"]\');'
            'if(__vxw){' + ''.join(tweens_js) + '}'
            '</script>'
        )
        return f'{opening}{new_style}{closing}{script}'
    return _VX_SHOT_OPEN_RE.sub(_repl, html)


# ---------------------------------------------------------------------------
# Top-level entry point
# ---------------------------------------------------------------------------


def _extract_timescale(html: str) -> tuple[str, float]:
    """Pull the FE-editor's vx-timescale value out of the HTML, return (html_without_tag, timescale).

    Fix-2 architecture: instead of rewriting tween-timing numeric literals in
    the shot's <script> blocks (which couldn't reach variable expressions like
    `delay: i * 0.9`), we strip the timescale tag here and return the value.
    The caller attaches it to the timeline-entry's `timescale` field, which
    the dispatcher reads to create a per-shot child timeline at the right
    timeScale. All tween timing — literals, variables, computed expressions —
    inherits the timescale automatically.
    """
    m = _TIMESCALE_TAG_RE.search(html)
    if not m:
        return html, 1.0
    try:
        ts = float(m.group(1))
    except (TypeError, ValueError):
        return _TIMESCALE_TAG_RE.sub("", html), 1.0
    if ts <= 0:
        return _TIMESCALE_TAG_RE.sub("", html), 1.0
    return _TIMESCALE_TAG_RE.sub("", html), ts


def preprocess_shot_html(
    html: str,
    *,
    shot_type: Optional[str] = None,
    shot_id: Optional[str] = None,
) -> tuple[str, float]:
    """Apply all production shot-HTML preprocessing in order.

    Args:
        html: Raw shot HTML, as authored by the LLM and stored in the timeline JSON.
        shot_type: The timeline entry's `shot_type` field. Only matters for
            SOURCE_CLIP shots (where we strip the inline <video> tag because
            the compositor renders the actual video later). Pass None for the
            preview path; the strip is a no-op on non-SOURCE_CLIP shots.
        shot_id: Optional shot id passed through to per-shot timescale logging.

    Returns:
        (cleaned_html, timescale). The caller MUST attach `timescale` to the
        timeline entry (e.g. `entry["timescale"] = ts`) so the dispatcher
        creates a per-shot child timeline with that scale. timescale defaults
        to 1.0 (no-op) when the shot has no vx-timescale tag or it parses to
        an invalid value.
    """
    if shot_type == "SOURCE_CLIP":
        html = _VIDEO_TAG_RE.sub("", html)
    html = _DRIFT_RE.sub("", html)
    html, timescale = _extract_timescale(html)
    html = _GSAP_CDN_RE.sub("", html)
    html = _convert_vx_wrapper(html)

    if abs(timescale - 1.0) > 1e-6:
        label = f"shot={shot_id}" if shot_id else "shot=?"
        _logger.info(
            f"[shot-preprocess] {label} timescale={timescale:.4f} "
            f"(passed to dispatcher; per-shot child timeline will be created)"
        )
    return html, timescale
