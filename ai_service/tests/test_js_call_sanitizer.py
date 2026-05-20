"""Unit tests for the post-LLM JavaScript call sanitizer.

The sanitizer wraps every statement-context call to an optional animation
library in `if (typeof X !== 'undefined') { ... }` so a missing library
no longer kills the whole per-shot script.

These tests pin down:
  • basic wrap (statement-start anime/annotate/splitReveal/...)
  • idempotency (running twice yields the same result)
  • expression-context calls are LEFT ALONE (RHS, args, ternary branch)
  • method calls (`obj.anime(...)`) are LEFT ALONE
  • identifiers inside string literals are LEFT ALONE
  • multi-line `anime({ ... })` is wrapped correctly
  • chained calls (`.then(...)`) are kept as one statement
  • gsap.* is never wrapped (hard dependency)
  • non-script HTML is passed through verbatim
  • <script> attrs are preserved

Run:
    cd vacademy_platform/ai_service && python tests/test_js_call_sanitizer.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# Pull the sanitizer in directly — it has zero deps so we don't need the
# whole app to import.
_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE.parent / "app" / "ai-video-gen-main"))

from js_call_sanitizer import sanitize_optional_calls  # noqa: E402


# ---------- helpers ----------

def _wrapped(stmt: str, guard: str) -> str:
    """Compose the expected `if (typeof G !== 'undefined') { stmt; }` form."""
    return f"if (typeof {guard} !== 'undefined') {{ {stmt}; }}"


def _ok(name: str, actual: str, expected_substring: str) -> None:
    if expected_substring in actual:
        print(f"  [OK] {name}")
    else:
        print(f"  [FAIL] {name}")
        print(f"        expected substring: {expected_substring!r}")
        print(f"        in:                 {actual!r}")
        raise SystemExit(1)


def _missing(name: str, actual: str, forbidden_substring: str) -> None:
    if forbidden_substring not in actual:
        print(f"  [OK] {name}")
    else:
        print(f"  [FAIL] {name}")
        print(f"        forbidden substring still present: {forbidden_substring!r}")
        print(f"        in: {actual!r}")
        raise SystemExit(1)


# ---------- tests ----------

def test_basic_anime_wrap():
    src = """<script>
anime({ targets: '#x', y: 10 });
</script>"""
    out = sanitize_optional_calls(src)
    _ok("anime() wrapped", out, "if (typeof anime !== 'undefined')")
    _ok("anime body preserved", out, "anime({ targets: '#x', y: 10 })")
    _ok("ends with semicolon", out, "; }")


def test_annotate_uses_RoughNotation_guard():
    src = """<script>
annotate('#h', {type:'highlight'});
</script>"""
    out = sanitize_optional_calls(src)
    # `annotate` is the call, but the guard is `RoughNotation`.
    _ok("annotate guarded by RoughNotation", out, "if (typeof RoughNotation !== 'undefined')")
    _missing("not double-guarded by 'annotate'", out, "typeof annotate !==")


def test_idempotency():
    src = """<script>anime({x:1});</script>"""
    once = sanitize_optional_calls(src)
    twice = sanitize_optional_calls(once)
    if once != twice:
        print("  [FAIL] idempotency: second pass changed output")
        print(f"    after 1: {once!r}")
        print(f"    after 2: {twice!r}")
        raise SystemExit(1)
    # Verify guard appears exactly once
    if once.count("typeof anime !==") != 1:
        print(f"  [FAIL] guard count: expected 1, got {once.count('typeof anime !==')}")
        print(f"         output: {once!r}")
        raise SystemExit(1)
    print("  [OK] idempotent across two passes")


def test_expression_context_skipped():
    """Calls on RHS of assignment or in arg position must not be wrapped —
    wrapping would be a syntax error."""
    src = """<script>
var x = anime({y:1});
foo(anime({y:2}));
var z = a ? anime({y:3}) : null;
</script>"""
    out = sanitize_optional_calls(src)
    _missing("no wrap on RHS assignment", out, "= if (typeof")
    _missing("no wrap inside arg list", out, "(if (typeof")
    _missing("no wrap inside ternary", out, "? if (typeof")


def test_method_call_skipped():
    """`obj.anime(...)` is a method call on `obj`, not the bare `anime`
    global. Wrapping with `typeof anime` would be wrong."""
    src = """<script>
