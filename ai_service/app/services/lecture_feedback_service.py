"""Lecture feedback — migrated from media_service (AiLectureController
generate-feedback + DeepSeekAsyncTaskService.pollAndProcessAudioFeedback +
DeepSeekLectureService.generateLectureFeedback).

Redesigned to a single in-house step: resolve the audio fileId → URL, transcribe
with the in-house transcriber, then run the feedback prompt. Replaces the old
two-step AssemblyAI flow (start-process-audio → generate-feedback).
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import List, Optional

from ..models.ai_token_usage import RequestType
from . import ai_billing, llm_json, media_file_client, transcription_inprocess
from .ai_prompts import lecture_feedback as prompts

logger = logging.getLogger(__name__)

# Keys from the transcription status worth handing to the LLM as "spoken text
# quality" (exclude the S3 output_urls — not useful to the model).
_QUALITY_KEYS = (
    "duration_seconds", "detected_language", "language_probability",
    "segment_count", "word_count",
)


def _words_per_minute(word_count: Optional[int], duration_seconds: Optional[float]) -> str:
    if word_count and duration_seconds and duration_seconds > 0:
        return str(round(word_count / (duration_seconds / 60.0)))
    return "unknown"


async def generate_feedback_result(
    *,
    file_id: str,
    primary_model: str,
    fallback_models: List[str],
    institute_id: Optional[str],
    user_id: Optional[str],
    language: Optional[str] = None,
) -> str:
    """Full feedback pipeline; returns the sanitized LectureFeedbackDto JSON
    string to persist as the task result. Runs in the background worker."""
    # 1. media fileId → presigned URL
    source_url = await media_file_client.get_file_url(file_id)

    # 2. in-house transcription
    tr = await transcription_inprocess.transcribe(source_url, language=language, model_size="small")
    if not tr.text:
        raise RuntimeError("Transcription produced no text")

    # 3. build the feedback prompt (text + quality metadata + pace)
    quality = {k: tr.status.get(k) for k in _QUALITY_KEYS}
    prompt = prompts.build_prompt(
        text=tr.text,
        converted_audio_response_string=json.dumps(quality),
        audio_pace=_words_per_minute(tr.word_count, tr.duration_seconds),
    )

    # 4. LLM
    sanitized, model_used, usage = await llm_json.generate_json(
        prompt, [primary_model, *fallback_models], label="lecture_feedback"
    )

    # 5. bill (lecture use case)
    await asyncio.to_thread(
        ai_billing.record_llm_billing,
        request_type=RequestType.LECTURE,
        model=model_used,
        prompt_tokens=usage.get("prompt_tokens", 0),
        completion_tokens=usage.get("completion_tokens", 0),
        total_tokens=usage.get("total_tokens", 0),
        institute_id=institute_id,
        user_id=user_id,
        metadata={"feature": "lecture_feedback", "file_id": file_id},
    )
    return sanitized
