"""Question papers generated from a knowledge base.

The whole design rests on one observation: **a question paper is a planning
problem before it is a writing problem.** Top-k retrieval can write a good
question about whatever it happened to retrieve, but it cannot decide that a
40-mark paper needs 10 one-markers from mixtures, 5 three-markers from
solutions and 3 numericals — and it cannot notice that chapter 4 never appeared.

So generation runs in two stages:

  1. BLUEPRINT — one call over the KB's summary tree (V435 knowledge_base_node),
     which is a compact structural index of what the corpus actually contains.
     It returns rows: section × topic × type × count × marks × difficulty. The
     teacher edits this table BEFORE any question exists. It is cheap, it is
     where their judgment belongs, and fixing coverage here costs nothing.

  2. GENERATE — per blueprint row, retrieve the passages for THAT topic and
     write its questions in one batched call. Batching per row (rather than one
     call per question) is the difference between reloading the retrieved
     context 60 times and 10 times.

Every question carries the page it came from, and reuses the book's real
diagrams rather than a generated approximation — both come free from what
ingestion already stored.

Output is emitted in the exact JSON shape `question_format.format_questions`
expects, so KB questions land in the assessment builder byte-identical to every
other AI source instead of via a parallel path.
"""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy.orm import Session

from ..llm_json import generate_json
from ..model_selection import resolve_models
from ..question_gen_service import QUESTIONS_USE_CASE
from .repository import KbRepository
from .retrieval import KbRetrievalService

logger = logging.getLogger(__name__)

BLUEPRINT_USE_CASE = "knowledge_base_qa"
# Reuse the SAME registry use-case as every other question generator, so
# retargeting question quality is one PATCH on /models/v2/defaults/questions and
# applies everywhere — rather than KB papers quietly drifting onto a different
# model from the rest of the platform.
QUESTION_USE_CASE = QUESTIONS_USE_CASE

# Questions written per LLM call. One call per question reloads the retrieved
# passages every time; batching by blueprint row shares one context load across
# the whole row. 6 keeps output well inside limits while cutting input ~5x.
QUESTIONS_PER_CALL = 6

# Concurrent generation calls. Bounded so a 60-question paper does not open 10
# simultaneous long completions against the provider.
GENERATION_CONCURRENCY = 3

# Passages retrieved per blueprint row. Enough to write from, small enough that
# Indic text (≈3x denser to tokenize) still fits comfortably.
PASSAGES_PER_ROW = 6

MAX_QUESTIONS_PER_PAPER = 120

QUESTION_TYPES = ("MCQS", "ONE_WORD", "LONG_ANSWER", "NUMERIC")

# What each blueprint type is STORED as.
#
# `question_format.format_questions` — the shared converter every AI question
# source funnels through — dispatches on MCQS / MCQM / ONE_WORD / LONG_ANSWER and
# SILENTLY SKIPS anything else. It has no NUMERIC branch, even though NUMERIC is
# a real platform question type. So a numerical question emitted as NUMERIC is
# dropped on the floor: it shows in the review board and then never reaches the
# question bank.
#
# NUMERIC therefore stays a PLANNING type (it shapes the prompt — "a numerical
# problem with a definite answer, show the working") but is stored as ONE_WORD,
# which is what a numeric answer actually is. Removing NUMERIC from the blueprint
# instead would cost teachers the ability to ask for numericals at all.
STORAGE_QUESTION_TYPE = {
    "MCQS": "MCQS",
    "ONE_WORD": "ONE_WORD",
    "LONG_ANSWER": "LONG_ANSWER",
    "NUMERIC": "ONE_WORD",
}


