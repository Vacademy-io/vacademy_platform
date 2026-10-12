"""Lesson mode — education videos built like a real class.

A lesson is a board that builds up while a teacher explains it. This module
holds the pure rules (no network, no ffmpeg) that every stage of the pipeline
consults when a run carries a lesson plan:

  * planner     — lesson pacing replaces the reel rhythm (sections of 6-20 s,
                  no 12-shot cap) and every shot gets a `teacher_layout`;
  * narration   — a teacher's voice instead of a narrator's;
  * per-shot    — the board keeps the teacher's part of the frame clear;
  * timeline    — the teacher overlay entries, one per run of sections that
                  share a layout.

The teacher itself is rendered by `lesson_teacher.py` (Spatius Video API).

Layouts, landscape 1920x1080 (portrait maps side/presenter to a bottom band):

  board      no teacher on screen
  corner     teacher cut out in the bottom-right corner over the board
  side       teacher panel on the right third, board on the left two thirds
  presenter  teacher panel on the right half — the hook and "why it matters" moments
"""
from __future__ import annotations

import html as _html
import re
from typing import Any, Dict, Iterable, List, Optional, Tuple

LAYOUTS: Tuple[str, ...] = ("board", "corner", "side", "presenter")
TEACHER_LAYOUTS: Tuple[str, ...] = ("corner", "side", "presenter")
LAYOUT_PREFERENCES: Tuple[str, ...] = ("auto",) + LAYOUTS

# Shot types whose content is dense enough that the board needs most of the
# frame — the teacher steps into the corner for these. TEXT_DIAGRAM is the
# everyday explanation shot, so it stays with the side panel by default.
_DENSE_TYPES = frozenset({
    "EQUATION_BUILD", "PROCESS_STEPS", "DATA_STORY", "INFOGRAPHIC_SVG",
    "ANNOTATION_MAP",
})

TEACHER_ENTRY_PREFIX = "snippet-teacher-"
TEACHER_Z = 500  # above shots (z≈10), below the watermark (1000) and branding
# Layouts whose board is a smaller canvas: the shot's timeline box is resized
# to the board area so its #shot-root lays out (and clips) inside it. Corner
# keeps the full frame — the teacher only covers a corner of it.
BOARD_RESIZED_LAYOUTS = ("side", "presenter")


# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────

def normalize_lesson_plan(raw: Any) -> Optional[Dict[str, Any]]:
    """Turn a request's `lesson` block (dict or pydantic model) into the plan
    dict the pipeline carries. None / disabled → None (lesson mode off)."""
    if raw is None:
        return None
    if hasattr(raw, "model_dump"):
        raw = raw.model_dump()
    if not isinstance(raw, dict) or not raw.get("enabled", True):
        return None
    teacher_raw = raw.get("teacher") or None
    teacher = None
    if isinstance(teacher_raw, dict) and str(teacher_raw.get("avatar_id") or "").strip():
        teacher = {
            "provider": "spatius",
            "avatar_id": str(teacher_raw["avatar_id"]).strip(),
            "name": (str(teacher_raw.get("name") or "").strip()[:60] or None),
            "title": (str(teacher_raw.get("title") or "").strip()[:60] or None),
        }
    layout = str(raw.get("layout") or "auto").strip().lower()
    if layout not in LAYOUT_PREFERENCES:
        layout = "auto"
    if teacher is None:
        layout = "board"
    subject = str(raw.get("subject") or "").strip()[:80] or None
    return {
        "enabled": True,
        "teacher": teacher,
        "layout": layout,
        "subject": subject,
        "worked_example": bool(raw.get("include_worked_example", raw.get("worked_example", True))),
        "recap": bool(raw.get("include_recap", raw.get("recap", True))),
    }


def has_teacher(plan: Optional[Dict[str, Any]]) -> bool:
    return bool(plan and plan.get("teacher") and plan["teacher"].get("avatar_id"))


