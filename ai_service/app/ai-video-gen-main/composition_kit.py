"""Frame composition vocabulary — where things go on the canvas.

WHY THIS MODULE EXISTS
──────────────────────
Craft review (2026-08-20) traced "the layouts all look the same" to an
asymmetry in the per-shot prompt, not to model capability:

  • Concrete, enforceable guidance about TYPE PROPERTIES — line-height per
    tier, letter-spacing per face, weight deltas, descender padding, scrim
    rules — runs to several hundred lines (`_build_text_hierarchy_block`).
  • Concrete guidance about FRAME COMPOSITION — where the subject sits, what
    the type aligns to, where the negative space goes — was two lines of
    adjectives: "hero asymmetry ... off-axis anchors ... avoid centered
    hero+sub on every shot".
  • Meanwhile the workhorse card's exemplar — the single strongest signal in
    the prompt — is `.full-screen-center` → `.layout-hero` → centered h1 +
    centered sub + centered svg.

The model did what the prompt actually asked: it copied the example and
ignored the adjectives. Every shot came out centre-stacked. This module
replaces the adjectives with a named, concrete, per-shot-assigned vocabulary,
mirroring how `background_treatment` already works — planner declares it,
pipeline defaults it, the per-shot prompt enforces it with real code.

Compositions are ASSIGNED, not hoped for. `assign_compositions()` walks the
shot list and enforces variety structurally (no repeat inside a window, hard
cap on centre-stacked shots) because "aim for a distinct composition every
shot" as prose has been in the preamble for months and did not produce one.

The CSS lives here as a plain module string rather than inline in the
pipeline's preamble f-string. That is deliberate: CSS written directly into
that f-string needs every brace doubled, and getting it wrong fails at
generation time with `NameError: name 'position' is not defined` (cost a
debug cycle on 2026-08-20). Interpolated as a value, braces are inert.
"""

from __future__ import annotations

from typing import Any, Dict, List, Sequence

# ─────────────────────────────────────────────────────────────────────────────
# The vocabulary
# ─────────────────────────────────────────────────────────────────────────────
# Each entry carries:
#   css_class — the grid class in COMPOSITION_CSS. Stored, not derived from
#              the name: center_hero maps to .comp-center, full_bleed_overlay
#              to .comp-full-bleed, and deriving it silently mismatched both.
#   blurb    — one line for the ShotPlanner's menu (it picks by name)
#   contract — concrete skeleton injected into that shot's own prompt. This is
#              the part that actually changes output: it competes with the
#              card exemplar on the card exemplar's own terms (real code).
#   air      — where the negative space is meant to end up. Named so the model
#              treats emptiness as a designed element instead of filling it.
#   suits    — shot types this reads well on (advisory; used for defaults)

