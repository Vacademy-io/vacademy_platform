"""What the assistant can look things up in, besides the catalogue.

* Site pages: the published catalogue's pages, split into sections, chunked
  (~800 chars), embedded (768-d, the platform embedder) and stored in
  site_assistant_page_chunk. Re-indexed when the published pages'
  fingerprint changes; one pod at a time (site_assistant_index_state is the
  lock). Not billed (platform cost); logged.
* FAQs and notices: site_assistant_knowledge rows, embedded on create/update.
* Linked knowledge bases: retrieval only, through kb/retrieval.py, and only
  for bases the institute owns or may use.

Searches fall back to keyword matching when an embedding is not available,
so an embedder outage degrades answers instead of breaking them.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
from typing import Any, Dict, Iterable, List, Optional, Sequence

from sqlalchemy import text

from ..db import db_session
from ..services.catalogue_summary import heading_of, strip_html, walk_components
from . import repository as repo
from .guards import words_for_search

logger = logging.getLogger(__name__)

INDEX_VERSION = "sa-index-v1"
CHUNK_CHARS = 800
MAX_SITE_CHARS = 400_000
MAX_CHUNKS = 600
PAGE_THRESHOLD = 0.35
KNOWLEDGE_THRESHOLD = 0.35
_SKIP_KEYS = {"id", "url", "href", "src", "image", "imageurl", "logo", "icon", "color", "background", "style",
              "classname", "variant", "anchorid", "type", "audienceid", "campaignid", "target", "link", "css",
              "backgroundimage", "posterimage", "thumbnail", "avatar", "photo", "alignment", "layout", "theme"}
_SKIP_TYPES = {"header", "cartComponent", "leadForm", "contactForm", "newsletterSignup", "videoEmbed", "imageGallery"}
_JUNK_RE = re.compile(r"^(#[0-9a-f]{3,8}|https?:\S+|[a-z0-9_\-]+|\d+(px|rem|em|%)?|rgba?\(.*\))$", re.I)


# ── extraction ────────────────────────────────────────────────────────────

def _strings(node: Any, out: List[str], depth: int = 0) -> None:
    if depth > 7 or node is None:
        return
    if isinstance(node, str):
        s = strip_html(node, 20_000)
        if len(s) >= 3 and not _JUNK_RE.match(s.strip()):
            out.append(s)
    elif isinstance(node, list):
        for v in node:
            _strings(v, out, depth + 1)
    elif isinstance(node, dict):
        for k, v in node.items():
            if str(k).lower() in _SKIP_KEYS or k == "slots":
                continue
            _strings(v, out, depth + 1)


def _page_visible(page: Dict[str, Any]) -> bool:
    if page.get("hidden") is True or page.get("enabled") is False or page.get("draft") is True:
        return False
    return bool(page.get("route") is not None or page.get("id"))


def extract_sections(catalogue: Dict[str, Any]) -> List[Dict[str, Any]]:
    """[{page_route, page_title, section_id, heading, text}] in document order.

    Repeated blocks (a footer on every page) are kept once."""
    out: List[Dict[str, Any]] = []
    seen: set = set()
    total = 0
    for page in (catalogue or {}).get("pages") or []:
        if not isinstance(page, dict) or not _page_visible(page):
            continue
        route = str(page.get("route") or "").strip()
        title = strip_html(page.get("title") or (page.get("seo") or {}).get("metaTitle") or route or "Home", 160)
        for comp in walk_components(page.get("components")):
            if comp.get("enabled") is False or comp.get("type") in _SKIP_TYPES:
                continue
            strings: List[str] = []
            props = comp.get("props") or {}
            if comp.get("type") == "htmlPage":
                strings.append(strip_html(str(props.get("html") or ""), 20_000))
            else:
                _strings(props, strings)
            body = "\n".join(dict.fromkeys(s for s in strings if s))
            if len(body) < 20:
                continue
            key = hashlib.sha1(body.encode()).hexdigest()
            if key in seen:
                continue
            seen.add(key)
            total += len(body)
            if total > MAX_SITE_CHARS:
                return out
            out.append({"page_route": route, "page_title": title, "section_id": comp.get("anchorId") or comp.get("id"),
                        "heading": heading_of(comp) or None, "text": body})
    return out


def chunk_sections(sections: List[Dict[str, Any]], size: int = CHUNK_CHARS) -> List[Dict[str, Any]]:
    chunks: List[Dict[str, Any]] = []
    for s in sections:
        body = s["text"]
        start = 0
        while start < len(body):
            end = min(len(body), start + size)
            if end < len(body):
                window = body[start:end]
                br = max(window.rfind(". "), window.rfind("\n"), window.rfind("। "))
                if br > size // 2:
                    end = start + br + 1
            piece = body[start:end].strip()
            if piece:
                prefix = s["page_title"] + (f" › {s['heading']}" if s.get("heading") else "")
                chunks.append({"page_route": s["page_route"], "page_title": s["page_title"],
                               "section_id": s.get("section_id"), "heading": s.get("heading"),
                               "content": f"{prefix}\n{piece}"[:CHUNK_CHARS + 200]})
            start = end
        if len(chunks) >= MAX_CHUNKS:
            break
    return chunks[:MAX_CHUNKS]


def fingerprint(catalogue: Dict[str, Any]) -> str:
    """sha256 of the published pages (settings edits elsewhere do not re-index)."""
    pages = (catalogue or {}).get("pages") or []
    blob = json.dumps({"v": INDEX_VERSION, "pages": pages}, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(blob.encode()).hexdigest()


# ── embeddings ────────────────────────────────────────────────────────────

class _Embedder:
    """The platform embedder (OpenRouter gemini-embedding-001, 768-d)."""

    async def documents(self, texts: List[str], institute_id: str) -> List[Optional[List[float]]]:
        from ..services.api_key_resolver import ApiKeyResolver
        from ..services.embedding_service import EmbeddingService
        with db_session() as db:
            svc = EmbeddingService(ApiKeyResolver(db))
            try:
                return await svc.embed_batch(texts, institute_id)
            finally:
                await svc.close()

    async def query(self, text_: str, institute_id: str) -> Optional[List[float]]:
        from ..services.api_key_resolver import ApiKeyResolver
        from ..services.embedding_service import EmbeddingService
        with db_session() as db:
            svc = EmbeddingService(ApiKeyResolver(db))
            try:
                vec = await svc.embed_query(text_, institute_id)
            finally:
                await svc.close()
        return vec if vec and any(vec) else None


embedder = _Embedder()


async def embed_query_safe(query: str, institute_id: str) -> Optional[List[float]]:
    try:
        return await embedder.query(query, institute_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("site-assistant: query embedding failed (%s); keyword search only", exc)
        return None


# ── page index ────────────────────────────────────────────────────────────

_background: set = set()


def needs_index(institute_id: str, site_tag: str, fp: str) -> bool:
    with db_session() as db:
        state = repo.index_state(db, institute_id, site_tag)
    if not state or state.get("fingerprint") != fp or state.get("status") == "FAILED":
        return True
    if state.get("status") == "INDEXING":   # a holder that died mid-run is taken over after 15 min
        from datetime import datetime, timedelta, timezone
        try:
            started = datetime.fromisoformat(str(state.get("updated_at")))
        except ValueError:
            return True
        return started < datetime.now(timezone.utc) - timedelta(minutes=15)
    return False


async def index_site(institute_id: str, site_tag: str, catalogue: Dict[str, Any], *, force: bool = False) -> Dict[str, Any]:
    """Index the site's pages if this pod wins the lock. Returns {status, chunks}."""
    fp = fingerprint(catalogue)
    with db_session() as db:
        if not repo.try_lock_index(db, institute_id, site_tag, fp, force=force):
            return {"status": "skipped"}
    sections = extract_sections(catalogue)
    chunks = chunk_sections(sections)
    error: Optional[str] = None
    try:
        vectors = await embedder.documents([c["content"] for c in chunks], institute_id) if chunks else []
    except Exception as exc:  # noqa: BLE001
        logger.warning("site-assistant index %s/%s: embedding failed (%s); storing for keyword search",
                       institute_id, site_tag, exc)
        vectors, error = [None] * len(chunks), f"embeddings unavailable: {type(exc).__name__}"
    for c, v in zip(chunks, vectors):
        c["embedding"] = v
    if chunks and not any(c.get("embedding") for c in chunks) and not error:
        error = "embeddings unavailable"
    try:
        with db_session() as db:
            n = repo.replace_page_chunks(db, institute_id, site_tag, fp, chunks)
            repo.finish_index(db, institute_id, site_tag, fingerprint=fp, ok=error is None, chunks=n, error=error)
    except Exception as exc:  # noqa: BLE001
        logger.exception("site-assistant index %s/%s failed", institute_id, site_tag)
        with db_session() as db:
            repo.finish_index(db, institute_id, site_tag, fingerprint=fp, ok=False, error=str(exc)[:500])
        return {"status": "FAILED", "chunks": 0}
    logger.info("site-assistant index %s/%s: %d sections → %d chunks (platform cost, not billed)%s",
                institute_id, site_tag, len(sections), n, f"; {error}" if error else "")
    return {"status": "READY" if error is None else "FAILED", "chunks": n}


