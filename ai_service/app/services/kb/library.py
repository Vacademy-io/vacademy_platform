"""The knowledge base library — a catalogue of published corpora.

Knowledge bases owned by one internal publisher institute can be described,
published, and unlocked by client institutes for a one-time credit charge.

Two ideas are kept deliberately apart:

  * a LISTING is merchandising — the title, cover and description a stranger
    reads while deciding whether to spend credits. It lives in its own table so
    unpublishing never touches the corpus.
  * an ENTITLEMENT is the right to generate from that corpus. It is checked by
    KbRepository.is_usable, never inferred from being able to read the listing.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Only these four are filterable. Everything else a publisher wants to say goes
# in tags, which are searched rather than faceted.
FACETS = ("subject", "level", "board", "language")

_LISTING_COLUMNS = """
    l.id, l.knowledge_base_id, l.title, l.summary, l.description,
    l.cover_file_id, l.cover_alt, l.subject, l.level, l.board, l.language,
    l.tags, l.status, l.sort_weight, l.published_at, l.published_by,
    l.created_at, l.updated_at
"""


def _row(r: Any) -> Dict[str, Any]:
    m = r._mapping
    tags = m["tags"]
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except ValueError:
            tags = []
    return {
        "id": m["id"],
        "knowledge_base_id": m["knowledge_base_id"],
        "title": m["title"],
        "summary": m["summary"],
        "description": m["description"],
        "cover_file_id": m["cover_file_id"],
        "cover_alt": m["cover_alt"],
        "subject": m["subject"],
        "level": m["level"],
        "board": m["board"],
        "language": m["language"],
        "tags": tags or [],
        "status": m["status"],
        "sort_weight": m["sort_weight"],
        "published_at": m["published_at"].isoformat() if m["published_at"] else None,
        "published_by": m["published_by"],
        "created_at": m["created_at"].isoformat() if m["created_at"] else None,
        "updated_at": m["updated_at"].isoformat() if m["updated_at"] else None,
        # Filled in by the catalogue query; absent when a listing is read alone.
        "unlocked": bool(m["unlocked"]) if "unlocked" in m.keys() else None,
        "sources": m["sources"] if "sources" in m.keys() else None,
        "pages": m["pages"] if "pages" in m.keys() else None,
    }


# ---------------------------------------------------------------------------
# Catalogue (client-facing)
# ---------------------------------------------------------------------------

def list_catalogue(
    db: Session,
    institute_id: str,
    *,
    subject: Optional[str] = None,
    level: Optional[str] = None,
    board: Optional[str] = None,
    language: Optional[str] = None,
    query: Optional[str] = None,
    limit: int = 60,
) -> List[Dict[str, Any]]:
    """Published libraries, each flagged with whether this institute owns it.

    UNLISTED rows are excluded: withdrawn from sale, but an institute that
    already unlocked one keeps using it through the normal KB list.
    """
    where = ["l.status = 'PUBLISHED'"]
    params: Dict[str, Any] = {"institute_id": institute_id, "limit": limit}

    for facet, value in (
        ("subject", subject), ("level", level),
        ("board", board), ("language", language),
    ):
        if value:
            where.append(f"l.{facet} = :{facet}")
            params[facet] = value

    if query:
        # Title, summary and tags. Deliberately not the corpus itself — the
        # catalogue searches descriptions of libraries, not their contents.
        where.append(
            "(l.title ILIKE :q OR l.summary ILIKE :q "
            " OR CAST(l.tags AS TEXT) ILIKE :q)"
        )
        params["q"] = f"%{query}%"

    rows = db.execute(
        text(
            f"""
            SELECT {_LISTING_COLUMNS},
                   (SELECT COUNT(*) FROM knowledge_base_source s
                     WHERE s.knowledge_base_id = l.knowledge_base_id) AS sources,
                   (SELECT COALESCE(SUM(s.page_count), 0)
                      FROM knowledge_base_source s
                     WHERE s.knowledge_base_id = l.knowledge_base_id) AS pages,
                   EXISTS (
                       SELECT 1 FROM knowledge_base_entitlement e
                        WHERE e.knowledge_base_id = l.knowledge_base_id
                          AND e.institute_id = :institute_id
                   ) AS unlocked
            FROM knowledge_base_listing l
            JOIN knowledge_base kb ON kb.id = l.knowledge_base_id
            WHERE {' AND '.join(where)}
              AND kb.status = 'ACTIVE'
            ORDER BY l.sort_weight DESC, l.published_at DESC
            LIMIT :limit
            """
        ),
        params,
    ).fetchall()
    return [_row(r) for r in rows]


def facet_values(db: Session) -> Dict[str, List[str]]:
    """The filter options that actually exist, so the UI never offers a filter
    that returns nothing."""
    out: Dict[str, List[str]] = {}
    for facet in FACETS:
        rows = db.execute(
            text(
                f"""
                SELECT DISTINCT l.{facet} AS v
                  FROM knowledge_base_listing l
                 WHERE l.status = 'PUBLISHED' AND l.{facet} IS NOT NULL
                 ORDER BY v
                """
            )
        ).fetchall()
        out[facet] = [r._mapping["v"] for r in rows]
    return out


def get_listing(
    db: Session, kb_id: str, institute_id: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """One listing by knowledge base id, with usage counts and unlock state."""
    row = db.execute(
        text(
            f"""
            SELECT {_LISTING_COLUMNS},
                   (SELECT COUNT(*) FROM knowledge_base_source s
                     WHERE s.knowledge_base_id = l.knowledge_base_id) AS sources,
                   (SELECT COALESCE(SUM(s.page_count), 0)
                      FROM knowledge_base_source s
                     WHERE s.knowledge_base_id = l.knowledge_base_id) AS pages,
                   EXISTS (
                       SELECT 1 FROM knowledge_base_entitlement e
                        WHERE e.knowledge_base_id = l.knowledge_base_id
                          AND e.institute_id = :institute_id
                   ) AS unlocked
            FROM knowledge_base_listing l
            WHERE l.knowledge_base_id = :kb_id
            """
        ),
        {"kb_id": kb_id, "institute_id": institute_id or ""},
    ).fetchone()
    return _row(row) if row else None


# ---------------------------------------------------------------------------
# Publishing (internal)
# ---------------------------------------------------------------------------

def upsert_listing(
    db: Session,
    kb_id: str,
    *,
    title: str,
    summary: str,
    description: Optional[str] = None,
    cover_file_id: Optional[str] = None,
    cover_alt: Optional[str] = None,
    subject: Optional[str] = None,
    level: Optional[str] = None,
    board: Optional[str] = None,
    language: Optional[str] = None,
    tags: Optional[List[str]] = None,
    sort_weight: int = 0,
    created_by: Optional[str] = None,
) -> Dict[str, Any]:
    """Create or edit the catalogue entry. Never changes status — publishing is
    a separate, deliberate act."""
    existing = db.execute(
        text("SELECT id FROM knowledge_base_listing WHERE knowledge_base_id = :kb_id"),
        {"kb_id": kb_id},
    ).fetchone()

    params = {
        "kb_id": kb_id, "title": title, "summary": summary,
        "description": description, "cover_file_id": cover_file_id,
        "cover_alt": cover_alt, "subject": subject, "level": level,
        "board": board, "language": language,
        "tags": json.dumps(tags or []), "sort_weight": sort_weight,
    }

    if existing:
        db.execute(
            text(
                """
                UPDATE knowledge_base_listing
                   SET title = :title, summary = :summary, description = :description,
                       cover_file_id = :cover_file_id, cover_alt = :cover_alt,
                       subject = :subject, level = :level, board = :board,
                       language = :language, tags = CAST(:tags AS JSONB),
                       sort_weight = :sort_weight,
                       updated_at = CURRENT_TIMESTAMP
                 WHERE knowledge_base_id = :kb_id
                """
            ),
            params,
        )
    else:
        params["id"] = str(uuid4())
        params["created_by"] = created_by
        db.execute(
            text(
                """
                INSERT INTO knowledge_base_listing (
                    id, knowledge_base_id, title, summary, description,
                    cover_file_id, cover_alt, subject, level, board, language,
                    tags, sort_weight, created_by
                ) VALUES (
                    :id, :kb_id, :title, :summary, :description,
                    :cover_file_id, :cover_alt, :subject, :level, :board, :language,
                    CAST(:tags AS JSONB), :sort_weight, :created_by
                )
                """
            ),
            params,
        )
    db.commit()
    return get_listing(db, kb_id) or {}


def set_status(
    db: Session, kb_id: str, status: str, *, by: Optional[str] = None
) -> Dict[str, Any]:
    """Publish, withdraw, or return a listing to draft.

    Publishing also flips the knowledge base to PLATFORM, which is what engages
    the existing read-only protection for every institute that is not the
    publisher. The two facts must never disagree, so they move together.
    """
    if status not in ("DRAFT", "PUBLISHED", "UNLISTED"):
        raise ValueError("status must be DRAFT, PUBLISHED or UNLISTED")

    # Returning to DRAFT flips owner_type back to INSTITUTE, and is_usable only
    # honours an entitlement on a PLATFORM row — so this would silently revoke
    # access every buyer paid for. UNLISTED exists precisely for withdrawing a
    # library, and keeps them working.
    if status == "DRAFT":
        paid = db.execute(
            text(
                "SELECT COUNT(*) FROM knowledge_base_entitlement "
                "WHERE knowledge_base_id = :kb_id"
            ),
            {"kb_id": kb_id},
        ).scalar()
        if paid:
            raise ValueError(
                f"{paid} institute(s) have already unlocked this library. "
                "Withdraw it instead — that hides it from the catalogue without "
                "taking away access they paid for."
            )

    # The publish decision is passed as its own boolean rather than comparing
    # :status inside the CASE. Binding one parameter to both a VARCHAR column
    # and a text comparison leaves Postgres unable to deduce a single type for
    # it, and the statement fails outright with AmbiguousParameter.
    db.execute(
        text(
            """
            UPDATE knowledge_base_listing
               SET status = :status,
                   published_at = CASE WHEN CAST(:is_publish AS BOOLEAN)
                                       THEN COALESCE(published_at, CURRENT_TIMESTAMP)
                                       ELSE published_at END,
                   published_by = CASE WHEN CAST(:is_publish AS BOOLEAN)
                                       THEN COALESCE(published_by, :by)
                                       ELSE published_by END,
                   updated_at = CURRENT_TIMESTAMP
             WHERE knowledge_base_id = :kb_id
            """
        ),
        {
            "kb_id": kb_id, "status": status, "by": by,
            "is_publish": status == "PUBLISHED",
        },
    )

    # DRAFT returns it to a private base. UNLISTED does NOT: institutes that
    # already paid must keep working, and their access runs through PLATFORM.
    owner_type = "INSTITUTE" if status == "DRAFT" else "PLATFORM"
    db.execute(
        text(
            "UPDATE knowledge_base SET owner_type = :owner_type, "
            "updated_at = CURRENT_TIMESTAMP WHERE id = :kb_id"
        ),
        {"kb_id": kb_id, "owner_type": owner_type},
    )
    db.commit()
    return get_listing(db, kb_id) or {}


def list_all_for_publisher(db: Session, institute_id: str) -> List[Dict[str, Any]]:
    """Every base in the publisher institute with its listing, if any. Bases
    without one appear so they can be described."""
    rows = db.execute(
        text(
            """
            SELECT kb.id AS knowledge_base_id, kb.name AS kb_name,
                   kb.owner_type, kb.status AS kb_status,
                   l.id, l.title, l.summary, l.description, l.cover_file_id,
                   l.cover_alt, l.subject, l.level, l.board, l.language,
                   l.tags, l.status, l.sort_weight, l.published_at,
                   l.published_by, l.created_at, l.updated_at
              FROM knowledge_base kb
              LEFT JOIN knowledge_base_listing l ON l.knowledge_base_id = kb.id
             WHERE kb.institute_id = :institute_id
             ORDER BY kb.updated_at DESC
            """
        ),
        {"institute_id": institute_id},
    ).fetchall()

    out: List[Dict[str, Any]] = []
    for r in rows:
        m = r._mapping
        if m["id"]:
            entry = _row(r)
        else:
            entry = {"knowledge_base_id": m["knowledge_base_id"], "status": None}
        entry["kb_name"] = m["kb_name"]
        entry["kb_status"] = m["kb_status"]
        entry["owner_type"] = m["owner_type"]
        out.append(entry)
    return out


# ---------------------------------------------------------------------------
# Entitlements
# ---------------------------------------------------------------------------

def is_entitled(db: Session, kb_id: str, institute_id: str) -> bool:
    return db.execute(
        text(
            "SELECT 1 FROM knowledge_base_entitlement "
            "WHERE knowledge_base_id = :kb_id AND institute_id = :institute_id LIMIT 1"
        ),
        {"kb_id": kb_id, "institute_id": institute_id},
    ).fetchone() is not None


def grant(
    db: Session,
    kb_id: str,
    institute_id: str,
    *,
    source: str = "PURCHASE",
    credits_charged: float = 0,
    granted_by: Optional[str] = None,
) -> bool:
    """Record an unlock. Returns False if the institute already had one.

    The caller MUST check the return value before billing: a False means the
    unique constraint refused a second row, which is how a double-clicked
    unlock button is stopped from being charged twice.
    """
    try:
        db.execute(
            text(
                """
                INSERT INTO knowledge_base_entitlement (
                    id, knowledge_base_id, institute_id, source,
                    credits_charged, granted_by
                ) VALUES (
                    :id, :kb_id, :institute_id, :source, :credits, :granted_by
                )
                """
            ),
            {
                "id": str(uuid4()), "kb_id": kb_id, "institute_id": institute_id,
                "source": source, "credits": credits_charged,
                "granted_by": granted_by,
            },
        )
        db.commit()
        return True
    except IntegrityError:
        db.rollback()
        return False


def list_unlocked(db: Session, institute_id: str) -> List[str]:
    rows = db.execute(
        text(
            "SELECT knowledge_base_id FROM knowledge_base_entitlement "
            "WHERE institute_id = :institute_id"
        ),
        {"institute_id": institute_id},
    ).fetchall()
    return [r._mapping["knowledge_base_id"] for r in rows]


__all__ = [
    "FACETS", "list_catalogue", "facet_values", "get_listing",
    "upsert_listing", "set_status", "list_all_for_publisher",
    "is_entitled", "grant", "list_unlocked",
]
