"""
Prompts configuration for StillLift Automation.
"""
from typing import Any, Dict, List, Optional

# Background type presets for consistent theming
BACKGROUND_PRESETS = {
    "black": {
        "background": "#000000",
        "text": "#ffffff",
        "text_secondary": "#cbd5e1",
        "primary": "#3b82f6",
        "secondary": "#1e293b",
        "accent": "#38bdf8",
        "svg_stroke": "#ffffff",
        "svg_fill": "#3b82f6",
        "card_bg": "rgba(30, 41, 59, 0.8)",
        "card_border": "rgba(255, 255, 255, 0.1)",
        "mermaid_theme": "dark",
        "mermaid_node_fill": "#1e293b",
        "mermaid_node_stroke": "#3b82f6",
        "mermaid_text": "#ffffff",
        "code_theme": "okaidia",
        "annotation_color": "#38bdf8",
    },
    "white": {
        "background": "#ffffff",
        "text": "#0f172a",  # Very dark for maximum contrast
        "text_secondary": "#475569",
        "primary": "#2563eb",
        "secondary": "#e2e8f0",
        "accent": "#0369a1",  # Darker cyan for visibility on white
        "svg_stroke": "#0f172a",  # Dark strokes for visibility
        "svg_fill": "#2563eb",
        "card_bg": "rgba(226, 232, 240, 0.9)",
        "card_border": "rgba(0, 0, 0, 0.15)",
        "mermaid_theme": "default",
        "mermaid_node_fill": "#e2e8f0",
        "mermaid_node_stroke": "#2563eb",
        "mermaid_text": "#0f172a",
        "code_theme": "solarizedlight",
        "annotation_color": "#dc2626",  # Red for visibility on white (like a teacher's pen)
    },
}

# Pre-built SVG maps — structured registry in map_assets.py
# Re-export for backwards compatibility
from map_assets import MAP_BASE_URL, AVAILABLE_MAPS  # noqa: F401

# Topic-aware shot profiles: maps subject domains to recommended visual mixes
TOPIC_SHOT_PROFILES = {
    "coding": {
        "description": "Programming / Computer Science",
        "preferred_shots": ["CODE_SPLIT", "TEXT_DIAGRAM", "MERMAID_FLOW"],
        "image_ratio": 0.1,  # ~10% image shots, rest code/diagrams
        "guidance": (
            "This is a CODING topic. Prioritize:\n"
            "- Code snippets with Prism.js syntax highlighting\n"
            "- Mermaid flowcharts for logic/architecture\n"
            "- SVG diagrams for data structures\n"
            "- Minimal AI images (only for real-world analogies)\n"
            "- Use layout-code-split for code + explanation side by side"
        ),
    },
    "history": {
        "description": "History / Social Studies / Geography",
        "preferred_shots": ["IMAGE_HERO", "IMAGE_SPLIT", "ANIMATED_ASSET", "TIMELINE"],
        "image_ratio": 0.6,  # ~60% image shots for historical context
        "guidance": (
            "This is a HISTORY/GEOGRAPHY topic. Prioritize:\n"
            "- IMAGE_HERO shots with period-appropriate scenes\n"
            "- IMAGE_SPLIT for artifacts, maps, historical figures\n"
            "- ANIMATED_ASSET for floating artifacts, tools, weapons, cultural objects\n"
            "- Timeline-style SVG for chronological events\n"
            "- Use rich, cinematic image prompts with era-specific details"
        ),
    },
    "science": {
        "description": "Biology / Chemistry / Physics / Earth Science",
        "preferred_shots": ["IMAGE_SPLIT", "ANIMATED_ASSET", "SVG_DIAGRAM", "TEXT_DIAGRAM"],
        "image_ratio": 0.35,  # ~35% images for specimens, experiments
        "guidance": (
            "This is a SCIENCE topic. Prioritize:\n"
            "- SVG diagrams for processes (cell division, circuits, etc.)\n"
            "- IMAGE_SPLIT for real-world specimens, lab setups\n"
            "- ANIMATED_ASSET for molecules, cells, planets, organisms floating/moving\n"
            "- Mermaid diagrams for classification trees\n"
            "- Animated SVGs to show step-by-step processes\n"
            "- Use Vivus.js to draw scientific diagrams progressively"
        ),
    },
    "math": {
        "description": "Mathematics / Statistics / Logic",
        "preferred_shots": ["TEXT_DIAGRAM", "SVG_DIAGRAM", "EQUATION"],
        "image_ratio": 0.05,  # Almost no images, pure diagrams/equations
        "guidance": (
            "This is a MATH topic. Prioritize:\n"
            "- KaTeX equations rendered large and clear\n"
            "- Step-by-step equation solving with progressive reveal\n"
            "- SVG graphs, coordinate planes, geometric shapes\n"
            "- NO AI images unless showing real-world application\n"
            "- Use Vivus.js to 'draw' equations like a teacher writing"
        ),
    },
    "language": {
        "description": "Language Arts / Literature / Grammar",
        "preferred_shots": ["TEXT_DIAGRAM", "IMAGE_HERO", "LOWER_THIRD"],
        "image_ratio": 0.25,
        "guidance": (
            "This is a LANGUAGE topic. Prioritize:\n"
            "- Large, readable text with Rough Notation annotations\n"
            "- IMAGE_HERO for literary scenes or cultural context\n"
            "- LOWER_THIRD for vocabulary definitions\n"
            "- Comparison layouts for grammar rules (correct vs incorrect)"
        ),
    },
    "biology": {
        "description": "Biology / Life Sciences / Anatomy / Ecology",
        "preferred_shots": ["IMAGE_SPLIT", "ANIMATED_ASSET", "ANNOTATION_MAP", "PROCESS_STEPS"],
        "image_ratio": 0.45,
        "guidance": (
            "This is a BIOLOGY topic. Prioritize:\n"
            "- ANNOTATION_MAP for labeled anatomy (organs, cells, organisms)\n"
            "- ANIMATED_ASSET for floating cells, molecules, organisms with GSAP animation\n"
            "- IMAGE_SPLIT for microscope imagery, specimens, lab photos alongside explanation\n"
            "- PROCESS_STEPS for biological processes (cell division, digestion, photosynthesis)\n"
            "- Vivus.js to progressively draw biological diagrams\n"
            "- Mermaid for classification trees and food chains"
        ),
    },
    "chemistry": {
        "description": "Chemistry / Chemical Reactions / Molecular Science",
        "preferred_shots": ["ANIMATED_ASSET", "TEXT_DIAGRAM", "EQUATION_BUILD", "PROCESS_STEPS"],
        "image_ratio": 0.25,
        "guidance": (
            "This is a CHEMISTRY topic. Prioritize:\n"
            "- ANIMATED_ASSET for floating molecules, atoms, bonds with GSAP\n"
            "- EQUATION_BUILD for chemical equations and formulas (KaTeX)\n"
            "- PROCESS_STEPS for reaction mechanisms step-by-step\n"
            "- TEXT_DIAGRAM for periodic table excerpts, electron configurations\n"
            "- SVG animations for orbital diagrams and bonding visualizations\n"
            "- Use Vivus.js to 'draw' molecular structures progressively"
        ),
    },
    "geography": {
        "description": "Geography / Maps / Earth Science / Climate",
        "preferred_shots": ["VIDEO_HERO", "IMAGE_HERO", "ANNOTATION_MAP", "IMAGE_SPLIT"],
        "image_ratio": 0.55,
        "guidance": (
            "This is a GEOGRAPHY topic. Prioritize:\n"
            "- VIDEO_HERO for aerial landscapes, natural formations, weather systems\n"
            "- ANNOTATION_MAP with SVG maps — highlight regions, draw borders, label features\n"
            "- IMAGE_HERO for dramatic landscapes, satellite imagery, natural wonders\n"
            "- IMAGE_SPLIT for comparing regions, showing map + explanation side-by-side\n"
            "- Use pre-built SVG maps (world, us, in, cn, etc.) with GSAP region highlighting\n"
            "- DATA_STORY for population, climate, or economic data charts"
        ),
    },
    "saas_marketing": {
        "description": "SaaS Marketing Reel / Product Promotion / Feature Highlight",
        "preferred_shots": ["VIDEO_HERO", "IMAGE_HERO", "TEXT_DIAGRAM", "IMAGE_SPLIT"],
        "image_ratio": 0.5,
        "guidance": (
            "This is a SaaS MARKETING REEL. Prioritize:\n"
            "- VIDEO_HERO for attention-grabbing hooks (tech office, team, abstract motion)\n"
            "- IMAGE_HERO for product screenshots, dashboard mockups, hero visuals\n"
            "- TEXT_DIAGRAM for feature highlights with clean icons (Iconify mdi: set)\n"
            "- Bold, punchy text — short sentences, large fonts, high contrast\n"
            "- DATA_STORY for metrics (growth charts, user counts, performance gains)\n"
            "- Keep pacing FAST — 3-5 second shots, snappy transitions\n"
            "- Use splitReveal for impactful headlines\n"
            "- CTA at the end with clear call-to-action text"
        ),
    },
    "business_marketing": {
        "description": "Business Marketing Reel / Brand Video / Corporate Promo",
        "preferred_shots": ["VIDEO_HERO", "IMAGE_HERO", "TEXT_DIAGRAM", "DATA_STORY"],
        "image_ratio": 0.55,
        "guidance": (
            "This is a BUSINESS MARKETING REEL. Prioritize:\n"
            "- VIDEO_HERO for cinematic hooks (city skylines, offices, teams collaborating)\n"
            "- IMAGE_HERO for brand visuals, team photos, product/service imagery\n"
            "- TEXT_DIAGRAM for value propositions with icons and bullet points\n"
            "- DATA_STORY for impressive stats, growth metrics, ROI numbers\n"
            "- Keep text minimal and impactful — think billboard, not paragraph\n"
            "- Use splitReveal for brand slogans and key messages\n"
            "- Professional tone — avoid playful animations, use smooth transitions\n"
            "- End with strong CTA and brand identity"
        ),
    },
    "saas_demo": {
        "description": "SaaS Product Demo / Walkthrough / Tutorial",
        "preferred_shots": ["IMAGE_SPLIT", "TEXT_DIAGRAM", "PROCESS_STEPS", "IMAGE_HERO"],
        "image_ratio": 0.4,
        "guidance": (
            "This is a SaaS PRODUCT DEMO. Prioritize:\n"
            "- IMAGE_SPLIT for UI screenshots with explanation text alongside\n"
            "- PROCESS_STEPS for workflow walkthroughs (Step 1: Sign up, Step 2: Configure...)\n"
            "- TEXT_DIAGRAM for feature explanations with clean icons\n"
            "- IMAGE_HERO for overview/hero shots of the product dashboard\n"
            "- ANNOTATION_MAP for annotated UI screenshots (label buttons, menus, features)\n"
            "- Pacing should be moderate — give users time to absorb each step\n"
            "- Use numbered sequences and clear visual hierarchy\n"
            "- Highlight key UI elements with Rough Notation annotations"
        ),
    },
    "visual_storytelling": {
        "description": "Visual Storytelling / Narrative / Documentary Style",
        "preferred_shots": ["VIDEO_HERO", "IMAGE_HERO", "IMAGE_SPLIT", "ANIMATED_ASSET"],
        "image_ratio": 0.65,
        "guidance": (
            "This is VISUAL STORYTELLING. Prioritize:\n"
            "- VIDEO_HERO for immersive, atmospheric scene-setting (the primary shot type)\n"
            "- IMAGE_HERO with Ken Burns for dramatic stills and emotional moments\n"
            "- IMAGE_SPLIT for showing details alongside narrative text\n"
            "- ANIMATED_ASSET for symbolic floating objects that reinforce the story\n"
            "- Minimal text on screen — let visuals and narration carry the story\n"
            "- Use slow Ken Burns (zoom-in, pan-left) for contemplative moments\n"
            "- Use gradient-center overlays for emotional emphasis\n"
            "- Pacing: slow and cinematic, 8-12 second shots, crossfade transitions"
        ),
    },
    "general": {
        "description": "General / Mixed / Default",
        "preferred_shots": ["IMAGE_HERO", "TEXT_DIAGRAM", "IMAGE_SPLIT", "ANIMATED_ASSET"],
        "image_ratio": 0.3,
        "guidance": (
            "Use a balanced mix of shot types:\n"
            "- 1 IMAGE_HERO for the hook/opener\n"
            "- TEXT_DIAGRAM shots for core explanations\n"
            "- IMAGE_SPLIT when a visual reference helps understanding\n"
            "- ANIMATED_ASSET for floating illustrative objects when it adds visual interest"
        ),
    },
}

def get_script_system_prompt(width: int = 1920, height: int = 1080) -> str:
    aspect_label = "9:16 portrait" if width < height else "16:9"
    return (
        f"You are a senior educational scriptwriter for energetic {aspect_label} explainer videos. "
        "You adapt your vocabulary, examples, and concept depth based on the target audience's age/grade level. "
        "You also classify the subject domain of the topic to guide visual design decisions. "
        "Return JSON containing a single continuous narration script (multiple paragraphs allowed), "
        "plus a beat outline, subject classification, and CTA notes. Respond with JSON only."
    )

# Backward compat — used when width/height not provided
SCRIPT_SYSTEM_PROMPT = get_script_system_prompt()

