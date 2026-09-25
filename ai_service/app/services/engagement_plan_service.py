"""
AI planner for daily engagement.

A teacher describes what they want — a batch, a stretch of days, a topic or a set
of chapters, the kinds of task they like — and the model drafts the whole plan in
the SAME shape the composer saves (slots with items). The draft is returned for
review and never published by this service: draft-and-approve, not autopilot.

Cost is planned, not incidental. ONE structured call produces every day's
questions, polls, written prompts, reading text and flashcard games. It does not
produce illustrated pages: a fortnight of visual notes with pictures would cost
14 × (page + images) before the teacher had seen any of it. Readings come back as
plain semantic HTML with image placeholders, and the teacher upgrades the ones
worth it through the separate illustrate step, which is billed per picture.

Models: text on z-ai/glm-5.3-flash (the same model the HTML-document generator
uses for creative HTML); pictures on qwen/qwen-image-3 via illustrate_document.
"""
from __future__ import annotations

import html as html_lib
import json
import logging
import os
import re
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

import httpx

from .document_postprocess import adopt_foreign_images

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "z-ai/glm-5.3-flash"
MAX_TOKENS = 24000
MAX_DAYS = 31
MAX_ITEMS_PER_DAY = 3
MAX_GROUNDING_CHARS = 24000
# admin_core refuses points outside 0..1000 on save (EngagementItemChangePolicy),
# so a model value out of range would only surface as a failed publish later.
MAX_POINTS = 1000

ITEM_TYPES = {
    "QUESTION_OF_DAY",
    "POLL",
    "READING_HTML",
    "VISUAL_NOTE",
    "GAME",
}


# ── prompt ────────────────────────────────────────────────────────────────────

def _schema_text() -> str:
    return """
Return ONLY a JSON object, no prose, no code fence, of this exact shape:

{
  "title": "short plan title",
  "days": [
    {
      "day": 1,
      "theme": "one-line theme for the day",
      "items": [
        {
          "type": "QUESTION_OF_DAY",
          "format": "MCQ",
          "title": "short task title",
          "prompt": "<p>the question, as simple HTML</p>",
          "options": [{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}],
          "correctOptionId": "b",
          "explanation": "<p>why b is right, as simple HTML</p>",
          "completionPoints": 10,
          "correctPoints": 20
        },
        {
          "type": "QUESTION_OF_DAY",
          "format": "TEXT",
          "title": "...",
          "prompt": "<p>a reflective question the learner answers in writing</p>",
          "explanation": "<p>what a good answer covers</p>",
          "completionPoints": 15
        },
        {
          "type": "POLL",
          "title": "...",
          "prompt": "<p>an opinion question with no right answer</p>",
          "options": [{"id":"a","text":"..."},{"id":"b","text":"..."}],
          "completionPoints": 5
        },
        {
          "type": "READING_HTML",
          "title": "...",
          "contentHtml": "<h2>...</h2><p>...</p>  (200-350 words of semantic HTML: h2, p, ul, li, strong; up to 2 <img data-img-prompt=\\"a clear illustration prompt\\" alt=\\"...\\"> placeholders where a picture would genuinely help)",
          "completionPoints": 10
        },
        {
          "type": "GAME",
          "game": "FLASHCARDS",
          "title": "...",
          "cards": [{"front":"term or question","back":"definition or answer"}, ...6 to 10 cards],
          "completionPoints": 10,
          "correctPoints": 10
        }
      ]
    }
  ]
}

Rules:
- Every day MUST have between 1 and the requested number of items.
- Use only the task types the teacher enabled. Vary types across days so no two consecutive days feel the same.
- MCQ: exactly 4 options with ids a,b,c,d; exactly one correctOptionId; distractors must be plausible, not silly.
- Questions must be answerable from the provided material when material is given; never invent facts.
- Language: write everything in the requested language.
- Difficulty: honour the requested level.
- Keep prompts and explanations concise. No markdown anywhere — HTML only inside HTML fields, plain text elsewhere.
""".strip()


