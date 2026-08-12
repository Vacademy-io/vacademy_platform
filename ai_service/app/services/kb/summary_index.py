"""The hierarchical summary index — page → section → chapter → book.

WHY THIS EXISTS (the most important design note in the feature)

    Top-k vector retrieval cannot see a whole book. Ask it for "a course from
    this knowledge base" or "a full-syllabus question paper" and it returns the 8
    chunks most similar to that phrasing — which is not a syllabus, not an
    outline, and has no idea what the book covers overall. Plain RAG therefore
    produces lumpy courses with random gaps, and the failure is invisible until a
    teacher notices chapter 7 is missing.

    The fix is a compact structural index built ONCE at ingest: a summary and
    keyword set per section, grouped into chapters, under a book-level summary.
    For a 300-page book that is roughly 20k tokens total — small enough for a
    planner to read in a single call and lay out 35 modules or a paper blueprint
    with real coverage, then use vector retrieval only to fill each unit.

    It is the cheapest step in the ingest bill and the one that makes Phase 2
    possible. Removing it to "save a step" silently guts course and paper quality.

Cost control: section summarization is bounded to MAX_SECTION_CALLS per source, so
window size scales with book length rather than call count growing without limit.
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy.orm import Session

from ..llm_json import generate_json
from ..model_selection import resolve_models
from .parsing import ParsedPage
from .repository import KbRepository

logger = logging.getLogger(__name__)

USE_CASE = "knowledge_base_summary"

# Upper bound on section-summary LLM calls per source. Window size is derived
# from this, so a 1200-page book costs the same number of calls as a 300-page one
# (with proportionally larger windows) instead of 4x.
MAX_SECTION_CALLS = 60

# Smallest window worth summarizing on its own.
MIN_WINDOW_PAGES = 4

# Characters of page text fed per section call. Keeps one call well inside
# context even for Indic scripts, which tokenize ~3x denser than English.
MAX_CHARS_PER_SECTION = 18000

SECTION_CONCURRENCY = 4

# Chapter/unit headings in English + major Indian languages, plus Markdown
# headings (MathPix emits '#'/'##' for OCRed headings).
_CHAPTER_PATTERNS = [
    re.compile(r"^\s{0,3}#{1,2}\s+(?P<title>.+)$"),
    re.compile(r"^\s*(?:chapter|unit|lesson)\s+(?P<num>\d+|[ivxlc]+)\b[\s.:–-]*(?P<title>.*)$", re.I),
    re.compile(r"^\s*(?:अध्याय|पाठ|इकाई)\s+(?P<num>\d+)\b[\s.:–-]*(?P<title>.*)$"),
    re.compile(r"^\s*(?:பாடம்|அத்தியாயம்)\s+(?P<num>\d+)\b[\s.:–-]*(?P<title>.*)$"),
    re.compile(r"^\s*(?:అధ్యాయం|పాఠం)\s+(?P<num>\d+)\b[\s.:–-]*(?P<title>.*)$"),
    re.compile(r"^\s*(?:ಅಧ್ಯಾಯ|ಪಾಠ)\s+(?P<num>\d+)\b[\s.:–-]*(?P<title>.*)$"),
]


@dataclass
class _Window:
    """A contiguous page range to summarize as one 'section'."""
    page_start: int
    page_end: int
    text: str
    chapter_title: Optional[str] = None


@dataclass
class SummaryIndexResult:
    nodes_created: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model_used: Optional[str] = None
    chapters_detected: int = 0
    book_summary: Optional[str] = None
    warnings: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Structure detection
# ---------------------------------------------------------------------------

def detect_chapter_starts(pages: Sequence[ParsedPage]) -> List[Tuple[int, str]]:
    """(page_number, title) for pages that look like a chapter opening.

    Only the first few lines of a page are considered: a mid-page mention of
    "see Chapter 4" is a cross-reference, not a chapter start.
    """
    starts: List[Tuple[int, str]] = []
    for page in pages:
        head = "\n".join((page.text or "").splitlines()[:6])
        for line in head.splitlines():
            line = line.strip()
            if not line or len(line) > 140:
                continue
            for pattern in _CHAPTER_PATTERNS:
                match = pattern.match(line)
                if not match:
                    continue
                groups = match.groupdict()
                title = (groups.get("title") or "").strip(" .:–-")
                num = groups.get("num")
                if num and not title:
                    title = f"Chapter {num}"
                elif num and title:
                    title = f"Chapter {num}: {title}"
                if title and len(title) >= 3:
                    starts.append((page.page_number, title[:300]))
                break
            if starts and starts[-1][0] == page.page_number:
                break
    # Collapse duplicates on the same page, keep ascending order.
    deduped: List[Tuple[int, str]] = []
    for page_no, title in sorted(starts, key=lambda t: t[0]):
        if not deduped or deduped[-1][0] != page_no:
            deduped.append((page_no, title))
    return deduped


def build_windows(pages: Sequence[ParsedPage]) -> List[_Window]:
    """Split pages into section windows, respecting chapter starts when found."""
    usable = [p for p in pages if (p.text or "").strip()]
    if not usable:
        return []

    window_pages = max(MIN_WINDOW_PAGES, math.ceil(len(usable) / MAX_SECTION_CALLS))
    chapter_starts = detect_chapter_starts(usable)
    chapter_by_page = dict(chapter_starts)
    boundaries = {p for p, _ in chapter_starts}

    windows: List[_Window] = []
    current: List[ParsedPage] = []
    current_chapter: Optional[str] = None

    def close() -> None:
        nonlocal current
        if not current:
            return
        body = "\n\n".join(f"[p{p.page_number}] {p.text}" for p in current)
        windows.append(
            _Window(
                page_start=current[0].page_number,
                page_end=current[-1].page_number,
                text=body[:MAX_CHARS_PER_SECTION],
                chapter_title=current_chapter,
            )
        )
        current = []

    for page in usable:
        # A chapter start always begins a new window so a section never straddles
        # two chapters — that would make the chapter grouping meaningless.
        if page.page_number in boundaries and current:
            close()
        if page.page_number in chapter_by_page:
            current_chapter = chapter_by_page[page.page_number]
        current.append(page)
        if len(current) >= window_pages:
            close()
    close()
    return windows


# ---------------------------------------------------------------------------
# LLM prompts
# ---------------------------------------------------------------------------

def _section_prompt(window: _Window, source_title: str, language_hint: Optional[str]) -> str:
    lang_line = (
        f"The source is largely in '{language_hint}'. Write the summary in ENGLISH "
        "regardless, but keep technical terms and proper nouns in their original "
        "script where an English equivalent would be misleading."
        if language_hint
        else "Write the summary in English."
    )
    return f"""You are indexing a teaching document so it can later be used to plan courses and set question papers.

