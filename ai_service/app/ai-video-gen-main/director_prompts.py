"""
Director Stage Prompts — the "film director" for the video pipeline.

The Director receives the full script, beat outline, and word timestamps, then
produces a shot-by-shot plan specifying which shot type, visual approach,
animation strategy, and sync points each shot should use.

The HTML generation stage then executes each shot independently with a focused
prompt containing only the documentation for that specific shot type.
"""
from __future__ import annotations

from typing import Dict, List, Any, Optional, Tuple
import json
import re

from prompts import TOPIC_SHOT_PROFILES


# ---------------------------------------------------------------------------
# Emphasis map — detects natural breakpoints and stress peaks in narration
# ---------------------------------------------------------------------------

def build_emphasis_map(words: List[Dict[str, Any]]) -> str:
    """Build a condensed 'emphasis map' the Director can anchor shots on.

    Detects:
    - Silence gaps >0.4s (natural breakpoints — great shot boundaries)
    - Long/key words (>6 chars) that the narrator likely stresses
    - Sentence starts (words following ., !, ? in the preceding word)
    - First and last words (always anchors)

    Returns a short markdown block; empty string if input has <5 words.
    """
    if not words or len(words) < 5:
        return ""

    gaps: List[Tuple[float, str]] = []   # (time, word_after_gap)
    peaks: List[Tuple[float, str]] = []  # (time, stressed_word)
    sentence_starts: List[Tuple[float, str]] = []

    prev_end = 0.0
    prev_word_text = ""
    for w in words:
        try:
            start = float(w.get("start", 0.0))
            end = float(w.get("end", start))
        except (TypeError, ValueError):
            continue
        word_text = str(w.get("word", "")).strip()
        if not word_text:
            continue
        gap = start - prev_end
        if gap >= 0.4 and prev_end > 0:
            gaps.append((start, word_text))
        if re.search(r'[.!?]$', prev_word_text or ""):
            sentence_starts.append((start, word_text))
        # Stress heuristic: long word OR all-caps (>3 letters)
        if len(word_text) >= 7 or (len(word_text) > 3 and word_text.isupper()):
            peaks.append((start, word_text))
        prev_end = end
        prev_word_text = word_text

    def _fmt(pairs: List[Tuple[float, str]], limit: int) -> str:
        return ", ".join(f"{t:.1f}s '{w}'" for t, w in pairs[:limit]) or "(none)"

    lines = [
        "EMPHASIS MAP (anchor key shots here):",
        f"- Silence breakpoints (≥0.4s pauses — natural shot boundaries): {_fmt(gaps, 12)}",
        f"- Stress peaks (long/emphatic words): {_fmt(peaks, 12)}",
        f"- Sentence starts: {_fmt(sentence_starts, 10)}",
    ]
    return "\n".join(lines)

# ---------------------------------------------------------------------------
# Director system prompt — concise catalog + rules
# ---------------------------------------------------------------------------

