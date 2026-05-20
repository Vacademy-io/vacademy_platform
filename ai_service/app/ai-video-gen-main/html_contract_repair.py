"""Deterministic auto-repair for per-shot HTML contract violations.

The per-shot HTML generation prompts (prompts.py:1704 and
shot_type_cards.py:379-388) have clear rules about the root element
and brand-background contract. The LLM violates them silently across
shots. The existing structural validator (_validate_html_segment) only
checks tag balance and length — it does NOT check contract compliance.

This module patches the HTML to bring it back into compliance with no
LLM round-trip. Idempotent — running on already-correct HTML is a
no-op. Designed to be conservative: only fixes well-defined violations
that produce visible blank-shot bugs.

Two public functions:
  - `repair_root_contract(html)` → (repaired_html, applied_fixes_list)
  - `audit_contract(html)` → list of remaining violation strings

Repair contract (Tier 1 — fixes the "shot renders blank" failure mode):
  1. Strip duplicate `id="..."` attributes on the same tag (keep "shot-root"
     when present, else keep first).
  2. Normalize the root markup id to "shot-root": when markup uses an
     alias like `id="s6_shot-root"`, rename to `id="shot-root"` AND
     rewrite all CSS `#s6_shot-root` selectors to `#shot-root`.
  3. Rewrite any remaining `#sN_shot-root` aliases in CSS to `#shot-root`
     (for the case where markup is `id="shot-root"` but CSS targets the
     alias — shot-03 pattern).
  4. Inject `style="position:relative;width:100%;height:100%;overflow:hidden"`
     on the root div when missing — this is what makes the background
     actually paint (shot-04 pattern).

Audit (Tier 2 — non-blocking warnings for observability):
  - Reports remaining violations: missing root id, redefined `--brand-bg`,
    references to non-loaded libs (anime, iconify-icon).
  - Returns a string list; caller logs but does NOT gate on these.

Roll-out posture: auto-repair runs unconditionally (it can only FIX,
never introduce bugs). Audit logs warnings. A future tier flag can
promote audit to a blocking gate once we observe production behavior.
"""
from __future__ import annotations

import re
from typing import List, Tuple


# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------

# Matches alias root IDs the LLM commonly invents: #s3-root, #s6_shot-root,
# #s21_shot-root, #s0_shot-root, etc. Conservative — only patterns that
# clearly look like "shot N root" aliases. Won't catch e.g. #my-root.
_ROOT_ID_ALIAS_PATTERN = re.compile(
    r"#(s\d+[_-]?shot[-_]root|s\d+[-_]root)\b",
    re.IGNORECASE,
)

# Same pattern as a markup id attribute value.
_MARKUP_ALIAS_ID_RE = re.compile(
    r"""<div\s+[^>]*?\bid\s*=\s*['"](s\d+[_-]?shot[-_]root|s\d+[-_]root)['"]""",
    re.IGNORECASE | re.DOTALL,
)

# Find the root <div id="shot-root"...> tag (matches both quote styles).
# Capture group 1 = everything inside the tag (between < and >).
_SHOT_ROOT_DIV_RE = re.compile(
    r"""(<div\s+[^>]*\bid\s*=\s*['"]shot-root['"][^>]*>)""",
    re.IGNORECASE,
)

# Match a duplicate `id="..."` attribute on the same tag.
_DUP_ID_RE = re.compile(
    r"""(<[a-zA-Z][^>]*?)\bid\s*=\s*(['"])([^'"]*)\2([^>]*?)\bid\s*=\s*(['"])([^'"]*)\5([^>]*?>)""",
    re.IGNORECASE | re.DOTALL,
)

# `:root { ... --brand-bg: ...; ... }` declaration inside a <style> block.
_ROOT_BRAND_BG_RE = re.compile(
    r""":root\s*\{[^}]*?--brand-bg\s*:[^}]*\}""",
    re.IGNORECASE | re.DOTALL,
)

# A single `--brand-bg: ...;` declaration (used to strip just that line).
_BRAND_BG_DECL_RE = re.compile(
    r"--brand-bg\s*:\s*[^;]*;?",
    re.IGNORECASE,
)

# Required inline style declarations on the root div. We inject these
# when missing so the root element actually paints its background.
_REQUIRED_ROOT_STYLES = {
    "position": "relative",
    "width":    "100%",
    "height":   "100%",
    "overflow": "hidden",
}