this.anime({y:1});
foo.anime({y:2});
</script>"""
    out = sanitize_optional_calls(src)
    _missing("no wrap on method call", out, "typeof anime")


def test_gsap_never_wrapped():
    """GSAP is a hard dependency — wrapping it just masks real failures."""
    src = """<script>
gsap.to('#x', {opacity:1});
gsap.fromTo('#y', {x:0}, {x:100});
</script>"""
    out = sanitize_optional_calls(src)
    _missing("gsap.to not wrapped", out, "typeof gsap")
    _ok("gsap.to still present", out, "gsap.to('#x'")


def test_string_literal_identifier_skipped():
    """The identifier `anime` inside a string literal must NOT be wrapped."""
    src = """<script>
console.log('please load anime(...) library');
console.log("annotate('#x') would fail here");
</script>"""
    out = sanitize_optional_calls(src)
    _missing("anime inside single quotes not wrapped", out, "typeof anime")
    _missing("annotate inside double quotes not wrapped", out, "typeof RoughNotation")


def test_multiline_object_arg():
    """`anime({...nested object across lines...})` — paren-balanced scan
    must find the matching `)` despite newlines inside."""
    src = """<script>
anime({
  targets: '#a',
  translateY: [-20, 20],
  duration: 1.2,
  direction: 'alternate',
  loop: true,
  easing: 'easeInOutSine'
});
</script>"""
    out = sanitize_optional_calls(src)
    _ok("multi-line anime wrapped", out, "if (typeof anime !== 'undefined')")
    _ok("multi-line body preserved", out, "easeInOutSine")
    # Verify the close brace lands AFTER the closing `});`
    wrap_start = out.find("if (typeof anime")
    wrap_close = out.find("}", out.find("});", wrap_start))
    if wrap_close < 0:
        print("  [FAIL] couldn't locate wrap close brace")
        raise SystemExit(1)
    print("  [OK] multi-line close brace position")


def test_chained_call_kept_together():
    """`anime({...}).then(...)` — the chain must be wrapped as ONE statement,
    not split between the first call and `.then(...)`."""
    src = """<script>
anime({y:1}).finished.then(() => console.log('done'));
</script>"""
    out = sanitize_optional_calls(src)
    _ok("chain wrapped together", out, "if (typeof anime !== 'undefined')")
    _ok("then chain preserved", out, ".finished.then(")


def test_already_guarded_skipped():
    """User wrote their own `typeof anime` guard — sanitizer must NOT add a second."""
    src = """<script>
if (typeof anime !== 'undefined') { anime({y:1}); }
</script>"""
    out = sanitize_optional_calls(src)
    if out.count("typeof anime !==") != 1:
        print(f"  [FAIL] should not re-wrap: count={out.count('typeof anime !==')}")
        print(f"         output: {out!r}")
        raise SystemExit(1)
    print("  [OK] pre-guarded call skipped")


def test_non_script_passthrough():
    """HTML outside <script> blocks must be byte-identical."""
    src = """<div>anime{} annotate(x) splitReveal(y)</div><p>fadeIn</p>"""
    out = sanitize_optional_calls(src)
    if out != src:
        print(f"  [FAIL] non-script content was modified")
        print(f"    in:  {src!r}")
        print(f"    out: {out!r}")
        raise SystemExit(1)
    print("  [OK] non-script HTML untouched")


def test_script_attrs_preserved():
    """The opening `<script data-template-js="x">` tag must survive verbatim."""
    src = '<script data-template-js="step_progression" type="text/javascript">anime({});</script>'
    out = sanitize_optional_calls(src)
    _ok("script tag attrs preserved", out, '<script data-template-js="step_progression" type="text/javascript">')
    _ok("wrap applied", out, "if (typeof anime")


def test_splitReveal_wrap():
    src = """<script>splitReveal('#h1', {type:'words'});</script>"""
    out = sanitize_optional_calls(src)
    _ok("splitReveal wrapped", out, "if (typeof splitReveal !== 'undefined')")


def test_animateSVG_uses_Vivus_guard():
    src = """<script>animateSVG('myicon', 100);</script>"""
    out = sanitize_optional_calls(src)
    _ok("animateSVG guarded by Vivus", out, "if (typeof Vivus !== 'undefined')")


def test_playSound_uses_Howler_guard():
    src = """<script>playSound('pop');</script>"""
    out = sanitize_optional_calls(src)
    _ok("playSound guarded by Howler", out, "if (typeof Howler !== 'undefined')")


def test_multiple_calls_in_one_script():
    """All independent calls should be individually wrapped."""
    src = """<script>
