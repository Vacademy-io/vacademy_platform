"""LLM grading wrapper.

Wraps ChatLLMClient (OpenRouter primary, Gemini fallback). Adds:
  - JSON-only response_format hint to the system prompt
  - Per-copy token guard (logs warn at 20k, raises at 50k)
  - Strong-model escalation when verdict confidence < ESCALATION_CONF_THRESHOLD

Note: OpenRouter does not currently support transparent prompt caching for
arbitrary models — Anthropic's cache_control markers and Gemini's cached_content
both require provider-specific request shaping. Implementing that lives in a
future PR; for now the rubric block is resent in full on every grading call.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from ..chat_llm_client import ChatLLMClient
from .prompt_builder import GRADING_SYSTEM, build_grading_prompt

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "google/gemini-2.5-flash-lite"
ESCALATION_MODEL = "google/gemini-2.5-flash"
ESCALATION_CONF_THRESHOLD = 0.60
MAX_ESCALATIONS_PER_COPY = 2
# Budget tuned for typical 8-question copies. Each grading call re-sends the
# full OCR transcript + rubric + system prompt (~8.5k tokens), so 8 questions
# burn ~70k tokens just on grading; criteria-generation and escalations add
# more. Cap at 250k so we never zero out late questions due to a per-copy
# limit. Per-call provider limits still apply independently.
WARN_TOKENS_PER_COPY = 80_000
FAIL_TOKENS_PER_COPY = 250_000


def _strip_code_fence(text: str) -> str:
    """LLMs sometimes return ```json ... ``` despite response_format hints."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(json)?\s*\n", "", text, count=1)
        text = re.sub(r"\n?```\s*$", "", text, count=1)
    return text.strip()


def _parse_json_or_retry_payload(content: str) -> dict[str, Any]:
    cleaned = _strip_code_fence(content)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Last-ditch: find the first { and the last } and try to parse that span.
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end > start:
            return json.loads(cleaned[start : end + 1])
        raise


class CopyCheckGrader:
    def __init__(
        self,
        llm: ChatLLMClient,
        institute_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ):
        self.llm = llm
        self.institute_id = institute_id
        self.user_id = user_id
        self._tokens_used = 0
        self._prompt_tokens = 0
        self._completion_tokens = 0
        self._escalations_used = 0

    def add_tokens(self, n: int) -> None:
        """External counter for non-grading calls (e.g. criteria generation
        in rubric.RubricResolver) so the per-copy budget covers every LLM call,
        not just the grading ones."""
        self._tokens_used += max(0, int(n or 0))
        if self._tokens_used > WARN_TOKENS_PER_COPY:
            logger.warning(
                "copy-check token usage high: %d (warn threshold %d)",
                self._tokens_used, WARN_TOKENS_PER_COPY,
            )

    def add_usage(self, usage: dict[str, Any]) -> None:
        """Same accounting as add_tokens, but also splits prompt/completion
        for credit deduction (calculate_credits prices input/output tokens
        differently). Falls back to counting an unsplit total entirely as
        prompt tokens when the provider doesn't report the split — grading
        calls are dominated by the resent OCR+rubric context anyway, so this
        is a conservative under-charge rather than an over-charge."""
        usage = usage or {}
        prompt = usage.get("prompt_tokens")
        completion = usage.get("completion_tokens")
        if prompt is not None or completion is not None:
            self._prompt_tokens += max(0, int(prompt or 0))
            self._completion_tokens += max(0, int(completion or 0))
            self.add_tokens(int(prompt or 0) + int(completion or 0))
        else:
            total = usage.get("total_tokens") or usage.get("totalTokenCount") or 0
            self._prompt_tokens += max(0, int(total or 0))
            self.add_tokens(int(total or 0))

    @property
    def tokens_used(self) -> int:
        return self._tokens_used

    @property
    def prompt_tokens_used(self) -> int:
        return self._prompt_tokens

    @property
    def completion_tokens_used(self) -> int:
        return self._completion_tokens

    async def grade_question(
        self,
        question: dict[str, Any],
        rubric: dict[str, Any],
        layout_map: dict[str, Any],
        preferred_model: Optional[str] = None,
    ) -> dict[str, Any]:
        model = preferred_model or DEFAULT_MODEL
        verdict = await self._call(question, rubric, layout_map, model)
        if (
            float(verdict.get("confidence", 0)) < ESCALATION_CONF_THRESHOLD
            and self._escalations_used < MAX_ESCALATIONS_PER_COPY
        ):
            self._escalations_used += 1
            logger.info(
                "Escalating Q%s to %s (conf=%.2f)",
                question["question_id"], ESCALATION_MODEL, verdict.get("confidence", 0),
            )
            try:
                verdict = await self._call(question, rubric, layout_map, ESCALATION_MODEL)
            except Exception as e:
                logger.warning(f"Escalation failed, keeping initial verdict: {e}")
        return verdict

    async def _call(
        self,
        question: dict[str, Any],
        rubric: dict[str, Any],
        layout_map: dict[str, Any],
        model: str,
    ) -> dict[str, Any]:
        if self._tokens_used >= FAIL_TOKENS_PER_COPY:
            raise RuntimeError(
                f"copy-check token budget exhausted: {self._tokens_used} >= {FAIL_TOKENS_PER_COPY}"
            )
        prompt = build_grading_prompt(question, rubric, layout_map)
        messages = [
            {"role": "system", "content": GRADING_SYSTEM},
            {"role": "user", "content": prompt},
        ]
        try:
            response = await self.llm.chat_completion(
                messages=messages,
                temperature=0.1,
                max_tokens=2000,
                institute_id=self.institute_id,
                user_id=self.user_id,
                model=model,
            )
        except Exception:
            logger.exception("Grading LLM call failed")
            raise

        # Token bookkeeping (best-effort — providers report usage differently).
        self.add_usage(response.get("usage"))

        content = response.get("content") or ""
        try:
            return _parse_json_or_retry_payload(content)
        except Exception:
            logger.warning("LLM returned unparseable JSON; re-prompting once")
            retry_messages = messages + [
                {"role": "assistant", "content": content},
                {
                    "role": "user",
                    "content": "Your previous reply was not valid JSON. Return ONLY the JSON object, no prose, no code fences.",
                },
            ]
            retry = await self.llm.chat_completion(
                messages=retry_messages,
                temperature=0.0,
                max_tokens=2000,
                institute_id=self.institute_id,
                user_id=self.user_id,
                # Must pin the same model: this retry's output IS the grade that
                # gets returned. Omitting model= silently downgraded the actual
                # grade to ChatLLMClient's free default even when the teacher
                # explicitly picked a premium model.
                model=model,
            )
            return _parse_json_or_retry_payload(retry.get("content") or "")


async def call_llm_for_criteria(
    llm: ChatLLMClient,
    system: str,
    user: str,
    preferred_model: Optional[str] = None,
    institute_id: Optional[str] = None,
    token_sink: Optional["CopyCheckGrader"] = None,
) -> dict[str, Any]:
    """Used by rubric.RubricResolver for the LLM-derived branch.

    `token_sink`: if supplied, the response's usage is counted against the
    grader's per-copy budget so criteria-generation calls share the same
    cap as grading calls.
    """
    response = await llm.chat_completion(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.2,
        max_tokens=1200,
        institute_id=institute_id,
        model=preferred_model,
    )
    if token_sink is not None:
        token_sink.add_usage(response.get("usage"))
    return _parse_json_or_retry_payload(response.get("content") or "")