COMPOSITIONS: Dict[str, Dict[str, Any]] = {
    "center_hero": {
        "css_class": "comp-center",
        "blurb": (
            "Subject and type stacked on the optical centre. Calm, declarative, "
            "poster-like. The RIGHT choice for a title, a single number, a one-line "
            "thesis — and the WRONG choice three shots in a row."
        ),
        "air": "even margins all round; the frame breathes symmetrically",
        "suits": ("KINETIC_TITLE", "KINETIC_TEXT", "EQUATION_BUILD"),
        "contract": (
            "<div class='comp comp-center'>\n"
            "  <div class='comp-main'>\n"
            "    <span class='tracking-label'>EYEBROW</span>\n"
            "    <h1 class='text-display'>The one idea</h1>\n"
            "    <!-- subject sits under the type, both centred on the optical axis -->\n"
            "  </div>\n"
            "</div>"
        ),
    },
    "left_column": {
        "css_class": "comp-left-column",
        "blurb": (
            "Type held in the left third on a hard vertical grid line; the subject "
            "occupies — and bleeds out of — the right two thirds. The workhorse "
            "editorial frame: reads as designed rather than centred-by-default."
        ),
        "air": "a clean gutter between column and subject; nothing fills it",
        "suits": ("TEXT_DIAGRAM", "IMAGE_SPLIT", "DATA_STORY", "PROCESS_STEPS"),
        "contract": (
            "<div class='comp comp-left-column'>\n"
            "  <div class='comp-col'>\n"
            "    <span class='tracking-label'>SECTION</span>\n"
            "    <h1 class='text-display'>Left-aligned<br>display type</h1>\n"
            "    <p class='text-body'>One supporting line, same left edge.</p>\n"
            "  </div>\n"
            "  <div class='comp-subject'>\n"
            "    <!-- diagram / artifact / media. Allowed to bleed past the right edge. -->\n"
            "  </div>\n"
            "</div>"
        ),
    },
    "right_column": {
        "css_class": "comp-right-column",
        "blurb": (
            "Mirror of left_column — subject left, type in the right third. Use when "
            "the subject reads left-to-right into the type, or to break a run of "
            "left-column shots."
        ),
        "air": "gutter between subject and column",
        "suits": ("TEXT_DIAGRAM", "IMAGE_SPLIT", "ANNOTATION_MAP"),
        "contract": (
            "<div class='comp comp-right-column'>\n"
            "  <div class='comp-subject'><!-- artifact / diagram, may bleed left --></div>\n"
            "  <div class='comp-col'>\n"
            "    <span class='tracking-label'>SECTION</span>\n"
            "    <h1 class='text-display'>Type on<br>the right</h1>\n"
            "  </div>\n"
            "</div>"
        ),
    },
    "bottom_anchor": {
        "css_class": "comp-bottom-anchor",
        "blurb": (
            "Subject fills the upper frame and bleeds off the top edge; type is "
            "anchored to the bottom-left with real air above it. Cinematic — the "
            "bleed implies the subject continues beyond the frame."
        ),
        "air": "between the bottom of the subject and the type block",
        "suits": ("IMAGE_HERO", "VIDEO_HERO", "PRODUCT_HERO", "SOURCE_CLIP"),
        "contract": (
            "<div class='comp comp-bottom-anchor'>\n"
            "  <div class='comp-subject'><!-- bleeds past the top edge, intentionally cropped --></div>\n"
            "  <div class='comp-anchor'>\n"
            "    <span class='tracking-label'>LABEL</span>\n"
            "    <h1 class='text-display'>Anchored low</h1>\n"
            "  </div>\n"
            "</div>"
        ),
    },
    "corner_type": {
        "css_class": "comp-corner-type",
        "blurb": (
            "Most of the frame is deliberately empty. Type occupies one corner; a "
            "small subject sits in the diagonally opposite one. High-confidence, "
            "gallery-like. Needs short copy — it fails with a paragraph."
        ),
        "air": "the whole diagonal between the two anchors — leave it EMPTY",
        "suits": ("KINETIC_TEXT", "LOWER_THIRD", "ANIMATED_ASSET"),
        "contract": (
            "<div class='comp comp-corner-type'>\n"
            "  <div class='comp-anchor-tl'>\n"
            "    <h1 class='text-display'>Short<br>statement</h1>\n"
            "  </div>\n"
            "  <div class='comp-anchor-br'><!-- small subject, ~22% of frame width --></div>\n"
            "  <!-- the diagonal between them stays empty. That emptiness IS the design. -->\n"
            "</div>"
        ),
    },
    "margin_notes": {
        "css_class": "comp-margin-notes",
        "blurb": (
            "A wide main column with a narrow annotation gutter beside it, like a "
            "marked-up page. Annotations enter in the gutter and point INTO the main "
            "column. The strongest frame for a source being examined."
        ),
        "air": "the unused length of the gutter",
        "suits": ("ANNOTATION_MAP", "ARTICLE_FOCUS", "TEXT_DIAGRAM", "IMAGE_SPLIT"),
        "contract": (
            "<div class='comp comp-margin-notes'>\n"
            "  <div class='comp-body'><!-- the artifact / diagram / passage under study --></div>\n"
            "  <aside class='comp-gutter'>\n"
            "    <div class='comp-note'><span class='tracking-label'>01</span> first annotation</div>\n"
            "    <div class='comp-note'><span class='tracking-label'>02</span> second annotation</div>\n"
            "  </aside>\n"
            "  <!-- reveal notes one per narration beat; each may draw a leader line into the body -->\n"
            "</div>"
        ),
    },
    "stacked_offset": {
        "css_class": "comp-stacked-offset",
        "blurb": (
            "Vertical stack aligned to the 38% vertical grid line instead of the "
            "centre. Nearly the cost of a centred stack, but off-axis placement is "
            "most of what separates 'composed' from 'default'."
        ),
        "air": "the wider margin on the open side",
        "suits": ("KINETIC_TEXT", "TEXT_DIAGRAM", "EQUATION_BUILD", "DEVICE_MOCKUP"),
        "contract": (
            "<div class='comp comp-stacked-offset'>\n"
            "  <div class='comp-stack'>\n"
            "    <span class='tracking-label'>EYEBROW</span>\n"
            "    <h1 class='text-display'>Off-axis<br>stack</h1>\n"
            "    <!-- optional supporting element, same left edge -->\n"
            "  </div>\n"
            "</div>"
        ),
    },
    "full_bleed_overlay": {
        "css_class": "comp-full-bleed",
        "blurb": (
            "Media fills the entire frame; type overlays it on a scrim. Reserve for "
            "genuine atmosphere or a real establishing image — over a generic stock "
            "clip it is the most generic frame available."
        ),
        "air": "none by design — the scrim does the separation work",
        "suits": ("VIDEO_HERO", "IMAGE_HERO", "SOURCE_CLIP", "AI_VIDEO_HERO"),
        "contract": (
            "<div class='comp comp-full-bleed'>\n"
            "  <div class='comp-media'><!-- fills frame, object-fit:cover --></div>\n"
            "  <div class='comp-scrim'></div>\n"
            "  <div class='comp-overlay'><h1 class='text-display'>Over the image</h1></div>\n"
            "</div>"
        ),
    },
    "spine": {
        "css_class": "comp-spine",
        "blurb": (
            "A chronology or sequence laid along a spine — vertical or horizontal — "
            "with nodes for each step. Pairs with the .spine / .spine-node staging "
            "classes. For 'first, then, finally' narration."
        ),
        "air": "even intervals along the spine; do not crowd the nodes",
        "suits": ("PROCESS_STEPS", "DATA_STORY", "INFOGRAPHIC_SVG"),
        "contract": (
            "<div class='comp comp-spine'>\n"
            "  <div class='spine'>\n"
            "    <div class='spine-node'><!-- step 1 --></div>\n"
            "    <div class='spine-node'><!-- step 2 --></div>\n"
            "    <div class='spine-node'><!-- step 3 --></div>\n"
            "  </div>\n"
            "  <!-- reveal nodes in narration order; the spine itself may draw on -->\n"
            "</div>"
        ),
    },
    "artifact_study": {
        "css_class": "comp-artifact-study",
        "blurb": (
            "ONE artifact — a supplied plate, a document, a specimen — staged on a "
            "ground, held, pushed into, and annotated on top. The camera and the "
            "marker carry the explanation. One artifact studied for 15s beats three "
            "panels of type."
        ),
        "air": "the ground visible around the artifact; it should sit ON something",
        "suits": ("IMAGE_HERO", "ARTICLE_FOCUS", "ANNOTATION_MAP", "IMAGE_SPLIT"),
        "contract": (
            "<div class='comp comp-artifact-study stage-paper'>\n"
            "  <div class='comp-artifact artifact artifact-laid aged-edge'>\n"
            "    <!-- the artifact itself: uploaded plate preferred over generated art -->\n"
            "  </div>\n"
            "  <!-- annotate ON TOP as the narration cites each part: -->\n"
            "  <!--   .marker-hl over the term being named -->\n"
            "  <!--   a leader line + .tracking-label out to the margin -->\n"
            "  <!-- and push in: scale the wrapper 1.0 -> 1.08 across the hold -->\n"
            "</div>"
        ),
    },
}

