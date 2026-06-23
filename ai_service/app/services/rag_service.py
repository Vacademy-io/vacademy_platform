"""
RAG (Retrieval-Augmented Generation) service for semantic search over course content.
"""
from __future__ import annotations

import logging
from typing import List, Dict, Any, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from .embedding_service import EmbeddingService

logger = logging.getLogger(__name__)


class RAGService:
    """Semantic search over course content using pgvector."""

    def __init__(self, db_session: Session, embedding_service: EmbeddingService):
        self.db = db_session
        self.embedding_service = embedding_service

    async def search(
        self,
        query: str,
        institute_id: str,
        top_k: int = 5,
        similarity_threshold: float = 0.3,
        source_type: Optional[str] = None,
        roles: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search for semantically similar content.

        Optional filters (both backward-compatible — omit for prior behaviour):
        - source_type: restrict to one corpus, e.g. "help_knowledge".
        - roles: keep only entries whose ``meta_data->>'role'`` matches one of
          these roles, or is unscoped / "any". Applied in Python AFTER the
          vector search so a single similarity ranking is preserved; the SQL
          over-fetches to compensate.

        Returns list of dicts with: content_text, source_type, source_id, metadata, similarity_score
        """
        # Generate query embedding
        query_embedding = await self.embedding_service.embed_query(query, institute_id)
        if not query_embedding:
            logger.warning("Failed to generate query embedding")
            return []

        # Over-fetch when we will post-filter by role so the filter does not starve results.
        fetch_k = top_k * 4 if roles else top_k

        try:
            # pgvector cosine distance: 1 - (a <=> b) gives similarity
            # Use CAST(... AS vector) instead of `::vector` — the `::` cast
            # operator collides with SQLAlchemy's `:name` bind-param parser
            # (double-colon after a bind name gets mis-parsed as a second
            # named param), which surfaces as `syntax error at or near ":"`
            # from PostgreSQL. CAST is unambiguous.
            source_clause = "AND source_type = :source_type" if source_type else ""
            stmt = text(f"""
                SELECT
                    content_text,
                    source_type,
                    source_id,
                    meta_data,
                    1 - (embedding <=> CAST(:query_vec AS vector)) as similarity
                FROM content_embeddings
                WHERE institute_id = :institute_id
                {source_clause}
                AND 1 - (embedding <=> CAST(:query_vec AS vector)) > :threshold
                ORDER BY embedding <=> CAST(:query_vec AS vector)
                LIMIT :top_k
            """)

            params = {
                "query_vec": str(query_embedding),
                "institute_id": institute_id,
                "threshold": similarity_threshold,
                "top_k": fetch_k,
            }
            if source_type:
                params["source_type"] = source_type

            result = self.db.execute(stmt, params)
            rows = result.fetchall()

            allowed_roles = {str(r).lower() for r in roles} if roles else None

            results = []
            for row in rows:
                metadata = row[3] or {}
                if allowed_roles is not None:
                    entry_role = metadata.get("role")
                    # Unscoped ("any" or absent) entries are visible to everyone;
                    # role-scoped entries only to a caller holding that role.
                    if entry_role is not None:
                        er = str(entry_role).lower()
                        if er != "any" and er not in allowed_roles:
                            continue
                results.append({
                    "content_text": row[0][:1000],  # Truncate for context window
                    "source_type": row[1],
                    "source_id": row[2],
                    "metadata": metadata,
                    "similarity_score": round(float(row[4]), 3),
                })
                if len(results) >= top_k:
                    break

            logger.info(f"RAG search returned {len(results)} results for query: '{query[:50]}...'")
            return results

        except Exception as e:
            logger.error(f"RAG search error: {e}")
            return []

    async def ingest_content(
        self,
        content_text: str,
        source_type: str,
        source_id: str,
        institute_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> int:
        """
        Embed and store content for future retrieval.
        Returns number of chunks created.
        """
        chunks = self.embedding_service.chunk_text(content_text)
        embeddings = await self.embedding_service.embed_batch(chunks, institute_id)
        count = 0

        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            if not embedding:
                continue

            try:
                # Use CAST(...) not `::vector` — see search() for rationale.
                stmt = text("""
                    INSERT INTO content_embeddings (id, institute_id, source_type, source_id, content_text, chunk_index, embedding, meta_data, created_at, updated_at)
                    VALUES (gen_random_uuid(), :institute_id, :source_type, :source_id, :content_text, :chunk_index, CAST(:embedding AS vector), CAST(:meta_data AS jsonb), NOW(), NOW())
                    ON CONFLICT (id) DO NOTHING
                """)
                import json
                self.db.execute(stmt, {
                    "institute_id": institute_id,
                    "source_type": source_type,
                    "source_id": source_id,
                    "content_text": chunk,
                    "chunk_index": i,
                    "embedding": str(embedding),
                    "meta_data": json.dumps(metadata or {}),
                })
                self.db.commit()
                count += 1
            except Exception as e:
                logger.error(f"Error storing embedding for {source_type}/{source_id} chunk {i}: {e}")
                self.db.rollback()

        logger.info(f"Ingested {count}/{len(chunks)} chunks for {source_type}/{source_id}")
        return count


__all__ = ["RAGService"]
