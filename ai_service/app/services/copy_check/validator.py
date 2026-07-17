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


VALID_STYLES = {"tick", "cross", "circle", "underline", "margin_note", "region_note"}


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


def validate_and_cap(
    raw: dict[str, Any],
    question: dict[str, Any],
    layout_map: dict[str, Any],
) -> dict[str, Any]:
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
        valid_annotations.append({
            "target": target,
            "page_id": page_id,
            "style": style,
            "text": ann.get("text"),
        })
    if dropped:
        logger.info("Q%s: dropped %d annotations with no matching target", question["question_id"], dropped)

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
