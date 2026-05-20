"""Post-LLM JavaScript-call sanitizer.

The per-shot HTML LLM emits direct calls to optional animation libraries —
`anime(...)`, `annotate(...)`, `splitReveal(...)`, `Vivus(...)`, `animateSVG(...)`,
`playSound(...)`, etc. — without `typeof` guards. When any of those libraries
fails to load in the active runtime (renderer / editor preview / screenshot
worker), the call throws `ReferenceError` and **silently kills the rest of
the script for that shot**. The most visible failure mode: the
`gsap.fromTo('#shot-root', {opacity:0}, ...)` that runs first sets the shot
invisible, and the broken script can't tween it back — the whole shot ships
blank.

This sanitizer is a defensive post-LLM pass that wraps every known-optional
call in `if (typeof <global> !== 'undefined') { <statement> }`. A missing
library now becomes a no-op on that one call site instead of nuking the
whole shot.

Scope guardrails:
  • Only `<script>...</script>` block contents are touched. The
    surrounding HTML / CSS / SVG defs are passed through verbatim.
  • Only call expressions that appear at STATEMENT START get wrapped —
    expression-context occurrences (RHS of assignment, inside ternary,
    inside an argument list) are skipped. Wrapping a non-statement in
    `if (...)` would be a syntax error.
  • Already-guarded calls are skipped (idempotent).
  • Identifiers inside string / template literals are skipped (quote-
    state tracked through the script body).
  • `gsap.*` is deliberately NOT in the guard list — GSAP is a hard
    dependency of the renderer + editor; wrapping it would just mask
    real failures.

Performance budget: this runs in `_shot_task` after the per-shot LLM,
across N shots in parallel. Stay well under 5ms per shot for a typical
~5 KB script block.
"""
from __future__ import annotations

import re
from typing import List, Optional, Tuple


# ---------------------------------------------------------------------------
# Guard registry — (callable_name, global_to_feature_test).
#
# `callable_name` is what the per-shot LLM types in the script body
# (e.g. `anime`, `annotate`). `global_to_feature_test` is what survives
# in `typeof X !== 'undefined'` — usually identical to callable_name, but
# rough-notation exposes `annotate` as a function that depends on the
# `RoughNotation` global so we test that global instead.
#
# Phase 2 will switch this list to `js_library_registry.callables_to_guard()`
# so adding a new library updates the sanitizer automatically. Until then,
# hand-keyed in priority order.
# ---------------------------------------------------------------------------
_DEFAULT_GUARDS: Tuple[Tuple[str, str], ...] = (
    # Anime.js — direct call AND the harness-wrapped registrar
    ("anime",        "anime"),
    ("_animeR",      "anime"),
    # rough-notation — `annotate()` is the LLM-facing API, RoughNotation is
    # the runtime global the test should check.
    ("annotate",     "RoughNotation"),
    # Custom helpers — defined inline by the renderer harness AND the
    # editor's html-processor. If either drifts, the other surface throws.
    ("splitReveal",  "splitReveal"),
    ("fadeIn",       "fadeIn"),
    ("popIn",        "popIn"),
    ("slideUp",      "slideUp"),
    ("typewriter",   "typewriter"),
    ("showThenAnnotate", "showThenAnnotate"),
    # Vivus / SVG draw-in
    ("animateSVG",   "Vivus"),
    ("Vivus",        "Vivus"),
    # Audio
    ("playSound",    "Howler"),
)


# Stage-1 regex — only scans for the IDENTIFIER, not the parens. Cheap;
# the expensive paren-balanced scan only runs for actual hits.
def _build_finder(guards: Tuple[Tuple[str, str], ...]) -> "re.Pattern[str]":
    # Word boundaries around each identifier so `splitReveal` doesn't
    # match inside `xsplitReveal` and `anime` doesn't match inside `animeR`.
    # `_animeR` itself is a separate entry that matches when bare.
    names = sorted({name for name, _ in guards}, key=len, reverse=True)
    pat = r"\b(?:" + "|".join(re.escape(n) for n in names) + r")\b"
    return re.compile(pat)


