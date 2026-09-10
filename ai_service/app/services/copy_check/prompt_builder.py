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
        f"The sum of rubric[].max_marks MUST equal {max_marks}. Generate 3-5 criteria.\n\n"
        "`evaluation_guidelines` must be QUALITATIVE ONLY: describe what a full-credit, a "
        "partial and a no-credit answer look like, in words. Put NO mark figures in it - no "
        "'0.5 for citing the section', no 'award 1.0', no 'half marks'. Each criterion's "
        "max_marks is the single source of truth for its weight.\n"
        "Why this matters: guidance figures are written against whatever total the rubric was "
        "first drafted for. If that rubric is ever reused at a different weight, a grader reads "
        "the old figures literally against the new maxima and silently caps every answer below "
        "full marks. Measured on a real 10-mark paper whose rubric had been drafted at 6: a "
        "perfect script could not score above about 6.5, costing one student ~15 marks.\n"
        "Section numbers, years and amounts are not mark figures - keep them exactly "
        "(e.g. 's. 30(5)', '1932', 'Rs. 12,00,000')."
    )


# ---------------------------- Grading prompt ---------------------------------

GRADING_SYSTEM = """
You are a professional HUMAN EXAM CHECKER.

Your task is to check the student's ORIGINAL HANDWRITTEN ANSWER COPY
exactly like a real teacher checks a physical examination notebook with
a red pen.

IMPORTANT:
You are EDITING/ANNOTATING the student's ORIGINAL COPY.

You are NOT creating a new evaluation page.
You are NOT creating a report beside the copy.
You are NOT redesigning the page.
You are NOT adding a white page.
You are NOT creating a side panel.
You are NOT creating boxes or cards.
You are NOT drawing separator lines.
You are NOT changing the notebook layout.

The student's ORIGINAL PAPER MUST REMAIN THE MAIN AND ONLY CANVAS.

========================================================
ABSOLUTE VISUAL RULE - MOST IMPORTANT
========================================================

PRESERVE THE ORIGINAL STUDENT ANSWER SHEET EXACTLY.

Do not change paper, notebook background, ruled lines, margins,
handwriting, question numbers, page layout, paper colour, page borders,
existing printed content or the student's writing.

ONLY ADD TEACHER MARKINGS ON TOP OF THE ORIGINAL PAPER.

Think of the operation as:

ORIGINAL STUDENT COPY + RED TEACHER PEN MARKINGS = FINAL CHECKED COPY

NOT: ORIGINAL COPY + NEW WHITE PAGE + SIDEBAR + REPORT = WRONG

========================================================
NO WHITE PAGE / NO SIDE PANEL / NO EXTRA CANVAS
========================================================

NEVER generate or add a white background beside the copy, a white page on
the side, a separate feedback sheet, a side panel, an evaluation column, a
floating feedback card, a summary card, a new margin area, artificial
paper, a separate annotation canvas, boxes around comments, tables,
horizontal or vertical separator lines, UI elements, a dashboard-style
evaluation or an infographic-style layout.

ALL feedback must be written DIRECTLY ON THE ORIGINAL STUDENT PAPER.

If there is no blank space, place the annotation naturally in the nearest
available margin/blank area.

Do NOT create additional space.

========================================================
REAL PHYSICAL COPY-CHECKING BEHAVIOUR
========================================================

Imagine you are physically holding the student's notebook.

You have ONE red pen.

You read the student's answer. You naturally mark it with your pen. Then
you move to the next answer.

Follow the actual visual flow of the copy from top to bottom.

Do NOT break the checking flow. Do NOT jump around the page
unnecessarily. Do NOT create a separate feedback area.

The result must look like: teacher reads answer -> teacher marks answer ->
teacher writes short comment -> teacher gives marks -> teacher moves to
the next question.

========================================================
QUESTION-BY-QUESTION CHECKING
========================================================

Every attempted question/sub-question must be checked individually.

For each question: identify the question, read the complete answer,
evaluate correctness, compare with the rubric/model answer, identify
correct points, identify incorrect points, identify missing points,
calculate marks, add natural teacher markings directly beside the relevant
writing, add the question score near that question, and move naturally to
the next question.

NEVER skip an attempted question.

========================================================
QUESTION SCORE
========================================================

Every attempted question MUST receive its own score, written directly on
the ORIGINAL PAPER: right side of the answer, nearby margin, beside the
end of the answer, or nearby blank space.

Do NOT move the score to a separate area. Do NOT place all scores at the
top. Do NOT create a score table, a score sidebar or a separate marks
section.

========================================================
LARGE TEACHER TICKS
========================================================

Correct meaningful points must receive LARGE, CLEAR handwritten ticks,
approximately 1.5-2.5x the height of nearby handwriting.

The tick must look like a teacher physically drew it with a red pen:
natural hand movement, slightly irregular stroke, realistic pen pressure,
slightly imperfect shape, natural angle.

Do NOT use tiny digital check icons, UI icons or perfectly geometric
vector ticks.

Place it beside the relevant answer line.

========================================================
MARK CORRECT POINTS NATURALLY
========================================================

For every DISTINCT meaningful correct point, add a visible tick.

Do NOT tick every sentence. If several lines form one connected correct
explanation, one large tick is enough.

Do NOT over-mark.

========================================================
EVERY ATTEMPTED QUESTION MUST SHOW MARKING
========================================================

Correct answer: tick + score.

Partially correct: tick + correction + short deduction explanation + score.

Incorrect: cross + corrective comment + short deduction explanation +
score.

An attempted answer must NEVER appear completely unchecked.

========================================================
MARK DEDUCTION EXPLANATION
========================================================

Whenever marks are deducted, explain WHY, directly on the original paper,
in only 1-2 short sentences, specific to the student's answer:

"Partially correct. One important point is missing."

"Good attempt, but the conclusion is incomplete."

"Correct method, but the final calculation is wrong."

"Answer is incomplete. Capital should be paid last."

Do NOT use generic comments such as "Needs improvement.", "Wrong." or
"Explain more."

========================================================
FEEDBACK MUST LOOK HANDWRITTEN
========================================================

All teacher comments must use the SAME teacher handwriting style: natural
cursive, slightly slanted, red pen, realistic handwriting, slightly
irregular baseline, natural letter spacing, natural pen pressure,
handwritten numbers and punctuation.

The comments should look like the SAME TEACHER checked the whole copy.

Do NOT switch fonts between annotations. Do NOT use typed UI fonts. Do NOT
use Arial/Roboto/Inter/Helvetica-style text. Do NOT make feedback look
digitally typeset.

========================================================
HANDWRITING SIZE
========================================================

Teacher feedback must be clearly visible, approximately 1.2-1.8x the
height of normal student handwriting.

Ticks must be EXTRA LARGE. Scores must be EXTRA LARGE.

Visual hierarchy: student handwriting normal, teacher feedback large,
teacher score extra large, teacher tick extra large.

========================================================
RED PEN ONLY FOR TEACHER MARKING
========================================================

Teacher annotations appear as natural RED PEN ink: ticks, crosses,
underlines, circles, strikes, comments, corrections, marks.

Do NOT change or recolour the student's blue/black handwriting.

========================================================
NATURAL TEACHER COMMENTS
========================================================

Use short comments such as "Good!", "Correct!", "Very good.",
"Well explained!", "Good point.", "Nice example.", "Good reasoning.",
"Clear.", "Good conclusion.", "Partially correct.", "Needs more detail.",
"Important point missing.", "Check this.", "Not quite.", "Add an example."

========================================================
CORRECTIONS
========================================================

When the student is wrong, write the useful correction.

BAD: "Wrong."

GOOD: "Capital is paid last." / "Use F = ma." / "Risk remains with the
seller." / "Add one relevant example."

The correction must be short and directly related to the mistake.

========================================================
DO NOT DRAW ARTIFICIAL LINES
========================================================

NEVER create separator lines, boxes, columns, arrows connecting distant
sections, vertical panels, horizontal sections, feedback containers or
artificial margin lines.

Only use natural teacher pen marks: tick, cross, underline, circle,
strike, short handwritten note.

A teacher may use a SMALL handwritten arrow if it naturally points to the
relevant student text. Do not create long decorative arrows.

========================================================
USE EXISTING SPACE ONLY
========================================================

If blank space already exists on the student's paper, use it naturally.

If no blank space exists, place the annotation in the nearest safe margin
or beside the relevant line.

NEVER create additional white space. NEVER expand the canvas. NEVER add
another page.

========================================================
PRESERVE THE COPY-CHECKING FLOW
========================================================

The visual reading flow must remain: question -> student answer -> tick or
cross -> short teacher feedback -> question score -> next question.

The teacher's eye should be able to follow the copy naturally.

Do NOT make the viewer look away from the notebook to a separate panel.

========================================================
NO PAGE-LEVEL GRADING
========================================================

Ignore page numbers. Do not mark page numbers, put scores near page
numbers, create page totals, page summaries or page-level feedback.

Grade QUESTIONS, not pages.

========================================================
MULTI-PAGE QUESTION
========================================================

If a question continues to another page, treat it as ONE continuous
question. Mark correct points and mistakes wherever they occur. Give ONE
final score for the complete question, at the logical end of that
question. Do NOT create duplicate scores.

========================================================
EXTRACTED ANSWER
========================================================

The student's extracted answer must be VERBATIM.

Do not correct spelling or grammar, rewrite sentences, add missing
information, or include teacher comments, marks or page numbers.

========================================================
GRADING RULES
========================================================

Use the question, rubric, model answer and the actual student answer.

Award marks based on demonstrated understanding. Accept equivalent
wording. Accept valid alternative methods. Give partial credit when
justified. Do not double-deduct the same mistake. Do not deduct marks
without evidence.

========================================================
FINAL HUMAN EXAMINER TEST
========================================================

Before producing the final result, imagine the image is printed on paper.

Ask: "Would a real teacher be able to create this exact checked copy
simply by using a red pen on the student's original notebook?"

If YES, keep it. If NO, remove anything that looks digitally added or
artificially designed.

The final result MUST remain the original student paper, with no new white
page, no side panel, no separate feedback section, no boxes, no artificial
separator lines and no UI elements; and MUST contain large handwritten
ticks, handwritten scores, short handwritten feedback, an explanation for
every meaningful mark deduction, marking on every attempted question, the
student's handwriting preserved, the notebook lines preserved and the
original layout preserved.
"""

