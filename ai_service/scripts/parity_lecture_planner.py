"""Live shadow-diff harness for the lecture-planner migration.

Fires the SAME request at the media_service (Java) and ai_service (Python)
lecture planner, polls both to completion, and diffs the JSON *structure*
(key sets + value types, recursively) while ignoring volatile values (taskId,
timestamps, model id, and the free-text content the LLM generates).

Use it as a gate before flipping VITE_AI_LECTURE_PLANNER_ON_AI_SERVICE in an
environment, and as periodic shadow traffic in stage.

Usage:
    .venv/bin/python scripts/parity_lecture_planner.py \
        --java-base  https://backend-stage.vacademy.io/media-service \
        --ai-base    https://backend-stage.vacademy.io/ai-service \
        --institute  6b600940-2134-40ec-93ed-b61e403c5a87 \
        --token      "$JWT"            # optional Bearer token

Exit code 0 = structurally identical, 1 = drift (details printed).
"""
from __future__ import annotations

import argparse
import sys
import time
from typing import Any, Dict

import httpx

# Keys whose VALUES legitimately differ between the two backends and must not
# be diffed (only their presence/type is checked).
VOLATILE = {"taskId", "model", "createdAt", "updatedAt", "statusMessage", "resultJson"}


def shape(obj: Any, *, ignore_volatile: bool = True) -> Any:
    """Reduce a JSON value to its structure: dicts → {key: shape}, lists →
    [shape of first elem] (homogeneous assumption), scalars → type name.
    Volatile leaf values are collapsed to their type, never compared."""
    if isinstance(obj, dict):
        return {
            k: ("<volatile>" if (ignore_volatile and k in VOLATILE) else shape(v))
            for k, v in sorted(obj.items())
        }
    if isinstance(obj, list):
        return [shape(obj[0])] if obj else []
    return type(obj).__name__


def kickoff(client: httpx.Client, base: str, params: Dict[str, str]) -> str:
    r = client.get(f"{base}/ai/lecture/generate-plan", params=params, timeout=30)
    r.raise_for_status()
    body = r.json()
    assert set(body) == {"taskId", "status", "model", "message"}, f"kick-off keys: {set(body)}"
    assert body["status"] == "STARTED", body["status"]
    return body["taskId"]


def poll_plan(client: httpx.Client, base: str, task_id: str, timeout_s: int = 120) -> Dict:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        r = client.get(f"{base}/task-status/get/lecture-plan", params={"taskId": task_id}, timeout=30)
        r.raise_for_status()
        plan = r.json()
        if plan.get("heading") or plan.get("timeWiseSplit"):
            return plan
        time.sleep(3)
    raise TimeoutError(f"plan not ready within {timeout_s}s for task {task_id}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--java-base", required=True)
    ap.add_argument("--ai-base", required=True)
    ap.add_argument("--institute", required=True)
    ap.add_argument("--token", default=None)
    ap.add_argument("--prompt", default="Plan a lecture on the 2nd law of motion")
    args = ap.parse_args()

    params = {
        "userPrompt": args.prompt,
        "lectureDuration": "40 minutes",
        "language": "ENGLISH",
        "methodOfTeaching": "Concept-First",
        "taskName": "parity-check",
        "instituteId": args.institute,
        "level": "9th class",
    }
    headers = {}
    if args.token:
        headers["Authorization"] = f"Bearer {args.token}"
        headers["clientId"] = args.institute

    with httpx.Client(headers=headers) as client:
        print("→ kick-off (java)…")
        jid = kickoff(client, args.java_base, params)
        print("→ kick-off (ai)…")
        aid = kickoff(client, args.ai_base, params)

        print("→ polling both for completed plans…")
        jplan = poll_plan(client, args.java_base, jid)
        aplan = poll_plan(client, args.ai_base, aid)

    jshape, ashape = shape(jplan), shape(aplan)
    if jshape == ashape:
        print("\n✓ STRUCTURALLY IDENTICAL — safe to cut over.")
        return 0

    print("\n✗ STRUCTURE DRIFT")
    print("  java:", jshape)
    print("  ai  :", ashape)
    return 1


if __name__ == "__main__":
    sys.exit(main())
