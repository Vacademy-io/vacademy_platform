"""The topic tree — what a knowledge base is ABOUT, across all its sources.

This is deliberately a different view from the V435 summary tree:

    summary tree   per source, page-ordered   book → chapter → section
    topic tree     per knowledge base         topic → subtopic

The summary tree answers "where does this come from" and drives coverage
planning inside one book. The topic tree answers "what can I set a test on",
which is the question a teacher is actually asking, and it is the one that has
to span sources: a knowledge base of ten past papers should offer
"Electrochemistry" ONCE, not ten times, and should never offer "pages 1-4" or
"Answer Keys" as if those were subjects.

Built from the section summaries and keywords the ingest already produced, so it
costs one extra LLM call per rebuild rather than a re-read of the corpus.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from ..llm_json import generate_json
from ..model_selection import resolve_models
from .repository import KbRepository

logger = logging.getLogger(__name__)

USE_CASE = "knowledge_base_summary"

# Section summaries fed to the topic pass. Bounded so a 20-book knowledge base
# still fits one call; sections are sampled evenly rather than truncated, so late
# material is represented too.
MAX_SECTIONS_IN_PROMPT = 220

MAX_TOPICS = 24
MAX_SUBTOPICS_PER_TOPIC = 12

# Sections that are not teachable material. A past-paper PDF is full of these,
# and without filtering they become "topics" a teacher is offered.
_NON_CONTENT_HINTS = (
    "answer key", "answer keys", "non-content", "front matter", "index",
    "table of contents", "contents", "blank", "cover page", "instructions to candidates",
    "syllabus overview", "acknowledgement", "preface", "copyright",
)


@dataclass
class TopicNode:
    title: str
    summary: Optional[str] = None
    keywords: List[str] = field(default_factory=list)
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    subtopics: List["TopicNode"] = field(default_factory=list)


@dataclass
class TopicTreeResult:
    topics: List[TopicNode] = field(default_factory=list)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: Optional[str] = None

    @property
    def total_nodes(self) -> int:
        return len(self.topics) + sum(len(t.subtopics) for t in self.topics)


def _is_non_content(title: str, summary: str) -> bool:
    blob = f"{title} {summary}".lower()
    return any(hint in blob for hint in _NON_CONTENT_HINTS)


def _sample(items: List[Any], limit: int) -> List[Any]:
    """Evenly sample so the END of a corpus is represented, not just the start."""
    if len(items) <= limit:
        return items
    step = len(items) / limit
    return [items[int(i * step)] for i in range(limit)]


def _prompt(kb_name: str, sections: List[Dict[str, Any]], subject_hint: Optional[str]) -> str:
    listing = "\n".join(
        f"- [{s.get('source_title') or 'source'} p.{s.get('page_start') or '?'}] "
        f"{s.get('title') or 'Untitled'}: {(s.get('summary') or '')[:200]}"
        + (f" | concepts: {', '.join((s.get('keywords') or [])[:8])}" if s.get("keywords") else "")
        for s in sections
    )
    return f"""You are building the topic map for a teacher's knowledge base called "{kb_name}".
{f'The material is about: {subject_hint}.' if subject_hint else ''}

Below is every section of the material, with its summary and the concepts found in it. These
sections are how the FILE happened to be split — often just page ranges. Your job is to look past
that and produce the SUBJECT structure a teacher would recognise.

MATERIAL:
{listing}

Return STRICT JSON, no prose, no markdown fence:
{{
  "subject": "the overall subject, e.g. 'JEE Main Physics, Chemistry and Mathematics'",
  "topics": [
    {{
      "title": "a real topic a teacher would set a test on, e.g. 'Integral Calculus'",
      "summary": "one line on what this topic covers in THIS material",
      "keywords": ["specific concepts inside it"],
      "subtopics": [
        {{
          "title": "a narrower testable area, e.g. 'Definite integrals and properties'",
          "keywords": ["the concepts a question on this would use"]
        }}
      ]
    }}
  ]
}}

RULES THAT MATTER:
- Topics must be SUBJECTS, never page ranges, file names, shift numbers or dates.
  "Integral Calculus" — yes. "Questions p. 1-4", "23 Jan Shift 1", "Answer Keys" — never.
- MERGE across sources. If four different papers all cover electrochemistry, that is ONE topic,
  not four. This is the single most important rule: the whole point is a teacher sees each subject
  once for the entire knowledge base.
