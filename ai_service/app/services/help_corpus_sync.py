"""
Vacademy Assistant — help-corpus sync pipeline.

The how-to corpus lives in version control as ``app/data/help_knowledge.jsonl``
(one entry per line). This module keeps the deployed pgvector corpus in sync with
that file, automatically, on every startup:

  edit the JSONL  ->  commit  ->  deploy  ->  auto-ingested globally on boot

It is CHANGE-DETECTED: each row is stamped with a ``corpus_version`` (a hash of
the whole seed) in its metadata. On startup we compare the stored version to the
current seed's hash and only re-embed when they differ — so an unchanged corpus
costs one cheap query, not 86 embedding calls, on every restart.

Ingestion is under the product-wide sentinel institute
``HELP_KNOWLEDGE_INSTITUTE_ID`` (one copy serves every institute; the help tool's
executor searches it). Idempotent: delete-then-insert.

Single-replica assumption: ai-service runs one replica, so we don't guard the
delete+insert with a cross-process lock. If scaled out, add a Postgres advisory
lock around ``sync_help_corpus`` (held on one connection for the full run).
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
from typing import Any, Dict, List, Tuple

from sqlalchemy import text

from ..db import db_session
from .api_key_resolver import ApiKeyResolver
from .embedding_service import EmbeddingService
from .rag_service import RAGService
from .assistant_tool_registry import HELP_KNOWLEDGE_INSTITUTE_ID, _StaticKeyResolver

logger = logging.getLogger(__name__)

SEED_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "help_knowledge.jsonl"
)


def load_seed(path: str = SEED_PATH) -> List[Dict[str, Any]]:
    """Read the JSONL seed (skips blanks and ``#`` comment lines)."""
    if not os.path.exists(path):
        return []
    entries: List[Dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError as e:
                logger.warning("help corpus: bad JSON on seed line %d: %s", line_no, e)
    return entries


def _corpus_hash(entries: List[Dict[str, Any]]) -> str:
    return hashlib.sha256(
        json.dumps(entries, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()


def _read_marker() -> Tuple[Any, int]:
    """Return (stored corpus_version, row count) for the sentinel help corpus."""
    with db_session() as db:
        row = db.execute(
            text(
                "SELECT meta_data->>'corpus_version' AS v, count(*) AS c "
                "FROM content_embeddings "
                "WHERE institute_id = :i AND source_type = 'help_knowledge' "
                "GROUP BY meta_data->>'corpus_version' ORDER BY c DESC LIMIT 1"
            ),
            {"i": HELP_KNOWLEDGE_INSTITUTE_ID},
        ).first()
    return (row[0], row[1]) if row else (None, 0)


async def _ingest(entries: List[Dict[str, Any]], version: str) -> int:
    """Delete-then-insert the corpus under the sentinel, stamping the version."""
    with db_session() as db:
        keys = ApiKeyResolver(db).resolve_keys(
            institute_id=HELP_KNOWLEDGE_INSTITUTE_ID, user_id=None
        )

    with db_session() as db:
        db.execute(
            text(
                "DELETE FROM content_embeddings "
                "WHERE institute_id = :i AND source_type = 'help_knowledge'"
            ),
            {"i": HELP_KNOWLEDGE_INSTITUTE_ID},
        )
        db.commit()

    ok = 0
    for entry in entries:
        entry_id = entry.get("id") or entry.get("task")
        content = (entry.get("content_text") or "").strip()
        if not entry_id or not content:
            continue
        metadata = {
            "task": entry.get("task"),
            "role": entry.get("role") or "any",
            "route_path": entry.get("route_path") or "",
            "keywords": entry.get("keywords") or [],
            "corpus_version": version,
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
        except Exception as e:  # noqa: BLE001
            logger.warning("help corpus: failed to ingest %s: %s", entry_id, e)
    return ok


async def sync_help_corpus(force: bool = False) -> None:
    """Sync the deployed corpus to the seed file; no-op when already current."""
    entries = load_seed()
    if not entries:
        logger.info("help corpus: no seed at %s; nothing to sync", SEED_PATH)
        return

    version = _corpus_hash(entries)
    if not force:
        try:
            stored, count = _read_marker()
        except Exception as e:  # noqa: BLE001
            logger.warning("help corpus: could not read version marker (%s); re-ingesting", e)
            stored, count = None, -1
        if stored == version and count == len(entries):
            logger.info(
                "help corpus: up to date (%d entries, v=%s)", count, version[:12]
            )
            return

    logger.info("help corpus: syncing %d entries (v=%s)…", len(entries), version[:12])
    ok = await _ingest(entries, version)
    logger.info(
        "help corpus: synced %d/%d entries under '%s'",
        ok, len(entries), HELP_KNOWLEDGE_INSTITUTE_ID,
    )


async def _safe_sync() -> None:
    try:
        await sync_help_corpus()
    except Exception as e:  # noqa: BLE001
        logger.warning("help corpus sync failed: %s", e)


def start_help_corpus_sync() -> None:
    """Spawn the corpus sync as a background task. Call from the async lifespan."""
    try:
        asyncio.get_event_loop().create_task(_safe_sync())
    except RuntimeError:
        # No running loop (not expected from the ASGI lifespan) — run inline.
        asyncio.run(_safe_sync())


__all__ = ["sync_help_corpus", "start_help_corpus_sync", "load_seed", "SEED_PATH"]
