"""Offline parity test for the migrated retry dispatcher (WS12).

Verifies use_case_for() routing and that make_work() reconstructs the correct
pipeline per task type from the persisted params (with the model swapped in),
plus NotRetryable for chat/evaluation/unknown types.

Run:
    cd vacademy_platform/ai_service && PYTHONPATH=.. APP_ENV=local \
        .venv/bin/python tests/test_retry_parity.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ai_service.app.services import retry_dispatch as RD


def test_use_case_for() -> None:
    assert RD.use_case_for("LECTURE_PLANNER") == "lecture"
    assert RD.use_case_for("LECTURE_FEEDBACK") == "lecture"
    assert RD.use_case_for("PDF_TO_QUESTIONS") == "questions"
    assert RD.use_case_for("AUDIO_TO_QUESTIONS") == "questions"
    print("  ✓ use_case_for: lecture types → 'lecture', else 'questions'")


def test_not_retryable() -> None:
    for t in ("CHAT_WITH_PDF", "EVALUATION", "SOMETHING_ELSE"):
        raised = False
        try:
            RD.make_work(t, {}, ["m"], institute_id="i", user_id="u", task_id="t")
        except RD.NotRetryable:
            raised = True
        assert raised, f"{t} should be NotRetryable"
    print("  ✓ make_work: chat/evaluation/unknown → NotRetryable")


def test_lecture_planner_work() -> None:
    cap = {}
    RD.lecture_planner_service.build_prompt = lambda **kw: (cap.update({"prompt_kw": kw}) or "PROMPT")

    class _Res:
        content_json = '{"plan":1}'

    async def fake_generate(prompt, primary_model, fallback_models):
        cap["gen"] = (prompt, primary_model, fallback_models)
        return _Res()

    RD.lecture_planner_service.generate = fake_generate
    RD.lecture_planner_service.record_lecture_billing = lambda **kw: cap.update({"billed": kw})

    work = RD.make_work(
        "LECTURE_PLANNER",
        {"userPrompt": "teach X", "lectureDuration": "30", "language": "en",
         "methodOfTeaching": "lecture", "level": "beginner"},
        ["gpt", "fb"], institute_id="inst", user_id="u1", task_id="newt",
    )
    out = asyncio.run(work())
    assert out == '{"plan":1}'
    assert cap["prompt_kw"]["user_prompt"] == "teach X" and cap["prompt_kw"]["lecture_duration"] == "30"
    assert cap["gen"] == ("PROMPT", "gpt", ["fb"])
    assert cap["billed"]["task_id"] == "newt" and cap["billed"]["institute_id"] == "inst"
    print("  ✓ LECTURE_PLANNER: rebuild prompt → generate(model) → bill(new task) → content_json")


def test_text_questions_work_num_to_str() -> None:
    cap = {}

    async def fake_from_text(**kw):
        cap.update(kw)
        return "QJSON"

    RD.question_gen_service.questions_from_text = fake_from_text
    work = RD.make_work(
        "TEXT_TO_QUESTIONS",
        {"text": "body", "num": 12, "question_type": "MCQS", "class_level": "10",
         "topics": "algebra", "question_language": "en", "generate_image": False},
        ["m1", "m2"], institute_id="i", user_id="u", task_id="t",
    )
    out = asyncio.run(work())
    assert out == "QJSON"
    assert cap["text"] == "body" and cap["number_of_questions"] == "12"  # int → str
    assert cap["type_of_question"] == "MCQS" and cap["generate_image"] is False
    assert cap["models"] == ["m1", "m2"]
    print("  ✓ TEXT_TO_QUESTIONS: num int→str, params mapped, models passed")


def test_pdf_family_uses_poll() -> None:
    cap = {}

    async def fake_html(pdf_id, allow_poll):
        cap["html_args"] = (pdf_id, allow_poll)
        return "<p>H</p>"

    async def fake_from_html(**kw):
        cap["html_kw"] = kw
        return "QH"

    async def fake_topic(**kw):
        cap["topic_kw"] = kw
        return "QT"

    async def fake_extract(**kw):
        cap["extract_kw"] = kw
        return "QE"

    RD.pdf_questions_service.fetch_or_convert_html = fake_html
    RD.question_gen_service.questions_from_html = fake_from_html
    RD.question_gen_service.questions_topic_wise = fake_topic
    RD.question_gen_service.questions_extract_topic = fake_extract

    # PDF_TO_QUESTIONS
    w = RD.make_work("PDF_TO_QUESTIONS", {"pdfId": "p1", "userPrompt": "do it", "generateImage": True},
                     ["m"], institute_id="i", user_id="u", task_id="t")
    assert asyncio.run(w()) == "QH"
    assert cap["html_args"] == ("p1", True)  # background retry polls MathPix
    assert cap["html_kw"]["user_prompt"] == "do it"

    # SORT_QUESTIONS_TOPIC_WISE
    w = RD.make_work("SORT_QUESTIONS_TOPIC_WISE", {"pdfId": "p2", "generateImage": False},
                     ["m"], institute_id="i", user_id="u", task_id="t")
    assert asyncio.run(w()) == "QT" and cap["topic_kw"]["generate_image"] is False

    # PDF_TO_QUESTIONS_WITH_TOPIC
    w = RD.make_work("PDF_TO_QUESTIONS_WITH_TOPIC", {"pdfId": "p3", "requiredTopics": "T1,T2", "generateImage": True},
                     ["m"], institute_id="i", user_id="u", task_id="t")
    assert asyncio.run(w()) == "QE" and cap["extract_kw"]["required_topics"] == "T1,T2"
    print("  ✓ PDF family: fetch_or_convert_html(allow_poll=True) → html/topic/extract with mapped params")


def test_audio_work() -> None:
    cap = {}

    async def fake_audio(**kw):
        cap.update(kw)
        return "AUD"

    RD.audio_questions_service.transcribe_and_generate = fake_audio
    w = RD.make_work(
        "AUDIO_TO_QUESTIONS",
        {"fileId": "f1", "numQuestions": "20", "difficulty": "hard", "language": "en",
         "prompt": "p", "generateImage": True},
        ["m"], institute_id="i", user_id="u", task_id="t",
    )
    assert asyncio.run(w()) == "AUD"
    assert cap["file_id"] == "f1" and cap["num_questions"] == "20"
    assert cap["optional_prompt"] == "p" and cap["difficulty"] == "hard"
    print("  ✓ AUDIO_TO_QUESTIONS: transcribe_and_generate with mapped params")


def main() -> int:
    tests = [
        test_use_case_for,
        test_not_retryable,
        test_lecture_planner_work,
        test_text_questions_work_num_to_str,
        test_pdf_family_uses_poll,
        test_audio_work,
    ]
    failed = 0
    for t in tests:
        print(f"\n{t.__name__}:")
        try:
            t()
        except AssertionError as e:
            failed += 1
            print(f"  ✗ FAILED: {e}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"  ✗ ERROR: {type(e).__name__}: {e}")
    print("\n" + ("ALL PASSED" if not failed else f"{failed} FAILED"))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
