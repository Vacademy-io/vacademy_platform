"""Engagement build (review of 2026-09-05): diagram gate + auto layout, the
soft engagement rules, columns, predict-then-reveal, live notes, the
sentence segmenter and the learner's pace — the parts without a DB."""
from app.schemas.tutor import TeachingPlanDraft
from app.services.tutor import board_ops
from app.services.tutor.plan_validator import DEFAULT_LIMITS, QUIZ_LIMITS, soft_errors, validate_plan
from app.services.tutor.svg_check import auto_layout_svg, check_svg_geometry
from app.services.tutor.runtime import state as sm
from app.services.tutor.runtime.decision import _sanitize_ops
from app.routers.tutor_ws import PACE_MULTIPLIER, _step_pace, _tutor_segments

GOOD_SVG = ("<svg viewBox='0 0 640 360'><g id='a'><rect x='40' y='120' width='200' height='80' rx='10' fill='#DBEAFE' stroke='#1D4ED8' stroke-width='2'/>"
            "<text x='140' y='166' text-anchor='middle' font-size='18'>Impairment</text></g>"
            "<g id='b'><rect x='400' y='120' width='200' height='80' rx='10' fill='#DCFCE7' stroke='#15803D' stroke-width='2'/>"
            "<text x='500' y='166' text-anchor='middle' font-size='18'>Disability</text></g>"
            "<line x1='240' y1='160' x2='396' y2='160' stroke='#475569' stroke-width='2'/></svg>")
BAD_SVG = ('<svg viewBox="0 0 400 150"><text x="30" y="75" font-size="14">Clinical Information</text>'
           '<path d="M 150 75 L 250 75" stroke="black" fill="none"/><text x="165" font-size="14">Assessment</text></svg>')


def test_svg_gate_flags_the_real_bad_diagram_and_passes_a_good_one():
    assert check_svg_geometry(GOOD_SVG) == []
    errs = check_svg_geometry(BAD_SVG)
    text = " ".join(errs)
    assert "viewBox is 400x150" in text and "no y coordinate" in text and "14px" in text


def test_auto_layout_draws_every_part_with_ids_and_passes_the_gate():
    parts = [{"id": "impairment", "label": "Impairment", "step": 0}, {"id": "limitation", "label": "Functional Limitation", "step": 1},
             {"id": "disability", "label": "Disability", "step": 2}]
    svg, used = auto_layout_svg("Levels of disablement", parts)
    assert check_svg_geometry(svg, used) == []
    assert [u["id"] for u in used] == ["impairment", "limitation", "disability"] and used[2]["step"] == 2
    assert svg.count("<g id=") == 3 and "marker-end" in svg and board_ops.sanitize_svg(svg)


def _plan(quick=True, with_engagement=True):
    def check(kind, prompt, i):
        c = {"type": kind, "prompt": prompt, "expected": "x", "hint": "think about the body part first", "pass_threshold": 0.7}
        if kind == "mcq":
            c["options"] = ["a", "b", "c"]
        return c
    topics = []
    for t in range(2):
        concepts = []
        for c in range(3):
            cid = f"t{t + 1}c{c + 1}"
            ops = [{"op": "heading", "id": f"{cid}-h", "text": "T", "say_index": 0},
                   {"op": "svg", "id": f"{cid}-s", "svg": GOOD_SVG, "description": "two boxes and a line", "parts": [{"id": "a", "label": "A"}], "say_index": 1}]
            if c == 1 and with_engagement:
                ops.append({"op": "callout", "id": f"{cid}-e", "kind": "example", "text": "A pianist with arthritis.", "say_index": 1})
            concept = {"id": cid, "title": f"C{c}", "board_ops": ops, "say": "One idea. Another idea.", "say_i18n": {"hi": "एक। दो।"},
                       "check": check("mcq" if (quick and c == 1) else "open", "Why is that?", c) if c > 0 else {"type": "none"}}
            if t > 0 and c == 0 and with_engagement:
                concept["predict"] = "What do you think happens next?"
            concepts.append(concept)
        topic = {"id": f"t{t + 1}", "title": f"Topic {t}", "concepts": concepts,
                 "summary_ops": [{"op": "bullet", "id": f"t{t + 1}-recap", "items": ["one", "two", "three"]}] if with_engagement else [],
                 "summary_say": "That is the topic in short." if with_engagement else None}
        topics.append(topic)
    return TeachingPlanDraft.model_validate({"language": "en", "objectives": ["o"], "topics": topics})


def test_engagement_rules_are_soft_and_specific():
    good = _plan()
    assert validate_plan(good, "en", limits=DEFAULT_LIMITS, require_media_urls=False) == []
    assert soft_errors(good) == []
    bare = _plan(quick=False, with_engagement=False)
    assert validate_plan(bare, "en", limits=DEFAULT_LIMITS, require_media_urls=False) == []   # still a valid plan
    text = " ".join(soft_errors(bare))
    assert "recap bullet" in text and "summary_say" in text and "'example'" in text and "predict" in text and "quick" in text
    assert soft_errors(bare, limits=QUIZ_LIMITS) == []   # quizzes are exempt


