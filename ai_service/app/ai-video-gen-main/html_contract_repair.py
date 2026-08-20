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


def _strip_root_brand_bg_override(html: str) -> Tuple[str, List[str]]:
    """Strip any `--brand-bg: ...;` the shot redefines inside its OWN `:root`
    block. The institute brand background is defined once at the harness level;
    a shot overriding it in :root silently changes the brand color. This was
    previously audit-only (warn but ship) — now the global palette actually
    wins. Only the `--brand-bg` line is removed; the rest of :root is kept."""
    fixes: List[str] = []
    if not html or "--brand-bg" not in html.lower():
        return html, fixes

    def _scrub(m: "re.Match") -> str:
        block = m.group(0)
        new_block = _BRAND_BG_DECL_RE.sub("", block)
        if new_block != block:
            fixes.append("stripped_root_--brand-bg_override")
        return new_block

    return _ROOT_BRAND_BG_RE.sub(_scrub, html), fixes


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

    # Step 5: strip any :root --brand-bg override so the global palette wins.
    html, fixes = _strip_root_brand_bg_override(html)
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
    # NOTE: <iconify-icon> is intentionally NOT flagged. The iconify runtime IS
    # loaded in every renderer (server render harness + admin/learner players)
    # and the per-shot prompt actively instructs the model to use it — the old
    # "iconify runtime is not loaded" warning was a stale false positive that
    # risked driving a wrong "forbid iconify" fix (which would remove working icons).

    return issues


# ---------------------------------------------------------------------------
# Undefined CSS custom properties
# ---------------------------------------------------------------------------
# A `var(--x)` with no fallback whose `--x` is never defined does not degrade
# gracefully: the whole declaration is INVALID at computed-value time. For
# `font-size` that means the element inherits ~16px; for `padding` it means 0.
# Those two failures are precisely the "tiny text flush against the frame
# edge" shots. The pipeline now defines every shot_pack token, but models keep
# inventing names (`--font-size-hero`, `--gap-lg`, `--radius-card`), so this
# pass gives any surviving undefined var a family-appropriate fallback rather
# than letting it void the declaration.

_VAR_DEF_RE = re.compile(r"(--[A-Za-z0-9_-]+)\s*:")
# var(--name) with NO comma → no fallback. Nested var()s in the fallback slot
# are left alone; only the bare form is rewritten.
_VAR_USE_NOFB_RE = re.compile(r"var\(\s*(--[A-Za-z0-9_-]+)\s*\)")

_FAMILY_FALLBACKS: List[Tuple[str, str]] = [
    # (substring matched against the token name, fallback value)
    ("font-scale-display", "clamp(2.75rem, min(8.75vw, 15.5vh), 10.5rem)"),
    ("font-scale-h1", "clamp(2rem, min(6vw, 10.7vh), 7.25rem)"),
    ("font-scale-h2", "clamp(1.5rem, min(4vw, 7vh), 4.75rem)"),
    ("font-scale-body", "clamp(1rem, min(1.7vw, 3vh), 2rem)"),
    # Any other font-scale-* (caption/label/micro/…) is still a SIZE. This
    # must precede the bare "font" entry below, or e.g. --font-scale-label
    # would be handed a font FAMILY and the font-size declaration would stay
    # invalid — the exact bug this pass exists to prevent.
    ("font-scale", "clamp(0.9rem, 1.2vmin, 1.25rem)"),
    ("font-size", "clamp(1rem, min(1.7vw, 3vh), 2rem)"),
    ("display", "clamp(2.75rem, min(8.75vw, 15.5vh), 10.5rem)"),
    ("h1", "clamp(2rem, min(6vw, 10.7vh), 7.25rem)"),
    ("h2", "clamp(1.5rem, min(4vw, 7vh), 4.75rem)"),
    ("h3", "clamp(1.25rem, min(3vw, 5vh), 3rem)"),
    ("mono", "'Fira Code', monospace"),
    ("font-heading", "var(--font-display, 'Montserrat', sans-serif)"),
    ("font-title", "var(--font-display, 'Montserrat', sans-serif)"),
    ("font", "var(--font-body, 'Inter', sans-serif)"),
    ("safe", "6%"),
    ("radius", "12px"),
    ("gap", "24px"),
    ("spacing-xs", "8px"),
    ("spacing-sm", "16px"),
    ("spacing-md", "24px"),
    ("spacing-lg", "40px"),
    ("spacing-xl", "64px"),
    ("spacing-2xl", "96px"),
    ("spacing", "24px"),
    ("padding", "24px"),
    ("margin", "24px"),
    ("bg", "var(--brand-bg, #ffffff)"),
    ("background", "var(--brand-bg, #ffffff)"),
    ("surface", "var(--brand-bg, #ffffff)"),
    ("muted", "var(--brand-text-secondary, #475569)"),
    ("secondary", "var(--brand-text-secondary, #475569)"),
    ("accent", "var(--brand-accent, #0071b8)"),
    ("primary", "var(--brand-primary, #0071b8)"),
    ("color", "var(--brand-text, #0f172a)"),
    ("text", "var(--brand-text, #0f172a)"),
]

