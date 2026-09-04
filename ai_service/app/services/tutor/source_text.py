"""Text for video and PDF slides (design §4.2), so they compile like documents.

Where the words come from, cheapest first:
- HTML_VIDEO (AI video): the narration script the copilot wrote (S3, free).
- YouTube video: the caption track (youtube-transcript-api, free; fails when
  the video has no captions or YouTube blocks the datacenter IP).
- Uploaded video: Whisper on the render worker (`transcription` tool, per
  audio-minute) — the only paid path, run once per file and cached.
- PDF: PyMuPDF text layer (free; a scanned PDF has none — no OCR here).

Every result is cached in `file_conversion` under a tutor vendor key, so a
recompile never re-fetches or re-pays. Nothing here holds a DB session across
a network call.
"""
from __future__ import annotations

import asyncio
import logging
import math
from typing import Optional
from uuid import uuid4

import httpx
from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from ...db import db_session
from ...models.ai_token_usage import RequestType
from ...models.file_conversion import FileConversion
from ..ai_billing import record_tool_billing
from .slide_source import MAX_SOURCE_CHARS, SlideSource, _hash, source_kind_label

logger = logging.getLogger(__name__)

VENDOR_TRANSCRIPT = "tutor_video_transcript"
VENDOR_CAPTIONS = "tutor_youtube_captions"
VENDOR_SCRIPT = "tutor_ai_video_script"
VENDOR_PDF = "tutor_pdf_text"
TRANSCRIPTION_TOOL = "transcription"
TRANSCRIPTION_MODEL = "whisper-small"
MAX_PDF_BYTES = 40 * 1024 * 1024
MAX_CACHED_CHARS = 120_000

TEXT_KIND_BY_SOURCE_KIND = {"ai_video": "script", "youtube": "captions", "video_upload": "transcript", "pdf": "pdf"}


def expected_text_kind(src: SlideSource) -> Optional[str]:
    """What kind of text this slide can get (before fetching anything)."""
    return TEXT_KIND_BY_SOURCE_KIND.get(source_kind_label(src))


def hash_for(src: SlideSource, text_kind: Optional[str]) -> str:
    """The content hash a plan compiled from this text kind carries. A plan
    compiled from a description only keeps the old hash, so the first compile
    with real text counts as a change."""
    if src.kind == "video":
        return _hash("video", src.title, src.media_file_id or src.media_url, text_kind) if text_kind else src.content_hash
    if src.kind == "pdf":
        return _hash("pdf", src.title, src.media_file_id, text_kind) if text_kind else src.content_hash
    return src.content_hash


def _set_text(src: SlideSource, text_: str, kind: str) -> None:
    src.text = (text_ or "").strip()[:MAX_SOURCE_CHARS]
    src.text_kind = kind
    src.content_hash = hash_for(src, kind)


# ── cache ────────────────────────────────────────────────────────────────────

def cached_text(db: Session, vendor: str, key: str) -> Optional[str]:
    row = (db.query(FileConversion)
           .filter(FileConversion.vendor == vendor, FileConversion.vendor_file_id == key,
                   FileConversion.status == "SUCCESS", FileConversion.html_text.isnot(None))
           .order_by(FileConversion.created_at.desc()).first())
    return row.html_text if row is not None else None


def store_text(db: Session, vendor: str, key: str, text_: str, *, file_id: Optional[str] = None, file_type: str = "text") -> None:
    db.add(FileConversion(id=str(uuid4()), vendor_file_id=key, vendor=vendor, file_id=file_id, status="SUCCESS",
                          html_text=(text_ or "")[:MAX_CACHED_CHARS], file_type=file_type))
    db.commit()


def transcript_cached(db: Session, file_id: str) -> bool:
    return cached_text(db, VENDOR_TRANSCRIPT, file_id) is not None


def _cached(vendor: str, key: str) -> Optional[str]:
    with db_session() as db:
        return cached_text(db, vendor, key)


def _store(vendor: str, key: str, text_: str, file_id: Optional[str] = None, file_type: str = "text") -> None:
    try:
        with db_session() as db:
            store_text(db, vendor, key, text_, file_id=file_id, file_type=file_type)
    except Exception:  # noqa: BLE001
        logger.warning("source_text cache write failed for %s:%s", vendor, key, exc_info=True)


# ── free sources ─────────────────────────────────────────────────────────────

async def _download(url: str, *, max_bytes: int, timeout: float = 120.0) -> Optional[bytes]:
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        async with client.stream("GET", url) as resp:
            resp.raise_for_status()
            buf = bytearray()
            async for chunk in resp.aiter_bytes():
                buf.extend(chunk)
                if len(buf) > max_bytes:
                    return None
            return bytes(buf)


async def _file_url(file_id: str) -> Optional[str]:
    from ..media_file_client import get_file_url, get_public_file_url
    for resolver in (get_public_file_url, get_file_url):
        try:
            url = await resolver(file_id)
            if url:
                return url
        except Exception as exc:  # noqa: BLE001
            logger.debug("source_text: %s could not resolve %s: %s", resolver.__name__, file_id, exc)
    return None


