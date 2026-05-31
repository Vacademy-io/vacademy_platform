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
    dto: Dict[str, Any] = {
        "access_level": "PUBLIC",
        "question_response_type": "OPTION",
        "question_type": qtype,
        "explanation_text": _rich(q.get("exp")),
        "text": _rich(q.get("question", {}).get("content")),
        "options": options_out,
        "auto_evaluation_json": _eval_json(
            {"type": qtype, "data": {"correct_option_ids": normalize_correct_option_ids(q.get("correct_options"), preview_ids)}}
        ),
    }
    if qtype == "MCQS":  # only MCQS sets tags + level (matches Java handlers)
        dto["tags"] = q.get("tags")
        dto["level"] = _canonical_level(q.get("level"))
    return dto


def _handle_one_word(q: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "access_level": "PUBLIC",
        "question_response_type": "ONE_WORD",
        "question_type": "ONE_WORD",
        "explanation_text": _rich(q.get("exp")),
        "text": _rich(q.get("question", {}).get("content")),
        "auto_evaluation_json": _eval_json({"type": "ONE_WORD", "data": {"answer": q.get("ans")}}),
    }


def _handle_long_answer(q: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "access_level": "PUBLIC",
        "question_response_type": "LONG_ANSWER",
        "question_type": "LONG_ANSWER",
        "explanation_text": _rich(q.get("exp")),
        "text": _rich(q.get("question", {}).get("content")),
        "auto_evaluation_json": _eval_json({"type": "LONG_ANSWER", "data": {"answer": _rich(q.get("ans"))}}),
    }


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
