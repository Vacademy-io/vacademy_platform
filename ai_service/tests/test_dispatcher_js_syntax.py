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
    even where node is unavailable (CI images, the sandbox).

    Parity is necessary but NOT sufficient: a code span in a comment adds two
    backticks, so parity stays even while the scoped-code template is closed
    early. See test_no_backticks_inside_the_scoped_code_template.
    """
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


def test_no_backticks_inside_the_scoped_code_template():
    """The per-shot wrapper is a `String.raw` template built at RUNTIME.

    A backtick anywhere inside it — including inside a `//` comment — closes
    the template early, and everything after it is parsed as code. That has
    now broken renders three times in one session:
      • "SyntaxError: Unexpected token 'var'"
      • "ReferenceError: nbsp is not defined"
    and `test_generated_js_parses` cannot catch it, because the dispatcher JS
    is perfectly valid on its own — it only breaks once EMBEDDED. This test
    checks the embedding constraint directly.
    """
    js = _generated_js()
    # Anchor on the delimiter itself: the phrase "String.raw" also appears in
    # the comment above the template, and starting there swept in 24 legitimate
    # backticks from prose that sits OUTSIDE the literal.
    opener = "String.raw`"
    start = js.index(opener)
    end = js.index("newScript.textContent = scopedCode")
    region = js[start + len(opener) : end]
    # The opener is consumed above, so the only backtick left in the region is
    # the closing delimiter.
    assert region.count("`") == 1, (
        f"{region.count('`') - 1} stray backtick(s) inside the scoped-code "
        "template — they will terminate it early at runtime. Use plain prose "
        "in comments there, never `code spans`."
    )