# Size-valued properties are the ones that fail catastrophically (inherit or
# collapse to zero) rather than merely losing a color. When we cannot infer a
# family from the token name, fall back based on the property being set.
_SIZE_PROPS = (
    "font-size", "padding", "margin", "gap", "width", "height",
    "top", "left", "right", "bottom", "border-radius", "inset",
)


_SIZE_LIKE_RE = re.compile(r"^\s*(?:clamp\(|calc\(|min\(|max\(|-?[0-9.]+\s*(?:px|rem|em|%|vw|vh|vmin|vmax)\b)")


def _infer_var_fallback(token: str, property_name: str = "") -> str:
    name = token.lower().lstrip("-")
    prop = (property_name or "").lower()
    for needle, value in _FAMILY_FALLBACKS:
        if needle in name:
            # Name-based guesses lose to the property when they disagree about
            # kind: handing `font-size` a font family (or a color) leaves the
            # declaration just as invalid as the undefined var did.
            if prop == "font-size" and not _SIZE_LIKE_RE.match(value):
                return "clamp(1rem, min(1.7vw, 3vh), 2rem)"
            if prop.startswith("font-family") and _SIZE_LIKE_RE.match(value):
                return "var(--font-body, 'Inter', sans-serif)"
            return value
    if prop == "font-size":
        return "clamp(1rem, min(1.7vw, 3vh), 2rem)"
    if prop.startswith("font-family"):
        return "var(--font-body, 'Inter', sans-serif)"
    if any(prop.startswith(p) for p in _SIZE_PROPS):
        return "24px"
    return "var(--brand-text, #0f172a)"


def repair_undefined_css_vars(html: str) -> Tuple[str, List[str]]:
    """Give every undefined `var(--x)` (no fallback) a sane fallback.

    Returns `(repaired_html, [token names repaired])`. Idempotent: once a
    fallback is present the use no longer matches the no-fallback pattern.
    """
    if not html or "var(" not in html:
        return html, []
    defined = set(_VAR_DEF_RE.findall(html))
    used = set(_VAR_USE_NOFB_RE.findall(html))
    missing = used - defined
    if not missing:
        return html, []

    def _sub(m: "re.Match") -> str:
        token = m.group(1)
        if token not in missing:
            return m.group(0)
        # Look back for the property this value belongs to, so a bare
        # `font-size: var(--x)` can be distinguished from `color: var(--x)`.
        head = html[max(0, m.start() - 60):m.start()]
        pm = re.search(r"([a-zA-Z-]+)\s*:\s*[^;{}]*$", head)
        prop = pm.group(1) if pm else ""
        return f"var({token}, {_infer_var_fallback(token, prop)})"

    repaired = _VAR_USE_NOFB_RE.sub(_sub, html)
    return repaired, sorted(missing)


# ---------------------------------------------------------------------------
# Dark-bed text tokens
# ---------------------------------------------------------------------------
# Hero shots put a stock video / photo under a black gradient and then write
#     --text: var(--brand-text, #ffffff);
# believing the white fallback applies on the dark bed. It never does:
# --brand-text IS defined (near-black for a light run palette), so the fallback
# is dead code and the headline renders black-on-black. The model's own
# fallback is an explicit statement of intent — on a shot that really does have
# a dark full-bleed bed, honour it. The runtime contrast sweep in the
# dispatcher catches the rest; this makes the common case deterministic and
# fixes it before the vision reviewer ever sees the frame.