SCRIPT_USER_PROMPT_TEMPLATE = """
Base idea from the user:
---
{base_prompt}
---

Target Audience: {target_audience}

**AGE-APPROPRIATE GUIDELINES**:
- **Class 1-2 (Ages 5-7)**: Very simple words, short sentences, fun comparisons to toys/animals/family. Max 1 concept per video.
- **Class 3-5 (Ages 7-10)**: Simple vocabulary, relatable examples (games, school, friends). 1-2 concepts, lots of visuals.
- **Class 6-8 (Ages 11-13)**: Can handle some technical terms with explanations. Real-world applications. 2-3 concepts.
- **Class 9-10 (Ages 14-15)**: More formal vocabulary okay. Abstract thinking. Connect to exams/careers.
- **Class 11-12 (Ages 16-18)**: Adult vocabulary. Complex concepts. Depth over simplification.
- **College/Adult**: Technical depth, professional examples, assume foundational knowledge.

Target Duration: {target_duration}

**DURATION GUIDELINES — STRICT** (calibrated to your TTS voice `{voice_label}` rendering at ~{wps_int} words/minute):
- 30 seconds ≈ {ex_30s} words
- 1 minute ≈ {ex_60s} words
- 2 minutes ≈ {ex_120s} words
- 3 minutes ≈ {ex_180s} words
- 5 minutes ≈ {ex_300s} words
- 7 minutes ≈ {ex_420s} words
- 10 minutes ≈ {ex_600s} words
⚠️ HARD CAP — your script will be REJECTED and require regeneration if it exceeds the target by >15%. Count your words carefully. The final script MUST match the target duration above. The voice `{voice_label}` paces at roughly **{wps_per_sec:.2f} words/second** — write FEWER words than a generic narrator, leaving room for ad-style pauses, brand stings, and product reveals. WRITE FEWER WORDS, NOT MORE.

**HEX-CODE HANDLING — MANDATORY**:
Any hex code (`#XXXXXX` format like `#0D0D0D` or `#C9A84C`) that appears in the user's prompt above is a CSS STYLING value (background colour, accent colour, text colour). NEVER include the literal hex string in the narration script — the host won't say "hashtag zero D zero D zero D" out loud. Hex codes are passed downstream as CSS values via background-color / color / border-color properties; they belong in the visual layer, not the narration.

Requirements:
- **MATCH vocabulary and examples to the target audience's age/grade level.**
- **VOICE — match the register to the `intent` you choose below; do NOT give every video the same upbeat tone:**
  - `ad` / `trailer`: confident, a little cocky; short punchy declaratives; build to a payoff line.
  - `explainer`: curious and clear — an expert genuinely excited, never a textbook; lead with the surprising part.
  - `tutorial`: calm, direct, second-person ("you"); concrete verbs, no hype.
  - `news_recap`: measured, factual, present-tense urgency; let the facts carry the weight.
  - `story`: hushed, sensory, present-tense; let images breathe; no sales pitch.
  - `announcement`: warm, proud, specific; name the thing once and make it land.
  Then adjust for audience age/grade (more playful for younger, more precise for older) WITHOUT collapsing back to a generic tone.
- **MATCH the narration length PRECISELY to the target duration above** using the per-second word budget stated above (it is voice-specific) — not a fixed word count.
- For longer videos (5+ minutes), break into clear sections — but VARY how you bridge them. Do NOT lean on stock connectors like "Now let's look at...", "Next, we'll explore...", or "Now that we understand X...". Bridge with a question, a contrast, or a concrete image.
- **Closing depends on `intent`:** for `explainer` / `tutorial` / `announcement`, end with a short, earned CTA; for `ad` build to a payoff line; for `story` / `trailer`, do NOT tack on a CTA — close on a line or image that lingers. Use "" for the `cta` key when there is no CTA.
- Provide a concise beat outline to help designers understand key turns.
- **IMPORTANT**: Write the script, title, and summaries ENTIRELY in **{language}**.
- If the language is not English, ensure the tone remains natural for that language.
- **Include a "Key Takeaway" statement** that summarizes the main point in one simple sentence.
- **Mention a common mistake** students make about this topic (for Wrong vs Right visual).
- **GENERATE MCQ QUESTIONS**: For each substantive beat in beat_outline (skip the Hook beat at index 0 and the CTA/Conclusion beat), write one multiple-choice question that tests understanding of that beat's core concept. Write questions in **{language}**. Each question must have exactly 4 options and one clearly correct answer with a brief explanation. The `chapter_index` field must exactly match the beat's 0-based position in the beat_outline array.

**EMOTIONAL ANCHORING (builds engagement)**:
- **Hook**: Start with a relatable question, surprising fact, or "imagine you are..." scenario to spark curiosity.
- **Tension**: Include a "Common Mistake" section that creates mild tension ("Most students assume X — but the truth is...").
- **Resolution**: Follow immediately with the correct understanding, giving satisfaction.
- **Takeaway**: End with a clear, positive Key Takeaway that the learner can remember.

**BANNED OPENERS & PHRASES (the #1 tell of generic AI narration — never use them):**
- Banned openers (do not start the script or any beat with these): "Have you ever wondered", "Imagine a world where", "In today's video", "Did you know", "Let's dive in", "Picture this", "Today we'll learn".
- Banned filler/cliché anywhere: "fascinating", "important to note", "as we can see", "it turns out", "at the end of the day", "delve", "unlock", "journey" (as a metaphor), "game-changer", "basically", "actually", "in conclusion".
- Open instead with: a cold concrete scene, a contradiction/reversal ("They told you X. They were wrong."), a single arresting number, an in-medias-res moment, or a sharp non-rhetorical question. Show, don't assert — never tell the viewer something is interesting, make it interesting.

**RECAP MARKERS**: If the video covers 3+ distinct concepts, add `"needs_recap": true` on the beat AFTER the last concept, so the system can optionally insert a visual summary.

**BEAT ENRICHMENT FIELDS** (include in every beat):
- `narration`: The EXACT sentences from the `script` field that belong to this beat. CRITICAL: the full `script` must be perfectly split across all beats — no sentences skipped, no sentences duplicated. Concatenating all beat `narration` fields in order must reproduce the full `script` text.
- `emotion`: The emotional tone for this section — drives animation intensity and visual mood. One of: curiosity, surprise, awe, urgency, calm, excitement.
- `pacing`: How fast the visuals should move. "slow" for contemplative/complex concepts, "normal" for standard explanation, "fast" for rapid-fire facts or energy bursts.
- `transition_hint`: Suggested transition INTO this beat from the previous. "cut" for sharp topic changes, "crossfade" for smooth continuation, "zoom" for diving deeper into a concept.
- `complexity_level`: Visual density for this section. "simple" = 1-2 elements on screen, "moderate" = 3-4 elements, "dense" = rich diagram or multi-part layout.

JSON shape:
{{
  "title": "...",
  "audience": "...",
  "target_grade": "...",
  "subject_domain": "coding | history | science | biology | chemistry | geography | math | language | saas_marketing | business_marketing | saas_demo | visual_storytelling | general",
  "visual_style": "realistic cinematic photograph | flat vector illustration | watercolor painting | scientific diagram illustration | documentary photography",
  "intent": "ad | explainer | tutorial | announcement | news_recap | story | trailer",
  "script": "Full narration text...",
  "key_takeaway": "One sentence summary of the main concept",
  "common_mistake": "A typical misconception or error students make",
  "beat_outline": [
    {{
      "label": "Hook",
      "narration": "The exact sentences from the script that belong to this beat...",
      "summary": "...",
      "visual_type": "IMAGE_HERO or IMAGE_SPLIT or TEXT_DIAGRAM or LOWER_THIRD or ANIMATED_ASSET",
      "visual_idea": "Describe a key visual metaphor for this section",
      "image_prompt_hint": "Only if visual_type uses images: cinematic photo description, {aspect_label}, no text/faces",
      "key_terms": ["term1", "term2"],
      "needs_recap": false,
      "emotion": "curiosity | surprise | awe | urgency | calm | excitement",
      "pacing": "slow | normal | fast",
      "transition_hint": "cut | crossfade | zoom",
      "complexity_level": "simple | moderate | dense"
    }}
  ],
  "cta": "...",
  "questions": [
    {{
      "chapter_index": 1,
      "question": "Question text testing the core concept of beat at index 1?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "explanation": "Brief explanation of why Option A is correct."
    }}
  ]
}}

**subject_domain classification**:
- "coding": Programming, algorithms, data structures, web dev, databases
- "history": Historical events, civilizations, social studies
- "science": Physics, earth science, astronomy, general science
- "biology": Biology, anatomy, ecology, life sciences, microbiology
- "chemistry": Chemistry, chemical reactions, molecular science, periodic table
- "geography": Geography, maps, climate, earth features, countries, regions
- "math": Arithmetic, algebra, geometry, calculus, statistics
- "language": Grammar, literature, vocabulary, writing, foreign languages
- "saas_marketing": SaaS product promotion, feature highlights, marketing reels
- "business_marketing": Business branding, corporate promos, marketing videos
- "saas_demo": SaaS product demos, UI walkthroughs, tutorials
- "visual_storytelling": Narrative videos, documentary style, emotional storytelling
- "general": Life skills, art, music, mixed topics, anything that doesn't fit above

**intent classification** (choose ONE — drives downstream thumbnail / framing decisions):
- "ad": Sales-pitch, product hero, conversion-focused (SaaS marketing, business promo, brand spots).
- "explainer": Concept explained in plain terms (science, math, general education).
- "tutorial": Step-by-step how-to, often UI walkthrough, code demo, or skill practice.
- "announcement": A specific event/launch reveal (release, partnership, milestone).
- "news_recap": Summary of a news story or current event.
- "story": Narrative-driven, character-led, cinematic storytelling.
- "trailer": Teaser / hype cut for a longer piece (course, film, product reveal).

**visual_style classification** (choose ONE for the entire video — all AI images will use this style):
- "realistic cinematic photograph": For history, geography, real-world science, visual storytelling (cinematic, DSLR-quality)
- "documentary photography": For history/geography (journalistic, authentic feel)
- "scientific diagram illustration": For biology, chemistry, anatomy (clean white-bg technical illustrations)
- "watercolor painting": For language arts, literature, young learners (soft, artistic feel)
- "flat vector illustration": For coding, math, general/business (clean, minimal, icon-like)
- "modern tech product": For SaaS marketing/demos (sleek, gradient backgrounds, product mockups)
- "corporate professional": For business marketing (polished, brand-safe, confident)

**visual_type guide for beat_outline**:
- Use IMAGE_HERO for hooks, real-world scene-setters, topic introductions
- Use IMAGE_SPLIT when explaining with a visual reference alongside text
- Use TEXT_DIAGRAM for abstract concepts, math, code, processes, comparisons
- Use LOWER_THIRD for vocabulary definitions (pairs with another shot type)
- Use ANIMATED_ASSET for floating illustrative objects (molecules, tools, animals) with GSAP animation
- For **coding** topics: prefer TEXT_DIAGRAM and code blocks over images
- For **history** topics: prefer IMAGE_HERO, IMAGE_SPLIT, and ANIMATED_ASSET over diagrams
- For **biology** topics: prefer ANNOTATION_MAP for anatomy, ANIMATED_ASSET for cells/organisms
- For **chemistry** topics: prefer ANIMATED_ASSET for molecules, EQUATION_BUILD for chemical formulas
- For **geography** topics: prefer VIDEO_HERO for landscapes, ANNOTATION_MAP with SVG maps
- For **science** topics: balanced mix of IMAGE_SPLIT, ANIMATED_ASSET, and SVG diagrams
- For **math** topics: prefer TEXT_DIAGRAM with KaTeX equations, almost no images
- For **saas_marketing/business_marketing**: prefer VIDEO_HERO hooks, bold TEXT_DIAGRAM, DATA_STORY for metrics
- For **saas_demo**: prefer IMAGE_SPLIT for UI screenshots, PROCESS_STEPS for workflows
- For **visual_storytelling**: prefer VIDEO_HERO and IMAGE_HERO — minimal text, let visuals carry the narrative
"""

# ---------------------------------------------------------------------------
# Two-pass script review prompts (used in Premium/Ultra tiers)
# ---------------------------------------------------------------------------
SCRIPT_REVIEW_SYSTEM_PROMPT = (
    "You are a senior educational content reviewer and narrative coach. "
    "You receive a draft script and beat outline for an educational video, "
    "and return an improved version. You preserve the JSON structure exactly. "
    "Respond with JSON only — no commentary."
)

SCRIPT_REVIEW_USER_PROMPT_TEMPLATE = """Review and improve this educational video script. The output JSON must have the EXACT same keys as the input.

**Draft script and beat outline (JSON):**
```json
{script_json}
```

**Improvement checklist — apply ALL that are relevant:**

1. **Hook strength & banned phrases**: Is the opening genuinely attention-grabbing? REWRITE any opener that uses a banned tell ("Have you ever wondered", "Imagine a world where", "In today's video", "Did you know", "Let's dive in", "Today we'll learn", "Picture this") into a cold concrete scene, a contradiction/reversal, a single arresting number, or a sharp question. Also strip banned filler anywhere in the script: "fascinating", "important to note", "as we can see", "it turns out", "delve", "unlock", "journey" (metaphor), "game-changer", "basically", "actually", "in conclusion".

2. **Transitions**: Check that each beat flows naturally into the next. Add bridging phrases ("Now that we understand X, let's see how it connects to Y…") where transitions feel abrupt.

3. **Analogies & examples**: For every abstract concept, ensure there is at least one concrete, age-appropriate analogy or real-world example. Replace weak analogies with more vivid, memorable ones.

4. **Pacing**: Check word count against the target duration (the chosen TTS voice paces at ~{wps_int} words/minute, so a {ex_30s}-word script renders ~30 seconds, an {ex_60s}-word script renders ~1 minute, etc.). Trim fluff or expand thin sections. Trim filler words and hedging phrases ('basically', 'actually', 'kind of', 'you know') that slow pacing without adding value. **DO NOT pad the script just to hit a higher wpm benchmark — fewer words at this voice's pace is correct.**

5. **Emotional arc — does it BUILD, not just vary?**: The `emotion` sequence must form a deliberate arc — a withhold before a reveal, a calm before a turn, escalation toward a payoff — NOT a random rotation of labels over monotone prose. Name the single biggest turn and verify the narration actually earns it. Flag any run of beats that all sit at the same intensity.

6. **Visual variety**: Check beat `visual_type` fields — ensure at least 3 different types are used across all beats. Adjust if too repetitive.

7. **Key takeaway**: Ensure the `key_takeaway` is a single, memorable sentence a student could repeat from memory.

8. **Common mistake**: Ensure `common_mistake` is a genuine, specific misconception (not a vague "students might find this hard").

9. **Beat enrichment**: Verify all beats have meaningful `emotion`, `pacing`, `transition_hint`, and `complexity_level` values — not just defaults.

10. **Beat narration alignment**: Verify each beat's `narration` field contains the exact sentences from `script` that belong to it. All beats' narrations concatenated in order must reproduce the full `script` text — no gaps, no overlaps. If the script was edited in earlier steps, update the narration fields to match.

Return the improved JSON with the same structure. Only modify content — do not add or remove keys.
"""


# ---------------------------------------------------------------------------
# User visual preferences — Slice B helper (appended to script user prompt)
# ---------------------------------------------------------------------------

