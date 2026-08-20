"""State changes inside tween callbacks never fire in a frame-stepped render.

A multi-act shot swaps acts from an onComplete:

    gsap.to('#flash', {opacity:.8, duration:.1, delay:9.32, onComplete: () => {
        gsap.set('#act1', {opacity:0}); gsap.set('#act2', {opacity:1}); }});

That is right for playback and wrong for rendering: the renderer seeks
gsap.globalTimeline in parallel chunks, so a worker whose range starts at 48s
never passes 9.32s and the callback never runs. With no initial opacity the
acts all default to visible and stack — three headlines and four cards in a
single frame of a real video.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app" / "ai-video-gen-main"))

from html_contract_repair import repair_callback_state_changes  # noqa: E402

_SHOT = """
<div id="shot-root"><div id="s6_act1">A</div><div id="s6_act2">B</div></div>
<script>
gsap.to('#s6_subtitle', {opacity: 1, y: 0, duration: 0.6, delay: 0.56, ease: 'power3.out'});
gsap.to('#s6_flash', {opacity: 0.8, duration: 0.1, delay: 9.32, onComplete: () => {
    gsap.set('#s6_act1', {opacity: 0});
    gsap.set('#s6_act2', {opacity: 1});
    gsap.to('#s6_flash', {opacity: 0, duration: 0.3});
}});
</script>
"""


def test_state_changes_are_hoisted_at_the_callback_time():
    out, fixes = repair_callback_state_changes(_SHOT)
    assert len(fixes) == 2
    # 9.32 delay + 0.1 duration — NOT the neighbouring tween's 0.56/0.6
    assert "delay: 9.42" in out
    assert "'#s6_act1', {opacity: 0" in out and "'#s6_act2', {opacity: 1" in out


def test_the_neighbouring_tween_timing_is_not_borrowed():
    out, _ = repair_callback_state_changes(_SHOT)
    assert "delay: 1.06" not in out and "delay: 0.56" not in out.split("vx: state")[1]


def test_original_callback_is_preserved():
    """Playback keeps working exactly as authored; the hoist only adds a
    seek-safe duplicate."""
    out, _ = repair_callback_state_changes(_SHOT)
    assert "onComplete" in out
    assert out.count("gsap.set('#s6_act1'") >= 1


def test_idempotent():
    once, first = repair_callback_state_changes(_SHOT)
    twice, second = repair_callback_state_changes(once)
    assert first and second == [] and twice == once


def test_shots_without_callbacks_are_untouched():
    plain = "<div id='shot-root'>x</div><script>gsap.to('#a',{opacity:1,delay:1});</script>"
    assert repair_callback_state_changes(plain) == (plain, [])
    assert repair_callback_state_changes("") == ("", [])


def test_non_opacity_callback_work_is_left_alone():
    """Only visibility state is hoisted — arbitrary callback logic stays put."""
    html = ("<script>gsap.to('#f',{duration:.1,delay:2,onComplete: () => { "
            "annotate('#x',{type:'highlight'}); }});</script>")
    assert repair_callback_state_changes(html)[1] == []
