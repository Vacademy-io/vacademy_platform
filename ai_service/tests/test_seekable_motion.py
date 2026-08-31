"""Motion the frame-stepped renderer cannot seek is dropped from the video.

The renderer seeks `gsap.globalTimeline` to a timestamp and screenshots; it never
plays the shot. Wall-clock-driven motion is therefore invisible to it, and the
failure is silent — the frame looks right in a browser and renders frozen.

Measured on a shipped 31-shot film, 13 shots lost their animation:
    9  tweens registered inside a DOMContentLoaded / load handler
    2  SVG SMIL <animate>
    1  CSS `animation:`
    1  setTimeout
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app", "ai-video-gen-main"))

from seekable_motion import (  # noqa: E402
    READY_KICK,
    apply_ready_kick,
    is_fully_seekable,
    needs_ready_kick,
    unseekable_techniques,
)

PREAMBLE = "<!--vx-preamble--><style>.halftone{animation:drift 3s infinite}</style>"
GOOD = PREAMBLE + "<div id='shot-root'><svg><path id='p'/></svg><script>gsap.to('#p',{opacity:1});</script></div>"


def test_a_gsap_only_shot_is_seekable():
    assert unseekable_techniques(GOOD) == []
    assert is_fully_seekable(GOOD)


def test_the_shared_preamble_is_not_mistaken_for_shot_motion():
    """The preamble legitimately animates its own helper classes. Scanning the
    whole document instead of the shot body would report every shot as broken."""
    assert "animation:" in PREAMBLE
    assert unseekable_techniques(GOOD) == []


def test_each_unseekable_technique_is_named():
    cases = {
        "css-animation": "<div id='shot-root' style='animation: pulse 2s'></div>",
        "css-keyframes": "<div id='shot-root'><style>@keyframes k{}</style></div>",
        "svg-smil": "<div id='shot-root'><svg><animate attributeName='r'/></svg></div>",
        "timer": "<div id='shot-root'><script>setTimeout(fn, 500)</script></div>",
    }
    for expected, body in cases.items():
        assert expected in unseekable_techniques(PREAMBLE + body), expected


def test_smil_transform_and_motion_variants_are_caught():
    for tag in ("<animateTransform attributeName='transform'/>", "<animateMotion dur='2s'/>"):
        assert "svg-smil" in unseekable_techniques(PREAMBLE + "<div id='shot-root'><svg>" + tag + "</svg></div>")


def test_the_load_handler_case_is_detected_and_repaired():
    """The dominant failure: a shot is injected into a shadow root AFTER document
    load has fired, so the handler never runs and nothing animates."""
    html = PREAMBLE + (
        "<div id='shot-root'><script>"
        "document.addEventListener('DOMContentLoaded',function(){gsap.to('#p',{opacity:1});});"
        "</script></div>"
    )
    assert "load-handler" in unseekable_techniques(html)
    assert needs_ready_kick(html)

    fixed = apply_ready_kick(html)
    assert READY_KICK in fixed
    assert unseekable_techniques(fixed) == []
    assert is_fully_seekable(fixed)


def test_window_onload_and_load_listener_are_both_caught():
    for js in ("window.onload = function(){}", "window.addEventListener('load', fn)"):
        html = PREAMBLE + "<div id='shot-root'><script>" + js + "</script></div>"
        assert "load-handler" in unseekable_techniques(html)


def test_the_repair_is_idempotent():
    html = PREAMBLE + "<div id='shot-root'><script>window.onload=function(){}</script></div>"
    once = apply_ready_kick(html)
    twice = apply_ready_kick(once)
    assert once == twice
    assert twice.count("vx-ready-kick") == 1


def test_the_repair_does_not_touch_a_clean_shot():
    assert apply_ready_kick(GOOD) == GOOD


def test_a_repaired_load_handler_is_not_reported_for_regeneration():
    """Reporting it after the kick would send a working shot into a pointless
    and expensive regeneration."""
    html = PREAMBLE + "<div id='shot-root'><script>window.onload=function(){}</script></div>"
    assert unseekable_techniques(apply_ready_kick(html)) == []


def test_css_animation_survives_the_repair_and_is_still_reported():
    """A keyframe animation has no mechanical rewrite into GSAP, so the repair
    must not pretend to have fixed it."""
    html = PREAMBLE + "<div id='shot-root' style='animation: spin 2s'><script>window.onload=function(){}</script></div>"
    fixed = apply_ready_kick(html)
    assert "css-animation" in unseekable_techniques(fixed)
    assert not is_fully_seekable(html)


def test_every_prompt_path_teaches_the_constraint():
    """The setTimeout half of this rule lived in CORE_PREAMBLE only, which the
    aspirational path (used by ultra and super_ultra) never includes — so most
    runs were never told."""
    import shot_type_cards as stc

    for kwargs in (
        {"aspirational": True, "composition": ""},
        {"aspirational": False, "composition": ""},
        {"aspirational": True, "mode": "marketing", "composition": ""},
        {"aspirational": True, "mode": "bold", "composition": ""},
    ):
        prompt = stc.build_per_shot_system_prompt("DEVICE_MOCKUP", 1920, 1080, **kwargs)
        for needle in ("ONLY GSAP MOVES", "@keyframes", "animateTransform", "DOMContentLoaded"):
            assert needle in prompt, f"{kwargs} missing {needle}"