# ─────────────────────────────────────────────────────────────────────────────
# Planner
# ─────────────────────────────────────────────────────────────────────────────

LESSON_RHYTHM_RULE = (
    "4. **LESSON PACING** — this is a LESSON, not a reel. A teacher explains while the board "
    "builds up; the viewer must have time to read, think and follow each step.\n"
    "   - A shot is one teaching SECTION: one idea, one step of a derivation, one worked-example "
    "step, or one recap point. Typical section 8-16 s; min 6 s; max 20 s.\n"
    "   - Hook (shot 0): 6-10 s — why this topic matters, posed as a question or a real-life case.\n"
    "   - Close (final shot): 8-14 s — recap of the 2-4 key takeaways.\n"
    "   - Shot count follows the content: roughly target_duration_s / 11 shots. There is NO "
    "12-shot cap in a lesson — a 10-minute lesson has ~50-60 sections.\n"
    "   - Within a section the board BUILDS: each sentence adds or highlights one element; it "
    "does not replace the board. Prefer EQUATION_BUILD / PROCESS_STEPS / TEXT_DIAGRAM / "
    "DATA_STORY / ANNOTATION_MAP / INFOGRAPHIC_SVG; use IMAGE_HERO only for a real-world example.\n"
    "   - Do NOT churn shot types for variety. Consecutive sections of one derivation keep the "
    "same shot type and visual language so the board feels continuous.\n"
    "   - `pacing_role`: use `hold` for derivation / worked-example steps, `breath` for hook, "
    "recap and transitions between concepts, `build` elsewhere. Avoid `hit`.\n"
)

_RHYTHM_START = "4. **RHYTHM PROFILE**"
_RHYTHM_END = "5. Total of all `duration_estimate_s`"


def planner_system_prompt(base: str) -> str:
    """Swap the reel rhythm rule for the lesson pacing rule. When the base
    prompt's wording drifts and the markers are gone, append an explicit
    override instead so the planner never runs a lesson on reel pacing."""
    start = base.find(_RHYTHM_START)
    end = base.find(_RHYTHM_END, start + 1) if start >= 0 else -1
    if start >= 0 and end > start:
        out = base[:start] + LESSON_RHYTHM_RULE + base[end:]
        return out.replace("RHYTHM PROFILE below", "LESSON PACING rule below")
    return base + (
        "\n\n## LESSON MODE OVERRIDE (wins over any rhythm / shot-count rule above)\n"
        + LESSON_RHYTHM_RULE
    )