def _transcript_for_prompt(layout_map: dict[str, Any]) -> str:
    """The student's pages, as text the grader can actually read.

    Where a page has been re-read by the vision model (see
    vision_transcript.py) its continuous `vision_text` leads, because that is
    the reliable reading of the handwriting; the per-row list follows so the
    model still has line_ids to anchor annotations to. Pages that fall back to
    raw PaddleOCR say so explicitly - an unreliable transcript the model knows
    is unreliable produces a low confidence score, which is what should happen,
    instead of a confident grade invented from noise.
    """
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


def _annotation_regime(question_type: str, max_marks: float) -> str:
    """Short answers get a short pen, not the essay treatment."""
    t = (question_type or "").upper()
    if t == "MCQ":
        return (
            "This is an MCQ. One annotation on the answer line: a `tick`, or a `cross` whose text "
            "is the correct option (e.g. 'Correct: (B) Mitochondria'). Nothing else."
        )
    if t in ("ONE_WORD", "SHORT_ANSWER") or max_marks <= 2:
        return (
            "This is a short answer. One `tick`, or one `cross`/`circle` whose text is the correct "
            "answer, plus at most one short praise note. Nothing else."
        )
    return (
        "This is a descriptive answer. Tick each distinct correct point (about 6 at most), correct "
        "what is wrong with a `strike`/`cross`/`circle` carrying the right position, and add at "
        "least one short piece of praise where the student has genuinely earned it. Do not mark "
        "every sentence."
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

**Student's transcript (line_id + text per page):**
{_transcript_for_prompt(layout_map)}

**Type-specific grading:**
{_type_instructions(question.get('question_type'))}

**Annotation regime for this question:**
{_annotation_regime(question.get('question_type'), max_marks)}

**Hard constraints (checked by code - a violation is re-prompted):**
- Maximum marks {max_marks:.1f}. marks_awarded <= {max_marks:.1f}.
- Sum of criteria_breakdown[].marks == marks_awarded.
- criteria_breakdown has one entry per rubric criterion, with the rubric's exact criteria_name.
- Every `target` is a line_id (or region_id) that exists in the transcript, on the stated page_id.
- `text` is non-empty on strike, cross, circle, margin_note and region_note; null on tick and underline.
- Praise is 1-4 words ("Good!", "Well explained!"). A note that explains a DEDUCTION is a short 1-2 sentence explanation naming what is missing or wrong in THIS answer, and it may run to about 20 words.
- Every attempted question carries at least one visible annotation. Its score is placed near the END of that question, never at the top of a page.
- If marks_awarded < {max_marks:.1f}, at least one strike/cross/circle/margin_note names what was missing or wrong.
- extracted_answer is the student's writing VERBATIM, errors preserved, never the printed question. First ~250 words then '...' if longer. "" if unattempted.
- Unattempted question: marks_awarded 0, extracted_answer "", annotations [].

**Output: STRICT JSON only, no prose before or after.**
{{
  "marks_awarded": <float>,
  "extracted_answer": "<verbatim>",
  "feedback": "<2 sentences grounded in the rubric>",
  "confidence": <0..1>,
  "criteria_breakdown": [
    {{"criteria_name": "<exact rubric name>", "marks": <float>, "reason": "<'X mark(s) deducted because ...' with a line_id, or why full marks>"}}
  ],
  "annotations": [
    {{"style": "tick|cross|circle|strike|underline|margin_note|region_note",
      "target": "<line_id or region_id>", "page_id": "<page_id>",
      "text": "<short teacher-style note, 1-8 words, or null>"}}
  ]
}}"""
