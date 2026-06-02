"""In-memory cancellation flags. Survives only the current process — Java is
the source of truth for whether a process should still run. We just need a
local flag so the orchestrator can abort between checkpoints without waiting
for the in-flight LLM call to return.

Two indexes:
  - job_id: set by the router when a grade job starts
  - process_id: set the same time, so a cancel arriving before ai_service has
    echoed the job_id back to Java still aborts (#16 race fix).
"""
from __future__ import annotations

import threading
from typing import Optional

_cancelled_jobs: set[str] = set()
_cancelled_processes: set[str] = set()
_process_to_job: dict[str, str] = {}
_lock = threading.Lock()


def register(job_id: str, process_id: Optional[str] = None) -> None:
    """Mark a job_id (and optional process_id) as armed for cancellation
    checks. Clears any prior cancel flags for either key."""
    with _lock:
        _cancelled_jobs.discard(job_id)
        if process_id is not None:
            _cancelled_processes.discard(process_id)
            _process_to_job[process_id] = job_id


def cancel(job_id: str) -> None:
    with _lock:
        _cancelled_jobs.add(job_id)


def cancel_by_process(process_id: str) -> None:
    with _lock:
        _cancelled_processes.add(process_id)
        # If we already know the job_id for this process, mirror onto the job
        # set so check(job_id) sees the cancel at the next checkpoint.
        job_id = _process_to_job.get(process_id)
        if job_id is not None:
            _cancelled_jobs.add(job_id)


def is_cancelled(job_id: str, process_id: Optional[str] = None) -> bool:
    with _lock:
        if job_id in _cancelled_jobs:
            return True
        if process_id is not None and process_id in _cancelled_processes:
            return True
        return False


def cleanup(job_id: str, process_id: Optional[str] = None) -> None:
    """Remove cancellation state for a finished job. Called from the BG task's
    finally block so a stale cancel flag doesn't bleed into a future job."""
    with _lock:
        _cancelled_jobs.discard(job_id)
        if process_id is not None:
            _cancelled_processes.discard(process_id)
            _process_to_job.pop(process_id, None)


class Cancelled(Exception):
    """Raised at orchestrator checkpoints when a cancel() has been seen."""


def check(job_id: str, process_id: Optional[str] = None) -> None:
    if is_cancelled(job_id, process_id):
        raise Cancelled(f"copy-check job {job_id} cancelled")