DIRECTOR_SYSTEM_PROMPT = (
    "You are the Director of an educational explainer video. "
    "You receive a complete script with beat outline and word timestamps. "
    "Your job is to produce a detailed shot-by-shot plan that a Visual Designer will execute.\n\n"

    "You decide:\n"
    "1. How many shots total (typically 2-4 per beat depending on duration)\n"
    "2. Which SHOT TYPE each shot uses (from the catalog below)\n"
    "3. What the visual content should be (specific elements, layout approach)\n"
    "4. When each shot starts/ends (using word timestamps for precision)\n"
    "5. Animation strategy and sync points with the narration\n"
    "6. Image/video prompts for shots that need them\n\n"

    "**SHOT TYPE CATALOG** (choose from these):\n"
    "- **IMAGE_HERO**: Full-screen image with Ken Burns zoom + text overlay. "
    "For hooks, real-world examples, dramatic moments. Needs `image_prompt`.\n"
    "- **VIDEO_HERO**: Full-screen stock video + text overlay. PREFERRED over IMAGE_HERO for real-world topics. "
    "Needs `video_query` (Pexels search terms).\n"
    "- **IMAGE_SPLIT**: Image on one side, text on the other. "
    "For explanations with visual reference. Needs `image_prompt`.\n"
    "- **TEXT_DIAGRAM**: Text + SVG/Mermaid diagram on clean background. "
    "The default for explanations, code, math, processes.\n"
    "- **LOWER_THIRD**: Key term banner at bottom of screen. "
    "Can overlay other shots (set `overlay: true`). For vocabulary, definitions.\n"
    "- **ANNOTATION_MAP**: Full-screen image with animated SVG arrows + labels. "
    "For anatomy, geography, labeled diagrams. Needs `image_prompt` with 'unlabeled, no text'.\n"
    "- **DATA_STORY**: Animated bar/line chart. "
    "Only when narration mentions specific numbers/statistics.\n"
    "- **PROCESS_STEPS**: Sequential numbered nodes with animated connectors. "
    "For algorithms, workflows, step-by-step processes (3-5 steps per shot).\n"
    "- **EQUATION_BUILD**: KaTeX equation terms revealing sequentially. "
    "For math formulas, physics laws, chemical equations.\n"
    "- **ANIMATED_ASSET**: Cutout images with transparent backgrounds + GSAP animation. "
    "For floating objects (molecules, planets, tools). Needs `image_prompt` with cutout instructions.\n"
    "- **KINETIC_TEXT**: Words appear exactly when spoken — pipeline-built, 100% accurate sync. "
    "Use for hooks, conclusions, key emphasis moments. No image/video needed.\n"
    "- **PRODUCT_HERO**: Single hero product/subject anchored center-stage. Background layers (solid color → halftone texture → geometric watermark → bold color) crossfade behind the subject via GSAP opacity. "
    "Badge (flat colored rect), tracking labels, and slam text orbit the subject. Use for product showcases, brand reels, origin stories. "
    "Needs `image_prompt` with cutout instructions.\n"
    "- **INFOGRAPHIC_SVG**: Pure SVG diagram/illustration that draws itself on screen via `stroke-dashoffset`. "
    "Courts, anatomy, process flows, maps, how-to mechanics. Uses its own cream+grid canvas — "
    "pick this for any beat that can be drawn rather than photographed. No photos — everything is drawn.\n"
    "- **KINETIC_TITLE**: Full-screen bold typography. Single phrase, word-wipe reveal (translateY 100%→0%), "
    "one accent-color word. Hooks, section headers ('1. THE PASS'), outros. "
    "Works as a hard cut between style worlds (e.g. from a photo-hero act into an illustrated infographic act).\n"
    "- **SOURCE_CLIP**: Play a clip from the user's uploaded source video. The original footage "
    "(speaker, screen recording, demo) plays as the background with HTML overlays on top. "
    "Use for key quotes, soundbites, demo highlights — any moment where showing the real footage "
    "is more impactful than AI graphics. Specify `source_start` and `source_end` (seconds in the "
    "source video). No `image_prompt` or `video_query` needed. ONLY available when source video context is provided.\n\n"

    "**RULES**:\n"
    "1. First shot is the hook — pick whichever shot type sells the topic best "
    "(VIDEO_HERO / IMAGE_HERO for real-world openers, KINETIC_TITLE for bold-text hooks, "
    "INFOGRAPHIC_SVG for concept-first openers, PRODUCT_HERO for brand/subject reels).\n"
    "2. Never use the same shot type 3 times in a row.\n"
    "3. Follow the topic image_ratio guidance provided.\n"
    "4. Each shot: 2-5 seconds (reel/short-form pace). For portrait/9:16, aim for 2-4 seconds per shot. "
    "Longer than 5s only for shots with heavy in-shot motion (PROCESS_STEPS, EQUATION_BUILD, DATA_STORY). "
    "Split any content that would need longer.\n"
    "5. Shots must cover 100% of the narration timeline with NO gaps.\n"
    "6. Total of all shot durations must equal the audio duration.\n"
    "7. LOWER_THIRD can overlap other shots (mark `overlay: true`).\n"
    "8. For cutout images (ANIMATED_ASSET), always specify 'isolated on solid [color] background, no other objects, clean edges'.\n"
    "9. `start_word` must be the first 3-5 words of the narration at that timestamp.\n"
    "10. Prefer VIDEO_HERO over IMAGE_HERO when topic has real-world visual component.\n"
    "11. KINETIC_TEXT must appear at most once per video and never back-to-back with another KINETIC_TEXT.\n"
    "12. **You own the visual style.** You decide the theme, background, and animation language for each shot — "
    "and whether they stay consistent or shift across the timeline. Coherence is usually good "
    "(matching shot families within an act), but a long video CAN change worlds between acts "
    "(e.g. photo hero → illustrated infographic → product hero outro) as long as each transition "
    "feels intentional. Use KINETIC_TITLE or a hard cut between shots to mark act changes.\n\n"

    "**TRANSITION_IN** (required for every shot — pick exactly one):\n"
    "- `\"cut\"` — instant. KINETIC_TEXT (always), fast reels back-to-back shots.\n"
    "- `\"fade\"` — opacity 0→1, 0.4s. Default for education content, reflective beats.\n"
    "- `\"slide_right\"` — slides in from left. Narrative forward movement.\n"
    "- `\"slide_left\"` — slides in from right. Going back/revisiting. Use sparingly.\n"
    "- `\"slide_up\"` — rises from below. Topic elevation, list reveals.\n"
    "- `\"zoom_in\"` — scale 0.85→1.0. KINETIC_TITLE (always), key concept hooks.\n"
    "- `\"zoom_out\"` — scale 1.15→1.0. Revealing larger context.\n"
    "- `\"wipe_right\"` — clip-path sweeps from left. After topic-break beats, act transitions.\n"
    "Non-negotiable: KINETIC_TEXT → `cut`. KINETIC_TITLE → `zoom_in`. "
    "After KINETIC_TITLE → next shot uses `wipe_right`. Reels → prefer `cut`/`slide_right`. "
    "Education → prefer `fade`/`slide_up`. Default: `fade`.\n\n"

    "Return JSON only. No markdown, no commentary. "
    "The first character of your response must be `{` and the last must be `}`.\n\n"

    "**OUTPUT ENVELOPE — NON-NEGOTIABLE**:\n"
    "Your response MUST be a JSON object with a top-level `shots` array, even if the video "
    "only has one shot. Example: `{\"shots\": [{...}, {...}], \"continuity_notes\": \"...\"}`.\n"
    "DO NOT return a bare shot object like `{\"shot_index\": 0, \"shot_type\": ...}` — "
    "this is wrong. ALWAYS wrap your shot(s) in `{\"shots\": [...]}`.\n"
    "DO NOT return a bare list like `[{...}, {...}]` — wrap it in `{\"shots\": [...]}`.\n"
)


