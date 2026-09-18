"""The teacher's question mix is a contract, not a suggestion.

When the wizard sends a type plan ("10 MCQ × 1, 5 short × 3"), the blueprint
that comes back must carry exactly those counts and marks whatever the model
proposed — a paper header saying "Maximum Marks: 25" has to be true.
"""
from app.services.kb.paper import Blueprint, apply_type_plan


def _bp(rows):
    return Blueprint.from_dict({"title": "t", "rows": rows})


def test_counts_rescaled_marks_set_sections_relettered():
    bp = _bp([
        {"id": "row-1", "section": "Section A", "topic": "pH", "node_ids": ["n1"], "question_type": "MCQS", "count": 6, "marks_each": 2},
        {"id": "row-2", "section": "Section A", "topic": "Salts", "node_ids": ["n2"], "question_type": "MCQS", "count": 3, "marks_each": 2},
        {"id": "row-3", "section": "Section B", "topic": "Indicators", "node_ids": ["n3"], "question_type": "LONG_ANSWER", "count": 4, "marks_each": 5},
        {"id": "row-4", "section": "Section C", "topic": "Extra", "node_ids": ["n4"], "question_type": "NUMERIC", "count": 2, "marks_each": 2},
    ])
    apply_type_plan(bp, [
        {"question_type": "MCQS", "count": 10, "marks_each": 1, "label": "Multiple choice"},
        {"question_type": "LONG_ANSWER", "count": 5, "marks_each": 3, "label": "Short answer", "instruction": "Answer in about 60 words."},
    ], ["n1", "n2", "n3"])
    mcq = [r for r in bp.rows if r.question_type == "MCQS"]
    long = [r for r in bp.rows if r.question_type == "LONG_ANSWER"]
    assert sum(r.count for r in mcq) == 10 and all(r.marks_each == 1 for r in mcq)
    assert [r.count for r in mcq] == [7, 3]            # 6:3 split kept, scaled to 10
    assert sum(r.count for r in long) == 5 and long[0].marks_each == 3
    assert long[0].instruction == "Answer in about 60 words."
    assert not [r for r in bp.rows if r.question_type == "NUMERIC"]   # not in the mix → dropped
    assert [r.section for r in bp.rows] == ["Section A", "Section A", "Section B"]
    assert bp.total_questions == 15 and bp.total_marks == 25


def test_missing_type_gets_a_row_on_the_whole_selection():
    bp = _bp([{"id": "row-1", "section": "Section A", "topic": "pH", "node_ids": ["n1"], "question_type": "MCQS", "count": 4, "marks_each": 1}])
    apply_type_plan(bp, [
        {"question_type": "MCQS", "count": 4, "marks_each": 1},
        {"question_type": "TRUE_FALSE", "count": 3, "marks_each": 1, "label": "True or false"},
    ], ["n1", "n2"])
    tf = [r for r in bp.rows if r.question_type == "TRUE_FALSE"]
    assert len(tf) == 1 and tf[0].count == 3 and tf[0].node_ids == ["n1", "n2"]
    assert tf[0].section == "Section B" and tf[0].topic == "True or false"
    assert len({r.id for r in bp.rows}) == len(bp.rows)     # ids stay unique


def test_zero_count_entries_are_skipped_and_unknown_types_default():
    bp = _bp([])
    apply_type_plan(bp, [
        {"question_type": "ESSAY", "count": 2, "marks_each": 5},
        {"question_type": "MCQS", "count": 0, "marks_each": 1},
    ], ["n1"])
    assert len(bp.rows) == 1 and bp.rows[0].question_type == "MCQS" and bp.rows[0].count == 2
