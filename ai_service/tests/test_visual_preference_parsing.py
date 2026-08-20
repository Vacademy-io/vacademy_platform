"""A brief that BANS stock footage must not resolve to stock_video: high.

The scanner reads the words immediately before a family term to decide
polarity. Two shapes defeated that and turned an explicit prohibition into a
request:

  "Prefer annotated diagrams and motion graphics OVER stock footage"
      — the disfavoured side is named after a comparative, not a negation.
  "no smiling-doctor stock"
      — the negation is separated from the term by an adjective.

Both appeared in one real brief, which resolved to stock_video: high and would
have pulled the b-roll the brief spent two sentences rejecting.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.intent_router_service import (  # noqa: E402
    extract_visual_preferences_from_text as extract,
)

_REAL_BRIEF = (
    "Prefer annotated diagrams and motion graphics over stock footage. "
    "No generic hospital or office b-roll, no smiling-doctor stock."
)


def test_real_brief_rejects_stock_and_keeps_the_positive_families():
    prefs = extract(_REAL_BRIEF)
    assert prefs["stock_video"] == "no"
    assert prefs["svg_illustrated"] == "high"
    assert prefs["motion_graphics"] == "high"


def test_comparative_forms_name_the_disfavoured_side():
    for text in (
        "motion graphics instead of stock video",
        "illustrations rather than stock footage",
        "diagrams in place of stock video",
        "animation as opposed to stock footage",
    ):
        assert extract(text)["stock_video"] == "no", text


def test_negation_separated_by_adjectives_still_counts():
    for text in (
        "no smiling-doctor stock",
        "no generic corporate stock footage",
        "avoid cheesy stock video",
    ):
        assert extract(text)["stock_video"] == "no", text


def test_genuine_requests_still_read_as_high():
    for text in (
        "use stock footage of a city",
        "please use real footage throughout",
        "stock video for the establishing shots",
    ):
        assert extract(text)["stock_video"] == "high", text


def test_mixed_intent_keeps_high():
    # An explicit ask plus a narrower carve-out is still an ask.
    assert extract("use stock video but no smiling-doctor stock")["stock_video"] == "high"
