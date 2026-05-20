"""
Router for Speech-to-Text transcription of class recordings.

Supports long recordings (1-2 hrs), English/Hindi/Hinglish,
multiple output formats (JSON, SRT, VTT, TXT).
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel, Field

from ..dependencies import get_institute_id_or_internal
from ..config import get_settings
from ..services.transcription_service import TranscriptionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transcription", tags=["transcription"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TranscribeRequest(BaseModel):
    source_url: str = Field(..., description="S3 or public URL to audio/video file (mp3, mp4, wav, webm, etc.)")
    language: Optional[str] = Field(
        None,
        description="Language hint: 'auto' (default), 'en', 'hi', 'hinglish', or ISO 639-1 code",
    )
    model_size: str = Field(
        default="base",
        description="Whisper model size: 'base' (fast, good for clear audio), "
                    "'small' (better for Hindi-English mix), 'medium' (best accuracy, slowest)",
    )
    word_timestamps: bool = Field(default=True, description="Include word-level timestamps in output")
    output_formats: Optional[list[str]] = Field(
        default=None,
        description="Output formats to generate: 'json', 'srt', 'vtt', 'txt'. Default: all",
    )
    task: str = Field(
        default="transcribe",
        description="'transcribe' (source language), 'translate' (English only), or 'both' "
                    "(produce both — single model load, two passes)",
    )
    callback_url: Optional[str] = Field(None, description="Webhook URL to POST on completion/failure")
    institute_id: Optional[str] = Field(
        None,
        description="Required only when calling with X-Internal-Service-Token "
                    "(server-to-server auth). For institute-key auth, this is ignored.",
    )


class TranscribeResponse(BaseModel):
    job_id: str
    status: str
    message: str = ""


class TranscribeStatusResponse(BaseModel):
    job_id: str
    status: str  # queued, running, completed, failed
    progress: Optional[float] = None
    output_urls: Optional[dict] = None             # legacy: matches task
    output_urls_source: Optional[dict] = None       # populated when task in ('transcribe', 'both')
    output_urls_english: Optional[dict] = None      # populated when task in ('translate', 'both')
    duration_seconds: Optional[float] = None
    detected_language: Optional[str] = None
    language_probability: Optional[float] = None
    segment_count: Optional[int] = None
    word_count: Optional[int] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_transcription_service() -> TranscriptionService:
    settings = get_settings()
    return TranscriptionService(
        render_server_url=settings.render_server_url,
        render_key=settings.render_server_key,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/v1/submit", response_model=TranscribeResponse)
async def submit_transcription(
    request: TranscribeRequest,
    auth: tuple = Depends(get_institute_id_or_internal),
):
    """Submit a recording for transcription.

    Accepts audio/video files up to 2 hours. Supported formats: mp3, mp4, wav,
    webm, ogg, m4a, flac, aac.

    For Hindi-English mixed recordings, use model_size='small' and
    language='hinglish' (or 'auto') for best results.

    Returns a job_id to poll for status via GET /transcription/v1/status/{job_id}.
    """
    resolved_institute_id, auth_mode = auth
    if auth_mode == "INTERNAL":
        # Server-to-server callers (e.g. admin_core_service) supply the
        # institute_id in the body since they have no per-institute API key.
        if not request.institute_id:
            raise HTTPException(
                status_code=400,
                detail="institute_id is required in request body when using X-Internal-Service-Token",
            )
        institute_id = request.institute_id
    else:
        institute_id = resolved_institute_id

    if request.model_size not in ("base", "small", "medium"):
        raise HTTPException(status_code=400, detail="model_size must be 'base', 'small', or 'medium'")

    if request.task not in ("transcribe", "translate", "both"):
        raise HTTPException(status_code=400, detail="task must be 'transcribe', 'translate', or 'both'")

    if request.output_formats:
        valid_formats = {"json", "srt", "vtt", "txt"}
        invalid = set(request.output_formats) - valid_formats
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid output formats: {invalid}. Valid: {valid_formats}")

    svc = _get_transcription_service()
    try:
        job_id = svc.submit(
            source_url=request.source_url,
            language=request.language,
            model_size=request.model_size,
            word_timestamps=request.word_timestamps,
            output_formats=request.output_formats,
            callback_url=request.callback_url,
            task=request.task,
        )
    except RuntimeError as e:
        error_msg = str(e)
        if "429" in error_msg or "capacity" in error_msg.lower():
            raise HTTPException(status_code=429, detail="Transcription server is busy, try again later")
        raise HTTPException(status_code=502, detail=f"Transcription service error: {error_msg}")

    logger.info(f"[{institute_id}] Transcription job submitted: {job_id} for {request.source_url}")
    return TranscribeResponse(job_id=job_id, status="queued", message="Transcription job submitted")


@router.get("/v1/status/{job_id}", response_model=TranscribeStatusResponse)
async def get_transcription_status(
    job_id: str,
    auth: tuple = Depends(get_institute_id_or_internal),
):
    """Poll transcription job status.

    Returns progress (0-100), and on completion: output URLs, detected language,
    duration, segment/word counts.
    """
    # job_ids are globally unique; auth presence (either mode) is sufficient.
    _resolved_institute_id, _auth_mode = auth
    svc = _get_transcription_service()
    resp = svc.check_status(job_id)

    if resp.get("status") == "unknown":
        raise HTTPException(status_code=502, detail="Could not reach transcription server")

    return TranscribeStatusResponse(
        job_id=job_id,
        status=resp.get("status", "unknown"),
        progress=resp.get("progress"),
        output_urls=resp.get("output_urls"),
        output_urls_source=resp.get("output_urls_source"),
        output_urls_english=resp.get("output_urls_english"),
        duration_seconds=resp.get("duration_seconds"),
        detected_language=resp.get("detected_language"),
        language_probability=resp.get("language_probability"),
        segment_count=resp.get("segment_count"),
        word_count=resp.get("word_count"),
        error=resp.get("error"),
    )