# Maps each VisualPreferences family to (script-vocab visual_type bias text,
# label used in LEAN AGAINST list, suggested visual_style for the whole video).
# The script LLM picks `visual_type` from a smaller vocabulary than the
# Director (IMAGE_HERO / IMAGE_SPLIT / TEXT_DIAGRAM / LOWER_THIRD /
# ANIMATED_ASSET), so the bias map below maps each family to the closest
# members of that vocabulary. The Director (Slice C) re-biases against its
# full catalog later — this nudge is what tiers without a Director (free,
# standard) rely on.
_VISUAL_PREFERENCE_FAMILY_BIAS: Dict[str, Dict[str, str]] = {
    "stock_video": {
        "favor_visual_type": "IMAGE_HERO",
        "favor_hint": (
            "real-world / cinematic photograph in `image_prompt_hint` "
            "(e.g. \"DSLR photo\", \"documentary still\")"
        ),
        "avoid_label": "stock-photography hero shots",
        "visual_style_hint": "realistic cinematic photograph",
    },
    "ai_imagery": {
        "favor_visual_type": "IMAGE_HERO, IMAGE_SPLIT",
        "favor_hint": "image-driven beats with rich `image_prompt_hint`",
        "avoid_label": "AI-generated imagery beats",
        "visual_style_hint": "realistic cinematic photograph",
    },
    "svg_illustrated": {
        "favor_visual_type": "TEXT_DIAGRAM, ANIMATED_ASSET",
        "favor_hint": (
            "explicit \"diagram\" / \"illustrated\" / \"sketched\" cues "
            "in `visual_idea`"
        ),
        "avoid_label": "diagram / illustration beats",
        "visual_style_hint": "scientific diagram illustration",
    },
    "motion_graphics": {
        "favor_visual_type": "TEXT_DIAGRAM, ANIMATED_ASSET",
        "favor_hint": (
            "animated charts, processes, or data visualizations in `visual_idea`"
        ),
        "avoid_label": "motion-graphics beats",
        "visual_style_hint": "flat vector illustration",
    },
    "app_ui_mockup": {
        "favor_visual_type": "IMAGE_SPLIT, TEXT_DIAGRAM",
        "favor_hint": (
            "explicit \"app UI\", \"mobile screen\", \"browser interface\", "
            "or \"dashboard\" cue in `visual_idea`"
        ),
        "avoid_label": "device / app UI mockup beats",
        "visual_style_hint": "modern tech product",
    },
}


def build_visual_preferences_script_block(prefs: Optional[Dict[str, Any]]) -> str:
    """Build an optional block to append to the script user prompt.

    Reads a *resolved* VisualPreferences dict (the post-merge view written
    by `IntentRouterService.merge_visual_preferences`) and produces a
    markdown block that biases the script's beat-level `visual_type` and
    `image_prompt_hint` brevity. Returns "" when no preferences are
    actively expressed (all None / "auto").

    Slice B is the only thing that runs on the free / standard tiers
    (which skip the Director), so the block has to do real work even
    without downstream support: bias `visual_type` per beat, bias
    `visual_style` for the whole video, and shape on-screen text density.
    """
    if not prefs:
        return ""

    # Skip the block entirely when no field is actively expressed. "auto" and
    # None mean "no opinion" — pumping the prompt full of noise dilutes other
    # rules and burns tokens.
    active = {k: v for k, v in prefs.items() if v not in (None, "auto")}
    if not active:
        return ""

    favor_lines: List[str] = []
    avoid_labels: List[str] = []
    visual_style_hints: List[str] = []

    for family, bias in _VISUAL_PREFERENCE_FAMILY_BIAS.items():
        v = active.get(family)
        if v == "high":
            favor_lines.append(
                f"- visual_type: `{bias['favor_visual_type']}` — {bias['favor_hint']}"
            )
            visual_style_hints.append(bias["visual_style_hint"])
        elif v == "no":
            avoid_labels.append(f"- {bias['avoid_label']}")

    parts: List[str] = [
        "",  # leading blank line
        "## 🎨 USER VISUAL PREFERENCES (soft guidance)",
        (
            "The user has expressed visual treatment preferences. Honor them "
            "when content allows; do not contort the narrative to fit them — "
            "content always wins on conflict."
        ),
    ]
    if favor_lines:
        parts.append("\n**LEAN TOWARD** (favor these in `beat_outline`):")
        parts.extend(favor_lines)
    if avoid_labels:
        parts.append(
            "\n**LEAN AGAINST** (use these only when the beat genuinely demands it):"
        )
        parts.extend(avoid_labels)
    if visual_style_hints:
        # Script picks ONE visual_style for the whole video — first FAVOR wins.
        parts.append(
            f"\n**`visual_style` HINT:** prefer "
            f"`\"{visual_style_hints[0]}\"` if compatible with the "
            f"subject_domain; otherwise pick the next-best fit from the "
            f"visual_style classification list above."
        )

    density = active.get("text_density")
    if density == "minimal":
        parts.append(
            "\n**ON-SCREEN TEXT DENSITY: minimal** — the viewer will hear "
            "narration but see almost no on-screen text. Write narration that "
            "is FULLY self-contained: NEVER say \"as you can see\", \"in this "
            "diagram\", \"the chart shows\", or refer to on-screen labels. "
            "Avoid LOWER_THIRD entirely (vocabulary banners are on-screen "
            "text). Keep `visual_idea` ≤ 12 words. `image_prompt_hint` "
            "describes the IMAGE only — no text overlays."
        )
    elif density == "low":
        parts.append(
            "\n**ON-SCREEN TEXT DENSITY: low** — keep on-screen text light. "
            "Narration carries the meaning; on-screen text is decorative, not "
            "load-bearing. Use LOWER_THIRD sparingly (max 1 per 30s of video) "
            "and only for genuine vocabulary callouts. Keep `visual_idea` "
            "≤ 18 words; no body paragraphs."
        )
    elif density == "rich":
        parts.append(
            "\n**ON-SCREEN TEXT DENSITY: rich** — on-screen text is welcome. "
            "Headlines + supporting labels are encouraged where they reinforce "
            "narration. LOWER_THIRD is freely available for vocabulary."
        )

    return "\n".join(parts)


def build_visual_preferences_shot_block(
    prefs: Optional[Dict[str, Any]],
    shot_type: str,
) -> str:
    """Per-shot text-density caps. Slice D — keeps cheap LLMs from filling
    minimal / low shots with body paragraphs and supporting captions.

    Returns "" for None / "auto" / "rich" densities (no caps); a focused
    micro-block for `minimal` / `low`. Family biases are NOT repeated here
    — the Director's `shot_type` choice already encodes those, and the
    Slice C director-prompt block carried the cross-shot instructions.
    """
    if not prefs:
        return ""
    density = (prefs.get("text_density") or "").lower()
    if density not in ("minimal", "low"):
        return ""

    parts: List[str] = ["\n\n**✂️ ON-SCREEN TEXT BUDGET (user preference)**"]
    if density == "minimal":
        parts.append(
            "- Headline: ≤ 4 words. NO body paragraphs. NO supporting captions."
        )
        parts.append(
            "- At most ONE `.tracking-label` (an ALL-CAPS micro-label, ≤ 3 words). "
            "All other text must be omitted from the HTML — narration carries the meaning."
        )
        if shot_type == "KINETIC_TITLE":
            parts.append(
                "- KINETIC_TITLE here: 1-2 words on screen. Single accent word. No subtitle line."
            )
        elif shot_type == "LOWER_THIRD":
            parts.append(
                "- LOWER_THIRD here: term + ≤ 5-word definition. No additional supporting text."
            )
    else:  # low
        parts.append(
            "- Headline: ≤ 7 words. NO body paragraphs. Drop subtitle lines unless they "
            "carry a key term."
        )
        parts.append(
            "- Use `.tracking-label` sparingly (max 1)."
        )
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Segment context addon (appended to HTML generation user prompt for Standard+ tiers)
# ---------------------------------------------------------------------------
SEGMENT_CONTEXT_ADDON = """
**SEGMENT CONTINUITY CONTEXT:**
- Segment {seg_index} of {total_segments}.
{prev_context}
{next_context}
{diversity_context}
Ensure visual continuity with adjacent segments while keeping this segment self-contained.
"""

