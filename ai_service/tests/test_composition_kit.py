"""Frame-composition vocabulary and the variety guarantees around it.

Context: "the layouts all look the same" was traced to the per-shot prompt
carrying hundreds of concrete lines about type properties and two lines of
adjectives about frame composition, while the workhorse card exemplar was a
centred hero+sub stack. composition_kit replaces the adjectives with an
assigned, concrete vocabulary. These tests pin the parts that can regress
silently: the variety rules, the fallback behaviour, and the fact that the
contract actually reaches the prompt.
"""

import os
import re
import sys

sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "..", "app", "ai-video-gen-main")
)

import composition_kit as ck  # noqa: E402


def _shots(*types):
    return [{"shot_type": t} for t in types]


# ── the vocabulary itself ───────────────────────────────────────────────────

def test_every_composition_has_a_contract_and_a_css_class():
    """A composition the model can name but not build is worse than none —
    it would be told to use a frame whose classes don't exist."""
    for name, spec in ck.COMPOSITIONS.items():
        assert spec["blurb"].strip(), name
        assert spec["air"].strip(), name
        assert spec["contract"].strip(), name
        css_class = spec["css_class"]
        assert css_class in spec["contract"], f"{name} contract lacks {css_class}"
        assert "." + css_class in ck.COMPOSITION_CSS, f"{name} has no CSS: {css_class}"


def test_css_has_no_negative_grid_lines():
    """`grid-column: -1 / 8` on a 12-col grid resolves to lines 8..13 — the
    opposite side from the one intended. Two of these shipped in the first
    draft of this module and put the subject on the wrong side of the frame."""
    for prop, value in re.findall(r"(grid-(?:column|row)):\s*([^;]+);", ck.COMPOSITION_CSS):
        assert not value.strip().startswith("-"), f"{prop}: {value}"
        assert "/ -" not in value, f"{prop}: {value}"


def test_every_shot_type_default_is_a_real_composition():
    for shot_type, comp in ck.SHOT_TYPE_COMPOSITION_DEFAULT.items():
        assert comp in ck.COMPOSITION_NAMES, f"{shot_type} -> {comp}"


# ── normalization: mirrors background_treatment's contract ─────────────────

def test_unknown_and_absent_values_fall_back_per_shot_type():
    assert ck.normalize("", "PROCESS_STEPS") == "spine"
    assert ck.normalize(None, "ANNOTATION_MAP") == "margin_notes"
    assert ck.normalize("not_a_composition", "TEXT_DIAGRAM") == "left_column"


def test_normalize_accepts_hyphen_and_space_spellings():
    """The planner is an LLM; it will write margin-notes and 'margin notes'."""
    assert ck.normalize("margin-notes", "TEXT_DIAGRAM") == "margin_notes"
    assert ck.normalize("Margin Notes", "TEXT_DIAGRAM") == "margin_notes"


def test_normalize_respects_an_allowed_subset():
    """Configurability: an identity may restrict the vocabulary. A value
    outside the subset must not survive just because it is globally legal."""
    got = ck.normalize("corner_type", "TEXT_DIAGRAM", allowed=["left_column", "spine"])
    assert got in ("left_column", "spine")


# ── the variety guarantees (the actual point of the module) ────────────────

def test_no_composition_repeats_back_to_back():
    shots = ck.assign_compositions(_shots(*(["TEXT_DIAGRAM"] * 8)))
    got = [s["composition"] for s in shots]
    assert all(a != b for a, b in zip(got, got[1:])), got


def test_no_repeat_inside_the_window():
    shots = ck.assign_compositions(_shots(*(["TEXT_DIAGRAM"] * 12)))
    got = [s["composition"] for s in shots]
    for i in range(len(got)):
        window = got[max(0, i - ck.NO_REPEAT_WINDOW) : i]
        assert got[i] not in window, f"{got[i]} repeats at {i}: {got}"


def test_centred_frames_are_rationed_not_banned():
    """center_hero is right for a title card and wrong for a whole video.
    A deck of ten shots all asking for it must not get it ten times."""
    shots = [{"shot_type": "KINETIC_TITLE", "composition": "center_hero"} for _ in range(10)]
    got = [s["composition"] for s in ck.assign_compositions(shots)]
    assert got.count("center_hero") <= max(1, int(10 * ck.MAX_CENTERED_FRACTION))
    assert "center_hero" in got, "rationed, not banned"


def test_planner_intent_is_honoured_when_it_breaks_no_rule():
    """The planner sees the whole script; its choice beats the rotation table
    whenever it is legal."""
    shots = [
        {"shot_type": "TEXT_DIAGRAM", "composition": "artifact_study"},
        {"shot_type": "TEXT_DIAGRAM", "composition": "margin_notes"},
        {"shot_type": "TEXT_DIAGRAM", "composition": "corner_type"},
    ]
    got = [s["composition"] for s in ck.assign_compositions(shots)]
    assert got == ["artifact_study", "margin_notes", "corner_type"]