def planner_user_block(plan: Dict[str, Any], *, target_duration_s: float, portrait: bool) -> str:
    """User-prompt block: lesson structure + the teacher_layout contract."""
    n_target = max(3, int(round(target_duration_s / 11.0)))
    parts: List[str] = [
        "",
        "LESSON MODE — this video is a lesson taught by a teacher at a board.",
        f"Plan about {n_target} teaching sections (target {target_duration_s:.0f}s ÷ ~11s).",
        "Structure, in order:",
        "  1. Hook — why it matters (a question, a real-life case, or a surprising fact).",
        "  2. Prerequisite check — one line recalling what the learner already knows (skip for very basic topics).",
        "  3. Concepts — one idea per section, simplest first; every term defined before it is used.",
    ]
    step = 4
    if plan.get("worked_example", True):
        parts.append(f"  {step}. Worked example — solve one representative problem step by step, one step per section.")
        step += 1
    parts.append(f"  {step}. Common mistake — one section on the most frequent misconception and how to avoid it.")
    step += 1
    if plan.get("recap", True):
        parts.append(f"  {step}. Recap — the 2-4 takeaways, as the final section.")
    if plan.get("subject"):
        parts.append(f"SUBJECT: {plan['subject']} — use the subject's own notation and conventions.")
    parts.append(
        "ACCURACY IS NON-NEGOTIABLE: every formula, number, unit and fact must be correct. "
        "Worked-example arithmetic must check out. Never invent data."
    )

    if has_teacher(plan):
        fixed = plan.get("layout") or "auto"
        if fixed != "auto":
            parts.append(
                f"TEACHER LAYOUT: fixed by the user — set `teacher_layout: \"{fixed}\"` on every shot."
            )
        else:
            parts.append(
                "TEACHER ON SCREEN: a real teacher (talking head) appears beside the board. On EVERY shot "
                "set `teacher_layout` to one of:\n"
                "  - \"presenter\": teacher fills half the frame; the board shows only a title / one key line. "
                "Use ONLY for the hook and short motivational or 'why it matters' moments — never for lists, "
                "recaps, steps or diagrams (the board half is too narrow).\n"
                "  - \"side\": teacher panel takes " + ("the bottom third" if portrait else "the right third")
                + "; the board uses the rest. Default for concept explanations and the recap.\n"
                "  - \"corner\": teacher is small in the bottom-right corner; the board gets almost the whole "
                "frame. Use for dense boards — derivations, worked-example steps, diagrams, data.\n"
                "  - \"board\": no teacher. Use rarely — only for a full-frame diagram that needs every pixel.\n"
                "Keep the layout steady across consecutive sections of one idea (no flip-flopping); change it "
                "when the lesson moves to a new phase."
            )
    else:
        parts.append("No on-screen teacher: set `teacher_layout: \"board\"` on every shot (or omit it).")
    return "\n".join(parts)


def default_layout_for(shot: Dict[str, Any], idx: int, n: int, plan: Dict[str, Any]) -> str:
    """Deterministic fallback when the planner omitted or garbled a layout."""
    if not has_teacher(plan):
        return "board"
    fixed = plan.get("layout") or "auto"
    if fixed != "auto":
        return fixed
    role = str(shot.get("intent_role") or "").lower()
    # Presenter leaves a half-frame board — fine for a hook's one line, too
    # narrow for a recap list (a prod recap collapsed to one-letter columns).
    if idx == 0 or role == "hook":
        return "presenter"
    if str(shot.get("shot_type") or "").upper() in _DENSE_TYPES:
        return "corner"
    return "side"


def apply_layouts(shots: List[Dict[str, Any]], plan: Optional[Dict[str, Any]]) -> Dict[str, int]:
    """Validate / fill `teacher_layout` on every shot in place. A user-fixed
    layout always wins over the planner's choice. Returns layout counts."""
    counts: Dict[str, int] = {k: 0 for k in LAYOUTS}
    if not plan:
        return counts
    n = len(shots)
    fixed = plan.get("layout") or "auto"
    teacher = has_teacher(plan)
    for i, shot in enumerate(shots):
        if not isinstance(shot, dict):
            continue
        chosen = str(shot.get("teacher_layout") or "").strip().lower()
        if not teacher:
            chosen = "board"
        elif fixed != "auto":
            chosen = fixed
        elif chosen not in LAYOUTS:
            chosen = default_layout_for(shot, i, n, plan)
        shot["teacher_layout"] = chosen
        counts[chosen] += 1
    return counts


# ─────────────────────────────────────────────────────────────────────────────
# Narration
# ─────────────────────────────────────────────────────────────────────────────

TEACHER_VOICE_BLOCK = (
    "\n\n## LESSON MODE — YOU ARE THE TEACHER (overrides any narrator / marketing voice above)\n"
    "Write as one warm, clear teacher speaking to one learner, not as a narrator or an ad.\n"
    "- Teach step by step: say what you are about to show, show it, then say what it means.\n"
    "- Point at the board in words: \"look at this term\", \"notice the right angle here\", "
    "\"this is the step most students skip\".\n"
    "- Define every term the first time you use it. One idea per sentence. Plain words over jargon.\n"
    "- In the worked example, say each step and WHY it is allowed; read every number out loud.\n"
    "- Occasionally ask the learner to think (\"pause and try the next step\") — then answer.\n"
    "- No hype, no slogans, no 'game-changer'. Encouraging, never condescending.\n"
    "- Every formula, number and fact must be correct; when unsure, say less rather than guess.\n"
)


