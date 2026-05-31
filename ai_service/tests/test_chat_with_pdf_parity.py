"""Offline parity test for migrated Chat-with-PDF (WS10).

Covers: the ported prompt template (placeholder binding + brace-safety for
HTML/JSON values), the ChatWithPdfResponse snake_case contract, the row→response
mapping (to_chat_response: question=user, parent_id null, lenient skip), the
ConversationDto last-5 serialization (newest→oldest re-sort), and the
generate_chat_response orchestration (StillProcessing propagation, prompt
assembly, persist, billing, full-history return).

Run:
    cd vacademy_platform/ai_service && PYTHONPATH=.. APP_ENV=local \
        .venv/bin/python tests/test_chat_with_pdf_parity.py
"""
from __future__ import annotations

import asyncio
import json
import sys
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ai_service.app.models.ai_task import AiTask, AiTaskInputType, AiTaskStatus, AiTaskType
from ai_service.app.schemas.chat_with_pdf import ChatWithPdfResponse
from ai_service.app.services import chat_with_pdf_service as CS
from ai_service.app.services.ai_prompts import chat_with_pdf as prompts


def _row(rid, user, response, created, parent_id=None, result_override=None):
    t = AiTask(
        id=rid,
        task_type=AiTaskType.CHAT_WITH_PDF.value,
        status=AiTaskStatus.COMPLETED.value,
        institute_id="inst-1",
        input_id="pdf-1",
        input_type=AiTaskInputType.PDF_ID.value,
        parent_id=parent_id,
        result_json=result_override
        if result_override is not None
        else json.dumps({"user": user, "response": response}),
    )
    t.created_at = created
    return t


def test_prompt_binding_and_brace_safety() -> None:
    # HTML + history values intentionally contain literal braces (real PDF HTML
    # / serialized JSON do). str.format must NOT re-interpret braces in VALUES,
    # and must collapse the doubled literal braces in the TEMPLATE.
    html = "<div style='a:{b}'>x{y}</div>"
    last5 = json.dumps([{"user": "hi", "aiResponse": "<p>{z}</p>", "createdAt": "t"}])
    out = prompts.build_prompt(html_text=html, user_prompt="What is X?", last5_conversation=last5)

    assert html in out, "htmlText value (with braces) must pass through verbatim"
    assert last5 in out, "last5Conversation JSON (with braces) must pass through verbatim"
    # userPrompt appears 3× (User Chat line, JSON example, IMPORTANT line)
    assert out.count("What is X?") == 3
    # doubled template braces collapsed to single around the JSON example
    assert '"user" : "What is X?"' in out
    assert '"response" : "String"' in out
    # no stray format tokens left
    assert "{htmlText}" not in out and "{userPrompt}" not in out and "{last5Conversation}" not in out
    print("  ✓ prompt: 3× userPrompt, brace-safe values, braces collapsed")


def test_schema_snake_case_contract() -> None:
    dumped = ChatWithPdfResponse(
        id="r1", created_at="2024-01-01T00:00:00", question="q", response="<p>a</p>", parent_id=None
    ).model_dump()
    assert set(dumped.keys()) == {"id", "created_at", "question", "response", "parent_id"}
    print("  ✓ ChatWithPdfResponse keys == media snake_case set")


def test_to_chat_response_mapping() -> None:
    ts = datetime(2024, 6, 1, 12, 0, tzinfo=timezone.utc)
    row = _row("r1", "the question", "<p>the answer</p>", ts, parent_id="head-id")
    mapped = row.to_chat_response()
    assert mapped == {
        "id": "r1",
        "created_at": ts.isoformat(),
        "question": "the question",       # from result_json "user"
        "response": "<p>the answer</p>",  # from result_json "response"
        "parent_id": None,                # intentionally null (getPdfChatResponse)
    }
    # lenient skip on unparseable / blank result_json
    assert _row("r2", "", "", ts, result_override="not json").to_chat_response() is None
    assert _row("r3", "", "", ts, result_override="").to_chat_response() is None
    print("  ✓ to_chat_response: user→question, response, parent_id null, lenient skip")


def _patch_db(monkey_rows):
    """Point CS.db_session/CS.AiTaskRepository at an in-memory fake."""

    class FakeRepo:
        def __init__(self, db):
            pass

        def list_last_chat_turns(self, institute_id, input_id, limit=5):
            # repo returns newest-first
            return list(reversed(monkey_rows))[:limit]

        def list_chat_turns(self, institute_id, input_id):
            return list(monkey_rows)  # oldest-first

    @contextmanager
    def fake_session():
        yield object()

    CS.db_session = fake_session
    CS.AiTaskRepository = FakeRepo


def test_last5_conversation_serialization() -> None:
    ts1 = datetime(2024, 1, 1, tzinfo=timezone.utc)
    ts2 = datetime(2024, 1, 2, tzinfo=timezone.utc)
    rows = [_row("a", "q1", "a1", ts1), _row("b", "q2", "a2", ts2)]  # oldest-first
    _patch_db(rows)
    out = json.loads(CS._load_last5_json("inst-1", "pdf-1"))
    # re-sorted oldest→newest, ConversationDto shape {user, aiResponse, createdAt}
    assert out == [
        {"user": "q1", "aiResponse": "a1", "createdAt": ts1.isoformat()},
        {"user": "q2", "aiResponse": "a2", "createdAt": ts2.isoformat()},
    ]
    print("  ✓ last-5: ConversationDto shape, oldest→newest order")