# Whether a character can legally appear in a JS identifier — used by the
# pre-call backtrace and by the post-call quote scanner.
_IDENT_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$")

# Characters that mark a STATEMENT BOUNDARY directly before a call.
# Anything else (e.g. `=`, `?`, `,`, `(`, `+`, `:`) means the call is in
# expression context — we don't wrap.
_STMT_TERMINATORS = set(";{}\n")


def _is_in_string_or_comment(src: str, idx: int) -> bool:
    """Linear scan from start: was index `idx` inside a string literal,
    template literal, line comment, or block comment?

    Tracks quote state with one pass, NOT a regex. The renderer's <script>
    bodies are short (<~10 KB) and we only call this when a guard
    identifier was matched — at most ~10 calls per shot. Total cost is
    bounded.
    """
    i = 0
    n = len(src)
    in_single = in_double = in_template = False
    in_line_comment = in_block_comment = False
    while i < idx and i < n:
        c = src[i]
        if in_line_comment:
            if c == "\n":
                in_line_comment = False
            i += 1
            continue
        if in_block_comment:
            if c == "*" and i + 1 < n and src[i + 1] == "/":
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue
        if in_single:
            if c == "\\":
                i += 2
                continue
            if c == "'":
                in_single = False
            i += 1
            continue
        if in_double:
            if c == "\\":
                i += 2
                continue
            if c == '"':
                in_double = False
            i += 1
            continue
        if in_template:
            if c == "\\":
                i += 2
                continue
            if c == "`":
                in_template = False
            i += 1
            continue
        # Not in any string/comment — check for open
        if c == "/" and i + 1 < n:
            nxt = src[i + 1]
            if nxt == "/":
                in_line_comment = True
                i += 2
                continue
            if nxt == "*":
                in_block_comment = True
                i += 2
                continue
        if c == "'":
            in_single = True
        elif c == '"':
            in_double = True
        elif c == "`":
            in_template = True
        i += 1
    return in_single or in_double or in_template or in_line_comment or in_block_comment


def _prev_meaningful_char(src: str, idx: int) -> Tuple[str, int]:
    """Walk backwards from `idx`, skipping whitespace + comments, return
    (char, index). Returns ('', -1) if start-of-string. Used to decide
    statement vs. expression context.
    """
    i = idx - 1
    while i >= 0:
        c = src[i]
        if c in " \t\r":
            i -= 1
            continue
        if c == "\n":
            return ("\n", i)
        # Block-comment end? Walk back to its start.
        if c == "/" and i >= 1 and src[i - 1] == "*":
            # Find matching /*
            j = i - 2
            while j >= 1 and not (src[j - 1] == "/" and src[j] == "*"):
                j -= 1
            i = j - 2  # before the /*
            continue
        return (c, i)
    return ("", -1)


def _is_statement_start(src: str, call_start: int) -> bool:
    """True if a function call beginning at `call_start` is the first thing
    in its statement (so wrapping it in `if (...) { ... }` is syntactically
    safe). Statement starts after `;`, `{`, `}`, line-start, or
    start-of-script.
    """
    ch, _ = _prev_meaningful_char(src, call_start)
    if ch == "":
        return True
    if ch in _STMT_TERMINATORS:
        return True
    return False


def _is_already_guarded(src: str, call_start: int, guard_global: str) -> bool:
    """Look back up to 120 chars for `typeof <guard_global> !==` (with
    flexible whitespace). If found, this call is already inside an
    existing guard — skip re-wrapping.

    Why 120 chars: `if (typeof RoughNotation !== "undefined") { annotate(...` is
    ~50 chars. Multi-statement guarded blocks can push the test further
    back; 120 gives slack without ballooning false-positive risk.
    """
    look_start = max(0, call_start - 120)
    window = src[look_start:call_start]
    # Match: typeof <guard> !== 'undefined'  OR  typeof <guard> != 'undefined'
    pat = re.compile(
        r"typeof\s+" + re.escape(guard_global) + r"\s*!==?\s*['\"]undefined['\"]"
    )
    return pat.search(window) is not None