# ─────────────────────────────────────────────────────────────────────────────
# Geometry
# ─────────────────────────────────────────────────────────────────────────────

def teacher_box(layout: str, width: int, height: int) -> Optional[Dict[str, int]]:
    """The frame region the teacher overlay occupies (x, y, w, h), or None."""
    if layout not in TEACHER_LAYOUTS:
        return None
    portrait = height > width
    if layout == "corner":
        if portrait:
            w, h = _even(width * 0.40), _even(height * 0.26)
        else:
            w, h = _even(width * 0.30), _even(height * 0.555)
        return {"x": width - w - _even(width * 0.008), "y": height - h, "w": w, "h": h}
    if portrait:
        frac = 0.32 if layout == "side" else 0.5
        h = _even(height * frac)
        return {"x": 0, "y": height - h, "w": width, "h": h}
    frac = 1.0 / 3.0 if layout == "side" else 0.5
    w = _even(width * frac)
    return {"x": width - w, "y": 0, "w": w, "h": height}


def clip_size(layout: str, width: int, height: int) -> Optional[Tuple[int, int]]:
    """Pixel size of the teacher video inside its box."""
    box = teacher_box(layout, width, height)
    if box is None:
        return None
    bw, bh = box["w"], box["h"]
    if layout == "corner":
        return bw, bh
    if bh > bw * 1.2 and width > height:  # landscape side panel: portrait 3:4 teacher at the bottom
        cw = bw
        ch = _even(min(bh * 0.80, cw * 4 / 3))
        return cw, ch
    # bands (portrait) and the presenter half: teacher fills the band height
    ch = bh
    cw = _even(min(bw, ch * (0.75 if height > width else 0.9)))
    return cw, ch


def safe_area_text(layout: str, width: int, height: int) -> str:
    box = teacher_box(layout, width, height)
    if box is None:
        return ""
    x0, y0 = box["x"], box["y"]
    if layout == "corner":
        mx, my = x0 - 24, y0 - 24
        return (f"the bottom-right corner — every pixel with x ≥ {mx}px AND y ≥ {my}px "
                f"(a {width - mx}×{height - my}px box)")
    if height > width:
        return f"the bottom band — every pixel with y ≥ {y0 - 16}px"
    return f"the right part of the frame — every pixel with x ≥ {x0 - 16}px"


def board_area(layout: str, width: int, height: int) -> Dict[str, int]:
    box = teacher_box(layout, width, height)
    if box is None or layout == "corner":
        return {"x": 0, "y": 0, "w": width, "h": height}
    if height > width:
        return {"x": 0, "y": 0, "w": width, "h": box["y"]}
    return {"x": 0, "y": 0, "w": box["x"], "h": height}


# ─────────────────────────────────────────────────────────────────────────────
# Per-shot HTML prompt block
# ─────────────────────────────────────────────────────────────────────────────

