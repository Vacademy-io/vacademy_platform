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

_GRADING_INTRO_TEXT = (
    "You are an expert evaluator. Grade the student's handwritten answer based "
    "strictly on the provided rubric. The student's pages have been OCR'd into "
    "a numbered transcript of line_ids — when you flag an error or correctness, "
    "you MUST reference the line_id (e.g. \"L1_32\"), never pixel coordinates. "
    "Ignore OCR/spelling errors; focus on intent and meaning."
)

# Vision path: the real page images are attached. The OCR is demoted to an
# assistive hint so the model reads the handwriting itself instead of grading a
# printed-text OCR of handwriting (the accuracy bug this pipeline change fixes).
_GRADING_INTRO_VISION = (
    "You are an expert evaluator. The student's ACTUAL handwritten answer pages "
    "are ATTACHED AS IMAGES — read the handwriting directly from the image(s); "
    "the image is the source of truth. A best-effort OCR transcript is also "
    "provided as a numbered list of line_ids, but it is ASSISTIVE ONLY and may "
    "contain recognition errors: use it only (a) as a hint when the handwriting "
    "is hard to read and (b) to choose the line_id to anchor each annotation to "
    "— never grade from the OCR alone. When you flag an error or correctness, "
    "you MUST reference the line_id (e.g. \"L1_32\"), never pixel coordinates. "
    "Grade against the rubric and award partial credit. Ignore spelling/OCR "
    "errors; focus on intent and meaning."
)

_ANNOTATION_DISCIPLINE = (
    "ANNOTATION DISCIPLINE (these rules are non-negotiable — teachers rely on "
    "them to audit your grading):\n"
    "1. WRITE LIKE A TEACHER'S PEN. Annotation `text` is written ON the copy, "
    "so it must read like a marginal pen note: imperative, specific, AT MOST "
    "10 words. Good: 'Cite Section 21 explicitly', 'Mention buyer's right to "
    "refund', 'Add unanimous consent for minor admission'. Bad: any sentence "
    "explaining why marks were deducted — that explanation belongs in "
    "`criteria_breakdown[].reason`, never on the page.\n"
    "2. JUSTIFY EVERY DEDUCTION. Every `cross`, `circle`, or `strike` MUST "
    "have a non-empty `text` note (short, per rule 1) naming the fix. Never "
    "leave `text` null or empty on cross/circle/strike.\n"
    "3. STRIKE WHAT IS WRONG. Use `strike` on a line whose statement is "
    "incorrect or irrelevant — the note carries the correction (e.g. 'Payment "
    "does not transfer ownership'). Use `cross` for a wrong but readable "
    "step; use `circle` for something incomplete that needs attention; use "
    "`underline` to emphasise a key correct statement.\n"
    "4. NO SILENT MARK CUTS. If `marks_awarded < max_marks`, at least one "
    "annotation (`cross`, `circle`, `strike`, or `margin_note`) must name "
    "what was missing or wrong, and `criteria_breakdown[].reason` must carry "
    "the full deduction arithmetic. Exception: an UNATTEMPTED question has "
    "`annotations = []` — there is nothing on the page to mark, and a note "
    "pinned to unrelated writing would deface another answer.\n"
    "5. NO TICK SPAM. Use AT MOST 3 ticks per question. Reserve ticks for the "
    "final answer and one or two key inferential steps. For long correct "
    "chains, use ONE `region_note` saying 'All steps correct' instead of a "
    "tick on every line. A wall of green ticks hides the cross that matters.\n"
    "6. PER-CRITERION TRACE. In `criteria_breakdown[].reason`, when "
    "`marks < max_marks` for that criterion, explicitly state 'X mark(s) "
    "deducted because Y' and reference at least one `line_id` from the "
    "student's work that drives the deduction. This is the audit trail; the "
    "on-page notes stay short because this field carries the detail.\n"
    "7. ANCHOR PRECISELY. `target` must be the line_id of the FULL line the "
    "mark refers to — never a short fragment mid-answer, and never a guess. "
    "If you cannot identify the exact line, use a `margin_note` anchored to "
    "the answer's first line instead: a circle on the wrong words destroys "
    "trust in every other mark on the copy.\n"
    "8. CREDIT VISIBLY. When an answer (or a sub-part) is CORRECT, tick the "
    "line carrying its final conclusion — a correct answer must never go "
    "visually unmarked on the page. These ticks count toward the 3-tick "
    "budget; for a fully-correct multi-part answer, tick the overall "
    "conclusion line."
)

