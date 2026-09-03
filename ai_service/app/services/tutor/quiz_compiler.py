"""Deterministic plan for a QUIZ slide: no model call.

One topic "Quick check", an opening concept, then one concept per question
whose check IS the question. The board shows the stem (and options for MCQ)
so the learner sees what they are answering; the say text reads it aloud.
"""
from __future__ import annotations

from typing import Dict, List

from ...schemas.tutor import (
    BulletOp, Check, ConceptDraft, HeadingOp, KeyTerm, TeachingPlanDraft, TextOp, TopicDraft,
)
from .slide_source import SlideSource

_INTRO = {
    "en": "Let's check what you remember from this chapter, {student_name}. I will ask a few quick questions; answer in your own words and we'll see how it goes.",
    "hi": "चलो देखते हैं {student_name}, इस अध्याय से आपको क्या याद है। मैं कुछ छोटे सवाल पूछूँगी; अपने शब्दों में जवाब दीजिए।",
}
_ASK = {"en": "Question {n}: {stem}", "hi": "सवाल {n}: {stem}"}
_ASK_OPTIONS = {"en": " The options are: {opts}.", "hi": " विकल्प हैं: {opts}।"}
_RUBRIC_MCQ = {"en": "Full credit for choosing: {answer}. No partial credit.", "hi": "सही विकल्प: {answer}। आंशिक अंक नहीं।"}
_RUBRIC_OPEN = {"en": "Full credit when the answer matches: {answer}. Half credit for the right idea in the wrong words.", "hi": "पूरा अंक जब उत्तर मेल खाए: {answer}। सही विचार पर आधा अंक।"}


def _t(table: Dict[str, str], lang: str, **kw: str) -> str:
    return table.get(lang, table["en"]).format(**kw)


def _shorten(text: str, n: int = 140) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= n else text[: n - 1] + "…"


def compile_quiz(source: SlideSource, lang: str = "en") -> TeachingPlanDraft:
    other = "hi" if lang == "en" else "en"
    concepts: List[ConceptDraft] = [
        ConceptDraft(
            id="t1c1",
            title=f"Quick check: {source.title or 'this chapter'}",
            concept_tags=["quiz.intro"],
            board_ops=[
                HeadingOp(op="heading", id="t1-h", text=_shorten(source.title or "Quick check", 60)),
                TextOp(op="text", id="t1c1-t", text=f"{len(source.questions)} question(s)"),
            ],
            say=_t(_INTRO, lang, student_name="{student_name}"),
            say_i18n={other: _t(_INTRO, other, student_name="{student_name}")},
            teach_notes="Warm-up. Do not teach here; the questions are the lesson.",
            check=Check(type="none"),
        )
    ]
    for i, q in enumerate(source.questions, start=1):
        is_mcq = q.question_type in ("MCQS", "MCQM", "MCQ", "TRUE_FALSE") and q.options
        opts = [o["text"] for o in q.options if o["text"]]
        answer = "; ".join(q.correct_texts) if q.correct_texts else (q.explanation or "")
        say = _t(_ASK, lang, n=str(i), stem=_shorten(q.stem, 220))
        say_o = _t(_ASK, other, n=str(i), stem=_shorten(q.stem, 220))
        if is_mcq and opts:
            say += _t(_ASK_OPTIONS, lang, opts="; ".join(_shorten(o, 60) for o in opts[:6]))
            say_o += _t(_ASK_OPTIONS, other, opts="; ".join(_shorten(o, 60) for o in opts[:6]))
        board = [TextOp(op="text", id=f"t1c{i + 1}-q", text=_shorten(f"Q{i}. {q.stem}", 200))]
        if is_mcq and opts:
            board.append(BulletOp(op="bullet", id=f"t1c{i + 1}-o", items=[_shorten(o, 70) for o in opts[:6]]))
        rubric = _t(_RUBRIC_MCQ if is_mcq else _RUBRIC_OPEN, lang, answer=_shorten(answer, 200) or "(see explanation)")
        concepts.append(ConceptDraft(
            id=f"t1c{i + 1}",
            title=_shorten(f"Question {i}", 40),
            concept_tags=[f"quiz.q{i}"],
            board_ops=board,
            say=say,
            say_i18n={other: say_o},
            teach_notes=(q.explanation or "Ask, wait, then confirm the correct answer briefly.")[:600],
            check=Check(
                type="mcq" if is_mcq else "open",
                prompt=_shorten(q.stem, 400),
                options=opts[:6] if is_mcq else [],
                expected=_shorten(answer, 400) or None,
                rubric=rubric,
                misconceptions=[],
                pass_threshold=1.0 if is_mcq else 0.7,
            ),
        ))
    topic = TopicDraft(
        id="t1",
        title=f"Quick check: {source.title or 'chapter'}",
        estimated_seconds=45 * max(1, len(source.questions)),
        concepts=concepts,
        summary_ops=[],
    )
    return TeachingPlanDraft(
        language=lang,
        objectives=[f"Recall the key points checked by {len(source.questions)} question(s)"],
        key_terms=[KeyTerm(term="quiz", meaning="a quick check of understanding")],
        topics=[topic],
    )
