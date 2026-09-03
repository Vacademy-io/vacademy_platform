"""Live AI Tutor — request/response and plan schemas.

The plan schema doubles as the contract the compile model must return; the
validator (services/tutor/plan_validator.py) enforces the rules Pydantic
cannot express (board size, id uniqueness, cross-references).
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field


# ── Board operations ─────────────────────────────────────────────────────────
# Every op that adds an element carries a stable `id`; ops that act on an
# element carry `target`. `anim` and `say_index` drive the learner-side reveal.

Anim = Literal["write", "fade", "pop"]


class _OpBase(BaseModel):
    anim: Optional[Anim] = None
    after: Optional[str] = None
    # Index of the sentence in `say` this op is revealed with (0-based).
    say_index: Optional[int] = None


class HeadingOp(_OpBase):
    op: Literal["heading"]
    id: str
    text: str
    level: int = 2


class TextOp(_OpBase):
    op: Literal["text"]
    id: str
    text: str


class BulletOp(_OpBase):
    op: Literal["bullet"]
    id: str
    items: List[str]


class FormulaOp(_OpBase):
    op: Literal["formula"]
    id: str
    latex: str
    caption: Optional[str] = None


class SvgPart(BaseModel):
    id: str
    label: str


class SvgOp(_OpBase):
    op: Literal["svg"]
    id: str
    svg: str
    description: str
    parts: List[SvgPart] = Field(default_factory=list)


class ImageOp(_OpBase):
    op: Literal["image"]
    id: str
    url: Optional[str] = None
    media_id: Optional[str] = None
    # When the compiler is allowed to generate images, an op may arrive with a
    # `generate` prompt instead of a url; the media stage fills the url in.
    generate: Optional[str] = None
    description: str
    caption: Optional[str] = None


class VideoOp(_OpBase):
    op: Literal["video"]
    id: str
    url: Optional[str] = None
    media_id: Optional[str] = None
    description: str
    start: Optional[float] = None
    end: Optional[float] = None
    muted: bool = True


class MediaTaskOp(_OpBase):
    op: Literal["media_task"]
    id: str
    kind: Literal["video", "pdf"]
    url: Optional[str] = None
    file_id: Optional[str] = None
    description: str


class TableOp(_OpBase):
    op: Literal["table"]
    id: str
    rows: List[List[str]]


class CalloutOp(_OpBase):
    op: Literal["callout"]
    id: str
    text: str
    kind: Literal["tip", "warning", "definition", "example"] = "tip"


class AnnotateOp(_OpBase):
    op: Literal["annotate"]
    id: str
    target: str
    text: str
    position: Literal["right", "below", "above", "left"] = "right"


class ArrowOp(_OpBase):
    op: Literal["arrow"]
    id: str
    from_: str = Field(alias="from")
    to: str
    text: Optional[str] = None

    model_config = {"populate_by_name": True}


class HighlightOp(_OpBase):
    op: Literal["highlight"]
    target: str
    style: Literal["pulse", "underline", "box"] = "pulse"


class UnhighlightOp(_OpBase):
    op: Literal["unhighlight"]
    target: str


class RevealOp(_OpBase):
    op: Literal["reveal"]
    target: str


class ClearOp(_OpBase):
    op: Literal["clear"]


BoardOp = Union[
    HeadingOp, TextOp, BulletOp, FormulaOp, SvgOp, ImageOp, VideoOp, MediaTaskOp,
    TableOp, CalloutOp, AnnotateOp, ArrowOp, HighlightOp, UnhighlightOp, RevealOp, ClearOp,
]

# Ops that put a new element on the board (and therefore carry an id).
ELEMENT_OPS = {
    "heading", "text", "bullet", "formula", "svg", "image", "video", "media_task",
    "table", "callout", "annotate", "arrow",
}
# Ops that only make sense during a live session; the compiler must not emit them.
LIVE_ONLY_OPS = {"highlight", "unhighlight", "reveal"}
VISUAL_OPS = {"svg", "image", "video", "media_task"}


# ── Plan ─────────────────────────────────────────────────────────────────────

class Misconception(BaseModel):
    pattern: str
    hint: str


class Check(BaseModel):
    type: Literal["open", "mcq", "numeric", "none"] = "open"
    prompt: Optional[str] = None
    options: List[str] = Field(default_factory=list)
    expected: Optional[str] = None
    rubric: Optional[str] = None
    misconceptions: List[Misconception] = Field(default_factory=list)
    pass_threshold: float = 0.7


class ConceptDraft(BaseModel):
    id: str
    title: str
    concept_tags: List[str] = Field(default_factory=list)
    prerequisites: List[str] = Field(default_factory=list)
    board_ops: List[BoardOp] = Field(default_factory=list)
    say: str
    say_i18n: Dict[str, str] = Field(default_factory=dict)
    teach_notes: Optional[str] = None
    check: Check = Field(default_factory=Check)


class TopicDraft(BaseModel):
    id: str
    title: str
    estimated_seconds: Optional[int] = None
    concepts: List[ConceptDraft]
    summary_ops: List[BoardOp] = Field(default_factory=list)


class KeyTerm(BaseModel):
    term: str
    meaning: str


class TeachingPlanDraft(BaseModel):
    """What the compile model returns (and what quiz / media-task compilers build)."""
    language: str = "en"
    objectives: List[str] = Field(default_factory=list)
    key_terms: List[KeyTerm] = Field(default_factory=list)
    topics: List[TopicDraft]


# ── Requests / responses ─────────────────────────────────────────────────────

class CompileKbGrounding(BaseModel):
    knowledge_base_id: str
    mode: Literal["STRICT", "BLENDED"] = "STRICT"


class CompileRequest(BaseModel):
    package_id: str
    slide_ids: List[str] = Field(default_factory=list)
    language: str = Field(default="en", description="Course language: 'en' or 'hi'")
    teacher_name: str = "Asha"
    # Recompile even when a READY plan matches the current content hash.
    force: bool = False
    # Let the compiler request AI-generated images (billed per image).
    generate_images: bool = False
    kb_grounding: Optional[CompileKbGrounding] = None
    # Stable across transport retries; keys idempotent charges.
    compile_run_id: Optional[str] = None


class SourceDescriptionRequest(BaseModel):
    description: str = Field(..., min_length=10, max_length=8000)


class PlanStatusItem(BaseModel):
    slide_id: str
    slide_title: Optional[str] = None
    source_type: Optional[str] = None
    chapter_id: Optional[str] = None
    chapter_name: Optional[str] = None
    plan_id: Optional[str] = None
    version: Optional[int] = None
    status: str
    error: Optional[str] = None
    topics: int = 0
    concepts: int = 0
    updated_at: Optional[str] = None


class PackagePlansResponse(BaseModel):
    package_id: str
    counts: Dict[str, int]
    slides: List[PlanStatusItem]


class ConceptView(BaseModel):
    id: str
    order: int
    title: str
    concept_tags: List[str]
    board_ops: List[Dict[str, Any]]
    board_html: str
    say: str
    say_i18n: Dict[str, str]
    teach_notes: Optional[str]
    check: Optional[Dict[str, Any]]


class TopicView(BaseModel):
    id: str
    order: int
    title: str
    estimated_seconds: Optional[int]
    summary_html: Optional[str]
    concepts: List[ConceptView]


class PlanView(BaseModel):
    plan_id: str
    slide_id: str
    version: int
    status: str
    language: str
    model: Optional[str]
    objectives: List[str]
    key_terms: List[Dict[str, str]]
    source_description: Optional[str]
    error: Optional[str]
    topics: List[TopicView]
    media: List[Dict[str, Any]]
