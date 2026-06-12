"""App-level optimistic locking for the editor timeline JSON.

The timeline lives on S3 and every editor mutation is a read-modify-write of
the whole document, so two concurrent writers silently lose updates (last PUT
wins). True S3 conditional writes would need ETag plumbing through every
download path; instead the editor uses a monotonically increasing
``meta.revision`` counter:

  - Every mutating frame endpoint bumps ``meta.revision`` by 1 on write.
  - Clients send the revision they loaded as ``expected_revision``; a
    mismatch raises :class:`TimelineRevisionConflict`, which the router maps
    to HTTP 409 so the editor can tell the user to reload.

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

    Returns the new revision for wrapped (``{"entries": ..., "meta": ...}``)
    timelines, or ``None`` for legacy plain-array timelines (nothing to check
    or store). When ``expected_revision`` is ``None`` the check is skipped
    but the counter still bumps, so unchecked writers (older clients, other
    tools) remain detectable by checking ones.
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
    if expected_revision is not None and current != int(expected_revision):
        raise TimelineRevisionConflict(
            f"Timeline revision is {current} but the client loaded revision "
            f"{expected_revision} — this video was modified by another "
            f"session. Reload the editor and re-apply the change."
        )
    meta["revision"] = current + 1
    return current + 1
