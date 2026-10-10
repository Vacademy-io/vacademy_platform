"""
Byte-level work for website_edit(import_image): what an imported file IS,
whether it is safe to host, and what we actually store.

Pure functions (no network, no S3) so they are testable on their own:

  * sniff_image_type   — the type from the bytes, not the sender's header
                         (Figma's asset links are served as octet-stream);
  * sanitize_svg_document — an SVG we will serve from our CDN must not carry
                         script, event handlers, foreignObject or external
                         references (opened directly, an SVG is a document);
  * prepare_image      — anything over the keep-as-is limit or wider than
                         2400 px is downscaled to WebP; a normal image is
                         stored exactly as sent (the behaviour before this).
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import io
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Optional, Tuple

#: Largest download / upload we read at all.
MAX_SOURCE_BYTES = 25_000_000
#: Images up to this size AND edge are stored byte-for-byte (the old 6 MB cap).
KEEP_ORIGINAL_MAX_BYTES = 6_000_000
#: Longest edge we store; bigger rasters are downscaled to WebP.
MAX_EDGE_PX = 2400
#: Decoded pixel budget (a 25 MB PNG can claim 50k x 50k; refuse before decoding).
MAX_PIXELS = 80_000_000
#: base64 input is meant for a local file or a design-tool export, not a bulk upload.
MAX_BASE64_BYTES = 10_000_000
#: SVGs are text; anything bigger than this is not an icon or illustration.
MAX_SVG_BYTES = 5_000_000
WEBP_QUALITY = 82

EXT_BY_TYPE = {
    "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg",
}


class ImageImportError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class PreparedImage:
    data: bytes
    content_type: str
    ext: str
    width: Optional[int]
    height: Optional[int]
    original_bytes: int
    sha256: str          # of the ORIGINAL bytes — the stable id of the source asset
    resized: bool


_SVG_HEAD_RE = re.compile(rb"^\s*(?:<\?xml[^>]*>\s*)?(?:<!--.*?-->\s*)*<svg[\s>]", re.S | re.I)


def sniff_image_type(raw: bytes) -> Optional[str]:
    head = raw[:16]
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if head[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    text_head = raw[:2048].lstrip(b"\xef\xbb\xbf")
    if _SVG_HEAD_RE.match(text_head) or (b"<svg" in text_head[:2048] and text_head.lstrip().startswith(b"<")):
        return "image/svg+xml"
    return None


def decode_base64_image(data: str) -> bytes:
    """`data` is raw base64 or a data: URL. Size-capped before decoding."""
    s = (data or "").strip()
    if s.startswith("data:"):
        _, _, s = s.partition(",")
    s = re.sub(r"\s+", "", s)
    if not s:
        raise ImageImportError("bad_request", "data_base64 is empty.")
    if len(s) * 3 // 4 > MAX_BASE64_BYTES:
        raise ImageImportError("too_large", f"base64 images are limited to {MAX_BASE64_BYTES // 1_000_000} MB.")
    try:
        return base64.b64decode(s, validate=True)
    except (binascii.Error, ValueError):
        raise ImageImportError("bad_request", "data_base64 is not valid base64.") from None


# ── SVG ─────────────────────────────────────────────────────────────────────
_SVG_NS = "http://www.w3.org/2000/svg"
_XLINK_NS = "http://www.w3.org/1999/xlink"
ET.register_namespace("", _SVG_NS)
ET.register_namespace("xlink", _XLINK_NS)

_DROP_ELEMENTS = {"script", "foreignobject", "iframe", "object", "embed", "handler", "listener", "audio", "video"}
_ANIMATION_ELEMENTS = {"set", "animate", "animatetransform", "animatemotion", "animatecolor"}
_SAFE_DATA_IMAGE_RE = re.compile(r"^data:image/(png|jpeg|jpg|gif|webp);base64,", re.I)
_CTRL_WS_RE = re.compile(r"[\x00-\x20]+")
_DANGEROUS_VALUE_RE = re.compile(r"(javascript:|vbscript:|data:text/html|expression\s*\()", re.I)
# url(...) that is not a same-document reference (#id).
_EXTERNAL_URL_RE = re.compile(r"url\s*\(\s*['\"]?\s*(?!#)", re.I)


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower() if isinstance(tag, str) else ""


def _href_ok(value: str) -> bool:
    v = _CTRL_WS_RE.sub("", value or "")
    return v.startswith("#") or bool(_SAFE_DATA_IMAGE_RE.match(v))


def sanitize_svg_document(raw: bytes) -> bytes:
    """A safe, standalone SVG document, or ImageImportError.

    Deny-by-construction for the dangerous parts and keep everything else, so
    Figma exports (gradients, masks, filters, embedded PNG patterns) survive:
    no DTD/entities at all (billion-laughs / XXE), no script / foreignObject /
    embedded documents, no on* handlers, no href that leaves the document
    (only #id or a data:image raster), no url(...) to anything external in
    attributes or <style>, no animation that rewrites an href."""
    if len(raw) > MAX_SVG_BYTES:
        raise ImageImportError("too_large", f"SVGs are limited to {MAX_SVG_BYTES // 1_000_000} MB.")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ImageImportError("not_an_image", "The SVG is not UTF-8 text.") from None
    if re.search(r"<!DOCTYPE|<!ENTITY", text, re.I):
        raise ImageImportError("not_an_image", "SVGs with a DOCTYPE or entities are not accepted.")
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        raise ImageImportError("not_an_image", "The SVG could not be parsed.") from None
    if _local(root.tag) != "svg":
        raise ImageImportError("not_an_image", "The file is not an SVG image.")

    def scrub(node: ET.Element) -> None:
        for child in list(node):
            name = _local(child.tag)
            if not name:  # comments / processing instructions
                node.remove(child)
                continue
            if name in _DROP_ELEMENTS:
                node.remove(child)
                continue
            if name in _ANIMATION_ELEMENTS:
                target = (child.get("attributeName") or "").lower()
                if "href" in target or name == "set" or _DANGEROUS_VALUE_RE.search(" ".join(child.attrib.values())):
                    node.remove(child)
                    continue
            if name == "style":
                css = child.text or ""
                if "@import" in css.lower() or _EXTERNAL_URL_RE.search(css) or _DANGEROUS_VALUE_RE.search(css):
                    node.remove(child)
                    continue
            scrub_attrs(child)
            scrub(child)

    def scrub_attrs(el: ET.Element) -> None:
        for attr in list(el.attrib):
            local = _local(attr)
            value = el.attrib[attr]
            if local.startswith("on"):
                del el.attrib[attr]
            elif local == "href" or attr.endswith("}href"):
                if not _href_ok(value):
                    del el.attrib[attr]
            elif _DANGEROUS_VALUE_RE.search(_CTRL_WS_RE.sub("", value)):
                del el.attrib[attr]
            elif _EXTERNAL_URL_RE.search(value):
                del el.attrib[attr]

    scrub_attrs(root)
    scrub(root)
    if root.tag == "svg":
        # No xmlns: a browser opening it as image/svg+xml would render nothing.
        root.set("xmlns", _SVG_NS)
    out = ET.tostring(root, encoding="utf-8", xml_declaration=False)
    return out


def _svg_size(svg: bytes) -> Tuple[Optional[int], Optional[int]]:
    try:
        root = ET.fromstring(svg)
    except ET.ParseError:
        return None, None

    def num(v: Optional[str]) -> Optional[int]:
        m = re.match(r"^\s*(\d+(?:\.\d+)?)\s*(px)?\s*$", v or "")
        return int(float(m.group(1))) if m else None

    w, h = num(root.get("width")), num(root.get("height"))
    if (w is None or h is None) and root.get("viewBox"):
        parts = re.split(r"[\s,]+", root.get("viewBox").strip())
        if len(parts) == 4:
            try:
                w, h = int(float(parts[2])), int(float(parts[3]))
            except ValueError:
                pass
    return w, h


# ── Raster ──────────────────────────────────────────────────────────────────
def prepare_image(raw: bytes, declared_type: str = "") -> PreparedImage:
    """Validate and (when needed) shrink one image. Raises ImageImportError."""
    if not raw:
        raise ImageImportError("not_an_image", "The file is empty.")
    if len(raw) > MAX_SOURCE_BYTES:
        raise ImageImportError("too_large", f"Images over {MAX_SOURCE_BYTES // 1_000_000} MB cannot be imported.")
    digest = hashlib.sha256(raw).hexdigest()
    ctype = sniff_image_type(raw)
    if ctype is None:
        shown = (declared_type or "unknown").split(";")[0].strip()
        raise ImageImportError("not_an_image", f"Unsupported content type '{shown}'.")

    if ctype == "image/svg+xml":
        clean = sanitize_svg_document(raw)
        w, h = _svg_size(clean)
        return PreparedImage(clean, ctype, "svg", w, h, len(raw), digest, resized=False)

    try:
        from PIL import Image, ImageOps
    except ImportError:  # pragma: no cover — Pillow ships with moviepy
        if len(raw) > KEEP_ORIGINAL_MAX_BYTES:
            raise ImageImportError("too_large", "Images over 6 MB cannot be imported.") from None
        return PreparedImage(raw, ctype, EXT_BY_TYPE[ctype], None, None, len(raw), digest, resized=False)

    try:
        img = Image.open(io.BytesIO(raw))
        width, height = img.size
    except Image.DecompressionBombError:
        raise ImageImportError("too_large", "The image has too many pixels to import.") from None
    except Exception:  # noqa: BLE001 — a header that lies about being an image
        raise ImageImportError("not_an_image", "The file could not be read as an image.") from None
    if width * height > MAX_PIXELS:
        raise ImageImportError("too_large", "The image has too many pixels to import.")

    needs_shrink = len(raw) > KEEP_ORIGINAL_MAX_BYTES or max(width, height) > MAX_EDGE_PX
    if not needs_shrink:
        try:
            img.verify()  # truncated / corrupt files fail here, before they reach a page
        except Exception:  # noqa: BLE001
            raise ImageImportError("not_an_image", "The image file is damaged.") from None
        return PreparedImage(raw, ctype, EXT_BY_TYPE[ctype], width, height, len(raw), digest, resized=False)

    if getattr(img, "is_animated", False):
        # Re-encoding would keep only the first frame; refuse rather than lose the animation.
        raise ImageImportError("too_large", "Animated images must be at most 6 MB and 2400 px.")
    try:
        img = ImageOps.exif_transpose(img)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if ("A" in img.mode or "transparency" in img.info) else "RGB")
        img.thumbnail((MAX_EDGE_PX, MAX_EDGE_PX), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=WEBP_QUALITY, method=4)
    except Exception:  # noqa: BLE001
        raise ImageImportError("not_an_image", "The image could not be converted.") from None
    out = buf.getvalue()
    return PreparedImage(out, "image/webp", "webp", img.size[0], img.size[1], len(raw), digest, resized=True)