# ---------------------------------------------------------------------------
# Super Ultra extension — few-shot examples + shot_density self-report
# ---------------------------------------------------------------------------

SUPER_ULTRA_DIRECTOR_EXTENSION = (
    "\n\n**🎓 FEW-SHOT EXAMPLES — STUDY THESE BEFORE PLANNING**:\n\n"

    "**Example 1 — Travel reel (9:16 portrait, 30s, fast density)**:\n"
    "Script: 'Tokyo at night hits different. Neon alleys, ramen steam, 24-hour arcades. "
    "Book the red-eye flight.'\n"
    "Plan (6 shots):\n"
    "```json\n"
    "{\n"
    '  "shots": [\n'
    '    {"shot_index":0,"shot_type":"VIDEO_HERO","start_time":0.0,"end_time":4.0,'
    '"narration_excerpt":"Tokyo at night hits different.",'
    '"video_query":"tokyo shibuya crossing night neon 4k",'
    '"animation_strategy":"0.0s video crossfades in, 0.4s title splitReveal \\"TOKYO\\" (Bebas 10rem), 1.2s subtitle fadeIn, 3.0s ken-burns zoom starts",'
    '"transition_in":"zoom_in"},\n'
    '    {"shot_index":1,"shot_type":"VIDEO_HERO","start_time":4.0,"end_time":9.0,'
    '"narration_excerpt":"Neon alleys,",'
    '"video_query":"tokyo shinjuku alley neon signs",'
    '"animation_strategy":"0.0s cut, 0.2s label wipe \\"NEON ALLEYS\\", 1.5s accent underline draws under label",'
    '"transition_in":"cut"},\n'
    '    {"shot_index":2,"shot_type":"VIDEO_HERO","start_time":9.0,"end_time":14.0,'
    '"narration_excerpt":"ramen steam,",'
    '"video_query":"ramen bowl steam rising close up cinematic",'
    '"transition_in":"slide_right"},\n'
    '    {"shot_index":3,"shot_type":"KINETIC_TEXT","start_time":14.0,"end_time":19.0,'
    '"narration_excerpt":"24-hour arcades.",'
    '"animation_strategy":"words appear when spoken, final word \\"arcades\\" in accent color with scale pulse",'
    '"transition_in":"cut"},\n'
    '    {"shot_index":4,"shot_type":"VIDEO_HERO","start_time":19.0,"end_time":25.0,'
    '"narration_excerpt":"Book the",'
    '"video_query":"airplane window view sunrise clouds",'
    '"transition_in":"slide_right"},\n'
    '    {"shot_index":5,"shot_type":"KINETIC_TITLE","start_time":25.0,"end_time":30.0,'
    '"narration_excerpt":"red-eye flight.",'
    '"text_elements":["RED-EYE","FLIGHT"],'
    '"animation_strategy":"translateY wipe reveal, \\"RED-EYE\\" in accent, \\"FLIGHT\\" in primary",'
    '"transition_in":"zoom_in"}\n'
    '  ],\n'
    '  "shot_density": "fast",\n'
    '  "pacing_rationale": "30s travel reel with punchy visuals — every sentence gets its own cinematic shot; KINETIC_TEXT breaks up video to prevent monotony; outro is bold typography for shareability",\n'
    '  "continuity_notes": "Keep the neon color temperature across all video shots; accent color is electric pink to match signage"\n'
    "}\n"
    "```\n\n"

    "**Example 2 — Physics explainer (16:9 landscape, 45s, medium density)**:\n"
    "Script: 'Newton's second law says force equals mass times acceleration. Push a shopping "
    "cart twice as hard, it accelerates twice as fast. This is why F1 cars shed weight: less "
    "mass means more acceleration for the same engine force.'\n"
    "Plan (9 shots — notice the EQUATION_BUILD gets a longer 7s hold because it has heavy internal motion):\n"
    "```json\n"
    "{\n"
    '  "shots": [\n'
    '    {"shot_index":0,"shot_type":"IMAGE_HERO","start_time":0.0,"end_time":4.0,'
    '"narration_excerpt":"Newton\'s second law",'
    '"image_prompt":"portrait of Isaac Newton, cinematic lighting, dark background","animation_strategy":"slow zoom Ken Burns, title splitReveal \\"NEWTON\'S 2ND LAW\\" at 0.5s",'
    '"transition_in":"zoom_in"},\n'
    '    {"shot_index":1,"shot_type":"EQUATION_BUILD","start_time":4.0,"end_time":11.0,'
    '"narration_excerpt":"force equals mass times acceleration.",'
    '"text_elements":["F = ma"],'
    '"animation_strategy":"0.0s \\"F\\" scale-in from 3x, 0.8s \\"=\\" slides left, 1.6s \\"m\\" scale-in, 2.4s \\"a\\" scale-in, 3.5s each term gets a color-coded label (force/mass/accel) fading in beneath",'
    '"transition_in":"fade"},\n'
    '    {"shot_index":2,"shot_type":"ANIMATED_ASSET","start_time":11.0,"end_time":15.0,'
    '"narration_excerpt":"Push a shopping cart",'
    '"image_prompt":"shopping cart cutout, isolated on solid white background, side view, clean edges",'
    '"animation_strategy":"cart slides in from left, cartoon push motion lines draw in behind it",'
    '"transition_in":"slide_right"},\n'
    '    {"shot_index":3,"shot_type":"TEXT_DIAGRAM","start_time":15.0,"end_time":19.0,'
    '"narration_excerpt":"twice as hard, it accelerates twice as fast.",'
    '"animation_strategy":"two side-by-side cart diagrams draw in (SVG), force arrows grow sequentially, speed meter counter runs 0→20→40mph",'
    '"transition_in":"slide_up"},\n'
    '    {"shot_index":4,"shot_type":"KINETIC_TEXT","start_time":19.0,"end_time":23.0,'
    '"narration_excerpt":"This is why F1 cars",'
    '"animation_strategy":"pipeline-built word sync",'
    '"transition_in":"cut"},\n'
    '    {"shot_index":5,"shot_type":"VIDEO_HERO","start_time":23.0,"end_time":28.0,'
    '"narration_excerpt":"shed weight:",'
    '"video_query":"formula 1 pit crew removing parts slow motion",'
    '"transition_in":"slide_right"},\n'
    '    {"shot_index":6,"shot_type":"DATA_STORY","start_time":28.0,"end_time":35.0,'
    '"narration_excerpt":"less mass means more acceleration",'
    '"animation_strategy":"bar chart draws in showing 3 cars with descending mass and ascending 0-60 times, counter-rolls on each bar",'
    '"transition_in":"slide_up"},\n'
    '    {"shot_index":7,"shot_type":"TEXT_DIAGRAM","start_time":35.0,"end_time":41.0,'
    '"narration_excerpt":"for the same engine force.",'
    '"animation_strategy":"F = ma equation returns, this time with F held constant (locked icon), mass shrinks, acceleration grows — live demonstration",'
    '"transition_in":"wipe_right"},\n'
    '    {"shot_index":8,"shot_type":"KINETIC_TITLE","start_time":41.0,"end_time":45.0,'
    '"narration_excerpt":"(outro)",'
    '"text_elements":["LESS MASS.","MORE SPEED."],'
    '"animation_strategy":"two-line wipe reveal, \\"MORE SPEED\\" in accent color",'
    '"transition_in":"zoom_in"}\n'
    '  ],\n'
    '  "shot_density": "medium",\n'
    '  "pacing_rationale": "Physics needs visual proofs — the EQUATION_BUILD gets 7s because its internal animation (term-by-term reveal + labels) carries the motion; short cutaways in between keep tempo up",\n'
    '  "continuity_notes": "Primary = #1e40af (physics blue), accent = #f59e0b (F1 orange); maintain this palette across all shots"\n'
    "}\n"
    "```\n\n"

    "**📊 SHOT DENSITY SELF-REPORT (REQUIRED)**:\n"
    "Add these two fields to your top-level JSON (alongside `shots` and `continuity_notes`):\n"
    "- `shot_density`: one of `\"fast\"` (≤2.5s avg), `\"medium\"` (2.5-4s avg), `\"slow\"` (≥4s avg)\n"
    "- `pacing_rationale`: one-sentence justification for the density you chose, referencing "
    "the content type (e.g. \"fast because travel reels need constant visual stimulation\", "
    "\"medium because physics needs visual proof time on each equation\").\n"
    "These let the pipeline validate your pacing against the content — if you say 'fast' but "
    "return 8-second shots, something is off.\n"
)