def test_columns_validate_render_and_count_words():
    op = {"op": "columns", "id": "cmp", "columns": [
        [{"op": "heading", "id": "l-h", "text": "Physical"}, {"op": "bullet", "id": "l-b", "items": ["body", "structure"]}],
        [{"op": "heading", "id": "r-h", "text": "Functional"}, {"op": "bullet", "id": "r-b", "items": ["tasks", "daily life"]}],
    ]}
    errors, ids = board_ops.validate_ops([op], set(), where="x.")
    assert errors == [] and {"cmp", "l-h", "l-b", "r-h", "r-b"} <= ids
    assert board_ops.op_words(op) == 7
    html = board_ops.materialize([op])
    assert 'class="tb-columns tb-columns-2"' in html and html.count('class="tb-col"') == 2 and 'data-op-id="r-b"' in html
    bad = dict(op, columns=[[{"op": "annotate", "id": "z", "target": "l-h", "text": "no"}]])
    errs, _ = board_ops.validate_ops([bad], set(), where="x.")
    assert any("columns needs 2 or 3" in e for e in errs) and any("may only hold" in e for e in errs)
    assert board_ops.clean_ops([op])[0]["columns"][0][0]["id"] == "l-h"


def test_predict_then_reveal_in_the_state_machine():
    L = sm.from_plan_view({
        "plan_id": "p", "slide_id": "s", "version": 1, "language": "en", "objectives": [],
        "topics": [
            {"id": "t1", "title": "A", "order": 1, "summary_ops": [], "summary_say": "Recap one.", "concepts": [
                {"id": "a", "title": "a", "order": 1, "concept_tags": [], "board_ops": [], "say": "s", "say_i18n": {}, "teach_notes": None, "check": {"type": "none"}}]},
            {"id": "t2", "title": "B", "order": 2, "summary_ops": [], "concepts": [
                {"id": "b", "title": "b", "order": 1, "concept_tags": [], "board_ops": [{"op": "text", "id": "x", "text": "y"}], "say": "s",
                 "say_i18n": {}, "teach_notes": None, "check": {"type": "open", "prompt": "q", "expected": "e", "hint": "a nudge here"}, "predict": "Guess?"}]},
        ],
    })
    assert L.topics[0].summary_say == "Recap one." and L.topics[1].concepts[0].hint == "a nudge here"
    s = sm.enter(L, sm.Pointer())
    assert s.kind == "teach"
    s = sm.after_teach(L, s.pointer)                 # topic 1 done → summary
    assert s.kind == "topic_summary"
    s = sm.next_topic(L, s.pointer)                  # topic 2 opens with a guess, board cleared
    assert s.kind == "predict" and s.pointer.phase == sm.PREDICT and s.clear_board and s.board_ops == []
    s = sm.after_predict(L, s.pointer)               # then the teaching, without clearing again
    assert s.kind == "teach" and s.pointer.predicted and not s.clear_board and s.board_ops
    # repeat keeps the guess answered; advancing to a new concept resets it
    assert sm.repeat(L, s.pointer).pointer.predicted is True


def test_live_note_is_allowed_once_and_only_while_remediating():
    board = [{"op": "heading", "id": "h", "text": "x"}]
    ops = [{"op": "callout", "kind": "example", "text": " ".join(["w"] * 50)},
           {"op": "callout", "kind": "tip", "text": "second"},
           {"op": "highlight", "target": "h"}]
    out = _sanitize_ops(ops, board, action="remediate")
    notes = [o for o in out if o.get("note")]
    assert len(notes) == 1 and len(notes[0]["text"].split()) == 30 and notes[0]["id"].startswith("live-note")
    assert any(o["op"] == "highlight" for o in out)
    assert not any(o.get("note") for o in _sanitize_ops(ops, board, action="advance"))


def test_sentence_segments_and_pace_steps():
    segs = _tutor_segments("One short idea. Another one here! A third, with a question? " + "x" * 199 + ". Last.")
    assert segs[0] == ("One short idea. Another one here! A third, with a question?", 0, 3)
    assert segs[1][1] == 3 and segs[1][2] == 1 and len(segs[1][0]) > 150    # a long sentence is never cut
    assert segs[2] == ("Last.", 4, 1)
    assert _step_pace("normal", -1) == "slow" and _step_pace("slow", -1) == "slower" and _step_pace("slower", -1) == "slower"
    assert _step_pace("normal", 1) == "fast" and _step_pace("fast", 1) == "fast"
    assert PACE_MULTIPLIER["slower"] < PACE_MULTIPLIER["slow"] < PACE_MULTIPLIER["normal"] < PACE_MULTIPLIER["fast"]
