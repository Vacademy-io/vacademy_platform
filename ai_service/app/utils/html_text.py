"""HTML cleanup for LLM prompts — Python analogue of media_service
HtmlJsonProcessor.removeTags.

The Java impl does NOT strip all markup: it uses Jsoup to remove only the noisy
media/math elements (mjx-container, img, svg) and returns the rest of the HTML
intact. (In media_service those removed nodes are swapped for DS_TAG:<uuid>
comments and later restored in the question-gen path; the metadata path does not
restore, so a plain removal is faithful there.) We replicate the
remove-media-noise-keep-markup behavior with regex — dependency-free.
"""
from __future__ import annotations

import re

_MJX_RE = re.compile(r"<mjx-container\b[^>]*>.*?</mjx-container>", re.IGNORECASE | re.DOTALL)
_SVG_RE = re.compile(r"<svg\b[^>]*>.*?</svg>", re.IGNORECASE | re.DOTALL)
_IMG_RE = re.compile(r"<img\b[^>]*?/?>", re.IGNORECASE)


def remove_media_tags(html: str) -> str:
    """Remove mjx-container / svg / img blocks; keep all other HTML intact.
    Mirrors the noise-reduction HtmlJsonProcessor.removeTags applies before
    sending question HTML to the LLM."""
    if not html:
        return ""
    out = _MJX_RE.sub("", html)
    out = _SVG_RE.sub("", out)
    out = _IMG_RE.sub("", out)
    return out.strip()