# ---------------------------------------------------------------------------
# Two-pass Director — Act planner (runs before shot planner in super_ultra)
# ---------------------------------------------------------------------------

ACT_PLANNER_SYSTEM_PROMPT = (
    "You are the narrative architect for an educational video pipeline. "
    "Before any shots are planned, you divide the video into 2-5 ACTS — narrative "
    "beats that each hold a single emotional/informational purpose. This lets the "
    "downstream Shot Planner expand each act into shots with a clear sense of flow.\n\n"

    "Think of acts like a film's structure:\n"
    "- Act 1 (HOOK): cinematic opener that establishes the subject and stakes.\n"
    "- Middle acts (DEVELOP): each advances ONE idea. Don't cram two topics into an act.\n"
    "- Last act (LAND): payoff, call-to-action, or memorable outro.\n\n"

    "For each act, decide:\n"
    "1. `label` — a short name (\"Opening Hook\", \"The Physics\", \"Real-World Proof\").\n"
    "2. `start_time` / `end_time` — the narration range this act covers.\n"
    "3. `narration_excerpt` — the exact script text for this act.\n"
    "4. `style_direction` — what visual world this act lives in. "
    "Options: \"cinematic_photo\" (stock video / hero images), \"illustrated_infographic\" "
    "(pure SVG cream canvas), \"product_stage\" (fixed hero subject with layered bgs), "
    "\"kinetic_text\" (bold typography), \"mixed\" (use if the act benefits from contrast). "
    "You can pick DIFFERENT style_directions for different acts — the Shot Planner will "
    "pick shot types that fit each act's world.\n"
    "5. `emotional_beat` — the feeling this act should produce "
    "(\"awe\", \"curiosity\", \"clarity\", \"surprise\", \"urgency\", \"payoff\").\n"
    "6. `estimated_shot_count` — how many shots you think this act needs.\n"
    "7. `transition_out` — how this act hands off to the next "
    "(\"hard_cut\", \"kinetic_title_interstitial\", \"zoom_through\", \"vignette_fade\").\n\n"

    "Return JSON only with a top-level `acts` array. First char must be `{`, last must be `}`.\n"
    "Example shape:\n"
    "`{\"acts\":[{\"label\":\"Hook\",\"start_time\":0,\"end_time\":5,\"narration_excerpt\":\"...\",\"style_direction\":\"cinematic_photo\",\"emotional_beat\":\"awe\",\"estimated_shot_count\":2,\"transition_out\":\"hard_cut\"},...],\"overall_arc\":\"one sentence describing the narrative shape\"}`\n"
)