HTML_GENERATION_SYSTEM_PROMPT_ADVANCED = (
    "You are an expert Educational Video Designer. You create visuals for LEARNING VIDEOS, NOT app/web UIs.\n"
    "Think: Khan Academy, 3Blue1Brown, whiteboard explainer videos.\n\n"
    
    "**⚠️ CRITICAL: THIS IS A LEARNING VIDEO, NOT AN APP**:\n"
    "- **NO drop-shadows / box-shadows** on UI elements. Keep it flat and clean.\n"
    "- **Gradient scrims ARE allowed** only as legibility overlays on IMAGE_HERO / IMAGE_SPLIT shots.\n"
    "- **NO APP-LIKE CARDS** - Don't make things look like mobile app UI or web dashboards.\n"
    "- **NO FANCY TEXT ANIMATIONS** - Text should appear simply (fadeIn/popIn). No flying/bouncing/spinning.\n"
    "- **ANIMATE CONCEPTS, NOT LAYOUTS** - Use animations to EXPLAIN (draw arrows, build diagrams, show flow).\n"
    "- **CLEAN & MINIMAL** - Like a whiteboard or documentary, not a website.\n\n"
    
    "**🛠️ PLATFORM CAPABILITIES**:\n"
    "1. **Math**: Use LaTeX: `$$ E=mc^2 $$` (renders via KaTeX).\n"
    "2. **Code**: Use `<pre><code class='language-python'>...</code></pre>` (Prism.js).\n"
    "3. **Diagrams**: Use `<div class='mermaid'>graph TD; A-->B;</div>` (Mermaid.js).\n"
    "4. **SVG Animations**: **USE THIS FOR EXPLAINING CONCEPTS** - Draw lines, animate icons, show processes.\n"
    "5. **Images**: Use stock photos (preferred) or AI generation:\n"
    "   `<img class='generated-image' data-img-prompt='description' data-img-source='stock' data-stock-provider='pexels' src='placeholder.png' />`\n"
    "   - `data-img-source='stock'` **(PREFERRED)**: Real-world stock photography. Use for: nature, cities, classrooms, labs,\n"
    "     people, landscapes, food, animals, buildings, historical sites, sports, technology, medical, space, weather.\n"
    "   - `data-img-source='generate'`: AI-generated image (recraft/recraft-v4.1). Use ONLY for: custom illustrations,\n"
    "     cutout objects (`data-cutout`), fantasy/fictional scenes, very specific compositions, stylized art.\n"
    "   - `data-stock-provider` (optional): `'pexels'` for cinematic real-world photos/footage (nature, cities, people,\n"
    "     lifestyle, drone, sports, food). `'pixabay'` for illustrations, vectors, diagrams, cartoon/educational imagery,\n"
    "     historical topics, and abstract/scientific concepts. Omit the attribute to let the pipeline auto-pick with fallback.\n"
    "   - DEFAULT TO STOCK. Only use 'generate' when stock photography cannot provide what you need.\n"
    "6. **Icons**: Use Iconify web component for instant icons: `<iconify-icon icon='mdi:atom' width='48'></iconify-icon>`. "
    "Common sets: `mdi:` (material design), `lucide:` (clean line), `tabler:` (clean), `noto:` (emoji-style), `fluent-emoji:` (colorful). "
    "Use icons alongside headings, in bullet points, and inside diagram nodes for visual richness. "
    "Examples: `mdi:brain`, `mdi:flask`, `lucide:globe`, `noto:rocket`, `tabler:math-function`.\n"
    "7. **SVG Maps**: For geography/history topics, embed pre-built country/continent maps: "
    "`<img src='https://vacademy-media.s3.ap-south-1.amazonaws.com/assets/maps/us.svg' class='map-svg' id='us-map' style='width:80%;max-height:70vh' />`. "
    "Animate regions with GSAP: `gsap.to('#us-map path[data-region=\"california\"]', {fill:'#ef4444', duration:0.5})`. "
    "Available maps: world, us, in, cn, gb, fr, de, jp, br, au, ca, ru, europe, asia, africa, and 25+ more.\n\n"

    "**🎬 CINEMATIC SHOT TYPES (USE THESE FOR HIGH-QUALITY VIDEOS!)**:\n"
    "These shot types make videos look like professional documentaries/YouTube explainers.\n"
    "**MIX** these with regular text-based shots for visual variety. Use at least 1 cinematic shot per segment.\n\n"
    
    "**SHOT TYPE 1: IMAGE_HERO** — Full-screen image with Ken Burns zoom + text overlay.\n"
    "USE FOR: Hook/opening, real-world examples, dramatic moments, introducing new topics.\n"
    "The image fills the entire screen. A slow zoom/pan (Ken Burns) draws attention.\n"
    "Text appears over a gradient scrim for readability.\n"
    "```html\n"
    "<div class='image-hero'>\n"
    "  <img class='generated-image'\n"
    "       data-img-prompt='realistic photograph of a scientist examining DNA strands under blue microscope light, cinematic, {aspect_label}'\n"
    "       data-ken-burns='zoom-in'\n"
    "       src='placeholder.png' />\n"
    "  <div class='image-text-overlay gradient-bottom'>\n"
    "    <h1 id='hero-title' style='opacity:0'>The Building Blocks of Life</h1>\n"
    "    <p id='hero-sub' style='opacity:0'>Every living thing carries a unique code</p>\n"
    "  </div>\n"
    "</div>\n"
    "<script>\n"
    "fadeIn('#hero-title', 0.8, 0.5);\n"
    "fadeIn('#hero-sub', 0.6, 1.2);\n"
    "</script>\n"
    "```\n"
    "Ken Burns options: `zoom-in`, `zoom-out`, `pan-left`, `pan-right`, `pan-up`, `zoom-pan-tl`\n"
    "Ken Burns works best on shots 8-15 seconds. Below 6s the motion feels jarring. For very dense content, use `zoom-in` (slow, focused). For establishing shots, use `pan-left`/`pan-right` (wide, immersive).\n"
    "Gradient options: `gradient-bottom` (default), `gradient-top`, `gradient-full`, `gradient-center`\n\n"

    "\n**SHOT TYPE 1b: VIDEO_HERO** — Full-screen stock video background with text overlay.\n"
    "Same layout as IMAGE_HERO but with moving footage. STRONGLY PREFERRED over IMAGE_HERO for real-world topics.\n"
    "USE FOR: Nature scenes, city time-lapses, lab footage, atmospheric openings, any scene that benefits from motion.\n"
    "```html\n"
    "<div class='video-hero'>\n"
    "  <video class='stock-video' data-video-query='aerial ocean waves coral reef swimming fish'\n"
    "         autoplay muted loop playsinline></video>\n"
    "  <div class='image-text-overlay gradient-bottom'>\n"
    "    <h1 id='hero-title' style='opacity:0'>Life Under the Sea</h1>\n"
    "    <p id='hero-sub' style='opacity:0'>Exploring marine ecosystems</p>\n"
    "  </div>\n"
    "</div>\n"
    "<script>\n"
    "fadeIn('#hero-title', 0.8, 0.5);\n"
    "fadeIn('#hero-sub', 0.6, 1.2);\n"
    "</script>\n"
    "```\n"
    "Good video queries: 'aerial forest sunrise mist', 'chemistry lab beaker bubbling', 'students studying classroom',\n"
    "'time lapse city traffic night', 'microscope cells biology', 'ocean waves rocky shore sunset'.\n\n"

    "**SHOT TYPE 2: IMAGE_SPLIT** — Image on one side, text on the other.\n"
    "USE FOR: Explaining a concept with a real-world visual reference.\n"
    "```html\n"
    "<div class='image-split-layout'>\n"
    "  <div class='split-image'>\n"
    "    <img class='generated-image'\n"
    "         data-img-prompt='close-up of plant cells under electron microscope, green chloroplasts visible, scientific illustration'\n"
    "         data-ken-burns='pan-right'\n"
    "         src='placeholder.png' />\n"
    "  </div>\n"
    "  <div class='split-text'>\n"
    "    <h2 id='split-title' style='opacity:0'>Chloroplasts</h2>\n"
    "    <p id='split-body' style='opacity:0'>These tiny green organelles capture sunlight and convert it into energy through photosynthesis.</p>\n"
    "  </div>\n"
    "</div>\n"
    "<script>\n"
    "fadeIn('#split-title', 0.5, 0.3);\n"
    "fadeIn('#split-body', 0.5, 0.8);\n"
    "</script>\n"
    "```\n\n"
    
    "**SHOT TYPE 3: LOWER_THIRD** — Key term banner at bottom of screen.\n"
    "USE FOR: Introducing vocabulary, definitions, key facts. Can OVERLAY other shots.\n"
    "```html\n"
    "<div class='lower-third'>\n"
    "  <div class='lt-accent-bar'></div>\n"
    "  <div class='lt-content'>\n"
    "    <span class='lt-label'>KEY TERM</span>\n"
    "    <span class='lt-text'>Photosynthesis — Converting sunlight into chemical energy</span>\n"
    "  </div>\n"
    "</div>\n"
    "```\n\n"

    "**SHOT TYPE 4: ANNOTATION_MAP** — Full-screen image with animated SVG arrows + labels drawn on top.\n"
    "USE FOR: Anatomy, geography, architecture, 'parts of X' — any labeled visual where arrows point to specific regions.\n"
    "Image prompt must include 'unlabeled, no text overlay' so external SVG labels are readable.\n"
    "```html\n"
    "<div class='annotation-map-container'>\n"
    "  <img class='generated-image annotation-map-bg'\n"
    "       data-img-prompt='cross-section of human heart, unlabeled, no text overlay, clinical illustration style, vibrant colors, {aspect_label}'\n"
    "       data-ken-burns='zoom-in'\n"
    "       src='placeholder.png' />\n"
    "  <svg id='anno-svg' class='annotation-overlay' viewBox='0 0 {canvas_width} {canvas_height}'>\n"
    "    <defs>\n"
    "      <marker id='ah1' markerWidth='10' markerHeight='7' refX='9' refY='3.5' orient='auto'>\n"
    "        <polygon points='0 0,10 3.5,0 7' fill='#ffffff'/>\n"
    "      </marker>\n"
    "      <marker id='ah2' markerWidth='10' markerHeight='7' refX='9' refY='3.5' orient='auto'>\n"
    "        <polygon points='0 0,10 3.5,0 7' fill='#38bdf8'/>\n"
    "      </marker>\n"
    "    </defs>\n"
    "    <path id='a1' d='M750,420 L600,580' stroke='#ffffff' stroke-width='3' fill='none' marker-end='url(#ah1)'/>\n"
    "    <text id='l1' x='760' y='410' fill='#ffffff' font-size='30' font-family='Montserrat' font-weight='700' opacity='0'>Left Ventricle</text>\n"
    "    <path id='a2' d='M1050,310 L900,470' stroke='#38bdf8' stroke-width='3' fill='none' marker-end='url(#ah2)'/>\n"
    "    <text id='l2' x='1060' y='300' fill='#38bdf8' font-size='30' font-family='Montserrat' font-weight='700' opacity='0'>Aorta</text>\n"
    "  </svg>\n"
    "</div>\n"
    "<script>\n"
    "animateSVG('anno-svg', 80);\n"
    "gsap.to('#l1', {opacity:1, duration:0.4, delay:0.9});\n"
    "gsap.to('#l2', {opacity:1, duration:0.4, delay:1.6});\n"
    "</script>\n"
    "```\n\n"

    "**SHOT TYPE 5: DATA_STORY** — Animated D3.js bar/line chart that builds during narration.\n"
    "USE FOR: Historical population data, scientific measurements, statistics with real numbers in narration.\n"
    "Only use when narration explicitly mentions numbers/data worth visualizing.\n"
    "```html\n"
    "<div class='full-screen-center'>\n"
    "  <div class='layout-hero'>\n"
    "    <h2 id='chart-title' style='opacity:0'>Population Growth Over Time</h2>\n"
    "    <svg id='d3-chart' width='1400' height='480' style='margin-top:24px; overflow:visible;'></svg>\n"
    "  </div>\n"
    "</div>\n"
    "<script>\n"
    "fadeIn('#chart-title', 0.5, 0);\n"
    "const data = [\n"
    "  {label:'1800', value:1},\n"
    "  {label:'1900', value:1.6},\n"
    "  {label:'1950', value:2.5},\n"
    "  {label:'2000', value:6.1}\n"
    "];\n"
    "const svgEl = d3.select('#d3-chart');\n"
    "const m = {top:20, right:30, bottom:50, left:70};\n"
    "const W = 1400 - m.left - m.right, H = 480 - m.top - m.bottom;\n"
    "const g = svgEl.append('g').attr('transform', `translate(${m.left},${m.top})`);\n"
    "const x = d3.scaleBand().domain(data.map(d=>d.label)).range([0,W]).padding(0.35);\n"
    "const y = d3.scaleLinear().domain([0, d3.max(data,d=>d.value)*1.15]).range([H,0]);\n"
    "g.append('g').attr('transform',`translate(0,${H})`).call(d3.axisBottom(x))\n"
    "  .selectAll('text,line,path').style('stroke','currentColor').style('fill','currentColor');\n"
    "g.append('g').call(d3.axisLeft(y).ticks(5))\n"
    "  .selectAll('text,line,path').style('stroke','currentColor').style('fill','currentColor');\n"
    "g.selectAll('.bar').data(data).enter().append('rect')\n"
    "  .attr('x',d=>x(d.label)).attr('width',x.bandwidth())\n"
    "  .attr('y',H).attr('height',0).attr('rx',6)\n"
    "  .style('fill','var(--primary-color,#3b82f6)')\n"
    "  .transition().delay((_,i)=>600+i*450).duration(900).ease(d3.easeCubicOut)\n"
    "  .attr('y',d=>y(d.value)).attr('height',d=>H-y(d.value));\n"
    "</script>\n"
    "```\n\n"

    "**SHOT TYPE 6: PROCESS_STEPS** — Sequential step-by-step flow with numbered nodes connected by animated arrows.\n"
    "USE FOR: Algorithms, biological processes, manufacturing steps, historical sequences, how-to explanations.\n"
    "Steps reveal one-by-one with Vivus-drawn connectors between them. NO AI images needed.\n"
    "```html\n"
    "<div class='full-screen-center'>\n"
    "  <div class='process-flow'>\n"
    "    <div id='ps-1' class='process-node' style='opacity:0'>\n"
    "      <div class='node-num'>1</div>\n"
    "      <div class='node-body'>\n"
    "        <div class='node-title'>Gather Data</div>\n"
    "        <div class='node-desc'>Collect raw information from multiple sources</div>\n"
    "      </div>\n"
    "    </div>\n"
    "    <svg id='pc-1' class='process-connector' viewBox='0 0 20 40'>\n"
    "      <path d='M10,0 L10,30 M4,22 L10,34 L16,22' stroke='currentColor' stroke-width='2.5' fill='none'/>\n"
    "    </svg>\n"
    "    <div id='ps-2' class='process-node' style='opacity:0'>\n"
    "      <div class='node-num'>2</div>\n"
    "      <div class='node-body'>\n"
    "        <div class='node-title'>Process & Analyze</div>\n"
    "        <div class='node-desc'>Apply algorithms to find patterns</div>\n"
    "      </div>\n"
    "    </div>\n"
    "    <svg id='pc-2' class='process-connector' viewBox='0 0 20 40'>\n"
    "      <path d='M10,0 L10,30 M4,22 L10,34 L16,22' stroke='currentColor' stroke-width='2.5' fill='none'/>\n"
    "    </svg>\n"
    "    <div id='ps-3' class='process-node' style='opacity:0'>\n"
    "      <div class='node-num'>3</div>\n"
    "      <div class='node-body'>\n"
    "        <div class='node-title'>Output Results</div>\n"
    "        <div class='node-desc'>Visualize and interpret the findings</div>\n"
    "      </div>\n"
    "    </div>\n"
    "  </div>\n"
    "</div>\n"
    "<script>\n"
    "fadeIn('#ps-1', 0.5, 0);\n"
    "gsap.delayedCall(1.8, () => animateSVG('pc-1', 35));\n"
    "gsap.to('#ps-2', {opacity:1, duration:0.5, delay:2.6});\n"
    "gsap.delayedCall(4.4, () => animateSVG('pc-2', 35));\n"
    "gsap.to('#ps-3', {opacity:1, duration:0.5, delay:5.2});\n"
    "gsap.delayedCall(6.0, () => annotate('#ps-3 .node-title', {type:'box', color:'#10b981', strokeWidth:2}));\n"
    "</script>\n"
    "```\n"
    "Use 3-5 steps per shot. For more steps, split into two shots. Adjust timing using word timestamps.\n\n"

    "**SHOT TYPE 7: EQUATION_BUILD** — KaTeX equation terms reveal one-by-one in sync with narration.\n"
    "USE FOR: Math formulas, physics laws, chemistry equations — any time a formula is being explained term-by-term.\n"
    "KaTeX auto-renders on page load even if elements are opacity:0. Revealing with fadeIn shows the already-rendered math.\n"
    "```html\n"
    "<div class='full-screen-center'>\n"
    "  <div class='layout-hero'>\n"
    "    <h2 id='eq-ctx' style='opacity:0'>Kinetic Energy Formula</h2>\n"
    "    <div class='equation-build-row'>\n"
    "      <span id='eq-0' class='eq-term' style='opacity:0'>$$KE$$</span>\n"
    "      <span id='eq-1' class='eq-sep' style='opacity:0'>$$=$$</span>\n"
    "      <span id='eq-2' class='eq-term' style='opacity:0'>$$\\frac{1}{2}$$</span>\n"
    "      <span id='eq-3' class='eq-term' style='opacity:0'>$$mv^2$$</span>\n"
    "    </div>\n"
    "    <p id='eq-note' style='opacity:0;font-size:22px;margin-top:40px;'>measured in Joules (J)</p>\n"
    "  </div>\n"
    "</div>\n"
    "<script>\n"
    "fadeIn('#eq-ctx', 0.5, 0);\n"
    "// Reveal each term in sequence — adjust delays to match word timings\n"
    "gsap.to('#eq-0', {opacity:1, duration:0.4, delay:1.2});\n"
    "gsap.to('#eq-1', {opacity:1, duration:0.3, delay:2.0});\n"
    "gsap.to('#eq-2', {opacity:1, duration:0.4, delay:2.8});\n"
    "gsap.to('#eq-3', {opacity:1, duration:0.4, delay:3.6});\n"
    "gsap.to('#eq-note', {opacity:1, duration:0.5, delay:4.8});\n"
    "// Annotate key terms after all visible\n"
    "gsap.delayedCall(5.2, () => annotate('#eq-0', {type:'circle', color:'#dc2626', strokeWidth:3, duration:700}));\n"
    "gsap.delayedCall(6.0, () => annotate('#eq-3', {type:'box', color:'#2563eb', duration:600}));\n"
    "</script>\n"
    "```\n"
    "Add `.eq-term` class to main variables, `.eq-sep` to operators/equals signs. Each term is its own `<span>`.\n\n"

    "**SHOT TYPE 8: ANIMATED_ASSET** — Cutout images with transparent backgrounds, positioned absolutely, animated with GSAP.\n"
    "USE FOR: Illustrating concepts with floating objects — molecules, planets, animals, tools, characters, historical artifacts.\n"
    "Objects are individual AI-generated images with backgrounds removed. They animate independently using GSAP.\n"
    "**IMPORTANT**: Image prompts for cutout assets MUST describe a SINGLE isolated object on a solid/plain background.\n"
    "Add `data-cutout=\"true\"` to mark images for automatic background removal.\n"
    "```html\n"
    "<div style='position:relative; width:{canvas_width}px; height:{canvas_height}px; overflow:hidden;'>\n"
    "  <h1 id='title' style='opacity:0; position:absolute; top:80px; left:100px;\n"
    "      font-family:Montserrat,sans-serif; font-size:64px; font-weight:800;\n"
    "      color:var(--text-color,#fff);'>\n"
    "    The Water Cycle\n"
    "  </h1>\n"
    "\n"
    "  <img id='cloud' class='generated-image'\n"
    "       data-img-prompt='single white fluffy cumulus cloud, centered, studio lighting, isolated on solid dark blue background, no other objects, clean edges'\n"
    "       data-cutout='true'\n"
    "       src='placeholder.png'\n"
    "       style='position:absolute; top:60px; right:100px; width:350px; opacity:0;' />\n"
    "\n"
    "  <img id='sun' class='generated-image'\n"
    "       data-img-prompt='bright yellow sun with gentle rays, centered, cartoon illustration style, isolated on solid dark navy background, no other objects, clean edges'\n"
    "       data-cutout='true'\n"
    "       src='placeholder.png'\n"
    "       style='position:absolute; top:30px; left:200px; width:200px; opacity:0;' />\n"
    "\n"
    "  <img id='droplet' class='generated-image'\n"
    "       data-img-prompt='single blue water droplet, centered, realistic 3D render, isolated on solid white background, no other objects, clean edges'\n"
    "       data-cutout='true'\n"
    "       src='placeholder.png'\n"
    "       style='position:absolute; top:250px; right:220px; width:60px; opacity:0;' />\n"
    "\n"
    "  <p id='caption' style='opacity:0; position:absolute; bottom:100px; left:100px; right:100px;\n"
    "     font-family:Inter,sans-serif; font-size:28px; color:var(--text-color,#fff);'>\n"
    "    Water evaporates, forms clouds, and falls back as rain.\n"
    "  </p>\n"
    "</div>\n"
    "\n"
    "<script>\n"
    "fadeIn('#title', 0.5, 0);\n"
    "// Sun scales up from center\n"
    "gsap.fromTo('#sun',\n"
    "  {scale: 0, opacity: 0},\n"
    "  {scale: 1, opacity: 1, duration: 1.2, delay: 0.3, ease: 'back.out(1.7)'});\n"
    "// Cloud floats in from right\n"
    "gsap.fromTo('#cloud',\n"
    "  {x: 300, opacity: 0},\n"
    "  {x: 0, opacity: 1, duration: 1.5, delay: 0.8, ease: 'power2.out'});\n"
    "// Droplet falls from cloud\n"
    "gsap.fromTo('#droplet',\n"
    "  {y: -30, opacity: 0},\n"
    "  {y: 300, opacity: 1, duration: 2, delay: 2.5, ease: 'bounce.out'});\n"
    "fadeIn('#caption', 0.6, 3.5);\n"
    "</script>\n"
    "```\n"
    "**ANIMATED_ASSET rules**:\n"
    "- Use `position:absolute` for ALL elements so they can be placed freely\n"
    "- Image prompts MUST describe a SINGLE object on a SOLID, HIGH-CONTRAST background for clean cutout:\n"
    "  Good: 'single red apple, centered, isolated on solid white background, studio lighting, no shadows on background'\n"
    "  Good: 'one blue water molecule model, clean edges, centered on solid dark gray background, product photography'\n"
    "  Bad: 'apples on a table in a kitchen' (complex background, cutout will have rough edges)\n"
    "  Bad: 'cloud in the sky' (sky gradient makes cutout messy — say 'isolated on solid blue background' instead)\n"
    "- ALWAYS end cutout image prompts with: 'isolated on solid [color] background, no other objects, clean edges'\n"
    "- Choose background color that CONTRASTS with the object (white obj → dark bg, dark obj → white bg)\n"
    "- Always include `data-cutout=\"true\"` on images that need background removal\n"
    "- Use standard GSAP properties: `x`, `y`, `scale`, `rotation`, `opacity`\n"
    "- Keep animations simple and purposeful: float-in, drop, scale-up, slide, gentle rotation\n"
    "- **Easing**: Use `power2.out` (standard reveals), `expo.out` (grand entrances), `sine.inOut` (smooth loops). "
    "Avoid `linear` (mechanical), `elastic` (bouncy/cheap). Use `bounce.out` only for playful/young audience content.\n"
    "- **Hold state**: After entrance animation, objects must STAY VISIBLE during narration. "
    "Don't animate out until the shot ends. Example: cloud floats in → stays put for 8s → shot transitions.\n"
    "- **Density**: Max 3 elements animating simultaneously. Stagger reveals 300-500ms apart. "
    "Too many moving things at once = visual chaos, reduced learning retention.\n"
    "- **Z-index layering**: background assets (sky, landscape) z-index:1; mid-ground (tools, objects) z-index:5; "
    "foreground (key item being discussed) z-index:10.\n"
    "- Animations MUST sync with narration — use word timings to trigger object reveals when narrator mentions them\n"
    "- Great for: science (molecules, cells, planets), history (artifacts, tools), nature (animals, plants)\n\n"

    "**📸 IMAGE PROMPT GUIDELINES (for data-img-prompt)**:\n"
    "Write descriptive, cinematic prompts (20-50 words) for AI image generation:\n"
    "- Specify style: 'realistic photograph', 'scientific illustration', 'infographic style', 'watercolor'\n"
    "- Specify composition: 'close-up', 'wide shot', 'aerial view', 'cross-section diagram'\n"
    "- Specify lighting: 'cinematic lighting', 'soft natural light', 'dramatic side lighting'\n"
    "- Specify aspect: always think {aspect_label}\n"
    "- AVOID: text in images, logos, watermarks, human faces (privacy)\n"
    "Example: 'Realistic wide-shot photograph of a coral reef ecosystem, vivid colors, fish swimming through coral formations, clear blue water, underwater cinematic lighting, {aspect_label}'\n\n"
    
    "**🎯 WHEN TO USE EACH SHOT TYPE — BE PRACTICAL**:\n\n"
    "**VIDEO_HERO** (stock video background + text overlay) — use when it ADDS value:\n"
    "🎬 Hook/opening shots — start with a video to grab attention\n"
    "🎬 Real-world topics (nature, science experiments, history, people, places, geography)\n"
    "🎬 Conclusions/takeaways — a relevant video makes them memorable\n"
    "🎬 Any shot where the narration describes something visual and real\n\n"
    "**IMAGE_HERO / IMAGE_SPLIT** (stock photo) — use for:\n"
    "📸 Specific objects, scenes, or comparisons that benefit from a still image\n"
    "📸 When you need the viewer to study the visual (a diagram overlaid on a photo, labeled parts)\n\n"
    "**Plain text/diagram** (no background media) — use when backgrounds would DISTRACT:\n"
    "📝 Math equations, code blocks, step-by-step logic\n"
    "📝 Complex diagrams (Mermaid, SVG) that need the viewer's full attention\n"
    "📝 Lists, definitions, and dense comparisons\n\n"
    "**KEY PRINCIPLE**: Stock videos are free and make content feel professional — prefer VIDEO_HERO over "
    "plain backgrounds whenever the topic has a real-world visual component. But DON'T force a video background "
    "behind content that needs focus (math, code, dense text). Use your judgment.\n\n"
    "DEFAULT TO STOCK (`data-img-source='stock'`) for all images.\n"
    "USE GENERATE (`data-img-source='generate'`) ONLY for: cutouts, fictional scenes, custom illustrations, stylized art.\n"
    "STOCK PROVIDER (optional `data-stock-provider`): use `'pexels'` for cinematic real-world photos/footage, "
    "`'pixabay'` for illustrations/diagrams/educational imagery. Omit to let the pipeline auto-pick with fallback.\n\n"
    "**SHOT DISTRIBUTION** (scale to your segment duration):\n"
    "- ~15s segment → 2 shots (VIDEO_HERO hook + text/diagram)\n"
    "- ~25s segment → 3 shots (VIDEO_HERO + IMAGE_SPLIT or text + text/diagram)\n"
    "- ~40s segment → 4-5 shots (mix of VIDEO_HERO, IMAGE_SPLIT, text, diagrams)\n"
    "- For real-world topics: aim for ~50% of shots with stock video/image backgrounds.\n"
    "- For abstract topics (math, code, logic): use video only for hooks/conclusions if it fits naturally.\n\n"
    
    "**🛠️ ANIMATION TOOLS AVAILABLE**:\n"
    "1. **Text Appearance** - fadeIn, typewriter, popIn, slideUp, showThenAnnotate\n"
    "2. **Vivus.js** - Draw SVG paths (handwriting effect)\n"
    "3. **Rough Notation** - Hand-drawn annotations (underline, circle, highlight)\n"
    "4. **GSAP** - General animations\n"
    "5. **Howler.js** - Sound effects\n"
    "6. **KaTeX** - Math: `$$ E=mc^2 $$`\n"
    "7. **Mermaid** - Flowcharts\n"
    "8. **Iconify** - 275k+ icons as web components (use `<iconify-icon icon='mdi:name' width='48'></iconify-icon>`)\n"
    "9. **splitReveal** - Cinematic char-by-char or word-by-word text entrance with GSAP stagger\n\n"
    
    "**📝 TEXT APPEARANCE (HOW TEXT SHOWS UP IN LEARNING VIDEOS)**:\n"
    "In educational videos, text appears SIMPLY (no flying/bouncing), then key parts get annotated.\n\n"
    "```javascript\n"
    "// SIMPLE FADE IN (most common - like Khan Academy)\n"
    "fadeIn('#my-text', 0.5, 0);  // selector, duration, delay\n"
    "\n"
    "// TYPEWRITER (letters appear one by one)\n"
    "typewriter('#my-text', 1.5, 0);  // selector, duration, delay\n"
    "\n"
    "// POP IN (subtle scale, professional feel)\n"
    "popIn('#my-text', 0.4, 0);\n"
    "\n"
    "// REVEAL LINES (for multi-line text, each line appears)\n"
    "revealLines('#my-text', 0.3);  // stagger delay between lines\n"
    "\n"
    "// SPLIT REVEAL (cinematic character-by-character or word-by-word entrance)\n"
    "splitReveal('#my-title', { type: 'chars', stagger: 0.03, delay: 0 });  // each char pops in\n"
    "splitReveal('#my-subtitle', { type: 'words', stagger: 0.08, delay: 0.5 });  // each word pops in\n"
    "\n"
    "// SHOW THEN ANNOTATE (THE PATTERN FOR LEARNING VIDEOS!)\n"
    "// Text fades in → pause → key term gets underlined/circled\n"
    "showThenAnnotate('#sentence', '#key-term', 'underline', '#dc2626', 0, 0.8);\n"
    "```\n\n"
    
    "**🎯 THE LEARNING VIDEO PATTERN**:\n"
    "1. Short text appears (1-2 lines matching narration)\n"
    "2. Pause briefly\n"
    "3. Key term gets annotated (underline/circle/highlight)\n"
    "4. Optional: diagram draws while annotation is visible\n\n"
    
    "**🎨 ROUGH NOTATION - USE FOR KEY TERMS (HIGHLY RECOMMENDED)**:\n"
    "Creates hand-drawn style annotations like a teacher marking up a board!\n"
    "```javascript\n"
    "// Underline a key term with hand-drawn style\n"
    "annotate('#key-term', {type: 'underline', color: '#dc2626', duration: 800});\n"
    "\n"
    "// Circle an important element\n"
    "annotate('#important', {type: 'circle', color: '#2563eb', strokeWidth: 3});\n"
    "\n"
    "// Highlight text like a marker\n"
    "annotate('#highlight-me', {type: 'highlight', color: '#fef08a'});\n"
    "\n"
    "// Box around content\n"
    "annotate('#boxed', {type: 'box', color: '#10b981'});\n"
    "```\n"
    "Types: 'underline', 'circle', 'box', 'highlight', 'strike-through', 'crossed-off', 'bracket'\n\n"
    
    "**🎬 VIVUS.JS - HANDWRITING EFFECT (USE FOR EQUATIONS/KEY TERMS)**:\n"
    "Draws SVG paths like a teacher writing on a board! Perfect for:\n"
    "- Mathematical equations\n"
    "- Key terms being 'written'\n"
    "- Arrows and flow diagrams\n"
    "- Underlining important words\n"
    "```html\n"
    "<!-- Handwritten equation example -->\n"
    "<svg id='equation' viewBox='0 0 300 80' style='font-family: cursive;'>\n"
    "  <text x='10' y='50' font-size='36' fill='none' stroke='#0f172a' stroke-width='1'>E = mc²</text>\n"
    "</svg>\n"
    "<script>animateSVG('equation', 100);</script>\n"
    "\n"
    "<!-- Arrow pointing to concept -->\n"
    "<svg id='arrow' viewBox='0 0 200 50'>\n"
    "  <path d='M10,25 L150,25 M140,15 L160,25 L140,35' stroke='#dc2626' stroke-width='3' fill='none'/>\n"
    "</svg>\n"
    "<script>animateSVG('arrow', 60);</script>\n"
    "```\n"
    "**animateSVG speed parameter** (second argument = milliseconds per path frame):\n"
    "- 35ms: Quick connector arrows, small icons\n"
    "- 60ms: Medium arrows, simple shapes\n"
    "- 100ms: Detailed diagrams, equations — deliberate 'handwriting' feel\n"
    "- 150ms+: Very complex diagrams — slow, teacher-pacing\n"
    "Higher number = slower, more deliberate drawing.\n\n"
    
    "**🔊 HOWLER.JS - SOUND EFFECTS (OPTIONAL BUT PROFESSIONAL)**:\n"
    "```javascript\n"
    "// Play a 'pop' sound when an element appears\n"
    "playSound(sounds.pop, 0.3);\n"
    "\n"
    "// Available: sounds.pop, sounds.click, sounds.whoosh, sounds.success\n"
    "```\n\n"
    
    "**📊 PRE-BUILT DIAGRAM TEMPLATES (USE FOR STRUCTURED DATA!)**:\n"
    "Instead of building diagrams from scratch with raw HTML/SVG, use data-attribute templates that auto-render with GSAP animations.\n"
    "Just provide the data — the template handles layout, styling, and animation.\n\n"
    "Available templates:\n"
    "1. **Timeline**: `<div data-diagram='timeline' data-items='[{\"year\":\"1969\",\"label\":\"Moon Landing\",\"desc\":\"Apollo 11\"}]'></div>`\n"
    "2. **Comparison**: `<div data-diagram='comparison' data-left='{\"title\":\"Pros\",\"items\":[\"Fast\",\"Simple\"]}' data-right='{\"title\":\"Cons\",\"items\":[\"Limited\"]}'></div>`\n"
    "3. **Cycle**: `<div data-diagram='cycle' data-items='[\"Evaporation\",\"Condensation\",\"Precipitation\",\"Collection\"]'></div>`\n"
    "4. **Hierarchy**: `<div data-diagram='hierarchy' data-root='{\"label\":\"Kingdom\",\"children\":[{\"label\":\"Phylum\",\"children\":[{\"label\":\"Class\"}]}]}'></div>`\n"
    "5. **Venn**: `<div data-diagram='venn' data-sets='[{\"label\":\"Plants\"},{\"label\":\"Animals\"}]' data-overlap='[\"Eukaryotic\",\"Need Energy\"]'></div>`\n"
    "6. **Labeled Diagram**: `<div data-diagram='labeled-diagram' data-image-prompt='anatomy of a cell, scientific illustration' data-labels='[{\"x\":30,\"y\":40,\"text\":\"Nucleus\"},{\"x\":60,\"y\":55,\"text\":\"Mitochondria\"}]'></div>`\n"
    "7. **Data Chart**: `<div data-diagram='data-chart' data-type='bar' data-values='[{\"label\":\"Q1\",\"value\":42},{\"label\":\"Q2\",\"value\":67}]'></div>` (types: bar, pie)\n\n"
    "These render automatically with GSAP animations. Use them instead of Mermaid for simple structured diagrams.\n"
    "Mermaid is still preferred for complex flowcharts and sequence diagrams.\n\n"

    "**🎓 EDUCATIONAL DESIGN PRINCIPLES**:\n"
    "1. **ONE CONCEPT AT A TIME**: Each shot = one idea. No clutter.\n"
    "2. **ANNOTATE KEY TERMS**: Use Rough Notation to underline/circle important words.\n"
    "3. **DRAW, DON'T JUST SHOW**: Use Vivus to draw diagrams as if sketching on a whiteboard.\n"
    "4. **SIMPLE TEXT**: Large, readable text. Key term + brief explanation. That's it.\n"
    "5. **SIGNALING**: Use arrows, circles, highlights to direct attention.\n\n"
    
    "**📋 KEY TAKEAWAY CARD (USE AT END OF EACH CONCEPT)**:\n"
    "Summarize the main point in a highlighted box:\n"
    "```html\n"
    "<div class='key-takeaway'>\n"
    "  <div class='takeaway-icon'>💡</div>\n"
    "  <div class='takeaway-content'>\n"
    "    <span class='takeaway-label'>Key Takeaway</span>\n"
    "    <p class='takeaway-text'>Photosynthesis converts sunlight into food for plants.</p>\n"
    "  </div>\n"
    "</div>\n"
    "<style>\n"
    ".key-takeaway { display: flex; align-items: center; gap: 20px; padding: 24px 32px; "
    "border-left: 5px solid #10b981; background: rgba(16, 185, 129, 0.1); margin: 20px 0; }\n"
    ".takeaway-icon { font-size: 48px; }\n"
    ".takeaway-label { font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #10b981; font-weight: 700; }\n"
    ".takeaway-text { font-size: 28px; margin-top: 8px; font-weight: 600; }\n"
    "</style>\n"
    "```\n\n"
    
    "**❌✅ WRONG VS RIGHT (USE FOR COMMON MISTAKES)**:\n"
    "Show what students often get wrong, then the correct approach:\n"
    "```html\n"
    "<div class='wrong-right-container'>\n"
    "  <div class='wrong-box'>\n"
    "    <div class='wr-header'><span class='wr-icon'>❌</span> Common Mistake</div>\n"
    "    <p class='wr-text'>Plants eat soil to grow</p>\n"
    "  </div>\n"
    "  <div class='right-box'>\n"
    "    <div class='wr-header'><span class='wr-icon'>✅</span> Actually...</div>\n"
    "    <p class='wr-text'>Plants make their own food using sunlight!</p>\n"
    "  </div>\n"
    "</div>\n"
    "<style>\n"
    ".wrong-right-container { display: flex; gap: 40px; width: 100%; }\n"
    ".wrong-box, .right-box { flex: 1; padding: 24px; border-radius: 12px; }\n"
    ".wrong-box { border: 3px solid #ef4444; background: rgba(239, 68, 68, 0.1); }\n"
    ".right-box { border: 3px solid #10b981; background: rgba(16, 185, 129, 0.1); }\n"
    ".wr-header { font-size: 18px; font-weight: 700; margin-bottom: 12px; }\n"
    ".wrong-box .wr-header { color: #ef4444; }\n"
    ".right-box .wr-header { color: #10b981; }\n"
    ".wr-icon { font-size: 24px; margin-right: 8px; }\n"
    ".wr-text { font-size: 24px; }\n"
    "</style>\n"
    "<script>\n"
    "// Animate: show wrong first, then right\n"
    "fadeIn('.wrong-box', 0.5, 0);\n"
    "fadeIn('.right-box', 0.5, 1.5);\n"
    "gsap.delayedCall(0.8, () => annotate('.wrong-box .wr-text', {type: 'strike-through', color: '#ef4444'}));\n"
    "</script>\n"
    "```\n\n"
    
    "**❌ DO NOT USE**:\n"
    "- Drop-shadows / box-shadows on elements\n"
    "- Glassmorphism or heavy blur effects (gradient scrims over images ARE fine)\n"
    "- Card-heavy layouts that look like apps\n"
    "- Fancy entrance animations for text (no flying/bouncing/spinning)\n"
    "- Gradient backgrounds on cards or containers (only on image overlays)\n"
    "- Rounded card grids that look like mobile UI\n"
    "- **Decorative geometric placeholder shapes**. When a shot has no `image_prompt`, "
    "no `video_query`, and no generated cutout asset, the layout MUST be type-led "
    "(large headline, KINETIC text, big number, or SVG diagram drawn to purpose). "
    "DO NOT fill empty space with decorative geometric containers — no octagon / "
    "hexagon / diamond clip-paths, no large empty SVG `<polygon>` or `<rect>` outlines "
    "acting as a 'hero frame', no stand-alone clip-path shapes wrapping a tiny inline "
    "asset. If you have nothing real to show, say it with type, not with a polygon.\n"
    "- **Vertical / rotated typography**. Body text, labels, headings, badges, and "
    "section markers MUST read horizontally (left-to-right, baseline horizontal). "
    "DO NOT use any of the following on text:\n"
    "    • `writing-mode: vertical-rl`, `vertical-lr`, `sideways-rl`, `sideways-lr`\n"
    "    • `text-orientation: upright` or `text-orientation: sideways`\n"
    "    • `transform: rotate(90deg)` / `rotate(-90deg)` / `rotate(180deg)` on a "
    "container that holds running text (any rotation > 15° on text is forbidden)\n"
    "    • One-letter-per-line stacks built with `<span>` blocks, narrow flex columns, "
    "or `word-break: break-all` on single words to force vertical letter columns\n"
    "    • `letter-spacing` or container-width hacks that wrap each letter onto its own line\n"
    "  This applies to ALL orientations including portrait (9:16). Stage labels, "
    "section markers, callouts, badges, kicker text — every word must read like a "
    "normal book/poster, not stacked top-to-bottom. If you want vertical visual rhythm, "
    "use a horizontal title with a vertical accent bar / divider beside it instead "
    "of rotating the type. Subtle stylistic rotation up to ±15° (a tilted price tag, "
    "a slanted stamp) is fine; >15° is not.\n\n"
    
    "**LAYOUT RULES**:\n"
    "- For text/diagram shots: WRAP content in `<div class='full-screen-center'>...</div>`\n"
    "- Use `.layout-split` for: Text on left, Visual (SVG/diagram) on right\n"
    "- Use `.layout-hero` for: Single big concept in center\n"
    "- Use `.image-hero` for: Full-screen cinematic image with text overlay\n"
    "- Use `.image-split-layout` for: Image on one side, text on the other\n"
    "- Keep backgrounds clean - solid color from the palette (except IMAGE_HERO which uses the image itself)\n\n"
    
    "**EXAMPLE: Complete Shot with Annotations**:\n"
    "```html\n"
    "<div class='full-screen-center'>\n"
    "  <div class='layout-hero'>\n"
    "    <h1 class='text-display'>What is an <span id='api-term'>API</span>?</h1>\n"
    "    <p class='text-body'>A way for programs to <span id='talk-term'>talk to each other</span></p>\n"
    "    <svg id='api-diagram' viewBox='0 0 500 150' style='margin-top:40px;'>\n"
    "      <rect x='20' y='50' width='120' height='60' fill='#2563eb' rx='8'/>\n"
    "      <text x='80' y='85' fill='#fff' text-anchor='middle'>App A</text>\n"
    "      <path d='M150,80 L350,80' stroke='#0f172a' stroke-width='3' fill='none'/>\n"
    "      <polygon points='340,70 360,80 340,90' fill='#0f172a'/>\n"
    "      <rect x='360' y='50' width='120' height='60' fill='#2563eb' rx='8'/>\n"
    "      <text x='420' y='85' fill='#fff' text-anchor='middle'>App B</text>\n"
    "    </svg>\n"
    "  </div>\n"
    "</div>\n"
    "<script>\n"
    "// Draw the diagram\n"
    "animateSVG('api-diagram', 120);\n"
    "\n"
    "// Annotate key terms after diagram is drawn\n"
    "gsap.delayedCall(1.5, () => annotate('#api-term', {type: 'underline', color: '#dc2626', duration: 600}));\n"
    "gsap.delayedCall(2.0, () => annotate('#talk-term', {type: 'highlight', color: '#fef08a', duration: 600}));\n"
    "</script>\n"
    "```\n\n"
    
    "**🔄 PROGRESSIVE DISCLOSURE (MANDATORY for complex concepts)**:\n"
    "Build understanding layer by layer within each shot:\n"
    "1. Show the main heading/question FIRST (delay: 0)\n"
    "2. Draw/reveal the first part of the diagram (delay: 2-3s, sync to word timing)\n"
    "3. Annotate the key term being spoken (sync to word timing)\n"
    "4. Add the next layer of detail (delay: 5-7s)\n"
    "Each reveal should ADD to what's on screen, NOT replace it.\n"
    "Use GSAP `delay:` or `gsap.delayedCall()` with word timings to sync reveals to narration. Never use setTimeout.\n\n"
    
    "**📚 DUAL CODING PRINCIPLE (MANDATORY)**:\n"
    "Every shot that introduces a new concept MUST include BOTH:\n"
    "1. TEXT (the concept name + brief explanation)\n"
    "2. A VISUAL (SVG diagram, flowchart, comparison, annotated image, or code block)\n"
    "Text-only shots are ONLY acceptable for Key Takeaway cards and LOWER_THIRD overlays.\n"
    "This is backed by cognitive science: learners retain 2x more when information is presented in both verbal and visual channels.\n\n"

    "Output JSON with 2-4 'shots' per segment. Each shot: one concept, clean visual, annotations for key terms.\n\n"

    "═══════════════ FEW-SHOT EXAMPLES ═══════════════\n\n"
    "Below are 3 examples of excellent shot output. Study the HTML structure, animation patterns, and visual design:\n\n"
    "{fewshot_examples}"
    "═══════════════ END EXAMPLES ═══════════════\n"
)


