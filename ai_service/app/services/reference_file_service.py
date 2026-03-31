"""
Service for processing reference files (images/PDFs) for AI video generation.

Downloads files from S3, extracts text from PDFs, describes images via
Gemini Flash Lite, and produces a ReferenceContext used by the pipeline.
"""
from __future__ import annotations

import base64
import json
import logging
import mimetypes
import urllib.request
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Image extensions we accept as embeddable visuals
_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
_PDF_EXTENSIONS = {".pdf"}

# Gemini Flash Lite via OpenRouter for image description
_VISION_MODEL = "google/gemini-2.0-flash-lite-001"
_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


@dataclass
class EmbeddableImage:
    """An image that can be directly embedded in HTML frames."""
    s3_url: str
    description: str
    source_file: str  # original filename


@dataclass
class ReferenceContext:
    """Processed reference material ready for pipeline injection."""
    text_context: str = ""  # combined extracted text + descriptions (for script)
    embeddable_images: List[Dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ReferenceContext":
        return cls(
            text_context=data.get("text_context", ""),
            embeddable_images=data.get("embeddable_images", []),
        )


class ReferenceFileService:
    """Download, classify, and process reference files for video generation."""

    def __init__(self, openrouter_key: str, s3_service: Any = None):
        self._openrouter_key = openrouter_key
        self._s3_service = s3_service

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process(
        self,
        reference_files: List[Dict[str, str]],
        work_dir: Path,
    ) -> ReferenceContext:
        """
        Process a list of reference files and return a ReferenceContext.

        Args:
            reference_files: List of dicts with keys: url, name, type ('image'|'pdf')
            work_dir: Pipeline work directory to store downloaded files

        Returns:
            ReferenceContext with extracted text and embeddable image metadata
        """
        if not reference_files:
            return ReferenceContext()

        ref_dir = work_dir / "reference_files"
        ref_dir.mkdir(parents=True, exist_ok=True)

        text_parts: List[str] = []
        images: List[Dict[str, str]] = []

        for idx, ref in enumerate(reference_files):
            url = ref.get("url", "")
            name = ref.get("name", f"file_{idx}")
            file_type = ref.get("type", "").lower()

            if not url:
                logger.warning(f"[RefFileService] Skipping reference #{idx}: no URL")
                continue

            # Determine type from explicit field, fallback to extension
            if not file_type:
                ext = Path(name).suffix.lower()
                if ext in _IMAGE_EXTENSIONS:
                    file_type = "image"
                elif ext in _PDF_EXTENSIONS:
                    file_type = "pdf"
                else:
                    file_type = "image"  # default

            try:
                local_path = ref_dir / name
                if not self._download(url, local_path):
                    logger.warning(f"[RefFileService] Failed to download {name}")
                    continue

                if file_type == "pdf":
                    pdf_text, page_images = self._process_pdf(local_path, ref_dir)
                    if pdf_text:
                        text_parts.append(f"--- Content from {name} ---\n{pdf_text}")
                    # PDF page images are also embeddable
                    for pi in page_images:
                        desc = f"Page image from PDF: {name}"
                        images.append({
                            "s3_url": url,  # original PDF URL (page images are local-only)
                            "local_path": str(pi),
                            "description": desc,
                            "source_file": name,
                        })
                elif file_type == "image":
                    desc = self._describe_image(local_path, name)
                    text_parts.append(f"--- Image: {name} ---\n{desc}")
                    images.append({
                        "s3_url": url,
                        "description": desc,
                        "source_file": name,
                    })

            except Exception as e:
                logger.error(f"[RefFileService] Error processing {name}: {e}", exc_info=True)

        ctx = ReferenceContext(
            text_context="\n\n".join(text_parts),
            embeddable_images=images,
        )

        # Persist for resume capability
        ctx_path = work_dir / "reference_context.json"
        ctx_path.write_text(json.dumps(ctx.to_dict(), indent=2), encoding="utf-8")
        logger.info(
            f"[RefFileService] Processed {len(reference_files)} files → "
            f"{len(text_parts)} text sections, {len(images)} embeddable images"
        )
        return ctx

    @staticmethod
    def load_cached(work_dir: Path) -> Optional[ReferenceContext]:
        """Load previously processed reference context from work_dir."""
        ctx_path = work_dir / "reference_context.json"
        if ctx_path.exists():
            try:
                data = json.loads(ctx_path.read_text(encoding="utf-8"))
                return ReferenceContext.from_dict(data)
            except Exception:
                pass
        return None

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _download(self, url: str, local_path: Path) -> bool:
        """Download a file from a URL to a local path."""
        # Try S3 service first (handles private bucket URLs)
        if self._s3_service:
            try:
                if self._s3_service.download_file(url, local_path):
                    return True
            except Exception:
                pass

        # Fallback: direct HTTP download (works for public URLs)
        try:
            local_path.parent.mkdir(parents=True, exist_ok=True)
            req = urllib.request.Request(url, headers={"User-Agent": "VacademyAI/1.0"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                local_path.write_bytes(resp.read())
            return True
        except Exception as e:
            logger.error(f"[RefFileService] Download failed for {url}: {e}")
            return False

    _MAX_PDF_PAGES = 20  # Limit to avoid OOM on large PDFs

    def _process_pdf(self, pdf_path: Path, output_dir: Path):
        """Extract text and page images from a PDF using pdfplumber."""
        text_parts = []
        page_images = []

        try:
            import pdfplumber
        except ImportError:
            logger.error("[RefFileService] pdfplumber not installed — cannot process PDF")
            return "", []

        try:
            with pdfplumber.open(pdf_path) as pdf:
                total_pages = len(pdf.pages)
                pages_to_process = min(total_pages, self._MAX_PDF_PAGES)
                if total_pages > self._MAX_PDF_PAGES:
                    logger.warning(
                        f"[RefFileService] PDF {pdf_path.name} has {total_pages} pages, "
                        f"processing only first {self._MAX_PDF_PAGES}"
                    )

                for i in range(pages_to_process):
                    page = pdf.pages[i]
                    # Extract text
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(f"[Page {i + 1}]\n{page_text}")

                    # Render page as image
                    try:
                        page_img = page.to_image(resolution=150)
                        img_path = output_dir / f"{pdf_path.stem}_page_{i + 1}.png"
                        # pdfplumber's PageImage.save() expects a string path
                        page_img.save(str(img_path), format="PNG")
                        page_images.append(img_path)
                    except Exception as e:
                        logger.warning(f"[RefFileService] Could not render page {i + 1} as image: {e}")

        except Exception as e:
            logger.error(f"[RefFileService] pdfplumber error on {pdf_path.name}: {e}", exc_info=True)

        return "\n\n".join(text_parts), page_images

    def _describe_image(self, image_path: Path, filename: str) -> str:
        """Send an image to Gemini Flash Lite via OpenRouter for description."""
        if not self._openrouter_key:
            return f"[Image: {filename} — no API key for description]"

        try:
            image_bytes = image_path.read_bytes()
            mime = mimetypes.guess_type(filename)[0] or "image/png"
            b64 = base64.b64encode(image_bytes).decode("utf-8")
            data_url = f"data:{mime};base64,{b64}"

            payload = {
                "model": _VISION_MODEL,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": (
                                    "Describe this image in detail for use as reference material "
                                    "in educational video generation. Focus on: what the image shows, "
                                    "key data/labels/text visible, and how it could be used in a lesson."
                                ),
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": data_url},
                            },
                        ],
                    }
                ],
                "max_tokens": 1000,
                "temperature": 0.3,
            }

            headers = {
                "Authorization": f"Bearer {self._openrouter_key}",
                "Content-Type": "application/json",
            }
            req = urllib.request.Request(
                _OPENROUTER_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                description = result["choices"][0]["message"]["content"]
                logger.info(f"[RefFileService] Described {filename}: {description[:80]}...")
                return description

        except Exception as e:
            logger.error(f"[RefFileService] Image description failed for {filename}: {e}")
            return f"[Image: {filename} — description unavailable]"
