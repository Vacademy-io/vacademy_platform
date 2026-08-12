"""Page-aware chunking.

The existing `EmbeddingService.chunk_text` slices a flat string, so a chunk comes
back with no idea which page it came from. For a knowledge base that is
disqualifying: a generated question a teacher cannot trace to a page is a
question they cannot verify, and an unverifiable question paper does not get used
twice.

So chunking happens over (page_number, text) units and every chunk carries the
page range it spans plus the ids of any figures on those pages.

Chunk sizing follows the existing convention (~2000 chars / ~500 tokens with 200
chars of overlap) so vectors stay comparable with everything already embedded by
the same model. NOTE for regional-language corpora: Indic scripts tokenize at
roughly 2.5-4x English for the same character count, so a 2000-char Tamil chunk
is a far bigger token payload than a 2000-char English one. Retrieval is
unaffected; prompt budgeting downstream must not assume 500 tokens per chunk.
"""
from __future__ import annotations

import logging
import re
from typing import Dict, List, Optional, Sequence

from .parsing import ParsedFigure, ParsedPage, detect_languages
from .repository import ChunkToStore

logger = logging.getLogger(__name__)

CHUNK_SIZE = 2000
CHUNK_OVERLAP = 200

# Below this, a chunk is noise (a page number, a running header) and pollutes
# retrieval more than it helps.
MIN_CHUNK_CHARS = 80

_PARAGRAPH_SPLIT = re.compile(r"\n\s*\n")


def _split_page(text: str) -> List[str]:
    """Split a page into paragraph-ish units, falling back to lines then a hard
    slice, so a single wall-of-text page still chunks sensibly."""
    text = (text or "").strip()
    if not text:
        return []
    parts = [p.strip() for p in _PARAGRAPH_SPLIT.split(text) if p.strip()]
    if not parts:
        parts = [text]

    units: List[str] = []
    for part in parts:
        if len(part) <= CHUNK_SIZE:
            units.append(part)
            continue
        # A paragraph bigger than a whole chunk: break on sentence ends, and
        # hard-slice only what refuses to break.
        sentences = re.split(r"(?<=[.!?。॥])\s+", part)
        buffer = ""
        for sentence in sentences:
            if len(sentence) > CHUNK_SIZE:
                if buffer:
                    units.append(buffer.strip())
                    buffer = ""
                for i in range(0, len(sentence), CHUNK_SIZE):
                    units.append(sentence[i:i + CHUNK_SIZE].strip())
                continue
            if len(buffer) + len(sentence) + 1 > CHUNK_SIZE:
                units.append(buffer.strip())
                buffer = sentence
            else:
                buffer = f"{buffer} {sentence}".strip()
        if buffer:
            units.append(buffer.strip())
    return [u for u in units if u]


def build_chunks(
    pages: Sequence[ParsedPage],
    *,
    figures: Optional[Sequence[ParsedFigure]] = None,
    figure_ids: Optional[Sequence[str]] = None,
    source_title: Optional[str] = None,
    language_hint: Optional[str] = None,
) -> List[ChunkToStore]:
    """Pack pages into overlapping chunks that remember where they came from.

    `figures` and `figure_ids` are positionally paired (as returned by
    KbRepository.insert_figures) so a chunk can point at the real diagrams on its
    pages. Pages with no text are skipped — a flagged blank page belongs in the
    review queue, not in the retrieval index.
    """
    figures = list(figures or [])
    figure_ids = list(figure_ids or [])
    # page number → figure ids on that page
    figures_by_page: Dict[int, List[str]] = {}
    for fig, fig_id in zip(figures, figure_ids):
        if fig.page_number is None:
            continue
        figures_by_page.setdefault(fig.page_number, []).append(fig_id)

    # Flatten to (page_number, unit_text)
    units: List[tuple[int, str]] = []
    for page in pages:
        for unit in _split_page(page.text):
            units.append((page.page_number, unit))

    chunks: List[ChunkToStore] = []
    buffer: List[str] = []
    buffer_pages: List[int] = []
    buffer_len = 0

    def flush(seed_overlap: bool) -> None:
        """Emit the buffer as a chunk.

        seed_overlap=False on the LAST flush: re-seeding the tail there would
        leave a trailing chunk consisting only of the previous chunk's overlap.
        """
        nonlocal buffer, buffer_pages, buffer_len
        if not buffer:
            return
        body = "\n\n".join(buffer).strip()
        if len(body) < MIN_CHUNK_CHARS:
            buffer, buffer_pages, buffer_len = [], [], 0
            return
        page_start, page_end = min(buffer_pages), max(buffer_pages)
        span_figures: List[str] = []
        for page_no in range(page_start, page_end + 1):
            span_figures.extend(figures_by_page.get(page_no, []))

        langs = detect_languages(body)
        chunks.append(
            ChunkToStore(
                content_text=body,
                chunk_index=len(chunks),
                page_start=page_start,
                page_end=page_end,
                figure_ids=span_figures[:12],
                lang=(langs[0] if langs else language_hint),
                meta_data={
                    "source_title": source_title,
                    "page_start": page_start,
                    "page_end": page_end,
                    "languages": langs,
                    "figure_count": len(span_figures),
                },
            )
        )
        # Carry a tail of overlap so a fact split across a boundary is still
        # retrievable from both sides.
        tail = body[-CHUNK_OVERLAP:] if (seed_overlap and len(body) > CHUNK_OVERLAP) else ""
        if tail:
            buffer, buffer_pages, buffer_len = [tail], [page_end], len(tail)
        else:
            buffer, buffer_pages, buffer_len = [], [], 0

    for page_no, unit in units:
        if buffer_len + len(unit) + 2 > CHUNK_SIZE and buffer:
            flush(seed_overlap=True)
        buffer.append(unit)
        buffer_pages.append(page_no)
        buffer_len += len(unit) + 2

    flush(seed_overlap=False)

    logger.info("Built %s chunk(s) from %s page(s)", len(chunks), len(pages))
    return chunks


__all__ = ["build_chunks", "CHUNK_SIZE", "CHUNK_OVERLAP"]