COMPOSITION_NAMES = frozenset(COMPOSITIONS)

# Centre-stacked frames are the failure mode, not a banned choice: a title
# card genuinely wants one. Rationed rather than forbidden.
CENTERED = "center_hero"
MAX_CENTERED_FRACTION = 0.25
NO_REPEAT_WINDOW = 3

# Per shot type fallback, used when the planner omits the field. Mirrors
# SHOT_TYPE_BG_TREATMENT_DEFAULT's role for background_treatment.
SHOT_TYPE_COMPOSITION_DEFAULT: Dict[str, str] = {
    "KINETIC_TITLE": "center_hero",
    "KINETIC_TEXT": "stacked_offset",
    "EQUATION_BUILD": "center_hero",
    "TEXT_DIAGRAM": "left_column",
    "IMAGE_SPLIT": "left_column",
    "DATA_STORY": "left_column",
    "PROCESS_STEPS": "spine",
    "INFOGRAPHIC_SVG": "spine",
    "ANNOTATION_MAP": "margin_notes",
    "ARTICLE_FOCUS": "margin_notes",
    "IMAGE_HERO": "bottom_anchor",
    "VIDEO_HERO": "full_bleed_overlay",
    "SOURCE_CLIP": "full_bleed_overlay",
    "AI_VIDEO_HERO": "full_bleed_overlay",
    "PRODUCT_HERO": "bottom_anchor",
    "DEVICE_MOCKUP": "stacked_offset",
    "LOWER_THIRD": "corner_type",
    "ANIMATED_ASSET": "corner_type",
}