_DARK_OVERLAY_RE = re.compile(
    r"rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*(?:0\.[3-9]\d*|1(?:\.0+)?)\s*\)", re.I
)
_FULL_BLEED_MEDIA_RE = re.compile(r"<(?:video|img)\b[^>]*", re.I)
_LIGHT_LITERAL = r"(#fff(?:fff)?\b|white\b|rgba?\(\s*255\s*,\s*255\s*,\s*255[^)]*\))"
_DARK_BED_TOKEN_RE = re.compile(
    r"(--[A-Za-z0-9_-]+\s*:\s*)var\(\s*--brand-text(?:-secondary)?\s*,\s*" + _LIGHT_LITERAL + r"\s*\)",
    re.I,
)
_DARK_BED_COLOR_RE = re.compile(
    r"(\bcolor\s*:\s*)var\(\s*--brand-text(?:-secondary)?\s*,\s*" + _LIGHT_LITERAL + r"\s*\)",
    re.I,
)


def _has_dark_media_bed(html: str) -> bool:
    if not _FULL_BLEED_MEDIA_RE.search(html):
        return False
    if not _DARK_OVERLAY_RE.search(html):
        # A brightness()-graded bed counts too — that is the other half of the
        # standard hero recipe.
        return bool(re.search(r"brightness\(\s*0?\.[0-7]\d*\s*\)", html))
    return True


def repair_dark_bed_text(html: str) -> Tuple[str, List[str]]:
    """Honour a light-literal fallback on --brand-text when the shot has a
    dark full-bleed media bed. Returns `(html, applied_fixes)`."""
    if not html or "--brand-text" not in html:
        return html, []
    if not _has_dark_media_bed(html):
        return html, []
    fixes: List[str] = []

    def _tok(m: "re.Match") -> str:
        fixes.append(f"dark-bed token -> {m.group(2)}")
        return f"{m.group(1)}{m.group(2)}"

    html, _n1 = _DARK_BED_TOKEN_RE.subn(_tok, html)
    html, _n2 = _DARK_BED_COLOR_RE.subn(_tok, html)
    return html, fixes


# ---------------------------------------------------------------------------
# Inline flex direction
# ---------------------------------------------------------------------------
# The harness ships opinionated helper classes — `.process-flow` is a VERTICAL
# process list, `.stage-drift` a centred column — and the prompt shows the model
# their markup. The model reuses the class name for its own layout and states
# that layout inline: `class='process-flow' style='display:flex;
# align-items:flex-start;gap:24px'` with `flex:1` children and horizontal
# connectors, i.e. a row. Restating display:flex inline is redundant (the class
# already sets it), so it reads as the model authoring its own container. But it
# does not restate the DIRECTION, and inline styles only win for properties they
# actually declare — so the helper's `flex-direction: column` applies unopposed
# and the row becomes a stack of full-width cards taller than the frame, whose
# last card is cut off at the bottom edge.
#
# Pin the CSS default the element implied. Elements that do declare a direction
# inline, and elements that use a helper class without restating display:flex,
# are left exactly as they were.

_INLINE_STYLE_RE = re.compile(r"""style\s*=\s*(['"])(.*?)\1""", re.I | re.S)
_CLASS_ATTR_RE = re.compile(r"""class\s*=\s*(['"])(.*?)\1""", re.I | re.S)
_TAG_RE = re.compile(r"<\w+\b[^>]*>", re.S)
_DISPLAY_FLEX_RE = re.compile(r"display\s*:\s*(?:inline-)?flex\b", re.I)
_FLEX_CHILD_RE = re.compile(r"flex\s*:\s*[1-9]|flex-grow\s*:\s*[1-9]", re.I)

# Helper classes the harness injects that impose a property a shot CANNOT win
# by declaring `display:flex` inline — the helper's declaration is separate, so
# it survives unless the shot happens to name that exact property too. This map
# is generated from the harness CSS and pinned by a test: a new helper class
# carrying one of these properties fails that test until it is classified here,
# which is what stops this bug class from reappearing one screenshot at a time.
_HELPER_IMPOSED: Dict[str, Tuple[str, ...]] = {
    "equation-build-row": ("flex-wrap",),
    "full-screen-center": ("flex-direction",),
    "image-split-layout": ("grid-template-columns",),
    "image-text-overlay": ("flex-direction",),
    "layout-split": ("grid-template-columns", "max-width"),
    "node-body": ("flex-direction",),
    "process-flow": ("flex-direction", "max-width"),
}

# What the element implied by authoring its own container and staying silent.
_IMPLIED_DEFAULT = {
    "flex-direction": "row",
    "flex-wrap": "nowrap",
    "max-width": "none",
}


