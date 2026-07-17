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
    "Ignore OCR/spelling errors; focus on intent and meaning.\n\n"
    "ANNOTATION DISCIPLINE (these rules are non-negotiable — teachers rely on "
    "them to audit your grading):\n"
    "1. JUSTIFY EVERY DEDUCTION. Every `cross` or `circle` annotation MUST have "
    "a non-empty `text` field stating WHAT IS WRONG and WHY MARKS WERE LOST "
    "(e.g. 'Sign error — should be -x not +x', 'Missing closed circle at 3'). "
    "Never leave `text` null or empty on cross/circle.\n"
    "2. NO SILENT MARK CUTS. If `marks_awarded < max_marks`, you MUST add at "
    "least one annotation (`cross`, `circle`, or `margin_note`) whose text "
    "explicitly states the deduction reason. A student should be able to read "
    "your annotations and understand exactly why they lost marks.\n"
    "3. NO TICK SPAM. Use AT MOST 3 ticks per question. Reserve ticks for the "
    "final answer and one or two key inferential steps. For long correct "
    "chains, use ONE `region_note` saying 'All steps correct' instead of a "
    "tick on every line. A wall of green ticks hides the cross that matters.\n"
    "4. PER-CRITERION TRACE. In `criteria_breakdown[].reason`, when "
    "`marks < max_marks` for that criterion, explicitly state 'X mark(s) "
    "deducted because Y' and reference at least one `line_id` from the "
    "student's work that drives the deduction."
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
        # This pipeline grades a scanned/handwritten copy: no sandbox execution
        # results (verdict, pass counts, runtime, memory) are available. Do NOT
        # ask the model to use data it cannot see — that invites hallucinated
        # verdicts. Grade the written logic only.
        return (
            "CODING: No execution results (test verdicts, pass counts, runtime, or "
            "memory) are available for this answer. Grade the written code's logic and "
            "approach against the rubric: algorithm correctness, handling of the cases "
            "described, and clarity. Infer complexity from the algorithm's structure. "
            "Do NOT invent test outcomes, pass/fail counts, or runtime figures."
        )
    return ""


def _model_answer_block(question: dict[str, Any]) -> str:
    """Teacher-authored reference answer, if provided. Used as a grading guide —
    NOT a required verbatim match — so a teacher who writes a model answer
    actually influences the grade (previously it was stored but never read)."""
    model_answer = question.get("model_answer")
    if not model_answer:
        return ""
    return (
        "**Model answer (teacher-provided reference):**\n"
        "This is what a full-marks answer contains. Use it as your guide to award "
        "marks per the rubric — reward answers that reach the same understanding, "
        "even in different words or order. Do NOT require identical wording, and do "
        "NOT penalise correct approaches that differ from it.\n"
        f"{model_answer}\n"
    )


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

{_model_answer_block(question)}
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
- `extracted_answer` must be a VERBATIM transcription of what the student actually wrote (preserve their errors) — do not correct, rephrase, or complete it. Judge intent/meaning when grading, but never rewrite the student's words here.
- **Justify every cross/circle**: `text` MUST state what is wrong and why marks were lost. No null/empty text on cross or circle annotations.
- **No silent mark cuts**: if `marks_awarded < {max_marks:.1f}`, add at least one annotation (cross/circle/margin_note) whose text explicitly states the deduction reason.
- **No tick spam**: at most 3 ticks. For long correct chains, use a single `region_note` 'All steps correct' instead.
- **Per-criterion trace**: in `criteria_breakdown[].reason`, when `marks < max_marks`, write 'X mark(s) deducted because Y' and reference a `line_id` driving the deduction.

**Output: STRICT JSON only.**
{{
  "marks_awarded": <float>,
  "extracted_answer": "<verbatim transcription of the student's answer, errors and all>",
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
