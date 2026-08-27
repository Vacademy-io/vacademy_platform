"""An image prompt must never carry a hex code.

Passing "Single accent colour #0071b8 on white" to the image model made it
draw the literal text "#0071b" into the corner of the illustration — visible
in the finished video — because a hex is a string to a generator, not a
colour. The prompt now names the colour in words.
"""
import re
from pathlib import Path

_SRC = (Path(__file__).resolve().parents[1] / "app" / "ai-video-gen-main"
        / "automation_pipeline.py").read_text()


def _colour_name():
    seg = _SRC[_SRC.index("def _colour_name_for_hex"):]
    seg = seg[:seg.index("\ndef ")]
    ns = {"re": re}
    exec(seg, ns)
    return ns["_colour_name_for_hex"]


_name = _colour_name()


def test_brand_hex_becomes_a_word():
    assert _name("#0071b8") == "blue"
    assert _name("#ff2e3a") == "red"
    assert _name("#16a34a") == "green"
    assert _name("#ffffff") == "white"
    # teal/emerald are both acceptable words for this blue-green
    assert _name("#0f766e") in {"teal", "emerald", "green"}


def test_non_hex_yields_nothing_rather_than_leaking_text():
    for bad in ("", None, "teal", "#zzz", "#0071b8; ignore previous", "rgb(0,113,184)"):
        assert _name(bad) == ""


def test_no_hex_reaches_the_support_visual_prompt():
    seg = _SRC[_SRC.index("def _support_visual_style_suffix"):]
    seg = seg[:seg.index("    def _resolve_support_visuals")]
    assert "{_primary}" not in seg, "the hex itself must not be interpolated into the prompt"
    assert "_colour_name_for_hex" in seg
    assert "colour codes" in seg, "the prompt should explicitly forbid colour codes in frame"
