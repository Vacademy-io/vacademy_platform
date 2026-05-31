"""Audio question generation — migrated from media_service
AudioQuestionGeneratorController + getQuestionsWithDeepSeekFromAudio.

Redesigned to one in-house step (like lecture feedback): resolve the audio
fileId → URL, transcribe in-house, then generate questions from the transcript.
Replaces the old two-step AssemblyAI flow (start-process-audio → audio-to-questions).
"""
from __future__ import annotations

import logging
from typing import List, Optional

from . import media_file_client, question_gen_service, transcription_inprocess

logger = logging.getLogger(__name__)


async def transcribe_and_generate(
    *,
    file_id: str,
    num_questions: str,
    difficulty: str,
    language: str,
    optional_prompt: str,
    generate_image: bool,
    models: List[str],
    institute_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> str:
    """fileId → URL → in-house transcript → AUDIO_TO_QUESTIONS. Returns RAW LLM
    question JSON (get-result converts on read). Runs in the background worker."""
    source_url = await media_file_client.get_file_url(file_id)
    tr = await transcription_inprocess.transcribe(source_url, language=None, model_size="small")
    if not tr.text:
        raise RuntimeError("Transcription produced no text")
    return await question_gen_service.questions_from_audio_transcript(
        transcript=tr.text,
        num_questions=num_questions,
        difficulty=difficulty,
        language=language,
        optional_prompt=optional_prompt,
        generate_image=generate_image,
        models=models,
        institute_id=institute_id,
        user_id=user_id,
    )
