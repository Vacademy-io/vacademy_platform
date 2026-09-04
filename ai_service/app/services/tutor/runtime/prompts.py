"""Live-turn prompts and deterministic templates (design §6.4–§6.6)."""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

LANG_NAMES = {"en": "English", "hi": "Hindi (Devanagari; keep technical terms in English letters)"}

# ── deterministic lines (no model call) ──────────────────────────────────────

T = {
    "greet": {
        "en": "Hi {name}! I'm {teacher}, and I'll be teaching you today. We're starting with {slide}. Let's begin.",
        "hi": "नमस्ते {name}! मैं {teacher} हूँ और आज मैं आपको पढ़ाऊँगी। हम {slide} से शुरू कर रहे हैं। चलिए शुरू करते हैं।",
    },
    "resume": {
        "en": "Welcome back, {name}! Last time we were in {slide}. {summary} Let's pick up from where we left off.",
        "hi": "वापस स्वागत है, {name}! पिछली बार हम {slide} पर थे। {summary} चलिए वहीं से आगे बढ़ते हैं।",
    },
    "resume_summary": {
        "en": "Welcome back, {name}! We had just finished {topic} in {slide}. {summary} Let's carry on from there.",
        "hi": "वापस स्वागत है, {name}! हमने {slide} में {topic} अभी पूरा किया था। {summary} चलिए वहीं से आगे बढ़ते हैं।",
    },
    "resume_done": {
        "en": "Welcome back, {name}! You already completed {slide}. {summary} Let's see what's next.",
        "hi": "वापस स्वागत है, {name}! आप {slide} पहले ही पूरा कर चुके हैं। {summary} चलिए देखते हैं आगे क्या है।",
    },
    "greet_returning": {
        "en": "Welcome back, {name}! Last time we worked on {previous}. {summary} Today we're starting {slide}. Let's begin.",
        "hi": "वापस स्वागत है, {name}! पिछली बार हमने {previous} पर काम किया था। {summary} आज हम {slide} शुरू कर रहे हैं। चलिए शुरू करते हैं।",
    },
    "topic_summary": {
        "en": "Good. That wraps up {topic}. Take a look at the board once more, then we'll move to the next part.",
        "hi": "बहुत अच्छे। {topic} यहीं पूरा होता है। बोर्ड को एक बार फिर देख लीजिए, फिर हम अगले हिस्से पर चलेंगे।",
    },
    "slide_done": {
        "en": "That completes {slide}. Well done, {name}. {weak}",
        "hi": "{slide} पूरा हुआ। शाबाश, {name}। {weak}",
    },
    "weak_note": {
        "en": "We'll come back to {n} point(s) that need a little more practice.",
        "hi": "हम {n} बिंदु(ओं) पर फिर से लौटेंगे जिन पर थोड़ा और अभ्यास चाहिए।",
    },
    "ask": {"en": "{prompt}", "hi": "{prompt}"},
    "media_task_video": {
        "en": "Please watch this video now. Take your time, and tell me when you're done.",
        "hi": "कृपया अभी यह वीडियो देखिए। आराम से देखिए, और जब हो जाए तो मुझे बताइए।",
    },
    "media_task_pdf": {
        "en": "Please read this document now. Take your time, and tell me when you're done.",
        "hi": "कृपया अभी यह दस्तावेज़ पढ़िए। आराम से पढ़िए, और जब हो जाए तो मुझे बताइए।",
    },
    "skipped": {"en": "Okay, let's move on.", "hi": "ठीक है, आगे बढ़ते हैं।"},
    "next_slide": {"en": "Now let's move on to {slide}.", "hi": "अब चलिए {slide} पर चलते हैं।"},
    "pause": {"en": "Okay, I'll wait. Say continue when you're ready.", "hi": "ठीक है, मैं रुकती हूँ। जब तैयार हों तो 'continue' कहिए।"},
    "credits_end": {"en": "Your institute's lesson credits have run out for now, so I'll stop here. Your place is saved; ask them to top up and we'll continue.",
                    "hi": "आपके संस्थान के पाठ क्रेडिट अभी समाप्त हो गए हैं, इसलिए मैं यहीं रुकती हूँ। आपकी जगह सुरक्षित है; टॉप-अप के बाद हम आगे बढ़ेंगे।"},
    "idle_end": {"en": "We've been quiet for a while, so I'll stop here. Come back any time and we'll pick up where we left off.",
                 "hi": "काफ़ी देर से कोई बात नहीं हुई, इसलिए मैं यहीं रुकती हूँ। जब चाहें वापस आइए, हम वहीं से आगे बढ़ेंगे।"},
    "slower": {"en": "Sure, I'll go slower.", "hi": "ज़रूर, मैं धीरे बोलूँगी।"},
    "faster": {"en": "Sure, I'll speed up a little.", "hi": "ज़रूर, थोड़ा तेज़ चलते हैं।"},
    "fallback_correct": {"en": "That's right. Let's continue.", "hi": "बिल्कुल सही। चलिए आगे बढ़ते हैं।"},
    "fallback_hint": {"en": "Not quite. Look at the board again: {hint}. Try once more.", "hi": "पूरी तरह नहीं। बोर्ड को फिर देखिए: {hint}। एक बार फिर कोशिश कीजिए।"},
    "fallback_move_on": {"en": "Let's note that for later and keep going. {expected}", "hi": "इसे बाद के लिए नोट कर लेते हैं और आगे बढ़ते हैं। {expected}"},
}


