"""Undefined `var(--x)` with no fallback voids the whole declaration, so a
font-size collapses to the inherited ~16px and a padding to 0. The repair
pass must give every survivor a fallback of the RIGHT KIND — handing
`font-size` a font family leaves it exactly as broken."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app" / "ai-video-gen-main"))

from html_contract_repair import (  # noqa: E402
    repair_dark_bed_text,
    repair_undefined_css_vars,
)

_SIZE_STARTS = ("clamp(", "calc(", "min(", "max(")


def _repair_value(css: str) -> str:
    out, _ = repair_undefined_css_vars(f'<div style="{css}"></div>')
    return out[out.index('style="') + 7 : out.index('"></div>')]


def test_defined_vars_are_left_alone():
    html = "<style>:root{--brand-text:#0f172a}.a{color:var(--brand-text)}</style>"
    out, fixed = repair_undefined_css_vars(html)
    assert fixed == []
    assert out == html


def test_font_sizes_always_get_a_size():
    for token in ("--font-scale-h1", "--font-scale-label", "--font-scale-micro",
                  "--font-title-size", "--hero-type", "--whatever"):
        value = _repair_value(f"font-size:var({token})")
        fallback = value.split(",", 1)[1].strip().rstrip(")")
        assert fallback.startswith(_SIZE_STARTS) or fallback.endswith(("px", "rem")), (
            f"{token} got a non-size fallback: {value}"
        )


def test_font_families_never_get_a_size():
    value = _repair_value("font-family:var(--font-scale-h1)")
    assert "clamp(" not in value.split(",", 1)[1]


def test_spacing_scale_is_respected():
    assert "8px" in _repair_value("padding:var(--spacing-xs)")
    assert "96px" in _repair_value("padding:var(--spacing-2xl)")
    assert "6%" in _repair_value("padding:var(--spacing-safe_area)")


def test_repair_is_idempotent():
    once, first = repair_undefined_css_vars('<div style="padding:var(--spacing-lg)"></div>')
    twice, second = repair_undefined_css_vars(once)
    assert first and second == [] and twice == once


def test_dark_bed_only_fires_with_a_dark_media_bed():
    dark = ('<style>#shot-root{--text:var(--brand-text, #ffffff)}'
            '.o{background:linear-gradient(90deg,rgba(0,0,0,0.85),transparent)}</style>'
            '<video src="x.mp4"></video>')
    out, fixes = repair_dark_bed_text(dark)
    assert fixes and "--text:#ffffff" in out.replace(" ", "")

    light = '<style>#shot-root{--text:var(--brand-text, #ffffff)}</style><div>copy</div>'
    assert repair_dark_bed_text(light)[1] == []


def test_inline_flex_row_is_pinned_only_when_the_content_implies_a_row():
    from html_contract_repair import repair_inline_flex_direction

    # Model authored its own row: restated display:flex inline, children grow.
    row = ("<div class='process-flow' style='display:flex;align-items:flex-start'>"
           "<div style='flex:1'>a</div><div style='flex:1'>b</div></div>")
    out, fixes = repair_inline_flex_direction(row)
    assert fixes and "flex-direction:row" in out
    assert repair_inline_flex_direction(out)[1] == []          # idempotent

    # An explicit inline direction is the author's word — never touch it.
    col = ("<div class='stage-drift' style='display:flex;flex-direction:column'>"
           "<div style='flex:1'>x</div></div>")
    assert repair_inline_flex_direction(col)[1] == []

    # Helper class used as documented (no inline display) keeps its own layout.
    plain = "<div class='process-flow'><div class='process-node'>a</div></div>"
    assert repair_inline_flex_direction(plain)[1] == []

    # No growing child -> no evidence of a row -> leave it alone.
    assert repair_inline_flex_direction("<div style='display:flex'><div>a</div></div>")[1] == []


def test_helper_imposed_direction_is_neutralised_without_a_growing_child():
    """The class-based trigger: a helper known to impose flex-direction loses
    to an element that authored its own container, even when no child grows."""
    from html_contract_repair import repair_inline_flex_direction

    html = ("<div class='process-flow' style='display:flex;align-items:flex-start'>"
            "<div>one</div><div>two</div></div>")
    out, fixes = repair_inline_flex_direction(html)
    assert fixes and "flex-direction:row" in out


def test_helper_max_width_cap_lifts_only_when_the_shot_sized_itself():
    from html_contract_repair import repair_inline_flex_direction

    sized = "<div class='process-flow' style='display:flex;width:100%'>x</div>"
    out, fixes = repair_inline_flex_direction(sized)
    assert "max-width:none" in out, fixes

    unsized = "<div class='process-flow' style='display:flex'>x</div>"
    assert "max-width:none" not in repair_inline_flex_direction(unsized)[0]


def test_author_declared_properties_are_never_touched():
    from html_contract_repair import repair_inline_flex_direction

    html = ("<div class='process-flow' style='display:flex;flex-direction:column;"
            "width:50%;max-width:400px'><div style='flex:1'>a</div></div>")
    out, fixes = repair_inline_flex_direction(html)
    assert fixes == [] and out == html


def test_unrelated_classes_and_plain_elements_are_untouched():
    from html_contract_repair import repair_inline_flex_direction

    html = "<div class='some-card' style='display:flex'><div>a</div></div>"
    assert repair_inline_flex_direction(html)[1] == []


def test_repair_is_idempotent_across_both_triggers():
    from html_contract_repair import repair_inline_flex_direction

    html = ("<div class='process-flow' style='display:flex;width:100%'>"
            "<div style='flex:1'>a</div></div>")
    once, first = repair_inline_flex_direction(html)
    twice, second = repair_inline_flex_direction(once)
    assert first and second == [] and twice == once
