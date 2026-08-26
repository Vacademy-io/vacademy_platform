"""Question-formatting engine — port of media_service
ExternalAIApiService.formatQuestions + the 4 type handlers + ResponseConverter.

Turns the LLM question JSON (shape: question_number, question{type,content},
options[{type,preview_id,content}], correct_options, ans, exp, question_type,
tags, level) into AutoQuestionPaperResponse (QuestionDTO with rich-text wrappers
and the `auto_evaluation_json` string the FE assessment builder parses).

This is the shared engine for ALL question-generation features (text, html,
pdf, image, audio).
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from ..schemas.question_paper import AutoQuestionPaperResponse
from ..utils.json_extract import extract_and_sanitize_json

logger = logging.getLogger(__name__)

_ESCAPES = {'"': '"', "\\": "\\", "n": "\n", "t": "\t", "r": "\r", "/": "/", "'": "'"}


def unescape(s: Optional[str]) -> Optional[str]:
    """Port of ExternalAIApiService.unescapeString — collapse surviving
    backslash escapes (\\", \\\\, \\n, \\t, \\r, \\/) char-by-char."""
    if s is None:
        return None
    out: List[str] = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == "\\" and i + 1 < n and s[i + 1] in _ESCAPES:
            out.append(_ESCAPES[s[i + 1]])
            i += 2
        else:
            out.append(c)
            i += 1
    return "".join(out)


def _rich(content: Optional[str], rtype: str = "HTML") -> Dict[str, Any]:
    """AssessmentRichTextDataDTO(id=null, type=HTML, content)."""
    return {"id": None, "type": rtype, "content": content}


def _eval_json(obj: Dict[str, Any]) -> str:
    """Serialize the evaluation DTO compactly (matches Jackson: no spaces)."""
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)


def _canonical_level(level: Optional[str]) -> Optional[str]:
    if not level:
        return None
    v = level.strip().lower()
    return {"easy": "EASY", "medium": "MEDIUM", "hard": "HARD"}.get(v)


def _metadata(q: Dict[str, Any]) -> Dict[str, Any]:
    """Tags + difficulty, under BOTH spellings.

    `tags` / `level` are what the KB review board and the AI-center preview read.
    `ai_tags` / `ai_difficulty_level` are what Java's QuestionDTO actually binds —
    it declares `aiTags` and `aiDifficultyLevel` under a SnakeCaseStrategy and is
    @JsonIgnoreProperties(ignoreUnknown=true), so the `tags`/`level` keys alone were
    silently dropped on save and every AI-generated tag and difficulty was lost.

    Emitting both keeps the existing readers working and starts persisting the data.
    """
    tags = q.get("tags")
    level = _canonical_level(q.get("level"))
    meta: Dict[str, Any] = {"tags": tags, "level": level}
    if tags:
        meta["ai_tags"] = tags
    if level:
        meta["ai_difficulty_level"] = level
    return meta


def _numeric_answers(q: Dict[str, Any]) -> List[float]:
    """Every accepted numeric answer, from an explicit list or parsed out of `ans`."""
    raw = q.get("valid_answers")
    if not isinstance(raw, list) or not raw:
        raw = [q.get("ans")]
    answers: List[float] = []
    for candidate in raw:
        if candidate is None:
            continue
        if isinstance(candidate, (int, float)) and not isinstance(candidate, bool):
            value = float(candidate)
            if value not in answers:
                answers.append(value)
            continue
        # A generator writing prose ("42.5 m/s", "3 or 4") still carries the number.
        for token in re.findall(r"-?\d+(?:\.\d+)?", str(candidate)):
            value = float(token)
            if value not in answers:
                answers.append(value)
    return answers


def normalize_correct_option_ids(raw: Optional[List[str]], preview_ids: List[str]) -> List[str]:
    """Port of normalizeCorrectOptionIds: map A/B/C, 1-based index, or literal
    preview-id markers to the actual option preview_ids; dedup; drop unknowns."""
    if not raw or not preview_ids:
        return []
    normalized: List[str] = []
    for marker in raw:
        if marker is None:
            continue
        trimmed = marker.strip()
        if not trimmed:
            continue
        candidate: Optional[str] = None
        if len(trimmed) == 1:
            ch = trimmed[0]
            if "A" <= ch <= "Z":
                idx = ord(ch) - ord("A")
                if idx < len(preview_ids):
                    candidate = preview_ids[idx]
            elif "a" <= ch <= "z":
                idx = ord(ch) - ord("a")
                if idx < len(preview_ids):
                    candidate = preview_ids[idx]
        if candidate is None and trimmed in preview_ids:
            candidate = trimmed
        if candidate is None:
            try:
                parsed = int(trimmed)
                if 1 <= parsed <= len(preview_ids):
                    candidate = preview_ids[parsed - 1]
            except ValueError:
                pass
        if candidate is not None and candidate not in normalized:
            normalized.append(candidate)
    return normalized


def _build_options(q: Dict[str, Any]) -> tuple[List[Dict[str, Any]], List[str]]:
    options_out: List[Dict[str, Any]] = []
    preview_ids: List[str] = []
    for i, opt in enumerate(q.get("options") or []):
        if not opt or opt.get("content") is None:
            continue
        pid = opt.get("preview_id") or str(i + 1)
        preview_ids.append(pid)
        options_out.append({"preview_id": pid, "text": _rich(unescape(opt.get("content")))})
    return options_out, preview_ids


