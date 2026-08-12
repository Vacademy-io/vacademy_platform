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

# Enough passages to cover a slide's subject without burying the model. Slides
# are narrow by construction, so recall past this adds cost, not coverage.
SLIDE_TOP_K = 6

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


def outline_grounding_block(
    db: Session,
    *,
    kb_id: str,
    institute_id: str,
    node_ids: Optional[List[str]] = None,
    mode: str = "STRICT",
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
        lines.append(f"- {topic['title']}")
        for child in picked_children:
            lines.append(f"    - {child['title']}")

    if not lines:
        return ""

    rule = (
        "Build the course ONLY from these topics. Do not add topics that are not "
        "listed — the institute teaches this syllabus and anything else is noise."
        if mode == "STRICT"
        else "Build the course primarily from these topics. You may add a small "
        "amount of connective material where a topic would otherwise be hard to "
        "follow."
    )

    return (
        f"\n\n===== COURSE MATERIAL: {kb['name']} =====\n"
        "This institute's own material has already been read and indexed. Below "
        "is its real topic structure, in the order the material presents it — "
        "which for a textbook is usually already a sensible teaching order.\n\n"
        f"{chr(10).join(lines)}\n\n"
        f"{rule}\n"
        "Each slide you plan will be written from the actual pages about its "
        "topic, so give every slide a title that names its subject plainly "
        "rather than a marketing phrase — a vague title retrieves vague pages.\n"
        "===== END COURSE MATERIAL =====\n"
    )


async def ground_slide(
    db: Session,
    *,
    kb_id: str,
    institute_id: str,
    query: str,
    mode: str = "STRICT",
) -> SlideGrounding:
    """Retrieve the material for one slide.

    `query` should be the slide's title plus its chapter, which is specific
    enough to retrieve the right pages and short enough to embed cheaply.
    """
    result = SlideGrounding()
    if not query.strip():
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

    try:
        hits = await KbRetrievalService(db).search(
            kb_id=kb_id,
            institute_id=institute_id,
            query=query,
            top_k=SLIDE_TOP_K,
            similarity_threshold=threshold,
        )
    except Exception:  # noqa: BLE001
        # One slide failing to retrieve must not abort a 25-slide course.
        logger.warning("KB grounding failed for slide %r", query[:80], exc_info=True)
        return result

    if not hits:
        return result

    result.top_similarity = float(hits[0].get("similarity_score") or 0)

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
        if used + len(block) > MAX_SLIDE_GROUNDING_CHARS:
            break
        parts.append(block)
        used += len(block)
        result.citations.append(_cite(hit))
        for fig in hit.get("figures") or []:
            result.figures.append(fig)

    if not parts:
        return result

    result.passages = "\n\n".join(parts)
    result.supported = True
    return result


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
        "notation, symbols and worked examples exactly as written — the students "
        "have this material in front of them and different notation is worse "
        "than no slide. If the passages do not cover something, leave it out."
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
