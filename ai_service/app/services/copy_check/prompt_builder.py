"""Prompt construction for criteria generation and grading.

Ported from Java AiCriteriaGenerationService + AiPromptBuilderService. Same
type-specific branches (MCQ/ONE_WORD/LONG_ANSWER/CODING), same hard cap
phrasing, but with two additions for the layout-anchored pipeline:

  1. Grading receives a numbered transcript of line_ids + text. The model
     MUST reference line_ids as `target`s in its annotations[] output, never
     pixel coordinates.
  2. Output schema includes annotations[] so the FE overlay can draw on the
     exact line each verdict refers to.
"""
from __future__ import annotations

import json
from typing import Any


# ---------------------------- Criteria generation ----------------------------

CRITERIA_SYSTEM = (
    "You are an expert educational assessment specialist. You create detailed, "
    "fair, and structured evaluation criteria (rubrics) for grading student answers."
)


def build_criteria_prompt(
    subject: str,
    question_type: str,
    max_marks: float,
    question_text: str,
) -> str:
    return (
        f"Create a detailed evaluation rubric for the following question.\n\n"
        f"Subject: {subject}\nType: {question_type}\nMax marks: {max_marks}\n\n"
        f"Question:\n{question_text}\n\n"
        "Return STRICT JSON matching this schema:\n"
        "{\n"
        '  "max_marks": <float>,\n'
        '  "partial_marking_enabled": true,\n'
        '  "evaluation_instructions": "<short paragraph>",\n'
        '  "rubric": [\n'
        '    {"criteria_name": "<name>", "max_marks": <float>, '
        '"keywords": ["..."], "evaluation_guidelines": "<text>"}\n'
        "  ]\n"
        "}\n\n"
        f"The sum of rubric[].max_marks MUST equal {max_marks}. Generate 3-5 criteria."
    )


# ---------------------------- Grading prompt ---------------------------------

GRADING_SYSTEM = (
    "You are an expert evaluator. Grade the student's handwritten answer based "
    "strictly on the provided rubric. The student's pages have been OCR'd into "
    "a numbered transcript of line_ids — when you flag an error or correctness, "
    "you MUST reference the line_id (e.g. \"L1_32\"), never pixel coordinates. "
    "Ignore OCR/spelling errors; focus on intent and meaning."
)


def _transcript_for_prompt(layout_map: dict[str, Any]) -> str:
    parts: list[str] = []
    for page in layout_map.get("pages", []):
        parts.append(f"---- Page {page['page_id']} ----")
        for line in page.get("lines", []):
            parts.append(f"[{line['line_id']}] {line['text']}")
        for region in page.get("regions", []):
            parts.append(f"[{region['region_id']}] <{region['type']} region>")
    return "\n".join(parts)


def _question_context(question: dict[str, Any]) -> str:
    """Format MCQ options + correct answer block. Empty for non-MCQ."""
    options = question.get("options") or []
    if not options:
        return ""
    rendered: list[str] = []
    for i, opt in enumerate(options):
        text = opt.get("text") or opt.get("preview_id") or str(opt)
        rendered.append(f"  {i + 1}. (position {i + 1} / {chr(65 + i)} / {_roman(i + 1)}): {text}")
    block = "**Options:**\n" + "\n".join(rendered)
    correct = question.get("correct_answer")
    if correct:
        block += f"\n**Correct answer:** {correct}"
    return block


def _roman(n: int) -> str:
    return ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"][n - 1] if 1 <= n <= 10 else str(n)


def _type_instructions(question_type: str) -> str:
    t = (question_type or "").upper()
    if t == "MCQ":
        return (
            "MCQ: Match the option POSITION (number), not exact text. Accept "
            "'2', 'B', 'b', 'ii', 'option 2' as equivalent. Award full marks "
            "if position matches, even if the option text is misspelled."
        )
    if t in ("ONE_WORD", "SHORT_ANSWER"):
        return (
            "ONE_WORD: Accept spelling variants and close synonyms. Award marks "
            "if the intent matches the correct answer."
        )
    if t in ("LONG_ANSWER", "DESCRIPTIVE"):
        return (
            "LONG_ANSWER: Evaluate conceptual depth, structure, and examples per "
            "the rubric. Spelling/OCR errors do NOT reduce marks."
        )
    if t == "CODING":
        return (
            "CODING: Use the verdict (ACCEPTED/PARTIAL/REJECTED), passedCount/totalCount, "
            "and the source code itself. Infer Big-O from algorithm structure. Compare "
            "totalTimeMs/peakMemoryKb against cpuSeconds*1000 and memoryKb limits. Award "
            "proportional to pass rate, weighted by code quality and inferred complexity."
        )
    return ""


def build_grading_prompt(
    question: dict[str, Any],
    rubric: dict[str, Any],
    layout_map: dict[str, Any],
) -> str:
    max_marks = float(rubric.get("max_marks") or question.get("max_marks") or 10)
    rubric_json = json.dumps(rubric, indent=2)
    return f"""Grade the student's handwritten answer.

**Question ID:** {question['question_id']}
**Question type:** {question.get('question_type')}
**Question:**
{question['question_text']}

{_question_context(question)}

**Evaluation rubric (JSON):**
{rubric_json}

**Student's OCR'd transcript (line_id + text per page):**
{_transcript_for_prompt(layout_map)}

**Type-specific instructions:**
{_type_instructions(question.get('question_type'))}

**CRITICAL CONSTRAINTS:**
- Maximum marks: {max_marks:.1f}. `marks_awarded` MUST NOT exceed {max_marks:.1f}.
- Reference line_ids (e.g. "L1_32") in `annotations[].target`. NEVER output pixel coordinates.
- Each annotation needs a `page_id` matching the line_id's page.
- If the student didn't attempt this question, set `marks_awarded = 0`, `extracted_answer = ""`, and `annotations = []`.

**Output: STRICT JSON only.**
{{
  "marks_awarded": <float>,
  "extracted_answer": "<verbatim or paraphrased student answer>",
  "feedback": "<short feedback grounded in the rubric>",
  "confidence": <0..1 — how sure are you of this verdict>,
  "criteria_breakdown": [
    {{"criteria_name": "<name>", "marks": <float>, "reason": "<why this score>"}}
  ],
  "annotations": [
    {{"target": "<line_id or region_id>", "page_id": "<page_id>",
      "style": "tick|cross|circle|underline|margin_note|region_note",
      "text": "<optional, required for margin_note/region_note>"}}
  ]
}}

FINAL CHECK: marks_awarded ≤ {max_marks:.1f}. Sum of criteria_breakdown[].marks should equal marks_awarded."""