def test_generate_chat_response_orchestration() -> None:
    ts = datetime(2024, 1, 1, tzinfo=timezone.utc)
    history_rows = [_row("h1", "q1", "<p>a1</p>", ts)]
    _patch_db(history_rows)

    captured = {}

    async def fake_html(pdf_id, allow_poll):
        captured["html_args"] = (pdf_id, allow_poll)
        return "<p>PDF BODY</p>"

    async def fake_llm(prompt, models, label="llm"):
        captured["prompt"] = prompt
        captured["models"] = models
        return json.dumps({"user": "q1", "response": "<p>a1</p>"}), "google/gemini-2.5-flash", {
            "prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15,
        }

    def fake_persist(institute_id, pdf_id, result_json, task_name, parent_id):
        captured["persist"] = dict(
            institute_id=institute_id, pdf_id=pdf_id, result_json=result_json,
            task_name=task_name, parent_id=parent_id,
        )

    def fake_bill(**kwargs):
        captured["bill"] = kwargs

    CS.pdf_questions_service.fetch_or_convert_html = fake_html
    CS.llm_json.generate_json = fake_llm
    CS._persist_turn = fake_persist
    CS.ai_billing.record_llm_billing = fake_bill

    result = asyncio.run(
        CS.generate_chat_response(
            pdf_id="pdf-1", user_prompt="q1", task_name="t",
            institute_id="inst-1", parent_id="", models=["m1", "m2"], user_id="u1",
        )
    )

    # PDF fetched sync (allow_poll=False) so StillProcessing can surface as 425
    assert captured["html_args"] == ("pdf-1", False)
    # prompt carries the PDF body + the question
    assert "<p>PDF BODY</p>" in captured["prompt"] and "q1" in captured["prompt"]
    assert captured["models"] == ["m1", "m2"]
    # raw parentId forwarded to the persist layer (normalization happens there)
    assert captured["persist"]["parent_id"] == ""
    assert captured["persist"]["result_json"] == json.dumps({"user": "q1", "response": "<p>a1</p>"})
    # billed as CONVERSATION with the model that answered
    assert captured["bill"]["request_type"].value == "conversation"
    assert captured["bill"]["model"] == "google/gemini-2.5-flash"
    # returns full history as ChatWithPdfResponse dicts
    assert result == [
        {"id": "h1", "created_at": ts.isoformat(), "question": "q1",
         "response": "<p>a1</p>", "parent_id": None}
    ]
    print("  ✓ generate_chat_response: PDF→prompt→LLM→persist(None parent)→bill→history")


def test_persist_turn_normalizes_blank_parent() -> None:
    """First-turn parentId '' must persist as NULL (thread head); a real
    parentId persists verbatim. Verified by capturing the AiTask handed to
    db.add()."""

    class FakeDb:
        def __init__(self):
            self.added = None

        def add(self, obj):
            self.added = obj

        def commit(self):
            pass

    captured = {}

    @contextmanager
    def fake_session():
        db = FakeDb()
        try:
            yield db
        finally:
            captured["task"] = db.added

    CS.db_session = fake_session

    CS._persist_turn("inst-1", "pdf-1", '{"user":"q","response":"a"}', "tn", "")
    head = captured["task"]
    assert head.parent_id is None and head.status == AiTaskStatus.COMPLETED.value
    assert head.task_type == AiTaskType.CHAT_WITH_PDF.value
    assert head.input_type == AiTaskInputType.PDF_ID.value and head.input_id == "pdf-1"

    CS._persist_turn("inst-1", "pdf-1", '{"user":"q2","response":"a2"}', "tn", "head-id")
    assert captured["task"].parent_id == "head-id"
    print("  ✓ _persist_turn: ''→NULL head, real parentId verbatim, COMPLETED/CHAT_WITH_PDF/PDF_ID")


def test_still_processing_propagates() -> None:
    async def raise_still(pdf_id, allow_poll):
        raise CS.pdf_questions_service.StillProcessing(pdf_id)

    CS.pdf_questions_service.fetch_or_convert_html = raise_still
    raised = False
    try:
        asyncio.run(
            CS.generate_chat_response(
                pdf_id="pdf-x", user_prompt="q", task_name="t",
                institute_id="i", parent_id=None, models=["m"], user_id=None,
            )
        )
    except CS.pdf_questions_service.StillProcessing:
        raised = True
    assert raised, "StillProcessing must propagate (router maps it to 425)"
    print("  ✓ StillProcessing propagates from generate_chat_response → 425")


def main() -> int:
    tests = [
        test_prompt_binding_and_brace_safety,
        test_schema_snake_case_contract,
        test_to_chat_response_mapping,
        test_last5_conversation_serialization,
        test_persist_turn_normalizes_blank_parent,
        test_generate_chat_response_orchestration,
        test_still_processing_propagates,
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
