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
    max_marks = float(question.get("max_marks") or 10)

    marks_awarded = float(raw.get("marks_awarded") or 0)
    breakdown_raw = raw.get("criteria_breakdown") or []
    breakdown: list[dict[str, Any]] = []
    for item in breakdown_raw:
        breakdown.append({
            "criteria_name": str(item.get("criteria_name") or "Criterion"),
            "marks": float(item.get("marks") or 0),
            "reason": str(item.get("reason") or ""),
        })

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
