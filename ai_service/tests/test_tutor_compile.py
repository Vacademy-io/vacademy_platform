"""Live AI Tutor compiler — the contracts everything else hangs off.

Board ops: only whitelisted ops, stable unique ids, safe SVG, https media, and
a deterministic HTML render. Validator: small boards, narration in both
languages, checks on every concept but a topic's first. Quiz compiler: a quiz
slide becomes a plan with no model call, correct answers resolved from every
auto_evaluation_json shape the platform has used. Prompt helper: JSON is
extracted from fenced or chatty replies.
"""
import json

import pytest

from app.schemas.tutor import TeachingPlanDraft
from app.services.tutor import board_ops, compile_prompts
from app.services.tutor.plan_validator import validate_plan
from app.services.tutor.quiz_compiler import compile_quiz
from app.services.tutor.slide_source import QuizQuestion, SlideSource, _correct_option_ids, html_to_text


# ── board ops ────────────────────────────────────────────────────────────────

def test_sanitize_svg_strips_scripts_and_keeps_part_ids():
    raw = ('<svg viewBox="0 0 100 100"><script>alert(1)</script>'
           '<circle id="nucleus" cx="50" cy="50" r="10" onclick="x()"/>'
           '<a href="javascript:evil()"><text x="1" y="2">hi</text></a></svg>')
    out = board_ops.sanitize_svg(raw)
    assert "<script" not in out and "onclick" not in out and "javascript:" not in out
    assert 'id="nucleus"' in out
    assert board_ops.svg_ids(out) == {"nucleus"}


def test_materialize_escapes_text_and_renders_each_op():
    ops = [
        {"op": "heading", "id": "h", "text": "<b>Force</b>"},
        {"op": "bullet", "id": "b", "items": ["push", "pull"]},
        {"op": "formula", "id": "f", "latex": "F = m a"},
        {"op": "image", "id": "i", "url": "https://x.test/a.png", "description": "a ball"},
        {"op": "image", "id": "bad", "url": "http://x.test/a.png", "description": "insecure"},
        {"op": "callout", "id": "c", "text": "tip", "kind": "tip"},
        {"op": "annotate", "id": "a", "target": "b", "text": "note"},
        {"op": "highlight", "target": "b"},
    ]
    html = board_ops.materialize(ops)
    assert "&lt;b&gt;Force&lt;/b&gt;" in html and "<b>Force" not in html
    assert 'data-op-id="b"' in html and "<li>push</li>" in html
    assert 'data-latex="F = m a"' in html
    assert 'src="https://x.test/a.png"' in html
    assert "http://x.test" not in html            # non-https image dropped
    assert 'data-target="b"' in html
    assert "highlight" not in html                 # live-only op leaves no mark


def test_validate_ops_rejects_live_ops_duplicates_and_dangling_targets():
    ops = [
        {"op": "text", "id": "a", "text": "x"},
        {"op": "text", "id": "a", "text": "dup"},
        {"op": "annotate", "id": "n", "target": "missing", "text": "?"},
        {"op": "reveal", "target": "a"},
        {"op": "svg", "id": "s", "svg": "<svg><rect id='r'/></svg>", "description": "d", "parts": [{"id": "nope", "label": "x"}]},
    ]
    errors, ids = board_ops.validate_ops(ops)
    joined = " | ".join(errors)
    assert "duplicate element id 'a'" in joined
    assert "annotate target 'missing'" in joined
    assert "'reveal' is a live-session op" in joined
    assert "svg part id 'nope'" in joined
    assert ids == {"a", "n", "s"}


# ── validator ────────────────────────────────────────────────────────────────

def _plan(**overrides):
    base = {
        "language": "en",
        "objectives": ["Define force"],
        "key_terms": [{"term": "force", "meaning": "a push or a pull"}],
        "topics": [{
            "id": "t1", "title": "What is a force?", "estimated_seconds": 120,
            "concepts": [
                {"id": "t1c1", "title": "Push and pull", "concept_tags": ["force.definition"],
                 "board_ops": [{"op": "heading", "id": "t1-h", "text": "What is force?"},
                               {"op": "bullet", "id": "t1c1-b", "items": ["A push or a pull"]}],
                 "say": "A force is a push or a pull. Look at the board.",
                 "say_i18n": {"hi": "बल एक धक्का या खिंचाव है।"},
                 "check": {"type": "none"}},
                {"id": "t1c2", "title": "Examples", "concept_tags": ["force.examples"],
                 "board_ops": [{"op": "text", "id": "t1c2-t", "text": "Kicking a ball is a push."}],
                 "say": "Kicking a ball is a push. Pulling a rope is a pull.",
                 "say_i18n": {"hi": "गेंद को लात मारना धक्का है।"},
                 "check": {"type": "open", "prompt": "Give one push and one pull.",
                           "expected": "any push and any pull", "rubric": "one of each", "pass_threshold": 0.7}},
            ],
        }],
    }
    base.update(overrides)
    return TeachingPlanDraft.model_validate(base)