- Every topic needs 2-{MAX_SUBTOPICS_PER_TOPIC} subtopics. A topic with no subtopics is too vague
  to set questions from.
- Skip anything that is not teachable content: answer keys, indexes, instructions, blank or
  unreadable pages.
- At most {MAX_TOPICS} topics. If the material is broad, group at the level a syllabus would —
  prefer "Thermodynamics" over fifteen separate laws.
- Order topics the way a syllabus would, not the way the files happened to be uploaded.
"""


async def build_topic_tree(
    db: Session,
    *,
    kb_id: str,
    institute_id: str,
) -> TopicTreeResult:
    """Derive and PERSIST the topic tree for one knowledge base.

    Replaces any previous topic tree wholesale — it is a derived view, and
    rebuilding after each ingest is what keeps it describing everything in the KB
    rather than only what existed when the first source landed.
    """
    result = TopicTreeResult()
    repo = KbRepository(db)
    kb = repo.get_kb(kb_id, institute_id)
    if not kb:
        raise ValueError("Knowledge base not found")

    sections = [
        node for node in repo.get_structure_outline(kb_id, max_nodes=1000)
        if node["level"] == "section" and (node.get("summary") or node.get("keywords"))
        and not _is_non_content(node.get("title") or "", node.get("summary") or "")
    ]
    if not sections:
        logger.info("No teachable sections in kb=%s; topic tree not built", kb_id)
        return result

    primary, fallbacks = resolve_models(db, USE_CASE)
    try:
        raw, model, usage = await generate_json(
            _prompt(kb["name"], _sample(sections, MAX_SECTIONS_IN_PROMPT), kb.get("language_hint")),
            [primary, *fallbacks],
            label="kb-topics",
        )
        parsed = json.loads(raw)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Topic tree generation failed for kb=%s: %s", kb_id, exc)
        return result

    result.prompt_tokens = int(usage.get("prompt_tokens") or 0)
    result.completion_tokens = int(usage.get("completion_tokens") or 0)
    result.model = model

    # Page span per topic, so a generated row still knows roughly where its
    # material lives even though topics are not page-ordered.
    keyword_pages: Dict[str, List[int]] = {}
    for section in sections:
        for kw in section.get("keywords") or []:
            if section.get("page_start"):
                keyword_pages.setdefault(str(kw).lower(), []).append(int(section["page_start"]))

    def span(keywords: List[str]) -> tuple[Optional[int], Optional[int]]:
        pages = [p for kw in keywords for p in keyword_pages.get(str(kw).lower(), [])]
        return (min(pages), max(pages)) if pages else (None, None)

    for topic_raw in (parsed.get("topics") or [])[:MAX_TOPICS]:
        title = str(topic_raw.get("title") or "").strip()
        if not title or _is_non_content(title, str(topic_raw.get("summary") or "")):
            continue
        keywords = [str(k).strip() for k in (topic_raw.get("keywords") or []) if str(k).strip()][:20]
        start, end = span(keywords)
        topic = TopicNode(
            title=title[:300],
            summary=(str(topic_raw.get("summary") or "").strip() or None),
            keywords=keywords,
            page_start=start,
            page_end=end,
        )
        for sub_raw in (topic_raw.get("subtopics") or [])[:MAX_SUBTOPICS_PER_TOPIC]:
            sub_title = str(sub_raw.get("title") or "").strip()
            if not sub_title or _is_non_content(sub_title, ""):
                continue
            sub_keywords = [
                str(k).strip() for k in (sub_raw.get("keywords") or []) if str(k).strip()
            ][:15]
            sub_start, sub_end = span(sub_keywords or keywords)
            topic.subtopics.append(
                TopicNode(
                    title=sub_title[:300],
                    summary=(str(sub_raw.get("summary") or "").strip() or None),
                    keywords=sub_keywords,
                    page_start=sub_start,
                    page_end=sub_end,
                )
            )
        result.topics.append(topic)

    repo.replace_topic_tree(kb_id, institute_id, result.topics)
    logger.info(
        "Topic tree for kb=%s: %s topic(s), %s node(s) total, %s prompt/%s completion tokens",
        kb_id, len(result.topics), result.total_nodes,
        result.prompt_tokens, result.completion_tokens,
    )
    return result


__all__ = ["build_topic_tree", "TopicNode", "TopicTreeResult", "MAX_TOPICS"]