Document: "{source_title}"
Pages {window.page_start}-{window.page_end}{f' (chapter: {window.chapter_title})' if window.chapter_title else ''}

{lang_line}

Read the page text below and return STRICT JSON, no prose, no markdown fence:
{{
  "title": "a short, specific heading for what these pages actually cover (max 90 chars)",
  "summary": "3-5 sentences on the concepts taught here. Name the actual concepts, laws, reactions, theorems or events — not 'this section discusses various topics'.",
  "keywords": ["6-12 specific concept names a teacher would search for, e.g. 'Ohm's law', 's-block elements', 'photosynthesis light reaction'"],
  "has_worked_examples": true/false,
  "has_exercises": true/false
}}

Rules:
- Be concrete. A summary that would fit any chapter of any book is useless.
- keywords must be concepts, NOT generic words like "science", "chapter", "introduction".
- If these pages are front matter, an index, or a blank/garbled scan, set title to "Non-content pages" and keywords to [].

PAGE TEXT:
{window.text}
"""


def _book_prompt(source_title: str, section_summaries: List[Dict[str, Any]]) -> str:
    listing = "\n".join(
        f"- pp.{s['page_start']}-{s['page_end']}: {s.get('title') or 'Untitled'} — "
        f"{(s.get('summary') or '')[:220]}"
        for s in section_summaries[:120]
    )
    return f"""You are writing the top-level index entry for a teaching document that has already been summarized section by section.

Document: "{source_title}"

SECTION SUMMARIES:
{listing}