def ensure_index_background(institute_id: str, site_tag: str, catalogue: Dict[str, Any]) -> None:
    """Kick off indexing when the published pages changed. Never raises."""
    try:
        fp = fingerprint(catalogue)
        if not needs_index(institute_id, site_tag, fp):
            return
        task = asyncio.get_running_loop().create_task(index_site(institute_id, site_tag, catalogue))
        _background.add(task)
        task.add_done_callback(_background.discard)
    except Exception as exc:  # noqa: BLE001
        logger.warning("site-assistant: could not start indexing %s/%s: %s", institute_id, site_tag, exc)


async def search_pages(institute_id: str, site_tag: str, query: str, top_k: int = 4) -> List[Dict[str, Any]]:
    vec = await embed_query_safe(query, institute_id)
    with db_session() as db:
        hits: List[Dict[str, Any]] = []
        if vec:
            hits = repo.search_page_chunks_vector(db, institute_id, site_tag, vec, top_k, PAGE_THRESHOLD)
        if not hits:
            hits = repo.search_page_chunks_keyword(db, institute_id, site_tag, words_for_search(query), top_k)
    return hits


# ── FAQs and notices ──────────────────────────────────────────────────────

async def embed_knowledge(institute_id: str, kid: str, title: str, body: str) -> bool:
    try:
        vecs = await embedder.documents([f"{title}\n{body}"[:4000]], institute_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("site-assistant: FAQ/notice embedding failed for %s (%s)", kid, exc)
        return False
    vec = vecs[0] if vecs else None
    with db_session() as db:
        repo.set_knowledge_embedding(db, institute_id, kid, vec)
    return bool(vec)


async def search_knowledge(institute_id: str, site_tag: str, query: str, kinds: Sequence[str],
                           top_k: int = 4) -> List[Dict[str, Any]]:
    if not kinds:
        return []
    vec = await embed_query_safe(query, institute_id)
    with db_session() as db:
        hits: List[Dict[str, Any]] = []
        if vec:
            hits = repo.search_knowledge_vector(db, institute_id, site_tag, kinds, vec, top_k, KNOWLEDGE_THRESHOLD)
        have = {h["id"] for h in hits}
        if len(hits) < top_k:
            for h in repo.search_knowledge_keyword(db, institute_id, site_tag, kinds, words_for_search(query), top_k):
                if h["id"] not in have and len(hits) < top_k:
                    hits.append(h)
    return hits


# ── linked KBs + institute info ──────────────────────────────────────────

def _source_urls(db, source_ids: Iterable[str]) -> Dict[str, str]:
    ids = [s for s in dict.fromkeys(source_ids) if s]
    if not ids:
        return {}
    rows = db.execute(text("SELECT id, source_url FROM knowledge_base_source WHERE id = ANY(CAST(:ids AS TEXT[]))"),
                      {"ids": [str(i) for i in ids]}).fetchall()
    return {str(r[0]): r[1] for r in rows if isinstance(r[1], str) and r[1].startswith("https://")}


async def search_linked_kbs(institute_id: str, kb_ids: Sequence[str], query: str, top_k: int = 3) -> List[Dict[str, Any]]:
    """Passages from the site's linked KBs the institute may use, with source URLs when they have one."""
    from ..services.kb.repository import KbRepository
    from ..services.kb.retrieval import KbRetrievalService
    out: List[Dict[str, Any]] = []
    if not kb_ids:
        return out
    with db_session() as db:
        kb_repo = KbRepository(db)
        retrieval = KbRetrievalService(db)
        for kb_id in list(kb_ids)[:5]:
            try:
                kb = kb_repo.get_kb(kb_id, institute_id)
                if not kb or not kb_repo.is_usable(kb, institute_id):
                    continue
                hits = await retrieval.search(kb_id=kb_id, institute_id=institute_id, query=query,
                                              top_k=top_k, similarity_threshold=0.35)
            except Exception as exc:  # noqa: BLE001
                logger.warning("site-assistant: linked KB %s search failed: %s", kb_id, exc)
                continue
            for h in hits:
                out.append({"kb": kb.get("name"), "source_id": h.get("source_id"), "title": h.get("source_title"),
                            "content": (h.get("content_text") or "")[:1500],
                            "similarity": h.get("similarity_score")})
        urls = _source_urls(db, (h["source_id"] for h in out))
    for h in out:
        if urls.get(str(h.get("source_id"))):
            h["url"] = urls[str(h["source_id"])]
    out.sort(key=lambda h: -(h.get("similarity") or 0))
    return out[:top_k * 2]


async def search_institute_info(institute_id: str, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
    from ..services.kb.retrieval import KbRetrievalService
    try:
        with db_session() as db:
            hits = await KbRetrievalService(db).search_institute(institute_id=institute_id, query=query, top_k=top_k,
                                                                 purposes=["institute_info"])
    except Exception as exc:  # noqa: BLE001
        logger.warning("site-assistant: institute_info search failed: %s", exc)
        return []
    return [{"title": h.get("source_title") or h.get("knowledge_base_name"), "content": (h.get("content_text") or "")[:1500],
             "similarity": h.get("similarity_score")} for h in hits or []]
