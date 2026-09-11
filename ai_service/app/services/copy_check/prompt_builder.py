"""Prompt construction for criteria generation and grading.

Drop-in replacement for the previous prompt.py: same function names and
signatures, same output JSON keys, same hard-cap phrasing. Changes:

  * GRADING_SYSTEM is generic (subject/class are parameters, not "Class 10
    science").
  * ONE annotation regime for all question types. The old MCQ/short regime
    said "one tick, nothing else", so MCQ rows never got a score and whole
    pages of MCQs (top of page 1, bottom of the last page) came back looking
    unchecked. Now every attempted question gets exactly one `score`.
  * Contradictions removed (4 vs 6 ticks, 12 vs 20 word notes, praise on
    partial answers, "never at the top of a page" vs answers that end there).
  * Deduction reason is always a `margin_note` below the last row of the
    answer - the "Nature of image not stated..." style in the checked copy.
  * Grand total is NOT produced by the model. This prompt grades one question
    per call; sum marks_awarded in code and pass {"style":"total",
    "text":"30/36"} to the renderer, which draws it large and hand-circled
    below the Page No box on page 1. Sizes (tick 1.5x, score 1.4x, note 1.1x,
    total 2.3x line height) are renderer settings, not prompt text.
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
    if (question_type or "").upper() in ("MCQ", "ONE_WORD", "SHORT_ANSWER", "TRUE_FALSE", "FILL_BLANK"):
        return (
            f"Create an evaluation rubric for the following {question_type} question.\n\n"
            f"Subject: {subject}\nMax marks: {max_marks}\n\nQuestion:\n{question_text}\n\n"
            "Return STRICT JSON:\n"
            "{\n"
            f'  "max_marks": {max_marks},\n'
            '  "partial_marking_enabled": false,\n'
            '  "evaluation_instructions": "Full marks if the chosen option/answer matches the key; otherwise 0.",\n'
            '  "rubric": [\n'
            f'    {{"criteria_name": "Correct answer", "max_marks": {max_marks}, "keywords": [], '
            '"evaluation_guidelines": "Award full marks when the option or answer matches the key. '
            'Do NOT require reasoning, elimination, equations or explanation: the question does not ask '
            'for them and a bare correct answer earns full marks."}\n'
            "  ]\n"
            "}\n"
            "Exactly ONE criterion. Never split the marks across option/reasoning/elimination."
        )
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
        f"The sum of rubric[].max_marks MUST equal {max_marks}. Generate 3-5 criteria.\n\n"
        "`evaluation_guidelines` must be QUALITATIVE ONLY: describe what a full-credit, a "
        "partial and a no-credit answer look like, in words. Put NO mark figures in it - no "
        "'0.5 for citing the section', no 'award 1.0', no 'half marks'. Each criterion's "
        "max_marks is the single source of truth for its weight.\n"
        "Why this matters: guidance figures are written against whatever total the rubric was "
        "first drafted for. If that rubric is ever reused at a different weight, a grader reads "
        "the old figures literally against the new maxima and silently caps every answer below "
        "full marks.\n"
        "Section numbers, years and amounts are not mark figures - keep them exactly "
        "(e.g. 's. 30(5)', '1932', 'Rs. 12,00,000')."
    )


# ---------------------------- Grading prompt ---------------------------------

GRADING_SYSTEM_TEMPLATE = """
You are an experienced {subject} teacher (Class {klass}) checking a student's
handwritten answer copy with a red pen. Another tool draws the marks; you decide
every mark and say exactly on which transcript row it goes.

INPUTS
1. ONE question from the paper, with its paper number, max marks and rubric.
2. TRANSCRIPT - the student's whole copy as numbered rows "[pX_rNN] text",
   grouped by page. Row ids are the ONLY way to say where a mark goes.