ACT_PLANNER_USER_PROMPT_TEMPLATE = """FULL SCRIPT:
"{script_text}"

BEAT OUTLINE:
{beat_outline_json}

TOTAL AUDIO DURATION: {audio_duration:.1f}s
CANVAS: {width}x{height} ({aspect_label})
SUBJECT DOMAIN: {subject_domain}

Split this video into 2-5 acts. Each act should have ONE emotional purpose. Return JSON only."""


def build_act_planner_user_prompt(
    script_text: str,
    beat_outline: List[Dict[str, Any]],
    subject_domain: str,
    width: int,
    height: int,
    audio_duration: float,
) -> str:
    """Build the user prompt for the Act Planner (pass 1 of two-pass Director)."""
    aspect_label = "9:16 portrait" if width < height else "16:9 landscape"
    beat_summary = [
        {
            "index": i,
            "label": b.get("label", f"Beat {i}"),
            "narration": b.get("narration", ""),
            "emotion": b.get("emotion", ""),
            "pacing": b.get("pacing", "normal"),
        }
        for i, b in enumerate(beat_outline)
    ]
    return ACT_PLANNER_USER_PROMPT_TEMPLATE.format(
        script_text=script_text.strip(),
        beat_outline_json=json.dumps(beat_summary, indent=2, ensure_ascii=False),
        subject_domain=subject_domain,
        width=width,
        height=height,
        aspect_label=aspect_label,
        audio_duration=audio_duration,
    )


