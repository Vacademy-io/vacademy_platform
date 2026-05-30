"""Question image generation — port of media_service
ExternalAIApiService.processAndGenerateImages + processContentForImage.

Scans the LLM question JSON for `<div class="image_to_generate">PROMPT: ...</div>`
markers in question/option content, generates each image (reusing ai_service's
Gemini image LLM), uploads to S3, and replaces the marker with an <img> tag.
Best-effort: any failure leaves the original content unchanged.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Dict, List, Optional

from ..config import get_settings
from .image_service import ImageGenerationService
from .s3_service import S3Service

logger = logging.getLogger(__name__)

# Matches media_service: <div class="image_to_generate">PROMPT: (.*?)</div>
_MARKER_RE = re.compile(r'<div class="image_to_generate">PROMPT: (.*?)</div>', re.DOTALL)
_IMG_TMPL = '<img src="{url}" style="width:100%; object-fit:contain;"/>'


def _collect_prompts(root: dict) -> List[str]:
    prompts: List[str] = []
    for q in root.get("questions") or []:
        for node in [q.get("question")] + list(q.get("options") or []):
            if isinstance(node, dict) and isinstance(node.get("content"), str):
                prompts.extend(_MARKER_RE.findall(node["content"]))
    return prompts


async def _generate_one(prompt: str) -> Optional[str]:
    settings = get_settings()
    try:
        svc = ImageGenerationService(gemini_api_key=settings.gemini_api_key)
        image_bytes, _usage = await svc._call_image_generation_llm(prompt, 800, 600)
        if not image_bytes:
            return None
        url = await asyncio.to_thread(
            S3Service().upload_file_content, image_bytes, "ai-question-image.jpg", None, "image/jpeg"
        )
        return url
    except Exception as exc:  # noqa: BLE001
        logger.warning("Question image generation failed for prompt %r: %s", prompt[:60], exc)
        return None


async def process_and_generate_images(json_str: str, generate_image: bool) -> str:
    """Replace image_to_generate markers with generated <img> tags. Returns the
    (possibly unchanged) JSON string."""
    if not generate_image or not json_str or "image_to_generate" not in json_str:
        return json_str
    try:
        root = json.loads(json_str)
    except Exception:  # noqa: BLE001
        return json_str

    prompts = list(dict.fromkeys(_collect_prompts(root)))  # unique, order-preserving
    if not prompts:
        return json_str

    urls = await asyncio.gather(*[_generate_one(p) for p in prompts])
    prompt_to_url: Dict[str, Optional[str]] = dict(zip(prompts, urls))

    def _replace(content: str) -> str:
        def _sub(m: "re.Match[str]") -> str:
            url = prompt_to_url.get(m.group(1))
            return _IMG_TMPL.format(url=url) if url else m.group(0)
        return _MARKER_RE.sub(_sub, content)

    for q in root.get("questions") or []:
        for node in [q.get("question")] + list(q.get("options") or []):
            if isinstance(node, dict) and isinstance(node.get("content"), str) and "image_to_generate" in node["content"]:
                node["content"] = _replace(node["content"])

    return json.dumps(root, ensure_ascii=False)
