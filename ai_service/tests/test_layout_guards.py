"""Guards for the layout failures that clipped rendered shots.

1. `.stage-drift` is documented to the model as a MOTION helper, so it also
   lands on containers that already have a layout. It used to carry
   `flex-direction: column`, which those containers almost never override —
   an intended flex ROW became a stack twice the frame height and its last
   line was cut off ("HUMAN PARTICIPAT/ION").
2. Nothing may render outside the frame, and no word may be split across
   lines. Both repairs live in the dispatcher's post-script sweeps.
"""
import sys
from pathlib import Path

_AI = Path(__file__).resolve().parents[1] / "app" / "ai-video-gen-main"
sys.path.insert(0, str(_AI))

_PIPELINE = (_AI / "automation_pipeline.py").read_text()
_DISPATCHER = (_AI / "dispatcher_install_js.py").read_text()


def test_stage_drift_column_is_scoped_to_sole_class_use():
    start = _PIPELINE.index(".stage-drift {{")
    # the rule body only — the comment below it quotes the property by name
    rule = _PIPELINE[start:_PIPELINE.index("}}", start)]
    assert "flex-direction: column" not in rule, (
        "unscoped flex-direction on .stage-drift silently flips any container "
        "the model tags with it into a column"
    )
    assert '[class="stage-drift"] {{' in _PIPELINE, (
        "the sole-class rule is what preserves centering for the wrappers that "
        "use stage-drift on its own"
    )


def test_frame_fit_guard_measures_layout_not_transforms():
    body = _DISPATCHER[_DISPATCHER.index("var __fitFrameSweep"):]
    # the guard's own body only — later sweeps legitimately use rects
    sweep = body[:body.index("// MID-WORD BREAK GUARD.")] if "// MID-WORD BREAK GUARD." in body else body[:body.index("// CONTRAST AUTO-FIX.")]
    assert "scrollHeight" in sweep, "guard must use layout metrics"
    assert "getBoundingClientRect" not in sweep, (
        "rects include GSAP transforms, so an element parked off-frame by its "
        "entrance animation would read as overflow and shrink the whole shot"
    )
    assert "0.62" in sweep, "there must be a floor so text cannot shrink to unreadable"


def test_frame_fit_wrapper_reproduces_the_root_layout():
    assert "'display', 'flexDirection'" in _DISPATCHER, (
        "the wrapper becomes the children's parent; without copying the root's "
        "layout the content loses its centering and grows taller than before"
    )


def test_mid_word_guard_measures_the_widest_word():
    assert "__widestWord" in _DISPATCHER
    sweep = _DISPATCHER[_DISPATCHER.index("var __fitWordsSweep"):]
    assert "measureText" in _DISPATCHER, "width comes from canvas text metrics"
    assert "0.55" in sweep[:3000], "shrink floor required"