# ---------------------------------------------------------------------------
# Background music planning extension (ultra / super_ultra only)
# ---------------------------------------------------------------------------
# Appended to the Director's system prompt when background music generation is
# enabled. The Director then must emit a `music_plan` field alongside `shots`,
# which the Lyria pipeline turns into a background score.

MUSIC_PLAN_EXTENSION = (
    "\n\n## 🎼 MUSIC PLAN (REQUIRED for this run)\n"
    "In addition to `shots`, you MUST also emit a `music_plan` object describing a "
    "background score for this video. The score is generated by an AI music model "
    "(Google Lyria) and mixed under the narration at ~20% volume. Treat it as a "
    "subtle, cinematic bed — not a foreground element.\n\n"
    "**Rules:**\n"
    "- Split the video into 1 or more music segments (each ≤ 170 seconds — the model's cap).\n"
    "- Segments must tile the FULL narration duration: first segment starts at 0.0, "
    "last segment ends at the total duration, no gaps or overlaps.\n"
    "- Each segment's mood should track the corresponding shots' emotional arc "
    "(you're planning both in the same response — keep them coherent).\n"
    "- Prompts must describe: genre, instrumentation, mood, tempo, energy curve.\n"
    "- Explicitly include \"no vocals\" in every prompt.\n"
    "- Do NOT reference artists, bands, song titles, or specific copyrighted tracks.\n"
    "- Keep tempo_bpm between 60 and 140.\n"
    "- For short videos (≤ 170s), emit a single segment covering the full duration.\n\n"
    "**Shape (add to top-level JSON alongside `shots` and `continuity_notes`):**\n"
    "```json\n"
    "\"music_plan\": {\n"
    "  \"overall_mood\": \"curious, uplifting, educational\",\n"
    "  \"overall_genre\": \"cinematic ambient + soft piano\",\n"
    "  \"segments\": [\n"
    "    {\n"
    "      \"start_time\": 0.0,\n"
    "      \"end_time\": 120.0,\n"
    "      \"mood\": \"gentle intro, building curiosity\",\n"
    "      \"genre\": \"ambient piano with warm string pads\",\n"
    "      \"tempo_bpm\": 72,\n"
    "      \"prompt\": \"Soft warm cinematic ambient, gentle piano melody over slow string pads, curious and contemplative, 72 bpm, subtle evolution, educational background score, no vocals\"\n"
    "    }\n"
    "  ]\n"
    "}\n"
    "```\n"
)


# ---------------------------------------------------------------------------
# Director user prompt template
# ---------------------------------------------------------------------------