@dataclass
class BlueprintRow:
    """One line of the paper plan. Directly editable by the teacher."""
    id: str
    section: str                     # "Section A"
    topic: str                       # what it tests, in the book's own words
    node_ids: List[str] = field(default_factory=list)   # summary-tree anchors
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    question_type: str = "MCQS"
    count: int = 5
    marks_each: float = 1
    difficulty: str = "MEDIUM"       # EASY | MEDIUM | HARD
    instruction: Optional[str] = None

    @property
    def total_marks(self) -> float:
        return self.count * self.marks_each

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id, "section": self.section, "topic": self.topic,
            "node_ids": self.node_ids, "page_start": self.page_start,
            "page_end": self.page_end, "question_type": self.question_type,
            "count": self.count, "marks_each": self.marks_each,
            "difficulty": self.difficulty, "instruction": self.instruction,
            "total_marks": self.total_marks,
        }

    @staticmethod
    def from_dict(raw: Dict[str, Any], index: int = 0) -> "BlueprintRow":
        qtype = str(raw.get("question_type") or "MCQS").upper()
        if qtype not in QUESTION_TYPES:
            qtype = "MCQS"
        return BlueprintRow(
            id=str(raw.get("id") or f"row-{index + 1}"),
            section=str(raw.get("section") or "Section A"),
            topic=str(raw.get("topic") or "General"),
            node_ids=[str(n) for n in (raw.get("node_ids") or [])],
            page_start=raw.get("page_start"),
            page_end=raw.get("page_end"),
            question_type=qtype,
            count=max(0, int(raw.get("count") or 0)),
            marks_each=float(raw.get("marks_each") or 1),
            difficulty=str(raw.get("difficulty") or "MEDIUM").upper(),
            instruction=raw.get("instruction"),
        )


@dataclass
class Blueprint:
    title: str
    rows: List[BlueprintRow] = field(default_factory=list)
    duration_minutes: Optional[int] = None
    instructions: List[str] = field(default_factory=list)
    language: Optional[str] = None
    notes: List[str] = field(default_factory=list)   # coverage warnings, shown to the teacher

    @property
    def total_questions(self) -> int:
        return sum(r.count for r in self.rows)

    @property
    def total_marks(self) -> float:
        return sum(r.total_marks for r in self.rows)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "rows": [r.to_dict() for r in self.rows],
            "duration_minutes": self.duration_minutes,
            "instructions": self.instructions,
            "language": self.language,
            "notes": self.notes,
            "total_questions": self.total_questions,
            "total_marks": self.total_marks,
        }

    @staticmethod
    def from_dict(raw: Dict[str, Any]) -> "Blueprint":
        return Blueprint(
            title=str(raw.get("title") or "Question Paper"),
            rows=[BlueprintRow.from_dict(r, i) for i, r in enumerate(raw.get("rows") or [])],
            duration_minutes=raw.get("duration_minutes"),
            instructions=[str(i) for i in (raw.get("instructions") or [])],
            language=raw.get("language"),
            notes=[str(n) for n in (raw.get("notes") or [])],
        )


# ---------------------------------------------------------------------------
# Stage 1 — blueprint
# ---------------------------------------------------------------------------

def _outline_digest(nodes: Sequence[Dict[str, Any]], selected: Optional[List[str]]) -> str:
    """Render the KB structure for the planner.

    This is the whole point of the summary tree: ~20k tokens describing what a
    300-page book covers, so the planner can lay out coverage in one pass rather
    than guessing from 8 retrieved chunks.
    """
    keep = set(selected or [])
    lines: List[str] = []
    for node in nodes:
        if keep and node["id"] not in keep and node.get("parent_id") not in keep:
            continue
        indent = {"book": "", "chapter": "  ", "section": "    "}.get(node["level"], "    ")
        pages = ""
        if node.get("page_start"):
            pages = f" [p.{node['page_start']}"
            pages += f"-{node['page_end']}]" if node.get("page_end") else "]"
        line = f"{indent}({node['id']}) {node.get('title') or 'Untitled'}{pages}"
        if node.get("summary"):
            line += f"\n{indent}    {node['summary'][:260]}"
        if node.get("keywords"):
            line += f"\n{indent}    concepts: {', '.join(node['keywords'][:10])}"
        lines.append(line)
    return "\n".join(lines)


