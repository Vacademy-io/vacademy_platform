"""The dispatcher install script is one big JS string built in Python.

Anything that closes its String.raw template early — a stray backtick in a
comment, an unescaped ${ — makes the whole script unparseable, and
page.evaluate then throws before page setup so EVERY render fails at frame
zero with no partial output. Python import checks cannot see it: the file is
valid Python either way. Parse the generated JavaScript instead.
"""
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

_GEN = Path(__file__).resolve().parents[1] / "app" / "ai-video-gen-main"
sys.path.insert(0, str(_GEN))


def _generated_js() -> str:
    from dispatcher_install_js import get_dispatcher_install_js

    return get_dispatcher_install_js("")


def test_template_literal_is_balanced():
    """Backtick parity across the whole script — the cheap check that runs
    even where node is unavailable (CI images, the sandbox)."""
    js = _generated_js()
    assert js.count("`") % 2 == 0, (
        "odd number of backticks in the generated dispatcher — a template "
        "literal is left open, which makes the entire script unparseable"
    )


@pytest.mark.skipif(shutil.which("node") is None, reason="node not available")
def test_generated_js_parses(tmp_path):
    js_file = tmp_path / "dispatcher.js"
    js_file.write_text(_generated_js())
    proc = subprocess.run(
        ["node", "--check", str(js_file)],
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, f"generated dispatcher JS is invalid:\n{proc.stderr}"
