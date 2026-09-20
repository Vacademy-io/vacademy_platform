"""A paper read runs for minutes, so the teacher is not kept waiting: the job is
tied to the test, the bell tells them when it settles, and the test's page can
find the result afterwards. These pin the pieces that make that safe."""
from __future__ import annotations

import asyncio
import json

import pytest

from app.models.ai_task import AiTaskStatus
from app.services import ai_task_service, staff_notify


# ---- the scheduler's on_done hook -------------------------------------------

def _quiet_status(monkeypatch, log):
    monkeypatch.setattr(ai_task_service, "_set_status", lambda *a, **k: log.append(("status", a[1])))


def test_on_done_runs_after_the_final_status_with_the_result(monkeypatch):
    log: list = []
    _quiet_status(monkeypatch, log)

    async def work():
        return '{"ok":1}'

    async def done(status, result_json, message):
        log.append(("done", status, result_json, message))

    asyncio.run(ai_task_service._run("t1", work, done))
    assert log == [("status", AiTaskStatus.COMPLETED), ("done", AiTaskStatus.COMPLETED, '{"ok":1}', "Completed")]


def test_on_done_sees_a_failure_and_its_reason(monkeypatch):
    log: list = []
    _quiet_status(monkeypatch, log)

    async def work():
        raise RuntimeError("No questions could be read")

    async def done(status, result_json, message):
        log.append((status, result_json, message))

    asyncio.run(ai_task_service._run("t2", work, done))
    assert log[-1] == (AiTaskStatus.FAILED, None, "No questions could be read")


def test_a_broken_on_done_cannot_change_the_outcome(monkeypatch):
    log: list = []
    _quiet_status(monkeypatch, log)

    async def work():
        return "r"

    async def done(*_):
        raise ValueError("bell is down")

    asyncio.run(ai_task_service._run("t3", work, done))  # no raise
    assert log == [("status", AiTaskStatus.COMPLETED)]


def test_without_a_hook_nothing_changes(monkeypatch):
    log: list = []
    _quiet_status(monkeypatch, log)

    async def work():
        return "r"

    asyncio.run(ai_task_service._run("t4", work))
    assert log == [("status", AiTaskStatus.COMPLETED)]


# ---- the bell ----------------------------------------------------------------

class _Resp:
    def __init__(self, code): self.status_code, self.text = code, ""


class _Client:
    sent: list = []

    def __init__(self, *a, **k): pass
    async def __aenter__(self): return self
    async def __aexit__(self, *a): return False
    async def post(self, url, json=None, headers=None):
        _Client.sent.append((url, json, headers))
        return _Resp(200)


@pytest.fixture
def bell(monkeypatch):
    _Client.sent = []
    monkeypatch.setattr(staff_notify.httpx, "AsyncClient", _Client)

    async def headers(extra=None):
        return {**(extra or {}), "clientName": "admin_core_service", "Signature": "s"}

    monkeypatch.setattr(staff_notify, "internal_auth_headers", headers)
    return _Client


def test_system_alert_matches_the_java_payload_and_dedupes_users(bell):
    ok = asyncio.run(staff_notify.system_alert(
        "inst", ["u1", "u1", "", "u2"], "Read", "Body", source_id="task-9", data={"assessmentId": "a1"}
    ))
    assert ok is True
    url, payload, headers = bell.sent[0]
    assert url.endswith("/notification-service/internal/v1/send")
    assert headers["clientName"] == "admin_core_service"
    assert payload["channel"] == "SYSTEM_ALERT"
    assert payload["instituteId"] == "inst"
    assert payload["recipients"] == [{"userId": "u1"}, {"userId": "u2"}]
    assert payload["options"]["pushTitle"] == "Read"
    assert payload["options"]["pushBody"] == "Body"
    assert payload["options"]["sourceId"] == "task-9"
    assert payload["options"]["pushData"] == {"assessmentId": "a1"}


def test_system_alert_with_nobody_to_tell_sends_nothing(bell):
    assert asyncio.run(staff_notify.system_alert("inst", [], "t", "b")) is False
    assert bell.sent == []


def test_system_alert_swallows_transport_failures(monkeypatch):
    async def headers(extra=None):
        raise RuntimeError("db down")

    monkeypatch.setattr(staff_notify, "internal_auth_headers", headers)
    assert asyncio.run(staff_notify.system_alert("inst", ["u1"], "t", "b")) is False


# ---- the lookup fragment matches what json.dumps writes -----------------------

def test_lookup_needle_matches_how_the_task_stores_params():
    stored = json.dumps({"model": "m", "params": {"assessment_id": "a-1", "started_by": "u"}})
    assert '"assessment_id": "a-1"' in stored