# Rotation used when the per-type default would repeat inside the no-repeat
# window. Ordered so consecutive picks differ in where the weight sits.
_ROTATION: Sequence[str] = (
    "left_column",
    "bottom_anchor",
    "margin_notes",
    "right_column",
    "stacked_offset",
    "artifact_study",
    "corner_type",
    "spine",
)


def default_for(shot_type: str) -> str:
    """Composition a shot type falls back to when nothing else is specified."""
    return SHOT_TYPE_COMPOSITION_DEFAULT.get(
        str(shot_type or "").strip().upper(), "left_column"
    )


def normalize(value: Any, shot_type: str, *, allowed: Sequence[str] | None = None) -> str:
    """Coerce a planner-supplied value to a legal composition name.

    Mirrors the `background_treatment` normalizer: unknown or absent values
    fall back to the per-shot-type default rather than failing the run.
    """
    name = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    pool = set(allowed) & COMPOSITION_NAMES if allowed else COMPOSITION_NAMES
    if not pool:
        pool = COMPOSITION_NAMES
    if name in pool:
        return name
    fallback = default_for(shot_type)
    return fallback if fallback in pool else sorted(pool)[0]


def assign_compositions(
    shots: List[Dict[str, Any]],
    *,
    allowed: Sequence[str] | None = None,
) -> List[Dict[str, Any]]:
    """Give every shot a `composition`, enforcing variety structurally.

    Two rules, both there because the aspirational prose version of them has
    been in the preamble for months without producing varied frames:

      1. No composition repeats inside NO_REPEAT_WINDOW consecutive shots.
      2. At most MAX_CENTERED_FRACTION of shots may be centre-stacked.

    A planner-declared composition is honoured unless it breaks rule 1 or 2 —
    the planner sees the whole script and its intent beats a rotation table.
    Media-hero shot types keep full_bleed_overlay when they ask for it; the
    media IS the frame there and reflowing it into a column would fight the
    background contract.
    """
    pool = [c for c in (allowed or sorted(COMPOSITION_NAMES)) if c in COMPOSITION_NAMES]
    if not pool:
        pool = sorted(COMPOSITION_NAMES)

    max_centered = max(1, int(len(shots) * MAX_CENTERED_FRACTION)) if shots else 0
    centered_used = 0
    assigned: List[str] = []

    for idx, shot in enumerate(shots):
        shot_type = str(shot.get("shot_type") or "").strip().upper()
        want = normalize(shot.get("composition"), shot_type, allowed=pool)
        recent = assigned[-NO_REPEAT_WINDOW:]

        # full_bleed_overlay on a media-hero shot is exempt from the repeat
        # rule — the media is the composition and there is no column to move
        # the type into without contradicting background_treatment.
        media_hero = str(shot.get("background_treatment") or "") == "media_hero"
        exempt = want == "full_bleed_overlay" and media_hero

        blocked = (want in recent and not exempt) or (
            want == CENTERED and centered_used >= max_centered
        )
        if blocked:
            alt = next(
                (
                    c
                    for c in _ROTATION
                    if c in pool and c not in recent and c != CENTERED
                ),
                None,
            )
            # Every rotation candidate is in the recent window (very short
            # videos): take anything legal that isn't the immediately prior
            # shot, so we degrade to "not back-to-back" rather than throwing.
            if alt is None:
                alt = next(
                    (c for c in pool if not assigned or c != assigned[-1]), want
                )
            want = alt

        if want == CENTERED:
            centered_used += 1
        assigned.append(want)
        shot["composition"] = want

    return shots