def _scan_call_end(src: str, paren_open: int) -> Optional[int]:
    """Given the index of `(` that opens a function call, return the index
    of the matching `)` (inclusive position of the closing paren). Tracks
    nested parens AND skips contents of strings / template literals /
    comments so that `anime({ msg: 'foo) bar' })` doesn't terminate early.

    Returns None if the parens are unbalanced (truncated script) — the
    caller treats that as "skip wrapping" rather than emitting broken JS.
    """
    n = len(src)
    depth = 0
    i = paren_open
    in_single = in_double = in_template = False
    in_line_comment = in_block_comment = False
    while i < n:
        c = src[i]
        if in_line_comment:
            if c == "\n":
                in_line_comment = False
            i += 1
            continue
        if in_block_comment:
            if c == "*" and i + 1 < n and src[i + 1] == "/":
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue
        if in_single:
            if c == "\\":
                i += 2
                continue
            if c == "'":
                in_single = False
            i += 1
            continue
        if in_double:
            if c == "\\":
                i += 2
                continue
            if c == '"':
                in_double = False
            i += 1
            continue
        if in_template:
            if c == "\\":
                i += 2
                continue
            if c == "`":
                in_template = False
            i += 1
            continue
        if c == "/" and i + 1 < n:
            nxt = src[i + 1]
            if nxt == "/":
                in_line_comment = True
                i += 2
                continue
            if nxt == "*":
                in_block_comment = True
                i += 2
                continue
        if c == "'":
            in_single = True
        elif c == '"':
            in_double = True
        elif c == "`":
            in_template = True
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return None


def _scan_statement_end(src: str, after_close_paren: int) -> int:
    """After the closing `)`, find the end of the call STATEMENT — the
    next `;` or newline that ends the expression at depth 0. We need this
    so the wrapped `if (...) { ... }` block consumes the full statement
    (`anime({...});` not just `anime({...})` without the semicolon).

    Skips trailing chained method calls (`.then(...).catch(...)`) so that
    the wrap doesn't split a chain. If the call is followed by a `.`, we
    treat the chain as part of the same statement.
    """
    n = len(src)
    i = after_close_paren + 1
    while i < n:
        c = src[i]
        if c in " \t":
            i += 1
            continue
        if c == ";":
            return i  # include the semicolon
        if c == "\n":
            return i - 1  # statement ends before newline
        if c == ".":
            # Chained call / property access — find the end of THIS chain
            # element by re-running _scan_call_end on the next paren.
            # Simpler heuristic: walk to the next `(`, scan to its close,
            # then loop.
            paren_idx = src.find("(", i)
            if paren_idx < 0 or paren_idx > i + 100:
                # No chain paren in reasonable distance — bail out.
                return i - 1
            close = _scan_call_end(src, paren_idx)
            if close is None:
                return n - 1
            i = close + 1
            continue
        # Any other char on the same line — stop. We don't try to handle
        # comma-separated statements (rare in LLM-emitted code).
        return i - 1
    return n - 1


# Regex that finds the contents of every <script> block. The renderer's
# scripts have attributes like `data-template-js="..."` — match the full
# opening tag and any attrs, capture the inner body.
_SCRIPT_BLOCK_RE = re.compile(
    r"(<script\b[^>]*>)(.*?)(</script\s*>)",
    re.DOTALL | re.IGNORECASE,
)