# Text-only path (legacy) and vision path share the same annotation discipline;
# only the intro differs in where the model is told to read the answer from.
GRADING_SYSTEM = _GRADING_INTRO_TEXT + "\n\n" + _ANNOTATION_DISCIPLINE
GRADING_SYSTEM_VISION = _GRADING_INTRO_VISION + "\n\n" + _ANNOTATION_DISCIPLINE


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
    vision: bool = False,
) -> str:
    max_marks = float(rubric.get("max_marks") or question.get("max_marks") or 10)
    rubric_json = json.dumps(rubric, indent=2)
    if vision:
        source_instruction = (
            "The student's actual answer page(s) are ATTACHED AS IMAGE(S). READ "
            "THE HANDWRITING FROM THE IMAGE(S) — that is the source of truth. The "
            "OCR transcript below is ASSISTIVE ONLY (it may misread handwriting); "
            "use it only as a hint and to pick the line_ids for your annotations, "
            "never as the sole basis for the grade.\n\n"
        )
        transcript_header = (
            "**Assistive OCR transcript (line_id + text per page — MAY CONTAIN "
            "ERRORS; rely on the attached image, not this text):**"
        )
    else:
        source_instruction = ""
        transcript_header = "**Student's OCR'd transcript (line_id + text per page):**"
    return f"""Grade the student's handwritten answer.

{source_instruction}**Question ID:** {question['question_id']}
**Question type:** {question.get('question_type')}
**Question:**
{question['question_text']}

{_question_context(question)}

{_model_answer_block(question)}
**Evaluation rubric (JSON):**
{rubric_json}

{transcript_header}
{_transcript_for_prompt(layout_map)}

**Type-specific instructions:**
{_type_instructions(question.get('question_type'))}

**CRITICAL CONSTRAINTS:**
- Maximum marks: {max_marks:.1f}. `marks_awarded` MUST NOT exceed {max_marks:.1f}.
- Reference line_ids (e.g. "L1_32") in `annotations[].target`. NEVER output pixel coordinates.
- Each annotation needs a `page_id` matching the line_id's page.
- If the student didn't attempt this question, set `marks_awarded = 0`, `extracted_answer = ""`, and `annotations = []`.
- `extracted_answer` must be a VERBATIM transcription of what the student actually wrote (preserve their errors) — do not correct, rephrase, or complete it. Judge intent/meaning when grading, but never rewrite the student's words here. It is the STUDENT'S HANDWRITING ONLY: never the printed question paper or the question's own text — transcribing the question as the answer is a grading-integrity failure. No line_id citations inside it. If the answer runs past ~250 words, transcribe the first ~250 verbatim and end with '…'. If you cannot find this question's answer on the pages, use "" and grade it unattempted.
- **Pen-note style**: annotation `text` is written on the copy — imperative, ≤10 words, naming the fix (e.g. 'Cite Section 21 explicitly'). The full why-marks-were-lost explanation goes in `criteria_breakdown[].reason`, NOT on the page.
- **Justify every cross/circle/strike**: each MUST carry a short non-empty `text` note naming the fix. No null/empty text on cross, circle, or strike annotations.
- **Strike wrong statements**: use `strike` through an incorrect/irrelevant line with the correction as its note; `underline` emphasises a key correct statement.
- **No silent mark cuts**: if `marks_awarded < {max_marks:.1f}`, add at least one annotation (cross/circle/strike/margin_note) naming what was missing, with the arithmetic in `criteria_breakdown[].reason` — except when the question was not attempted (then `annotations = []`, per above).
- **No tick spam**: at most 3 ticks. For long correct chains, use a single `region_note` 'All steps correct' instead.
- **Credit visibly**: a correct answer (or correct sub-part) MUST get a tick on its conclusion line — correct work never goes unmarked.
- **Anchor precisely**: `target` is the full line the mark refers to, never a fragment or a guess; when unsure of the exact line, use `margin_note` on the answer's first line.
- **Notes add information**: `text` on tick/underline is usually null — the mark speaks. Never echo the line's own words back as the note, and never repeat the same note on multiple lines; when several lines earn the same comment, write ONE margin_note that covers them (e.g. 'All three disabilities correct').
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
      "style": "tick|cross|circle|strike|underline|margin_note|region_note",
      "text": "<pen note, imperative, max 10 words; required for cross/circle/strike/margin_note/region_note>"}}
  ]
}}

FINAL CHECK: marks_awarded ≤ {max_marks:.1f}. Sum of criteria_breakdown[].marks should equal marks_awarded."""
