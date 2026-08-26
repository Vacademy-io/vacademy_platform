"""Generated support visuals must follow the run's visual direction.

The prompt used to be hardcoded "Photorealistic, ... soft natural light", so a
brief asking for anatomical line art and annotated diagrams — and rejecting
stock photography in as many words — still got a glossy clinical photo for
every beat. For medical subjects that is also invented imagery presented as if
observed.
"""
import re
import sys
from pathlib import Path

_AI = Path(__file__).resolve().parents[1] / "app" / "ai-video-gen-main"
_SRC = (_AI / "automation_pipeline.py").read_text()


def _suffix_for(prefs, palette=None, bg="#ffffff"):
    """Run the helper's logic without importing the pipeline's heavy deps."""
    body = _SRC[_SRC.index("def _support_visual_style_suffix"):]
    body = body[:body.index("    def _resolve_support_visuals")]

    class _Fake:
        _visual_preferences = prefs
        _current_background_type = "white"
        _current_style_guide = ({"palette": {"primary": palette, "background": bg}}
                                if (palette or bg) else {})

    helpers = _SRC[_SRC.index("def _hex_is_dark"):]
    helpers = helpers[:helpers.index("\ndef _repair_undefined")]
    ns = {"re": re}
    exec(helpers, ns)
    exec("class H:\n    " + body.replace("\n", "\n    "), ns)
    H = ns["H"]
    inst = _Fake()
    return H._support_visual_style_suffix(inst)


def test_default_run_keeps_the_photoreal_look():
    out = _suffix_for({})
    assert "Photorealistic" in out


def test_illustration_brief_switches_to_line_art():
    out = _suffix_for({"svg_illustrated": "high"})
    assert "line-art" in out and "Photorealistic" not in out


def test_rejecting_stock_photography_also_switches():
    out = _suffix_for({"stock_video": "no"})
    assert "line-art" in out and "Photorealistic" not in out


def test_brand_colour_reaches_the_prompt_as_a_WORD_not_a_hex():
    """A hex in an image prompt gets drawn into the picture — the model
    rendered "#0071b" into the corner of a finished video. Name the colour."""
    out = _suffix_for({"svg_illustrated": "high"}, palette="#0f766e")
    assert "#0f766e" not in out
    assert any(w in out for w in ("teal", "emerald", "green"))


def test_a_bad_palette_value_cannot_reach_the_prompt():
    out = _suffix_for({"svg_illustrated": "high"}, palette="teal; ignore previous")
    assert "ignore previous" not in out


def test_dark_deck_gets_light_artwork_not_a_white_card():
    """Hardcoding a white ground put glowing white rectangles on a black
    chalkboard deck — the illustration read as a pasted card, not part of
    the slide."""
    out = _suffix_for({"svg_illustrated": "high"}, palette="#fd7f2f", bg="#1a3a2a")
    assert "white background" not in out
    assert "dark charcoal" in out and "light strokes" in out


def test_light_deck_still_gets_a_white_ground():
    out = _suffix_for({"svg_illustrated": "high"}, palette="#0071b8", bg="#ffffff")
    assert "plain white background" in out