_LEADING_GREETING = re.compile(
    r"^\s*(?:hi|hello|hey|namaste|नमस्ते|welcome(?: back)?)[^.!?।]*[.!?।]\s*", re.IGNORECASE)


def strip_leading_greeting(narration: str) -> str:
    """Drop a compiled narration's own opening "Hi {name}, …" sentence when
    the teacher already greeted (welcome back / next slide)."""
    out = _LEADING_GREETING.sub("", narration or "", count=1)
    return out if out.strip() else narration


def tpl(key: str, lang: str, **kw: Any) -> str:
    table = T[key]
    text = table.get(lang if lang in table else "en") or table["en"]
    try:
        return text.format(**{k: (v if v is not None else "") for k, v in kw.items()})
    except Exception:  # noqa: BLE001
        return text


# ── decision turn ────────────────────────────────────────────────────────────

DECISION_SCHEMA = """Return ONE JSON object and nothing else:
{
  "action": "advance" | "remediate" | "answer_doubt" | "wait",
  "say": "what you say next, 1-4 spoken sentences, in the session language, addressing the learner directly",
  "board_ops": [ {"op":"highlight","target":"<element id on the board>","style":"pulse"} | {"op":"annotate","id":"s-1","target":"<element id>","text":"<=8 words","position":"right"} ],
  "assessment": {"score": 0.0-1.0, "misconception": "<short label or null>", "evidence": "<what in the answer shows it>"},
  "learner_state_delta": {"note": "<one line about this learner, or null>"}
}
Rules: "advance" only when score >= the pass threshold. "remediate" = the answer misses the point: `say` gives ONE
concrete hint anchored on the board and re-asks in fewer words (never reveal the full answer on the first remediation).
"answer_doubt" = the learner asked something instead of answering: answer briefly from the concept material, then
invite them to answer the check. "wait" = the learner said something that is neither (small talk): respond in one
sentence and re-ask. Only highlight/annotate ops, only targets that exist on the board. No markdown."""


def system_prompt(teacher: str, lang: str, strictness: str) -> str:
    tone = {
        "gentle": "Very encouraging; accept partial answers generously; never make the learner feel wrong.",
        "strict": "Precise; award credit only for correct, complete answers; correct terminology firmly but kindly.",
    }.get(strictness, "Warm and clear; give credit for the right idea in the learner's own words.")
    return (
        f"You are {teacher}, a one-to-one teacher speaking to a learner over a shared whiteboard. "
        f"Session language: {LANG_NAMES.get(lang, lang)}. {tone}\n"
        "You evaluate the learner's answer to the check for the CURRENT concept using its rubric and the listed "
        "misconceptions, and decide what happens next. Keep every spoken line short; the learner is listening, not reading.\n\n"
        + DECISION_SCHEMA
    )


def _ops_as_text(ops: List[Dict[str, Any]]) -> str:
    lines = []
    for op in ops:
        k = op.get("op")
        if k in ("heading", "text", "callout", "annotate"):
            lines.append(f"[{k} #{op.get('id')}] {op.get('text')}")
        elif k == "bullet":
            lines.append(f"[bullet #{op.get('id')}] " + " | ".join(op.get("items") or []))
        elif k == "formula":
            lines.append(f"[formula #{op.get('id')}] {op.get('latex')}")
        elif k in ("svg", "image", "video", "media_task"):
            parts = ", ".join(f"{p.get('label')} (#{p.get('id')})" for p in (op.get("parts") or []))
            lines.append(f"[{k} #{op.get('id')}] {op.get('description')}" + (f" — parts: {parts}" if parts else ""))
        elif k == "table":
            lines.append(f"[table #{op.get('id')}] " + " / ".join(" | ".join(r) for r in (op.get("rows") or [])[:4]))
        elif k == "arrow":
            lines.append(f"[arrow #{op.get('id')}] {op.get('from')} -> {op.get('to')} {op.get('text') or ''}")
    return "\n".join(lines)