# Regenerating ONE task: what the teacher asked for → (the label the prompt
# enables, the itemType the result must carry, the QUESTION_OF_DAY format it must
# carry). A VISUAL_NOTE is drafted as a reading with picture placeholders — the
# pictures are the separate, per-picture illustrate step — but it comes back typed
# VISUAL_NOTE so the task keeps its type in the review.
SINGLE_ITEM_TARGETS: Dict[str, Tuple[str, str, Optional[str]]] = {
    "QUESTION_OF_DAY": ("QUESTION_OF_DAY (format MCQ)", "QUESTION_OF_DAY", "MCQ"),
    "TEXT_QUESTION": ("QUESTION_OF_DAY (format TEXT)", "QUESTION_OF_DAY", "TEXT"),
    "POLL": ("POLL", "POLL", None),
    "READING_HTML": ("READING_HTML", "READING_HTML", None),
    "VISUAL_NOTE": ("READING_HTML", "VISUAL_NOTE", None),
    "GAME": ("GAME (FLASHCARDS)", "GAME", None),
}


def single_item_target(single: Any) -> Optional[Tuple[str, str, Optional[str]]]:
    """The target for a single-task regenerate, or None for a type this planner
    cannot draft (the router turns that into a 400 before any paid call)."""
    return SINGLE_ITEM_TARGETS.get(str(single or "").strip().upper())


def build_prompt(brief: Dict[str, Any], grounding: str) -> str:
    single = brief.get("single_item_type")
    target = single_item_target(single) if single else None
    if target:
        # Regenerating ONE task: ONLY its type is enabled. The plan's mix is
        # ignored here — appending it let the model swap a visual note for a
        # question, and the teacher lost the task (and its paid pictures).
        enabled_types = [target[0]]
    else:
        mix = brief.get("mix") or {}
        enabled_types = []
        if mix.get("question_of_day", True):
            enabled_types.append("QUESTION_OF_DAY (format MCQ)")
        if mix.get("text_question"):
            enabled_types.append("QUESTION_OF_DAY (format TEXT)")
        if mix.get("poll"):
            enabled_types.append("POLL")
        if mix.get("reading"):
            enabled_types.append("READING_HTML")
        if mix.get("game"):
            enabled_types.append("GAME (FLASHCARDS)")
    if not enabled_types:
        enabled_types = ["QUESTION_OF_DAY (format MCQ)"]

    avoid = brief.get("avoid_title")
    parts = [
        "You are planning daily engagement tasks for a class. A teacher will review and edit "
        "everything you produce before learners see it.",
        "",
        f"Number of days: {brief['days']}",
        f"Tasks per day: up to {brief.get('per_day_items', 2)}",
        f"Enabled task types: {', '.join(enabled_types)}",
        f"Difficulty: {brief.get('difficulty', 'medium')}",
        f"Language: {brief.get('language', 'English')}",
        f"Audience: {brief.get('audience') or 'students in this batch'}",
        "",
        f"Topic / instructions from the teacher:\n{brief.get('topic') or '(none given — use the material below)'}",
    ]
    if single:
        parts += [
            "",
            f"Produce EXACTLY ONE day with EXACTLY ONE item, of type {enabled_types[0]} and no other type. "
            + (f"Do not reuse this rejected task: \"{avoid}\". Cover a different angle." if avoid else ""),
        ]
        if target and target[1] == "VISUAL_NOTE":
            parts.append(
                "This reading becomes an illustrated page: include 1 or 2 "
                "<img data-img-prompt=\"...\" alt=\"...\"> placeholders where a picture genuinely helps."
            )
    if grounding:
        parts += [
            "",
            "MATERIAL TO GROUND EVERY TASK IN (do not go beyond it):",
            "<<<",
            grounding,
            ">>>",
        ]
    parts += ["", _schema_text()]
    return "\n".join(parts)


