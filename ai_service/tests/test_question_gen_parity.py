"""Offline contract test for migrated text/HTML question generation (WS6).

Covers the engine (auto_evaluation_json shapes, normalization), the DS_TAG
protect/restore round-trip, the image no-op path, and the html/text service
flows with the LLM + image steps stubbed.

Run:
    cd vacademy_platform/ai_service && PYTHONPATH=.. APP_ENV=local \
        .venv/bin/python tests/test_question_gen_parity.py
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ai_service.app.services import question_gen_service as QG
from ai_service.app.services import question_format as QF
from ai_service.app.utils.html_tags import HtmlTagProtector

_LLM_OUT = json.dumps({
    "questions": [
        {"question": {"type": "HTML", "content": "2+2?"},
         "options": [{"preview_id": "1", "content": "3"}, {"preview_id": "2", "content": "4"}],
         "correct_options": ["2"], "ans": "4", "exp": "add", "question_type": "MCQS",
         "tags": ["math"], "level": "easy"},
    ],
    "title": "Quiz", "tags": ["t"], "difficulty": "easy", "subjects": ["math"], "classes": ["class 9"],
})


def test_dstag_roundtrip() -> None:
    p = HtmlTagProtector()
    html = '<p>Q</p> <img src="x.png"/> <svg><path/></svg>'
    prot = p.protect(html)
    assert "<img" not in prot and "<svg" not in prot and "DS_TAG" in prot
    llm = json.dumps({"questions": [{"question": {"type": "HTML", "content": prot}}]})
    restored = p.restore_in_json(llm)
    assert "<img" in restored and "<svg" in restored and "DS_TAG" not in restored
    print("  ✓ DS_TAG protect/restore round-trip")


def test_html_flow_and_convert() -> None:
    captured = {}

    async def fake_gen(prompt, models, **kw):
        captured["prompt"] = prompt
        return _LLM_OUT, "google/gemini-2.5-flash", {"prompt_tokens": 5, "completion_tokens": 9, "total_tokens": 14}

    async def fake_images(json_str, generate_image):
        captured["img_called"] = generate_image
        return json_str

    def fake_bill(*a, **k):
        captured["billed"] = True

    QG.llm_json.generate_json = fake_gen
    QG.question_images.process_and_generate_images = fake_images
    QG.ai_billing.record_llm_billing = fake_bill

    raw = asyncio.run(QG.questions_from_html(
        html="<p>2+2?</p>", user_prompt=None, generate_image=True,
        models=["google/gemini-2.5-flash"], institute_id="i", user_id="u",
    ))
    assert "image_to_generate" in captured["prompt"]  # image instruction injected
    assert captured["billed"] and captured["img_called"] is True
    # the endpoint converts raw -> AutoQuestionPaperResponse
    resp = QF.convert_to_question_paper_response(raw).model_dump()
    q = resp["questions"][0]
    assert q["auto_evaluation_json"] == '{"type":"MCQS","data":{"correct_option_ids":["2"]}}'
    assert q["question_type"] == "MCQS" and q["question_response_type"] == "OPTION"
    assert resp["title"] == "Quiz"
    print("  ✓ html flow: image instruction + bill + convert to AutoQuestionPaperResponse")


def test_text_flow_no_image_instruction_when_off() -> None:
    captured = {}

    async def fake_gen(prompt, models, **kw):
        captured["prompt"] = prompt
        return _LLM_OUT, "m", {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}

    async def fake_images(json_str, generate_image):
        return json_str

    QG.llm_json.generate_json = fake_gen
    QG.question_images.process_and_generate_images = fake_images
    QG.ai_billing.record_llm_billing = lambda *a, **k: None

    raw = asyncio.run(QG.questions_from_text(
        text="Newton's laws", number_of_questions="5", type_of_question="MCQS",
        class_level="9", topics="motion", question_language="english",
        generate_image=False, models=["m"], institute_id="i", user_id="u",
    ))
    assert "image_to_generate" not in captured["prompt"]  # no image instruction when off
    assert "5 MCQS questions" in captured["prompt"] and "motion" in captured["prompt"]
    assert QF.convert_to_question_paper_response(raw).model_dump()["questions"][0]["question_type"] == "MCQS"
    print("  ✓ text flow: no image instruction when generate_image off + prompt vars")


def test_image_processor_noop() -> None:
    from ai_service.app.services.question_images import process_and_generate_images
    js = json.dumps({"questions": [{"question": {"type": "HTML", "content": "no markers"}}]})
    assert asyncio.run(process_and_generate_images(js, True)) == js
    assert asyncio.run(process_and_generate_images(js, False)) == js
    print("  ✓ image processor no-op when no marker / disabled")


def main() -> int:
    tests = [test_dstag_roundtrip, test_html_flow_and_convert,
             test_text_flow_no_image_instruction_when_off, test_image_processor_noop]
    failed = 0
    for t in tests:
        print(f"\n{t.__name__}:")
        try:
            t()
        except AssertionError as e:
            failed += 1
            print(f"  ✗ FAILED: {e}")
    print("\n" + ("ALL PASSED" if not failed else f"{failed} FAILED"))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