def planner_menu_block() -> str:
    """The composition menu shown to the ShotPlanner, which picks per shot."""
    lines = [
        "**FRAME COMPOSITION — `composition` (per shot, RECOMMENDED)**:\n",
        "Every shot should declare a `composition` field naming WHERE things sit in "
        "the frame. This is the field that decides whether the video looks designed "
        "or looks like slides. Allowed values:\n",
    ]
    for name, spec in COMPOSITIONS.items():
        lines.append(f"- `\"{name}\"` — {spec['blurb']}\n")
    lines.append(
        "**Cross-shot rule: consecutive shots MUST NOT share a composition, and at "
        f"most {int(MAX_CENTERED_FRACTION * 100)}% of shots may use `center_hero`.** "
        "Two shots covering different ideas should not be the same frame recoloured. "
        "The pipeline re-assigns any shot that breaks this, so choosing deliberately "
        "keeps the decision yours rather than a rotation table's.\n"
        "If you omit the field, a conservative default is inferred from `shot_type`.\n\n"
    )
    return "".join(lines)


def contract_block(composition: str, shot_type: str = "") -> str:
    """The per-shot COMPOSITION CONTRACT — concrete skeleton for ONE frame.

    Deliberately shaped like the BACKGROUND CONTRACT (a named value plus the
    exact markup that satisfies it) because that is the pattern the per-shot
    model already reliably follows.
    """
    name = normalize(composition, shot_type)
    spec = COMPOSITIONS[name]
    return (
        "**🖼 COMPOSITION CONTRACT FOR THIS SHOT — "
        f"`{name}`**\n"
        f"{spec['blurb']}\n"
        f"Negative space: {spec['air']}.\n"
        "This composition is ASSIGNED. Build THIS frame — do not fall back to a "
        "centred hero+sub stack, and do not reproduce the shot card's example "
        "layout if it contradicts this one (the card's exemplar is generic; this "
        "is the frame chosen for this shot). The grid classes below are "
        "pre-injected in the global stylesheet:\n"
        "```html\n"
        f"{spec['contract']}\n"
        "```\n"
        "Fill it with this shot's real content and motion. You may add layers, "
        "bleed elements past the frame edge, and nest the staging-kit classes "
        "inside it. What you may NOT do is re-centre everything.\n\n"
    )


# ─────────────────────────────────────────────────────────────────────────────
# CSS — injected into the global stylesheet
# ─────────────────────────────────────────────────────────────────────────────
# 12-column × 8-row grid so placements land on shared lines across shots
# (that shared alignment is what makes a set of frames feel like one film).
# Interpolated as a VALUE into the preamble f-string, so single braces here
# are correct and intentional — see the module docstring.

