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


def _suffix_for(prefs, palette=None):
    """Run the helper's logic without importing the pipeline's heavy deps."""
    body = _SRC[_SRC.index("def _support_visual_style_suffix"):]
    body = body[:body.index("    def _resolve_support_visuals")]

    class _Fake:
        _visual_preferences = prefs
        _current_style_guide = {"palette": {"primary": palette}} if palette else {}

    colour = _SRC[_SRC.index("def _colour_name_for_hex"):]
    colour = colour[:colour.index("\ndef ")]
    ns = {"re": re}
    exec(colour, ns)
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
