"""Offline contract test for the migrated Lecture-feedback feature.

No network/DB. Verifies the feedback response shape (camelCase, nested, nulls),
the prompt builder, the WPM helper, and that the service orchestrates
fileId→URL → transcribe → LLM → bill with stubs.

Run:
    cd vacademy_platform/ai_service && PYTHONPATH=.. APP_ENV=local \
        .venv/bin/python tests/test_lecture_feedback_parity.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ai_service.app.schemas.lecture_feedback import LectureFeedbackResponse
from ai_service.app.services import lecture_feedback_service as LF
from ai_service.app.services.ai_prompts import lecture_feedback as fb_prompts
from ai_service.app.models.ai_token_usage import RequestType

FEEDBACK_KEYS = ["title", "reportTitle", "lectureInfo", "totalScore", "criteria", "summary"]
INFO_KEYS = ["lectureTitle", "duration", "evaluationDate"]
CRITERIA_KEYS = ["name", "score", "points", "scopeOfImprovement"]
POINT_KEYS = ["title", "description"]


def test_feedback_response_shape() -> None:
    llm = {
        "title": "Newton's Laws", "reportTitle": "Lecture Review",
        "lectureInfo": {"lectureTitle": "Motion", "duration": "40m", "evaluationDate": "2026-05-30"},
        "totalScore": "82",
        "criteria": [{
            "name": "Delivery & Presentation", "score": "16",
            "points": [{"title": "Clarity", "description": ["Clear voice", "Good pace"]}],
            "scopeOfImprovement": ["Slow down on derivations"],
        }],
        "summary": ["Strong lecture"], "EXTRA": "drop",
    }
    out = LectureFeedbackResponse.model_validate(llm).model_dump(by_alias=True)
    assert list(out.keys()) == FEEDBACK_KEYS, out.keys()
    assert list(out["lectureInfo"].keys()) == INFO_KEYS
    assert list(out["criteria"][0].keys()) == CRITERIA_KEYS
    assert list(out["criteria"][0]["points"][0].keys()) == POINT_KEYS
    assert "EXTRA" not in out
    print("  ✓ feedback response shape (camelCase, nested, extras dropped)")


def test_empty_feedback_shape() -> None:
    out = LectureFeedbackResponse().model_dump(by_alias=True)
    assert list(out.keys()) == FEEDBACK_KEYS
    assert all(out[k] is None for k in out)
    print("  ✓ empty feedback has full null key set")


def test_prompt_and_wpm() -> None:
    assert LF._words_per_minute(900, 600.0) == "90"  # 900 words / 10 min
    assert LF._words_per_minute(None, 600.0) == "unknown"
    assert LF._words_per_minute(900, 0) == "unknown"
    p = fb_prompts.build_prompt("hello world", '{"word_count": 900}', "90")
    assert "hello world" in p and "90 WordsPerMinute" in p
    assert "{{" not in p and "}}" not in p
    print("  ✓ WPM helper + prompt builder")


def test_service_orchestration() -> None:
    captured = {}

    async def fake_get_url(file_id, expiry_days=7):
        captured["file_id"] = file_id
        return "https://s3/audio.mp3"

    class FakeTr:
        text = "Today we cover Newton's laws ..."
        duration_seconds = 600.0
        word_count = 900
        detected_language = "en"
        status = {"duration_seconds": 600.0, "word_count": 900, "detected_language": "en",
                  "output_urls": {"txt": "https://s3/t.txt"}}

    async def fake_transcribe(url, language=None, model_size="small"):
        captured["url"] = url
        return FakeTr()

    async def fake_gen(prompt, models, **kw):
        captured["prompt"] = prompt
        return '{"title":"T","totalScore":"80"}', "google/gemini-2.5-flash", {"prompt_tokens": 5, "completion_tokens": 9, "total_tokens": 14}

    def fake_bill(**kw):
        captured["bill"] = kw

    LF.media_file_client.get_file_url = fake_get_url
    LF.transcription_inprocess.transcribe = fake_transcribe
    LF.llm_json.generate_json = fake_gen
    LF.ai_billing.record_llm_billing = fake_bill

    out = asyncio.run(LF.generate_feedback_result(
        file_id="file-123", primary_model="google/gemini-2.5-flash", fallback_models=[],
        institute_id="inst-1", user_id="user-1",
    ))
    assert out == '{"title":"T","totalScore":"80"}'
    assert captured["file_id"] == "file-123" and captured["url"] == "https://s3/audio.mp3"
    # transcript text + the quality metadata (NOT the s3 output_urls) embedded in prompt
    assert "Newton's laws" in captured["prompt"] and "output_urls" not in captured["prompt"]
    assert "90 WordsPerMinute" in captured["prompt"]  # 900/10min
    assert captured["bill"]["request_type"] == RequestType.LECTURE
    assert captured["bill"]["total_tokens"] == 14
    print("  ✓ service orchestrates fileId→URL→transcribe→LLM→bill (no s3 urls in prompt)")


def main() -> int:
    tests = [
        test_feedback_response_shape,
        test_empty_feedback_shape,
        test_prompt_and_wpm,
        test_service_orchestration,
    ]
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
