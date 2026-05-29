"""Copy-check pipeline — orchestrates render_worker layout OCR, rubric
resolution, LLM grading, selective Mathpix fallback, and webhook callbacks
into Java assessment_service. Java owns the persistent process state; this
module owns the AI portion only."""
from .orchestrator import grade_copy

__all__ = ["grade_copy"]