# ── grounding ────────────────────────────────────────────────────────────────

_TAG_RE = re.compile(r"<[^>]+>")


def strip_html(text: str) -> str:
    return html_lib.unescape(_TAG_RE.sub(" ", text or "")).replace("\xa0", " ")


def assemble_grounding(texts: List[Dict[str, str]], kb_hits: List[Dict[str, Any]]) -> str:
    """Concatenate teacher-supplied slide text and KB hits under a hard character
    budget, most relevant first, so a huge chapter cannot blow the prompt."""
    chunks: List[str] = []
    for t in texts or []:
        title = (t.get("title") or "").strip()
        body = re.sub(r"\s+", " ", strip_html(t.get("text") or "")).strip()
        if body:
            chunks.append(f"## {title}\n{body}" if title else body)
    for hit in kb_hits or []:
        body = hit.get("text") or hit.get("content") or hit.get("chunk_text") or ""
        body = re.sub(r"\s+", " ", str(body)).strip()
        if body:
            chunks.append(body)
    out, used = [], 0
    for c in chunks:
        if used + len(c) > MAX_GROUNDING_CHARS:
            remaining = MAX_GROUNDING_CHARS - used
            if remaining > 400:
                out.append(c[:remaining])
            break
        out.append(c)
        used += len(c) + 2
    return "\n\n".join(out)


# ── model call ───────────────────────────────────────────────────────────────

_REASONING_EFFORTS = {"none", "minimal", "low", "medium", "high", "xhigh"}


def reasoning_effort() -> str:
    """GLM reasons for minutes by default, and a plan is a structured fill, not a
    puzzle. Override with ENGAGEMENT_PLAN_REASONING_EFFORT (low|medium|high, or
    "" for the model's default) — the same knob the HTML-document generator has.
    A typo falls back to low: the provider would 400 every draft on it."""
    effort = os.getenv("ENGAGEMENT_PLAN_REASONING_EFFORT", "low").strip().lower()
    if effort and effort not in _REASONING_EFFORTS:
        logger.warning("[engagement-plan] unknown reasoning effort %r; using low", effort)
        return "low"
    return effort


async def call_model(prompt: str, api_key: str, base_url: str, model: str) -> Tuple[str, dict]:
    payload: Dict[str, Any] = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.6,
        "max_tokens": MAX_TOKENS,
        # Ask for JSON where the provider supports it; the parser below
        # still tolerates a fenced or prefixed reply.
        "response_format": {"type": "json_object"},
    }
    effort = reasoning_effort()
    if effort:
        payload["reasoning"] = {"effort": effort}
    async with httpx.AsyncClient(timeout=240.0) as client:
        resp = await client.post(
            base_url,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )
    if resp.status_code != 200:
        raise httpx.HTTPStatusError(
            f"OpenRouter {resp.status_code}: {resp.text[:500]}",
            request=resp.request,
            response=resp,
        )
    data = resp.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError(f"OpenRouter returned no choices: {str(data)[:300]}")
    content = (choices[0].get("message") or {}).get("content") or ""
    if not content.strip():
        raise RuntimeError("OpenRouter returned empty content")
    return content, (data.get("usage") or {})


def parse_json_lenient(text: str) -> Dict[str, Any]:
    """Accept a bare object, a fenced object, or prose around an object."""
    s = text.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        start, end = s.find("{"), s.rfind("}")
        if start >= 0 and end > start:
            return json.loads(s[start : end + 1])
        raise


# ── flashcard game renderer ──────────────────────────────────────────────────