async def _ai_video_script(video_id: str) -> Optional[str]:
    cached = _cached(VENDOR_SCRIPT, video_id)
    if cached:
        return cached
    with db_session() as db:
        row = db.execute(sql_text("SELECT s3_urls->>'script', file_ids->>'script' FROM ai_gen_video WHERE video_id = :v"),
                         {"v": video_id}).first()
    if not row:
        return None
    url = row[0] or (await _file_url(row[1]) if row[1] else None)
    if not url:
        return None
    data = await _download(url, max_bytes=2 * 1024 * 1024, timeout=60.0)
    script = (data or b"").decode("utf-8", errors="replace").strip()
    if script:
        _store(VENDOR_SCRIPT, video_id, script, file_type="script")
    return script or None


async def _youtube_captions(url: str) -> Optional[str]:
    from ..kb.parsing import parse_youtube, youtube_video_id
    vid = youtube_video_id(url)
    if not vid:
        return None
    cached = _cached(VENDOR_CAPTIONS, vid)
    if cached:
        return cached
    doc = await parse_youtube(url)          # raises ValueError when there are no captions
    body = "\n\n".join((p.text or "").strip() for p in doc.pages if (p.text or "").strip())
    if body:
        _store(VENDOR_CAPTIONS, vid, body, file_type="captions")
    return body or None


async def _pdf_text(file_id: str) -> Optional[str]:
    cached = _cached(VENDOR_PDF, file_id)
    if cached:
        return cached
    from ..kb import parsing
    url = await _file_url(file_id)
    if not url:
        return None
    data = await _download(url, max_bytes=MAX_PDF_BYTES)
    if not data:
        return None
    # extract_figures=False and OCR payloads ignored: zero paid OCR.
    extracted = await asyncio.to_thread(parsing._extract_sync, data, False)
    body = "\n\n".join((p.text or "").strip() for p in extracted.pages if (p.text or "").strip())
    if body:
        _store(VENDOR_PDF, file_id, body, file_id=file_id, file_type="pdf")
    return body or None


async def resolve_free_text(src: SlideSource) -> None:
    """Fill `src.text` from every source that costs nothing (script, captions,
    a cached transcript, the PDF text layer). Sets `src.text_note` when a
    source was tried and had nothing."""
    kind = source_kind_label(src)
    try:
        if kind == "ai_video" and src.ai_gen_video_id:
            script = await _ai_video_script(src.ai_gen_video_id)
            if script:
                _set_text(src, script, "script"); return
            src.text_note = "The AI video's script could not be read"
        elif kind == "youtube" and src.media_url:
            try:
                captions = await _youtube_captions(src.media_url)
            except ValueError as exc:
                captions = None
                src.text_note = str(exc)[:200]
            if captions:
                _set_text(src, captions, "captions"); return
            src.text_note = src.text_note or "This video has no captions"
        elif kind == "video_upload" and src.media_file_id:
            cached = _cached(VENDOR_TRANSCRIPT, src.media_file_id)
            if cached:
                _set_text(src, cached, "transcript"); return
        elif kind == "pdf" and src.media_file_id:
            body = await _pdf_text(src.media_file_id)
            if body:
                _set_text(src, body, "pdf"); return
            src.text_note = "This PDF has no text layer (scanned pages)"
    except Exception as exc:  # noqa: BLE001
        logger.warning("source_text: free text failed for slide %s (%s): %s", src.slide_id, kind, exc, exc_info=True)
        src.text_note = f"Could not read the {kind.replace('_', ' ')}: {str(exc)[:120]}"


# ── the paid source: Whisper for uploaded videos ─────────────────────────────

def transcription_minutes(video_length_ms: Optional[int], duration_seconds: Optional[float] = None) -> int:
    secs = float(duration_seconds) if duration_seconds else (float(video_length_ms or 0) / 1000.0)
    return int(math.ceil(secs / 60.0)) if secs > 0 else 0


async def transcribe_upload(src: SlideSource, *, institute_id: str, user_id: Optional[str], request_id: Optional[str]) -> int:
    """Transcribe an uploaded video once (cached by file id) and charge the
    `transcription` tool per audio-minute. Returns the minutes billed (0 on a
    cache hit). Raises RuntimeError when the worker cannot do it."""
    from ..transcription_inprocess import transcribe
    file_id = src.media_file_id or ""
    cached = _cached(VENDOR_TRANSCRIPT, file_id)
    if cached:
        _set_text(src, cached, "transcript")
        return 0
    url = await _file_url(file_id)
    if not url:
        raise RuntimeError("The video file could not be resolved for transcription")
    result = await transcribe(url, model_size="small")
    body = (result.text or "").strip()
    if not body:
        raise RuntimeError("The video has no speech to transcribe")
    _store(VENDOR_TRANSCRIPT, file_id, body, file_id=file_id, file_type="transcript")
    minutes = max(1, transcription_minutes(src.video_length_ms, result.duration_seconds))
    record_tool_billing(
        tool_key=TRANSCRIPTION_TOOL, tool_params={"audio_minutes": minutes}, request_type=RequestType.TRANSCRIPTION,
        model=TRANSCRIPTION_MODEL, institute_id=institute_id, user_id=user_id, user_role="ADMIN",
        request_id=request_id, idempotency_key=f"tutor_transcribe:{file_id}",
    )
    _set_text(src, body, "transcript")
    return minutes


def transcription_available() -> bool:
    from ...config import get_settings
    try:
        return bool(get_settings().render_server_url)
    except Exception:  # noqa: BLE001
        return False
