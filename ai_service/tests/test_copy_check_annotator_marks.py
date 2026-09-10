"""Offline tests for the marks the annotator actually draws on a copy.

Both cases here are regressions that shipped a copy a teacher would reject:

  - the tick was drawn with its tail descending, so head, vertex and tail fell
    on one line and every "tick" rendered as a bare diagonal slash. The student
    saw no approval marks anywhere on 13 pages.
  - a note was written only if a free right-hand COLUMN existed. When the
    detected rows span the full width of the sheet — which is what a densely
    written script produces — that column is never there, and all 36 comments
    on a 13-page copy were silently discarded. Every deduction was left with no
    stated reason anywhere on the paper.

No network. Run:
    cd vacademy_platform/ai_service && PYTHONPATH=.. APP_ENV=local \
        .venv/bin/python tests/test_copy_check_annotator_marks.py
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import fitz
import numpy as np

from ai_service.app.services.copy_check import annotator
from ai_service.app.services.copy_check.annotator import (
    _draw_tick_or_cross,
    _free_band,
    _pen_scale,
    _photo_bounds,
    _place_note,
    _row_ink_span,
)

failures: list[str] = []


def check(label: str, cond: bool, detail: str = "") -> None:
    if cond:
        print(f"  PASS  {label}")
    else:
        failures.append(f"{label}: {detail}")
        print(f"  FAIL  {label} — {detail}")


def _ink_arms(page: "fitz.Page") -> tuple:
    """Vertex of the drawn mark, and how far each side rises above it."""
    pix = page.get_pixmap(dpi=200)
    arr = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)
    ink = (arr[:, :, 0].astype(int) - arr[:, :, 1].astype(int)) > 40
    ys, xs = np.nonzero(ink)
    if ys.size == 0:
        return None
    vy = ys.max()
    vx = xs[ys >= vy - 2].mean()
    left, right = xs < vx - 3, xs > vx + 3
    rise_l = int(vy - ys[left].min()) if left.any() else 0
    rise_r = int(vy - ys[right].min()) if right.any() else 0
    return vx, vy, rise_l, rise_r


def test_tick_tail_rises() -> None:
    print("\n_draw_tick_or_cross — a tick, not a slash")
    for seed in (1, 7, 42):
        doc = fitz.open()
        page = doc.new_page(width=200, height=200)
        _draw_tick_or_cross(page, "tick", 60, 80, 34, (0.85, 0.34, 0.29),
                            random.Random(seed), fitz.Rect(20, 90, 180, 110), 20, 180)
        got = _ink_arms(page)
        check(f"seed {seed}: mark drew ink", got is not None, "no ink")
        if not got:
            continue
        _, _, rise_l, rise_r = got
        # A tick is a V opening upward: BOTH limbs climb away from the vertex.
        # With the tail descending, the right limb measured 3px — flat — which
        # is what made it read as a single diagonal stroke.
        check(f"seed {seed}: short arm rises", rise_l > 4, f"rise {rise_l}px")
        check(f"seed {seed}: tail rises", rise_r > 4, f"rise {rise_r}px")
        check(f"seed {seed}: tail is the longer limb",
              rise_r > rise_l * 1.3, f"left {rise_l}px vs right {rise_r}px")
        doc.close()


def test_free_band_finds_the_gap() -> None:
    print("\n_free_band — the blank paper between answers")
    sheet = fitz.Rect(0, 0, 400, 400)
    written = [fitz.Rect(0, 10, 400, 100), fitz.Rect(0, 250, 400, 300)]
    band = _free_band(sheet, written, 40.0, 110.0)
    check("a gap is found between the two blocks", band is not None, "none")
    if band:
        check("the gap really is blank",
              band[0] >= 100 and band[1] <= 250, f"got {band}")
        check("the gap is tall enough", band[1] - band[0] >= 40, f"got {band}")
    check("a gap shorter than the note is refused",
          _free_band(sheet, [fitz.Rect(0, 10, 400, 380)], 40.0, 20.0) is None,
          "accepted a gap with no room")
    below = _free_band(sheet, written, 30.0, 110.0)
    check("a strip below the marked line is preferred",
          below is not None and below[0] >= 100, f"got {below}")


def test_note_survives_a_full_width_row() -> None:
    print("\n_place_note — a full-width row must not silence the feedback")
    # The drawing helpers read per-document state from module globals; a test
    # that leaves it set makes the next one place marks against another page's
    # geometry. Start from a known state.
    annotator._INK_MAP[0] = None
    annotator._PLACED[0] = None
    annotator._INK_SPAN[0] = None
    annotator._CLIP[0] = None
    doc = fitz.open()
    page = doc.new_page(width=400, height=600)
    sheet = fitz.Rect(10, 10, 390, 590)
    # Exactly the shape that dropped every note: rows spanning the whole sheet,
    # so no right-hand column can ever exist.
    rows = [fitz.Rect(10, 40 + i * 30, 390, 62 + i * 30) for i in range(6)]
    target = rows[2]
    placed = _place_note(page, target, "margin_note",
                         "Risk follows ownership, not possession - s. 26",
                         list(rows), sheet)
    check("the note is written somewhere", placed is not None,
          "dropped — the deduction has no stated reason on the page")
    if placed is not None:
        check("it stays on the paper", sheet.contains(placed), f"at {placed}")
        check("it does not cover the student's writing",
              not any(placed.intersects(r) for r in rows), f"at {placed}")
    doc.close()


def test_pen_scale_normalises_apparent_size() -> None:
    print("\n_pen_scale — a cursive pen must not shrink the note")
    check("an unknown font is left alone", _pen_scale(None) == 1.0,
          f"got {_pen_scale(None)}")
    cursive = "/System/Library/Fonts/Supplemental/SnellRoundhand.ttc"
    if Path(cursive).exists():
        s = _pen_scale(cursive)
        # Snell carries 0.36 of its em in x-height against the print hand's
        # 0.53, so it needs enlarging to read at the same size.
        check("a cursive face is scaled up", 1.2 < s <= 1.6, f"got {s:.3f}")
    else:
        print("  SKIP  cursive face not installed on this machine")


def test_no_ink_leaves_the_paper() -> None:
    print("\n_place_note — a pen cannot write where there is no paper")
    doc = fitz.open()
    page = doc.new_page(width=400, height=600)
    sheet = fitz.Rect(20, 20, 300, 580)      # paper ends well before the page
    rows = [fitz.Rect(20, 40 + i * 30, 300, 62 + i * 30) for i in range(4)]
    # Long enough that a wrap/advance mismatch pushes it past the edge - which
    # is what put comment words on the scanner's white canvas beside the scan.
    _place_note(page, rows[1], "margin_note",
                "Lien is lost once the goods reach the carrier for transmission "
                "to the buyer under s.49(1)(a) of the Act",
                list(rows), sheet)
    pix = page.get_pixmap(dpi=150)
    arr = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)
    ink = (arr[:, :, 0].astype(int) - arr[:, :, 1].astype(int)) > 40
    ys, xs = np.nonzero(ink)
    if xs.size == 0:
        print("  SKIP  nothing was drawn to check")
        doc.close()
        return
    scale = 150.0 / 72.0
    right = xs.max() / scale
    left = xs.min() / scale
    check("no ink past the right edge of the paper", right <= sheet.x1 + 1.0,
          f"ink reaches x={right:.1f}, paper ends at {sheet.x1:.1f}")
    check("no ink left of the paper", left >= sheet.x0 - 1.0,
          f"ink reaches x={left:.1f}, paper starts at {sheet.x0:.1f}")
    check("no ink below the paper", ys.max() / scale <= sheet.y1 + 1.0,
          f"ink reaches y={ys.max() / scale:.1f}, paper ends at {sheet.y1:.1f}")
    doc.close()


def test_photo_bounds_ignores_the_watermark() -> None:
    print("\n_photo_bounds — the scanner's caption is not the photograph")
    doc = fitz.open()
    page = doc.new_page(width=300, height=400)
    # A dense "photograph" in the upper half...
    page.draw_rect(fitz.Rect(30, 20, 270, 250), color=(0.6, 0.6, 0.6),
                   fill=(0.6, 0.6, 0.6))
    # ...and a thin caption line low on the white canvas, as a scanner adds.
    page.insert_text(fitz.Point(90, 380), "Scanned with OKEN Scanner", fontsize=8)
    got = _photo_bounds(page)
    check("a bound is found", got is not None, "none")
    if got:
        # Measuring by any dark pixel drags the bound down to the caption and
        # hands the placer a strip of bare canvas to write on.
        check("the caption is excluded", got.y1 < 300,
              f"bound runs to y={got.y1:.1f}, past the photograph at y=250")


def test_brace_and_summary_survive_validation() -> None:
    print("\nvalidator — the new teacher-pen styles reach the page")
    from ai_service.app.services.copy_check.validator import validate_and_cap

    layout = {"pages": [{"page_id": "P1", "lines": [
        {"line_id": f"L1_{i:02d}", "box": [40, 40 + i * 20, 300, 18]} for i in range(1, 6)
    ], "regions": []}]}
    raw = {
        "marks_awarded": 4.0,
        "extracted_answer": "x",
        "feedback": "ok",
        "confidence": 0.9,
        "criteria_breakdown": [{"criteria_name": "C1", "marks": 4.0, "reason": "r"}],
        "annotations": [
            {"style": "brace", "target": "L1_01", "target_end": "L1_03",
             "page_id": "P1", "text": "Good explanation", "marks": 3.0},
            {"style": "summary", "target": "L1_05", "page_id": "P1",
             "text": "Well written!", "marks": 4.0},
            {"style": "tick", "target": "L1_02", "page_id": "P1", "text": None},
            # a brace whose closing row does not exist must not be drawn: it
            # would bracket writing that has nothing to do with the comment
            {"style": "brace", "target": "L1_01", "target_end": "L1_99",
             "page_id": "P1", "text": "Bad", "marks": 1.0},
        ],
    }
    out = validate_and_cap(raw, {"question_id": "q1", "max_marks": 8}, layout)
    styles = [a["style"] for a in out["annotations"]]
    check("the brace survives", "brace" in styles, f"got {styles}")
    check("the summary survives", "summary" in styles, f"got {styles}")
    braces = [a for a in out["annotations"] if a["style"] == "brace"]
    check("a brace with a bad end row is dropped", len(braces) == 1,
          f"kept {len(braces)}")
    if braces:
        check("the brace keeps its span", braces[0].get("target_end") == "L1_03",
              f"got {braces[0].get('target_end')}")
        # The lone brace is reconciled up to the question total - a margin
        # figure that does not add up to the mark is worse than none.
        check("the brace carries a reconciled figure",
              braces[0].get("marks") == out["marks_awarded"],
              f"got {braces[0].get('marks')} against {out['marks_awarded']}")
    summ = [a for a in out["annotations"] if a["style"] == "summary"]
    if summ:
        check("the summary keeps its total", summ[0].get("marks") == 4.0,
              f"got {summ[0].get('marks')}")


def test_margin_marks_reconcile_with_the_total() -> None:
    print("\nvalidator — the figures in the margin must add up to the mark")
    from ai_service.app.services.copy_check.validator import validate_and_cap

    layout = {"pages": [{"page_id": "P1", "lines": [
        {"line_id": f"L1_{i:02d}", "box": [40, 40 + i * 20, 300, 18]} for i in range(1, 8)
    ], "regions": []}]}
    raw = {
        "marks_awarded": 7.0,
        "extracted_answer": "x", "feedback": "f", "confidence": 0.9,
        "criteria_breakdown": [{"criteria_name": "C1", "marks": 7.0, "reason": "r"}],
        "annotations": [
            # braces that sum to 4.0 against an awarded 7.0 - exactly what the
            # model returned on Q1 of a real script
            {"style": "brace", "target": "L1_01", "target_end": "L1_02",
             "page_id": "P1", "text": "Rule", "marks": 1.0},
            {"style": "brace", "target": "L1_03", "target_end": "L1_04",
             "page_id": "P1", "text": "Application", "marks": 3.0},
            # a summary disagreeing with the total, as seen on Q2 and Q7
            {"style": "summary", "target": "L1_07", "page_id": "P1",
             "text": "Well reasoned!", "marks": 8.25},
        ],
    }
    out = validate_and_cap(raw, {"question_id": "q1", "max_marks": 10}, layout)
    awarded = out["marks_awarded"]
    braces = [a for a in out["annotations"] if a["style"] == "brace"]
    summ = [a for a in out["annotations"] if a["style"] == "summary"]
    total = sum(a["marks"] for a in braces)
    check("brace marks add up to the mark awarded", abs(total - awarded) < 0.26,
          f"braces sum {total} against {awarded}")
    check("the summary carries the mark awarded",
          summ and abs(summ[0]["marks"] - awarded) < 0.01,
          f"summary {summ[0]['marks'] if summ else None} against {awarded}")


def test_comment_ink_stays_legible() -> None:
    print("\n_pen_text — a comment must have letters, not be a red slab")
    doc = fitz.open()
    page = doc.new_page(width=420, height=110)
    from ai_service.app.services.copy_check.annotator import _pen_text

    _pen_text(page, fitz.Point(20, 70), "Risk follows ownership",
              18.0, (0.70, 0.24, 0.28), random.Random(4))
    pix = page.get_pixmap(dpi=200)
    arr = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)
    ink = (arr[:, :, 0].astype(int) - arr[:, :, 1].astype(int)) > 40
    ys, xs = np.nonzero(ink)
    check("something was written", ys.size > 0, "no ink at all")
    if ys.size == 0:
        doc.close()
        return
    box = (ys.max() - ys.min() + 1) * (xs.max() - xs.min() + 1)
    fill = ink.sum() / box
    # A stroked-glyph experiment welded whole comments into solid lumps at 89%
    # fill - measured on the real reference hand, a written phrase sits well
    # under a quarter ink inside its own bounding box.
    check("the comment is not a solid slab", fill < 0.30, f"ink fill {fill:.3f}")

    # Letters must remain separate marks: a legible phrase breaks into many
    # connected components, a fused blob into one or two.
    seen = np.zeros_like(ink, dtype=bool)
    comps = 0
    h, w = ink.shape
    for sy in range(0, h, 2):
        for sx in range(0, w, 2):
            if not ink[sy, sx] or seen[sy, sx]:
                continue
            comps += 1
            stack = [(sy, sx)]
            seen[sy, sx] = True
            while stack:
                cy, cx = stack.pop()
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and ink[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
    check("the phrase has distinct letter shapes", comps >= 6,
          f"only {comps} connected ink components - the letters have fused")
    doc.close()


def test_whole_paper_shape_is_unwrapped() -> None:
    print("\nvalidator — the whole-copy output shape must not grade a zero")
    from ai_service.app.services.copy_check.validator import validate_and_cap

    layout = {"pages": [{"page_id": "P1", "lines": [
        {"line_id": f"L1_{i:02d}", "box": [40, 40 + i * 20, 300, 18]} for i in range(1, 5)
    ], "regions": []}]}
    # The marking guide's output block describes a WHOLE PAPER: a top-level
    # "questions" array. This service grades one question per call, so a model
    # that follows the guide literally wraps its answer - and reading the
    # wrapper for marks_awarded finds nothing and releases a zero.
    wrapped = {"questions": [{
        "question_id": "Q2",
        "maximum_marks": 10,
        "marks_awarded": 6.0,
        "extracted_answer": "x", "feedback": "f", "confidence": 0.9,
        "criteria_breakdown": [{"criteria_name": "C1", "marks": 6.0, "reason": "r"}],
        "annotations": [{"style": "tick", "target": "L1_01", "page_id": "P1"}],
    }]}
    out = validate_and_cap(wrapped, {"question_id": "Q2", "max_marks": 10}, layout)
    check("the wrapped mark is read, not zeroed", out["marks_awarded"] == 6.0,
          f"got {out['marks_awarded']}")
    check("its annotations survive", len(out["annotations"]) == 1,
          f"got {len(out['annotations'])}")


if __name__ == "__main__":
    test_tick_tail_rises()
    test_free_band_finds_the_gap()
    test_note_survives_a_full_width_row()
    test_pen_scale_normalises_apparent_size()
    test_no_ink_leaves_the_paper()
    test_photo_bounds_ignores_the_watermark()
    test_brace_and_summary_survive_validation()
    test_margin_marks_reconcile_with_the_total()
    test_comment_ink_stays_legible()
    test_whole_paper_shape_is_unwrapped()

    print()
    if failures:
        print(f"{len(failures)} FAILURE(S):")
        for f in failures:
            print("  -", f)
        sys.exit(1)
    print("All copy-check annotator mark tests passed.")
