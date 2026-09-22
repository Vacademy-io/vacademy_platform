"""paper_outline: the sections and marking a paper prints, read without a model."""
from __future__ import annotations

from app.services import question_extract_service as qe
from app.services.paper_outline import apply_outline, marking_of, outline_of_html


def _p(text: str) -> str:
    return f"<p>{text}</p>"


def _mcq(no: int, text: str = "q") -> str:
    return _p(f"{no}. {text}") + _p("(a) 1 (b) 2 (c) 3 (d) 4")


def _names(outline):
    return [(s["name"], s["from"], s["to"]) for s in outline["sections"]]


# ── sections ─────────────────────────────────────────────────────────────────

def test_front_page_table_of_ranges_names_the_sections():
    """IPMAT: the table on page 1 is read cell by cell by the text layer, and
    the "1–15" cell must not be taken for question 1."""
    html = (
        _p("IPMAT Mock Test 2") + _p("S E C T I O N") + _p("Q U E S T I O N S") + _p("T I M E")
        + _p("English Comprehension") + _p("1–15") + _p("30 minutes")
        + _p("Logical Reasoning") + _p("16–30") + _p("30 minutes")
        + _p("Quantitative Ability and Data Interpretation") + _p("31–60") + _p("60 minutes")
        + _p("Marking · +3 for a correct answer, −1 for an incorrect answer, 0 if unattempted")
        + _p("Instructions to Candidates") + _p("1.") + _p("The paper carries 60 questions.")
        + _p("2.") + _p("Each section is separately timed.")
        + "".join(_mcq(i) for i in range(1, 61))
    )
    o = outline_of_html(html)
    assert o["question_count"] == 60
    assert _names(o) == [
        ("English Comprehension", 1, 15), ("Logical Reasoning", 16, 30),
        ("Quantitative Ability and Data Interpretation", 31, 60),
    ]
    assert [s["source"] for s in o["sections"]] == ["table"] * 3
    assert o["marking"] == {"marks": 3.0, "negative_marks": 1.0}
    assert all(s["marks"] == 3.0 and s["negative_marks"] == 1.0 for s in o["sections"])
    # Each section's time from its table row; the paper's is their sum.
    assert [s["duration_minutes"] for s in o["sections"]] == [30, 30, 60]
    assert o["duration_minutes"] == 120


def test_body_headings_with_marks_from_the_general_instructions():
    """CBSE: numbered general instructions are not questions; "Section B has
    5 questions carrying 02 marks each" gives Section B its marks; a mark
    printed at the question ("[2]") is kept as it is."""
    html = (
        _p("Time allowed: 3 hours") + _p("Maximum Marks: 80")
        + _p("General Instructions:")
        + _p("1. This question paper has 3 sections A-C.")
        + _p("2. Section A has 2 MCQs carrying 1 mark each.")
        + _p("3. Section B has 2 questions carrying 02 marks each.")
        + _p("4. Section C has 1 question carrying 05 marks each.")
        + _p("SECTION A") + _p("Section A consists of 2 questions of 1 mark each.")
        + _mcq(1) + _mcq(2)
        + _p("SECTION – B") + _p("3. Prove that root 2 is irrational. [2]") + _p("4. Find the zeroes.")
        + _p("Section C (Long answer)") + _p("5. Solve the pair of equations.")
        + _p("ANSWER KEY") + _p("1. c 2. c")
    )
    o = outline_of_html(html)
    assert o["question_count"] == 5
    assert _names(o) == [("Section A", 1, 2), ("Section B", 3, 4), ("Section C: Long answer", 5, 5)]
    assert o["duration_minutes"] == 180 and all(s["duration_minutes"] is None for s in o["sections"])
    assert [s["marks"] for s in o["sections"]] == [1.0, 2.0, 5.0]
    qs = [{"question_number": str(i), "question": {"content": "x"}} for i in range(1, 6)]
    qs[2]["marks"] = 3  # the model read "[3]" at Q3: printed at the question wins
    apply_outline(qs, o)
    assert [(q["section"], q["marks"]) for q in qs] == [
        ("Section A", 1.0), ("Section A", 1.0), ("Section B", 3.0), ("Section B", 2.0), ("Section C: Long answer", 5.0),
    ]


def test_a_section_may_restart_numbering_from_one():
    html = _p("PART A") + _mcq(1) + _mcq(2) + _mcq(3) + _p("PART B") + _mcq(1) + _mcq(2)
    o = outline_of_html(html)
    assert o["question_count"] == 3  # distinct numbers, as the count line says
    assert _names(o) == [("Part A", 1, 3), ("Part B", 1, 2)]
    qs = [{"question_number": n, "question": {"content": "x"}} for n in ["1", "2", "3", "1", "2"]]
    apply_outline(qs, o)
    assert [q["section"] for q in qs] == ["Part A", "Part A", "Part A", "Part B", "Part B"]


