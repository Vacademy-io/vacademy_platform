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
    ) -> List[Dict[str, Any]]:
        """
        Search for semantically similar content.

        Returns list of dicts with: content_text, source_type, source_id, metadata, similarity_score
        """
        # Generate query embedding
        query_embedding = await self.embedding_service.embed_query(query, institute_id)
        if not query_embedding:
            logger.warning("Failed to generate query embedding")
            return []

        try:
            # pgvector cosine distance: 1 - (a <=> b) gives similarity
            stmt = text("""
                SELECT
                    content_text,
                    source_type,
                    source_id,
                    meta_data,
                    1 - (embedding <=> :query_vec::vector) as similarity
                FROM content_embeddings
                WHERE institute_id = :institute_id
                AND 1 - (embedding <=> :query_vec::vector) > :threshold
                ORDER BY embedding <=> :query_vec::vector
                LIMIT :top_k
            """)

            result = self.db.execute(stmt, {
                "query_vec": str(query_embedding),
                "institute_id": institute_id,
                "threshold": similarity_threshold,
                "top_k": top_k,
            })
            rows = result.fetchall()

            results = []
            for row in rows:
                results.append({
                    "content_text": row[0][:1000],  # Truncate for context window
                    "source_type": row[1],
                    "source_id": row[2],
                    "metadata": row[3] or {},
                    "similarity_score": round(float(row[4]), 3),
                })

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
        count = 0

        for i, chunk in enumerate(chunks):
            embedding = await self.embedding_service.embed_text(chunk, institute_id)
            if not embedding:
                continue

            try:
                stmt = text("""
                    INSERT INTO content_embeddings (id, institute_id, source_type, source_id, content_text, chunk_index, embedding, meta_data, created_at, updated_at)
                    VALUES (gen_random_uuid(), :institute_id, :source_type, :source_id, :content_text, :chunk_index, :embedding::vector, :meta_data::jsonb, NOW(), NOW())
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
