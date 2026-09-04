"""Prompt blocks for compiling one slide into a teaching plan (design §4.6)."""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .plan_validator import (
    MAX_BOARD_WORDS_PER_TOPIC, MAX_HEADINGS_PER_CONCEPT, MAX_VISUALS_PER_CONCEPT,
    MAX_WORDS_PER_CONCEPT,
)

LANG_NAMES = {"en": "English", "hi": "Hindi (Devanagari script; keep English technical terms in Latin script)"}


def _other(lang: str) -> str:
    return "hi" if lang == "en" else "en"


OPS_REFERENCE = """BOARD OPERATIONS (the only ops you may use; every element op has a unique "id"):
- {"op":"heading","id":"t1-h","text":"...","level":2}            one per concept at most
- {"op":"text","id":"...","text":"..."}                            a short line, not a paragraph
- {"op":"bullet","id":"...","items":["...","..."]}                 2-4 short items
- {"op":"formula","id":"...","latex":"F = m a","caption":"..."}   LaTeX, no $ delimiters
- {"op":"svg","id":"...","svg":"<svg viewBox='0 0 640 360'>...</svg>","description":"what it shows","parts":[{"id":"nucleus","label":"Nucleus","step":0},{"id":"arrow1","label":"Energy flow","step":1}]}
      a clean diagram; give the parts a teacher would point at their own id= inside the svg (wrap a shape and its
      label in one <g id='...'>). "step" ANIMATES the diagram: parts with step 0 are drawn at once, parts with
      step 1, 2, 3… appear in that order while the teacher speaks, so mention them in `say` in the same order.
      Inside the svg use SINGLE quotes for every attribute (viewBox='0 0 640 360', id='nucleus') so the JSON string needs no escaping.
- {"op":"image","id":"...","generate":"prompt for an image generator","description":"what it shows","caption":"..."}
      a realistic picture where a photo teaches better than a line drawing (anatomy, equipment, real-world
      scenes, a patient doing an exercise): write a concrete, well-lit, educational illustration prompt
- {"op":"table","id":"...","rows":[["Header","Header"],["a","b"]]}
- {"op":"callout","id":"...","text":"...","kind":"tip|warning|definition|example"}
- {"op":"annotate","id":"...","target":"<existing element id>","text":"...","position":"right|below|above|left"}
- {"op":"arrow","id":"...","from":"<element id>","to":"<element id>","text":"..."}
- {"op":"media_task","id":"...","kind":"video|pdf","description":"..."}   ONLY in a media-task lesson (the system fills the url)
Optional on any op: "anim":"write|fade|pop", "say_index": <0-based sentence of `say` this op appears with>.
Never use highlight/unhighlight/reveal/clear: those are live-session ops."""


def plan_schema_text(lang: str) -> str:
    other = _other(lang)
    return f"""OUTPUT: one JSON object, nothing else (no markdown fences, no prose before or after; compact, no pretty-printing; no raw newlines inside strings):
{{
  "language": "{lang}",
  "objectives": ["...", "..."],
  "key_terms": [{{"term": "...", "meaning": "..."}}],
  "topics": [
    {{
      "id": "t1", "title": "...", "estimated_seconds": 240,
      "concepts": [
        {{
          "id": "t1c1", "title": "...",
          "concept_tags": ["subject.concept"],
          "prerequisites": [],
          "board_ops": [ ...ops... ],
          "say": "2 to 4 spoken sentences in {LANG_NAMES[lang]}",
          "say_i18n": {{"{other}": "the same narration in {LANG_NAMES[other]}"}},
          "teach_notes": "how to teach this; analogies; what NOT to introduce yet",
          "check": {{
            "type": "open|mcq|numeric|none",
            "prompt": "the question the teacher asks",
            "options": ["only for mcq"],
            "expected": "the answer",
            "rubric": "what earns full / half credit",
            "misconceptions": [{{"pattern": "what a confused learner says", "hint": "the nudge that fixes it"}}],
            "pass_threshold": 0.7
          }}
        }}
      ],
      "summary_ops": [ ...1-3 ops that close the topic... ]
    }}
  ]
}}"""