def _blueprint_prompt(
    *,
    kb_name: str,
    outline: str,
    spec: Dict[str, Any],
    current: Optional[Blueprint],
    instruction: Optional[str],
) -> str:
    wanted = []
    if spec.get("total_marks"):
        wanted.append(f"total marks: {spec['total_marks']}")
    if spec.get("duration_minutes"):
        wanted.append(f"duration: {spec['duration_minutes']} minutes")
    if spec.get("difficulty"):
        wanted.append(f"overall difficulty: {spec['difficulty']}")
    if spec.get("question_types"):
        wanted.append(f"question types allowed: {', '.join(spec['question_types'])}")
    if spec.get("grade"):
        wanted.append(f"class/level: {spec['grade']}")
    if spec.get("language"):
        wanted.append(f"paper language: {spec['language']}")
    if spec.get("exam_style"):
        wanted.append(f"pattern to follow: {spec['exam_style']}")

    refine_block = ""
    if current is not None:
        refine_block = f"""
THE TEACHER ALREADY HAS THIS BLUEPRINT:
{json.dumps(current.to_dict(), indent=1)}

THEY ASKED FOR THIS CHANGE: "{instruction or 'improve it'}"

Apply that change and return the FULL updated blueprint. Keep every row they did
not ask you to touch exactly as it is, including its id, so their earlier edits
survive.
"""

    return f"""You are planning a question paper for a teacher, using ONLY the material in their knowledge base "{kb_name}".

WHAT THE PAPER MUST BE:
{chr(10).join(f'- {w}' for w in wanted) if wanted else '- a balanced paper over the selected material'}

WHAT THE MATERIAL ACTUALLY CONTAINS (id, title, pages, summary, concepts):
{outline}
{refine_block}
Produce a BLUEPRINT — the plan, not the questions. Return STRICT JSON, no prose, no markdown fence:
{{
  "title": "a specific paper title, e.g. 'Class 9 Science — Is Matter Around Us Pure — Unit Test'",
  "duration_minutes": 90,
  "language": "English",
  "instructions": ["3-6 instruction lines a real paper carries, e.g. 'All questions are compulsory.'"],
  "rows": [
    {{
      "id": "row-1",
      "section": "Section A",
      "topic": "the specific concept this group tests, in the book's own vocabulary",
      "node_ids": ["ids copied EXACTLY from the outline above that this row draws on"],
      "page_start": 11,
      "page_end": 18,
      "question_type": "MCQS | ONE_WORD | LONG_ANSWER | NUMERIC",
      "count": 10,
      "marks_each": 1,
      "difficulty": "EASY | MEDIUM | HARD",
      "instruction": "optional line printed under the section heading"
    }}
  ],
  "notes": ["anything the teacher should know — e.g. 'Chapter 4 has little numerical material, so only 2 numericals are possible'"]
}}

RULES THAT MATTER:
- node_ids MUST be ids copied from the outline. They are how each row finds its
  passages later. A row with no valid node_ids cannot be generated.
- COVER the selected material. Do not put 40 marks on one section and ignore the
  rest — check the outline and spread rows across it.
- Marks must add up to the requested total. If they cannot, get as close as
  possible and say so in "notes".
- Only plan what the material supports. If there are no numerical worked examples
  in the source, do not plan a numerical section — say so in "notes" instead.
- Order sections the way a real paper does: objective/short first, long last.
"""


async def build_blueprint(
    db: Session,
    *,
    kb_id: str,
    institute_id: str,
    spec: Dict[str, Any],
    selected_node_ids: Optional[List[str]] = None,
    current: Optional[Blueprint] = None,
    instruction: Optional[str] = None,
) -> tuple[Blueprint, Dict[str, int], str]:
    """Plan a paper (or revise an existing plan) from the KB's structure.

    Returns (blueprint, token_usage, model). Raises ValueError when the KB has no
    summary tree yet — a paper planned without one would have no idea what the
    corpus covers.
    """
    repo = KbRepository(db)
    kb = repo.get_kb(kb_id, institute_id)
    if not kb:
        raise ValueError("Knowledge base not found")

    nodes = repo.get_structure_outline(kb_id)
    if not nodes:
        raise ValueError(
            "This knowledge base has no chapter summary yet. Add a document and "
            "wait for it to finish processing before planning a paper."
        )

    outline = _outline_digest(nodes, selected_node_ids)
    if not outline.strip():
        raise ValueError("None of the selected chapters were found in this knowledge base")

    primary, fallbacks = resolve_models(db, BLUEPRINT_USE_CASE)
    raw, model, usage = await generate_json(
        _blueprint_prompt(
            kb_name=kb["name"], outline=outline, spec=spec,
            current=current, instruction=instruction,
        ),
        [primary, *fallbacks],
        label="kb-paper-blueprint",
    )
    blueprint = Blueprint.from_dict(json.loads(raw))

    # Drop rows the planner invented node_ids for: they would silently generate
    # from whatever retrieval happened to return, which is exactly the
    # ungrounded behaviour this design exists to prevent.
    valid_ids = {n["id"] for n in nodes}
    for row in blueprint.rows:
        row.node_ids = [nid for nid in row.node_ids if nid in valid_ids]
    dropped = [r for r in blueprint.rows if not r.node_ids and r.count > 0]
    if dropped:
        blueprint.rows = [r for r in blueprint.rows if r.node_ids or r.count == 0]
        blueprint.notes.append(
            f"{len(dropped)} planned section(s) were removed because they did not "
            "map to anything in this knowledge base."
        )

    if blueprint.total_questions > MAX_QUESTIONS_PER_PAPER:
        blueprint.notes.append(
            f"This plan has {blueprint.total_questions} questions; the limit per "
            f"paper is {MAX_QUESTIONS_PER_PAPER}. Reduce some counts before generating."
        )
    return blueprint, usage, model