def turn_prompt(
    *,
    learner_name: Optional[str],
    learner_block: str,
    slide_title: str,
    objectives: List[str],
    board_ops: List[Dict[str, Any]],
    concept_title: str,
    concept_say: str,
    teach_notes: Optional[str],
    check: Dict[str, Any],
    transcript: List[Dict[str, str]],
    learner_message: str,
    remediation_no: int,
    mode: str,
    final_attempt: bool = False,
    source_block: Optional[str] = None,
) -> str:
    parts = [
        f"LEARNER: {learner_name or 'the learner'}\n{learner_block}".strip(),
        f"SLIDE: {slide_title}\nOBJECTIVES: " + "; ".join(objectives[:5]),
        "BOARD (what the learner sees now; ids in #):\n" + (_ops_as_text(board_ops) or "(empty)"),
        f"CURRENT CONCEPT: {concept_title}\nTEACHER JUST SAID: {concept_say}"
        + (f"\nTEACHING NOTES: {teach_notes}" if teach_notes else ""),
        "CHECK:\n" + json.dumps({
            "type": check.get("type"), "prompt": check.get("prompt"), "options": check.get("options") or [],
            "expected": check.get("expected"), "rubric": check.get("rubric"),
            "misconceptions": check.get("misconceptions") or [], "pass_threshold": check.get("pass_threshold", 0.7),
        }, ensure_ascii=False),
        ("SOURCE MATERIAL (the course's own material for this concept; ground your hint in it):\n" + source_block[:6000])
        if source_block else "",
        "RECENT TRANSCRIPT:\n" + "\n".join(f"{m['role']}: {m['text']}" for m in transcript[-6:]),
        f"THIS IS REMEDIATION #{remediation_no} FOR THIS CONCEPT." if remediation_no else "FIRST ANSWER FOR THIS CONCEPT.",
        ("THIS IS THE LEARNER'S FINAL ATTEMPT ON THIS CHECK. Do NOT re-ask. If the answer is still wrong, use action "
         "\"remediate\" and in `say` give the correct answer in one clear sentence, then say you will move on."
         if final_attempt else ""),
        f"LEARNER NOW SAYS ({mode}): {learner_message.strip()}",
        "Decide. JSON only.",
    ]
    return "\n\n".join(p for p in parts if p)


def doubt_prompt(
    *,
    learner_name: Optional[str],
    learner_block: str,
    slide_title: str,
    board_ops: List[Dict[str, Any]],
    concept_title: str,
    concept_say: str,
    teach_notes: Optional[str],
    transcript: List[Dict[str, str]],
    question: str,
    source_block: Optional[str],
) -> str:
    parts = [
        f"LEARNER: {learner_name or 'the learner'}\n{learner_block}".strip(),
        f"SLIDE: {slide_title}",
        "BOARD (ids in #):\n" + (_ops_as_text(board_ops) or "(empty)"),
        f"CURRENT CONCEPT: {concept_title}\nTEACHER JUST SAID: {concept_say}"
        + (f"\nTEACHING NOTES: {teach_notes}" if teach_notes else ""),
    ]
    if source_block:
        parts.append("SOURCE MATERIAL (answer from this; say so if it does not cover the question):\n" + source_block[:6000])
    parts += [
        "RECENT TRANSCRIPT:\n" + "\n".join(f"{m['role']}: {m['text']}" for m in transcript[-6:]),
        f"LEARNER ASKS: {question.strip()}",
        'Answer in 1-4 spoken sentences, then bring them back to the lesson. Use action "answer_doubt". JSON only.',
    ]
    return "\n\n".join(parts)


def learner_block(state: Dict[str, Any], tags: List[str]) -> str:
    mastery = state.get("mastery_json") or {}
    relevant = {t: mastery[t] for t in tags if t in mastery}
    lines = []
    if state.get("rolling_summary"):
        lines.append("Previous sessions: " + str(state["rolling_summary"])[:600])
    if relevant:
        lines.append("Mastery on this concept's tags: " + ", ".join(f"{t}={round(float(v.get('score', 0)), 2)}" for t, v in relevant.items()))
    mis = state.get("misconceptions_json") or []
    if mis:
        lines.append("Known misconceptions: " + "; ".join(str(m.get("note") or m.get("tag")) for m in mis[-4:]))
    if state.get("pace"):
        lines.append(f"Pace preference: {state['pace']}")
    return "\n".join(lines)