def _declares(style: str, prop: str) -> bool:
    return bool(re.search(rf"(?<![\w-]){re.escape(prop)}\s*:", style, re.I))


def repair_inline_flex_direction(html: str) -> Tuple[str, List[str]]:
    """Stop a helper class from overriding the layout a shot authored inline.

    An element that declares `display:flex` inline is authoring its own
    container — restating what the helper class already provides reads as
    intent. But inline styles only win for the properties they actually name,
    so a helper's `flex-direction: column` (or `max-width: 960px`) applies
    unopposed and turns an intended row into a stack taller than the frame.

    Fires on either signal:
      * the element carries a helper class known to impose the property, or
      * a child grows (`flex:1`), which is meaningless in the column a helper
        would impose and is the model's clearest statement of a row.

    Returns `(html, applied_fixes)`. Idempotent.
    """
    if not html or "display" not in html:
        return html, []
    fixes: List[str] = []

    def _fix_tag(m: "re.Match") -> str:
        tag = m.group(0)
        sm = _INLINE_STYLE_RE.search(tag)
        if not sm:
            return tag
        style = sm.group(2)
        if not _DISPLAY_FLEX_RE.search(style):
            return tag
        cm = _CLASS_ATTR_RE.search(tag)
        classes = set((cm.group(2) if cm else "").split())
        imposed: set = set()
        for cls in classes:
            imposed.update(_HELPER_IMPOSED.get(cls, ()))

        additions: List[str] = []
        for prop, default in _IMPLIED_DEFAULT.items():
            if _declares(style, prop):
                continue                      # the author named it; leave it
            if prop == "max-width":
                # Only lift a cap when the element sized itself explicitly.
                if prop not in imposed or not _declares(style, "width"):
                    continue
            elif prop not in imposed:
                # No known helper imposes it here — fall back to the row
                # heuristic for flex-direction only.
                if prop != "flex-direction":
                    continue
                tail = html[m.end():m.end() + 2600]
                if not _FLEX_CHILD_RE.search(tail):
                    continue
            additions.append(f"{prop}:{default}")

        if not additions:
            return tag
        sep = "" if style.rstrip().endswith(";") or not style.strip() else ";"
        new_style = f"{style}{sep}{';'.join(additions)};"
        fixes.append(f"pinned {', '.join(additions)} on inline display:flex")
        return tag[:sm.start(2)] + new_style + tag[sm.end(2):]

    return _TAG_RE.sub(_fix_tag, html), fixes


# ---------------------------------------------------------------------------
# Callback-driven state changes
# ---------------------------------------------------------------------------
# Multi-act shots swap acts inside a tween callback:
#
#   gsap.to('#flash', {opacity:.8, duration:.1, delay:9.32, onComplete: () => {
#       gsap.set('#act1', {opacity:0}); gsap.set('#act2', {opacity:1}); }});
#
# That is correct for playback and wrong for rendering. The renderer frame-steps
# by seeking gsap.globalTimeline in parallel chunks, and a worker whose chunk
# starts at 48s never passes 9.32s, so the callback never runs. With no initial
# opacity on the acts they all default to visible, and every act stacks on screen
# at once — three headlines and four cards in one frame.
#
# Hoist the state change out of the callback and into the timeline at the moment
# the callback would have fired (delay + duration). A tween is seek-safe; a
# callback is not.

_HOIST_MARKER = "vx: state changes hoisted"
_DELAY_RE = re.compile(r"\bdelay\s*:\s*([0-9.]+)")
_DURATION_RE = re.compile(r"\bduration\s*:\s*([0-9.]+)")
_ONCOMPLETE_RE = re.compile(r"onComplete\s*:\s*\(\s*\)\s*=>\s*")
_DELAYED_CALL_RE = re.compile(r"gsap\.delayedCall\(\s*([0-9.]+)\s*,\s*\(\s*\)\s*=>\s*")
# set / to / fromTo inside a callback body — the act swap is written with any
# of the three, so matching only `set` missed the video that rendered black.
_INNER_TWEEN_RE = re.compile(
    r"gsap\.(?:set|to|fromTo)\(\s*(['\"])(?P<sel>[^'\"]+)\1\s*,\s*\{(?P<props>[^{}]{0,400})\}",
    re.I,
)