def rules_text(images_enabled: bool = True) -> str:
    return f"""RULES (a validator enforces these; violations come back to you for repair):
1. A TOPIC is one whiteboard. A CONCEPT is one phase of that board: it ADDS a little to the board
   (at most {MAX_HEADINGS_PER_CONCEPT} heading, at most {MAX_VISUALS_PER_CONCEPT} visual, under {MAX_WORDS_PER_CONCEPT} words of new text) while the teacher
   speaks `say`. The whole topic's board must fit one screen (under {MAX_BOARD_WORDS_PER_TOPIC} words).
2. Cover the ENTIRE slide. As many topics and concepts as the material needs; never compress to hit a count.
   Do not add facts the material does not contain; do not skip facts it does.
3. Every concept except the first of a topic has a check. Checks test the concept just taught, in the
   learner's own words where possible; give a rubric and 1-3 realistic misconceptions with hints.
4. VISUALS ARE THE POINT OF A WHITEBOARD. Every topic (board) gets at least one visual, and most concepts add
   or extend one. Use an SVG diagram for anything structural (parts of a cell, a circuit, a force diagram, a
   flow, a timeline, a comparison). SVG craft rules (the board renders them at ~700px wide in a sans-serif font):
   - viewBox='0 0 640 360' and FILL it: shapes spread across the whole canvas, nothing crammed into one corner
     or floating in empty white space; keep a 24px margin from every edge (text baselines >= 32 from the top).
   - 3-4 harmonious fill colours (soft blues/greens/ambers with a darker stroke) plus dark text; rounded
     rects (rx='10'), arrows with marker-end, thick strokes (2-3px).
   - Labels 18-22px, text-anchor='middle' inside or under their shape; a label fits in about 11px per
     character, so a 12-character label needs a shape at least 150px wide. Never let text cross a line or
     another label; never rely on font width to line things up.
   - Give the parts a teacher would point at their own id= (listed in "parts"), and use "step" so a
     process, a flow or a build-up appears piece by piece as the narration reaches it.
   Tables for comparisons, callouts for definitions and warnings.
   {IMAGES_ON_RULE if images_enabled else IMAGES_OFF_RULE}
5. `say` is what the teacher SAYS out loud: warm, second person, 2-4 sentences, refers to the board
   ("look at the arrow on the left"). Use {{student_name}} where the teacher would say the learner's name.
   Provide the same narration in the other language under say_i18n.
6. Ids: topics "t1","t2"...; concepts "t1c1","t1c2"...; elements "t1c1-b1" etc. All unique across the plan.
7. concept_tags are stable, lowercase, dotted ("cell.nucleus"); the same idea gets the same tag everywhere.
8. Write teach_notes for a human/AI teacher: the analogy to use, the order to reveal things, common traps."""


def system_prompt(teacher_name: str, lang: str, images_enabled: bool = True) -> str:
    return (
        f"You are {teacher_name}, an expert one-to-one teacher, turning one course slide into a live "
        "whiteboard lesson: a sequence of small board phases, each spoken over in a few sentences and "
        "followed by a quick check of understanding. You write for a learner who is alone with you; "
        "you never lecture in walls of text.\n\n"
        f"Course language: {LANG_NAMES.get(lang, lang)}.\n\n"
        + OPS_REFERENCE + "\n\n" + rules_text(images_enabled)
    )


# Tested 2026-09-04 on a physiotherapy slide: with only "use an image where a
# picture teaches better", both Luna and Flash returned ZERO image ops across
# four boards. Spelling out which visual kind fits what, and requiring one
# scene-setting image, gave two well-placed images plus the diagrams.
IMAGES_ON_RULE = """IMAGES ARE ON FOR THIS COURSE. A whiteboard mixes two kinds of visual and you must use both kinds where each fits:
   - "svg" diagrams for STRUCTURE: parts of a thing, a flow or pathway, a comparison, a timeline, a formula.
   - "image" ops for anything that exists in the physical world: a person doing something, a body part,
     equipment, a setting (clinic, lab, home, workplace), a real object, a procedure or technique being
     performed, a real-life scene the learner should picture. A learner remembers a realistic picture of a
     physiotherapist assessing a patient far better than a box labelled "assessment".
   Image rules (checked): (a) the plan contains at least one image op, placed where the slide first meets
   the real world (usually the opening topic sets the scene); (b) every topic that involves people,
   patients, environments, tools, practical techniques or worked examples gets an image op in one of its
   concepts, alongside (not instead of) any diagram that topic needs; (c) a purely abstract topic
   (definitions, categories, a formula) keeps its diagram and needs no image; (d) an image `generate`
   prompt is a concrete photographic brief of 25-45 words: subject, action, setting, lighting, camera
   angle, then "realistic, educational, no text, no logos"."""

IMAGES_OFF_RULE = """AI IMAGES ARE OFF for this course: do not use image ops; draw every visual as an svg diagram."""


