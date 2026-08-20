"""Helper classes must not silently override the layout a shot authored.

Three separate production bugs in one day shared this shape: a class the
prompt documents as MOTION or as a PATTERN (`.stage-drift`, `.process-flow`)
also carried layout, and because inline styles only win for the properties
they actually name, the helper's `flex-direction: column` applied unopposed —
turning an intended row into a stack taller than the frame and clipping its
last line.

The map in html_contract_repair is generated from the harness CSS. This test
regenerates it and fails when they diverge, so ADDING a helper class that
imposes one of these properties forces an explicit decision here rather than
surfacing later as a clipped frame in someone's video.
"""
import re
import sys
from pathlib import Path

_AI = Path(__file__).resolve().parents[1] / "app" / "ai-video-gen-main"
sys.path.insert(0, str(_AI))

from html_contract_repair import _HELPER_IMPOSED  # noqa: E402

# Properties a shot cannot win by declaring `display:flex` inline: they are
# separate declarations, so a helper keeps them unless the shot names them too.
_WATCHED = ("flex-direction", "max-width", "grid-template-columns",
            "grid-auto-flow", "flex-wrap")
_SOURCES = ("render_harness.py", "automation_pipeline.py", "dispatcher_install_js.py")
_RULE_RE = re.compile(r"(?P<sel>[^{}\n][^{}]{0,200}?)\{(?P<body>[^{}]{1,800}?)\}", re.S)


def _scan_harness_css():
    found: dict = {}
    for src in _SOURCES:
        text = (_AI / src).read_text()
        for m in _RULE_RE.finditer(text):
            sel = " ".join(m.group("sel").split())
            body = " ".join(m.group("body").split())
            cm = re.fullmatch(r"\.([a-zA-Z][\w-]*)", sel)
            if not cm:
                continue
            props = {p for p in _WATCHED if re.search(rf"(?<![\w-]){p}\s*:", body)}
            if props:
                found.setdefault(cm.group(1), set()).update(props)
    return {k: tuple(sorted(v)) for k, v in found.items()}


def test_map_matches_the_harness_css():
    scanned = _scan_harness_css()
    known = {k: tuple(sorted(v)) for k, v in _HELPER_IMPOSED.items()}
    new = {k: v for k, v in scanned.items() if k not in known}
    gone = {k: v for k, v in known.items() if k not in scanned}
    changed = {
        k: (known[k], scanned[k]) for k in known.keys() & scanned.keys()
        if known[k] != scanned[k]
    }
    assert not new, (
        f"helper class(es) {sorted(new)} impose layout on any element they are "
        "added to but are not classified in _HELPER_IMPOSED — decide whether "
        "the shot or the helper should own that property"
    )
    assert not gone, f"_HELPER_IMPOSED lists {sorted(gone)}, no longer in the CSS"
    assert not changed, f"properties changed for {sorted(changed)}: {changed}"


def test_stage_drift_no_longer_imposes_a_direction():
    """It is documented to the model as a motion helper; its column used to
    flip any container the model tagged with it."""
    assert "stage-drift" not in _scan_harness_css()