def render_flashcards_html(title: str, cards: List[Dict[str, str]]) -> str:
    """A self-contained flashcard game that reports its score with the same
    postMessage the HTML slide renderer already understands, so it works both as
    an engagement task and as a slide."""
    safe_cards = [
        {"front": html_lib.escape(str(c.get("front", ""))), "back": html_lib.escape(str(c.get("back", "")))}
        for c in cards
        if c.get("front") and c.get("back")
    ]
    data = json.dumps(safe_cards)
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html_lib.escape(title)}</title>
<style>
  body{{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:16px;background:#f8fafc;color:#0f172a}}
  h1{{font-size:18px;margin:0 0 4px}} .sub{{color:#64748b;font-size:13px;margin-bottom:12px}}
  .card{{position:relative;height:180px;perspective:1000px;cursor:pointer;margin-bottom:12px}}
  .face{{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:16px;border-radius:14px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 4px 14px rgba(15,23,42,.06);backface-visibility:hidden;transition:transform .5s;font-size:17px}}
  .back{{transform:rotateY(180deg);background:#eef2ff}}
  .flipped .front{{transform:rotateY(180deg)}} .flipped .back{{transform:rotateY(0)}}
  .row{{display:flex;gap:8px;justify-content:center}}
  button{{border:0;border-radius:10px;padding:10px 16px;font-weight:600;cursor:pointer}}
  .know{{background:#dcfce7;color:#166534}} .again{{background:#fee2e2;color:#991b1b}}
  .done{{text-align:center;padding:24px;font-size:18px}} .bar{{height:6px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin:8px 0 14px}}
  .fill{{height:100%;background:#6366f1;width:0;transition:width .3s}}
</style></head><body>
<h1>{html_lib.escape(title)}</h1>
<div class="sub">Tap a card to flip it. Mark whether you knew it.</div>
<div class="bar"><div class="fill" id="fill"></div></div>
<div id="stage"></div>
<script>
(function(){{
  var cards={data}, i=0, known=0, flipped=false;
  var stage=document.getElementById('stage'), fill=document.getElementById('fill');
  function render(){{
    fill.style.width=Math.round(i/cards.length*100)+'%';
    if(i>=cards.length){{
      stage.innerHTML='<div class="done">Done — you knew <strong>'+known+'</strong> of '+cards.length+'</div>';
      try{{parent.postMessage({{type:'vacademy:complete',score:known,maxScore:cards.length}},'*');}}catch(e){{}}
      return;
    }}
    var c=cards[i];
    stage.innerHTML='<div class="card" id="card"><div class="face front">'+c.front+'</div><div class="face back">'+c.back+'</div></div>'
      +'<div class="row"><button class="again" id="again">Didn\\'t know</button><button class="know" id="know">Knew it</button></div>';
    flipped=false;
    document.getElementById('card').onclick=function(){{flipped=!flipped;this.classList.toggle('flipped',flipped);}};
    document.getElementById('know').onclick=function(){{known++;i++;render();}};
    document.getElementById('again').onclick=function(){{i++;render();}};
  }}
  render();
}})();
</script></body></html>"""


# ── validation / normalisation ───────────────────────────────────────────────

def _norm_options(raw: Any) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    if not isinstance(raw, list):
        return out
    seen: set = set()
    for idx, o in enumerate(raw[:6]):
        if isinstance(o, dict):
            text = str(o.get("text") or "").strip()
            oid = str(o.get("id") or chr(97 + idx)).strip().lower()[:2]
        else:
            text = str(o).strip()
            oid = chr(97 + idx)
        if not text:
            continue
        if not oid or oid in seen:
            # Two options with one id would collapse into one on save (and could
            # make the wrong one "correct"); give the repeat the next free letter.
            oid = next(c for c in "abcdefghijkl" if c not in seen)
        seen.add(oid)
        out.append({"id": oid, "text": text})
    return out


def _int(value: Any, default: int) -> int:
    """Points from the model: a number, a numeric string, or junk. Junk means
    the brief's default, never a crash that loses a paid draft."""
    try:
        return int(value) if value not in (None, "") else default
    except (TypeError, ValueError):
        return default


def _points(value: Any, default: int) -> int:
    """A model-chosen point value: zero, junk or out of the range the engagement
    API accepts means the brief's default."""
    n = _int(value, default)
    return n if 0 < n <= MAX_POINTS else default


def _as_date(value: Any) -> date:
    """The router hands over a validated `date`; older callers pass yyyy-MM-dd."""
    return value if isinstance(value, date) else date.fromisoformat(str(value))


def _normalise_item(
    it: Any,
    day_index: int,
    default_completion: int,
    default_correct: int,
    keep_points: bool = False,
) -> Optional[Dict[str, Any]]:
    """One model item → one composer item, or None when it is malformed.

    keep_points: a regenerate replaces the task's content, not its reward — the
    brief carries the replaced task's own points, and the model's are ignored.
    """
    if not isinstance(it, dict):
        return None
    itype = str(it.get("type") or "").upper()
    if itype not in ITEM_TYPES:
        return None
    title = str(it.get("title") or "").strip() or f"Day {day_index + 1} task"
    base: Dict[str, Any] = {
        "itemType": itype,
        "title": title[:200],
        "isRequired": True,
        "completionPoints": default_completion if keep_points else _points(it.get("completionPoints"), default_completion),
        "correctPoints": 0,
    }

    if itype == "QUESTION_OF_DAY":
        fmt = str(it.get("format") or "MCQ").upper()
        prompt = str(it.get("prompt") or "").strip()
        if not prompt:
            return None
        payload: Dict[str, Any] = {"format": fmt, "prompt": prompt}
        if fmt == "MCQ":
            options = _norm_options(it.get("options"))
            correct = str(it.get("correctOptionId") or "").strip().lower()
            if len(options) < 2 or not any(o["id"] == correct for o in options):
                return None
            payload["options"] = options
            payload["correctOptionId"] = correct
            payload["explanation"] = str(it.get("explanation") or "")
            base["correctPoints"] = default_correct if keep_points else _points(it.get("correctPoints"), default_correct)
            base["hideResultUntilReveal"] = True
        elif fmt in ("TEXT", "UPLOAD"):
            payload["explanation"] = str(it.get("explanation") or "")
        else:
            return None
        base["payloadJson"] = json.dumps(payload)

    elif itype == "POLL":
        prompt = str(it.get("prompt") or "").strip()
        options = _norm_options(it.get("options"))
        if not prompt or len(options) < 2:
            return None
        base["payloadJson"] = json.dumps({"format": "MCQ", "prompt": prompt, "options": options})

    elif itype in ("READING_HTML", "VISUAL_NOTE"):
        content = str(it.get("contentHtml") or "").strip()
        # Models sometimes invent <img src="https://…"> instead of the placeholder
        # contract; those reach learners as broken images. Adopt them as
        # placeholders (drawn from their alt) so the illustrate step can draw them.
        content, _ = adopt_foreign_images(content)
        if len(strip_html(content)) < 80:
            return None
        base["itemType"] = "READING_HTML"
        base["contentHtml"] = content

    elif itype == "GAME":
        cards = it.get("cards") if isinstance(it.get("cards"), list) else []
        cards = [c for c in cards if isinstance(c, dict)]
        if len(cards) < 3:
            return None
        base["contentHtml"] = render_flashcards_html(title, cards)
        base["maxScore"] = len(cards)
        base["correctPoints"] = (
            default_correct if keep_points else _points(it.get("correctPoints"), default_correct // 2)
        )

    return base


def _slot(brief: Dict[str, Any], start: date, day_index: int, day: Any, items: List[Dict[str, Any]]) -> Dict[str, Any]:
    theme = day.get("theme") if isinstance(day, dict) else None
    return {
        "title": str(theme or f"Day {day_index + 1}")[:200],
        "startDate": (start + timedelta(days=day_index)).isoformat(),
        "startTime": brief.get("start_time", "06:00"),
        "endTime": brief.get("end_time", "20:00"),
        "revealTime": brief.get("reveal_time") or None,
        "notifyTime": brief.get("notify_time") or None,
        "items": items,
    }


def _plan_title(raw: Dict[str, Any], brief: Dict[str, Any]) -> str:
    # The teacher's own title wins; the model's is only a fallback for a blank one.
    title = str(brief.get("title") or "").strip() or str(raw.get("title") or "").strip()
    return (title or "AI engagement plan")[:200]


def normalise_draft(
    raw: Dict[str, Any],
    brief: Dict[str, Any],
) -> Dict[str, Any]:
    """Turn the model's JSON into slots + items in the composer's request shape.

    Anything malformed is dropped rather than repaired into something wrong: a
    question with no correct option is not a question, and the teacher reviews
    the result anyway.
    """
    if not isinstance(raw, dict):
        raw = {}
    start = _as_date(brief["start_date"])
    per_day = max(1, min(_int(brief.get("per_day_items"), 2), MAX_ITEMS_PER_DAY))
    default_completion = _int(brief.get("completion_points"), 10)
    default_correct = _int(brief.get("correct_points"), 20)

    slots: List[Dict[str, Any]] = []
    days = raw.get("days") if isinstance(raw.get("days"), list) else []
    for day_index, day in enumerate(days[: brief["days"]]):
        items_in = day.get("items") if isinstance(day, dict) else []
        items_out: List[Dict[str, Any]] = []
        for it in (items_in if isinstance(items_in, list) else [])[:per_day]:
            item = _normalise_item(it, day_index, default_completion, default_correct)
            if item:
                items_out.append(item)
        if items_out:
            slots.append(_slot(brief, start, day_index, day, items_out))

    return {"title": _plan_title(raw, brief), "slots": slots}


def _matches_target(item: Dict[str, Any], target: Tuple[str, str, Optional[str]]) -> bool:
    _, want_type, want_format = target
    if want_type == "VISUAL_NOTE":
        # A visual note is a reading that asks for pictures; one without any
        # placeholder could never become the illustrated page it replaces.
        return item["itemType"] == "READING_HTML" and "data-img-prompt" in (item.get("contentHtml") or "")
    if item["itemType"] != want_type:
        return False
    if want_format:
        try:
            fmt = json.loads(item.get("payloadJson") or "{}").get("format")
        except (TypeError, ValueError):
            return False
        return str(fmt or "").upper() == want_format
    return True


def normalise_single_item(raw: Dict[str, Any], brief: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Regenerate mode: the first usable item of EXACTLY the requested type (and
    QUESTION_OF_DAY format), as a one-slot draft. None when the model returned
    nothing usable of that type — the router then refuses it without billing,
    so a wrong-typed or empty result is never charged and never replaces the
    teacher's task.

    Every day and item the model returned is scanned, not just the first: a
    model that ignores "exactly one" but does include the right kind still
    yields a usable task.
    """
    target = single_item_target(brief.get("single_item_type"))
    if target is None or not isinstance(raw, dict):
        return None
    start = _as_date(brief["start_date"])
    default_completion = _int(brief.get("completion_points"), 10)
    default_correct = _int(brief.get("correct_points"), 20)

    days = raw.get("days") if isinstance(raw.get("days"), list) else []
    for day in days:
        items_in = day.get("items") if isinstance(day, dict) else []
        for it in items_in if isinstance(items_in, list) else []:
            item = _normalise_item(it, 0, default_completion, default_correct, keep_points=True)
            if item and _matches_target(item, target):
                item["itemType"] = target[1]
                return {"title": _plan_title(raw, brief), "slots": [_slot(brief, start, 0, day, [item])]}
    return None


def model_name() -> str:
    return os.getenv("ENGAGEMENT_PLAN_MODEL") or DEFAULT_MODEL