Return STRICT JSON, no prose, no markdown fence:
{{
  "title": "what this document is, specifically (e.g. 'NCERT Class 9 Science — full textbook', 'JEE Advanced organic chemistry PYQs 2015-2024')",
  "summary": "5-8 sentences: the subject, the level/audience, how it is organized, and what a teacher could realistically build from it.",
  "keywords": ["10-15 top-level topic names covered"],
  "coverage_gaps": ["anything a teacher should know is NOT covered or looks incomplete; [] if nothing stands out"]
}}
"""


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

async def build_summary_index(
    db: Session,
    *,
    kb_id: str,
    institute_id: str,
    source_id: str,
    source_title: str,
    pages: Sequence[ParsedPage],
    language_hint: Optional[str] = None,
) -> SummaryIndexResult:
    """Build and persist the summary tree for one source.

    Degrades rather than fails: if the LLM is unavailable, sections still get
    structural nodes (page ranges + detected chapter titles) with no summaries, so
    the corpus is usable and the tree can be rebuilt later by re-indexing.
    """
    result = SummaryIndexResult()
    repo = KbRepository(db)
    windows = build_windows(pages)
    if not windows:
        result.warnings.append("No text to index")
        return result

    primary, fallbacks = resolve_models(db, USE_CASE)
    models = [primary, *fallbacks]
    result.model_used = primary

    semaphore = asyncio.Semaphore(SECTION_CONCURRENCY)

    async def summarize(window: _Window) -> Dict[str, Any]:
        base = {
            "page_start": window.page_start,
            "page_end": window.page_end,
            "chapter_title": window.chapter_title,
            "title": window.chapter_title,
            "summary": None,
            "keywords": [],
        }
        async with semaphore:
            try:
                raw, model, usage = await generate_json(
                    _section_prompt(window, source_title, language_hint),
                    models,
                    label=f"kb-section-{window.page_start}",
                )
                parsed = json.loads(raw)
                base["title"] = (parsed.get("title") or window.chapter_title or "").strip()[:300] or None
                base["summary"] = (parsed.get("summary") or "").strip() or None
                keywords = parsed.get("keywords") or []
                base["keywords"] = [str(k).strip()[:120] for k in keywords if str(k).strip()][:15]
                base["usage"] = usage
                base["model"] = model
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Section summary failed for pp.%s-%s: %s",
                    window.page_start, window.page_end, exc,
                )
                base["usage"] = {}
        return base

    sections = await asyncio.gather(*(summarize(w) for w in windows))

    for section in sections:
        usage = section.pop("usage", {}) or {}
        result.prompt_tokens += int(usage.get("prompt_tokens") or 0)
        result.completion_tokens += int(usage.get("completion_tokens") or 0)
        if section.get("model"):
            result.model_used = section.pop("model")

    # --- Book-level node ---
    book_title, book_summary, book_keywords = source_title, None, []
    summarized = [s for s in sections if s.get("summary")]
    if summarized:
        try:
            raw, model, usage = await generate_json(
                _book_prompt(source_title, summarized), models, label="kb-book"
            )
            parsed = json.loads(raw)
            book_title = (parsed.get("title") or source_title).strip()[:300]
            book_summary = (parsed.get("summary") or "").strip() or None
            book_keywords = [
                str(k).strip()[:120] for k in (parsed.get("keywords") or []) if str(k).strip()
            ][:20]
            gaps = [str(g).strip() for g in (parsed.get("coverage_gaps") or []) if str(g).strip()]
            # Surfaced to the admin: "this book stops at chapter 9" is exactly the
            # kind of thing that silently ruins a generated course later.
            result.warnings.extend(gaps[:5])
            result.prompt_tokens += int(usage.get("prompt_tokens") or 0)
            result.completion_tokens += int(usage.get("completion_tokens") or 0)
            result.model_used = model
        except Exception as exc:  # noqa: BLE001
            logger.warning("Book summary failed for %s: %s", source_id, exc)

    result.book_summary = book_summary
    book_node_id = repo.insert_node(
        kb_id=kb_id, institute_id=institute_id, source_id=source_id, parent_id=None,
        level="book", title=book_title, summary=book_summary, keywords=book_keywords,
        page_start=windows[0].page_start, page_end=windows[-1].page_end, ordinal=0,
    )
    result.nodes_created += 1

    # --- Chapter nodes (only where the document actually declares chapters) ---
    chapter_node_by_title: Dict[str, str] = {}
    ordinal = 0
    for section in sections:
        title = section.get("chapter_title")
        if not title or title in chapter_node_by_title:
            continue
        ordinal += 1
        chapter_node_by_title[title] = repo.insert_node(
            kb_id=kb_id, institute_id=institute_id, source_id=source_id,
            parent_id=book_node_id, level="chapter", title=title, summary=None,
            keywords=[], page_start=section["page_start"], page_end=None, ordinal=ordinal,
        )
        result.nodes_created += 1
    result.chapters_detected = len(chapter_node_by_title)

    # --- Section nodes ---
    for idx, section in enumerate(sections, start=1):
        parent = chapter_node_by_title.get(section.get("chapter_title") or "", book_node_id)
        repo.insert_node(
            kb_id=kb_id, institute_id=institute_id, source_id=source_id,
            parent_id=parent, level="section",
            title=section.get("title"), summary=section.get("summary"),
            keywords=section.get("keywords") or [],
            page_start=section["page_start"], page_end=section["page_end"], ordinal=idx,
        )
        result.nodes_created += 1

    logger.info(
        "Summary index for %s: %s node(s), %s chapter(s), %s prompt/%s completion tokens",
        source_id, result.nodes_created, result.chapters_detected,
        result.prompt_tokens, result.completion_tokens,
    )
    return result


__all__ = ["build_summary_index", "SummaryIndexResult", "detect_chapter_starts", "build_windows"]
