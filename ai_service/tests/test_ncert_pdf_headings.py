"""The NCERT loader reads section headings from the PDF's own typography, so a
curriculum load makes no model call at all (the LLM heading quoter was the
only paid step — about a cent a chapter, ~$10 for Classes 6–12).

The PDF built here reproduces what real NCERT chapters do: display type
drawn three times with sub-point offsets (outline + fill), a heading wrapped
over two lines, an inline bold heading that continues in body type, an
"Activity 1.1" box label, and a two-column page. Verified against real
chapters (Class 10 Science/Maths/SS/English, Class 11 Chemistry) on
2026-09-21 before this synthetic version was written.
"""
import sys
from pathlib import Path

import pymupdf
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "curriculum"))
from load_ncert import pdf_headings  # noqa: E402

BODY = 10
HEAD = 14


def _body(page, y, text, x=60):
    page.insert_text((x, y), text, fontsize=BODY, fontname="helv")


def _display(page, y, text, x=60, copies=3):
    """Outlined display type: the same string drawn several times, offset."""
    for i in range(copies):
        page.insert_text((x + 0.3 * i, y - 0.2 * i), text, fontsize=HEAD, fontname="hebo")


@pytest.fixture(scope="module")
def chapter() -> bytes:
    doc = pymupdf.open()
    # -- page 1: title, sections, box label ------------------------------------
    p = doc.new_page(width=595, height=842)
    _display(p, 80, "CHEMICAL REACTIONS", copies=1)
    _display(p, 100, "AND EQUATIONS", copies=1)
    _body(p, 140, "Consider the following situations of daily life and think what happens")
    _body(p, 154, "when a milk is left at room temperature during summers.")
    p.insert_text((60, 180), "Activity 1.1", fontsize=HEAD, fontname="hebo")
    _body(p, 196, "Take a small amount of calcium oxide in a beaker.")
    _display(p, 230, "1.1 CHEMICAL EQUATIONS")
    _body(p, 250, "The word-equation for the above reaction would be:")
    for k in range(10):
        _body(p, 270 + 14 * k, "Magnesium + Oxygen gives Magnesium oxide, and so the reaction goes on")
    p.insert_text((60, 430), "1.1.1 Writing a Chemical Equation", fontsize=BODY + 1, fontname="hebo")
    _body(p, 446, "Is there any other shorter way for representing chemical equations?")
    # -- page 2: wrapped display heading + inline bold heading -------------------
    p = doc.new_page(width=595, height=842)
    _display(p, 80, "1.2 TYPES OF CHEMICAL REACTIONS AND")
    _display(p, 98, "THEIR CLASSIFICATION")
    for k in range(12):
        _body(p, 120 + 14 * k, "We have learnt in Class IX that during a chemical reaction atoms of")
    p.insert_text((60, 300), "1.2.1 Combination Reaction", fontsize=BODY, fontname="hebo")
    p.insert_text((190, 300), ": In this reaction, calcium oxide and water", fontsize=BODY, fontname="helv")
    # -- page 3: two columns --------------------------------------------------
    p = doc.new_page(width=595, height=842)
    for k in range(14):
        _body(p, 80 + 14 * k, "Left column body text that stops before", x=50)
        _body(p, 80 + 14 * k, "right column body text of the page", x=310)
    p.insert_text((50, 300), "1.3.2 Rancidity", fontsize=BODY + 1, fontname="hebo")
    p.insert_text((310, 120), "1.3.1 Corrosion", fontsize=BODY + 1, fontname="hebo")
    return doc.tobytes()


def test_headings_are_read_once_in_book_order_without_box_labels(chapter):
    got = pdf_headings(chapter, title="Chemical Reactions and Equations")
    assert got == [
        "1.1 Chemical Equations",
        "1.1.1 Writing a Chemical Equation",
        "1.2 Types of Chemical Reactions and their Classification",
        "1.2.1 Combination Reaction",
        "1.3.2 Rancidity",   # left column first…
        "1.3.1 Corrosion",   # …then the right, as the page is read
    ]


def test_chapter_title_is_not_a_heading(chapter):
    got = pdf_headings(chapter, title="Chemical Reactions and Equations")
    assert not any("Chemical Reactions" == h or h.endswith("Equations") and "1.1" not in h for h in got)


def test_a_chapter_without_sections_yields_nothing():
    doc = pymupdf.open()
    p = doc.new_page()
    _display(p, 80, "DUST OF SNOW", copies=1)
    for k in range(8):
        _body(p, 120 + 14 * k, "The way a crow shook down on me the dust of snow from a hemlock tree")
    assert pdf_headings(doc.tobytes(), title="Dust of Snow") == []
