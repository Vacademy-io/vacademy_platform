"""App-level optimistic locking for the editor timeline JSON.

The timeline lives on S3 and every editor mutation is a read-modify-write of
the whole document, so two concurrent writers silently lose updates (last PUT
wins). True S3 conditional writes would need ETag plumbing through every
download path; instead the editor uses a monotonically increasing
``meta.revision`` counter:

  - A *checked* write (the editor's save, which sends ``expected_revision``)
    verifies the counter and bumps it by 1.
  - A mismatch raises :class:`TimelineRevisionConflict`, which the router maps
    to HTTP 409 so the editor can warn the user before overwriting.
  - An *unchecked* write (``expected_revision is None`` — pipeline-view edits,
    internal tooling, older clients) does NOT touch the counter. Bumping on an
    unchecked write would silently invalidate every open editor's loaded
    revision and trip its lock on the next save — a false conflict the user
    never caused. The trade-off: a checked save won't detect an interleaved
    unchecked write (last-writer-wins for that rare pairing), which is fine —
    the counter exists to catch two *editors* racing, and both send the
    revision.

The residual race is the few milliseconds between download and PUT inside one
request — versus the minutes-long window between a user's load and save that
this protects against. Legacy plain-array timelines have no ``meta`` object
to store the counter in; they are written through unchecked.
"""

from typing import Any, Optional


class TimelineRevisionConflict(Exception):
    """Client's expected_revision doesn't match the stored timeline revision."""


def check_and_bump_revision(data: Any, expected_revision: Optional[int]) -> Optional[int]:
    """Verify ``expected_revision`` against ``data`` and bump the counter.

    Call AFTER all in-memory mutations, immediately before persisting, so a
    conflict aborts the request with nothing written.

    Returns the (possibly bumped) revision for wrapped
    (``{"entries": ..., "meta": ...}``) timelines, or ``None`` for legacy
    plain-array timelines (nothing to check or store).

    When ``expected_revision`` is ``None`` (unchecked write) the counter is
    left untouched and the current value is returned — see the module
    docstring for why bumping there caused false conflicts.
    """
    if not isinstance(data, dict):
        return None
    meta = data.get("meta")
    if not isinstance(meta, dict):
        meta = {}
        data["meta"] = meta
    try:
        current = int(meta.get("revision") or 0)
    except (TypeError, ValueError):
        current = 0
    if expected_revision is None:
        return current
    if current != int(expected_revision):
        raise TimelineRevisionConflict(
            f"Timeline revision is {current} but the client loaded revision "
            f"{expected_revision} — this video was modified by another "
            f"session. Reload the editor and re-apply the change."
        )
    meta["revision"] = current + 1
    return current + 1
