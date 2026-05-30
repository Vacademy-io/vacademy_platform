"""Offline parity test for the migrated AI evaluation tool (WS11, lean scope).

Covers: both ported prompts (extract + evaluate), EvaluationUserDTO snake_case
parsing, initial WAITING payload + envelope, status mapping (PROGRESS→PROCESSING),
the kickoff orchestration (metadata fetch → create task → return PROCESSING +
launch background), and the background per-student flow (status transitions +
incremental persists + COMPLETED, plus the 'File Still Processing' failure path).

Run:
    cd vacademy_platform/ai_service && PYTHONPATH=.. APP_ENV=local \
        .venv/bin/python tests/test_evaluation_parity.py
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ai_service.app.models.ai_task import AiTaskStatus
from ai_service.app.schemas.evaluation import EvaluationUserDTO
from ai_service.app.services import evaluation_service as ES
from ai_service.app.services.ai_prompts import evaluation as P


def _user(**kw):
    return EvaluationUserDTO(**kw)


def test_dto_snake_case() -> None:
    u = EvaluationUserDTO.model_validate(
        {"id": "u1", "response_id": "pdf-1", "full_name": "Alice", "email": "a@x.com", "contact_number": "123"}
    )
    assert (u.id, u.response_id, u.full_name, u.email, u.contact_number) == (
        "u1", "pdf-1", "Alice", "a@x.com", "123"
    )
    print("  ✓ EvaluationUserDTO: snake_case body parsing")


def test_extract_prompt() -> None:
    sections = [
        {
            "id": "s1",
            "name": "Section A",
            "questions": [
                {"questionOrder": 1, "reachText": {"id": "q1", "content": 'What is "X"?'}},
            ],
        }
    ]
    html = '<p>my answer</p><mjx-container>JUNK</mjx-container>'
    out = P.build_extract_prompt(sections, html)
    assert "extracting answers from a student's HTML answer sheet" in out
    assert "Section Name: Section A" in out and "Section ID: s1" in out
    assert "Question Order: 1" in out and "Question ID: q1" in out
    assert 'Question Text: [[What is \\"X\\"?]]' in out          # " escaped, [[ ]] wrapped
    assert "<mjx-container>" not in out and "JUNK" not in out     # mjx stripped
    assert "[[<p>my answer</p>]]" in out                          # answer sheet wrapped
    print("  ✓ extract prompt: sections+questions listed, [[ ]] wrap, \" escape, mjx strip")


def test_evaluate_prompt() -> None:
    extracted = [{"section_id": "s1", "question_wise_ans_extracted": []}]
    metadata = {"assessmentId": "a1", "sections": [{"id": "s1", "questions": [{"markingJson": "[]"}]}]}
    out = P.build_evaluate_prompt(extracted, metadata)
    assert "evaluating the student's answers" in out
    assert "\nMetadata:\n" + json.dumps(metadata) in out
    assert "\n\nStudent Answers:\n" + json.dumps(extracted) in out
    print("  ✓ evaluate prompt: instructions + metadata JSON + student answers JSON")


def test_initial_data_and_envelope() -> None:
    data = ES._build_initial_data([_user(id="u1", response_id="r1", full_name="A", email="e", contact_number="9")])
    assert data == [
        {"user_id": "u1", "name": "A", "email": "e", "contact_number": "9", "response_id": "r1",
         "section_wise_ans_extracted": None, "evaluation_result": None, "status": "WAITING"}
    ]
    env = json.loads(ES._result_json(data))
    assert list(env.keys()) == ["evaluation_data"] and env["evaluation_data"][0]["status"] == "WAITING"
    print("  ✓ initial data: provided id→user_id, WAITING; envelope {evaluation_data:[...]}")


def test_status_mapping() -> None:
    def fake_repo_factory(rows):
        class FakeRepo:
            def __init__(self, db):
                pass

            def get(self, tid):
                return rows.get(tid)

        return FakeRepo

    rows = {
        "p": SimpleNamespace(id="p", status=AiTaskStatus.PROGRESS.value, result_json='{"evaluation_data":[]}'),
        "c": SimpleNamespace(id="c", status=AiTaskStatus.COMPLETED.value, result_json="{}"),
        "f": SimpleNamespace(id="f", status=AiTaskStatus.FAILED.value, result_json="Error occurred: File Still Processing"),
    }
    ES.AiTaskRepository = fake_repo_factory(rows)
    assert ES.get_task_update(None, "p")["status"] == "PROCESSING"
    assert ES.get_task_update(None, "c")["status"] == "COMPLETED"
    f = ES.get_task_update(None, "f")
    assert f["status"] == "FAILED" and "File Still Processing" in f["response"]
    assert ES.get_task_update(None, "missing") is None
    print("  ✓ status: PROGRESS→PROCESSING, COMPLETED, FAILED(+msg), missing→None(404)")


def test_kickoff_orchestration() -> None:
    async def run():
        async def fake_metadata(aid):
            return {"sections": [{"id": "s1", "name": "S", "questions": []}]}

        captured = {}

        def fake_create(initial):
            captured["initial"] = initial
            return "task-1"

        bg = {"called": False}

        async def fake_run(**kw):
            bg["called"] = True
            captured["bg_kw"] = kw

        ES.assessment_client.get_evaluation_metadata = fake_metadata
        ES._create_task = fake_create
        ES._run_evaluation = fake_run

        resp = await ES.start_evaluation(
            assessment_id="a1",
            users=[_user(id="u1", response_id="r1", full_name="A", email="e", contact_number="9")],
            models=["m1"], institute_id="inst", user_id="user-1",
        )
        await asyncio.sleep(0)  # let the background task start

        assert resp["task_id"] == "task-1" and resp["status"] == "PROCESSING"
        env = json.loads(resp["response"])
        assert env["evaluation_data"][0]["user_id"] == "u1" and env["evaluation_data"][0]["status"] == "WAITING"
        assert captured["initial"] == resp["response"]   # task seeded with the WAITING payload
        assert bg["called"] and captured["bg_kw"]["task_id"] == "task-1"
        assert captured["bg_kw"]["models"] == ["m1"] and captured["bg_kw"]["institute_id"] == "inst"

    asyncio.run(run())
    print("  ✓ kickoff: metadata→create(seed WAITING)→return PROCESSING→launch background")


def test_background_flow_and_failure() -> None:
    async def run():
        # --- happy path ---
        persists = []

        async def fake_persist(task_id, result_json, status):
            stval = status.value if hasattr(status, "value") else status
            body = json.loads(result_json) if result_json.lstrip().startswith("{") else result_json
            persists.append((stval, body))

        async def fake_html(rid):
            return "<p>ans</p>"

        async def fake_extract(sections, html, models, inst, uid):
            return [{"section_id": "s1", "question_wise_ans_extracted": []}]

        async def fake_eval(extracted, metadata, models, inst, uid):
            return {"total_marks_obtained": 5.0, "total_marks": 10.0, "section_wise_results": []}

        ES._persist = fake_persist
        ES._answer_html = fake_html
        ES._extract = fake_extract
        ES._evaluate = fake_eval

        data = ES._build_initial_data([_user(id="u1", response_id="r1", full_name="A", email="e", contact_number="9")])
        await ES._run_evaluation(
            task_id="t1", metadata={"sections": [{"id": "s1", "name": "S", "questions": []}]},
            data=data, models=["m"], institute_id="i", user_id="u",
        )

        # row statuses: 4× PROGRESS then COMPLETED
        row_statuses = [p[0] for p in persists]
        assert row_statuses == ["PROGRESS", "PROGRESS", "PROGRESS", "PROGRESS", "COMPLETED"], row_statuses
        # student status progression
        student_statuses = [p[1]["evaluation_data"][0]["status"] for p in persists]
        assert student_statuses == ["EXTRACTING_ANSWER", "EXTRACTING_ANSWER", "EVALUATING",
                                    "EVALUATION_COMPLETED", "EVALUATION_COMPLETED"], student_statuses
        final = persists[-1][1]["evaluation_data"][0]
        assert final["section_wise_ans_extracted"] == [{"section_id": "s1", "question_wise_ans_extracted": []}]
        assert final["evaluation_result"]["total_marks_obtained"] == 5.0

        # --- failure path: answer sheet still processing ---
        fail_persists = []

        async def fake_persist2(task_id, result_json, status):
            stval = status.value if hasattr(status, "value") else status
            fail_persists.append((stval, result_json))

        async def fake_html_fail(rid):
            raise RuntimeError("File Still Processing")

        ES._persist = fake_persist2
        ES._answer_html = fake_html_fail
        data2 = ES._build_initial_data([_user(id="u2", response_id="r2", full_name="B", email="e2", contact_number="8")])
        await ES._run_evaluation(
            task_id="t2", metadata={"sections": []}, data=data2, models=["m"], institute_id="i", user_id="u",
        )
        assert fail_persists[-1][0] == "FAILED"
        assert fail_persists[-1][1] == "Error occurred: File Still Processing"

    asyncio.run(run())
    print("  ✓ background: status transitions + incremental persists + COMPLETED; failure→FAILED 'File Still Processing'")


def main() -> int:
    tests = [
        test_dto_snake_case,
        test_extract_prompt,
        test_evaluate_prompt,
        test_initial_data_and_envelope,
        test_status_mapping,
        test_background_flow_and_failure,
        test_kickoff_orchestration,
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
