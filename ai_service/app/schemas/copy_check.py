"""Pydantic DTOs for the copy-check pipeline. Shapes mirror what the Java
assessment_service sends in /trigger-evaluation and what we POST back via
the callbacks (progress / question / complete / failed)."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


# ----------------------------- Layout map shape ------------------------------
# Echoes what render_worker /pdf-ocr-jobs returns. We re-declare it here
# instead of importing from render_worker so ai_service stays decoupled.

class LayoutLine(BaseModel):
    line_id: str
    text: str
    box: list[int]                    # [x, y, w, h] in full_res px
    conf: float
    needs_math_fallback: bool = False


class LayoutRegion(BaseModel):
    region_id: str
    type: str
    box: list[int]


class LayoutPage(BaseModel):
    page_id: str
    page_index: int
    width: int
    height: int
    dpi: int
    lines: list[LayoutLine]
    regions: list[LayoutRegion] = []


class LayoutMap(BaseModel):
    pdf_url: str
    ocr_engine: str
    dpi: int
    duration_ms: int
    pages: list[LayoutPage]


# --------------------------- Grade request (in) -----------------------------

class GradeQuestionInput(BaseModel):
    question_id: str
    question_text: str
    question_type: str                # MCQ | ONE_WORD | LONG_ANSWER | CODING
    max_marks: float
    subject: Optional[str] = None     # used by criteria-gen prompt (#22)
    options: Optional[list[dict[str, Any]]] = None
    correct_answer: Optional[str] = None


class CopyCheckGradeRequest(BaseModel):
    process_id: str
    attempt_id: str
    assessment_id: str
    institute_id: Optional[str] = None
    pdf_url: str
    questions: list[GradeQuestionInput]
    preferred_model: Optional[str] = None
    callback_base_url: str = Field(..., description="Base URL Java exposes for /copy-check/callback/* callbacks")


class CopyCheckGradeResponse(BaseModel):
    job_id: str
    status: str = "PROCESSING"


# --------------------------- Annotation shape -------------------------------

class Annotation(BaseModel):
    target: str                       # line_id or region_id from LayoutMap
    style: str                        # tick | cross | circle | underline | margin_note | region_note
    page_id: str
    text: Optional[str] = None


# --------------------------- Per-question verdict ---------------------------

class CriteriaBreakdownItem(BaseModel):
    criteria_name: str
    marks: float
    reason: str


class QuestionVerdict(BaseModel):
    question_id: str
    marks_awarded: float
    max_marks: float
    extracted_answer: str
    feedback: str
    confidence: float = 0.0
    criteria_breakdown: list[CriteriaBreakdownItem] = []
    annotations: list[Annotation] = []
    status: str = "COMPLETED"          # COMPLETED | FAILED


# --------------------------- Callback payloads (out) ------------------------

class ProgressCallback(BaseModel):
    process_id: str
    job_id: str
    step: str                          # LAYOUT_OCR_DONE | GRADING | ...
    progress: Optional[float] = None
    layout_map_url: Optional[str] = None
    layout_map: Optional[LayoutMap] = None


class QuestionCallback(BaseModel):
    process_id: str
    job_id: str
    question_id: str
    marks_awarded: float
    max_marks: float
    feedback: str
    extracted_answer: str
    criteria_breakdown: list[CriteriaBreakdownItem] = []
    annotations: list[Annotation] = []
    confidence: float = 0.0
    rubric_version: Optional[int] = None


class CompleteCallback(BaseModel):
    process_id: str
    job_id: str
    total_marks_awarded: float
    total_max_marks: float
    questions_evaluated: int


class FailedCallback(BaseModel):
    process_id: str
    job_id: str
    error_message: str


# --------------------------- Rubric CRUD shapes -----------------------------

class CriteriaRubricItem(BaseModel):
    criteria_name: str
    max_marks: float
    keywords: list[str] = []
    evaluation_guidelines: str = ""


class CriteriaRubric(BaseModel):
    max_marks: float
    partial_marking_enabled: bool = True
    evaluation_instructions: str = ""
    rubric: list[CriteriaRubricItem] = []


class UpsertRubricRequest(BaseModel):
    assessment_id: str
    institute_id: str
    rubric: dict[str, CriteriaRubric]          # question_id -> rubric
    model_answers: Optional[dict[str, str]] = None
    created_by: Optional[str] = None


class RubricResponse(BaseModel):
    assessment_id: str
    institute_id: str
    rubric_version: int
    rubric: dict[str, CriteriaRubric]
    model_answers: dict[str, str] = {}
    updated_at: str


class UpsertQuestionAnswerRequest(BaseModel):
    model_answer: Optional[str] = None
    step_rubric: Optional[CriteriaRubric] = None
