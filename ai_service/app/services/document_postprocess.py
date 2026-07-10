"""Post-processing for AI-generated DOCUMENT slide HTML.

Two concerns, both best-effort (any failure returns the input unchanged):

1. normalize_code_blocks — rewrites <pre><code> blocks into the canonical
   form the admin editor's code plugin round-trips losslessly:
   <pre data-code="<base64 utf-8>" data-language="x"><code class="language-x">escaped</code></pre>
   The base64 data-code attribute is what the FE deserializer prefers, so
   indentation/newlines survive any later HTML re-parsing (the historical
   "flattened code" bug).

2. illustrate_document — finds <img data-img-prompt="..."> placeholders the
   LLM emitted (same contract as the assessment/video pipelines), generates
   real images via the Gemini image LLM, uploads them to S3 and swaps the
   src. Failed/over-cap placeholders are stripped so no broken images reach
   the editor.
"""
from __future__ import annotations

import asyncio
import base64
import html as html_lib
import logging
import re
from typing import Optional, Tuple
from uuid import uuid4

from ..config import get_settings
from .image_service import ImageGenerationService
from .s3_service import S3Service

logger = logging.getLogger(__name__)

# Max AI illustrations generated per document slide (flat-rate credits apply per image).
MAX_DOC_IMAGES = 2
# Bound concurrent Gemini image calls across parallel document todos.
_IMAGE_SEMAPHORE = asyncio.Semaphore(4)
_IMAGE_TIMEOUT_SECONDS = 60.0
DOC_IMAGE_MODEL = "gemini-3.1-flash-image-preview"

# Same tag contract as automation_pipeline._process_generated_images.
_IMG_PROMPT_RE = re.compile(r'<img[^>]+data-img-prompt=(["\'])(.*?)\1[^>]*>', re.IGNORECASE)
_ALT_RE = re.compile(r'alt=(["\'])(.*?)\1', re.IGNORECASE)

_PRE_CODE_RE = re.compile(
    r'<pre([^>]*)>\s*<code([^>]*)>([\s\S]*?)</code>\s*</pre>', re.IGNORECASE
)
_LANG_CLASS_RE = re.compile(r'class=(["\'])[^"\']*language-([\w+#-]+)[^"\']*\1', re.IGNORECASE)
_LANG_ATTR_RE = re.compile(r'data-language=(["\'])([\w+#-]+)\1', re.IGNORECASE)
_WRAPPING_FENCE_RE = re.compile(r'^\s*```(?:html)?\s*\n([\s\S]*?)\n?```\s*$')
# Any leftover placeholder img (unmatched prompt attr, malformed tag, over-cap)
# must never reach the editor. [^>]* inside a character class matches newlines.
_PLACEHOLDER_IMG_RE = re.compile(r'<img[^>]*src=(["\'])placeholder\.png\1[^>]*>', re.IGNORECASE)


def strip_wrapping_fence(text: str) -> str:
    """Unwrap LLM output that arrives as one ```html fenced block despite the
    HTML-only instruction (a common Gemini slip). Only fires when the ENTIRE
    payload is a single fence."""
    if not text:
        return text
    match = _WRAPPING_FENCE_RE.match(text)
    return match.group(1) if match else text


def _escape_code(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def normalize_code_blocks(html: str) -> str:
    """Rewrite every <pre><code> block into the editor's lossless canonical form."""
    if not html or "<pre" not in html:
        return html

    def _rebuild(match: "re.Match[str]") -> str:
        pre_attrs, code_attrs, body = match.group(1), match.group(2), match.group(3)
        lang_match = (
            _LANG_CLASS_RE.search(code_attrs or "")
            or _LANG_CLASS_RE.search(pre_attrs or "")
            or _LANG_ATTR_RE.search(pre_attrs or "")
        )
        language = lang_match.group(2) if lang_match else None
        # The LLM may have escaped entities (or not); unescape to recover the
        # real code text, then re-escape uniformly.
        code_text = html_lib.unescape(body).strip("\n")
        encoded = base64.b64encode(code_text.encode("utf-8")).decode("ascii")
        lang_attr = f' data-language="{language}"' if language else ""
        code_class = f' class="language-{language}"' if language else ""
        return (
            f'<pre data-code="{encoded}"{lang_attr} style="white-space: pre;">'
            f"<code{code_class}>{_escape_code(code_text)}</code></pre>"
        )

    try:
        return _PRE_CODE_RE.sub(_rebuild, html)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Code-block normalization failed, keeping original HTML: %s", exc)
        return html


async def _generate_one_image(prompt: str) -> Optional[str]:
    settings = get_settings()
    try:
        async with _IMAGE_SEMAPHORE:
            svc = ImageGenerationService(gemini_api_key=settings.gemini_api_key)
            try:
                image_bytes, _usage = await asyncio.wait_for(
                    svc._call_image_generation_llm(prompt, 800, 450),
                    timeout=_IMAGE_TIMEOUT_SECONDS,
                )
            finally:
                try:
                    await svc._http_client.aclose()
                except Exception:  # noqa: BLE001
                    pass
        if not image_bytes:
            return None
        return await asyncio.to_thread(
            S3Service().upload_file_content,
            image_bytes,
            "illustration.jpg",
            f"ai-course-docs/{uuid4()}.jpg",
            "image/jpeg",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Document illustration failed for prompt %r: %s", prompt[:60], exc)
        return None


async def illustrate_document(html: str, slide_path: str = "") -> Tuple[str, int]:
    """Generate images for data-img-prompt placeholders.

    Returns (processed_html, generated_image_count). Placeholders past the
    MAX_DOC_IMAGES cap, or whose generation fails, are removed entirely —
    never leave a placeholder.png in the output.
    """
    if not html:
        return html, 0
    if "data-img-prompt" not in html:
        return _PLACEHOLDER_IMG_RE.sub("", html), 0

    settings = get_settings()
    matches = list(_IMG_PROMPT_RE.finditer(html))
    if not matches:
        return _PLACEHOLDER_IMG_RE.sub("", html), 0

    urls: list[Optional[str]] = [None] * len(matches)
    if settings.gemini_api_key:
        capped = matches[:MAX_DOC_IMAGES]
        if len(matches) > MAX_DOC_IMAGES:
            logger.info(
                "Document %s requested %d illustrations; capping at %d",
                slide_path, len(matches), MAX_DOC_IMAGES,
            )
        generated = await asyncio.gather(
            *[_generate_one_image(m.group(2)) for m in capped]
        )
        urls[: len(generated)] = list(generated)
    else:
        logger.info("GEMINI_API_KEY not configured; stripping document image placeholders")

    generated_count = 0
    # Replace from the end so match offsets stay valid.
    for match, url in reversed(list(zip(matches, urls))):
        if url:
            alt_match = _ALT_RE.search(match.group(0))
            alt = html_lib.escape(alt_match.group(2) if alt_match else "Illustration", quote=True)
            replacement = (
                f'<img src="{html_lib.escape(url, quote=True)}" alt="{alt}" '
                f'style="max-width:100%;border-radius:8px;margin:12px 0;">'
            )
            generated_count += 1
        else:
            replacement = ""
        html = html[: match.start()] + replacement + html[match.end():]

    # Final sweep: kill any placeholder img the prompt-attr regex couldn't
    # match (newlines in attributes, '>' in an attribute value, etc.).
    return _PLACEHOLDER_IMG_RE.sub("", html), generated_count


__all__ = [
    "normalize_code_blocks",
    "illustrate_document",
    "strip_wrapping_fence",
    "MAX_DOC_IMAGES",
    "DOC_IMAGE_MODEL",
]
