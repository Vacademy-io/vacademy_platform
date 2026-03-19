"""
Service for generating text embeddings using Gemini or OpenRouter.
"""
from __future__ import annotations

import logging
from typing import List, Optional
import httpx

from ..services.api_key_resolver import ApiKeyResolver

logger = logging.getLogger(__name__)

# Chunk size ~500 tokens (~2000 chars) with 200 char overlap
CHUNK_SIZE = 2000
CHUNK_OVERLAP = 200


class EmbeddingService:
    """Generates text embeddings for RAG."""

    def __init__(self, api_key_resolver: ApiKeyResolver):
        self.api_key_resolver = api_key_resolver
        self.http_client = httpx.AsyncClient(timeout=30.0)

    def chunk_text(self, text: str) -> List[str]:
        """Split text into overlapping chunks for embedding."""
        if len(text) <= CHUNK_SIZE:
            return [text]

        chunks = []
        start = 0
        while start < len(text):
            end = start + CHUNK_SIZE
            chunk = text[start:end]
            # Try to break at sentence boundary
            if end < len(text):
                last_period = chunk.rfind('. ')
                last_newline = chunk.rfind('\n')
                break_point = max(last_period, last_newline)
                if break_point > CHUNK_SIZE // 2:
                    chunk = chunk[:break_point + 1]
                    end = start + break_point + 1
            chunks.append(chunk.strip())
            start = end - CHUNK_OVERLAP
        return [c for c in chunks if c]

    async def embed_text(self, text: str, institute_id: str = "default") -> Optional[List[float]]:
        """Generate embedding for a single text using Gemini embedding API."""
        _, gemini_key, _ = self.api_key_resolver.resolve_keys(institute_id=institute_id)

        if gemini_key:
            try:
                return await self._embed_gemini(text, gemini_key)
            except Exception as e:
                logger.warning(f"Gemini embedding failed: {e}")

        logger.error("No embedding provider available")
        return None

    async def embed_batch(self, texts: List[str], institute_id: str = "default") -> List[Optional[List[float]]]:
        """Generate embeddings for multiple texts."""
        results = []
        for text in texts:
            emb = await self.embed_text(text, institute_id)
            results.append(emb)
        return results

    async def _embed_gemini(self, text: str, api_key: str) -> List[float]:
        """Generate embedding using Gemini text-embedding-004."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={api_key}"
        payload = {
            "model": "models/text-embedding-004",
            "content": {"parts": [{"text": text}]},
            "taskType": "RETRIEVAL_DOCUMENT",
        }
        response = await self.http_client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["embedding"]["values"]

    async def embed_query(self, text: str, institute_id: str = "default") -> Optional[List[float]]:
        """Generate embedding for a search query (uses RETRIEVAL_QUERY task type)."""
        _, gemini_key, _ = self.api_key_resolver.resolve_keys(institute_id=institute_id)

        if gemini_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={gemini_key}"
                payload = {
                    "model": "models/text-embedding-004",
                    "content": {"parts": [{"text": text}]},
                    "taskType": "RETRIEVAL_QUERY",
                }
                response = await self.http_client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                return data["embedding"]["values"]
            except Exception as e:
                logger.warning(f"Gemini query embedding failed: {e}")

        return None

    async def close(self):
        await self.http_client.aclose()


__all__ = ["EmbeddingService"]