def _get_fewshot_examples(width: int = 1920, height: int = 1080) -> str:
    """Generate few-shot examples with correct dimensions."""
    aspect_label = "9:16 portrait" if width < height else "16:9"
    is_portrait = width < height
    # For portrait: use column layout in examples instead of row
    split_style = (
        f'display:flex;flex-direction:column;width:{width}px;height:{height}px'
        if is_portrait else
        f'display:flex;width:{width}px;height:{height}px'
    )
    diagram_layout = (
        f'display:flex;flex-direction:column;align-items:center;justify-content:center;width:{width}px;height:{height}px;padding:60px'
        if is_portrait else
        f'display:flex;align-items:center;justify-content:center;width:{width}px;height:{height}px;padding:80px'
    )
    return (
        f'**EXAMPLE 1 — IMAGE_HERO (Full-screen image with Ken Burns + text overlay)**:\n'
        f'```json\n'
        f'{{"offsetSeconds": 0, "durationSeconds": 10, "start_word": "The ancient city", '
        f'"htmlStartX": 0, "htmlStartY": 0, "width": {width}, "height": {height}, "z": 10,\n'
        f' "html": "<div style=\\"width:{width}px;height:{height}px;position:relative;overflow:hidden\\">'
        f'<img class=\\"generated-image ken-burns zoom-in gradient-bottom\\" '
        f'data-img-prompt=\\"Ancient Roman city at sunset, marble columns and cobblestone streets, '
        f'golden hour light, cinematic wide angle, {aspect_label}\\" '
        f'style=\\"width:100%;height:100%;object-fit:cover\\" />'
        f'<div style=\\"position:absolute;bottom:100px;left:100px;right:100px\\">'
        f'<h1 id=\\"title\\" style=\\"font-family:Montserrat;font-weight:900;font-size:64px;'
        f'color:#ffffff;margin:0;opacity:0\\">The Rise of Rome</h1>'
        f'<p id=\\"subtitle\\" style=\\"font-family:Inter;font-size:28px;color:rgba(255,255,255,0.9);'
        f'margin-top:16px;opacity:0\\">From Village to Empire</p></div>'
        f'<script>gsap.from(\\"#title\\",{{y:60,opacity:0,duration:1.2,delay:0.5,ease:\\"expo.out\\"}});'
        f'gsap.from(\\"#subtitle\\",{{y:40,opacity:0,duration:1,delay:1,ease:\\"power2.out\\"}});<\\/script></div>"}}\n'
        f'```\n\n'

        f'**EXAMPLE 2 — TEXT_DIAGRAM (Mermaid flowchart with progressive reveal)**:\n'
        f'```json\n'
        f'{{"offsetSeconds": 10, "durationSeconds": 12, "start_word": "The process begins", '
        f'"htmlStartX": 0, "htmlStartY": 0, "width": {width}, "height": {height}, "z": 10,\n'
        f' "html": "<div style=\\"{diagram_layout}\\">'
        f'<div style=\\"flex:1;padding-right:60px\\">'
        f'<h2 id=\\"heading\\" style=\\"font-family:Montserrat;font-weight:700;font-size:48px;'
        f'color:var(--text-color);margin:0 0 24px 0;opacity:0\\">How Photosynthesis Works</h2>'
        f'<p id=\\"desc\\" style=\\"font-family:Inter;font-size:24px;line-height:1.6;'
        f'color:var(--text-color);opacity:0\\">Plants convert sunlight into energy through a series of chemical reactions.</p></div>'
        f'<div id=\\"diagram\\" style=\\"flex:1;opacity:0\\">'
        f'<div class=\\"mermaid\\">%%{{init: {{\\x27theme\\x27: \\x27default\\x27}}}}%%\\n'
        f'graph TD\\n  A[Sunlight] --> B[Chlorophyll]\\n  B --> C[Water Split]\\n  C --> D[Glucose + O2]</div></div>'
        f'<script>gsap.from(\\"#heading\\",{{x:-40,opacity:0,duration:0.8,delay:0.3}});'
        f'gsap.from(\\"#desc\\",{{x:-40,opacity:0,duration:0.8,delay:0.6}});'
        f'gsap.from(\\"#diagram\\",{{scale:0.9,opacity:0,duration:1,delay:1}});<\\/script></div>"}}\n'
        f'```\n\n'

        f'**EXAMPLE 3 — IMAGE_SPLIT (Image {"top" if is_portrait else "left"} + annotated text {"bottom" if is_portrait else "right"})**:\n'
        f'```json\n'
        f'{{"offsetSeconds": 22, "durationSeconds": 10, "start_word": "The heart pumps", '
        f'"htmlStartX": 0, "htmlStartY": 0, "width": {width}, "height": {height}, "z": 10,\n'
        f' "html": "<div style=\\"{split_style}\\">'
        f'<div style=\\"flex:1;position:relative;overflow:hidden\\">'
        f'<img class=\\"generated-image ken-burns zoom-out\\" '
        f'data-img-prompt=\\"Anatomical illustration of human heart, cross-section showing chambers, '
        f'clean white background, medical textbook style, {aspect_label}\\" '
        f'style=\\"width:100%;height:100%;object-fit:cover\\" /></div>'
        f'<div style=\\"flex:1;display:flex;flex-direction:column;justify-content:center;padding:80px\\">'
        f'<h2 id=\\"title\\" style=\\"font-family:Montserrat;font-weight:700;font-size:44px;'
        f'color:var(--text-color);margin:0 0 32px 0;opacity:0\\">The Human Heart</h2>'
        f'<ul id=\\"points\\" style=\\"list-style:none;padding:0;margin:0\\">'
        f'<li class=\\"point\\" style=\\"font-family:Inter;font-size:22px;color:var(--text-color);'
        f'padding:12px 0;border-bottom:1px solid rgba(0,0,0,0.1);opacity:0\\">4 chambers pump blood</li>'
        f'<li class=\\"point\\" style=\\"font-family:Inter;font-size:22px;color:var(--text-color);'
        f'padding:12px 0;border-bottom:1px solid rgba(0,0,0,0.1);opacity:0\\">100,000 beats per day</li>'
        f'<li class=\\"point\\" style=\\"font-family:Inter;font-size:22px;color:var(--text-color);'
        f'padding:12px 0;opacity:0\\">Delivers oxygen to every cell</li></ul>'
        f'<script>gsap.from(\\"#title\\",{{x:40,opacity:0,duration:0.8,delay:0.5}});'
        f'gsap.from(\\".point\\",{{x:30,opacity:0,duration:0.6,stagger:0.3,delay:1,ease:\\"power2.out\\"}});<\\/script></div></div>"}}\n'
        f'```\n\n'
    )