def shot_prompt_block(plan: Dict[str, Any], layout: Optional[str], width: int, height: int) -> str:
    layout = layout if layout in LAYOUTS else "board"
    lines = [
        "\n\n## 🧑‍🏫 LESSON BOARD — this shot is one section of a taught lesson",
        "- The frame is a TEACHING BOARD: clean, calm, high-contrast, generous spacing. No decorative "
        "clutter, no stock-photo backgrounds behind text, no marketing styling.",
        "- BUILD UP, don't replace: reveal each element exactly when the narration reaches it "
        "(use the word timings) and KEEP earlier elements visible — dim them (opacity ~0.45) rather than "
        "removing them, and highlight the element currently being explained (accent colour, underline, "
        "circle, arrow).",
        "- Maths / science: typeset formulas with KaTeX; show a derivation as aligned lines, one new line "
        "per narrated step; label diagram parts; units on every quantity.",
        "- Every formula, number and label must be correct and match the narration exactly.",
        "- Text sizes for a learner: headings ≥ 52px, body ≥ 34px, formulas ≥ 44px "
        "(on 1920×1080; scale proportionally on other canvases).",
    ]
    if plan.get("subject"):
        lines.append(f"- Subject: {plan['subject']} — use its standard notation, symbols and units.")
    if layout in TEACHER_LAYOUTS:
        area = board_area(layout, width, height)
        lines += [
            "",
            f"**TEACHER SAFE AREA — layout `{layout}`**: a live teacher video is composited ON TOP of "
            f"{safe_area_text(layout, width, height)}. Anything you place there will be hidden behind the teacher.",
        ]
        if layout in BOARD_RESIZED_LAYOUTS:
            lines.append(
                f"- **This shot's canvas is {area['w']}×{area['h']}px, not {width}×{height}.** `#shot-root` "
                f"is exactly the board area; lay everything out for {area['w']}px of width "
                "(percent / flex / grid layouts, no fixed x-positions beyond it)."
            )
        lines += [
            f"- Put ALL board content inside x ∈ [0, {area['w']}]px, y ∈ [0, {area['h']}]px"
            + (" and outside the bottom-right corner box." if layout == "corner" else "."),
            "- Keep the background in the teacher area plain (the same board background) — no text, "
            "images, diagrams or animated elements there.",
            "- Do NOT draw a person, avatar, face or presenter yourself — the real teacher is added later.",
        ]
        if layout == "presenter":
            lines.append(
                "- `presenter` sections are about the teacher speaking: show only a short title and at most "
                "one key line / formula on the board half."
            )
    return "\n".join(lines) + "\n"


# ─────────────────────────────────────────────────────────────────────────────
# Timeline: group sections into teacher runs, build overlay entries
# ─────────────────────────────────────────────────────────────────────────────

_SHOT_ID = re.compile(r"^shot-(\d+)(?:-sub\d+)?$")


def shot_index_of(entry: Dict[str, Any]) -> Optional[int]:
    m = _SHOT_ID.match(str(entry.get("id") or ""))
    if m:
        return int(m.group(1))
    idx = entry.get("shot_idx")
    return int(idx) if isinstance(idx, int) else None


def teacher_runs(
    entries: Iterable[Dict[str, Any]],
    layout_by_shot: Dict[int, str],
    *,
    join_gap_s: float = 0.25,
) -> List[Dict[str, Any]]:
    """Contiguous stretches of the timeline that share one teacher layout.

    `entries` are timeline entries (absolute inTime/exitTime). Shots without a
    teacher layout (or "board") break a run. Overlay entries that share a
    shot's time are folded into that shot's run."""
    spans: List[Tuple[float, float, str]] = []
    for e in entries:
        si = shot_index_of(e)
        if si is None:
            continue
        lay = layout_by_shot.get(si) or "board"
        try:
            t0, t1 = float(e.get("inTime", 0.0)), float(e.get("exitTime", 0.0))
        except (TypeError, ValueError):
            continue
        if t1 <= t0:
            continue
        spans.append((t0, t1, lay))
    spans.sort(key=lambda s: (s[0], s[1]))

    runs: List[Dict[str, Any]] = []
    for t0, t1, lay in spans:
        if runs and t0 <= runs[-1]["end"] - 1e-6 and runs[-1]["layout"] != lay:
            # Overlapping entry (overlay / sub-shot) with a different layout —
            # the earlier, primary section wins the overlap.
            if t1 > runs[-1]["end"]:
                t0 = runs[-1]["end"]
            else:
                continue
        if runs and runs[-1]["layout"] == lay and t0 <= runs[-1]["end"] + join_gap_s:
            runs[-1]["end"] = max(runs[-1]["end"], t1)
            continue
        runs.append({"layout": lay, "start": t0, "end": t1})
    return [r for r in runs if r["layout"] in TEACHER_LAYOUTS and r["end"] - r["start"] >= 0.2]