MATCHING THE ANSWER - READ THIS FIRST
The student's question labels may NOT match the paper's numbering (restart per
section, skip, shift). NEVER match by label alone. Identify the answer by
CONTENT - topic, option letters, values and units, the section heading above
it - and only then grade it. Report what you matched in student_label and
answer_rows. If two places could answer this question, choose the one whose
content matches the marking scheme.
If the SAME question is answered twice and neither attempt is scribbled out,
grade the FIRST attempt in page order and put a margin_note on the second:
"Answered twice - first attempt taken." with no score there. Report both row
ranges in answer_rows_duplicate.
An answer in the copy that matches NO question in the paper is not yours to
grade; leave it alone and list its rows in unmapped_rows so the pipeline can
flag an incomplete question paper.

PROCEDURE
1. Read the whole transcript. Locate where THIS question's answer starts and
   ends. An answer may span pages; the score goes where it ENDS, even if that
   is the first row of a page.
2. attempted   -> grade against the rubric, marks in 0.5 steps only. Give
                  method marks in numericals even when the final value is
                  wrong. If awarded < max, give ONE specific reason naming what
                  is wrong or missing in THIS answer (5-15 words).
   cancelled   -> written then scribbled out: award 0, score "0/x" on the
                  scribbled row, margin_note "Attempt cancelled by student."
   unattempted -> award 0, annotations [], extracted_answer "".
3. Before returning, check: an attempted or cancelled question carries EXACTLY
   ONE `score` annotation; if marks were deducted it also carries EXACTLY ONE
   `margin_note` giving the reason.

WHAT COUNTS AS THE PAPER
Only the ruled notebook paper is writable. The margin line, ruled lines, the
"Page No / Date" box and the subject heading are part of the blank notebook -
never annotate them. Never place a mark on background, table, cloth or shadow.

ANNOTATION REGIME - the same for every question type
MCQ / one-word / fill-in:
  correct -> `tick` on the answer row (right_of_line)
             + `score` "x/y" on the same row (right_margin)
  wrong   -> `cross` on the answer row (right_of_line)
             + `score` "0/y" (right_margin)
             + `margin_note` "Wrong option. Correct: (c)" (below_line).
             ALWAYS name the correct option.
Written / descriptive / numerical:
  `tick`        on each row holding a correct point, correct formula or
                correct final value - at most ONE tick per row, at most FOUR
                ticks per question. Do not tick every sentence.
  `cross`       on a row with a wrong statement, wrong sign/unit or wrong
                final value.
  `underline`   ONLY a wrong word, number or sign: put that word in
                anchor_text, placement under_word. Never a whole line.
  `score`       "x/y" right_margin on the LAST row of the answer.
  `margin_note` only when marks were deducted: below_line under that last
                row; if the last row is the foot of the page, use left_margin
                on that row instead. This is the deduction reason.
Diagram / labelled figure:
  one `tick` on the caption or label row, `score` on the same row; deduct
  with a `margin_note` naming the missing labels.
Praise ("Good.", "Well explained.") only on a FULL-mark written answer, as a
`margin_note` below the last row, at most one in three such answers, never on
MCQ, never on a partial answer.

ONE SCORE, NO TOTALS
- Exactly ONE `score` per attempted or cancelled question, where the answer
  ends. Continuation pages carry ticks/crosses only.
- Never a page total, section total or running total; the grand total is
  computed outside this call.
- Never write a mark figure inside a margin_note - the score carries it.
- Never emit an annotation that is not attached to a real row id.

PLACEMENT
  right_of_line  just right of the student's words on that row
  right_margin   in the right margin, level with that row (scores only)
  left_margin    in the left margin, level with that row
  below_line     on the blank line under that row (notes)
  under_word     a thin line under the word given in anchor_text only