# ---------------------------------------------------------------------------
# Step 1: drop duplicate id attributes
# ---------------------------------------------------------------------------

def _drop_duplicate_id_attrs(html: str) -> Tuple[str, List[str]]:
    """When a tag has two `id="..."` attributes (invalid HTML; browser
    keeps first), prefer "shot-root" if either matches; otherwise keep
    the first one and drop the second."""
    fixes: List[str] = []
    while True:
        m = _DUP_ID_RE.search(html)
        if not m:
            break
        before, _, id1, mid, _, id2, after = m.groups()
        if id1.lower() == "shot-root":
            keep = id1
        elif id2.lower() == "shot-root":
            keep = id2
        else:
            keep = id1
        replacement = f'{before}id="{keep}"{mid}{after}'
        html = html[: m.start()] + replacement + html[m.end():]
        fixes.append(f"dropped_duplicate_id (kept {keep!r}; dropped "
                     f"{id1 if keep != id1 else id2!r})")
    return html, fixes


# ---------------------------------------------------------------------------
# Step 2 + 3: normalize root id (markup + CSS) to "shot-root"
# ---------------------------------------------------------------------------

def _normalize_root_id_to_shot_root(html: str) -> Tuple[str, List[str]]:
    """Ensure markup root div uses `id="shot-root"` and all CSS targeting
    a root-id alias is rewritten to `#shot-root`.

    Two cases handled:
      A. Markup uses `id="s6_shot-root"` (or similar alias), no
         `id="shot-root"` anywhere → rename markup + CSS to canonical.
      B. Markup uses `id="shot-root"` but CSS targets an alias →
         rewrite CSS selectors to `#shot-root` so the rules apply.
    """
    fixes: List[str] = []

    has_shot_root_markup = bool(
        re.search(r"""\bid\s*=\s*['"]shot-root['"]""", html, re.IGNORECASE)
    )

    # Case A — markup uses an alias, no canonical id present.
    if not has_shot_root_markup:
        m = _MARKUP_ALIAS_ID_RE.search(html)
        if m:
            alias = m.group(1)
            # Rename ONLY the first occurrence in markup. Other elements
            # with the same id would be a different bug we don't auto-fix.
            html = re.sub(
                rf"""(\bid\s*=\s*['"]){re.escape(alias)}(['"])""",
                r"\1shot-root\2",
                html,
                count=1,
                flags=re.IGNORECASE,
            )
            fixes.append(f"renamed_root_markup_id_to_shot-root (was {alias!r})")

    # Case B + leftover alias references — rewrite ANY remaining
    # `#sN_shot-root` selectors in CSS to `#shot-root`. After Case A
    # renamed markup, CSS still has the old alias; this catches both.
    new_html, n = _ROOT_ID_ALIAS_PATTERN.subn("#shot-root", html)
    if n > 0:
        fixes.append(f"rewrote_{n}_css_alias_to_#shot-root")
        html = new_html

    return html, fixes


# ---------------------------------------------------------------------------
# Step 4: ensure root inline style (the actual blank-shot fix)
# ---------------------------------------------------------------------------

def _parse_inline_style(style_value: str) -> dict:
    """Parse a CSS inline style string into a {prop: value} dict, lowercase
    property names, value preserved as-is."""
    out: dict = {}
    for decl in style_value.split(";"):
        decl = decl.strip()
        if not decl or ":" not in decl:
            continue
        prop, _, val = decl.partition(":")
        out[prop.strip().lower()] = val.strip()
    return out


def _serialize_inline_style(style_dict: dict) -> str:
    """Inverse of _parse_inline_style. Stable order = required props
    first (so the most important ones survive any aggressive trimming
    downstream), then any caller extras in original-insertion order."""
    ordered_keys = list(_REQUIRED_ROOT_STYLES.keys())
    extras = [k for k in style_dict if k not in ordered_keys]
    decls = []
    for k in ordered_keys + extras:
        if k in style_dict:
            decls.append(f"{k}:{style_dict[k]}")
    return ";".join(decls)