def panel_colors(palette: Optional[Dict[str, Any]]) -> Dict[str, str]:
    """Panel background / text colours derived from the run's board palette."""
    bg = _hex((palette or {}).get("background")) or "#FBFAF6"
    text = _hex((palette or {}).get("text")) or "#1F2A44"
    muted = _hex((palette or {}).get("text_secondary")) or "#6B7280"
    accent = _hex((palette or {}).get("accent")) or _hex((palette or {}).get("primary")) or "#E8833A"
    return {
        "panel": _mix(bg, text, 0.06),
        "border": _mix(bg, text, 0.14),
        "text": text,
        "muted": muted,
        "accent": accent,
    }


def teacher_entry_html(
    *,
    layout: str,
    clip_url: str,
    width: int,
    height: int,
    teacher: Optional[Dict[str, Any]],
    palette: Optional[Dict[str, Any]] = None,
) -> str:
    box = teacher_box(layout, width, height)
    size = clip_size(layout, width, height)
    if box is None or size is None:
        return ""
    cw, ch = size
    colors = panel_colors(palette)
    url = _html.escape(clip_url, quote=True)
    name = _html.escape(str((teacher or {}).get("name") or ""))
    title = _html.escape(str((teacher or {}).get("title") or ""))
    font = "font-family:Inter,'Segoe UI',system-ui,-apple-system,sans-serif;"
    video = (
        f'<video class="lesson-teacher" src="{url}" autoplay muted playsinline preload="auto" '
        f'style="position:absolute;width:{cw}px;height:{ch}px;object-fit:fill;'
        + ("right:0;bottom:0;" if layout == "corner" else
           f"left:{(box['w'] - cw) // 2 if box['h'] >= box['w'] or layout == 'presenter' else box['w'] - cw}px;bottom:0;")
        + '"></video>'
    )
    if layout == "corner":
        label = ""
        if name:
            label = (
                f'<div style="position:absolute;left:0;bottom:{_even(box["h"] * 0.06)}px;padding:6px 14px;'
                f'border-radius:999px;background:{colors["panel"]};border:1px solid {colors["border"]};'
                f'color:{colors["text"]};{font}'
                f'font-size:{max(14, int(height * 0.017))}px;font-weight:600;'
                f'box-shadow:0 4px 14px rgba(0,0,0,.12);">{name}</div>'
            )
        return f'<div style="position:absolute;inset:0;overflow:hidden;pointer-events:none;">{video}{label}</div>'

    portrait = height > width
    edge = "border-top" if portrait else "border-left"
    label = ""
    if name or title:
        fs = max(18, int(min(width, height) * 0.028))
        label = (
            f'<div style="position:absolute;left:{_even(box["w"] * 0.06)}px;top:{_even(box["h"] * 0.05)}px;'
            f'right:{_even(box["w"] * 0.06)}px;{font}">'
            + (f'<div style="font-size:{fs}px;font-weight:700;color:{colors["text"]};line-height:1.2;">{name}</div>' if name else "")
            + (f'<div style="margin-top:6px;font-size:{int(fs * 0.68)}px;color:{colors["muted"]};">{title}</div>' if title else "")
            + f'<div style="margin-top:12px;width:56px;height:5px;border-radius:3px;background:{colors["accent"]};"></div>'
            + "</div>"
        )
    return (
        f'<div style="position:absolute;inset:0;overflow:hidden;pointer-events:none;'
        f'background:{colors["panel"]};{edge}:1px solid {colors["border"]};">{label}{video}</div>'
    )


