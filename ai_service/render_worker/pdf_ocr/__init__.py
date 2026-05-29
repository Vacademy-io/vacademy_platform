"""PDF copy-check OCR pipeline — produces a LayoutMap (line_id → box + text)
that the ai_service grader references when assigning verdicts to lines.

Mirrors the extractor/image_pipeline.py shape: download → preprocess → OCR →
return JSON. No S3 uploads here; ai_service fetches the original PDF on its
own when it needs page images for the LLM.
"""
from .pipeline import run_pdf_ocr_pipeline

__all__ = ["run_pdf_ocr_pipeline"]