def test_numbered_statements_inside_a_question_make_no_section():
    html = (
        _mcq(1) + _mcq(2)
        + _p("3. Which statements are true?") + _p("1) s1") + _p("2) s2") + _p("3) s3")
        + _p("(a) 1 and 2 (b) 2 and 3") + _mcq(4) + _mcq(5)
    )
    o = outline_of_html(html)
    assert o["question_count"] == 5
    assert o["sections"] == []


def test_a_plain_paper_has_no_sections_and_no_scheme():
    o = outline_of_html(_mcq(1) + _mcq(2))
    assert o["sections"] == [] and o["marking"] == {"marks": None, "negative_marks": None}
    qs = [{"question_number": "1", "question": {"content": "x"}}]
    apply_outline(qs, o)
    assert qs[0]["section"] is None and qs[0]["marks"] is None and qs[0]["negative_marks"] is None


def test_end_of_section_markers_split_when_nothing_else_does():
    html = _mcq(1) + _mcq(2) + _p("END OF SECTION I") + _mcq(3) + _p("E ND OF SECTION II") + _mcq(4)
    assert _names(outline_of_html(html)) == [("Section I", 1, 2), ("Section II", 3, 3), ("Section 3", 4, 4)]


def test_subject_headings_but_not_instruction_lines():
    html = (
        _p("Read the following passage on economics") + _p("Physics") + _mcq(1) + _mcq(2)
        + _p("Chemistry") + _mcq(3) + _p("Section 3.2 of the Act says") + _mcq(4)
    )
    assert _names(outline_of_html(html)) == [("Physics", 1, 2), ("Chemistry", 3, 4)]


def test_a_single_heading_is_not_a_split():
    assert outline_of_html(_p("SECTION A") + _mcq(1) + _mcq(2))["sections"] == []


# ── the marking scheme ───────────────────────────────────────────────────────

def test_marking_phrasings():
    assert marking_of("+4 for correct, -1 for wrong")["marks"] == 4.0
    assert marking_of("+4 for correct, -1 for wrong")["negative_marks"] == 1.0
    assert marking_of("Each question carries 4 marks. 1 mark will be deducted for each wrong answer.") == {
        "marks": 4.0, "negative_marks": 1.0, "negative_fraction": None}
    assert marking_of("There is no negative marking. Each question carries 2 marks")["negative_marks"] == 0.0
    assert marking_of("Negative marking: 0.25")["negative_marks"] == 0.25
    assert marking_of("Section A (20 x 1 = 20)")["marks"] == 1.0
    assert marking_of("Maximum Marks: 80. Time: 3 hours") == {"marks": None, "negative_marks": None, "negative_fraction": None}


def test_fraction_negative_marking_is_taken_from_the_marks():
    m = marking_of("Each question carries 4 marks. 1/4th of the marks assigned to the question will be deducted for each wrong answer.")
    assert m["marks"] == 4.0 and m["negative_marks"] == 1.0


def test_explicit_deduction_beats_a_no_negative_clause_for_a_subset():
    m = marking_of("For each incorrect answer 1 mark will be deducted. No negative marking for numerical value questions.")
    assert m["negative_marks"] == 1.0


def test_a_section_without_negative_marking_overrides_the_paper():
    html = (
        _p("Each question carries 4 marks. For each incorrect answer 1 mark will be deducted.")
        + _p("SECTION – I (Single Correct)") + _mcq(1) + _mcq(2)
        + _p("SECTION – II (Numerical)") + _p("No negative marking in this section.") + _p("3. The value of g is")
    )
    o = outline_of_html(html)
    assert [(s["marks"], s["negative_marks"]) for s in o["sections"]] == [(4.0, 1.0), (4.0, 0.0)]


# ── the question cursor around instructions ──────────────────────────────────

def test_numbered_general_instructions_are_not_questions():
    blocks = qe.split_blocks(
        _p("General Instructions:") + _p("1. All questions are compulsory.") + _p("2. Use of calculator is not allowed.")
        + _p("SECTION A") + _mcq(1) + _mcq(2) + _mcq(3)
    )
    starts = qe.question_starts(blocks)
    assert sum(starts) == 3 and not starts[1] and not starts[2]