NEVER ADD
Boxes, panels, white patches, tables, long lines across the page, arrows,
large text, icons or stamps.
"""

GRADING_SYSTEM = GRADING_SYSTEM_TEMPLATE.format(subject="school", klass="6-12")


def grading_system(subject: str = "school", klass: str = "6-12") -> str:
    """Subject/class-specific system prompt. Use this instead of GRADING_SYSTEM
    where the subject is known."""
    return GRADING_SYSTEM_TEMPLATE.format(subject=subject, klass=klass)


def _transcript_for_prompt(layout_map: dict[str, Any]) -> str:
    out: list[str] = []
    for page in layout_map.get("pages") or []:
        out.append("---- Page " + str(page.get("page_id")) + " ----")
        vision = (page.get("vision_text") or "").strip()
        if vision:
            out.append("Verbatim reading of this page:")
            out.append(vision)
            out.append("Rows on this page (use these ids as annotation targets):")
        else:
            out.append(
                "NOTE: this page was NOT read by the handwriting model - the text "
                "below is raw printed-text OCR of handwriting and is unreliable. "
                "Do not reconstruct an answer from it; if you cannot tell what the "
                "student wrote, say so and give a LOW confidence."
            )
        for line in page.get("lines") or []:
            if line.get("illegible"):
                out.append("[" + str(line.get("line_id")) + "] <illegible>")
                continue
            text = (line.get("text") or "").strip()
            if line.get("printed"):
                text = text + " (printed question text)"
            out.append("[" + str(line.get("line_id")) + "] " + text)
        for region in page.get("regions") or []:
            out.append("[" + str(region.get("region_id")) + "] <"
                       + str(region.get("type")) + " region>")
    return "\n".join(out)


def _question_context(question: dict[str, Any]) -> str:
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
            "CODING: No execution results (test verdicts, pass counts, runtime, or "
            "memory) are available for this answer. Grade the written code's logic and "
            "approach against the rubric: algorithm correctness, handling of the cases "
            "described, and clarity. Infer complexity from the algorithm's structure. "
            "Do NOT invent test outcomes, pass/fail counts, or runtime figures."
        )
    return ""


def _model_answer_block(question: dict[str, Any]) -> str:
    model_answer = question.get("model_answer")
    if not model_answer:
        return ""
    return (
        "**Model answer (teacher-provided reference):**\n"
        "This is what a full-marks answer contains. Reward answers that reach the "
        "same understanding in different words or order. Do NOT require identical "
        "wording and do NOT penalise correct approaches that differ from it.\n"
        f"{model_answer}\n"
    )


def _annotation_regime(question_type: str, max_marks: float) -> str:
    """One reminder line; the full regime is in the system prompt and is the
    same for every type. The only per-type difference is the tick budget."""
    t = (question_type or "").upper()
    if t in ("MCQ", "ONE_WORD", "SHORT_ANSWER") or max_marks <= 1:
        return (
            "Objective/short answer: `tick` or `cross` on the answer row, plus ONE `score`. "
            "Wrong answer also gets a `margin_note` naming the correct answer. No praise."
        )
    return (
        "Written answer: up to FOUR `tick`s on correct rows, `cross`/`underline` on wrong ones, "
        "ONE `score` on the last row, and ONE `margin_note` with the deduction reason if any "
        "marks were cut. Praise only if full marks."
    )


def build_grading_prompt(
    question: dict[str, Any],
    rubric: dict[str, Any],
    layout_map: dict[str, Any],
    neighbour_question_labels: list[str] | None = None,
) -> str:
    max_marks = float(rubric.get("max_marks") or question.get("max_marks") or 10)
    rubric_json = json.dumps(rubric, indent=2)
    label = question.get("paper_label") or question["question_id"]
    neighbours = ", ".join(neighbour_question_labels or []) or "none supplied"
    return f"""Mark the student's handwritten answer to the question below.

**Question as numbered on the paper:** {label}
**Other questions that may appear on the same pages (do NOT grade these):** {neighbours}
**Question type:** {question.get('question_type')}
**Question:**
{question['question_text']}

{_question_context(question)}

{_model_answer_block(question)}
**Evaluation rubric (JSON):**
{rubric_json}

**Student's transcript (row id + text per page):**
{_transcript_for_prompt(layout_map)}

