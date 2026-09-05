"""Rules the plan schema cannot express. Returns an error list the compiler
feeds back to the model for a repair pass (design §4.3 / §4.6).

Limits are deliberately a little looser than the design's prose ("about 40
words") so a good plan is not bounced for a two-word overrun; the point is to
stop wall-of-text boards, not to count words for their own sake.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Set

from ...schemas.tutor import TeachingPlanDraft, VISUAL_OPS
from .board_ops import iter_element_ops, op_words, ops_to_dicts, validate_ops
from .svg_check import check_svg_geometry


@dataclass(frozen=True)
class Limits:
    words_per_concept: int = 60
    headings_per_concept: int = 1
    visuals_per_concept: int = 1
    board_words_per_topic: int = 220
    min_say_sentences: int = 1
    max_say_sentences: int = 6
    # Whiteboards teach with pictures: every board must carry at least one
    # svg / image / video (media tasks count). Off for quizzes.
    require_visual_per_topic: bool = True
    # Engagement rules (soft: one repair round, never a failed plan): a recap
    # board + spoken recap per topic, an example per topic, a mix of quick
    # checks, a hint per check, short open questions. Off for quizzes.
    engagement_rules: bool = True


DEFAULT_LIMITS = Limits()
# Quiz boards show the question and its options verbatim; a six-option MCQ is
# not a wall of text, it is the question. One topic per question keeps each
# board to one question anyway.
QUIZ_LIMITS = Limits(words_per_concept=160, board_words_per_topic=400, require_visual_per_topic=False, engagement_rules=False)
MAX_OPEN_QUESTION_WORDS = 30
MAX_PREDICT_WORDS = 25
RECAP_MIN_ITEMS, RECAP_MAX_ITEMS = 3, 5
QUICK_CHECK_TYPES = ("mcq", "numeric")
_DEVANAGARI = re.compile(r"[\u0900-\u097F]")
_LATIN = re.compile(r"[A-Za-z]")
# Hindi narration must actually be Hindi (Hinglish keeps English technical
# terms, so a sentence can be mostly Latin letters): at least this share of
# Devanagari code points among all letters.
MIN_DEVANAGARI_SHARE = 0.15


def is_hinglish(text: str) -> bool:
    dev = len(_DEVANAGARI.findall(text or ""))
    total = dev + len(_LATIN.findall(text or ""))
    return total == 0 or dev / total >= MIN_DEVANAGARI_SHARE

MAX_WORDS_PER_CONCEPT = DEFAULT_LIMITS.words_per_concept
MAX_HEADINGS_PER_CONCEPT = DEFAULT_LIMITS.headings_per_concept
MAX_VISUALS_PER_CONCEPT = DEFAULT_LIMITS.visuals_per_concept
MAX_BOARD_WORDS_PER_TOPIC = DEFAULT_LIMITS.board_words_per_topic
MIN_DESCRIPTION_CHARS = 10
SUPPORTED_LANGS = ("en", "hi")

_SENT = re.compile(r"[.!?।](\s|$)")


def sentence_count(text: str) -> int:
    text = (text or "").strip()
    if not text:
        return 0
    return max(1, len(_SENT.findall(text)))


def normalize_plan(plan: TeachingPlanDraft) -> None:
    """Cheap fixes that are not worth a repair round-trip: a check with no
    prompt is no check; stray whitespace in ids; empty say_i18n entries."""
    for topic in plan.topics:
        topic.id = (topic.id or "").strip()
        for concept in topic.concepts:
            concept.id = (concept.id or "").strip()
            if concept.check and concept.check.type != "none" and not (concept.check.prompt or "").strip():
                concept.check.type = "none"
            concept.say_i18n = {k: v for k, v in (concept.say_i18n or {}).items() if (v or "").strip()}


def validate_plan(
    plan: TeachingPlanDraft,
    course_lang: str = "en",
    *,
    limits: Limits = DEFAULT_LIMITS,
    require_media_urls: bool = True,
) -> List[str]:
    normalize_plan(plan)
    errors: List[str] = []
    seen_ids: Set[str] = set()
    other_lang = "hi" if course_lang == "en" else "en"

    if not plan.topics:
        errors.append("plan has no topics")
        return errors

    for ti, topic in enumerate(plan.topics):
        tloc = f"topics[{ti}]('{topic.title[:30]}')"
        if not topic.concepts:
            errors.append(f"{tloc}: topic has no concepts")
            continue
        if topic.id in seen_ids:
            errors.append(f"{tloc}: duplicate id '{topic.id}'")
        seen_ids.add(topic.id)

        board_ids: Set[str] = set()
        topic_words = 0
        for ci, concept in enumerate(topic.concepts):
            cloc = f"{tloc}.concepts[{ci}]('{concept.title[:30]}')"
            if concept.id in seen_ids:
                errors.append(f"{cloc}: duplicate id '{concept.id}'")
            seen_ids.add(concept.id)

            ops = ops_to_dicts(concept.board_ops)
            op_errors, board_ids = validate_ops(ops, board_ids, where=f"{cloc}.board_",
                                                require_media_urls=require_media_urls)
            errors.extend(op_errors)
            # Element ids must be unique across the whole plan too, so a live
            # highlight can never be ambiguous.
            elems = list(iter_element_ops(ops))
            for op in elems:
                oid = op.get("id")
                if oid and oid in seen_ids:
                    errors.append(f"{cloc}: element id '{oid}' reuses an earlier topic/concept/element id")
                elif oid:
                    seen_ids.add(oid)

            words = sum(op_words(op) for op in ops)
            topic_words += words
            if words > limits.words_per_concept:
                errors.append(f"{cloc}: board adds {words} words; keep a concept under {limits.words_per_concept}")
            headings = sum(1 for op in elems if op.get("op") == "heading")
            if headings > limits.headings_per_concept:
                errors.append(f"{cloc}: {headings} headings; at most {limits.headings_per_concept} per concept")
            visuals = sum(1 for op in elems if op.get("op") in VISUAL_OPS)
            if visuals > limits.visuals_per_concept:
                errors.append(f"{cloc}: {visuals} visuals; at most {limits.visuals_per_concept} per concept")
            if any(op.get("op") == "clear" for op in ops):
                errors.append(f"{cloc}: 'clear' belongs to topic boundaries, not concepts")
            for op in elems:
                if op.get("op") in VISUAL_OPS and len((op.get("description") or "").strip()) < MIN_DESCRIPTION_CHARS:
                    errors.append(f"{cloc}: {op.get('op')} '{op.get('id')}' needs a real description")

            n = sentence_count(concept.say)
            if n < limits.min_say_sentences or n > limits.max_say_sentences:
                errors.append(f"{cloc}: say has {n} sentences; use {limits.min_say_sentences}-{limits.max_say_sentences}")
            if not (concept.say_i18n or {}).get(other_lang, "").strip():
                errors.append(f"{cloc}: say_i18n['{other_lang}'] is missing (narration must be compiled in both languages)")

            chk = concept.check
            if ci > 0 and chk.type == "none":
                errors.append(f"{cloc}: every concept after the first of a board needs a check with a prompt and an expected answer or rubric")
            if chk.type != "none":
                if not (chk.prompt or "").strip():
                    errors.append(f"{cloc}: check needs a prompt")
                if chk.type == "mcq" and len(chk.options) < 2:
                    errors.append(f"{cloc}: mcq check needs at least two options")
                if not (chk.expected or "").strip() and not (chk.rubric or "").strip():
                    errors.append(f"{cloc}: check needs an expected answer or a rubric")
                if not (0.3 <= chk.pass_threshold <= 1.0):
                    errors.append(f"{cloc}: pass_threshold must be between 0.3 and 1.0")

        if limits.require_visual_per_topic and not any(
            op.get("op") in VISUAL_OPS for c in topic.concepts for op in iter_element_ops(ops_to_dicts(c.board_ops))
        ):
            errors.append(f"{tloc}: this board has no visual — add an svg diagram (or an image) to one of its concepts")
        if topic_words > limits.board_words_per_topic:
            errors.append(f"{tloc}: the topic's whole board is {topic_words} words; a board must fit one screen (<= {limits.board_words_per_topic})")
        s_errors, _ = validate_ops(ops_to_dicts(topic.summary_ops), set(board_ids), where=f"{tloc}.summary_",
                                   require_media_urls=require_media_urls)
        errors.extend(s_errors)

    return errors


# ── soft rules: engagement and diagram quality ──────────────────────────────
# These come back to the model once; a plan that still breaks them is kept
# (with broken diagrams replaced by an auto-layout), so quality asks never
# turn into a failed compile.

def soft_errors(plan: TeachingPlanDraft, *, limits: Limits = DEFAULT_LIMITS) -> List[str]:
    errors: List[str] = []
    if not plan.topics:
        return errors
    total_checks = 0
    quick_checks = 0
    other = "hi" if (plan.language or "en") == "en" else "en"

    def _needs(loc: str, what: str, text: str, i18n: Dict[str, str]) -> None:
        if not (text or "").strip():
            return
        alt = (i18n or {}).get(other, "")
        if not alt.strip():
            errors.append(f"{loc}: {what}_i18n['{other}'] is missing (every spoken line is compiled in both languages)")
        elif other == "hi" and not is_hinglish(alt):
            errors.append(f"{loc}: {what}_i18n['hi'] is not Hindi — write it as Hinglish in Devanagari with English technical terms")

    for ti, topic in enumerate(plan.topics):
        tloc = f"topics[{ti}]('{topic.title[:30]}')"
        _needs(tloc, "summary_say", topic.summary_say or "", topic.summary_say_i18n)
        for ci, concept in enumerate(topic.concepts):
            cloc = f"{tloc}.concepts[{ci}]('{concept.title[:30]}')"
            if other == "hi" and (concept.say_i18n or {}).get("hi") and not is_hinglish(concept.say_i18n["hi"]):
                errors.append(f"{cloc}: say_i18n['hi'] is not Hindi — write it as Hinglish in Devanagari with English technical terms")
            _needs(cloc, "predict", concept.predict or "", concept.predict_i18n)
            if concept.check.type != "none":
                _needs(cloc, "check.prompt", concept.check.prompt or "", concept.check.prompt_i18n)
                _needs(cloc, "check.hint", concept.check.hint or "", concept.check.hint_i18n)
            ops = ops_to_dicts(concept.board_ops)
            for op in iter_element_ops(ops):
                if op.get("op") == "svg":
                    for e in check_svg_geometry(op.get("svg", ""), op.get("parts") or []):
                        errors.append(f"{cloc}: svg '{op.get('id')}': {e}")
            chk = concept.check
            if chk.type != "none":
                total_checks += 1
                if chk.type in QUICK_CHECK_TYPES:
                    quick_checks += 1
                if chk.type == "mcq" and len(chk.options) < 3:
                    errors.append(f"{cloc}: mcq needs 3 options (one right, two plausible)")
                if not (chk.hint or "").strip() or len((chk.hint or "").split()) < 3:
                    errors.append(f"{cloc}: check needs a `hint` (a nudge toward the answer, not the answer)")
                prompt = chk.prompt or ""
                if chk.type == "open" and (len(prompt.split()) > MAX_OPEN_QUESTION_WORDS or prompt.count("?") > 1):
                    errors.append(f"{cloc}: open question asks more than one thing or is over {MAX_OPEN_QUESTION_WORDS} words; ask ONE thing")
            if concept.predict:
                p = concept.predict.strip()
                if len(p.split()) > MAX_PREDICT_WORDS or not p.endswith("?"):
                    errors.append(f"{cloc}: predict must be one short question (<= {MAX_PREDICT_WORDS} words, ending with ?)")
            elif limits.engagement_rules and ti > 0 and ci == 0:
                errors.append(f"{cloc}: the first concept of every topic after the first needs a `predict` question the learner guesses at before the board appears")
        if not limits.engagement_rules:
            continue
        s_ops = ops_to_dicts(topic.summary_ops)
        recap = [op for op in s_ops if op.get("op") == "bullet" and RECAP_MIN_ITEMS <= len(op.get("items") or []) <= RECAP_MAX_ITEMS]
        if not recap:
            errors.append(f"{tloc}: summary_ops needs a recap bullet op with {RECAP_MIN_ITEMS}-{RECAP_MAX_ITEMS} items (what the topic taught)")
        n = sentence_count(topic.summary_say or "")
        if n < 1 or n > 3:
            errors.append(f"{tloc}: summary_say must be 1-3 spoken sentences recapping the topic")
        if not any(op.get("op") == "callout" and op.get("kind") == "example"
                   for c in topic.concepts for op in iter_element_ops(ops_to_dicts(c.board_ops))):
            errors.append(f"{tloc}: the topic needs one callout of kind 'example' (a worked or real-life example)")
    if limits.engagement_rules and total_checks >= 3 and quick_checks * 3 < total_checks:
        errors.append(f"plan: only {quick_checks} of {total_checks} checks are quick (mcq with 3 options or numeric); make at least a third quick — open questions are for reasoning, not every concept")
    return errors
