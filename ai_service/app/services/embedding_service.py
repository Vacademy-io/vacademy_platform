"""
Service for generating text embeddings.

Uses google/gemini-embedding-001 through OpenRouter (pay-per-token, no
free-tier daily quota) so all vectors live in one embedding space,
compatible with the existing content_embeddings rows. The direct-Gemini
fallback was retired — embeddings run exclusively through OpenRouter.
"""
from __future__ import annotations

import asyncio
import logging
from collections import OrderedDict
from typing import Dict, List, Optional, Tuple
import httpx

from ..services.api_key_resolver import ApiKeyResolver

logger = logging.getLogger(__name__)

# Chunk size ~500 tokens (~2000 chars) with 200 char overlap
CHUNK_SIZE = 2000
CHUNK_OVERLAP = 200

OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings"
OPENROUTER_EMBED_MODEL = "google/gemini-embedding-001"
EMBEDDING_DIM = 768
# Batch at most 100 inputs per embeddings call.
BATCH_LIMIT = 100
MAX_RETRIES = 3
MAX_RETRY_DELAY_SECONDS = 30.0

# task -> openrouter input_type
TASK_TYPES = {
    "document": "search_document",
    "query": "search_query",
}

# Module-level so the cache survives per-request EmbeddingService instances.
QUERY_CACHE_SIZE = 256
_query_cache: "OrderedDict[Tuple[str, str], List[float]]" = OrderedDict()


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

    async def _post_with_retry(self, url: str, payload: Dict, headers: Dict) -> Dict:
        """
        POST with backoff on 429/5xx, honoring Retry-After.

        API keys go in headers, never the URL — httpx logs full request URLs
        at INFO level, so a ?key= query param leaks the key into logs.
        """
        for attempt in range(MAX_RETRIES + 1):
            response = await self.http_client.post(url, json=payload, headers=headers)
            if (response.status_code == 429 or response.status_code >= 500) and attempt < MAX_RETRIES:
                try:
                    delay = float(response.headers.get("retry-after", ""))
                except ValueError:
                    delay = float(2 ** attempt)
                delay = min(delay, MAX_RETRY_DELAY_SECONDS)
                logger.warning(
                    f"Embedding API at {url} returned {response.status_code}, "
                    f"retrying in {delay:.0f}s (attempt {attempt + 1}/{MAX_RETRIES})"
                )
                await asyncio.sleep(delay)
                continue
            response.raise_for_status()
            return response.json()
        raise RuntimeError("unreachable")

    async def _embed_openrouter(self, texts: List[str], input_type: str, api_key: str) -> List[List[float]]:
        """Embed texts via OpenRouter's OpenAI-compatible embeddings endpoint."""
        payload = {
            "model": OPENROUTER_EMBED_MODEL,
            "input": texts,
            "dimensions": EMBEDDING_DIM,
            "input_type": input_type,
        }
        headers = {"Authorization": f"Bearer {api_key}"}
        data = await self._post_with_retry(OPENROUTER_EMBEDDINGS_URL, payload, headers)
        items = sorted(data["data"], key=lambda d: d["index"])
        if len(items) != len(texts):
            raise ValueError(f"OpenRouter returned {len(items)} embeddings for {len(texts)} inputs")
        embeddings = [item["embedding"] for item in items]
        # If the provider ignored `dimensions`, raising here drops the batch
        # (returns None) instead of inserting vectors pgvector will reject.
        if embeddings and len(embeddings[0]) != EMBEDDING_DIM:
            raise ValueError(f"OpenRouter returned {len(embeddings[0])}-dim embeddings, expected {EMBEDDING_DIM}")
        return embeddings

    async def _embed_with_providers(
        self, texts: List[str], task: str, institute_id: str
    ) -> List[Optional[List[float]]]:
        """Embed up to BATCH_LIMIT texts via OpenRouter."""
        openrouter_key, _gemini_key, _ = self.api_key_resolver.resolve_keys(institute_id=institute_id)
        openrouter_input_type = TASK_TYPES[task]

        if not openrouter_key:
            logger.error("No embedding provider available (OPENROUTER_API_KEY not configured)")
            return [None] * len(texts)

        try:
            return await self._embed_openrouter(texts, openrouter_input_type, openrouter_key)
        except Exception as e:
            # No cross-provider fallback anymore — a failure means these
            # chunks go un-embedded (logged so it's diagnosable, not silent).
            logger.error(f"OpenRouter embedding failed, batch dropped: {e}")
            return [None] * len(texts)

    async def embed_text(self, text: str, institute_id: str = "default") -> Optional[List[float]]:
        """Generate embedding for a single document text."""
        results = await self._embed_with_providers([text], "document", institute_id)
        return results[0]

    async def embed_batch(self, texts: List[str], institute_id: str = "default") -> List[Optional[List[float]]]:
        """Generate embeddings for multiple texts in batched API calls."""
        results: List[Optional[List[float]]] = []
        for start in range(0, len(texts), BATCH_LIMIT):
            batch = texts[start:start + BATCH_LIMIT]
            results.extend(await self._embed_with_providers(batch, "document", institute_id))
        return results

    async def embed_query(self, text: str, institute_id: str = "default") -> Optional[List[float]]:
        """Generate embedding for a search query (uses retrieval-query task type)."""
        cache_key = (institute_id, text)
        cached = _query_cache.get(cache_key)
        if cached is not None:
            _query_cache.move_to_end(cache_key)
            return cached

        results = await self._embed_with_providers([text], "query", institute_id)
        embedding = results[0]
        if embedding is None:
            return None

        _query_cache[cache_key] = embedding
        if len(_query_cache) > QUERY_CACHE_SIZE:
            _query_cache.popitem(last=False)
        return embedding

    async def close(self):
        await self.http_client.aclose()


__all__ = ["EmbeddingService"]