# ---------------------------------------------------------------------------
# Stage 2 — questions
# ---------------------------------------------------------------------------

def _passages_prompt_block(hits: Sequence[Dict[str, Any]]) -> tuple[str, Dict[str, Dict[str, Any]]]:
    """Render retrieved passages, and return the figure catalogue keyed by tag.

    Figures are offered to the model by an opaque tag it can echo back. It never
    sees a URL, so it cannot invent one — the tag is substituted for real markup
    afterwards.
    """
    blocks: List[str] = []
    figures: Dict[str, Dict[str, Any]] = {}
    for i, hit in enumerate(hits, start=1):
        header = f"[P{i}]"
        if hit.get("page_start"):
            header += f" page {hit['page_start']}"
            if hit.get("page_end") and hit["page_end"] != hit["page_start"]:
                header += f"-{hit['page_end']}"
        block = f"{header}\n{hit.get('content_text') or ''}"
        for fig in hit.get("figures") or []:
            if not fig.get("image_url"):
                continue
            tag = f"FIG{len(figures) + 1}"
            figures[tag] = fig
            desc = fig.get("caption") or fig.get("alt_text") or "figure from the source"
            block += f"\n[{tag}] diagram on page {fig.get('page_number')}: {desc}"
        blocks.append(block)
    return "\n\n".join(blocks), figures


def _question_prompt(
    row: BlueprintRow,
    passages: str,
    figure_tags: Sequence[str],
    language: Optional[str],
    grade: Optional[str],
    start_number: int,
) -> str:
    figure_block = (
        f"""
DIAGRAMS AVAILABLE: {', '.join(figure_tags)}
To use one, put the tag on its own line inside the question content, e.g.
"Study the diagram below and answer:\\n[{figure_tags[0]}]\\nName the component marked X."
Use a diagram ONLY where it genuinely makes the question better. Never invent an
image tag that is not in that list.
"""
        if figure_tags
        else ""
    )
    type_rules = {
        "MCQS": (
            "Exactly 4 options. Exactly one correct unless the question says "
            '"choose all that apply". Wrong options must be plausible — a '
            "distractor nobody would pick tests nothing."
        ),
        "ONE_WORD": "Answer is a single word, number, or very short phrase.",
        "LONG_ANSWER": (
            "A structured answer worth the marks. Provide a model answer with the "
            "marking points a teacher would award."
        ),
        "NUMERIC": (
            "A numerical problem with a definite numeric answer. Show the full "
            "working in the explanation, with units."
        ),
    }

    return f"""Write {row.count} exam questions for a teacher, using ONLY the passages below from their own material.

SECTION: {row.section} — {row.topic}
TYPE: {row.question_type} — {type_rules.get(row.question_type, '')}
DIFFICULTY: {row.difficulty}
MARKS EACH: {row.marks_each}
{f'CLASS/LEVEL: {grade}' if grade else ''}
{f'WRITE THE QUESTIONS IN: {language}' if language else ''}
{figure_block}
PASSAGES FROM THE TEACHER'S MATERIAL:
{passages}

Return STRICT JSON, no prose, no markdown fence:
{{
  "questions": [
    {{
      "question_number": {start_number},
      "question": {{"type": "HTML", "content": "the question, as HTML"}},
      "options": [
        {{"type": "HTML", "preview_id": "1", "content": "option text"}},
        {{"type": "HTML", "preview_id": "2", "content": "option text"}},
        {{"type": "HTML", "preview_id": "3", "content": "option text"}},
        {{"type": "HTML", "preview_id": "4", "content": "option text"}}
      ],
      "correct_options": ["2"],
      "ans": "the answer",
      "exp": "why, as HTML — the marking scheme for a teacher, not a hint for a student",
      "question_type": "{row.question_type}",
      "level": "{row.difficulty.lower()}",
      "tags": ["concept names this tests"],
      "source_passage": "P1",
      "source_page": 14
    }}
  ]
}}

RULES THAT MATTER:
- Ground EVERY question in the passages. If the passages do not support {row.count}
  distinct questions, return fewer — a padded paper is worse than a short one.
- "source_passage" and "source_page" must point at the passage you actually used.
  A teacher checks these; a wrong citation destroys trust in the whole paper.
- Preserve the source's notation exactly, including LaTeX like $E_k=\\frac{{1}}{{2}}mv^2$.
- JSON REQUIRES every backslash to be doubled. Write \\\\sqrt, \\\\int, \\\\pi, \\\\frac —
  NOT \\sqrt. A single backslash makes the whole response invalid and it is thrown away.
- Do NOT copy a passage's own exercise questions verbatim. Write new ones that
  test the same understanding.
- No two questions may test the same fact in the same way.
- For non-MCQ types, still return the "options" key as an empty list [].
"""