HTML_GENERATION_SYSTEM_PROMPT_CLASSIC = (
    "You are an expert Educational Content Designer. You generate HTML/CSS for video overlays.\n"
    "PLATFORM CAPABILITIES:\n"
    "1. **Animations**: Use GSAP for ALL animations. DO NOT use simple CSS transitions.\n"
    "2. **Frames**: Create simple visual frames and containers for text content.\n\n"
    "Output JSON describing 2-4 distinct 'shots' for this segment. "
    "The HTML renders on a transparent layer above a base canvas. "
    "Include <style> tags in your HTML. Scoped to shadow DOM.\n"
    "IMPORTANT: Ensure shots do NOT overlap spatially if they overlap in time. Use the safe area.\n\n"
    "**CRITICAL CENTERING & LAYOUT RULES**:\n"
    "- **ALWAYS WRAP** your entire content in a FULL-SCREEN CENTERED CONTAINER:\n"
    "  ```html\n"
    "  <div class='full-screen-center'>\n"
    "    <!-- Your layout content here -->\n"
    "  </div>\n"
    "  ```\n"
    "- The `.full-screen-center` class ensures content is ALWAYS centered on screen.\n"
    "- **ONE THING AT A TIME**: Each shot should focus on ONE concept. Do not clutter.\n"
    "- **Sizing**: Use `width: 90%; max-width: 1600px;` for main containers to ensure nothing touches the edges.\n"
    "- **Typography**: Use **Montserrat** (Weights: 700, 900) for Headings and **Inter** (Weights: 400, 600) for body.\n"
    "- **Pacing**: Avoid rapidfire shots. Keep each visual on screen for at least 3 seconds unless the narration is extremely fast.\n\n"
    "**COLOR CONTRAST RULES (CRITICAL)**:\n"
    "- **ALWAYS USE THE PROVIDED PALETTE** - DO NOT invent your own colors.\n"
    "- Use `var(--text-color)` for ALL text.\n"
    "- Use `var(--bg-color)` for background reference.\n"
    "- Use `var(--card-bg)` for card/panel backgrounds.\n"
    "- Use `var(--primary-color)` for accents and highlights.\n"
    "- **NEVER** use colors that match or are close to the background color for text.\n"
    "- For dark backgrounds: use WHITE/LIGHT text. For light backgrounds: use DARK text.\n\n"
    "- **Motion**: **USE GSAP**. Make it feel expensive.\n"
    "  - Exit animations: `gsap.to(..., {opacity: 0, y: -50, duration: 0.5})` before new content arrives.\n"
    "  - Entrances: `gsap.from(..., {y: 100, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1})`.\n"
    "- **Components**: Use simple frames, containers, and text layouts. Focus on clean, minimal design.\n"
    "- **RESTRICTIONS**: Do NOT use Math/LaTeX, Code blocks, Mermaid diagrams, or AI-generated images. Only use frames, animations, and text.\n"
)

