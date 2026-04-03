"""
Director Stage Prompts — the "film director" for the video pipeline.

The Director receives the full script, beat outline, and word timestamps, then
produces a shot-by-shot plan specifying which shot type, visual approach,
animation strategy, and sync points each shot should use.

The HTML generation stage then executes each shot independently with a focused
prompt containing only the documentation for that specific shot type.
"""
from __future__ import annotations

from typing import Dict, List, Any, Optional
import json

from prompts import TOPIC_SHOT_PROFILES

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
    "For floating objects (molecules, planets, tools). Needs `image_prompt` with cutout instructions.\n\n"

    "**RULES**:\n"
    "1. First shot MUST be VIDEO_HERO or IMAGE_HERO (cinematic hook).\n"
    "2. Never use the same shot type 3 times in a row.\n"
    "3. Follow the topic image_ratio guidance provided.\n"
    "4. Each shot: 4-12 seconds. If content needs longer, split into two shots.\n"
    "5. Shots must cover 100% of the narration timeline with NO gaps.\n"
    "6. Total of all shot durations must equal the audio duration.\n"
    "7. LOWER_THIRD can overlap other shots (mark `overlay: true`).\n"
    "8. For cutout images (ANIMATED_ASSET), always specify 'isolated on solid [color] background, no other objects, clean edges'.\n"
    "9. `start_word` must be the first 3-5 words of the narration at that timestamp.\n"
    "10. Prefer VIDEO_HERO over IMAGE_HERO when topic has real-world visual component.\n\n"

    "Return JSON only. No markdown, no commentary. "
    "The first character of your response must be `{` and the last must be `}`.\n"
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
TOTAL AUDIO DURATION: {audio_duration:.1f}s

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
- Every shot must have `start_time` and `end_time` that align with word timestamps.
- Shots must be sequential: shot N's end_time == shot N+1's start_time (no gaps).
- First shot starts at 0.0, last shot ends at {audio_duration:.1f}.
- `narration_excerpt` is the EXACT text from the script for that time range.
- `image_prompt` is required for IMAGE_HERO, IMAGE_SPLIT, ANNOTATION_MAP, ANIMATED_ASSET.
- `video_query` is required for VIDEO_HERO.
- For ANIMATED_ASSET, `image_prompt` should describe isolated cutout objects (one per image).
- `text_elements` lists the key text strings that will appear on screen.
- `sync_points` use EXACT word timestamps for animation triggers.
"""


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
) -> str:
    """Assemble the Director user prompt from pipeline data."""
    aspect_label = "9:16 portrait" if width < height else "16:9"

    # Topic guidance from TOPIC_SHOT_PROFILES
    profile = TOPIC_SHOT_PROFILES.get(subject_domain, TOPIC_SHOT_PROFILES["general"])
    topic_guidance = profile.get("guidance", "Use a balanced mix of shot types.")
    image_ratio_pct = int(profile.get("image_ratio", 0.3) * 100)

    # Condensed beat outline (just the fields the Director needs)
    beat_summary = []
    for i, beat in enumerate(beat_outline):
        beat_summary.append({
            "index": i,
            "label": beat.get("label", f"Beat {i}"),
            "narration": beat.get("narration", "")[:200],
            "visual_type": beat.get("visual_type", ""),
            "visual_idea": beat.get("visual_idea", ""),
            "emotion": beat.get("emotion", ""),
            "pacing": beat.get("pacing", "normal"),
            "complexity_level": beat.get("complexity_level", "moderate"),
            "key_terms": beat.get("key_terms", []),
        })
    beat_outline_json = json.dumps(beat_summary, indent=2, ensure_ascii=False)

    # Condensed word timings: first 3 words, every 5th word, words > 4 chars
    # Limit to ~60 entries to keep prompt manageable
    word_lines = ["Time(s)  | Word", "---------|--------"]
    selected = set()
    for i, w in enumerate(words):
        word_text = str(w.get("word", "")).strip()
        if not word_text:
            continue
        include = (
            i < 3 or                    # first 3
            i % 5 == 0 or              # every 5th
            len(word_text) > 4 or      # likely key terms
            i == len(words) - 1        # last word
        )
        if include and i not in selected:
            selected.add(i)
            word_lines.append(f"{float(w['start']):>7.2f}  | {word_text}")
        if len(selected) >= 60:
            break
    word_timings = "\n".join(word_lines)

    background_type = style_guide.get("background_type", "black")

    return DIRECTOR_USER_PROMPT_TEMPLATE.format(
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
        audio_duration=audio_duration,
    )