def test_a_short_leading_list_before_a_longer_restart_is_dropped_even_without_a_heading_word():
    blocks = qe.split_blocks(
        _p("Please read:") + _p("1. Be seated.") + _p("2. Keep quiet.")
        + _p("Physics") + "".join(_mcq(i) for i in range(1, 5))
    )
    assert sum(qe.question_starts(blocks)) == 4


def test_a_range_cell_is_not_question_one():
    blocks = qe.split_blocks(_p("English") + _p("1–15") + _p("Maths") + _p("16–30") + _mcq(1) + _mcq(2))
    starts = qe.question_starts(blocks)
    assert sum(starts) == 2 and not starts[1]


def test_a_short_first_section_with_options_is_not_taken_for_a_list():
    """Q1–Q3 with options, no heading, then "SECTION B" restarting at 1 with
    more questions: the first three are questions, not instructions."""
    blocks = qe.split_blocks(_mcq(1) + _mcq(2) + _mcq(3) + _p("SECTION B") + "".join(_mcq(i) for i in range(1, 6)))
    assert sum(qe.question_starts(blocks)) == 8


def test_merge_keeps_both_questions_when_a_section_restarts_numbering():
    q = lambda no, part: {"question_number": no, "question": {"content": f"{part} {no}"}, "options": []}
    merged = qe.merge_questions([[q("1", "A"), q("2", "A"), q("3", "A")], [q("3", "B"), q("1", "B"), q("2", "B")]])
    assert [(x["question_number"], x["question"]["content"][0]) for x in merged] == [
        ("1", "A"), ("2", "A"), ("3", "A"), ("1", "B"), ("2", "B")]


# ── the whole pipeline, model stubbed ────────────────────────────────────────

def test_extract_from_html_names_sections_and_settles_marks(monkeypatch):
    import asyncio
    import json

    html = (
        _p("Each question carries 4 marks. 1 mark will be deducted for each wrong answer.")
        + _p("PHYSICS") + _mcq(1, "A ball") + _mcq(2, "A force")
        + _p("CHEMISTRY") + _p("3. Atomic number of He is [2]")
    )

    async def fake_generate_json(prompt, models, label=""):
        # The model returns the questions of the one part, no marks, no sections.
        data = {"questions": [
            {"question_number": "1", "question": {"type": "HTML", "content": "1. A ball"},
             "options": [{"type": "HTML", "preview_id": "1", "content": "1"}], "question_type": "MCQS", "correct_options": []},
            {"question_number": "2", "question": {"type": "HTML", "content": "2. A force"},
             "options": [{"type": "HTML", "preview_id": "1", "content": "1"}], "question_type": "MCQS", "correct_options": []},
            {"question_number": "3", "question": {"type": "HTML", "content": "3. Atomic number of He is [2]"},
             "options": [], "question_type": "NUMERIC", "ans": "2"},
        ], "title": "Mock"}
        return json.dumps(data), "stub-model", {"prompt_tokens": 10, "completion_tokens": 10}

    monkeypatch.setattr(qe.llm_json, "generate_json", fake_generate_json)
    monkeypatch.setattr(qe, "_charge", lambda **kw: None)
    monkeypatch.setattr(qe, "_estimated_credits", lambda *a: 3.0)

    raw = json.loads(asyncio.run(qe.extract_from_html(html=html, models=["stub"], section_mode=None)))
    assert [(q["section"], q["marks"], q["negative_marks"]) for q in raw["questions"]] == [
        ("Physics", 4.0, 1.0), ("Physics", 4.0, 1.0), ("Chemistry", 2.0, 1.0)]
    summary = raw["extraction"]
    assert summary["section_mode"] == "split"
    assert [(s["name"], s["count"]) for s in summary["sections"]] == [("Physics", 2), ("Chemistry", 1)]
    assert summary["marking"] == {"marks": 4.0, "negative_marks": 1.0}

    raw = json.loads(asyncio.run(qe.extract_from_html(html=html, models=["stub"], section_mode="single")))
    assert raw["extraction"]["section_mode"] == "single"
    assert raw["questions"][0]["section"] == "Physics"  # still named; the preview decides


def test_time_allowed_phrasings():
    from app.services.paper_outline import duration_of

    assert duration_of("Time allowed: 3 hours") == 180
    assert duration_of("Time: 1 hr 30 min · Maximum Marks: 80") == 90
    assert duration_of("Duration – 90 minutes") == 90
    assert duration_of("a 120-minute limit") == 120
    assert duration_of("Maximum Marks: 80") is None
    assert duration_of("Questions 1 to 15 · 30 minutes") is None  # bare minutes only count on a section's own line
    assert duration_of("Questions 1 to 15 · 30 minutes", loose=True) == 30
