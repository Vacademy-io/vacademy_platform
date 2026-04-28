"""
Web search via Perplexity Sonar through OpenRouter.

Reuses the existing OpenRouter API key — no new infrastructure or third-party
account. Returns a synthesized answer plus cited URLs that the script LLM
consumes via the standard `reference_context.text_context` channel.

Failure mode is non-fatal: any exception returns an empty result and logs a
warning; the pipeline continues without the search context.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_DEFAULT_MODEL = "perplexity/sonar"
_HTTP_TIMEOUT_S = 25.0


class WebSearchService:
    """Web search wrapper around Perplexity Sonar (via OpenRouter)."""

    def __init__(self, openrouter_key: str, model: str = _DEFAULT_MODEL):
        self._openrouter_key = openrouter_key
        self._model = model

    async def search(self, query: str, *, max_results: int = 5) -> Dict[str, Any]:
        """
        Returns:
          {
            "answer": "<synthesized answer>",
            "sources": [{"title": str, "url": str, "snippet": str}, ...],
            "query": "<query as sent>"
          }
        On failure: returns the same shape with empty answer/sources.
        """
        empty: Dict[str, Any] = {"answer": "", "sources": [], "query": query}
        if not self._openrouter_key or not query:
            return empty

        payload = {
            "model": self._model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a research assistant. Answer the query factually using "
                        "current web sources. Be concise (3-5 short paragraphs). "
                        "Cite specific sources for claims."
                    ),
                },
                {"role": "user", "content": query},
            ],
            "temperature": 0.2,
            "max_tokens": 800,
        }
        headers = {
            "Authorization": f"Bearer {self._openrouter_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_S) as client:
                resp = await client.post(_OPENROUTER_URL, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.warning(f"[WebSearch] Sonar call failed for query={query!r}: {e}")
            return empty

        try:
            answer = data["choices"][0]["message"]["content"] or ""
        except Exception:
            answer = ""

        # Perplexity returns citations either at top-level "citations" or inside
        # message.annotations[].url_citation.url depending on model rev.
        citation_urls: List[str] = []
        try:
            top_citations = data.get("citations") or []
            if isinstance(top_citations, list):
                for c in top_citations:
                    if isinstance(c, str):
                        citation_urls.append(c)
                    elif isinstance(c, dict) and c.get("url"):
                        citation_urls.append(c["url"])
        except Exception:
            pass
        if not citation_urls:
            try:
                annotations = data["choices"][0]["message"].get("annotations") or []
                for ann in annotations:
                    url = (ann.get("url_citation") or {}).get("url")
                    if url:
                        citation_urls.append(url)
            except Exception:
                pass

        # Dedupe + cap
        seen: set = set()
        sources: List[Dict[str, str]] = []
        for url in citation_urls:
            if not url or url in seen:
                continue
            seen.add(url)
            host = ""
            try:
                host = urlparse(url).netloc
            except Exception:
                pass
            sources.append({"title": host or url, "url": url, "snippet": ""})
            if len(sources) >= max_results:
                break

        logger.info(
            f"[WebSearch] query={query!r} → {len(answer)} chars, {len(sources)} sources"
        )
        return {"answer": answer.strip(), "sources": sources, "query": query}


def format_search_for_context(result: Dict[str, Any]) -> str:
    """Render a search result into the text block we inject into ReferenceContext."""
    if not result or not result.get("answer"):
        return ""
    query = result.get("query", "")
    answer = result.get("answer", "").strip()
    if len(answer) > 800:
        answer = answer[:800] + "…"
    lines = [f'--- Web search: "{query}" ---', f"Summary: {answer}"]
    sources = result.get("sources") or []
    if sources:
        lines.append("Sources:")
        for i, src in enumerate(sources, start=1):
            title = src.get("title") or src.get("url") or "?"
            url = src.get("url") or ""
            lines.append(f"  {i}. {title} — {url}")
    return "\n".join(lines)