def build_teacher_entries(
    runs: List[Dict[str, Any]],
    clip_urls: List[Optional[str]],
    *,
    width: int,
    height: int,
    teacher: Optional[Dict[str, Any]],
    palette: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for k, (run, url) in enumerate(zip(runs, clip_urls)):
        if not url:
            continue
        box = teacher_box(run["layout"], width, height)
        html_str = teacher_entry_html(
            layout=run["layout"], clip_url=url, width=width, height=height,
            teacher=teacher, palette=palette,
        )
        if not box or not html_str:
            continue
        out.append({
            "id": f"{TEACHER_ENTRY_PREFIX}{k}",
            "inTime": round(float(run["start"]), 3),
            "exitTime": round(float(run["end"]), 3),
            "htmlStartX": box["x"],
            "htmlStartY": box["y"],
            "htmlEndX": box["x"] + box["w"],
            "htmlEndY": box["y"] + box["h"],
            "html": html_str,
            "z": TEACHER_Z,
            "entry_meta": {
                "kind": "lesson_teacher",
                "layout": run["layout"],
                "caption_box": caption_box(run["layout"], width, height),
            },
        })
    return out


def caption_box(layout: str, width: int, height: int) -> Optional[Dict[str, int]]:
    """Where burned-in captions may sit while this layout's teacher is on
    screen: the board side of the frame (landscape) or above the teacher band
    (portrait). Read by generate_video.py from the teacher entry_meta."""
    box = teacher_box(layout, width, height)
    if box is None:
        return None
    if height > width and layout in BOARD_RESIZED_LAYOUTS:
        return {"x": 0, "w": width, "bottom": box["h"] + _even(height * 0.02)}
    return {"x": 0, "w": max(_even(width * 0.3), box["x"] - _even(width * 0.0125))}


def fit_shots_to_board(
    entries: List[Dict[str, Any]],
    runs: List[Dict[str, Any]],
    clip_urls: List[Optional[str]],
    *,
    width: int,
    height: int,
) -> int:
    """Resize shot entries inside side/presenter runs (that got a teacher
    clip) to the board area. Returns how many entries were resized."""
    spans = [
        (float(r["start"]), float(r["end"]), r["layout"])
        for r, u in zip(runs, clip_urls) if u and r["layout"] in BOARD_RESIZED_LAYOUTS
    ]
    n = 0
    for e in entries:
        if shot_index_of(e) is None:
            continue
        try:
            t0, t1 = float(e.get("inTime", 0)), float(e.get("exitTime", 0))
        except (TypeError, ValueError):
            continue
        mid = (t0 + t1) / 2.0
        hit = next((lay for s0, s1, lay in spans if s0 - 1e-3 <= mid <= s1 + 1e-3), None)
        if not hit:
            continue
        area = board_area(hit, width, height)
        e["htmlStartX"], e["htmlStartY"] = area["x"], area["y"]
        e["htmlEndX"], e["htmlEndY"] = area["x"] + area["w"], area["y"] + area["h"]
        n += 1
    return n


# ─────────────────────────────────────────────────────────────────────────────
# helpers
# ─────────────────────────────────────────────────────────────────────────────

def _even(v: float) -> int:
    n = int(round(v))
    return n - (n % 2)


def _hex(v: Any) -> Optional[str]:
    s = str(v or "").strip()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", s):
        return s.upper()
    if re.fullmatch(r"#[0-9a-fA-F]{3}", s):
        return "#" + "".join(c * 2 for c in s[1:]).upper()
    return None


def _mix(a: str, b: str, t: float) -> str:
    ra, ga, ba = (int(a[i:i + 2], 16) for i in (1, 3, 5))
    rb, gb, bb = (int(b[i:i + 2], 16) for i in (1, 3, 5))
    m = lambda x, y: max(0, min(255, int(round(x + (y - x) * t))))  # noqa: E731
    return "#{:02X}{:02X}{:02X}".format(m(ra, rb), m(ga, gb), m(ba, bb))
