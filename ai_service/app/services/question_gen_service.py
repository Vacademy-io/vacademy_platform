"""Question generation (text + HTML) — migrated from media_service
ExternalAIApiService.getQuestionsWithDeepSeekFromHTML / ...FromTextPrompt.

Both flows produce the RAW LLM question JSON (DS_TAGs restored, images
generated). The endpoints/poll convert that raw JSON to AutoQuestionPaperResponse
via question_format (mirrors media_service, where result_json stores raw and
get-result converts on read).
"""
from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

from ..models.ai_token_usage import RequestType
from ..utils.html_tags import HtmlTagProtector
from . import ai_billing, llm_json, question_images
from .ai_prompts import question_gen as prompts

logger = logging.getLogger(__name__)

QUESTIONS_USE_CASE = "questions"
_DEFAULT_HTML_PROMPT = "Include first 20 questions in the response. Do not truncate or omit any questions."


def _bill(model_used: str, usage: dict, institute_id: Optional[str], user_id: Optional[str], feature: str) -> None:
    ai_billing.record_llm_billing(
        request_type=RequestType.PDF_QUESTIONS,
        model=model_used,
        prompt_tokens=usage.get("prompt_tokens", 0),
        completion_tokens=usage.get("completion_tokens", 0),
        total_tokens=usage.get("total_tokens", 0),
        institute_id=institute_id,
        user_id=user_id,
        metadata={"feature": feature},
    )


async def _run_html(
    *,
    protector: HtmlTagProtector,
    prompt: str,
    generate_image: bool,
    models: List[str],
    institute_id: Optional[str],
    user_id: Optional[str],
    feature: str,
) -> str:
    """Shared HTML→questions pipeline: LLM → restore DS_TAGs → generate images →
    bill. Returns the RAW LLM question JSON (get-result converts on read)."""
    sanitized, model_used, usage = await llm_json.generate_json(prompt, models, label=feature)
    restored = protector.restore_in_json(sanitized)
    with_images = await question_images.process_and_generate_images(restored, generate_image)
    await asyncio.to_thread(_bill, model_used, usage, institute_id, user_id, feature)
    return with_images


async def questions_from_html(
    *,
    html: str,
    user_prompt: Optional[str],
    generate_image: bool,
    models: List[str],
    institute_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> str:
    """HTML → questions. `models` is the pre-resolved [primary, *fallbacks]
    (resolved by the caller so background workers never touch the request DB)."""
    protector = HtmlTagProtector()
    untagged = protector.protect(html)
    prompt = prompts.build_html_prompt(untagged, user_prompt or _DEFAULT_HTML_PROMPT, generate_image)
    return await _run_html(
        protector=protector, prompt=prompt, generate_image=generate_image, models=models,
        institute_id=institute_id, user_id=user_id, feature="html_questions",
    )


async def questions_topic_wise(
    *, html: str, generate_image: bool, models: List[str],
    institute_id: Optional[str] = None, user_id: Optional[str] = None,
) -> str:
    """Topic-wise: extract questions + map them to topics (SORT_QUESTIONS_TOPIC_WISE)."""
    protector = HtmlTagProtector()
    untagged = protector.protect(html)
    prompt = prompts.build_topic_wise_prompt(untagged, generate_image)
    return await _run_html(
        protector=protector, prompt=prompt, generate_image=generate_image, models=models,
        institute_id=institute_id, user_id=user_id, feature="topic_wise_questions",
    )


async def questions_from_audio_transcript(
    *, transcript: str, num_questions: str, difficulty: str, language: str,
    optional_prompt: str, generate_image: bool, models: List[str],
    institute_id: Optional[str] = None, user_id: Optional[str] = None,
) -> str:
    """Transcript → questions (AUDIO_TO_QUESTIONS template). Transcript is plain
    text (no DS_TAGs), so no protect/restore — just LLM → images → bill."""
    prompt = prompts.build_audio_prompt(
        class_lecture=transcript, num_questions=num_questions, difficulty=difficulty,
        language=language, optional_prompt=optional_prompt, generate_image=generate_image,
    )
    sanitized, model_used, usage = await llm_json.generate_json(prompt, models, label="audio_questions")
    with_images = await question_images.process_and_generate_images(sanitized, generate_image)
    await asyncio.to_thread(_bill, model_used, usage, institute_id, user_id, "audio_questions")
    return with_images


async def questions_extract_topic(
    *, html: str, required_topics: str, generate_image: bool, models: List[str],
    institute_id: Optional[str] = None, user_id: Optional[str] = None,
) -> str:
    """Extract only questions matching the teacher's required topics."""
    protector = HtmlTagProtector()
    untagged = protector.protect(html)
    prompt = prompts.build_extract_topic_prompt(untagged, required_topics or "", generate_image)
    return await _run_html(
        protector=protector, prompt=prompt, generate_image=generate_image, models=models,
        institute_id=institute_id, user_id=user_id, feature="extract_topic_questions",
    )


async def questions_from_text(
    *,
    text: str,
    number_of_questions: Optional[str],
    type_of_question: Optional[str],
    class_level: Optional[str],
    topics: Optional[str],
    question_language: Optional[str],
    generate_image: bool,
    models: List[str],
    institute_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> str:
    """Single-pass text→questions. Returns RAW LLM question JSON (+ images).

    NOTE: media_service has a continuation/merge loop (is_process_completed) to
    accumulate questions across calls for very large inputs. We do a single pass
    (the common case); the prompt still asks for up to numberOfQuestions.
    """
    prompt = prompts.build_text_prompt(
        text_prompt=text,
        number_of_questions=str(number_of_questions or "10"),
        type_of_question=type_of_question or "MCQS",
        class_level=class_level or "",
        topics=topics or "",
        language=question_language or "english",
        existing_questions="",
        continuation_instruction="Start from beginning",
        generate_image=generate_image,
    )

    sanitized, model_used, usage = await llm_json.generate_json(prompt, models, label="text_questions")

    with_images = await question_images.process_and_generate_images(sanitized, generate_image)

    await asyncio.to_thread(_bill, model_used, usage, institute_id, user_id, "text_questions")
    return with_images