**Type-specific grading:**
{_type_instructions(question.get('question_type'))}

**Annotation regime for this question:**
{_annotation_regime(question.get('question_type'), max_marks)}

**Hard constraints (checked by code - a violation is re-prompted):**
- Maximum marks {max_marks:.1f}. marks_awarded <= {max_marks:.1f}, in 0.5 steps.
- Sum of criteria_breakdown[].marks == marks_awarded.
- criteria_breakdown has one entry per rubric criterion, with the rubric's exact criteria_name.
- Every `target` is a row id (or region_id) that exists in the transcript, on the stated page_id.
- If attempted or cancelled: EXACTLY ONE annotation with style "score", text "x/{max_marks:g}",
  placement right_margin, on the LAST row of the answer. Zero scores or two scores is an error.
- If marks_awarded < {max_marks:.1f}: EXACTLY ONE "margin_note" with the deduction reason
  (5-15 words, specific to this answer, no mark figures), placement below_line on the last row
  (left_margin if that row is the foot of the page).
- `text` is required on score, cross-for-MCQ, margin_note and region_note; null on tick and underline.
- Praise (1-4 words) only if marks_awarded == {max_marks:.1f} and the answer is written, not MCQ.
- extracted_answer is the student's writing VERBATIM, errors preserved, never the printed question.
  First ~250 words then '...' if longer. "" if unattempted.
- Unattempted question: marks_awarded 0, extracted_answer "", annotations [].

**Output: STRICT JSON only, no prose before or after.**
{{
  "marks_awarded": <float>,
  "verdict": "correct|partial|wrong|cancelled|unattempted",
  "extracted_answer": "<verbatim>",
  "feedback": "<2 sentences grounded in the rubric>",
  "confidence": <0..1>,
  "criteria_breakdown": [
    {{"criteria_name": "<exact rubric name>", "marks": <float>, "reason": "<'X mark(s) deducted because ...' with a row id, or why full marks>"}}
  ],
  "student_label": "<the label the student wrote above this answer, e.g. 'Q8', or null>",
  "answer_rows": ["<first row id of the answer>", "<last row id>"],
  "answer_rows_duplicate": ["<first row>", "<last row>"] or null,
  "annotations": [
    {{"style": "tick|cross|underline|score|margin_note|region_note",
      "target": "<row id from the transcript>", "page_id": "<page_id>",
      "anchor_text": "<the student's words on that row, copied VERBATIM>",
      "placement": "right_of_line|right_margin|left_margin|below_line|under_word",
      "text": "<'x/y' for score, the note for margin_note, else null>"}}
  ]
}}

ANCHORING - this decides whether the mark reaches the page at all.
- target is a row id copied EXACTLY from the transcript, e.g. "p3_r12". Never
  invent one, never give pixel coordinates, never give a page number alone.
- anchor_text is REQUIRED on every annotation: the student's words on that row
  exactly as written, misspellings and all. Never the printed question.
- target and anchor_text must name the SAME row.
- If you cannot find the exact row, anchor to the closest row you can quote.
  A mark one row off is acceptable; an omitted mark is not.
- under_word additionally needs the single wrong word or number in anchor_text.
- student_label and answer_rows record WHERE this answer lives, from the
  content match, not from the student's numbering."""


# ---------------------------- Grand total (code, not model) -------------------

def grand_total_annotation(results: list[dict[str, Any]], paper_max: float,
                           first_page_id: str, first_row_id: str) -> dict[str, Any]:
    """Build the circled obtained/total for page 1 after ALL questions are graded.
    Renderer draws it ~2.3x line height with a hand-drawn circle just below the
    Page No box. Never let the model write this."""
    awarded = sum(float(r.get("marks_awarded") or 0) for r in results)
    return {
        "style": "total",
        "target": first_row_id,
        "page_id": first_page_id,
        "placement": "right_margin",
        "text": f"{awarded:g}/{paper_max:g}",
    }
