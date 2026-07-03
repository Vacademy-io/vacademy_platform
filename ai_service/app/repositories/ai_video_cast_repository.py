"""Saved video casts — the characters (portraits + voices) of storybook/drama
videos, persisted per institute so a SERIES of videos can reuse the same cast:
same faces (stored Seedream sheet URLs → same @ImageN refs), same voices
(stored voice_gender per character → same TTS mapping).

Follows the ai_task raw-SQL repository idiom: `ensure_ai_video_cast_schema` is
idempotent and runs at app startup (lifespan); a SQL migration mirror lives in
app/migrations/ for environments that manage schema externally.

`characters` JSONB shape (one entry per character):
    {name, visual_description, voice_hint, voice_gender, sheet_url}
`visual_description` is the VERBATIM portrait text reused in every prompt;
`sheet_url` is the character's reference portrait (may be null when the
source run never generated one — reuse then regenerates it).
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_ENSURE_TABLE_STATEMENTS = [
    "CREATE EXTENSION IF NOT EXISTS pgcrypto",
    """
    CREATE TABLE IF NOT EXISTS ai_video_casts (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        institute_id    TEXT NOT NULL,
        name            VARCHAR(120) NOT NULL,
        characters      JSONB NOT NULL DEFAULT '[]'::jsonb,
        source_video_id VARCHAR(255),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_ai_video_casts_institute ON ai_video_casts (institute_id)",
]


def ensure_ai_video_cast_schema(db: Session) -> None:
    """Create the ai_video_casts table if missing. Idempotent, boot-safe."""
    try:
        for stmt in _ENSURE_TABLE_STATEMENTS:
            db.execute(text(stmt))
        db.commit()
        logger.info("ai_video_casts schema ensured.")
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.warning(
            "ensure_ai_video_cast_schema failed (will rely on external migration): %s", exc
        )


def _row_to_dict(row: Any) -> Dict[str, Any]:
    chars = row.characters
    if isinstance(chars, str):
        try:
            chars = json.loads(chars)
        except Exception:
            chars = []
    return {
        "cast_id": str(row.id),
        "name": row.name,
        "characters": chars or [],
        "source_video_id": row.source_video_id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


class AiVideoCastRepository:
    """CRUD over ai_video_casts. Every read/write is institute-scoped."""

    def __init__(self, db: Session):
        self.db = db

    def list_for_institute(self, institute_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        rows = self.db.execute(
            text(
                "SELECT id, name, characters, source_video_id, created_at "
                "FROM ai_video_casts WHERE institute_id = :inst "
                "ORDER BY created_at DESC LIMIT :lim"
            ),
            {"inst": institute_id, "lim": limit},
        ).fetchall()
        return [_row_to_dict(r) for r in rows]

    def get(self, cast_id: str, institute_id: str) -> Optional[Dict[str, Any]]:
        row = self.db.execute(
            text(
                "SELECT id, name, characters, source_video_id, created_at "
                "FROM ai_video_casts WHERE id = CAST(:cid AS uuid) AND institute_id = :inst"
            ),
            {"cid": cast_id, "inst": institute_id},
        ).fetchone()
        return _row_to_dict(row) if row else None

    def create(
        self,
        *,
        institute_id: str,
        name: str,
        characters: List[Dict[str, Any]],
        source_video_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        row = self.db.execute(
            text(
                "INSERT INTO ai_video_casts (institute_id, name, characters, source_video_id) "
                "VALUES (:inst, :name, CAST(:chars AS jsonb), :src) "
                "RETURNING id, name, characters, source_video_id, created_at"
            ),
            {
                "inst": institute_id,
                "name": (name or "Untitled cast")[:120],
                "chars": json.dumps(characters or [], ensure_ascii=False),
                "src": source_video_id,
            },
        ).fetchone()
        self.db.commit()
        return _row_to_dict(row)

    def delete(self, cast_id: str, institute_id: str) -> bool:
        res = self.db.execute(
            text(
                "DELETE FROM ai_video_casts "
                "WHERE id = CAST(:cid AS uuid) AND institute_id = :inst"
            ),
            {"cid": cast_id, "inst": institute_id},
        )
        self.db.commit()
        return bool(res.rowcount)