gsap.to('#x', {opacity:1});
anime({y:1});
annotate('#h', {type:'highlight'});
splitReveal('#title', {});
</script>"""
    out = sanitize_optional_calls(src)
    _ok("gsap still bare", out, "gsap.to('#x'")
    _ok("anime wrapped", out, "if (typeof anime !== 'undefined')")
    _ok("annotate wrapped", out, "if (typeof RoughNotation !== 'undefined')")
    _ok("splitReveal wrapped", out, "if (typeof splitReveal !== 'undefined')")


def test_chanakya_shot2_white_pattern():
    """Pin down the exact pattern from the shot-2-white bug: gsap.fromTo sets
    initial state, then anime({...}) is called. Sanitizer must wrap the
    anime call without breaking the gsap call."""
    src = """<script>
gsap.fromTo('#shot-root', {x:'100%', opacity:0}, {x:'0%', opacity:1, duration:0.45});

gsap.fromTo('#s2_badge', { scale: 0 }, { scale: 1, duration: 0.5, delay: 0.16 });

anime({
  targets: '.s2_floating_icon',
  translateY: [-20, 20],
  duration: 1.2,
  direction: 'alternate',
  loop: true,
  easing: 'easeInOutSine'
});

gsap.delayedCall(4.98, () => {
  annotate('#s2_headline', { type: 'highlight', color: 'rgba(0, 66, 128, 0.4)', padding: 10 });
  gsap.to('#s2_headline', { scale: 1.05, duration: 0.2 });
});
</script>"""
    out = sanitize_optional_calls(src)
    _ok("gsap.fromTo NOT wrapped", out, "gsap.fromTo('#shot-root'")
    _missing("gsap NOT wrapped", out, "typeof gsap")
    _ok("anime() wrapped", out, "if (typeof anime !== 'undefined')")
    # `annotate` is inside an arrow-function body of `gsap.delayedCall`. It
    # IS at statement-start within that body. Sanitizer should wrap it.
    _ok("annotate inside delayedCall wrapped", out, "if (typeof RoughNotation !== 'undefined')")
    print("  [OK] Chanakya shot-2 pattern fully handled")


def test_empty_html():
    assert sanitize_optional_calls("") == ""
    assert sanitize_optional_calls("<div></div>") == "<div></div>"
    print("  [OK] empty / trivial inputs pass through")


# ---------- runner ----------

if __name__ == "__main__":
    tests = [
        ("basic_anime_wrap", test_basic_anime_wrap),
        ("annotate_uses_RoughNotation_guard", test_annotate_uses_RoughNotation_guard),
        ("idempotency", test_idempotency),
        ("expression_context_skipped", test_expression_context_skipped),
        ("method_call_skipped", test_method_call_skipped),
        ("gsap_never_wrapped", test_gsap_never_wrapped),
        ("string_literal_identifier_skipped", test_string_literal_identifier_skipped),
        ("multiline_object_arg", test_multiline_object_arg),
        ("chained_call_kept_together", test_chained_call_kept_together),
        ("already_guarded_skipped", test_already_guarded_skipped),
        ("non_script_passthrough", test_non_script_passthrough),
        ("script_attrs_preserved", test_script_attrs_preserved),
        ("splitReveal_wrap", test_splitReveal_wrap),
        ("animateSVG_uses_Vivus_guard", test_animateSVG_uses_Vivus_guard),
        ("playSound_uses_Howler_guard", test_playSound_uses_Howler_guard),
        ("multiple_calls_in_one_script", test_multiple_calls_in_one_script),
        ("chanakya_shot2_white_pattern", test_chanakya_shot2_white_pattern),
        ("empty_html", test_empty_html),
    ]
    print(f"Running {len(tests)} sanitizer tests...")
    for name, fn in tests:
        print(f"-- {name}")
        fn()
    print(f"\nAll {len(tests)} tests passed.")