def user_prompt(
    *,
    slide_title: str,
    chapter_title: Optional[str],
    course_title: Optional[str],
    slide_kind: str,
    source_text: str,
    lang: str,
    kb_block: Optional[str] = None,
    institute_prompt: Optional[str] = None,
    images_enabled: bool = True,
) -> str:
    parts: List[str] = []
    parts.append(f"COURSE: {course_title or '(untitled)'}\nCHAPTER: {chapter_title or '(none)'}\nSLIDE: {slide_title}\nSLIDE KIND: {slide_kind}")
    if institute_prompt:
        parts.append("INSTITUTE TEACHING STYLE:\n" + institute_prompt.strip()[:2000])
    if not images_enabled:
        parts.append(IMAGES_OFF_RULE)
    parts.append("SLIDE MATERIAL (teach all of it, in this order):\n" + source_text.strip())
    if kb_block:
        parts.append(kb_block.strip())
    parts.append(plan_schema_text(lang))
    return "\n\n".join(parts)


def media_task_user_prompt(
    *,
    slide_title: str,
    chapter_title: Optional[str],
    course_title: Optional[str],
    kind: str,
    description: str,
    lang: str,
) -> str:
    what = "video" if kind == "video" else "PDF"
    return (
        f"COURSE: {course_title or '(untitled)'}\nCHAPTER: {chapter_title or '(none)'}\nSLIDE: {slide_title}\n"
        f"SLIDE KIND: {what} the learner must {'watch' if kind == 'video' else 'read'} (a MEDIA TASK)\n\n"
        f"WHAT THE {what.upper()} TEACHES (written by the teacher who added it):\n{description.strip()}\n\n"
        "Build ONE topic. Its FIRST concept is the task itself: board_ops = exactly one op "
        f'{{"op":"media_task","id":"t1c1-m","kind":"{kind}","description":"..."}} (the url is filled in by the system), '
        f"`say` asks the learner to {'watch the video' if kind == 'video' else 'read the document'} now and tell you when done, and check.type = \"none\". "
        "Then 2 to 4 concepts that each ask ONE check question about what the material covered "
        "(board: a short heading or bullet restating the point after the learner answers), with rubric and misconceptions "
        "drawn from the description. Nothing else.\n\n"
        + plan_schema_text(lang)
    )


def image_repair_prompt(previous_json: str) -> str:
    """The plan validated but carries no image op although images are on:
    one extra round that asks for pictures where they belong."""
    return (
        "Your plan is valid but has NO image op, and AI images are ON for this course. Re-read the image "
        "rules: add an image op (with a 25-45 word photographic `generate` brief) in the topic that sets the "
        "scene and in every topic that involves people, patients, settings, tools, techniques or worked "
        "examples — keep every diagram you drew. If the slide is genuinely abstract everywhere, return the "
        "plan unchanged. Return the complete corrected JSON object, nothing else.\n\nPREVIOUS JSON:\n"
        f"{previous_json[:60000]}"
    )


def repair_prompt(errors: List[str], previous_json: str) -> str:
    listed = "\n".join(f"- {e}" for e in errors[:40])
    return (
        "Your previous plan did not pass validation. Fix EVERY problem below and return the complete, "
        "corrected JSON object (same structure, all topics and concepts, nothing else):\n"
        f"{listed}\n\nPREVIOUS JSON:\n{previous_json[:60000]}"
    )


def _strip_fences(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        s = s.split("\n", 1)[1] if "\n" in s else s[3:]
        if s.rstrip().endswith("```"):
            s = s.rstrip()[:-3]
    return s


def extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Pull the first JSON object out of a model reply.

    Tolerates code fences and prose around the object, then falls back to a
    repairing parser: plans carry SVG markup inside JSON strings and models
    regularly slip on the escaping (an unescaped quote in a viewBox, a raw
    newline), which strict json.loads rejects wholesale."""
    if not text:
        return None
    s = _strip_fences(text)
    for candidate in (s, s[s.find("{"): s.rfind("}") + 1] if "{" in s and "}" in s else ""):
        if not candidate:
            continue
        try:
            obj = json.loads(candidate)
            if isinstance(obj, dict):
                return obj
        except Exception:  # noqa: BLE001
            pass
    try:
        import json_repair  # type: ignore
        obj = json_repair.loads(s[s.find("{"):] if "{" in s else s)
        if isinstance(obj, dict) and obj:
            return obj
    except Exception:  # noqa: BLE001
        pass
    return None


def describe_reply(text: str) -> str:
    """One line for logs and the plan's error column: size, shape, head."""
    t = (text or "")
    head = t.strip()[:160].replace("\n", " ")
    tail = t.strip()[-40:].replace("\n", " ")
    return f"len={len(t)} starts={head!r} ends={tail!r}"