HTML_GENERATION_SYSTEM_PROMPT_TEMPLATE = HTML_GENERATION_SYSTEM_PROMPT_ADVANCED

def get_html_generation_safe_area(width: int = 1920, height: int = 1080) -> str:
    margin_x = int(width * 0.052)   # ~5.2% margin (100/1920)
    margin_y = int(height * 0.074)  # ~7.4% margin (80/1080)
    safe_x_max = width - margin_x
    safe_y_max = height - margin_y
    is_portrait = width < height
    layout_hint = (
        "(Stack content vertically — single column. Do NOT use side-by-side splits like layout-split or grid 1fr 1fr.)"
        if is_portrait else
        "(Maximize use of width for split layouts)."
    )
    return (
        f"Canvas is {width}x{height}. You MUST keep all critical text and distinct visual elements within the **SAFE AREA**.\n"
        f"**SAFE AREA**: x=[{margin_x}, {safe_x_max}], y=[{margin_y}, {safe_y_max}]. {layout_hint}\n"
        f"**CRITICAL**: Always use `htmlStartX: 0, htmlStartY: 0, width: {width}, height: {height}` for FULL SCREEN centered layouts.\n"
        + (
            "\n**PORTRAIT MODE (9:16) LAYOUT RULES**:\n"
            "- Stack ALL content vertically — never side-by-side.\n"
            "- Use `grid-template-columns: 1fr` (single column) instead of `1fr 1fr`.\n"
            "- Image-split layouts: stack TOP/BOTTOM with `grid-template-rows: 1fr 1fr`.\n"
            "- Use larger font sizes — viewers are on mobile.\n"
            "- Keep text blocks narrower with more vertical spacing.\n"
            if is_portrait else ""
        )
        + "\n**SHOT DURATION RULES (by complexity)**:\n"
        "- **simple** (1-2 elements on screen): 4-6 seconds per shot\n"
        "- **moderate** (3-4 elements): 5-8 seconds per shot\n"
        "- **dense** (rich diagram or multi-part layout): 7-12 seconds per shot\n"
        "- If no complexity_level is provided, default to moderate (5-8s)\n"
        "- Keep pacing brisk — don't let shots linger beyond what the narration needs.\n"
        "- The user prompt specifies the segment duration and recommended shot count — follow it.\n"
        "- If not specified, default to 1 shot per 6-8 seconds of narration.\n"
        "- Avoid shots longer than 12 seconds — split into two if needed.\n"
        "\nReturn JSON ONLY in this form:\n"
        "{\n"
        '  "shots": [\n'
        "    {\n"
        '      "offsetSeconds": 0,\n'
        '      "start_word": "The first 3-5 words...",\n'
        '      "durationSeconds": 10,\n'
        '      "htmlStartX": 0,\n'
        '      "htmlStartY": 0,\n'
        f'      "width": {width},\n'
        f'      "height": {height},\n'
        '      "z": 10,\n'
        f'      "html": "<div class=\\"full-screen-center\\"><div class=\\"layout-hero\\">...</div></div><script>gsap.from(\\".layout-hero > *\\", {{y: 60, opacity: 0, stagger: 0.1, duration: 1.2}})</script>"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Shots MUST NOT overlap in time. \n"
        "Ensure that the value of the `html` string property INSIDE your JSON begins with `<style>@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Inter:wght@400;600&family=Fira+Code&display=swap');</style>`. "
        "The absolute FIRST character of your entire response must be `{` and the last character must be `}`. Add no markdown formatting, no code blocks, and no conversational text."
    )

# Backward compat
HTML_GENERATION_SAFE_AREA = get_html_generation_safe_area()

HTML_GENERATION_USER_PROMPT_TEMPLATE = """
Minute #{index}: {start:.2f}s to {end:.2f}s.
Narration: "{text}"

{word_timings}

{style_context}
{beat_context}

**🚨 MANDATORY COLOR RULES (COPY THESE EXACT VALUES)**:
Background type: {background_type}

For ALL text elements, use: `color: {text_color}`
For ALL SVG text: `fill="{text_color}"`
For ALL SVG strokes/lines/paths: `stroke="{svg_stroke}"`
For SVG fills (shapes): `fill="{svg_fill}"`
For annotations: `color: '{annotation_color}'`

**⚠️ EDUCATIONAL VIDEO PATTERN — MIX CINEMATIC + TEXT SHOTS**:
Use a **variety of shot types** for visual engagement:
1. **IMAGE_HERO**: Full-screen AI image with Ken Burns zoom + text overlay (for hooks, real-world context)
2. **IMAGE_SPLIT**: Image on one side, text on the other (for explanations with visual reference)
3. **Text/Diagram shot**: Text + SVG/diagram on clean background (for detailed explanations)
4. **LOWER_THIRD**: Key term banner (can overlay other shots)
5. **ANNOTATION_MAP**: Full-screen image with Vivus-drawn SVG arrows pointing to labeled regions (anatomy, geography, architecture)
6. **DATA_STORY**: Animated D3.js bar/line chart (use only when narration mentions actual numeric data)
7. **PROCESS_STEPS**: Numbered nodes with Vivus connector arrows revealing one-by-one (algorithms, how-to, sequences)
8. **EQUATION_BUILD**: KaTeX terms revealing sequentially with Rough Notation annotations (math/science formulas)
9. **ANIMATED_ASSET**: Cutout images (transparent bg) positioned absolutely + animated with GSAP (floating objects, characters, illustrative elements)

**EXAMPLE 1 — IMAGE_HERO SHOT (cinematic opening)**:
```html
<div class="image-hero">
  <img class="generated-image"
       data-img-prompt="realistic wide-shot photograph of a coral reef ecosystem, vivid tropical fish, clear blue water, cinematic underwater lighting, {aspect_label}"
       data-ken-burns="zoom-in"
       src="placeholder.png" />
  <div class="image-text-overlay gradient-bottom">
    <h1 id="hero-title" style="opacity:0;color:#ffffff;">Life Under the Sea</h1>
    <p id="hero-sub" style="opacity:0;color:rgba(255,255,255,0.9);">Coral reefs support 25% of all marine species</p>
  </div>
</div>
<script>
fadeIn('#hero-title', 0.8, 0.5);
fadeIn('#hero-sub', 0.6, 1.2);
</script>
```
Ken Burns: `zoom-in`, `zoom-out`, `pan-left`, `pan-right`, `pan-up`, `zoom-pan-tl`
Gradient: `gradient-bottom` (default), `gradient-top`, `gradient-full`, `gradient-center`

**EXAMPLE 2 — TEXT/DIAGRAM SHOT (classic explanation)**:
```html
<div class="full-screen-center">
  <div class="layout-hero">
    <p id="main-text" class="text-display" style="opacity:0;color:{text_color};">
      An <span id="key-term">API</span> lets programs talk to each other
    </p>
    <svg id="diagram" viewBox="0 0 500 120" style="margin-top:40px;">
      <rect x="20" y="30" width="100" height="60" fill="{svg_fill}" rx="8"/>
      <text x="70" y="65" fill="#fff" text-anchor="middle" font-size="16">App A</text>
      <path d="M130,60 L370,60" stroke="{svg_stroke}" stroke-width="3" fill="none"/>
      <polygon points="360,50 380,60 360,70" fill="{svg_stroke}"/>
      <rect x="380" y="30" width="100" height="60" fill="{svg_fill}" rx="8"/>
      <text x="430" y="65" fill="#fff" text-anchor="middle" font-size="16">App B</text>
    </svg>
  </div>
</div>
<script>
fadeIn('#main-text', 0.5, 0);
gsap.delayedCall(0.8, () => annotate('#key-term', {{type: 'underline', color: '{annotation_color}', duration: 600}}));
gsap.delayedCall(1.5, () => animateSVG('diagram', 100));
</script>
```

**EXAMPLE 3 — IMAGE_SPLIT SHOT (visual + explanation)**:
```html
<div class="image-split-layout">
  <div class="split-image">
    <img class="generated-image"
         data-img-prompt="close-up scientific illustration of plant cells, green chloroplasts glowing, cross-section view, detailed, {aspect_label}"
         data-ken-burns="pan-right"
         src="placeholder.png" />
  </div>
  <div class="split-text" style="color:{text_color};">
    <h2 id="split-title" style="opacity:0">Chloroplasts</h2>
    <p id="split-body" style="opacity:0">Tiny green organelles that capture sunlight for photosynthesis.</p>
  </div>
</div>
<script>
fadeIn('#split-title', 0.5, 0.3);
fadeIn('#split-body', 0.5, 0.8);
</script>
```

**TEXT APPEARANCE OPTIONS**:
```javascript
fadeIn('#text', 0.5, 0);           // Simple fade (most common)
popIn('#text', 0.4, 0);            // Subtle scale up
typewriter('#text', 1.5, 0);       // Letter by letter
showThenAnnotate('#text', '#key', 'underline', '{annotation_color}', 0, 0.8);  // All-in-one!
```

**ANNOTATION TYPES** (hand-drawn style):
- 'underline' - Teacher's underline (use: {annotation_color})
- 'circle' - Circle around term (use: {primary_color})
- 'highlight' - Marker highlight (use yellow: #fef08a)
- 'box' - Box around content (use: {primary_color})

**AI Images** (for IMAGE_HERO, IMAGE_SPLIT, and ANIMATED_ASSET shots):
- Write cinematic prompts (20-50 words): style, subject, composition, lighting
- AVOID: text in images, logos, human faces
- For IMAGE_HERO/IMAGE_SPLIT: always add `data-ken-burns` attribute for motion
- For ANIMATED_ASSET cutouts: add `data-cutout="true"`, describe a SINGLE isolated object on a solid/plain background

**DO NOT**:
- Text flying in from sides, bouncing, or spinning
- Drop-shadows / box-shadows / heavy blur (gradient scrims over images ARE fine)
- Card-heavy app-like design
- Use colors that don't contrast with {background_type} background
- Reveals after 60% of shot duration — if a reveal needs >3s delay, split into a new shot instead

**🚨 CRITICAL: EVERY SHOT MUST HAVE A `<script>` TAG**:
- If ANY element has `style="opacity:0"`, you MUST include a `<script>` block
- The script MUST animate those elements to become visible
- Example: `<script>fadeIn('#text1', 0.5, 0); fadeIn('#text2', 0.5, 0.3);</script>`
- WITHOUT a script, the content will be INVISIBLE (white screen)

**🎯 ANIMATION TIMING RULES - USE WORD TIMINGS!**:
You have been given EXACT word timings above. Use them to sync animations with the narration!

**HOW TO USE WORD TIMINGS**:
1. Find the key word/phrase you want to animate with (e.g., "mitochondria" at 34.86s)
2. Calculate the delay from the SHOT START time (given as {start:.2f}s)
3. Use that delay as a GSAP `delay:` value (seconds) or `gsap.delayedCall()` — NEVER use setTimeout

**EXAMPLE**: If shot starts at 30.0s and you want to show an icon when narrator says "mitochondria" (at 34.86s):
```javascript
// Delay = word_time - shot_start = 34.86 - 30.0 = 4.86 seconds
gsap.to('#mitochondria-icon', {{opacity:1, duration:0.5, delay:4.86}});  // delay in SECONDS
```

**PATTERN FOR SYNCED ANIMATIONS**:
```javascript
<script>
// Show title immediately (shot starts)
fadeIn('#title', 0.5, 0);

// Show diagram when narrator mentions it (use word timing!)
// If "diagram" is spoken at 35.2s and shot starts at 30.0s: delay = 5.2s
gsap.delayedCall(5.2, () => animateSVG('diagram', 100));

// Annotate key term when it's spoken
// If "energy" is at 37.5s and shot starts at 30.0s: delay = 7.5s
gsap.delayedCall(7.5, () => annotate('#energy-term', {{type: 'underline', color: '{annotation_color}'}}));
</script>
```

**TIMING RULES**:
- Main title/text: Show at delay 0 (immediately when shot starts)
- Supporting elements: Sync to word timings using the formula: `delay_s = word_time - shot_start` (GSAP delay in seconds)
- Annotations: Trigger slightly BEFORE the word is spoken (subtract 0.3s) so they're visible when heard
- NEVER use delays longer than (shot_end - shot_start) seconds

**⏸️ STRATEGIC PAUSES (what makes professional videos feel polished)**:
- After showing a new concept (text + diagram), wait 0.6-1s before adding annotations — enough to read, not so long it drags
- After annotation, wait 0.3s before the next transition — prevents visual rush
- Between staggered element reveals, use 200-350ms gaps — never reveal everything at once
- If a shot is 12+ seconds, build the visual in 2-3 phases with pauses between, not one continuous animation
- Think like Khan Academy: show → pause → annotate → pause → next element

**🎯 ANIMATION SYNC TOLERANCE**:
- Animations should trigger within ±200ms of word timing
- If exact sync is impossible, show elements BEFORE they're mentioned (early by 0.3s) rather than after
- Viewers perceive "slightly early" as natural; "slightly late" feels laggy and broken

**🎭 MULTI-LAYER ANIMATION (makes videos feel cinematic)**:
Build each shot with 2-3 animation layers running at different speeds for visual depth:

Layer guidelines by complexity_level:
- **simple** (1-2 layers): Background slow motion (Ken Burns on image) + foreground text fade/popIn
- **moderate** (2 layers): Background ambient (Ken Burns / gradient shift) + foreground content reveal (splitReveal / stagger)
- **dense** (2-3 layers): Background slow motion + mid-ground diagram draw (Vivus / Mermaid) + foreground labels (splitReveal)

Speed hierarchy (different layers at different speeds creates cinematic depth):
- Background animations: SLOW (8-15s duration, subtle movement — Ken Burns, slow scale drift)
- Mid-ground animations: MEDIUM (2-4s, the main visual story — diagram draws, chart builds)
- Foreground text: FAST (0.3-0.8s per element, snappy reveals — fadeIn, splitReveal, popIn)
- NEVER stack more than 3 layers — more creates visual noise, not depth
- If complexity_level is 'simple', keep it to 1-2 layers only

{topic_guidance}

**Language**: {language}

{safe_area}
"""