def test_valid_plan_passes():
    assert validate_plan(_plan(), "en") == []


def test_validator_catches_missing_translation_check_and_word_bloat():
    p = _plan()
    p.topics[0].concepts[1].say_i18n = {}
    p.topics[0].concepts[1].check.type = "none"
    p.topics[0].concepts[0].board_ops[1].items = ["word"] * 80
    errors = " | ".join(validate_plan(p, "en"))
    assert "say_i18n['hi'] is missing" in errors
    assert "only the first concept of a topic may skip its check" in errors
    assert "keep a concept under" in errors


def test_validator_rejects_ids_reused_across_concepts():
    p = _plan()
    p.topics[0].concepts[1].board_ops[0].id = "t1c1-b"
    errors = " | ".join(validate_plan(p, "en"))
    assert "duplicate element id 't1c1-b'" in errors


# ── quiz compiler ────────────────────────────────────────────────────────────

def _quiz_source():
    q1 = QuizQuestion(id="q1", order=1, question_type="MCQS", stem="What is 2+2?",
                      options=[{"id": "o1", "text": "3"}, {"id": "o2", "text": "4"}],
                      correct_option_ids=["o2"], correct_texts=["4"])
    q2 = QuizQuestion(id="q2", order=2, question_type="LONG_ANSWER", stem="Explain gravity.",
                      correct_texts=[], explanation="Mass attracts mass.")
    return SlideSource(slide_id="s", title="Arithmetic check", source_type="QUIZ", source_id="qs",
                       kind="quiz", questions=[q1, q2])


def test_quiz_compiles_deterministically_and_validates():
    draft = compile_quiz(_quiz_source(), "en")
    assert validate_plan(draft, "en") == []
    t = draft.topics[0]
    assert len(t.concepts) == 3
    assert t.concepts[0].check.type == "none"
    assert t.concepts[1].check.type == "mcq" and t.concepts[1].check.options == ["3", "4"]
    assert t.concepts[1].check.expected == "4" and t.concepts[1].check.pass_threshold == 1.0
    assert t.concepts[2].check.type == "open" and "Mass attracts" in (t.concepts[2].check.expected or "")
    assert "{student_name}" in t.concepts[0].say
    assert t.concepts[1].say_i18n["hi"]


@pytest.mark.parametrize("auto_json,expected", [
    ('{"correctAnswers":[1]}', ["o2"]),                      # 0-based index (copilot)
    ('{"correctAnswers":["o1"]}', ["o1"]),                   # option ids
    ('{"data":{"correctOptionIds":["o2"]}}', ["o2"]),        # nested shape
    ('{"validAnswers":["2"]}', ["o2"]),                      # 1-based string
    ('not json', []),
    (None, []),
])
def test_correct_option_ids_handles_every_shape(auto_json, expected):
    options = [{"id": "o1", "text": "3"}, {"id": "o2", "text": "4"}]
    assert _correct_option_ids(auto_json, options) == expected


# ── source text + prompts ────────────────────────────────────────────────────

def test_html_to_text_keeps_structure_and_drops_scripts():
    html = "<h2>Force</h2><script>x</script><p>A push or a pull.</p><ul><li>push</li><li>pull</li></ul><img alt='ball'>"
    txt = html_to_text(html)
    assert "## Force" in txt and "- push" in txt and "[image: ball]" in txt and "x" != txt.strip()
    assert "script" not in txt


def test_extract_json_tolerates_fences_and_prose():
    obj = {"topics": []}
    assert compile_prompts.extract_json("```json\n" + json.dumps(obj) + "\n```") == obj
    assert compile_prompts.extract_json("Here you go: " + json.dumps(obj) + " done") == obj
    assert compile_prompts.extract_json("no json here") is None


def test_prompts_mention_both_languages_and_ops():
    sys_ = compile_prompts.system_prompt("Asha", "en")
    assert "Asha" in sys_ and "media_task" not in sys_.split("BOARD OPERATIONS")[0]
    user = compile_prompts.user_prompt(slide_title="Force", chapter_title="Motion", course_title="Physics",
                                       slide_kind="document", source_text="A force is a push.", lang="en")
    assert '"say_i18n": {"hi"' in user and "SLIDE MATERIAL" in user
    media = compile_prompts.media_task_user_prompt(slide_title="Cell video", chapter_title=None, course_title=None,
                                                   kind="video", description="It shows the parts of a cell.", lang="hi")
    assert '"media_task"' in media and '"say_i18n": {"en"' in media
