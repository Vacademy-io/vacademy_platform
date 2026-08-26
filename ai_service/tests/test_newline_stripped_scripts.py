"""A shot script on one line silently comments out its own animation.

One shot arrived with its entire <script> on a single line containing
`// ACT 1tl.to('#s2_title_1', ...)`. A `//` comment runs to end of line, and
there is no end of line, so every statement after the first `//` was inside
the comment. The timeline attached at the correct start time with zero
children, the diagnostics reported a healthy `duration=0.00
inner_children=0`, and the shot rendered 22 seconds of black background.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app" / "ai-video-gen-main"))

from html_contract_repair import repair_newline_stripped_comments  # noqa: E402

_ONE_LINE = (
    "<div id='shot-root'></div><script>const tl = gsap.timeline();"
    "gsap.to('.stage-drift', {x: -15});// ACT 1tl.to('#t1', {y: 0}, 0.35); "
    "tl.to('#t2', {y: 0}, 1.21);// ACT 2gsap.delayedCall(9.45, () => {});</script>"
)


def test_line_breaks_are_restored_before_resuming_code():
    out, fixes = repair_newline_stripped_comments(_ONE_LINE)
    assert fixes
    # the statement that was swallowed now starts on its own line
    assert "// ACT 1\ntl.to('#t1'" in out
    assert "// ACT 2\ngsap.delayedCall" in out


def test_scripts_that_already_have_newlines_are_untouched():
    ok = "<script>\n// ACT 1\ngsap.to('#a', {opacity: 1});\n</script>"
    assert repair_newline_stripped_comments(ok) == (ok, [])


def test_urls_are_not_mistaken_for_comments():
    html = ("<script>const u = 'https://example.com/x'; gsap.to('#a', {opacity: 1});</script>")
    out, fixes = repair_newline_stripped_comments(html)
    assert "https://example.com/x" in out
    assert fixes == []


def test_trailing_comment_with_no_code_after_is_left_alone():
    html = "<script>gsap.to('#a', {opacity: 1});// done for now</script>"
    out, _ = repair_newline_stripped_comments(html)
    assert "// done for now" in out


def test_idempotent():
    once, first = repair_newline_stripped_comments(_ONE_LINE)
    twice, second = repair_newline_stripped_comments(once)
    assert first and second == [] and twice == once


def test_no_script_or_no_comment_is_a_no_op():
    assert repair_newline_stripped_comments("") == ("", [])
    assert repair_newline_stripped_comments("<div>x</div>") == ("<div>x</div>", [])
