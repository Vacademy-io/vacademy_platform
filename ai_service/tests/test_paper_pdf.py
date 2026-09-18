"""The printed paper must match what the teacher reviewed.

`build_paper_html` is the pure half of the PDF export (the other half is
Chromium). These pin the layout rules a teacher notices first on a printout:
questions grouped under the blueprint's sections and numbered continuously
across them, marks in the margin and per-section totals, an answer key only
when asked for, and nothing executable carried in from generated HTML.
"""
from app.services.kb import paper_pdf
from app.services.kb.paper import Blueprint


def _blueprint():
    return Blueprint.from_dict({
        "title": "Class 10 Science — Acids and Bases — Unit Test",
        "duration_minutes": 90,
        "instructions": ["All questions are compulsory.", "Each question carries the marks shown."],
        "rows": [
            {"id": "row-1", "section": "Section A", "topic": "pH", "question_type": "MCQS",
             "count": 2, "marks_each": 1, "instruction": "Choose the correct option."},
            {"id": "row-2", "section": "Section B", "topic": "pH", "question_type": "LONG_ANSWER",
             "count": 1, "marks_each": 3, "instruction": "Answer in about 60 words."},
        ],
    })


def _mcq(number, row="row-1", section="Section A", marks=1.0):
    return {
        "question_number": number, "question_type": "MCQS",
        "question": {"type": "HTML", "content": f"<p>MCQ {number}: what is $pH = -\\log[H^+]$?</p>"},
        "options": [
            {"preview_id": "1", "content": "It increases"},
            {"preview_id": "2", "content": "It decreases"},
            {"preview_id": "3", "content": "Unchanged"},
            {"preview_id": "4", "content": "Zero"},
        ],
        "correct_options": ["2"], "ans": "It decreases", "exp": "Dilution lowers concentration.",
        "marking_steps": ["Identify dilution.", "Answer: It decreases."],
        "kb_meta": {"row_id": row, "section": section, "marks": marks, "figures": []},
    }


def _long(number, row="row-2", section="Section B", marks=3.0):
    return {
        "question_number": number, "question_type": "LONG_ANSWER",
        "question": {"type": "HTML", "content": "<p>Explain a universal indicator.<script>alert(1)</script></p>"},
        "options": [], "correct_options": [],
        "ans": "It shows different colours at different pH.",
        "exp": "Colour change<br>Links colour to pH",
        "kb_meta": {"row_id": row, "section": section, "marks": marks,
                    "figures": [{"image_url": "https://cdn.example.com/fig1.png", "page_number": 8}]},
    }


def test_sections_in_blueprint_order_with_continuous_numbering():
    # Raw numbering restarts per section (1, 2 / 1); the sheet must not.
    html = paper_pdf.build_paper_html(_blueprint(), [_mcq(1), _mcq(2), _long(1)],
                                      institute_name="Vacademy")
    assert html.index("Section A") < html.index("Section B")
    assert '<div class="num">1.</div>' in html
    assert '<div class="num">2.</div>' in html
    assert '<div class="num">3.</div>' in html
    assert html.count('<div class="num">1.</div>') == 1
    # Header strip: duration in words, marks summed from the questions, not the plan.
    assert "Time Allowed: 1 hour 30 minutes" in html
    assert "Maximum Marks: 5" in html
    assert "VACADEMY" in html.upper() and "Vacademy" in html
    # Per-section line and per-row instruction.
    assert "2 questions × 1 mark = 2 marks" in html
    assert "1 question × 3 marks = 3 marks" in html
    assert "Choose the correct option." in html
    assert "[3]" in html  # marks in the margin


def test_options_are_lettered_and_math_triggers_katex():
    html = paper_pdf.build_paper_html(_blueprint(), [_mcq(1)])
    assert "(a)" in html and "(d)" in html
    assert "katex.min.js" in html  # $…$ present → typesetting loaded


def test_no_math_means_no_cdn_and_ready_flag_is_set():
    q = _long(1)
    html = paper_pdf.build_paper_html(_blueprint(), [q])
    assert "katex.min.js" not in html
    assert "window.__paperReady = true" in html


def test_answer_key_only_when_asked_and_carries_marking_steps():
    without = paper_pdf.build_paper_html(_blueprint(), [_mcq(1), _long(1)])
    assert "Answer Key" not in without
    with_key = paper_pdf.build_paper_html(_blueprint(), [_mcq(1), _long(1)], include_answer_key=True)
    assert "Answer Key &amp; Marking Scheme" in with_key
    assert "(b) It decreases" in with_key           # option letter, not the preview id
    assert "Identify dilution." in with_key         # marking steps
    assert "Colour change" in with_key              # exp split on <br> when no steps
    assert with_key.index("Answer Key") > with_key.index('<div class="num">2.</div>')


def test_generated_html_is_stripped_of_scripts_and_figures_are_attached():
    html = paper_pdf.build_paper_html(_blueprint(), [_long(1)])
    assert "<script>alert(1)</script>" not in html
    assert 'src="https://cdn.example.com/fig1.png"' in html


def test_orphan_question_is_kept_not_dropped():
    # The teacher removed row-2 after generating; its question still prints.
    bp = _blueprint()
    bp.rows = bp.rows[:1]
    html = paper_pdf.build_paper_html(bp, [_mcq(1), _long(1)])
    assert "Explain a universal indicator." in html
    assert "Section B" in html


def test_show_marks_false_hides_margin_and_totals():
    html = paper_pdf.build_paper_html(_blueprint(), [_mcq(1)], show_marks=False)
    assert "[1]" not in html
    assert "× 1 mark" not in html


def test_filename_is_a_safe_slug():
    assert paper_pdf.paper_filename("Class 10: Science / Unit Test", with_key=True) == \
        "Class-10-Science-Unit-Test-with-answer-key.pdf"
    assert paper_pdf.paper_filename("", with_key=False) == "question-paper.pdf"


def test_letterhead_has_logo_and_contact_and_footer_names_institute():
    html = paper_pdf.build_paper_html(
        _blueprint(), [_mcq(1)],
        institute_name="Oriental Group Of Institution",
        logo_url="https://cdn.example.com/logo.png",
        contact_line="www.oriental.edu · info@oriental.edu",
    )
    assert 'class="logo" src="https://cdn.example.com/logo.png"' in html
    assert "www.oriental.edu · info@oriental.edu" in html
    assert 'class="brand"' in html            # logo + text side by side
    assert 'class="rule"' in html
    # No logo → the name is centred on its own; no brand block without either.
    assert 'class="brand centered"' in paper_pdf.build_paper_html(_blueprint(), [_mcq(1)], institute_name="X")
    assert 'class="brand' not in paper_pdf.build_paper_html(_blueprint(), [_mcq(1)])


def test_publish_variant_and_subtitle():
    from app.services.kb import paper_publish

    assert paper_publish.variant_for(True) == "with_answer_key"
    assert paper_publish.variant_for(False) == "question_paper"
    assert paper_publish.paper_subtitle({"curriculum": {"board": "NCERT", "class": "10", "subject": "Science"}}) \
        == "Class 10 · Science · NCERT"
    assert paper_publish.paper_subtitle({"curriculum": None}) is None
