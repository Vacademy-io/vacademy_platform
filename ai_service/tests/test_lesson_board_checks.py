"""Lesson board checks added after the first production corner-layout lesson:

- 60 s: "9 + 16 = 25" ran into the teacher's head — the shot ignored the
  "keep the corner clear" prompt and nothing measured it;
- 80 s: "c₂ = a₂ + b₂" (subscripts) while the teacher said "c squared";
- 5 s: board text sat under the burned-in captions.

The bbox lint now takes keep-out zones (teacher corner / caption strip) and
lessons run a notation lint + a model fact-check before the vision review.
The keep-out test drives the real render-worker walker in Chromium.
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "app" / "ai-video-gen-main"))
sys.path.insert(0, str(HERE.parent / "render_worker"))

import lesson_mode as lm  # noqa: E402

PLAN = lm.normalize_lesson_plan({"teacher": {"avatar_id": "37b77e8a-c2bd-413d-818f-810a59fcc14c"}, "layout": "corner"})


def test_corner_lessons_keep_the_teacher_clear_and_captions_get_their_own_band():
    area = lm.board_area("corner", 1920, 1080)
    z = lm.keep_out_zones(PLAN, "corner", 1920, 1080, canvas_w=area["w"], canvas_h=area["h"])
    box = lm.teacher_box("corner", 1920, 1080)
    assert z == [{"l": box["x"] - 16, "t": box["y"] - 16, "r": area["w"], "b": area["h"], "name": "teacher"}]
    # captions never need a zone: the shot canvas ends above the caption band
    assert area["h"] == lm.caption_band("corner", 1920, 1080)["y"]
    assert lm.keep_out_zones(PLAN, "side", 1920, 1080, canvas_w=1440, canvas_h=area["h"]) == []
    assert lm.keep_out_zones(None, "corner", 1920, 1080, canvas_w=1920, canvas_h=1080) == []
    block = lm.shot_prompt_block(PLAN, "corner", 1920, 1080)
    assert "SUPERSCRIPTS" in block and f"canvas is 1920×{area['h']}px" in block


def test_subscript_powers_are_flagged_only_when_the_teacher_says_squared():
    bad = "<div><span>c₂ = a₂ + b₂</span></div>"
    assert lm.notation_issues(bad, "c squared equals a squared plus b squared")
    assert not lm.notation_issues(bad, "water is H two O")              # chemistry subscripts are fine
    assert not lm.notation_issues("<div>c² = a² + b²</div>", "c squared equals a squared plus b squared")


def test_board_text_includes_katex_sources_and_drops_scripts():
    html = ("<style>.x{color:red}</style><h1>Solve for c</h1>"
            "<script>gsap.to('#a',{x:1}); katex.render(\"c^2 = 6^2 + 8^2\", el);</script>")
    t = lm.board_text(html)
    assert "Solve for c" in t and "c^2 = 6^2 + 8^2" in t and "gsap" not in t and "color:red" not in t


def test_fact_check_reply_becomes_a_concrete_correction():
    issues = lm.parse_fact_check({"errors": [{"board": "6² + 8² = 110", "problem": "36 + 64 is 100",
                                              "fix": "6² + 8² = 100"}, "junk"]})
    assert issues == ['"6² + 8² = 110" — 36 + 64 is 100 → write: "6² + 8² = 100"']
    assert lm.parse_fact_check({"errors": []}) == [] and lm.parse_fact_check(None) == []
    assert "6² + 8² = 100" in lm.correction_prompt(issues)


def _run(coro_fn):
    try:
        import playwright  # noqa: F401
        from screenshot_worker import ScreenshotWorker
    except Exception as exc:  # pragma: no cover
        pytest.skip(f"playwright / worker not importable here: {exc}")

    async def go():
        w = ScreenshotWorker()
        try:
            return await coro_fn(w)
        except Exception as exc:  # pragma: no cover
            if "Executable doesn't exist" in str(exc) or "browserType.launch" in str(exc):
                pytest.skip(f"chromium not available: {exc}")
            raise
        finally:
            try:
                await w.close()
            except Exception:
                pass
    return asyncio.run(go())


SHOT = (
    '<div id="shot-root" style="position:absolute;inset:0;width:100%;height:100%;background:#1F3B2D">'
    '<div style="position:absolute;left:5%;top:5%;color:#fff;font:700 60px sans-serif">Area of squares</div>'
    '<div id="eq" style="position:absolute;left:1500px;top:640px;color:#fff;font:700 56px sans-serif">9 + 16 = 25</div>'
    "</div>"
)


def test_the_walker_reports_content_inside_the_teacher_corner():
    zones = lm.keep_out_zones(PLAN, "corner", 1920, 1080, canvas_w=1920, canvas_h=842)
    rows = _run(lambda w: w.bbox_check_shot(html=SHOT, width=1920, height=842, timestamps=[0.5],
                                            background="#1F3B2D", keep_out=zones))
    hits = [r for r in rows if r.get("zone") == "teacher"]
    assert hits and "9 + 16 = 25" in hits[0]["text"]
    assert not [r for r in rows if "Area of squares" in r.get("text", "")]
    # without zones the same shot is clean (it does not overflow the canvas)
    assert _run(lambda w: w.bbox_check_shot(html=SHOT, width=1920, height=842, timestamps=[0.5],
                                            background="#1F3B2D")) == []
