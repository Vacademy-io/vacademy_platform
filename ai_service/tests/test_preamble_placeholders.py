"""Every placeholder in the injected preamble must resolve to a real name.

The preamble is one large f-string. A `{NAME}` left behind after a design
change raises NameError at generation time — and only there: the render path
replays stored HTML and never calls the builder, so patched-timeline testing
cannot see it. One such leftover (`_CONTRAST_AUTOFIX_JS`, orphaned when the
contrast sweep moved into the dispatcher) failed seven of ten shots on a live
run before anything surfaced it.
"""
import re
from pathlib import Path

_SRC = (Path(__file__).resolve().parents[1] / "app" / "ai-video-gen-main"
        / "automation_pipeline.py").read_text()


def _preamble_block() -> str:
    start = _SRC.index('global_css = f"""<!--vx-preamble-->')
    end = _SRC.index('"""', _SRC.index("</style>", start))
    return _SRC[start:end]


def test_every_preamble_placeholder_is_defined():
    block = _preamble_block()
    # Single braces only — CSS braces are doubled inside the f-string.
    names = {m.group(1) for m in re.finditer(r"(?<!\{)\{([A-Za-z_][A-Za-z0-9_]*)\}", block)}
    assert names, "no placeholders found — the block boundaries moved"
    undefined = [
        n for n in sorted(names)
        if not re.search(rf"\b{n}\s*=", _SRC[:_SRC.index(block)])
        and not re.search(rf"^{n}\s*=", _SRC, re.M)
    ]
    assert not undefined, (
        f"preamble interpolates undefined name(s) {undefined} — this raises "
        "NameError for every shot at generation time"
    )