def _balanced_body(text: str, brace_idx: int) -> str:
    """Contents of the {...} block starting at `brace_idx`.

    Callback bodies contain nested calls that each end in `});`, so a
    non-greedy regex stops at the first one and misses everything after it —
    which is exactly where the act show/hide sits.
    """
    if brace_idx < 0 or brace_idx >= len(text) or text[brace_idx] != "{":
        return ""
    depth = 0
    for i in range(brace_idx, min(len(text), brace_idx + 4000)):
        c = text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[brace_idx + 1:i]
    return ""


def _hoistable(body: str, base_time: float) -> List[Tuple[str, str, float]]:
    """(target, props, absolute_time) for each visibility change in a body."""
    out: List[Tuple[str, str, float]] = []
    for m in _INNER_TWEEN_RE.finditer(body):
        props = " ".join(m.group("props").split())
        if "opacity" not in props.lower():
            continue
        inner = _DELAY_RE.search(props)
        at = round(base_time + (float(inner.group(1)) if inner else 0.0), 3)
        props = re.sub(r",?\s*\bdelay\s*:\s*[0-9.]+", "", props).strip().strip(",")
        out.append((m.group("sel"), props, at))
    return out


def repair_callback_state_changes(html: str) -> Tuple[str, List[str]]:
    """Promote visibility changes out of tween callbacks onto the timeline.

    Multi-act shots swap acts from `onComplete` or `gsap.delayedCall`. Both are
    correct for playback and wrong for rendering: the renderer frame-steps by
    seeking gsap.globalTimeline in parallel chunks, so a worker whose range
    starts after the callback's time never fires it. The acts then keep their
    authored initial state — every act visible at once in one video, and 22
    seconds of black background in another where acts 2 and 3 start hidden.

    The callback is left in place, so playback is unchanged; only a seek-safe
    duplicate is added. Returns `(html, applied_fixes)` and is idempotent.
    """
    if not html or ("onComplete" not in html and "delayedCall" not in html):
        return html, []
    if _HOIST_MARKER in html:
        return html, []

    fixes: List[str] = []
    additions: List[str] = []

    for m in _ONCOMPLETE_RE.finditer(html):
        body = _balanced_body(html, html.find("{", m.end()))
        if not body:
            continue
        # The owning tween's delay/duration decide when it fires — read the
        # declarations closest to the callback, not a neighbouring tween's.
        head = html[max(0, m.start() - 400):m.start()]
        d, u = _DELAY_RE.findall(head), _DURATION_RE.findall(head)
        fire_at = round((float(d[-1]) if d else 0.0) + (float(u[-1]) if u else 0.0), 3)
        for target, props, at in _hoistable(body, fire_at):
            additions.append(f"gsap.to('{target}', {{{props}, duration: 0.001, delay: {at}}});")
            fixes.append(f"hoisted {target} to t={at}s (onComplete)")

    for m in _DELAYED_CALL_RE.finditer(html):
        body = _balanced_body(html, html.find("{", m.end()))
        if not body:
            continue
        for target, props, at in _hoistable(body, float(m.group(1))):
            additions.append(f"gsap.to('{target}', {{{props}, duration: 0.001, delay: {at}}});")
            fixes.append(f"hoisted {target} to t={at}s (delayedCall)")

    if not additions:
        return html, []

    block = (
        f"\n<script>/* {_HOIST_MARKER} out of tween callbacks — a frame-stepped "
        "render seeks the timeline and never fires them */\n"
        + "\n".join(additions)
        + "\n</script>"
    )
    idx = html.rfind("</script>")
    if idx == -1:
        return html + block, fixes
    idx += len("</script>")
    return html[:idx] + block + html[idx:], fixes


# ---------------------------------------------------------------------------
# Child-timeline choreography
# ---------------------------------------------------------------------------
# A shot that builds `const tl = gsap.timeline()` and schedules its reveals with
# `tl.to(target, vars, position)` can lose the entire choreography: the
# dispatcher wraps the timeline in a proxy, and the postscript diagnostics show
# the result as `duration=0.00 inner_children=0` — an empty timeline attached at
# the right startTime with nothing in it. The shot then renders as its initial
# state forever (title words parked behind their masks, 22 seconds of black).
#
# Free-standing gsap.to/from/fromTo/set calls are unaffected by that proxy, so
# convert the timeline's absolute-position calls into equivalent free-standing
# tweens: `tl.to(x, {...}, 3.2)` becomes `gsap.to(x, {..., delay: 3.2})`.
# Relative positions ('+=1', labels) are left alone — their meaning depends on
# the timeline's internal cursor, which a delay cannot express.

