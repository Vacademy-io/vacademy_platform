"""Offline contract-parity test for the migrated lecture planner.

Pins the ai_service response shapes to the media_service contract they replace,
so a drift (renamed/missing/extra key, wrong casing) fails loudly in CI without
needing live services. The expected shapes below are transcribed from the Java
source:
  - AiLectureController#getLecturePlanner       → kick-off
  - TaskGetController#getTaskStatus             → get-status
  - TaskGetController#getRawResult              → get-raw-result
  - dto/lecture/LecturePlanDto (+ nested)       → get/lecture-plan

Run:
    cd vacademy_platform/ai_service && PYTHONPATH=.. APP_ENV=local \
        .venv/bin/python tests/test_lecture_parity.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from ai_service.app.models.ai_task import AiTask, AiTaskStatus
from ai_service.app.schemas.ai_task import LecturePlanKickoffResponse, LecturePlanResponse
from ai_service.app.services import lecture_planner_service as L


# ---- Expected contract (from Java) -----------------------------------------

KICKOFF_KEYS = {"taskId", "status", "model", "message"}
GET_STATUS_KEYS = {
    "taskId", "status", "statusMessage", "type", "taskName",
    "hasResult", "createdAt", "updatedAt",
}
GET_RAW_RESULT_KEYS = {"taskId", "status", "resultJson", "statusMessage"}

# LecturePlanDto + nested DTOs (camelCase wire keys).
LECTURE_PLAN_KEYS = {
    "heading", "mode", "duration", "language", "level",
    "timeWiseSplit", "assignment", "summary",
}
TIME_SPLIT_KEYS = {
    "sectionHeading", "timeSplit", "content",
    "topicCovered", "questionToStudents", "activity",
}
ASSIGNMENT_KEYS = {"topicCovered", "tasks"}


def _check(name: str, got: set, expected: set) -> None:
    assert got == expected, (
        f"{name} key set drift:\n  missing={expected - got}\n  extra={got - expected}"
    )
    print(f"  ✓ {name}: {sorted(got)}")


def test_kickoff_shape() -> None:
    r = LecturePlanKickoffResponse(taskId="t1", model="google/gemini-2.5-flash")
    payload = r.model_dump()
    _check("kick-off", set(payload), KICKOFF_KEYS)
    assert payload["status"] == "STARTED", payload["status"]
    assert payload["message"] == "Lecture plan generation started"


def test_get_status_shape() -> None:
    task = AiTask(id="t1", status=AiTaskStatus.PROGRESS.value, task_type="LECTURE_PLANNER")
    _check("get-status", set(task.to_status_dict()), GET_STATUS_KEYS)
    # hasResult is a real bool, and empty timestamps degrade to "" (not None).
    d = task.to_status_dict()
    assert d["hasResult"] is False
    assert d["createdAt"] == "" and d["updatedAt"] == ""


def test_get_raw_result_shape() -> None:
    task = AiTask(id="t1", status="COMPLETED", result_json='{"heading":"H"}')
    d = task.to_raw_result_dict()
    _check("get-raw-result", set(d), GET_RAW_RESULT_KEYS)
    assert d["resultJson"] == '{"heading":"H"}'


def test_lecture_plan_shape() -> None:
    full = {
        "heading": "H", "mode": "Concept First", "duration": "40 minutes",
        "language": "en", "level": "9th",
        "timeWiseSplit": [{
            "sectionHeading": "Intro", "timeSplit": "1-5mins", "content": "...",
            "topicCovered": ["a"], "questionToStudents": ["q"], "activity": ["act"],
        }],
        "assignment": {"topicCovered": ["t"], "tasks": ["hw"]},
        "summary": ["s"],
    }
    out = LecturePlanResponse.model_validate(full).model_dump(by_alias=True)
    _check("lecture-plan", set(out), LECTURE_PLAN_KEYS)
    _check("lecture-plan.timeWiseSplit[]", set(out["timeWiseSplit"][0]), TIME_SPLIT_KEYS)
    _check("lecture-plan.assignment", set(out["assignment"]), ASSIGNMENT_KEYS)


def test_empty_plan_shape() -> None:
    # Not-ready / parse-failure path returns an empty plan with the SAME key set
    # (all null), matching Java `new LecturePlanDto()`.
    out = LecturePlanResponse().model_dump(by_alias=True)
    _check("empty lecture-plan", set(out), LECTURE_PLAN_KEYS)
    assert all(out[k] is None for k in out)


def test_json_sanitizer() -> None:
    assert L.extract_and_sanitize_json("```json\n{\"heading\": \"H\"}\n```") == '{"heading": "H"}'
    assert L.extract_and_sanitize_json("blah {\"a\": 1} tail") == '{"a": 1}'
    assert L.extract_and_sanitize_json("no json here") is None
    assert L.extract_and_sanitize_json("") is None
    print("  ✓ json sanitizer: fenced / embedded / garbage / empty")


def main() -> int:
    tests = [
        test_kickoff_shape,
        test_get_status_shape,
        test_get_raw_result_shape,
        test_lecture_plan_shape,
        test_empty_plan_shape,
        test_json_sanitizer,
    ]
    failed = 0
    for t in tests:
        print(f"\n{t.__name__}:")
        try:
            t()
        except AssertionError as e:
            failed += 1
            print(f"  ✗ FAILED: {e}")
    print("\n" + ("ALL PASSED" if not failed else f"{failed} TEST(S) FAILED"))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