def sanitize_optional_calls(
    html: str,
    guards: Optional[Tuple[Tuple[str, str], ...]] = None,
) -> str:
    """Wrap every statement-context call to a known-optional library in
    `if (typeof <guard> !== 'undefined') { <statement> }`.

    Args:
        html: Per-shot HTML emitted by the LLM (or template composer).
            Should include `<script>...</script>` blocks. Anything outside
            `<script>` is returned verbatim.
        guards: Override the default guard list. Each tuple is
            `(callable_name, global_to_feature_test)`. Used by tests; in
            production the default list is fine.

    Returns:
        HTML with sanitized `<script>` bodies. Non-script content is
        unchanged. The function is idempotent — running it twice produces
        the same output as running it once.
    """
    if not html:
        return html
    active_guards = guards if guards is not None else _DEFAULT_GUARDS
    if not active_guards:
        return html

    finder = _build_finder(active_guards)
    # Map callable_name → guard_global for quick lookup
    guard_map = dict(active_guards)

    def _sanitize_block(match: "re.Match[str]") -> str:
        open_tag = match.group(1)
        body = match.group(2)
        close_tag = match.group(3)
        new_body = _sanitize_script_body(body, finder, guard_map)
        return f"{open_tag}{new_body}{close_tag}"

    return _SCRIPT_BLOCK_RE.sub(_sanitize_block, html)


def _sanitize_script_body(
    body: str,
    finder: "re.Pattern[str]",
    guard_map: dict,
) -> str:
    """Apply guard wrapping to a single script body. Pure function; the
    main `sanitize_optional_calls` runs this per `<script>` block.

    Collect every `(start, end, replacement)` first, then splice — avoids
    invalidating earlier indices when later wraps grow the source.
    """
    edits: List[Tuple[int, int, str]] = []
    seen_ends: List[int] = []  # to skip overlapping matches

    for ident_match in finder.finditer(body):
        call_name = ident_match.group(0)
        ident_start = ident_match.start()
        ident_end = ident_match.end()

        # Skip if this identifier is inside a string/comment.
        if _is_in_string_or_comment(body, ident_start):
            continue

        # Must be followed (after optional whitespace) by `(`.
        i = ident_end
        while i < len(body) and body[i] in " \t":
            i += 1
        if i >= len(body) or body[i] != "(":
            continue
        paren_open = i

        # Skip if this isn't statement-start (it's in expression context).
        if not _is_statement_start(body, ident_start):
            continue

        # Skip if previous char is `.` — this is a method call on some
        # other object (e.g. `obj.anime(...)`), not the bare global.
        prev_char, _ = _prev_meaningful_char(body, ident_start)
        if prev_char == ".":
            continue

        # Skip if previously matched range covers this position (paranoia).
        if any(start <= ident_start < end for start, end, _ in edits):
            continue

        guard_global = guard_map[call_name]
        if _is_already_guarded(body, ident_start, guard_global):
            continue

        # Walk parens to find the call's end.
        close_paren = _scan_call_end(body, paren_open)
        if close_paren is None:
            continue  # malformed — leave alone

        # Find statement end (semicolon or newline, accounting for chains).
        stmt_end = _scan_statement_end(body, close_paren)

        # Compose the wrap. Preserve original indentation so the wrapped
        # block lines up with surrounding code in saved HTML.
        # Find indentation of the call's line — walk back to the previous
        # newline or start-of-string.
        line_start = body.rfind("\n", 0, ident_start) + 1
        indent = ""
        j = line_start
        while j < ident_start and body[j] in " \t":
            indent += body[j]
            j += 1

        original = body[ident_start:stmt_end + 1].rstrip()
        # Strip a trailing semicolon — we'll re-add it after the closing brace
        # so the structure is `if (...) { stmt; }`.
        original_has_semi = original.endswith(";")
        stmt_inner = original[:-1] if original_has_semi else original

        wrapped = (
            f"if (typeof {guard_global} !== 'undefined') {{ "
            f"{stmt_inner}; "
            f"}}"
        )
        edits.append((ident_start, stmt_end + 1, wrapped))
        seen_ends.append(stmt_end + 1)

    if not edits:
        return body

    # Splice edits in order, from end to start, so earlier indices stay valid.
    edits.sort(key=lambda e: e[0])
    out_parts: List[str] = []
    cursor = 0
    for start, end, replacement in edits:
        out_parts.append(body[cursor:start])
        out_parts.append(replacement)
        cursor = end
    out_parts.append(body[cursor:])
    return "".join(out_parts)


__all__ = ["sanitize_optional_calls"]
