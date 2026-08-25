"""The mid-word guard must measure what the browser lays out.

A headline authored as "Standardized Environment" renders as
"STANDARDIZED ENVIRONMENT" under text-transform:uppercase. Capitals are
wider, and letter-spacing adds a gap per character that canvas measureText
knows nothing about. Measuring the raw string reported 734px against 735px
of space — "it fits" — while the browser broke the word across lines, so
viewers saw ENVIRONMEN / T and STANDARDIZE / D.
"""
from pathlib import Path

_SRC = (Path(__file__).resolve().parents[1] / "app" / "ai-video-gen-main"
        / "dispatcher_install_js.py").read_text()


def _sweep() -> str:
    body = _SRC[_SRC.index("var __applyTransform"):]
    return body[:body.index("var __fitFrameSweep")]


def test_measurement_applies_text_transform():
    sweep = _sweep()
    assert "toUpperCase" in sweep and "toLowerCase" in sweep
    assert "cs.textTransform" in _SRC, "the sweep must pass the element's transform"


def test_measurement_includes_letter_spacing():
    sweep = _sweep()
    assert "extra * shown.length" in sweep, "letter-spacing must be added per character"
    assert "cs.letterSpacing" in _SRC


def test_there_is_headroom_beyond_an_exact_fit():
    """Matching the available width exactly still wrapped — layout rounding and
    the trailing letter-space push it over."""
    assert "avail - 4" in _SRC


def test_shrink_floor_is_preserved():
    assert "Math.max(0.55" in _sweep()