_TL_DECL_RE = re.compile(r"\b(?:const|let|var)\s+(?P<name>[A-Za-z_$][\w$]*)\s*=\s*gsap\.timeline\(")


def _tl_call_re(name: str) -> "re.Pattern[str]":
    return re.compile(
        rf"\b{re.escape(name)}\.(?P<kind>to|from|fromTo|set)\(\s*(?P<args>[^;]{{0,600}}?)\)\s*;",
        re.S,
    )


def repair_child_timeline_calls(html: str) -> Tuple[str, List[str]]:
    """Rewrite `tl.to(x, vars, POS)` as `gsap.to(x, {vars, delay: POS})`.

    Returns `(html, applied_fixes)`. Only absolute numeric positions are
    converted; anything else is left untouched.
    """
    if not html or "gsap.timeline(" not in html:
        return html, []
    fixes: List[str] = []
    out = html

    for decl in _TL_DECL_RE.finditer(html):
        name = decl.group("name")

        def _convert(m: "re.Match") -> str:
            args = m.group("args").strip()
            # Split off a trailing numeric position argument.
            tail = re.search(r",\s*(-?\d+(?:\.\d+)?)\s*$", args)
            if not tail:
                return m.group(0)
            pos = float(tail.group(1))
            head = args[:tail.start()].rstrip()
            # The vars object is the last {...} in the head; append the delay.
            close = head.rfind("}")
            if close == -1:
                return m.group(0)
            inner = head[:close].rstrip()
            sep = "" if inner.rstrip().endswith("{") else ","
            converted = f"{inner}{sep} delay: {pos}{head[close:]}"
            fixes.append(f"{name}.{m.group('kind')} at {pos}s → free-standing tween")
            return f"gsap.{m.group('kind')}({converted});"

        out = _tl_call_re(name).sub(_convert, out)

    return out, fixes


# ---------------------------------------------------------------------------
# Newline-stripped scripts
# ---------------------------------------------------------------------------
# A shot arrived with its entire <script> on ONE line, containing
# `// ACT 1tl.to('#s2_title_1', ...)`. A `//` comment runs to end of line, and
# there is no end of line, so everything after the first `//` is commented out.
# The timeline attaches at the right time with zero children and the shot
# renders as its initial state forever — 22 seconds of black background in a
# real video, with the diagnostics reporting a healthy `duration=0.00
# inner_children=0`.
#
# The comment text is prose; the code after it resumes at a recognisable token.
# Reinstate a line break before that token so the comment ends and the code runs.

_CODE_RESUME_RE = re.compile(
    r"(?:gsap\.|const\s|let\s|var\s|window\.|document\.|annotate\(|"
    r"requestAnimationFrame\(|setTimeout\(|function\s|if\s*\(|try\s*\{|"
    r"[A-Za-z_$][\w$]*\.(?:to|from|fromTo|set|add|call|timeScale)\()"
)
_SCRIPT_BLOCK_RE = re.compile(r"(<script\b[^>]*>)([\s\S]*?)(</script>)", re.I)


def repair_newline_stripped_comments(html: str) -> Tuple[str, List[str]]:
    """Restore line breaks after `//` comments in single-line scripts.

    Only touches script blocks that contain `//` and no newline at all — the
    exact shape that silently comments out a shot's whole animation. Returns
    `(html, applied_fixes)` and is idempotent (a repaired block has newlines).
    """
    if not html or "//" not in html:
        return html, []
    fixes: List[str] = []

    def _fix_block(m: "re.Match") -> str:
        open_tag, body, close_tag = m.group(1), m.group(2), m.group(3)
        if "\n" in body or "//" not in body:
            return m.group(0)
        out, i, n = [], 0, 0
        while True:
            j = body.find("//", i)
            if j == -1:
                out.append(body[i:])
                break
            # Skip protocol-relative URLs and scheme separators (https://).
            if j > 0 and body[j - 1] == ":":
                out.append(body[i:j + 2])
                i = j + 2
                continue
            resume = _CODE_RESUME_RE.search(body, j + 2)
            out.append(body[i:j])
            if not resume:
                out.append(body[j:])       # trailing comment — nothing follows
                break
            out.append(body[j:resume.start()] + "\n")
            i = resume.start()
            n += 1
        if not n:
            return m.group(0)
        fixes.append(f"restored {n} line break(s) after // comments")
        return open_tag + "".join(out) + close_tag

    return _SCRIPT_BLOCK_RE.sub(_fix_block, html), fixes