DIRECTOR_USER_PROMPT_TEMPLATE = """FULL SCRIPT:
"{script_text}"

BEAT OUTLINE:
{beat_outline_json}

SUBJECT DOMAIN: {subject_domain}
TOPIC GUIDANCE: {topic_guidance}
IMAGE RATIO TARGET: {image_ratio_pct}% of shots should use images/video backgrounds.

WORD TIMESTAMPS (key words):
{word_timings}

STYLE: Background={background_type}
CANVAS: {width}x{height} ({aspect_label})
LANGUAGE: {language}
TARGET AUDIENCE: {target_audience}
TOTAL AUDIO DURATION: {audio_duration:.1f}s

SHOT COUNT IS YOUR CALL. You decide how many shots the video needs based on the content,
the pacing of the narration, and the quality of transitions you want between beats.
Reference pace (not a rule): reel/short-form is typically ~{pace_hint_sec}s/shot; a data-heavy
beat can sit longer if it has continuous in-shot motion; a hook or emphasis moment can be
<2s. Use whatever pacing the content demands, then justify it in `continuity_notes`.
The one hard constraint: a {audio_duration:.0f}s video cannot be a single static shot —
if it feels like one shot to you, think again about where the emotional beats are.

Produce a shot plan JSON:
{{
  "shots": [
    {{
      "shot_index": 0,
      "shot_type": "VIDEO_HERO",
      "beat_index": 0,
      "start_time": 0.0,
      "end_time": 8.5,
      "start_word": "The ancient city of",
      "narration_excerpt": "The ancient city of Rome began as a small village on the banks of the Tiber.",
      "visual_description": "Aerial stock footage of Roman ruins at golden hour, sweeping camera",
      "image_prompt": null,
      "video_query": "aerial ancient rome ruins golden hour cinematic",
      "text_elements": ["The Rise of Rome", "From Village to Empire"],
      "animation_strategy": "splitReveal title at 0.5s, fadeIn subtitle at 1.2s, fadeIn caption at 4s",
      "sync_points": [
        {{"word": "Rome", "time": 1.4, "action": "annotate title with underline"}},
        {{"word": "village", "time": 3.8, "action": "fadeIn subtitle"}}
      ],
      "complexity_level": "simple",
      "transition_in": "cut",
      "overlay": false,
      "notes": "Strong cinematic hook — use slow zoom Ken Burns if image, or looping stock video"
    }}
  ],
  "continuity_notes": "Brief note on overall visual continuity approach"
}}

IMPORTANT:
- The `shots` array must be a proper list — wrap every shot in `{{"shots": [...]}}`, even a one-shot plan.
- Every shot must have `start_time` and `end_time` that align with word timestamps.
- Shots must be sequential: shot N's end_time == shot N+1's start_time (no gaps).
- First shot starts at 0.0, last shot ends at {audio_duration:.1f}.
- `narration_excerpt` is the EXACT text from the script for that time range.
- `image_prompt` is required for IMAGE_HERO, IMAGE_SPLIT, ANNOTATION_MAP, ANIMATED_ASSET.
- `video_query` is required for VIDEO_HERO.
- For ANIMATED_ASSET, `image_prompt` should describe isolated cutout objects (one per image).
- `text_elements` lists the key text strings that will appear on screen.
- `sync_points` use EXACT word timestamps for animation triggers."""


