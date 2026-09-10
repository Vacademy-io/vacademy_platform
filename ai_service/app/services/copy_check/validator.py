"""LLM JSON validation + marks cap + annotation target resolution.

Three jobs:
  1. Coerce loose LLM output into the QuestionVerdict shape (with safe defaults).
  2. Cap marks_awarded to question.max_marks and proportionally scale the
     criteria_breakdown so the sum still equals marks_awarded.
  3. Drop annotations whose `target` doesn't match any line_id/region_id
     in the layout_map — those would render to nowhere on the FE overlay.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


VALID_STYLES = {"tick", "cross", "circle", "strike", "underline", "margin_note",
                "region_note", "brace", "summary",
                # the marking vocabulary the current guide asks for
                "score", "feedback", "deduction_reason"}
# Styles that are really a teacher's written comment. They differ in intent -
# praise vs the reason a mark was lost - but they are drawn the same way, and
# keeping them distinct upstream lets the placer give a deduction priority over
# praise when space is short.
NOTE_STYLES = {"margin_note", "region_note", "feedback", "deduction_reason"}
# Styles that carry a mark figure of their own. A brace shows what a block of
# the answer earned; a summary carries the question total at the foot of it.
MARK_BEARING_STYLES = {"brace", "summary", "score"}


def _layout_target_index(layout_map: dict[str, Any]) -> dict[str, str]:
    """{target_id: page_id} for every line and region. Used to drop fictitious annotations."""
    idx: dict[str, str] = {}
    for page in layout_map.get("pages", []):
        page_id = page["page_id"]
        for line in page.get("lines", []):
            idx[line["line_id"]] = page_id
        for region in page.get("regions", []):
            idx[region["region_id"]] = page_id
    return idx


def _unwrap_questions(raw: dict[str, Any], question: dict[str, Any]) -> dict[str, Any]:
    """Accept the whole-paper shape as well as the single-question one.

    The marking guide's output block is written for a full copy - a top-level
    `questions` array - while this service grades one question per call. A
    model that follows the guide literally therefore returns its answer wrapped
    in that array, and reading `marks_awarded` off the wrapper finds nothing
    and silently grades the student zero. Take the entry for this question when
    it is there, else the only entry.
    """
    items = raw.get("questions")
    if not isinstance(items, list) or not items:
        return raw
    wanted = str(question.get("paper_label") or question.get("question_id") or "")
    for item in items:
        if not isinstance(item, dict):
            continue
        if wanted and str(item.get("question_id") or "") == wanted:
            return item
    first = items[0]
    return first if isinstance(first, dict) else raw


def validate_and_cap(
    raw: dict[str, Any],
    question: dict[str, Any],
    layout_map: dict[str, Any],
) -> dict[str, Any]:
    raw = _unwrap_questions(raw, question)
    # Do NOT silently grade against a fictitious denominator. This used to
    # default to 10 whenever max_marks was missing, which quietly misgraded
    # every student of a mis-configured question. A question with no valid max
    # is a configuration problem: raise so the orchestrator routes it to manual
    # review instead of releasing a wrong mark.
    try:
        max_marks = float(question.get("max_marks"))
    except (TypeError, ValueError):
        max_marks = 0.0
    if max_marks <= 0:
        raise ValueError(
            f"question {question.get('question_id')} has no valid max_marks "
            f"({question.get('max_marks')!r})"
        )

    marks_awarded = float(raw.get("marks_awarded") or 0)
    breakdown_raw = raw.get("criteria_breakdown") or []
    breakdown: list[dict[str, Any]] = []
    for item in breakdown_raw:
        breakdown.append({
            "criteria_name": str(item.get("criteria_name") or "Criterion"),
            "marks": float(item.get("marks") or 0),
            "reason": str(item.get("reason") or ""),
        })

    # Clamp to [0, max]. LLMs occasionally emit negative marks; floor them.
    if marks_awarded < 0:
        logger.warning(
            "Q%s: LLM awarded negative %.2f — flooring to 0",
            question["question_id"], marks_awarded,
        )
        marks_awarded = 0.0
        for it in breakdown:
            it["marks"] = 0.0

    # Cap + proportionally scale breakdown if total exceeds max_marks.
    if marks_awarded > max_marks:
        logger.warning(
            "Q%s: LLM awarded %.2f > max %.2f — scaling down",
            question["question_id"], marks_awarded, max_marks,
        )
        if marks_awarded > 0 and breakdown:
            factor = max_marks / marks_awarded
            for it in breakdown:
                it["marks"] = round(it["marks"] * factor, 2)
        marks_awarded = max_marks
    else:
        # Under max, reconcile a breakdown that doesn't add up to the awarded
        # total so the teacher isn't shown per-criterion marks that contradict
        # the headline mark. marks_awarded stays authoritative (it feeds totals).
        bsum = round(sum(it["marks"] for it in breakdown), 2)
        if breakdown and bsum > 0 and abs(bsum - marks_awarded) > 0.01:
            logger.info(
                "Q%s: breakdown sum %.2f != awarded %.2f — rescaling breakdown",
                question["question_id"], bsum, marks_awarded,
            )
            factor = marks_awarded / bsum
            for it in breakdown:
                it["marks"] = round(it["marks"] * factor, 2)

    # Filter annotations to those whose target actually exists in the layout.
    idx = _layout_target_index(layout_map)
    valid_annotations: list[dict[str, Any]] = []
    dropped = 0
    for ann in raw.get("annotations") or []:
        target = ann.get("target")
        style = ann.get("style")
        if not target or style not in VALID_STYLES:
            dropped += 1
            continue
        page_id = idx.get(target)
        if not page_id:
            dropped += 1
            continue
        entry = {
            "target": target,
            "page_id": page_id,
            "style": style,
            "text": ann.get("text"),
        }
        # A brace spans a block, so it needs its closing row - and it is only
        # meaningful if that row is real and on the same page, at or after the
        # opening one. A brace that runs backwards or off the page would be
        # drawn across unrelated writing.
        if style == "brace":
            end = ann.get("target_end")
            if not end or idx.get(end) != page_id:
                dropped += 1
                continue
            entry["target_end"] = end
        if style in MARK_BEARING_STYLES:
            try:
                entry["marks"] = round(float(ann.get("marks")), 2)
            except (TypeError, ValueError):
                # A brace or summary with no readable figure is just a note.
                entry["marks"] = None
        valid_annotations.append(entry)
    if dropped:
        logger.info("Q%s: dropped %d annotations with no matching target", question["question_id"], dropped)

    # Quantise to half marks. No examiner writes 4.4/10 on a script - marks are
    # awarded in halves - and a figure like that is an immediate tell that the
    # paper was machine-marked. Done last, after capping and reconciliation, so
    # the breakdown is scaled against the number actually awarded.
    quantised = round(marks_awarded * 2.0) / 2.0
    quantised = min(quantised, max_marks)
    if breakdown and abs(quantised - marks_awarded) > 0.001 and marks_awarded > 0:
        factor = quantised / marks_awarded
        for it in breakdown:
            it["marks"] = round(it["marks"] * factor, 2)
    marks_awarded = quantised

    # The figures written in the margin must reconcile with the total, because
    # that is the whole promise of brace marking: a student adds up the numbers
    # beside each block and gets the mark at the foot of the answer. The model
    # does not reliably manage it (braces summing 4.0 against an awarded 7.0,
    # a summary reading 8.25 under an awarded 8.0), and quantising the total to
    # halves afterwards moves the target again. So reconcile here.
    braces = [a for a in valid_annotations if a["style"] == "brace"
              and a.get("marks") is not None]
    brace_total = sum(a["marks"] for a in braces)
    if braces and brace_total > 0 and abs(brace_total - marks_awarded) > 0.01:
        scale = marks_awarded / brace_total
        for a in braces:
            a["marks"] = round(a["marks"] * scale * 4.0) / 4.0
        # rounding can drift; put any remainder on the largest block
        drift = round(marks_awarded - sum(a["marks"] for a in braces), 2)
        if abs(drift) >= 0.25:
            biggest = max(braces, key=lambda a: a["marks"])
            biggest["marks"] = round(biggest["marks"] + drift, 2)
        logger.info("Q%s: rescaled %d brace marks from %.2f to %.2f",
                    question["question_id"], len(braces), brace_total, marks_awarded)
    for a in valid_annotations:
        if a["style"] == "summary":
            # The circled total IS the mark. It can never disagree with it.
            a["marks"] = round(marks_awarded, 2)

    return {
        "question_id": question["question_id"],
        "marks_awarded": round(marks_awarded, 2),
        "max_marks": max_marks,
        "extracted_answer": str(raw.get("extracted_answer") or ""),
        "feedback": str(raw.get("feedback") or ""),
        "confidence": float(raw.get("confidence") or 0),
        "criteria_breakdown": breakdown,
        "annotations": valid_annotations,
        "status": "COMPLETED",
    }
