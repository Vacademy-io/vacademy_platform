"""
Ingest the Vacademy Assistant how-to corpus into pgvector.

The corpus is PRODUCT-WIDE: stored once under the sentinel institute id
HELP_KNOWLEDGE_INSTITUTE_ID (see app/services/assistant_tool_registry.py); the
help tool reads it for every institute. Re-running is IDEMPOTENT — it deletes the
existing help_knowledge rows for the sentinel, then re-ingests the seed file.

Usage (from the ai_service directory, with the app's DB env configured — i.e.
the same env the service runs with, pointed at the target database):

    python scripts/ingest_help_knowledge.py [path/to/help_knowledge.jsonl]

Seed format — one JSON object per line:
    {"id","task","role","route_path","keywords":[...],"content_text"}
"""
from __future__ import annotations

import asyncio
import json
import os
import sys

# Make the `app` package importable when run as a plain script.
_AI_SERVICE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _AI_SERVICE_ROOT)

from sqlalchemy import text  # noqa: E402

from app.db import db_session  # noqa: E402
from app.services.api_key_resolver import ApiKeyResolver  # noqa: E402
from app.services.embedding_service import EmbeddingService  # noqa: E402
from app.services.rag_service import RAGService  # noqa: E402
from app.services.assistant_tool_registry import HELP_KNOWLEDGE_INSTITUTE_ID  # noqa: E402

DEFAULT_SEED = os.path.join(_AI_SERVICE_ROOT, "app", "data", "help_knowledge.jsonl")


class _StaticKeyResolver:
    """Returns pre-resolved API keys without DB access (for embeddings)."""

    def __init__(self, keys):
        self._keys = keys

    def resolve_keys(self, institute_id=None, user_id=None, request_model=None):
        return self._keys


def _load_seed(path: str) -> list[dict]:
    entries: list[dict] = []
    with open(path, "r", encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise SystemExit(f"Seed line {line_no} is not valid JSON: {e}")
    return entries


async def main() -> None:
    seed_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SEED
    entries = _load_seed(seed_path)
    if not entries:
        raise SystemExit(f"No entries found in {seed_path}")

    print(
        f"Ingesting {len(entries)} help entries under institute "
        f"'{HELP_KNOWLEDGE_INSTITUTE_ID}' from {seed_path}"
    )

    # Resolve embedding keys once (platform default for the sentinel institute).
    with db_session() as db:
        keys = ApiKeyResolver(db).resolve_keys(
            institute_id=HELP_KNOWLEDGE_INSTITUTE_ID, user_id=None
        )

    # Idempotent: clear the existing help corpus for the sentinel id.
    with db_session() as db:
        deleted = db.execute(
            text(
                "DELETE FROM content_embeddings "
                "WHERE institute_id = :iid AND source_type = 'help_knowledge'"
            ),
            {"iid": HELP_KNOWLEDGE_INSTITUTE_ID},
        ).rowcount
        db.commit()
    print(f"Cleared {deleted} existing help_knowledge row(s).")

    ok = 0
    for entry in entries:
        entry_id = entry.get("id") or entry.get("task")
        content = (entry.get("content_text") or "").strip()
        if not entry_id or not content:
            print(f"  skip (missing id/content_text): {entry!r}")
            continue
        metadata = {
            "task": entry.get("task"),
            "role": entry.get("role") or "any",
            "route_path": entry.get("route_path") or "",
            "keywords": entry.get("keywords") or [],
        }
        try:
            with db_session() as db:
                rag = RAGService(db, EmbeddingService(_StaticKeyResolver(keys)))
                count = await rag.ingest_content(
                    content_text=content,
                    source_type="help_knowledge",
                    source_id=str(entry_id),
                    institute_id=HELP_KNOWLEDGE_INSTITUTE_ID,
                    metadata=metadata,
                )
            if count > 0:
                ok += 1
                print(f"  ✓ {entry_id} ({count} chunk(s))")
            else:
                print(f"  ✗ {entry_id}: 0 chunks embedded")
        except Exception as e:  # noqa: BLE001
            print(f"  ✗ {entry_id}: {e}")

    print(f"Done: {ok}/{len(entries)} entries ingested.")


if __name__ == "__main__":
    asyncio.run(main())