def _handle_mcq(q: Dict[str, Any], qtype: str) -> Dict[str, Any]:
    options_out, preview_ids = _build_options(q)
    correct = normalize_correct_option_ids(q.get("correct_options"), preview_ids)
    dto: Dict[str, Any] = {
        "access_level": "PUBLIC",
        "question_response_type": "OPTION",
        "question_type": qtype,
        "explanation_text": _rich(q.get("exp")),
        "text": _rich(q.get("question", {}).get("content")),
        "options": options_out,
        # Both spellings. Java's MCQEvaluationDTO.MCQData binds `correctOptionIds`
        # (the nested class does not inherit the outer SnakeCaseStrategy); the AI-center
        # preview reader reads `correct_option_ids`.
        "auto_evaluation_json": _eval_json(
            {"type": qtype, "data": {"correct_option_ids": correct, "correctOptionIds": correct}}
        ),
    }
    dto.update(_metadata(q))
    return dto


def _handle_true_false(q: Dict[str, Any]) -> Dict[str, Any]:
    """TRUE_FALSE is an MCQS with two fixed options as far as storage is concerned.

    Java routes TRUE_FALSE through the same createOptions/handleMCQQuestion branch as
    MCQS, so the shape is identical — only `question_type` differs.
    """
    if not (q.get("options") or []):
        q = {**q, "options": [
            {"preview_id": "1", "content": "True"},
            {"preview_id": "2", "content": "False"},
        ]}
    dto = _handle_mcq(q, "TRUE_FALSE")
    return dto


def _handle_numeric(q: Dict[str, Any]) -> Dict[str, Any]:
    """A numeric question with one or more accepted answers.

    Previously there was NO numeric branch here at all: `format_questions` fell to its
    else-clause and SKIPPED the question outright, which is why kb/paper.py stored
    numericals as ONE_WORD rather than emitting a type that would be dropped.
    """
    answers = _numeric_answers(q)
    # INTEGER unless an answer actually needs a decimal part — Java defaults to INTEGER
    # when this is absent, so being explicit is what makes decimals survive.
    response_type = "INTEGER" if all(float(a).is_integer() for a in answers) else "DECIMAL"
    dto: Dict[str, Any] = {
        "access_level": "PUBLIC",
        "question_response_type": response_type,
        "question_type": "NUMERIC",
        "explanation_text": _rich(q.get("exp")),
        "text": _rich(q.get("question", {}).get("content")),
        # NumericalEvaluationDto.NumericalData binds `validAnswers`; the snake key is
        # kept for the preview readers, exactly as with MCQ above.
        "auto_evaluation_json": _eval_json(
            {"type": "NUMERIC", "data": {"valid_answers": answers, "validAnswers": answers}}
        ),
    }
    dto.update(_metadata(q))
    return dto


def _handle_one_word(q: Dict[str, Any]) -> Dict[str, Any]:
    dto = {
        "access_level": "PUBLIC",
        "question_response_type": "ONE_WORD",
        "question_type": "ONE_WORD",
        "explanation_text": _rich(q.get("exp")),
        "text": _rich(q.get("question", {}).get("content")),
        "auto_evaluation_json": _eval_json({"type": "ONE_WORD", "data": {"answer": q.get("ans")}}),
    }
    dto.update(_metadata(q))
    return dto


def _handle_long_answer(q: Dict[str, Any]) -> Dict[str, Any]:
    dto = {
        "access_level": "PUBLIC",
        "question_response_type": "LONG_ANSWER",
        "question_type": "LONG_ANSWER",
        "explanation_text": _rich(q.get("exp")),
        "text": _rich(q.get("question", {}).get("content")),
        "auto_evaluation_json": _eval_json({"type": "LONG_ANSWER", "data": {"answer": _rich(q.get("ans"))}}),
    }
    dto.update(_metadata(q))
    return dto


def format_questions(questions: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """Port of formatQuestions: dispatch each LLM question to its type handler.
    Malformed questions are skipped (lenient)."""
    out: List[Dict[str, Any]] = []
    if not questions:
        return out
    for index, q in enumerate(questions, start=1):
        try:
            content = (q or {}).get("question", {}) or {}
            qtype = (q or {}).get("question_type")
            if not content.get("content") or not str(content.get("content")).strip() or not qtype:
                logger.warning("Skipping question at index %d: missing required fields", index)
                continue
            # unescape question content once (matches formatQuestions)
            content["content"] = unescape(content.get("content"))
            qt = str(qtype).upper()
            if qt == "MCQS":
                out.append(_handle_mcq(q, "MCQS"))
            elif qt == "MCQM":
                out.append(_handle_mcq(q, "MCQM"))
            elif qt == "TRUE_FALSE":
                out.append(_handle_true_false(q))
            elif qt == "NUMERIC":
                out.append(_handle_numeric(q))
            elif qt == "ONE_WORD":
                out.append(_handle_one_word(q))
            elif qt == "LONG_ANSWER":
                out.append(_handle_long_answer(q))
            else:
                logger.warning("Skipping question at index %d: unsupported type %s", index, qtype)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Skipping question at index %d: %s", index, exc)
    return out


def convert_to_question_paper_response(llm_output: Optional[str]) -> AutoQuestionPaperResponse:
    """Port of ResponseConverterService.convertToQuestionPaperResponse: parse the
    LLM JSON, lift metadata, format questions. Returns an empty response on blank
    input (matches Java)."""
    if not llm_output:
        return AutoQuestionPaperResponse()
    sanitized = extract_and_sanitize_json(llm_output)
    if not sanitized:
        return AutoQuestionPaperResponse()
    root = json.loads(sanitized)
    if not isinstance(root, dict):
        return AutoQuestionPaperResponse()

    questions = format_questions(root.get("questions"))
    return AutoQuestionPaperResponse.model_validate(
        {
            "questions": questions,
            "title": root.get("title"),
            "tags": root.get("tags"),
            "classes": root.get("classes"),
            "subjects": root.get("subjects"),
            "difficulty": root.get("difficulty"),
        }
    )
