"""Cross-slide repetition detection for generated course content.

Slides are generated independently and in parallel, so no slide knows what its
chapter-mates already taught — the same definition or a near-identical MCQ can
appear on three slides (the exact complaint in the client's round-2 review).
The sibling-titles prompt block reduces this at generation time; this module is
the second line: a DETERMINISTIC post-pass over the finished HTML that finds
material repeated across slides of the same chapter, so only the repeat
offenders are regenerated (with an explicit "already covered" block) instead of
re-running the whole course.

Everything here is pure text processing — no LLM calls, no imports beyond the
stdlib — so it costs nothing on clean output and is unit-testable offline.
"""

from __future__ import annotations

import re
from typing import Dict, List, Tuple

# A sentence must be at least this long (normalized) to count as a duplicate.
# Short sentences ("What is it?", section labels) repeat legitimately.
MIN_DUP_SENTENCE_CHARS = 60
# Quiz questions are shorter than teaching sentences but still meaningful.
MIN_DUP_QUESTION_CHARS = 30

# A slide is flagged for regeneration when it repeats at least this many long
# sentences — or this many quiz questions — that an EARLIER slide already owns.
SENTENCE_FLAG_THRESHOLD = 3
QUESTION_FLAG_THRESHOLD = 2

# Never regenerate more than this many slides per course in one pass: the goal
# is removing the worst repetition, not chasing a perfect score at 2x cost.
MAX_REGENERATIONS_PER_COURSE = 6

_TAG_STRIP_RE = re.compile(
    r"<(script|style)\b[^>]*>.*?</\1\s*>", re.IGNORECASE | re.DOTALL
)
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
_NORM_RE = re.compile(r"[^a-z0-9? ]+")


def extract_text(html: str) -> str:
    """Visible text of a generated slide (scripts/styles dropped, tags stripped)."""
    if not html:
        return ""
    text = _TAG_STRIP_RE.sub(" ", html)
    # Block-level tags become sentence boundaries so headings/list items don't
    # glue onto the next sentence.
    text = re.sub(r"</(p|li|h[1-6]|div|td|th|section|article)\s*>", ". ", text, flags=re.IGNORECASE)
    text = _HTML_TAG_RE.sub(" ", text)
    # Un-escape the handful of entities that actually appear in generated HTML.
    for ent, ch in (("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&nbsp;", " "), ("&#39;", "'"), ("&quot;", '"')):
        text = text.replace(ent, ch)
    return _WS_RE.sub(" ", text).strip()


def _normalize(sentence: str) -> str:
    """Aggressive normalization so trivial rephrasing still matches."""
    s = sentence.lower()
    s = _NORM_RE.sub(" ", s)
    return _WS_RE.sub(" ", s).strip()


def split_sentences(text: str) -> List[str]:
    # Keep the terminator with its sentence — question detection needs the "?".
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip(" .!?")]


def slide_fingerprint(html: str) -> Tuple[set, set]:
    """(long teaching sentences, quiz-like questions) — both normalized."""
    text = extract_text(html)
    sentences = set()
    questions = set()
    for raw in split_sentences(text):
        is_question = "?" in raw
        norm = _normalize(raw).rstrip("? ").strip()
        if not norm:
            continue
        if is_question and len(norm) >= MIN_DUP_QUESTION_CHARS:
            questions.add(norm)
        elif len(norm) >= MIN_DUP_SENTENCE_CHARS:
            sentences.add(norm)
    return sentences, questions


def find_repetition(
    slides: List[dict],
) -> Dict[str, dict]:
    """Which slides repeat material an earlier chapter-mate already covers.

    slides: [{"path", "title", "chapter", "html"}] in course order. The FIRST
    slide to state something owns it; later slides in the SAME chapter that
    restate it are the offenders.

    Returns {path: {"owner_titles": [...], "dup_sentences": [...],
                    "dup_questions": [...]}} for slides worth regenerating,
    in course order (dict preserves insertion order).
    """
    flagged: Dict[str, dict] = {}
    # chapter -> normalized sentence/question -> owning slide title
    seen_sentences: Dict[str, Dict[str, str]] = {}
    seen_questions: Dict[str, Dict[str, str]] = {}

    for slide in slides:
        html = slide.get("html")
        if not isinstance(html, str) or not html.strip():
            continue
        chapter = slide.get("chapter") or ""
        title = slide.get("title") or slide.get("path") or "earlier slide"
        own_sent = seen_sentences.setdefault(chapter, {})
        own_q = seen_questions.setdefault(chapter, {})

        sentences, questions = slide_fingerprint(html)
        dup_sentences = sorted(s for s in sentences if s in own_sent)
        dup_questions = sorted(q for q in questions if q in own_q)

        if (
            len(dup_sentences) >= SENTENCE_FLAG_THRESHOLD
            or len(dup_questions) >= QUESTION_FLAG_THRESHOLD
        ):
            owners = sorted(
                {own_sent[s] for s in dup_sentences} | {own_q[q] for q in dup_questions}
            )
            flagged[slide["path"]] = {
                "owner_titles": owners,
                "dup_sentences": dup_sentences[:8],
                "dup_questions": dup_questions[:6],
            }
        else:
            # Clean slides become owners of their material; flagged slides do
            # NOT claim ownership — their content is about to be rewritten.
            for s in sentences:
                own_sent.setdefault(s, title)
            for q in questions:
                own_q.setdefault(q, title)

    return flagged


def dedupe_prompt_block(report: dict) -> str:
    """Prompt addendum for regenerating a flagged slide."""
    owners = ", ".join(f'"{t}"' for t in report.get("owner_titles", [])) or "other slides"
    lines = [
        "",
        "**ALREADY COVERED ELSEWHERE — the previous draft of this slide repeated "
        f"material that this chapter's other slides ({owners}) already teach. "
        "Do NOT restate any of the following; where needed, reference it in one "
        "short clause (e.g. 'as covered under " + (report.get("owner_titles") or ["the earlier slide"])[0] + "') "
        "and spend the space on THIS slide's own subject instead:**",
    ]
    for s in report.get("dup_sentences", []):
        lines.append(f"- (repeated explanation) {s[:180]}")
    for q in report.get("dup_questions", []):
        lines.append(f"- (repeated quiz question) {q[:180]}? — replace with a question that tests THIS slide's own content")
    return "\n".join(lines)


def group_document_slides(todos, generated_content_by_path: dict) -> List[dict]:
    """Adapt (todos, generated html) into find_repetition()'s input, course order."""
    slides = []
    for todo in todos:
        if getattr(todo, "type", None) != "DOCUMENT":
            continue
        html = generated_content_by_path.get(todo.path)
        if not isinstance(html, str):
            continue
        path = todo.path or ""
        chapter = getattr(todo, "chapter_name", None) or path.rsplit(".SL", 1)[0]
        slides.append(
            {"path": path, "title": todo.title or todo.name, "chapter": chapter, "html": html}
        )
    return slides


__all__ = [
    "extract_text",
    "find_repetition",
    "slide_fingerprint",
    "dedupe_prompt_block",
    "group_document_slides",
    "MAX_REGENERATIONS_PER_COURSE",
]