def _ensure_root_inline_style(html: str) -> Tuple[str, List[str]]:
    """If `<div id="shot-root">` is missing any of position:relative /
    width:100% / height:100% / overflow:hidden in its inline `style=`,
    inject the missing ones. Existing style declarations preserved."""
    fixes: List[str] = []

    tag_m = _SHOT_ROOT_DIV_RE.search(html)
    if not tag_m:
        # No shot-root markup at all — Step 2 already would have caught
        # this. Nothing to inject onto.
        return html, fixes

    tag = tag_m.group(1)
    # Pull the existing style="..." attribute, if any.
    style_attr_m = re.search(
        r"""(style\s*=\s*)(['"])([^'"]*)\2""",
        tag,
        re.IGNORECASE,
    )

    if style_attr_m:
        existing_style = _parse_inline_style(style_attr_m.group(3))
    else:
        existing_style = {}

    missing_props = [
        k for k in _REQUIRED_ROOT_STYLES
        if k not in existing_style
    ]
    if not missing_props:
        return html, fixes

    # Merge: keep existing values where present, inject defaults for missing.
    for k in missing_props:
        existing_style[k] = _REQUIRED_ROOT_STYLES[k]
    new_style_value = _serialize_inline_style(existing_style)

    if style_attr_m:
        # Replace the existing style attribute in place.
        new_tag = tag.replace(
            style_attr_m.group(0),
            f'style="{new_style_value}"',
            1,
        )
    else:
        # Insert style attribute right before the closing `>`.
        new_tag = tag[:-1].rstrip() + f' style="{new_style_value}">'

    html = html[: tag_m.start()] + new_tag + html[tag_m.end():]
    fixes.append(f"injected_root_inline_style: {missing_props}")
    return html, fixes


# ---------------------------------------------------------------------------
# Public: run all repairs in order
# ---------------------------------------------------------------------------

def repair_root_contract(html: str) -> Tuple[str, List[str]]:
    """Apply all Tier 1 root-contract repairs in order. Returns
    `(repaired_html, list_of_applied_fixes)`. Empty fix list = no-op."""
    if not html or len(html.strip()) < 10:
        return html, []
    all_fixes: List[str] = []

    # Step 1: drop duplicate id attrs (so subsequent steps see clean tags).
    html, fixes = _drop_duplicate_id_attrs(html)
    all_fixes.extend(fixes)

    # Step 2 + 3: normalize root id in markup + CSS to "shot-root".
    html, fixes = _normalize_root_id_to_shot_root(html)
    all_fixes.extend(fixes)

    # Step 4: ensure root div has the required inline style.
    html, fixes = _ensure_root_inline_style(html)
    all_fixes.extend(fixes)

    return html, all_fixes


# ---------------------------------------------------------------------------
# Audit (non-blocking warnings)
# ---------------------------------------------------------------------------

def audit_contract(html: str) -> List[str]:
    """Return a list of remaining contract violations. Empty list = clean.
    Caller logs these as warnings; pipeline does NOT gate on them
    (current roll-out posture)."""
    issues: List[str] = []
    if not html:
        return issues

    # Root id presence + uniqueness on a <div>.
    shot_root_div_matches = re.findall(
        r"""<div\s+[^>]*\bid\s*=\s*['"]shot-root['"]""",
        html,
        re.IGNORECASE,
    )
    if not shot_root_div_matches:
        issues.append('no <div id="shot-root"> found — render worker may not '
                      'find the canonical container')
    elif len(shot_root_div_matches) > 1:
        issues.append(f'{len(shot_root_div_matches)} <div id="shot-root"> '
                      'elements found — should be exactly one')

    # :root { --brand-bg } redefinition (brand palette violation).
    if _ROOT_BRAND_BG_RE.search(html):
        issues.append('shot redefines --brand-bg inside :root '
                      '(violates global brand palette contract)')

    # Lingering alias references.
    remaining_aliases = _ROOT_ID_ALIAS_PATTERN.findall(html)
    if remaining_aliases:
        unique = sorted({f"#{a}" for a in remaining_aliases})
        issues.append(f'CSS still references root-id aliases: {unique}')

    # Unloaded JS libraries.
    if re.search(r"\banime\s*\(", html):
        issues.append("uses anime() — anime.js is not loaded (only GSAP is)")
    if "<iconify-icon" in html.lower():
        issues.append("uses <iconify-icon> — iconify runtime is not loaded")

    return issues