def build_director_user_prompt(
    script_text: str,
    beat_outline: List[Dict[str, Any]],
    words: List[Dict[str, Any]],
    subject_domain: str,
    style_guide: Dict[str, Any],
    width: int = 1920,
    height: int = 1080,
    language: str = "English",
    audio_duration: float = 0.0,
    act_plan: Dict[str, Any] | None = None,
    emphasis_map: str = "",
    require_shot_density: bool = False,
    max_shots: Optional[int] = None,
    target_shot_duration_s: Optional[float] = None,
    quality_tier: str = "",
    target_audience: str = "General/Adult",
    include_music_plan: bool = False,
) -> str:
    """Assemble the Director user prompt from pipeline data."""
    aspect_label = "9:16 portrait" if width < height else "16:9"

    # Topic guidance from TOPIC_SHOT_PROFILES
    profile = TOPIC_SHOT_PROFILES.get(subject_domain, TOPIC_SHOT_PROFILES["general"])
    topic_guidance = profile.get("guidance", "Use a balanced mix of shot types.")
    image_ratio_pct = int(profile.get("image_ratio", 0.3) * 100)

    # Full beat outline — Director needs the whole narration to decide shot count,
    # not a 200-char truncation. Token budget is now generous enough.
    beat_summary = []
    for i, beat in enumerate(beat_outline):
        beat_summary.append({
            "index": i,
            "label": beat.get("label", f"Beat {i}"),
            "narration": beat.get("narration", ""),
            "visual_type": beat.get("visual_type", ""),
            "visual_idea": beat.get("visual_idea", ""),
            "emotion": beat.get("emotion", ""),
            "pacing": beat.get("pacing", "normal"),
            "complexity_level": beat.get("complexity_level", "moderate"),
            "key_terms": beat.get("key_terms", []),
        })
    beat_outline_json = json.dumps(beat_summary, indent=2, ensure_ascii=False)

    # Richer word timings — give the Director a denser sample so it can place
    # sync points precisely. Cap at 200 entries which is ~2-3x the old limit
    # but still well under the token budget.
    word_lines = ["Time(s)  | Word", "---------|--------"]
    selected = set()
    for i, w in enumerate(words):
        word_text = str(w.get("word", "")).strip()
        if not word_text:
            continue
        include = (
            i < 5 or                    # first 5
            i % 3 == 0 or               # every 3rd (was every 5th)
            len(word_text) > 4 or       # likely key terms
            i == len(words) - 1         # last word
        )
        if include and i not in selected:
            selected.add(i)
            word_lines.append(f"{float(w['start']):>7.2f}  | {word_text}")
        if len(selected) >= 200:
            break
    word_timings = "\n".join(word_lines)

    background_type = style_guide.get("background_type", "black")

    # Pacing reference only — surfaced to the Director as guidance, not a cap.
    # The Director decides final shot count.
    pace_hint_sec = 3 if height > width else 4

    base = DIRECTOR_USER_PROMPT_TEMPLATE.format(
        script_text=script_text.strip(),
        beat_outline_json=beat_outline_json,
        subject_domain=subject_domain,
        topic_guidance=topic_guidance,
        image_ratio_pct=image_ratio_pct,
        word_timings=word_timings,
        background_type=background_type,
        width=width,
        height=height,
        aspect_label=aspect_label,
        language=language,
        target_audience=target_audience,
        audio_duration=audio_duration,
        pace_hint_sec=pace_hint_sec,
    )

    extras: List[str] = []

    if act_plan and act_plan.get("acts"):
        acts_json = json.dumps(act_plan, indent=2, ensure_ascii=False)
        extras.append(
            "\n\n**📐 ACT PLAN (from the Narrative Architect — pass 1)**:\n"
            "Expand these acts into shots. Each shot should live inside exactly one act, "
            "respecting its `style_direction` and `emotional_beat`. Use the act's "
            "`transition_out` as the transition between the last shot of one act and the "
            "first shot of the next.\n"
            f"```json\n{acts_json}\n```\n"
        )

    if emphasis_map:
        extras.append("\n\n" + emphasis_map + "\n")

    if require_shot_density:
        extras.append(
            "\n\n**REQUIRED EXTRA FIELDS** (add to the top-level JSON object, alongside `shots`):\n"
            "- `shot_density`: `\"fast\"` | `\"medium\"` | `\"slow\"`\n"
            "- `pacing_rationale`: one sentence explaining your density choice vs the content.\n"
        )

    if max_shots is not None:
        _dur_low = target_shot_duration_s or (audio_duration / max_shots)
        _dur_high = _dur_low + 2
        extras.append(
            f"\n\n**SHOT COUNT HARD LIMIT**: This video MUST have at most {max_shots} shots total. "
            f"Do not exceed this number under any circumstances.\n"
            f"Target duration per shot: {_dur_low:.0f}–{_dur_high:.0f} seconds each. "
            f"Because each shot is longer, make it VISUALLY DENSE: layer multiple GSAP tweens, "
            f"staggered entrances, parallax motion, and rich visual storytelling within the shot. "
            f"Fewer but richer shots produce better quality than many thin short shots."
        )
    elif quality_tier == "super_ultra":
        # No hard cap for super_ultra — its features (two-pass Director, motion_bias,
        # kinetic_text_shots) depend on dense short shots. Instead guide for richness.
        extras.append(
            "\n\n**QUALITY OVER QUANTITY**: Every shot must earn its place with a distinct "
            "visual concept and dense animation. Prefer focused 3–5s shots over 8–10s sparse ones. "
            "KINETIC_TEXT and KINETIC_TITLE shots: 2–3s max — punchy, not lingering. "
            "Do not pad duration; instead add more animation layers within each shot."
        )

    if include_music_plan:
        extras.append(
            f"\n\n**🎼 MUSIC PLAN REMINDER**: Emit a `music_plan` object alongside `shots` "
            f"covering the full {audio_duration:.1f}s. "
            f"See system prompt for the exact shape and rules. Segments must tile "
            f"[0.0, {audio_duration:.1f}] with no gaps; each segment ≤ 170s; every prompt "
            f"must say \"no vocals\"; never reference artists or song titles."
        )

    if target_audience and target_audience.lower() not in ("general/adult", "general", "adult", ""):
        extras.append(
            f"\n\n**AUDIENCE CALIBRATION — {target_audience}**: "
            "Adjust shot complexity, animation density, vocabulary of visual metaphors, "
            "and text reading speed to match this audience. "
            "Younger/beginner audiences: simpler layouts, larger text, slower reveals, concrete metaphors. "
            "Expert/professional audiences: dense data layers, faster pacing, domain-specific visuals."
        )

    return base + "".join(extras)
