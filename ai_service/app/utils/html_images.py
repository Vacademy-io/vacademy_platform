"""HTML body extraction + base64-image externalization.

Ports media_service HtmlParsingUtils.extractBody + HtmlImageConverter
.convertBase64ToUrls: pull the <body> inner HTML, and replace any inline
`data:image/...;base64,...` <img> sources with uploaded S3 URLs (so the HTML
stored/served carries URLs, not megabytes of base64). Uses BeautifulSoup
(already a dependency) + the shared S3Service.
"""
from __future__ import annotations

import base64
import logging
import re
from typing import Optional

from bs4 import BeautifulSoup

from ..services.s3_service import S3Service

logger = logging.getLogger(__name__)

_DATA_URI_RE = re.compile(r"^data:(image/[\w.+-]+);base64,(.*)$", re.DOTALL)
_EXT = {"image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg"}


def extract_body(html: Optional[str]) -> str:
    """Return the inner HTML of <body>, or the input unchanged if no body."""
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    if soup.body is not None:
        return soup.body.decode_contents()
    return html


def convert_base64_to_urls(html: Optional[str]) -> str:
    """Replace inline base64 <img> sources with uploaded S3 URLs. Best-effort:
    an upload failure leaves that image inline."""
    if not html or "data:image" not in html:
        return html or ""
    soup = BeautifulSoup(html, "html.parser")
    s3: Optional[S3Service] = None
    for img in soup.find_all("img"):
        src = img.get("src", "")
        m = _DATA_URI_RE.match(src or "")
        if not m:
            continue
        mime, b64 = m.group(1), m.group(2)
        try:
            data = base64.b64decode(b64)
        except Exception:  # noqa: BLE001
            continue
        try:
            s3 = s3 or S3Service()
            ext = _EXT.get(mime.lower(), "png")
            url = s3.upload_file_content(data, f"ai-doc-image.{ext}", None, mime)
            if url:
                img["src"] = url
        except Exception as exc:  # noqa: BLE001
            logger.warning("base64→S3 upload failed: %s", exc)
    return soup.decode_contents() if soup.body is None else soup.body.decode_contents()