COMPOSITION_CSS = """
/* --- FRAME COMPOSITION GRID ---------------------------------------
   Text columns are align-items:stretch, never flex-start. With flex-start a
   heading is shrink-to-fit: its box hugs the text, so a phrase that WOULD fit
   the column wraps anyway — and because the box tracks the text, shrinking the
   font shrinks the box too and the overflow never clears. That is what put
   "TRIGEMIN / AL" on two lines in a 562px column that had room for it.
   Named frames. Every composition is a 12x8 grid so type and subjects
   land on the same lines from shot to shot. Placement is the design;
   .comp-center is ONE option, not the default. */
.comp {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: repeat(8, 1fr);
  padding: var(--spacing-safe-area, 5%);
  box-sizing: border-box;
}
.comp > * { min-width: 0; min-height: 0; }

/* centred — calm and declarative; rationed by assign_compositions() */
.comp-center .comp-main {
  grid-column: 3 / 11; grid-row: 3 / 7;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center;
  gap: 0.6em;
}

/* type in a column on one side, subject bleeding off the other */
.comp-left-column .comp-col {
  grid-column: 1 / 5; grid-row: 2 / 8;
  display: flex; flex-direction: column;
  justify-content: center; align-items: stretch; text-align: left;
  gap: 0.5em; z-index: 2;
}
.comp-left-column .comp-subject {
  grid-column: 6 / 14; grid-row: 1 / 9;
  display: flex; align-items: center; justify-content: flex-start;
  overflow: visible;
}
.comp-right-column .comp-col {
  grid-column: 9 / 13; grid-row: 2 / 8;
  display: flex; flex-direction: column;
  justify-content: center; align-items: stretch; text-align: left;
  gap: 0.5em; z-index: 2;
}
.comp-right-column .comp-subject {
  grid-column: 1 / 8; grid-row: 1 / 9;
  display: flex; align-items: center; justify-content: flex-end;
  overflow: visible;
}

/* subject bleeds off the top, type anchored low-left */
.comp-bottom-anchor .comp-subject {
  grid-column: 1 / 13; grid-row: 1 / 7;
  display: flex; align-items: flex-end; justify-content: center;
  overflow: visible;
}
.comp-bottom-anchor .comp-anchor {
  grid-column: 1 / 9; grid-row: 7 / 9;
  display: flex; flex-direction: column;
  justify-content: flex-end; align-items: stretch; text-align: left;
  gap: 0.35em; z-index: 2;
}

/* two opposed corners, empty diagonal between them */
.comp-corner-type .comp-anchor-tl {
  grid-column: 1 / 7; grid-row: 1 / 4;
  display: flex; flex-direction: column;
  justify-content: flex-start; align-items: stretch; text-align: left;
}
.comp-corner-type .comp-anchor-br {
  grid-column: 9 / 13; grid-row: 6 / 9;
  display: flex; align-items: flex-end; justify-content: flex-end;
}

/* marked-up page: wide body, narrow annotation gutter */
.comp-margin-notes .comp-body {
  grid-column: 1 / 9; grid-row: 1 / 9;
  display: flex; align-items: center; justify-content: center;
  position: relative;
}
.comp-margin-notes .comp-gutter {
  grid-column: 9 / 13; grid-row: 1 / 9;
  display: flex; flex-direction: column;
  justify-content: center; align-items: stretch; text-align: left;
  gap: 1.2em; padding-left: 1.2em;
  border-left: 1px solid color-mix(in srgb, var(--brand-text, #222) 22%, transparent);
}
.comp-margin-notes .comp-note {
  display: flex; flex-direction: column; gap: 0.25em;
  font-size: var(--font-scale-label, 0.95rem); line-height: 1.35;
  text-align: left;
}

/* off-axis stack on the 38% line */
.comp-stacked-offset .comp-stack {
  grid-column: 2 / 9; grid-row: 3 / 8;
  display: flex; flex-direction: column;
  justify-content: center; align-items: stretch; text-align: left;
  gap: 0.5em;
}

/* media fills the frame, type over a scrim */
.comp-full-bleed .comp-media {
  grid-column: 1 / 13; grid-row: 1 / 9;
  overflow: hidden;
}
.comp-full-bleed .comp-media > img,
.comp-full-bleed .comp-media > video {
  width: 100%; height: 100%; object-fit: cover;
}
.comp-full-bleed .comp-scrim {
  grid-column: 1 / 13; grid-row: 1 / 9;
  background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 58%);
  pointer-events: none;
}
.comp-full-bleed .comp-overlay {
  grid-column: 1 / 10; grid-row: 6 / 9;
  display: flex; flex-direction: column;
  justify-content: flex-end; align-items: stretch; text-align: left;
  gap: 0.35em; z-index: 3;
}

/* chronology / sequence along a spine */
.comp-spine .spine {
  grid-column: 2 / 12; grid-row: 3 / 7;
  display: flex; align-items: center; justify-content: space-between;
}

/* one artifact, staged and annotated */
.comp-artifact-study .comp-artifact {
  grid-column: 3 / 11; grid-row: 2 / 8;
  display: flex; align-items: center; justify-content: center;
  position: relative;
}
"""


__all__ = [
    "COMPOSITIONS",
    "COMPOSITION_NAMES",
    "COMPOSITION_CSS",
    "SHOT_TYPE_COMPOSITION_DEFAULT",
    "MAX_CENTERED_FRACTION",
    "NO_REPEAT_WINDOW",
    "default_for",
    "normalize",
    "assign_compositions",
    "planner_menu_block",
    "contract_block",
]