def test_media_hero_shots_keep_full_bleed_back_to_back():
    """On a media_hero shot the media IS the frame; reflowing consecutive ones
    into columns would contradict background_treatment."""
    shots = [
        {"shot_type": "VIDEO_HERO", "background_treatment": "media_hero",
         "composition": "full_bleed_overlay"},
        {"shot_type": "IMAGE_HERO", "background_treatment": "media_hero",
         "composition": "full_bleed_overlay"},
    ]
    got = [s["composition"] for s in ck.assign_compositions(shots)]
    assert got == ["full_bleed_overlay", "full_bleed_overlay"]


def test_assignment_is_idempotent():
    """normalize_shot_plan runs on the resume path too — a second pass must
    not reshuffle every frame out from under a half-rendered run."""
    shots = ck.assign_compositions(
        _shots("KINETIC_TITLE", "TEXT_DIAGRAM", "IMAGE_HERO", "PROCESS_STEPS", "TEXT_DIAGRAM")
    )
    first = [s["composition"] for s in shots]
    again = [s["composition"] for s in ck.assign_compositions(shots)]
    assert first == again


def test_short_videos_do_not_crash_when_the_pool_is_exhausted():
    """With a 1-composition pool every candidate is inside the window. The
    rule must degrade, not raise."""
    shots = ck.assign_compositions(_shots("TEXT_DIAGRAM", "TEXT_DIAGRAM"),
                                   allowed=["left_column"])
    assert [s["composition"] for s in shots] == ["left_column", "left_column"]


def test_empty_shot_list_is_fine():
    assert ck.assign_compositions([]) == []


# ── the prompt blocks ──────────────────────────────────────────────────────

def test_planner_menu_lists_every_composition():
    menu = ck.planner_menu_block()
    for name in ck.COMPOSITIONS:
        assert f'`"{name}"`' in menu, name
    assert "MUST NOT share a composition" in menu


def test_contract_block_carries_real_markup():
    block = ck.contract_block("margin_notes", "TEXT_DIAGRAM")
    assert "comp-margin-notes" in block
    assert "comp-gutter" in block
    # It has to outrank the card exemplar explicitly, not just coexist with it.
    assert "do not reproduce the shot card's example layout" in block


def test_contract_block_never_raises_on_junk():
    """A malformed planner value must not take down shot generation."""
    assert "COMPOSITION CONTRACT" in ck.contract_block("nonsense", "TEXT_DIAGRAM")
    assert "COMPOSITION CONTRACT" in ck.contract_block("", "")


# ── integration: does it actually reach the prompt? ────────────────────────

def test_composition_reaches_the_per_shot_prompt():
    from shot_type_cards import build_per_shot_system_prompt

    with_comp = build_per_shot_system_prompt(
        "TEXT_DIAGRAM", aspirational=True, composition="margin_notes"
    )
    assert "COMPOSITION CONTRACT" in with_comp
    assert "comp-margin-notes" in with_comp
    # Recency matters: the contract must be read AFTER the centred exemplar.
    assert with_comp.index("COMPOSITION CONTRACT") > with_comp.index("full-screen-center")


def test_prompt_is_unchanged_when_no_composition_is_assigned():
    """Legacy/v2 paths pass nothing; they must not get a stray block."""
    from shot_type_cards import build_per_shot_system_prompt

    assert "COMPOSITION CONTRACT" not in build_per_shot_system_prompt(
        "TEXT_DIAGRAM", aspirational=True
    )


def test_shot_planner_emits_a_composition_for_every_shot():
    from shot_planner import normalize_shot_plan

    plan = normalize_shot_plan({
        "shots": [
            {"shot_type": "KINETIC_TITLE", "narration_brief": "Opening line."},
            {"shot_type": "TEXT_DIAGRAM", "narration_brief": "First idea."},
            {"shot_type": "TEXT_DIAGRAM", "narration_brief": "Second idea."},
            {"shot_type": "TEXT_DIAGRAM", "narration_brief": "Third idea."},
        ]
    })
    comps = [s["composition"] for s in plan["shots"]]
    assert all(c in ck.COMPOSITION_NAMES for c in comps), comps
    assert all(a != b for a, b in zip(comps, comps[1:])), comps


def test_planner_system_prompt_advertises_the_field():
    from shot_planner import SHOT_PLANNER_SYSTEM_PROMPT

    assert "FRAME COMPOSITION" in SHOT_PLANNER_SYSTEM_PROMPT
    assert "`\"margin_notes\"`" in SHOT_PLANNER_SYSTEM_PROMPT