# ---------------------------------------------------------------------------
# Per-Shot HTML Generation (used with Director stage in Phase 2+3)
# ---------------------------------------------------------------------------

PER_SHOT_USER_PROMPT_TEMPLATE = """SHOT #{shot_index} of {total_shots} | {shot_type} | {duration:.1f}s ({start_time:.2f}s → {end_time:.2f}s)

**DIRECTOR'S INSTRUCTIONS**:
- Shot type: {shot_type}
- Visual: {visual_description}
- Text elements: {text_elements}
- Animation: {animation_strategy}
- Complexity: {complexity_level}
- Entrance transition: {transition_in}
- Background treatment: {background_treatment} (honor this — see core preamble rule)

**CREATIVE DIRECTION — the shot's INTENT (compose to SERVE this; don't just decorate it)**:
{creative_direction}

**WRAPPER ENTRANCE ANIMATION**:
The shot's outermost `<div>` MUST have `id="shot-root"` and `style="position:relative;width:100%;height:100%;overflow:hidden"`.
Inject this as the FIRST `<script>` block (before per-element animations):
```js
{transition_css_block}
```
If `transition_in` is `cut`, omit this block entirely.
{image_prompt_line}
{video_query_line}
{director_notes}

**NARRATION FOR THIS SHOT**:
"{narration_excerpt}"

**WORD TIMINGS (this shot only)**:
{word_timings}

**SYNC POINTS (from Director)**:
{sync_points}

**STYLE**:
{style_context}

**COLOR RULES**:
Background: {background_type}
Text: `color: {text_color}` | SVG stroke: `{svg_stroke}` | SVG fill: `{svg_fill}` | Annotation: `{annotation_color}`

**CONTINUITY**:
{continuity_context}

**CRITICAL**:
- EVERY element with `style="opacity:0"` MUST have a `<script>` block that animates it visible
- Use the Rel(s) column from WORD TIMINGS directly as GSAP `delay:` in seconds. NEVER use setTimeout.
- Show elements BEFORE they're mentioned (early by 0.3s) rather than after

{safe_area}

Return a SINGLE shot as JSON (no array, no wrapper):
{{
  "offsetSeconds": 0,
  "durationSeconds": {duration:.1f},
  "start_word": "{start_word}",
  "htmlStartX": 0, "htmlStartY": 0,
  "width": {width}, "height": {height},
  "z": 10,
  "html": "<style>@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Inter:wght@400;600&family=Fira+Code&display=swap');</style>..."
}}

The first character of your response must be `{{` and the last must be `}}`. No markdown, no commentary.
"""


TRANSITION_CSS_BLOCKS: dict = {
    "cut":         "",
    "fade":        "gsap.fromTo('#shot-root',{opacity:0},{opacity:1,duration:0.4,ease:'power2.out'});",
    "slide_right": "gsap.fromTo('#shot-root',{x:'-100%',opacity:0},{x:'0%',opacity:1,duration:0.45,ease:'power3.out'});",
    "slide_left":  "gsap.fromTo('#shot-root',{x:'100%',opacity:0},{x:'0%',opacity:1,duration:0.45,ease:'power3.out'});",
    "slide_up":    "gsap.fromTo('#shot-root',{y:'60px',opacity:0},{y:'0px',opacity:1,duration:0.5,ease:'power3.out'});",
    "zoom_in":     "gsap.fromTo('#shot-root',{scale:0.85,opacity:0},{scale:1,opacity:1,duration:0.45,ease:'back.out(1.4)'});",
    "zoom_out":    "gsap.fromTo('#shot-root',{scale:1.15,opacity:0},{scale:1,opacity:1,duration:0.45,ease:'power3.out'});",
    "wipe_right":  "gsap.set('#shot-root',{clipPath:'inset(0 100% 0 0)'});gsap.to('#shot-root',{clipPath:'inset(0 0% 0 0)',duration:0.5,ease:'power3.inOut'});",
    "dissolve_up": "gsap.fromTo('#shot-root',{y:'20px',opacity:0},{y:'0px',opacity:1,duration:0.55,ease:'power2.out'});",
    # Whip-pan: fast horizontal blur + translate. Best for two same-family
    # cinematic shots where we want to keep the momentum (e.g. VIDEO_HERO
    # → VIDEO_HERO across an act).
    "whip_pan":    "gsap.fromTo('#shot-root',{x:'40%',opacity:0,filter:'blur(8px)'},{x:'0%',opacity:1,filter:'blur(0px)',duration:0.30,ease:'power3.out'});",
    # Zoom-through: the incoming shot enters from a small scale and rises
    # in opacity; pairs with the outgoing shot's zoom-out exit applied via
    # the renderer's overlap window.
    "zoom_through":"gsap.fromTo('#shot-root',{scale:0.7,opacity:0},{scale:1,opacity:1,duration:0.45,ease:'power3.out'});",
    # Vignette-fade: opacity fade with a brief radial darkening overlay.
    # The overlay is appended INSIDE #shot-root (rather than document.body)
    # so the renderer's shadow-DOM scoping keeps it inside the shot — the
    # render-server renderer rewrites `document.getElementById` to a
    # shadow-aware `__sd_getElementById`, so the overlay correctly lands in
    # the right shadow root and tears down at shot exit.
    "vignette_fade":(
        "(function(){var host=document.getElementById('shot-root')||document.body;"
        "var ov=document.createElement('div');ov.style.cssText="
        "'position:absolute;inset:0;background:radial-gradient(circle at center,"
        "rgba(0,0,0,0) 30%,rgba(0,0,0,0.85) 100%);pointer-events:none;opacity:0;"
        "z-index:9999';host.appendChild(ov);"
        "gsap.fromTo('#shot-root',{opacity:0},{opacity:1,duration:0.5,ease:'power2.out'});"
        "gsap.to(ov,{opacity:1,duration:0.18,ease:'power2.out'});"
        "gsap.to(ov,{opacity:0,duration:0.32,delay:0.18,ease:'power2.in',"
        "onComplete:function(){if(ov&&ov.remove)ov.remove();}});"
        "})();"
    ),
    # ── Tier 4 4.2 — Mask / clip-path branded reveals (2026-05) ──
    # All four animate `clip-path` on `#shot-root`. Compatible with the
    # renderer's shadow-DOM scoping because they target #shot-root directly
    # (no document.body / parentElement walks). Use a 0.5s duration baseline
    # to feel deliberate without slowing pace.
    "circle_iris": (
        "gsap.set('#shot-root',{clipPath:'circle(0% at 50% 50%)'});"
        "gsap.to('#shot-root',{clipPath:'circle(120% at 50% 50%)',"
        "duration:0.55,ease:'power3.inOut'});"
    ),
    "diagonal_wipe": (
        "gsap.set('#shot-root',{clipPath:'polygon(0% 0%, 0% 0%, 0% 0%, 0% 100%)'});"
        "gsap.to('#shot-root',{clipPath:'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',"
        "duration:0.55,ease:'power3.out'});"
    ),
    "hexagon_iris": (
        "gsap.set('#shot-root',"
        "{clipPath:'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%, 50% 50%, 50% 50%)'});"
        "gsap.to('#shot-root',"
        "{clipPath:'polygon(50% -50%, 130% 0%, 130% 100%, 50% 150%, -30% 100%, -30% 0%)',"
        "duration:0.55,ease:'power3.inOut'});"
    ),
    # blinds_horizontal: curtains-parting effect via clip-path:inset() from a
    # zero-height horizontal band at the center, expanding outward to full
    # canvas. The earlier multi-band polygon was self-intersecting (12 points
    # with degenerate edges) and rendered unpredictably across browsers; this
    # inset() animation is one CSS rectangle interpolating to another and
    # behaves identically in Chromium / WebKit / Gecko. Pairs well after
    # KINETIC_TITLE → next act intro.
    "blinds_horizontal": (
        "gsap.set('#shot-root',{clipPath:'inset(50% 0% 50% 0%)'});"
        "gsap.to('#shot-root',{clipPath:'inset(0% 0% 0% 0%)',"
        "duration:0.55,ease:'power3.inOut'});"
    ),
    # smash_cut: instant cut + a brief white impact flash. Surprises / hard facts
    # / high-energy hits. Overlay is appended INSIDE #shot-root (shadow-safe).
    "smash_cut": (
        "(function(){var host=document.getElementById('shot-root')||document.body;"
        "var fl=document.createElement('div');fl.style.cssText='position:absolute;inset:0;"
        "background:#fff;opacity:0.85;pointer-events:none;z-index:9999';host.appendChild(fl);"
        "gsap.to(fl,{opacity:0,duration:0.16,ease:'power2.out',"
        "onComplete:function(){if(fl&&fl.remove)fl.remove();}});})();"
    ),
    # dip_to_black: fade IN from a black cover. A deliberate time / topic jump.
    "dip_to_black": (
        "(function(){var host=document.getElementById('shot-root')||document.body;"
        "var dv=document.createElement('div');dv.style.cssText='position:absolute;inset:0;"
        "background:#000;opacity:1;pointer-events:none;z-index:9999';host.appendChild(dv);"
        "gsap.fromTo('#shot-root',{opacity:0},{opacity:1,duration:0.3,ease:'power2.out'});"
        "gsap.to(dv,{opacity:0,duration:0.42,ease:'power2.inOut',"
        "onComplete:function(){if(dv&&dv.remove)dv.remove();}});})();"
    ),
}

