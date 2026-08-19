"""Ground a generated course in a knowledge base.

Two grounding points, because a course is built in two passes and they need
different things from the material:

  OUTLINE — needs the SHAPE of the whole corpus. Uses the topic tree, which is
      compact and complete. The uploaded-PDF path can only fit the book's first
      60k characters into the prompt, so a 300-page textbook contributes its
      preface and the model invents the rest of the structure.

  EACH SLIDE — needs the passages about ITS OWN subject. Uses retrieval, so a
      slide on rotational motion is written from the pages about rotational
      motion rather than from whatever happened to fit in the outline prompt.

The second is where course quality actually comes from, and it is the one the
uploaded-PDF path never did: there, reference documents contribute figures only.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from .repository import KbRepository
from .retrieval import KbRetrievalService

logger = logging.getLogger(__name__)

# Matches MAX_GROUNDING_CHARS_SLIDE in course_document_ingest — the per-slide
# budget that was defined for the PDF path and never used.
MAX_SLIDE_GROUNDING_CHARS = 12_000

# Faithful runs need the passages to actually FIT: real chunks average ~1.7k
# chars, so the 12k budget admits only ~7 of them and would silently cancel the
# widened top-k below. ~28k chars is ≈7k tokens of grounding — comfortable for
# the models these courses run on, and the difference between "the slide saw
# the whole section" and "the slide saw the first third of it".
MAX_SLIDE_GROUNDING_CHARS_FAITHFUL = 28_000

# Enough passages to cover a slide's subject without burying the model. Slides
# are narrow by construction, so recall past this adds cost, not coverage.
SLIDE_TOP_K = 6

# …except when the course must reproduce the material faithfully. Top-6 was
# leaving whole prescribed sub-sections unretrieved (a 26-page chapter indexes
# to ~50 passages, so 6 is ~12% of it) and the slide then read as if the source
# never mentioned them. Fidelity runs trade prompt size for recall.
SLIDE_TOP_K_FAITHFUL = 14

# Below this a "hit" is usually a topically-adjacent paragraph rather than the
# material the slide is about. Treating those as support is how a course ends up
# citing pages that do not back what the slide claims.
SLIDE_MIN_SIMILARITY = 0.35


@dataclass
class SlideGrounding:
    """What the material offers for one slide."""

    # Prompt-ready passages, already budgeted and labelled with page numbers.
    passages: str = ""
    # Figures belonging to those passages — the diagram from the page being
    # taught, not one matched by caption-string similarity.
    figures: List[Dict[str, Any]] = field(default_factory=list)
    # {source_title, page_start, page_end} for each passage used, stored on the
    # slide so a teacher can verify any claim in one click.
    citations: List[Dict[str, Any]] = field(default_factory=list)
    # Chunks actually included — the coverage sweep diffs these against the
    # KB's full chunk census to find dropped material. (Their pages come from
    # the existing `pages` property, derived from citations.)
    chunk_ids: List[str] = field(default_factory=list)
    # False when the knowledge base does not really cover this slide.
    supported: bool = False
    top_similarity: float = 0.0

    @property
    def pages(self) -> List[int]:
        out: List[int] = []
        for c in self.citations:
            if c.get("page_start"):
                out.append(int(c["page_start"]))
        return sorted(set(out))


def _cite(hit: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "source_title": hit.get("source_title"),
        "page_start": hit.get("page_start"),
        "page_end": hit.get("page_end"),
        "similarity": hit.get("similarity_score"),
    }


def deterministic_sections(
    db: Session,
    *,
    kb_id: str,
    institute_id: str,
    node_ids: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    """The selected slice of the topic tree, in source order, for DETERMINISTIC
    outline construction (REPLICATE+FULL): topics become chapters and subtopics
    become slides VERBATIM, so the model cannot rename, reorder or drop them.

    Returns {"kb_name": str, "sections": [...]} or None when the KB is
    missing/locked/tree-less — the caller then falls back to the LLM outline."""
    repo = KbRepository(db)
    kb = repo.get_kb(kb_id, institute_id)
    if not kb or not repo.is_usable(kb, institute_id):
        return None
    tree = repo.get_topic_tree(kb_id)
    if not tree:
        return None

    wanted = set(node_ids or [])
    out: List[Dict[str, Any]] = []
    for topic in tree:
        children = topic.get("subtopics") or []
        parent_picked = not wanted or topic["id"] in wanted
        picked_children = [
            c for c in children
            if not wanted or parent_picked or c["id"] in wanted
        ]
        if not parent_picked and not picked_children:
            continue
        out.append({**topic, "subtopics": picked_children})
    if not out:
        return None
    return {"kb_name": kb.get("name") or "Course", "sections": out}


def _pages(node: Dict[str, Any]) -> str:
    """' (pages 12-18)' for a node that knows where it lives in the source."""
    start, end = node.get("page_start"), node.get("page_end")
    if not start:
        return ""
    return f"  (pages {start}-{end})" if end and end != start else f"  (page {start})"


def outline_grounding_block(
    db: Session,
    *,
    kb_id: str,
    institute_id: str,
    node_ids: Optional[List[str]] = None,
    mode: str = "STRICT",
    fidelity: str = "REPLICATE",
    coverage: str = "FULL",
) -> str:
    """The prompt block that makes the outline follow the material's real shape.

    Returns "" when the knowledge base has no topic tree, which leaves the
    caller's prompt untouched rather than asserting a structure that isn't there.
    """
    repo = KbRepository(db)
    kb = repo.get_kb(kb_id, institute_id)
    if not kb:
        return ""
    # get_kb lets any institute READ a published library — that is the catalogue
    # page. Generating a course from it is using the material, which needs the
    # unlock. Checked here as well as at the router so no future caller can
    # reach the corpus by going straight to grounding.
    if not repo.is_usable(kb, institute_id):
        logger.warning(
            "Refusing to ground a course in locked library %s for institute %s",
            kb_id, institute_id,
        )
        return ""

    tree = repo.get_topic_tree(kb_id)
    if not tree:
        return ""

    wanted = set(node_ids or [])

    lines: List[str] = []
    section_count = 0
    for topic in tree:
        children = topic.get("subtopics") or []
        # A selected parent implies all of its subtopics; otherwise keep only the
        # subtopics that were ticked. An empty selection means the whole KB.
        parent_picked = not wanted or topic["id"] in wanted
        picked_children = [
            c for c in children
            if not wanted or parent_picked or c["id"] in wanted
        ]
        if not parent_picked and not picked_children:
            continue
        # Carry the material's REAL structure — order, page span and the section
        # summary. Titles alone made the model re-derive a structure of its own,
        # which is how generated courses ended up renaming/reordering a book's
        # chapters and silently dropping sections.
        section_count += 1
        lines.append(f"{section_count}. {topic['title']}{_pages(topic)}")
        if topic.get("summary"):
            lines.append(f"      ({str(topic['summary'])[:220]})")
        for child in picked_children:
            section_count += 1
            lines.append(f"    {section_count}. {child['title']}{_pages(child)}")

    if not lines:
        return ""

    # Outside knowledge: STRICT keeps the course inside the material.
    rule = (
        "Build the course ONLY from these sections. Do not add topics that are not "
        "listed — the institute teaches this syllabus and anything else is noise."
        if mode == "STRICT"
        else "Build the course primarily from these sections. You may add a small "
        "amount of connective material where a section would otherwise be hard to "
        "follow."
    )

    # Coverage: FULL guarantees every listed section becomes a slide, so nothing
    # in the source silently disappears. HIGHLIGHTS lets the model condense.
    coverage_rule = (
        "COVERAGE — cover EVERY numbered section above: each one must map to at "
        "least one slide, and a long section may split across several. Do not "
        "merge several sections into one slide, do not skip any, and do not stop "
        "early. Work through them IN THE ORDER LISTED — that is the order the "
        "material teaches them."
        if coverage == "FULL"
        else "Cover the important sections above; you may condense closely-related "
        "ones. Keep the material's overall order."
    )

    # Fidelity: REPLICATE mirrors the source's own headings/wording/identity.
    fidelity_rule = (
        "FIDELITY — this course must mirror the material, not reinterpret it. "
        "Reuse the material's OWN heading wording (do not rename, re-theme or "
        "'improve' it), keep its numbering and sequence, and preserve any chapter "
        "identity it states (chapter number, title, authors, stated learning "
        "objectives) exactly as written.\n"
        "TITLES MUST BE UNIQUE: every slide needs its own distinct title — name it "
        "after the sub-section or the specific aspect it teaches, NOT after its "
        "parent chapter. Never give two slides in a chapter the same title (and "
        "never simply repeat the chapter heading on each of its slides): slides are "
        "matched to their generated content by title, so duplicates silently leave "
        "slides empty."
        if fidelity == "REPLICATE"
        else "Give every slide a title that names its subject plainly rather than "
        "a marketing phrase — a vague title retrieves vague pages. When you rename "
        "or merge a source section, append the source's original section name in "
        "brackets — 'New Engaging Title (Original Section Name)' — "
        "so teachers can still find the material in their book."
    )

    return (
        f"\n\n===== COURSE MATERIAL: {kb['name']} =====\n"
        "This institute's own material has already been read and indexed. Below "
        "is its real section structure, numbered in the order the material "
        "presents it, with the pages each section occupies.\n\n"
        f"{chr(10).join(lines)}\n\n"
        f"{rule}\n{coverage_rule}\n{fidelity_rule}\n"
        "Each slide will be written from the actual pages about its section, so "
        "name each slide after the section it teaches.\n"
        "===== END COURSE MATERIAL =====\n"
    )


async def ground_slide(
    db: Session,
    *,
    kb_id: str,
    institute_id: str,
    query: str,
    mode: str = "STRICT",
    faithful: bool = True,
    node_id: Optional[str] = None,
) -> SlideGrounding:
    """Retrieve the material for one slide.

    `query` should be the slide's title plus its chapter, which is specific
    enough to retrieve the right pages and short enough to embed cheaply.

    `faithful` widens recall (SLIDE_TOP_K_FAITHFUL) for courses that must
    reproduce the material rather than summarise it.

    `node_id` (deterministic outlines carry the section's topic-tree id):
    WHOLE-SECTION grounding — the slide gets every chunk of its own section, in
    source order, instead of a similarity guess. Similarity top-k over a section
    can miss the exact sub-parts a client prescribed; the section's own chunks
    cannot. Falls back to similarity search when the node has no linked chunks.
    """
    result = SlideGrounding()
    if not (query.strip() or node_id):
        return result

    repo = KbRepository(db)
    kb = repo.get_kb(kb_id, institute_id)
    if not kb or not repo.is_usable(kb, institute_id):
        # Same rule as the outline block: reading a library's listing is not the
        # right to write a course out of it.
        return result

    # STRICT claims the material *supports* each slide, so it needs a firmer
    # match before saying so. BLENDED is going to add its own connective text
    # anyway, so a weaker passage is still worth having.
    threshold = SLIDE_MIN_SIMILARITY if mode == "STRICT" else SLIDE_MIN_SIMILARITY - 0.08

    hits: List[Dict[str, Any]] = []
    if node_id:
        try:
            # Chunks are stored under the KB owner's institute (PLATFORM
            # libraries!), same scoping search() applies internally.
            hits = repo.get_chunks_for_node(
                kb_id=kb_id, institute_id=kb["institute_id"], node_id=node_id
            )
            if hits:
                # Hydrate figures the same way search() does.
                all_fids = [fid for h in hits for fid in h.get("figure_ids", [])]
                figs = repo.get_figures_by_ids(all_fids)
                for h in hits:
                    h["figures"] = [
                        figs[fid] for fid in h.get("figure_ids", []) if fid in figs
                    ]
        except Exception:  # noqa: BLE001
            logger.warning("Node-scoped grounding failed for node %s", node_id, exc_info=True)
            hits = []

    if not hits:
        try:
            hits = await KbRetrievalService(db).search(
                kb_id=kb_id,
                institute_id=institute_id,
                query=query,
                top_k=SLIDE_TOP_K_FAITHFUL if faithful else SLIDE_TOP_K,
                similarity_threshold=threshold,
            )
        except Exception:  # noqa: BLE001
            # One slide failing to retrieve must not abort a 25-slide course.
            logger.warning("KB grounding failed for slide %r", query[:80], exc_info=True)
            return result

    if not hits:
        return result

    result.top_similarity = float(hits[0].get("similarity_score") or 0)

    # Widened top-k is pointless if the budget then truncates it back down.
    budget = MAX_SLIDE_GROUNDING_CHARS_FAITHFUL if faithful else MAX_SLIDE_GROUNDING_CHARS
    parts: List[str] = []
    used = 0
    for hit in hits:
        text = (hit.get("content_text") or "").strip()
        if not text:
            continue
        page = hit.get("page_start")
        header = f"[{hit.get('source_title') or 'Material'}"
        header += f", p. {page}]" if page else "]"
        block = f"{header}\n{text}"
        if used + len(block) > budget:
            break
        parts.append(block)
        used += len(block)
        result.citations.append(_cite(hit))
        if hit.get("chunk_id"):
            result.chunk_ids.append(hit["chunk_id"])
        for fig in hit.get("figures") or []:
            result.figures.append(fig)

    if not parts:
        return result

    result.passages = "\n\n".join(parts)
    result.supported = True
    return result




# ── Coverage sweep ───────────────────────────────────────────────────────────
# FULL coverage promises "nothing in the material silently disappears", but
# per-slide retrieval can only cover chunks it reaches: node-scoped grounding
# dies when ingest linked chunks to tree nodes no slide uses, and similarity
# top-k ranks *something* out on every slide. The sweep is the guarantee that
# survives both: census every chunk, diff against what the slides actually
# retrieved, and hand each dropped chunk to the page-nearest slide as explicit
# extra material. (Client audit: "Physical inactivity" and "People-like-me"
# vanished exactly this way — section-linked chunks invisible to every slide.)

MAX_SWEEP_CHUNKS = 400          # census cap — sweep is for faithful courses, not 10k-chunk corpora
SUPPLEMENT_CHARS_PER_SLIDE = 8_000


def assign_uncovered_chunks(
    all_chunks: List[Dict[str, Any]],
    groundings: Dict[str, "SlideGrounding"],
) -> Dict[str, List[Dict[str, Any]]]:
    """Pure assignment logic (offline-testable): uncovered chunk → nearest slide.

    Nearness is by page distance to the pages a slide actually retrieved —
    the one signal that exists regardless of how ingest shaped the tree. A
    chunk with no page, or a sweep with no paged slides, assigns to the first
    supported slide rather than being dropped."""
    used = {cid for g in groundings.values() for cid in g.chunk_ids}
    supported = [(path, g) for path, g in groundings.items() if g.supported]
    if not supported:
        return {}

    assignments: Dict[str, List[Dict[str, Any]]] = {}
    for chunk in all_chunks:
        if chunk["chunk_id"] in used:
            continue
        page = chunk.get("page_start")
        best_path = None
        if page is not None:
            best_dist = None
            for path, g in supported:
                if not g.pages:
                    continue
                dist = min(abs(page - p) for p in g.pages)
                if best_dist is None or dist < best_dist:
                    best_dist, best_path = dist, path
        if best_path is None:
            best_path = supported[0][0]
        assignments.setdefault(best_path, []).append(chunk)
    return assignments


def supplement_block(chunks: List[Dict[str, Any]], budget: int = SUPPLEMENT_CHARS_PER_SLIDE) -> str:
    """Prompt addendum carrying the chunks no slide retrieved."""
    parts: List[str] = []
    used = 0
    for chunk in chunks:
        text_ = (chunk.get("content_text") or "").strip()
        if not text_:
            continue
        page = chunk.get("page_start")
        header = f"[{chunk.get('source_title') or 'Material'}"
        header += f", p. {page}]" if page is not None else "]"
        block = f"{header}\n{text_}"
        if used + len(block) > budget:
            break
        parts.append(block)
        used += len(block)
    if not parts:
        return ""
    return (
        "\n===== ADDITIONAL COURSE MATERIAL (coverage) =====\n"
        "These passages are from the SAME material but were not retrieved for any "
        "other slide — this slide is their only home. Teach their distinct "
        "concepts too (each named concept, definition and list must appear); do "
        "not drop them because they extend beyond the slide title.\n\n"
        + "\n\n".join(parts)
        + "\n===== END ADDITIONAL MATERIAL =====\n"
    )


def slide_prompt_block(grounding: SlideGrounding, mode: str = "STRICT") -> str:
    """Turn retrieved passages into the instruction the slide generator sees."""
    if not grounding.supported:
        if mode == "STRICT":
            # Said plainly so the model does not quietly substitute its own
            # knowledge and produce a slide indistinguishable from a grounded one.
            return (
                "\n\n===== COURSE MATERIAL =====\n"
                "The institute's material does not cover this slide. Keep it "
                "SHORT and general, and do not invent specifics — no numbers, "
                "dates, formulae or named examples that you cannot support.\n"
                "===== END COURSE MATERIAL =====\n"
            )
        return ""

    rule = (
        "Write this slide ONLY from the passages above. Use their definitions, "
        "notation, symbols, headings and worked examples exactly as written — the "
        "students have this material in front of them and different notation is "
        "worse than no slide. If the passages do not cover something, leave it "
        "out.\n"
        "NEVER introduce specifics the passages do not state: no named tests, "
        "scales, instruments, acronyms, cut-off values, statistics, dates, "
        "citations or invented case studies. A shorter slide that matches the "
        "material is correct; a fuller slide containing anything you added is "
        "wrong and will be rejected. Cover what the passages DO say completely — "
        "do not summarise away their lists, steps or classifications.\n"
        "TERMINOLOGY: teach the material's OWN terms, sequence and framework as "
        "the primary one. If you know a standard model or classification that "
        "uses different terms for the same ideas, do NOT merge, relabel or "
        "'correct' the material's version with it — mention the other framework "
        "only if the passages themselves do, and then keep the two distinct, "
        "presented the way the material presents them."
        if mode == "STRICT"
        else "Write this slide primarily from the passages above, matching their "
        "notation and terminology. You may add brief connective explanation, but "
        "never contradict them."
    )

    return (
        "\n\n===== COURSE MATERIAL — the pages this slide teaches =====\n"
        f"{grounding.passages}\n\n"
        f"{rule}\n"
        "===== END COURSE MATERIAL =====\n"
    )


__all__ = [
    "MAX_SLIDE_GROUNDING_CHARS",
    "SLIDE_TOP_K",
    "SLIDE_MIN_SIMILARITY",
    "SlideGrounding",
    "outline_grounding_block",
    "ground_slide",
    "slide_prompt_block",
]