@dataclass
class GeneratedPaper:
    questions: List[Dict[str, Any]] = field(default_factory=list)   # question_format shape
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: Optional[str] = None
    warnings: List[str] = field(default_factory=list)
    per_row: Dict[str, int] = field(default_factory=dict)           # row id → delivered count


def _substitute_figures(
    content: str, figures: Dict[str, Dict[str, Any]], used: List[Dict[str, Any]]
) -> str:
    """Replace [FIGn] tags with real <img> markup from our S3.

    The model never sees a URL — it echoes a tag — so a hallucinated image link
    is structurally impossible. Unknown tags are stripped rather than left as
    literal text in a printed paper.
    """
    import re

    def repl(match: "re.Match[str]") -> str:
        tag = match.group(1)
        fig = figures.get(tag)
        if not fig:
            return ""
        used.append(fig)
        alt = (fig.get("caption") or fig.get("alt_text") or "Figure from the source material")
        return (
            f'<img src="{fig["image_url"]}" alt="{alt}" '
            f'style="max-width:100%;height:auto;" />'
        )

    return re.sub(r"\[(FIG\d+)\]", repl, content or "")


async def generate_questions(
    db: Session,
    *,
    kb_id: str,
    institute_id: str,
    blueprint: Blueprint,
    grade: Optional[str] = None,
) -> GeneratedPaper:
    """Generate every question in a blueprint, row by row, in bounded parallel.

    Each row retrieves its OWN passages (scoped to the topic it plans to test) and
    writes its questions in batched calls. Rows are independent, so one failing
    row costs its questions, not the paper.
    """
    result = GeneratedPaper()
    repo = KbRepository(db)
    kb = repo.get_kb(kb_id, institute_id)
    if not kb:
        raise ValueError("Knowledge base not found")

    retrieval = KbRetrievalService(db)
    primary, fallbacks = resolve_models(db, QUESTION_USE_CASE)
    models = [primary, *fallbacks]
    result.model = primary
    language = blueprint.language
    semaphore = asyncio.Semaphore(GENERATION_CONCURRENCY)

    # Stable numbering across rows, assigned up front so concurrent rows cannot
    # race for question numbers.
    numbering: Dict[str, int] = {}
    running = 1
    for row in blueprint.rows:
        numbering[row.id] = running
        running += row.count

    async def do_row(row: BlueprintRow) -> List[Dict[str, Any]]:
        if row.count <= 0:
            return []
        # Retrieve using the row's own topic — the blueprint already decided
        # WHAT this row tests, so the query is specific rather than the whole
        # paper's subject.
        query = f"{row.topic} {' '.join(row.instruction.split()[:12]) if row.instruction else ''}".strip()
        try:
            hits = await retrieval.search(
                kb_id=kb_id, institute_id=institute_id, query=query,
                top_k=PASSAGES_PER_ROW, similarity_threshold=0.2,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Retrieval failed for row %s: %s", row.id, exc)
            hits = []
        if not hits:
            result.warnings.append(
                f"'{row.topic}' — nothing matching was found in the material, so "
                f"its {row.count} question(s) were skipped."
            )
            return []

        passages, figures = _passages_prompt_block(hits)
        produced: List[Dict[str, Any]] = []
        start = numbering[row.id]

        # Batch within the row so the retrieved context is loaded once per batch
        # rather than once per question.
        remaining = row.count
        while remaining > 0 and len(produced) < row.count:
            take = min(QUESTIONS_PER_CALL, remaining)
            batch_row = BlueprintRow(**{**row.__dict__, "count": take})
            async with semaphore:
                try:
                    raw, model, usage = await generate_json(
                        _question_prompt(
                            batch_row, passages, list(figures.keys()),
                            language, grade, start + len(produced),
                        ),
                        models,
                        label=f"kb-paper-{row.id}",
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Generation failed for row %s: %s", row.id, exc)
                    result.warnings.append(
                        f"'{row.topic}' — {remaining} question(s) could not be generated."
                    )
                    break
            result.prompt_tokens += int(usage.get("prompt_tokens") or 0)
            result.completion_tokens += int(usage.get("completion_tokens") or 0)
            result.model = model

            try:
                batch = json.loads(raw).get("questions") or []
            except Exception:  # noqa: BLE001
                batch = []
            if not batch:
                break

            for q in batch[:take]:
                used_figs: List[Dict[str, Any]] = []
                qtext = (q.get("question") or {}).get("content") or ""
                (q.setdefault("question", {}))["content"] = _substitute_figures(
                    qtext, figures, used_figs
                )
                # Provenance the review board and the teacher both read.
                q["kb_meta"] = {
                    "row_id": row.id,
                    "section": row.section,
                    "topic": row.topic,
                    "marks": row.marks_each,
                    "source_page": q.get("source_page"),
                    # What the teacher ASKED for, which may differ from what the
                    # platform stores (see STORAGE_QUESTION_TYPE). The review
                    # board shows this one.
                    "planned_type": row.question_type,
                    "figures": [
                        {"image_url": f["image_url"], "page_number": f.get("page_number")}
                        for f in used_figs
                    ],
                }
                # Storage type, NOT the planning type: emitting NUMERIC here
                # would make question_format skip the question silently.
                q["question_type"] = STORAGE_QUESTION_TYPE.get(
                    row.question_type, row.question_type
                )
                produced.append(q)

            remaining = row.count - len(produced)
            if len(batch) < take:
                # The model judged the material insufficient — believe it rather
                # than looping to pad the paper with weaker questions.
                result.warnings.append(
                    f"'{row.topic}' — the material supported {len(produced)} of "
                    f"{row.count} question(s)."
                )
                break

        result.per_row[row.id] = len(produced)
        return produced

    rows_out = await asyncio.gather(*(do_row(r) for r in blueprint.rows))
    for produced in rows_out:
        result.questions.extend(produced)

    logger.info(
        "KB paper: %s/%s question(s) across %s row(s), %s prompt/%s completion tokens",
        len(result.questions), blueprint.total_questions, len(blueprint.rows),
        result.prompt_tokens, result.completion_tokens,
    )
    return result


# ---------------------------------------------------------------------------
# Stage 3 — validation
# ---------------------------------------------------------------------------

@dataclass
class PaperIssue:
    question_number: Optional[int]
    severity: str        # error | warning
    kind: str            # missing_answer | duplicate | marks_mismatch | coverage | bad_options
    message: str


def validate_paper(blueprint: Blueprint, questions: Sequence[Dict[str, Any]]) -> List[PaperIssue]:
    """Structural checks that need no LLM call.

    This is the step everyone skips, and it is what separates a paper a teacher
    can print from a demo. Everything here is deterministic: an LLM re-reading
    its own output is far less reliable at "do the marks add up" than arithmetic.
    """
    issues: List[PaperIssue] = []

    for q in questions:
        num = q.get("question_number")
        qtype = (q.get("question_type") or "").upper()
        content = ((q.get("question") or {}).get("content") or "").strip()

        if not content:
            issues.append(PaperIssue(num, "error", "bad_options", "Question text is empty."))
        if not (q.get("ans") or q.get("correct_options")):
            issues.append(PaperIssue(num, "error", "missing_answer", "No answer recorded."))
        if not (q.get("exp") or "").strip():
            issues.append(PaperIssue(
                num, "warning", "missing_answer",
                "No explanation or marking scheme — a teacher cannot mark this consistently.",
            ))
        if qtype == "MCQS":
            options = q.get("options") or []
            if len(options) != 4:
                issues.append(PaperIssue(
                    num, "error", "bad_options",
                    f"{len(options)} option(s) instead of 4.",
                ))
            correct = q.get("correct_options") or []
            if not correct:
                issues.append(PaperIssue(num, "error", "missing_answer", "No correct option marked."))
            else:
                valid = {str(o.get("preview_id")) for o in options}
                stray = [c for c in map(str, correct) if c not in valid]
                if stray:
                    issues.append(PaperIssue(
                        num, "error", "missing_answer",
                        f"Correct option {stray} does not match any option on this question.",
                    ))
        if not q.get("source_page"):
            issues.append(PaperIssue(
                num, "warning", "coverage",
                "No source page recorded, so this question cannot be traced back to the material.",
            ))

    # Near-duplicate detection on a normalized word bag. Cheap, and catches the
    # real failure mode: two rows independently writing the same question.
    seen: List[tuple[Optional[int], set]] = []
    for q in questions:
        text = ((q.get("question") or {}).get("content") or "").lower()
        words = {w for w in "".join(c if c.isalnum() else " " for c in text).split() if len(w) > 3}
        if not words:
            continue
        for prev_num, prev_words in seen:
            overlap = len(words & prev_words) / max(1, min(len(words), len(prev_words)))
            if overlap > 0.75:
                issues.append(PaperIssue(
                    q.get("question_number"), "warning", "duplicate",
                    f"Very similar to question {prev_num}.",
                ))
                break
        seen.append((q.get("question_number"), words))

    # Marks and coverage against what the teacher approved.
    delivered_marks = 0.0
    by_row: Dict[str, int] = {}
    for q in questions:
        meta = q.get("kb_meta") or {}
        delivered_marks += float(meta.get("marks") or 0)
        rid = meta.get("row_id")
        if rid:
            by_row[rid] = by_row.get(rid, 0) + 1
    if blueprint.total_marks and abs(delivered_marks - blueprint.total_marks) > 0.01:
        issues.append(PaperIssue(
            None, "warning", "marks_mismatch",
            f"Paper totals {delivered_marks:g} marks; the plan was {blueprint.total_marks:g}.",
        ))
    for row in blueprint.rows:
        got = by_row.get(row.id, 0)
        if got < row.count:
            issues.append(PaperIssue(
                None, "warning", "coverage",
                f"'{row.topic}' has {got} of {row.count} planned question(s).",
            ))
    return issues


def pair_with_formatted(
    raw_questions: Sequence[Dict[str, Any]],
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[str]]:
    """Format questions ONE AT A TIME so the two lists can never drift apart.

    `question_format.format_questions` is lenient by design: it SKIPS a question
    it cannot convert rather than failing the batch. Formatting the whole list in
    one call therefore returns a SHORTER array than it was given, and any caller
    that pairs the two by index — as the review board does, to map a rewritten
    question back to its original — silently operates on the wrong question.

    Returns (raw_kept, formatted, warnings), guaranteed equal length and aligned.
    Anything dropped is reported rather than vanishing.
    """
    from ..question_format import format_questions

    raw_kept: List[Dict[str, Any]] = []
    formatted: List[Dict[str, Any]] = []
    dropped: List[Any] = []

    for raw in raw_questions:
        try:
            out = format_questions([raw])
        except Exception as exc:  # noqa: BLE001
            logger.warning("Formatting failed for question %s: %s", raw.get("question_number"), exc)
            out = []
        if out:
            raw_kept.append(raw)
            formatted.append(out[0])
        else:
            dropped.append(raw.get("question_number"))

    warnings: List[str] = []
    if dropped:
        logger.warning("Dropped %s unusable question(s): %s", len(dropped), dropped)
        warnings.append(
            f"{len(dropped)} generated question(s) were malformed and have been "
            "left out of the paper."
        )
    return raw_kept, formatted, warnings


__all__ = [
    "Blueprint", "BlueprintRow", "GeneratedPaper", "PaperIssue",
    "build_blueprint", "generate_questions", "validate_paper", "pair_with_formatted",
    "MAX_QUESTIONS_PER_PAPER", "QUESTION_TYPES", "STORAGE_QUESTION_TYPE",
]
