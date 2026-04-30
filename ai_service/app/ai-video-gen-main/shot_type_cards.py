"""
Shot Type Reference Cards — modular, per-type documentation for the HTML generation stage.

Instead of sending a monolithic 10,500-token system prompt containing ALL shot type
documentation to every LLM call, this module allows the pipeline to assemble a
focused prompt containing only the shot types relevant to the current subject domain.

Usage:
    from shot_type_cards import build_filtered_system_prompt
    system_prompt = build_filtered_system_prompt("math", 1920, 1080)
"""
from __future__ import annotations

from typing import Dict, List, Any

# ---------------------------------------------------------------------------
# Core preamble — shared across ALL HTML generation calls regardless of shot type.
# Extracted from HTML_GENERATION_SYSTEM_PROMPT_ADVANCED lines 358-389, 728-810, 834-951.
# ---------------------------------------------------------------------------

CORE_PREAMBLE = (
    "You are an expert Educational Video Designer. You create visuals for LEARNING VIDEOS, NOT app/web UIs.\n"
    "Think: Khan Academy, 3Blue1Brown, Converse brand reels, whiteboard explainers. Professional, cinematic, polished.\n\n"

    "**CRITICAL — QUALITY STANDARDS**:\n"
    "- **EASING IS MANDATORY** — every GSAP tween MUST use a named ease. "
    "Use `expo.out` (snappy, modern), `power3.out` (smooth), `back.out(1.6)` (playful pop). "
    "NEVER use the default linear or omit ease.\n"
    "- **TYPOGRAPHY HIERARCHY** — every shot needs exactly 2 text levels: "
    "a large display headline (Bebas Neue / Montserrat Black, ≥4rem) and an optional small label (Inter, ≤1rem, letter-spacing:0.25em, ALL-CAPS). "
    "Nothing in between. No body paragraphs unless the shot type explicitly requires it.\n"
    "- **LAYER BEHIND HERO** — place background shapes, patterns, watermarks as separate `position:absolute` layers "
    "with low z-index behind the main content. Animate them in at a delay to create depth.\n"
    "- **FLAT BADGES not cards** — year/stat call-outs use a flat colored `<div>` with zero border-radius. "
    "No box-shadows, no rounded corners on badge elements.\n"
    "- **CONTINUOUS MOTION** — at least one element must be in motion at any given frame. "
    "For ANY shot ≥4s, wrap the content in `<div class='stage-drift'>` and tween the whole composition: "
    "`gsap.fromTo('.stage-drift', {x:0,y:0,scale:1}, {x:20,y:-10,scale:1.04, duration:12, ease:'none'});`. "
    "This creates the whole-composition parallax drift top-tier explainers use. "
    "Individual foreground subjects can ADDITIONALLY get a slow Ken Burns if they're photos.\n"
    "- **NO APP-LIKE CARDS** — no glassmorphism, no card grids, no mobile-UI feel.\n"
    "- **NO setTimeout** — renderer seeks `gsap.globalTimeline` frame-by-frame. "
    "Use `gsap.to('#el', {delay:1.4})` or `gsap.delayedCall(1.4, fn)` — setTimeout never fires.\n\n"

    "**PROFESSIONAL CSS UTILITIES (pre-built, use freely)**:\n"
    "- `.halftone` — CSS dot texture overlay (dark dots on current bg)\n"
    "- `.halftone-light` — light dot texture (for dark backgrounds)\n"
    "- `.flat-badge` — flat colored rectangle for year/stat callouts, no border-radius\n"
    "- `.slam-wrapper` + `.slam-text` — overflow:hidden container for translateY(100%→0%) reveals\n"
    "- `.tracking-label` — small-caps tracking label (Inter, letter-spacing:0.3em)\n"
    "- `.svg-canvas` — cream #f5f0e8 background with CSS grid (illustrated mode)\n"
    "- `.product-stage` — full-screen relative container for product/subject layered shots\n"
    "- `.stage-drift` — continuous-motion wrapper. Tween this during holds ≥4s: "
    "`gsap.fromTo('.stage-drift', {x:0,y:0,scale:1}, {x:20,y:-10,scale:1.04, duration:12, ease:'none'});`\n"
    "- `.draft-guide` — dashed-line SVG class (phase 1 of blueprint-draft two-phase reveal)\n"
    "- `.solid-overlay` — solid-line SVG class (phase 2, lands on top of draft-guide)\n"
    "- `.paper-texture` — parchment/sketchbook grain overlay (SVG-noise background via ::before). "
    "Add `.paper-texture.strong` for heavier grain. Compose with `.svg-canvas` or `.product-stage`.\n"
    "- `.tech-annotation` — red dashed SVG stroke for dimension lines, crosshairs, measurement arrows "
    "(architect/engineer annotations — this red is the ONE utility color allowed beyond the 2-color brand palette).\n"
    "- `.tech-annotation-label` — small ALL-CAPS red Inter/mono label for dimension numbers ('16-INCH', '0.0 MM', '5MM BEZEL').\n"
    "- `.tech-annotation-caption` — small italic serif caption for 'Fig. 1 — description' fig captions.\n"
    "- `.vignette-overlay` — full-screen radial darkening layer (z-index:50). "
    "Tween `opacity:0→1` over 0.6s with `power2.in` for cinematic scene-exit.\n\n"

    "**SVG FILTERS (pre-registered in global <defs>)**:\n"
    "- `filter=\"url(#roughen)\"` — hand-drawn wobble on any SVG `<path>/<rect>/<line>/<circle>`. "
    "Preserves stroke-dashoffset animation (LLM favorite — makes clean bezier paths look like architect sketches).\n"
    "- `filter=\"url(#roughen-strong)\"` — more aggressive wobble for bolder sketch feel.\n\n"

    "**PLATFORM CAPABILITIES**:\n"
    "1. **Math**: Use LaTeX: `$$ E=mc^2 $$` (renders via KaTeX).\n"
    "2. **Code**: Use `<pre><code class='language-python'>...</code></pre>` (Prism.js).\n"
    "3. **Diagrams**: Use `<div class='mermaid'>graph TD; A-->B;</div>` (Mermaid.js).\n"
    "4. **SVG Animations**: Draw lines, animate icons, show processes with `stroke-dashoffset`.\n"
    "5. **Images**: Use stock photos (preferred) or AI generation:\n"
    "   `<img class='generated-image' data-img-prompt='description' data-img-source='stock' src='placeholder.png' />`\n"
    "   - `data-img-source='stock'` **(PREFERRED)**: Real-world stock photography (Pexels).\n"
    "   - `data-img-source='generate'`: AI-generated. Use ONLY for: cutouts, fictional scenes, stylized art.\n"
    "   - Cutouts: add `data-cutout='true'` and end prompt with 'isolated on solid [color] background, clean edges'.\n"
    "   - **Subject continuity** (recurring character/product/location across shots): "
    "add `data-subject-id='stable_slug'` to the `<img>` tag. Use the SAME slug "
    "for every shot featuring that subject. The pipeline auto-detects most "
    "recurring subjects, but an explicit tag is the safest. The first shot "
    "generates normally; subsequent shots feed the cached image to Seedream "
    "as a reference so the subject looks identical across the timeline. "
    "Best for: PRODUCT_HERO chains, IMAGE_HERO/ANIMATED_ASSET sequences with a "
    "named character, brand reels.\n"
    "6. **Icons**: Iconify — `<iconify-icon icon='mdi:atom' width='48'></iconify-icon>`. "
    "Sets: `mdi:`, `lucide:`, `tabler:`, `noto:`, `fluent-emoji:`.\n"
    "7. **SVG Maps**: `<img src='https://vacademy-media.s3.ap-south-1.amazonaws.com/assets/maps/us.svg' class='map-svg'/>`. "
    "Animate with GSAP.\n\n"
)

# ---------------------------------------------------------------------------
# Animation tools — shared reference for all shot types.
# Extracted from lines 728-810.
# ---------------------------------------------------------------------------

ANIMATION_TOOLS = (
    "**ANIMATION TOOLS AVAILABLE**:\n"
    "1. **Text Appearance** - fadeIn, typewriter, popIn, slideUp, showThenAnnotate\n"
    "2. **Vivus.js** - Draw SVG paths (handwriting effect): `animateSVG('id', 100);`\n"
    "3. **Rough Notation** - Hand-drawn annotations: `annotate('#el', {type:'underline', color:'#dc2626'});`\n"
    "   Types: 'underline', 'circle', 'box', 'highlight', 'strike-through', 'bracket'\n"
    "4. **GSAP** - General animations (gsap.from, gsap.to, gsap.fromTo)\n"
    "5. **Howler.js** - Sound effects: `playSound('pop');`\n"
    "6. **KaTeX** - Math: `$$ E=mc^2 $$`\n"
    "7. **Mermaid** - Flowcharts: `<div class='mermaid'>graph TD; A-->B;</div>`\n"
    "8. **Iconify** - 275k+ icons: `<iconify-icon icon='mdi:name' width='48'></iconify-icon>`\n"
    "9. **splitReveal** - Cinematic text entrance: `splitReveal('#title', {type:'chars', stagger:0.03});`\n"
    "10. **gsap.delayedCall** — seekable timed callback: `gsap.delayedCall(2.5, () => annotate('#el', {type:'underline'}));` "
    "Use instead of setTimeout — it lives on the GSAP globalTimeline.\n"
    "11. **Anime.js** — Stagger grids, SVG morphing, spring physics. MUST register seekable instances with `_animeR()`. "
    "For ambient loops use `autoplay:true` (no registration needed).\n\n"

    "**ANIME.JS PATTERNS** (use for effects GSAP handles poorly):\n"
    "```javascript\n"
    "// --- Pattern A: Stagger grid entrance (halftone dots, icon grids, particle reveals) ---\n"
    "// Best for: arrays of dots/icons that should radiate from center outward\n"
    "const dotAnim = anime({\n"
    "  targets: '.dot',           // CSS selector resolved from shadow root\n"
    "  scale: [0, 1],\n"
    "  opacity: [0, 1],\n"
    "  delay: anime.stagger(40, {grid: [10, 10], from: 'center'}),\n"
    "  duration: 400,\n"
    "  easing: 'easeOutElastic(1, .5)',\n"
    "  autoplay: false,           // REQUIRED for frame-seeking\n"
    "});\n"
    "_animeR({instance: dotAnim, startMs: 0});  // register at 0ms into this shot\n\n"

    "// --- Pattern B: SVG morphing (shape transitions — FREE, unlike GSAP MorphSVG) ---\n"
    "// Best for: icon shape transforms, logo builds, concept transitions\n"
    "const morph = anime({\n"
    "  targets: '#shape path',\n"
    "  d: [\n"
    "    {value: 'M50,100 L150,100 L100,20 Z'},     // triangle\n"
    "    {value: 'M50,50 L150,50 L150,150 L50,150 Z'}  // square\n"
    "  ],\n"
    "  duration: 800,\n"
    "  easing: 'easeInOutQuart',\n"
    "  autoplay: false,\n"
    "});\n"
    "_animeR({instance: morph, startMs: 2000});  // starts 2s into the shot\n\n"

    "// --- Pattern C: Spring entrance (organic, physical feel) ---\n"
    "// Best for: badges, cards, UI elements that should feel physical\n"
    "const spring = anime({\n"
    "  targets: '#badge',\n"
    "  translateY: ['-120%', '0%'],\n"
    "  duration: 600,\n"
    "  easing: 'spring(1, 80, 10, 0)',  // mass, stiffness, damping, velocity\n"
    "  autoplay: false,\n"
    "});\n"
    "_animeR({instance: spring, startMs: 300});\n\n"

    "// --- Pattern D: Looping pulse / ambient glow (autoplay:true — no seek needed) ---\n"
    "// Best for: background rings, breathing effects, idle state indicators\n"
    "anime({  // Note: no _animeR() for loops — autoplay:true runs in real time\n"
    "  targets: '#ring',\n"
    "  scale: [1, 1.4],\n"
    "  opacity: [0.5, 0],\n"
    "  duration: 1200,\n"
    "  easing: 'easeOutSine',\n"
    "  loop: true,\n"
    "  autoplay: true,\n"
    "});\n"
    "```\n\n"

    "**ANIME.JS RULES**:\n"
    "- ALWAYS use `autoplay: false` + `_animeR({instance, startMs})` for any animation that should sync to narration.\n"
    "- `startMs` is milliseconds AFTER shot start when the animation begins (e.g. startMs:500 = triggers 0.5s into shot).\n"
    "- Use Anime.js INSTEAD OF GSAP for: stagger grids, SVG d-attribute morphing, spring physics.\n"
    "- Use GSAP for: timeline sequencing, motionPath, text splits, general tweens.\n"
    "- Ambient loops (breathing rings, idle pulses) can use `autoplay:true` — no registration needed.\n\n"

    "**TEXT APPEARANCE PATTERN (how text shows up in learning videos)**:\n"
    "```javascript\n"
    "fadeIn('#text', 0.5, 0);           // Simple fade (most common)\n"
    "popIn('#text', 0.4, 0);            // Subtle scale up\n"
    "typewriter('#text', 1.5, 0);       // Letter by letter\n"
    "showThenAnnotate('#text', '#key', 'underline', '#dc2626', 0, 0.8);  // All-in-one\n"
    "```\n\n"

    "**THE LEARNING VIDEO PATTERN**:\n"
    "1. Short text appears (1-2 lines matching narration)\n"
    "2. Pause briefly\n"
    "3. Key term gets annotated (underline/circle/highlight)\n"
    "4. Optional: diagram draws while annotation is visible\n\n"
)

# ---------------------------------------------------------------------------
# Educational design principles — shared.
# Extracted from lines 834-951.
# ---------------------------------------------------------------------------

EDUCATIONAL_PRINCIPLES = (
    "**EDUCATIONAL DESIGN PRINCIPLES**:\n"
    "1. **ONE CONCEPT AT A TIME**: Each shot = one idea. No clutter.\n"
    "2. **ANNOTATE KEY TERMS**: Use Rough Notation to underline/circle important words.\n"
    "3. **DRAW, DON'T JUST SHOW**: Use Vivus to draw diagrams as if sketching on a whiteboard.\n"
    "4. **SIMPLE TEXT**: Large, readable text. Key term + brief explanation. That's it.\n"
    "5. **SIGNALING**: Use arrows, circles, highlights to direct attention.\n\n"

    "**PROGRESSIVE DISCLOSURE (MANDATORY for complex concepts)**:\n"
    "Build understanding layer by layer within each shot:\n"
    "1. Show the main heading/question FIRST (delay: 0)\n"
    "2. Draw/reveal the first part of the diagram (delay: 2-3s, sync to word timing)\n"
    "3. Annotate the key term being spoken (sync to word timing)\n"
    "4. Add the next layer of detail (delay: 5-7s)\n"
    "Each reveal should ADD to what's on screen, NOT replace it.\n\n"

    "**DUAL CODING PRINCIPLE (MANDATORY)**:\n"
    "Every shot that introduces a new concept MUST include BOTH:\n"
    "1. TEXT (the concept name + brief explanation)\n"
    "2. A VISUAL (SVG diagram, flowchart, comparison, annotated image, or code block)\n"
    "Text-only shots are ONLY acceptable for Key Takeaway cards and LOWER_THIRD overlays.\n\n"
)

# ---------------------------------------------------------------------------
# Image prompt guidelines — shared.
# Extracted from lines 694-726.
# ---------------------------------------------------------------------------

IMAGE_PROMPT_GUIDELINES = (
    "**IMAGE PROMPT GUIDELINES (for data-img-prompt)**:\n"
    "Write descriptive, cinematic prompts (20-50 words) for AI image generation:\n"
    "- Specify style: 'realistic photograph', 'scientific illustration', 'watercolor'\n"
    "- Specify composition: 'close-up', 'wide shot', 'aerial view', 'cross-section'\n"
    "- Specify lighting: 'cinematic lighting', 'soft natural light', 'dramatic side lighting'\n"
    "- Specify aspect: always think {aspect_label}\n"
    "- AVOID: text in images, logos, watermarks, human faces\n"
    "DEFAULT TO STOCK. USE GENERATE only for: cutouts, fictional scenes, custom illustrations.\n\n"

    "**SHOT DISTRIBUTION** (scale to segment duration):\n"
    "- ~15s segment -> 2 shots | ~25s -> 3 shots | ~40s -> 4-5 shots\n"
    "- Real-world topics: ~50% shots with stock video/image backgrounds.\n"
    "- Abstract topics (math, code): video only for hooks/conclusions.\n\n"
)

# ---------------------------------------------------------------------------
# DO NOT rules — shared.
# Extracted from lines 892-898.
# ---------------------------------------------------------------------------

DO_NOT_RULES = (
    "**DO NOT USE**:\n"
    "- Drop-shadows / box-shadows on elements\n"
    "- Glassmorphism or heavy blur effects (gradient scrims over images ARE fine)\n"
    "- Card-heavy layouts that look like apps\n"
    "- Fancy entrance animations for text (no flying/bouncing/spinning)\n"
    "- Gradient backgrounds on cards or containers (only on image overlays)\n"
    "- Rounded card grids that look like mobile UI\n"
    "- **setTimeout for animations** — use GSAP `delay:` or `gsap.delayedCall()` instead. setTimeout never fires in the renderer.\n\n"
)


# ═══════════════════════════════════════════════════════════════════════════
# SHOT TYPE CARDS — one per shot type, self-contained documentation.
# ═══════════════════════════════════════════════════════════════════════════

SHOT_TYPE_CARDS: Dict[str, Dict[str, Any]] = {

    # ------------------------------------------------------------------
    # TEXT_DIAGRAM — the default shot type for explanations
    # ------------------------------------------------------------------
    "TEXT_DIAGRAM": {
        "id": "TEXT_DIAGRAM",
        "name": "Text + Diagram",
        "category": "text",
        "description": "Text + SVG/Mermaid diagram on clean background — the workhorse shot for explanations.",
        "use_for": "Abstract concepts, code, math, processes, comparisons — anything that needs focus.",
        "requires_image": False,
        "requires_video": False,
        "preferred_domains": ["coding", "math", "science", "language", "general"],
        "html_template": (
            "<div class='full-screen-center'>\n"
            "  <div class='layout-hero'>\n"
            "    <h1 class='text-display'>What is an <span id='api-term'>API</span>?</h1>\n"
            "    <p class='text-body'>A way for programs to <span id='talk-term'>talk to each other</span></p>\n"
            "    <svg id='api-diagram' viewBox='0 0 500 150' style='margin-top:40px;'>\n"
            "      <rect x='20' y='50' width='120' height='60' fill='var(--primary-color)' rx='8'/>\n"
            "      <text x='80' y='85' fill='#fff' text-anchor='middle'>App A</text>\n"
            "      <path d='M150,80 L350,80' stroke='var(--text-color)' stroke-width='3' fill='none'/>\n"
            "      <rect x='360' y='50' width='120' height='60' fill='var(--primary-color)' rx='8'/>\n"
            "      <text x='420' y='85' fill='#fff' text-anchor='middle'>App B</text>\n"
            "    </svg>\n"
            "  </div>\n"
            "</div>\n"
        ),
        "script_block": (
            "animateSVG('api-diagram', 120);\n"
            "setTimeout(() => annotate('#api-term', {type:'underline', color:'#dc2626', duration:600}), 1500);\n"
            "setTimeout(() => annotate('#talk-term', {type:'highlight', color:'#fef08a', duration:600}), 2000);\n"
        ),
        "guidelines": [
            "WRAP content in `<div class='full-screen-center'>...</div>`",
            "Use `.layout-split` for Text on left, Visual (SVG/diagram) on right",
            "Use `.layout-hero` for single big concept in center",
            "Keep backgrounds clean — solid color from the palette",
            "Use Mermaid for flowcharts, SVG for custom diagrams, KaTeX for math",
        ],
        "includes_key_takeaway": True,
        "includes_wrong_right": True,
    },

    # ------------------------------------------------------------------
    # IMAGE_HERO — full-screen image with Ken Burns
    # ------------------------------------------------------------------
    "IMAGE_HERO": {
        "id": "IMAGE_HERO",
        "name": "Image Hero",
        "category": "cinematic",
        "description": "Full-screen image with Ken Burns zoom + text overlay.",
        "use_for": "Hook/opening, real-world examples, dramatic moments, introducing new topics.",
        "requires_image": True,
        "requires_video": False,
        "preferred_domains": ["history", "science", "general", "language"],
        "html_template": (
            "<div class='image-hero'>\n"
            "  <img class='generated-image'\n"
            "       data-img-prompt='realistic photograph of a scientist examining DNA, cinematic, {aspect_label}'\n"
            "       data-ken-burns='zoom-in'\n"
            "       src='placeholder.png' />\n"
            "  <div class='image-text-overlay gradient-bottom'>\n"
            "    <h1 id='hero-title' style='opacity:0'>The Building Blocks of Life</h1>\n"
            "    <p id='hero-sub' style='opacity:0'>Every living thing carries a unique code</p>\n"
            "  </div>\n"
            "</div>\n"
        ),
        "script_block": (
            "fadeIn('#hero-title', 0.8, 0.5);\n"
            "fadeIn('#hero-sub', 0.6, 1.2);\n"
        ),
        "guidelines": [
            "Ken Burns options: `zoom-in`, `zoom-out`, `pan-left`, `pan-right`, `pan-up`, `zoom-pan-tl`",
            "Ken Burns works best on shots 8-15s. Below 6s the motion feels jarring.",
            "Gradient options: `gradient-bottom` (default), `gradient-top`, `gradient-full`, `gradient-center`",
            "Text overlay: white text with text-shadow for readability over images",
            "Image fills entire screen — text appears over a gradient scrim",
        ],
    },

    # ------------------------------------------------------------------
    # VIDEO_HERO — full-screen stock video background
    # ------------------------------------------------------------------
    "VIDEO_HERO": {
        "id": "VIDEO_HERO",
        "name": "Video Hero",
        "category": "cinematic",
        "description": "Full-screen stock video background with text overlay. STRONGLY PREFERRED over IMAGE_HERO for real-world topics.",
        "use_for": "Nature scenes, city time-lapses, lab footage, atmospheric openings, any scene with motion.",
        "requires_image": False,
        "requires_video": True,
        "preferred_domains": ["history", "science", "general"],
        "html_template": (
            "<div class='video-hero'>\n"
            "  <video class='stock-video' data-video-query='aerial ocean waves coral reef swimming fish'\n"
            "         autoplay muted loop playsinline></video>\n"
            "  <div class='image-text-overlay gradient-bottom'>\n"
            "    <h1 id='hero-title' style='opacity:0'>Life Under the Sea</h1>\n"
            "    <p id='hero-sub' style='opacity:0'>Exploring marine ecosystems</p>\n"
            "  </div>\n"
            "</div>\n"
        ),
        "script_block": (
            "fadeIn('#hero-title', 0.8, 0.5);\n"
            "fadeIn('#hero-sub', 0.6, 1.2);\n"
        ),
        "guidelines": [
            "Good video queries: 'aerial forest sunrise mist', 'chemistry lab beaker bubbling', 'microscope cells biology'",
            "Same gradient overlay classes as IMAGE_HERO: gradient-bottom, gradient-full, gradient-center",
            "Stock videos are free (Pexels) — prefer over plain backgrounds for real-world topics",
            "DON'T force a video background behind content that needs focus (math, code, dense text)",
        ],
    },

    # ------------------------------------------------------------------
    # IMAGE_SPLIT — image on one side, text on the other
    # ------------------------------------------------------------------
    "IMAGE_SPLIT": {
        "id": "IMAGE_SPLIT",
        "name": "Image Split",
        "category": "cinematic",
        "description": "Image on one side, text on the other.",
        "use_for": "Explaining a concept with a real-world visual reference.",
        "requires_image": True,
        "requires_video": False,
        "preferred_domains": ["science", "history", "general", "language"],
        "html_template": (
            "<div class='image-split-layout'>\n"
            "  <div class='split-image'>\n"
            "    <img class='generated-image'\n"
            "         data-img-prompt='close-up of plant cells under electron microscope, green chloroplasts, scientific illustration'\n"
            "         data-ken-burns='pan-right'\n"
            "         src='placeholder.png' />\n"
            "  </div>\n"
            "  <div class='split-text'>\n"
            "    <h2 id='split-title' style='opacity:0'>Chloroplasts</h2>\n"
            "    <p id='split-body' style='opacity:0'>These tiny green organelles capture sunlight for photosynthesis.</p>\n"
            "  </div>\n"
            "</div>\n"
        ),
        "script_block": (
            "fadeIn('#split-title', 0.5, 0.3);\n"
            "fadeIn('#split-body', 0.5, 0.8);\n"
        ),
        "guidelines": [
            "Ken Burns on the image side for subtle motion",
            "Text side: heading + 1-3 bullet points or short paragraph",
            "Portrait mode: stack top/bottom with `grid-template-rows: 1fr 1fr`",
        ],
    },

    # ------------------------------------------------------------------
    # LOWER_THIRD — key term banner at bottom
    # ------------------------------------------------------------------
    "LOWER_THIRD": {
        "id": "LOWER_THIRD",
        "name": "Lower Third",
        "category": "text",
        "description": "Key term banner at bottom of screen. Can OVERLAY other shots.",
        "use_for": "Introducing vocabulary, definitions, key facts.",
        "requires_image": False,
        "requires_video": False,
        "preferred_domains": ["language", "science", "general", "history"],
        "html_template": (
            "<div class='lower-third'>\n"
            "  <div class='lt-accent-bar'></div>\n"
            "  <div class='lt-content'>\n"
            "    <span class='lt-label'>KEY TERM</span>\n"
            "    <span class='lt-text'>Photosynthesis — Converting sunlight into chemical energy</span>\n"
            "  </div>\n"
            "</div>\n"
        ),
        "script_block": "",
        "guidelines": [
            "Slides in from left with CSS animation (built-in ltSlideIn keyframe)",
            "Can overlay IMAGE_HERO, VIDEO_HERO, or other shots",
            "Keep text concise: term + brief definition",
        ],
    },

    # ------------------------------------------------------------------
    # ANNOTATION_MAP — full-screen image with SVG arrows + labels
    # ------------------------------------------------------------------
    "ANNOTATION_MAP": {
        "id": "ANNOTATION_MAP",
        "name": "Annotation Map",
        "category": "cinematic",
        "description": "Full-screen image with animated SVG arrows + labels drawn on top.",
        "use_for": "Anatomy, geography, architecture, 'parts of X' — any labeled visual.",
        "requires_image": True,
        "requires_video": False,
        "preferred_domains": ["science", "history"],
        "html_template": (
            "<div class='annotation-map-container'>\n"
            "  <img class='generated-image annotation-map-bg'\n"
            "       data-img-prompt='cross-section of human heart, unlabeled, no text overlay, clinical illustration, {aspect_label}'\n"
            "       data-ken-burns='zoom-in'\n"
            "       src='placeholder.png' />\n"
            "  <svg id='anno-svg' class='annotation-overlay' viewBox='0 0 {canvas_width} {canvas_height}'>\n"
            "    <defs>\n"
            "      <marker id='ah1' markerWidth='10' markerHeight='7' refX='9' refY='3.5' orient='auto'>\n"
            "        <polygon points='0 0,10 3.5,0 7' fill='#ffffff'/>\n"
            "      </marker>\n"
            "    </defs>\n"
            "    <path id='a1' d='M750,420 L600,580' stroke='#ffffff' stroke-width='3' fill='none' marker-end='url(#ah1)'/>\n"
            "    <text id='l1' x='760' y='410' fill='#ffffff' font-size='30' font-family='Montserrat' font-weight='700' opacity='0'>Left Ventricle</text>\n"
            "  </svg>\n"
            "</div>\n"
        ),
        "script_block": (
            "animateSVG('anno-svg', 80);\n"
            "setTimeout(() => fadeIn('#l1', 0.4, 0), 900);\n"
        ),
        "guidelines": [
            "Image prompt MUST include 'unlabeled, no text overlay' so SVG labels are readable",
            "Use Vivus (animateSVG) to draw arrows progressively",
            "Stagger label fadeIns after arrows are drawn",
            "SVG viewBox must match canvas dimensions: viewBox='0 0 {canvas_width} {canvas_height}'",
        ],
    },

    # ------------------------------------------------------------------
    # DATA_STORY — animated D3.js chart
    # ------------------------------------------------------------------
    "DATA_STORY": {
        "id": "DATA_STORY",
        "name": "Data Story",
        "category": "data",
        "description": "Animated bar/line chart that builds during narration. ONE highlighted bar in accent color, rest neutral — reference-grade 2-color system.",
        "use_for": "Historical population data, scientific measurements, statistics with real numbers, 'this week vs last 4 weeks' style comparisons.",
        "requires_image": False,
        "requires_video": False,
        "preferred_domains": ["science", "history", "general"],
        "html_template": (
            "<!-- DATA_STORY: neutral bars + ONE accent highlight bar. Wrap in .stage-drift for slow camera pan during hold. -->\n"
            "<div class='stage-drift full-screen-center'>\n"
            "  <h2 id='chart-title' style='opacity:0; font-family:Bebas Neue,Impact,sans-serif; font-size:3rem; letter-spacing:0.05em;'>WEEKLY TRENDS</h2>\n"
            "  <div id='bar-row' style='display:flex; gap:28px; align-items:flex-end; height:320px; margin-top:40px;'>\n"
            "    <div class='bar bar-neutral' style='width:90px; height:140px; background:var(--brand-text,#111); transform:scaleY(0); transform-origin:bottom center;'></div>\n"
            "    <div class='bar bar-neutral' style='width:90px; height:170px; background:var(--brand-text,#111); transform:scaleY(0); transform-origin:bottom center;'></div>\n"
            "    <div class='bar bar-neutral' style='width:90px; height:130px; background:var(--brand-text,#111); transform:scaleY(0); transform-origin:bottom center;'></div>\n"
            "    <div class='bar bar-neutral' style='width:90px; height:165px; background:var(--brand-text,#111); transform:scaleY(0); transform-origin:bottom center;'></div>\n"
            "    <div class='bar bar-accent' id='hero-bar' style='width:110px; height:290px; background:var(--brand-accent); transform:scaleY(0); transform-origin:bottom center;'></div>\n"
            "  </div>\n"
            "  <div id='labels' style='display:flex; gap:28px; margin-top:12px; font-family:Inter,sans-serif; font-size:0.85rem; letter-spacing:0.18em; text-transform:uppercase;'>\n"
            "    <span style='width:90px;text-align:center;opacity:0'>WK 1</span>\n"
            "    <span style='width:90px;text-align:center;opacity:0'>WK 2</span>\n"
            "    <span style='width:90px;text-align:center;opacity:0'>WK 3</span>\n"
            "    <span style='width:90px;text-align:center;opacity:0'>WK 4</span>\n"
            "    <span style='width:110px;text-align:center;opacity:0;color:var(--brand-accent)'>THIS WK</span>\n"
            "  </div>\n"
            "  <div id='stat-callout' style='opacity:0; margin-top:32px; font-family:Bebas Neue,Impact,sans-serif; font-size:4.5rem; color:var(--brand-accent); line-height:0.95; letter-spacing:0.04em;'>$3.5 BILLION</div>\n"
            "  <div id='stat-source' style='opacity:0; margin-top:4px; font-family:Inter,sans-serif; font-size:1.1rem; color:var(--brand-text);'>Kleiner Perkins</div>\n"
            "</div>\n"
        ),
        "script_block": (
            "// 1. Title wipes in\n"
            "gsap.fromTo('#chart-title', {opacity:0, y:-20}, {opacity:1, y:0, duration:0.4, delay:0.1, ease:'expo.out'});\n"
            "// 2. Neutral bars grow from baseline (staggered 120ms, bottom-anchored scaleY)\n"
            "gsap.to('.bar-neutral', {scaleY:1, duration:0.6, delay:0.5, stagger:0.12, ease:'power3.out'});\n"
            "// 3. Week labels fade in under each bar\n"
            "gsap.to('#labels span', {opacity:1, duration:0.3, delay:1.0, stagger:0.1, ease:'power2.out'});\n"
            "// 4. Hero accent bar slams in AFTER neutrals settle — bouncy, dominant\n"
            "gsap.to('#hero-bar', {scaleY:1, duration:0.7, delay:1.8, ease:'back.out(1.4)'});\n"
            "// 5. Stat callout appears next to hero bar\n"
            "gsap.fromTo('#stat-callout', {opacity:0, x:30}, {opacity:1, x:0, duration:0.5, delay:2.4, ease:'expo.out'});\n"
            "gsap.fromTo('#stat-source', {opacity:0, x:30}, {opacity:1, x:0, duration:0.4, delay:2.7, ease:'power3.out'});\n"
            "// 6. MANDATORY continuous hold drift — slow diagonal pan of the whole composition (12s easy loop)\n"
            "gsap.fromTo('.stage-drift', {scale:1, x:0, y:0}, {scale:1.04, x:20, y:-10, duration:12, delay:0, ease:'none'});\n"
        ),
        "guidelines": [
            "Only use when narration explicitly mentions numbers/data worth visualizing.",
            "TWO-COLOR RULE: neutral bars use `var(--brand-text)` (usually near-black), ONE hero bar uses `var(--brand-accent)` (brand orange/red). Never three colors.",
            "BOTTOM-ANCHORED GROWTH: every bar must have `transform-origin:bottom center` + `transform:scaleY(0)` initial state, then GSAP `scaleY:1` with `power3.out` ease. Stagger neutrals 120ms apart, then delay the hero bar so it 'slams in last' (dominant reveal).",
            "HERO BAR EASE: use `back.out(1.4)` on the accent bar for a bouncy settle — this is the visual climax of the shot.",
            "CALLOUT TEXT: always follow the hero bar with a large Bebas Neue stat (`$3.5 BILLION`, `250K+`, etc.) + small Inter source label. Entrance: slide in from the right 400ms after the hero bar with `expo.out`.",
            "CONTINUOUS MOTION: wrap the content in `.stage-drift` and run `gsap.fromTo('.stage-drift', {x:0,y:0,scale:1}, {x:20,y:-10,scale:1.04, duration:12, ease:'none'})` so the whole composition drifts during any hold ≥4s. No static frames.",
            "For D3-driven charts, same rules apply: use `transition().delay((_,i)=>600+i*120).ease(d3.easeCubicOut)` and reserve `var(--brand-accent)` for the highlighted data point only.",
        ],
    },

    # ------------------------------------------------------------------
    # PROCESS_STEPS — sequential numbered nodes
    # ------------------------------------------------------------------
    "PROCESS_STEPS": {
        "id": "PROCESS_STEPS",
        "name": "Process Steps",
        "category": "data",
        "description": "Sequential step-by-step flow with numbered nodes connected by animated arrows.",
        "use_for": "Algorithms, biological processes, manufacturing steps, historical sequences, how-to explanations.",
        "requires_image": False,
        "requires_video": False,
        "preferred_domains": ["coding", "science", "math", "general"],
        "html_template": (
            "<div class='full-screen-center'>\n"
            "  <div class='process-flow'>\n"
            "    <div id='ps-1' class='process-node' style='opacity:0'>\n"
            "      <div class='node-num'>1</div>\n"
            "      <div class='node-body'>\n"
            "        <div class='node-title'>Gather Data</div>\n"
            "        <div class='node-desc'>Collect raw information from sources</div>\n"
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
            "  </div>\n"
            "</div>\n"
        ),
        "script_block": (
            "fadeIn('#ps-1', 0.5, 0);\n"
            "setTimeout(() => animateSVG('pc-1', 35), 1800);\n"
            "setTimeout(() => fadeIn('#ps-2', 0.5, 0), 2600);\n"
        ),
        "guidelines": [
            "Use 3-5 steps per shot. For more steps, split into two shots.",
            "Steps reveal one-by-one with Vivus-drawn connectors between them",
            "Annotate the final step with `annotate('#ps-N .node-title', {type:'box', color:'#10b981'})`",
            "Adjust timing using word timestamps",
        ],
    },

    # ------------------------------------------------------------------
    # EQUATION_BUILD — KaTeX terms revealing sequentially
    # ------------------------------------------------------------------
    "EQUATION_BUILD": {
        "id": "EQUATION_BUILD",
        "name": "Equation Build",
        "category": "data",
        "description": "KaTeX equation terms reveal one-by-one in sync with narration.",
        "use_for": "Math formulas, physics laws, chemistry equations — any formula explained term-by-term.",
        "requires_image": False,
        "requires_video": False,
        "preferred_domains": ["math", "science"],
        "html_template": (
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
        ),
        "script_block": (
            "fadeIn('#eq-ctx', 0.5, 0);\n"
            "setTimeout(() => fadeIn('#eq-0', 0.4, 0), 1200);\n"
            "setTimeout(() => fadeIn('#eq-1', 0.3, 0), 2000);\n"
            "setTimeout(() => fadeIn('#eq-2', 0.4, 0), 2800);\n"
            "setTimeout(() => fadeIn('#eq-3', 0.4, 0), 3600);\n"
            "setTimeout(() => fadeIn('#eq-note', 0.5, 0), 4800);\n"
            "setTimeout(() => annotate('#eq-0', {type:'circle', color:'#dc2626', strokeWidth:3, duration:700}), 5200);\n"
        ),
        "guidelines": [
            "KaTeX auto-renders on page load even if elements are opacity:0. Revealing with fadeIn shows pre-rendered math.",
            "Add `.eq-term` class to main variables, `.eq-sep` to operators/equals signs",
            "Each term is its own `<span>` for sequential reveal",
            "Annotate key terms after all visible using Rough Notation",
        ],
    },

    # ------------------------------------------------------------------
    # PRODUCT_HERO — single subject/product, background layers animate behind
    # ------------------------------------------------------------------
    "PRODUCT_HERO": {
        "id": "PRODUCT_HERO",
        "name": "Product Hero",
        "category": "cinematic",
        "description": "Single hero product/subject stays center-stage while background layers (color, texture, watermark, geometric shapes) animate in behind it. Classic brand reel / product showcase style.",
        "use_for": "Product showcases, brand reels, historical artifact focus ('1917'), company origin stories, single-subject explainers. The subject never moves — the world changes around it.",
        "requires_image": True,
        "requires_video": False,
        "preferred_domains": ["general", "history", "science", "saas_marketing", "business_marketing", "visual_storytelling"],
        "html_template": (
            "<!-- PRODUCT_HERO: hero subject fixed center, layers animate behind -->\n"
            "<div class='product-stage'>\n"
            "\n"
            "  <!-- LAYER 0: Base background color (always visible) -->\n"
            "  <div id='bg-base' style='position:absolute;inset:0;background:var(--brand-bg);z-index:0;'></div>\n"
            "\n"
            "  <!-- LAYER 1: Texture overlay (halftone/pattern) — fades in at ~3s -->\n"
            "  <div id='bg-texture' class='halftone' style='position:absolute;inset:0;z-index:1;opacity:0;\n"
            "       background-color:var(--brand-primary);'></div>\n"
            "\n"
            "  <!-- LAYER 2: Background watermark/geometric shape — scales in softly -->\n"
            "  <svg id='bg-mark' viewBox='0 0 400 400'\n"
            "       style='position:absolute;width:130%;height:130%;top:-15%;left:-15%;z-index:2;opacity:0;'>\n"
            "    <!-- Example: large circle watermark. Replace with star, logo shape, etc. -->\n"
            "    <circle cx='200' cy='200' r='185'\n"
            "            fill='none' stroke='rgba(255,255,255,0.1)' stroke-width='2'\n"
            "            stroke-dasharray='14 6'/>\n"
            "    <text x='200' y='215' text-anchor='middle'\n"
            "          fill='rgba(255,255,255,0.06)' font-family='Bebas Neue,Impact,sans-serif'\n"
            "          font-size='72' letter-spacing='18'>BRAND</text>\n"
            "  </svg>\n"
            "\n"
            "  <!-- FLAT BADGE: year / stat — slams in from top -->\n"
            "  <div style='position:absolute;top:11%;left:50%;transform:translateX(-50%);z-index:8;overflow:hidden;'>\n"
            "    <div id='badge' class='flat-badge' style='transform:translateY(-120%);'>\n"
            "      1917\n"
            "    </div>\n"
            "  </div>\n"
            "\n"
            "  <!-- HERO SUBJECT IMAGE (cutout, always center-stage) -->\n"
            "  <img id='subject' class='generated-image'\n"
            "       data-img-prompt='white product centered, isolated on solid white background, no other objects, clean edges, professional product photography'\n"
            "       data-cutout='true' src='placeholder.png'\n"
            "       style='position:absolute;bottom:22%;left:50%;transform:translateX(-50%);\n"
            "              width:74%;max-width:580px;z-index:10;opacity:0;' />\n"
            "\n"
            "  <!-- TRACKING LABEL: small word appears below subject -->\n"
            "  <div id='label-a' class='tracking-label'\n"
            "       style='position:absolute;bottom:16%;left:50%;transform:translateX(-50%);\n"
            "              z-index:11;opacity:0;'>HARDWOOD</div>\n"
            "\n"
            "  <!-- SLAM TEXT: bottom tagline wipes up last -->\n"
            "  <div style='position:absolute;bottom:4%;left:0;right:0;text-align:center;z-index:20;'\n"
            "       class='slam-wrapper'>\n"
            "    <div id='slam' class='slam-text' style='color:var(--brand-text);'>THE ICON</div>\n"
            "  </div>\n"
            "\n"
            "</div>\n"
        ),
        "script_block": (
            "// 1. Subject photo entrance — drops in from slight top offset\n"
            "gsap.fromTo('#subject', {opacity:0, y:-30}, {opacity:1, y:0, duration:0.7, delay:0.2, ease:'power3.out'});\n"
            "// 2. Badge slams in from above\n"
            "gsap.to('#badge', {y:'0%', duration:0.45, delay:0.4, ease:'expo.out'});\n"
            "// 3. Subtle continuous scale on subject (Ken Burns feel)\n"
            "gsap.to('#subject', {scale:1.04, duration:9, delay:0.2, ease:'none'});\n"
            "// 4. Background texture crossfade (act 2 — halfway through shot)\n"
            "gsap.to('#bg-texture', {opacity:1, duration:0.9, delay:3.5, ease:'power2.inOut'});\n"
            "gsap.to('#bg-base', {opacity:0, duration:0.9, delay:3.5, ease:'power2.inOut'});\n"
            "// 5. Watermark scales in softly behind subject\n"
            "gsap.fromTo('#bg-mark', {scale:0.55, opacity:0}, {scale:1, opacity:1, duration:2.0, delay:3.8, ease:'power2.out'});\n"
            "// 6. Tracking label fades in\n"
            "gsap.to('#label-a', {opacity:1, duration:0.5, delay:5.0, ease:'power2.out'});\n"
            "// 7. Slam text wipes up\n"
            "gsap.to('#slam', {y:'0%', duration:0.55, delay:7.5, ease:'expo.out'});\n"
        ),
        "guidelines": [
            "SUBJECT: always `position:absolute`, `data-cutout='true'`, bottom 20–30% of frame, width 65–80%. Never move it.",
            "BACKGROUND ACTS: build 2–3 'acts' by crossfading layers — solid color → texture (halftone/SVG lines) → watermark/geometric shape.",
            "FLAT BADGE: use `.flat-badge` class. Zero border-radius. Black text on accent color. Font: Bebas Neue.",
            "TRACKING LABEL: `.tracking-label` — small ALL-CAPS, wide letter-spacing, appears between subject and slam text.",
            "SLAM TEXT: use `.slam-wrapper` + `.slam-text`. Last thing to appear. translateY(100%→0%) with `expo.out`.",
            "BACKGROUND WATERMARK: large SVG (130% canvas), opacity 0.06–0.12, scales from 0.5 to 1. Brand circle, star, or logo shape.",
            "HALFTONE TEXTURE: use `class='halftone'` on a background layer. Apply brand color as `background-color`.",
            "CONTINUOUS MOTION: apply a 8–12s slow GSAP scale (1→1.05) on the subject and a slow drift on bg-mark.",
            "COLOR ACTS: bg-base starts as light/neutral. bg-texture (halftone layer) can be brand-primary for a bold act 2.",
            "DO NOT move the subject between acts — only the background layers change.",
        ],
    },

    # ------------------------------------------------------------------
    # KINETIC_TEXT — pipeline-built word-sync (no LLM HTML)
    # ------------------------------------------------------------------
    "KINETIC_TEXT": {
        "id": "KINETIC_TEXT",
        "name": "Kinetic Text",
        "category": "text",
        "description": "Words appear exactly when spoken — GSAP tweens are built directly from Whisper timestamps. 100% accurate sync. Pipeline generates HTML; no LLM call needed for this type.",
        "use_for": "Hooks, conclusions, emphasis moments. Use at most once per video.",
        "requires_image": False,
        "requires_video": False,
        "preferred_domains": ["general", "language", "science", "math"],
        "html_template": (
            "<!-- KINETIC_TEXT is pipeline-generated. Each word is a <span> with a GSAP fromTo tween. -->\n"
            "<div class='kinetic-text-container'>\n"
            "  <span id='kw-0' class='kw' style='opacity:0'>Word</span>\n"
            "  <span id='kw-1' class='kw' style='opacity:0'>after</span>\n"
            "  <span id='kw-2' class='kw' style='opacity:0'>word</span>\n"
            "</div>\n"
        ),
        "script_block": (
            "// Example — the pipeline generates the real tween per word from Whisper timestamps:\n"
            "gsap.fromTo('#kw-0', {opacity:0, y:20}, {opacity:1, y:0, duration:0.25, delay:0.0});\n"
            "gsap.fromTo('#kw-1', {opacity:0, y:20}, {opacity:1, y:0, duration:0.25, delay:0.55});\n"
            "gsap.fromTo('#kw-2', {opacity:0, y:20}, {opacity:1, y:0, duration:0.25, delay:0.92});\n"
        ),
        "guidelines": [
            "Do not write KINETIC_TEXT HTML manually — the pipeline builds it from Whisper word timestamps.",
            "Use at most once per video. Never place two KINETIC_TEXT shots back-to-back.",
            "Best for hooks ('What if everything you knew was wrong?') and conclusions.",
        ],
    },

    # ------------------------------------------------------------------
    # INFOGRAPHIC_SVG — pure SVG draw-on illustration, no photos
    # ------------------------------------------------------------------
    "INFOGRAPHIC_SVG": {
        "id": "INFOGRAPHIC_SVG",
        "name": "Infographic SVG",
        "category": "illustration",
        "description": "Pure inline SVG that draws itself on screen via stroke-dashoffset. No photos, no AI images. Cream background with CSS grid. 2-color brand palette only.",
        "use_for": "Sports plays, anatomy, diagrams, process flows, maps, how-to explainers — anything spatial or mechanical that can be DRAWN, not photographed.",
        "requires_image": False,
        "requires_video": False,
        "preferred_domains": ["science", "biology", "general", "sports", "geography", "history"],
        "html_template": (
            "<!-- INFOGRAPHIC_SVG: cream+grid+paper-grain bg, 2-color content palette, red tech annotations,\n"
            "     hand-drawn wobble via filter='url(#roughen)', stroke-dashoffset draw-on, blueprint-style. -->\n"
            "<div class='svg-canvas paper-texture'>\n"
            "  <div class='stage-drift'>\n"
            "\n"
            "    <!-- Yellow flat-badge label top-left (slides in from left) -->\n"
            "    <div id='scene-label' class='flat-badge' style='position:absolute; top:8%; left:6%;\n"
            "         transform:translateX(-110%); font-size:1.3rem; padding:6px 16px;'>A NEW DIMENSION.</div>\n"
            "\n"
            "    <!-- Main line-art diagram wrapped in roughen filter for architect-sketch wobble -->\n"
            "    <svg id='diagram' viewBox='0 0 900 500'\n"
            "         style='position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);\n"
            "                width:72%; max-width:1000px;'>\n"
            "\n"
            "      <!-- === CONTENT LAYER: hand-drawn line art === -->\n"
            "      <g filter='url(#roughen)' stroke='var(--brand-text,#111)' stroke-width='2.8' fill='none'>\n"
            "        <!-- Laptop body outline -->\n"
            "        <rect id='laptop-screen' x='180' y='100' width='540' height='260' rx='8'\n"
            "              pathLength='1' stroke-dasharray='1' stroke-dashoffset='1'/>\n"
            "        <rect id='laptop-base'   x='140' y='360' width='620' height='36' rx='4'\n"
            "              pathLength='1' stroke-dasharray='1' stroke-dashoffset='1'/>\n"
            "        <!-- Small crosshair target in center of screen — used as zoom-through target on exit -->\n"
            "        <circle id='focus-target' cx='450' cy='230' r='14' fill='var(--brand-text,#111)'\n"
            "                opacity='0' style='transform-origin:450px 230px;'/>\n"
            "      </g>\n"
            "\n"
            "      <!-- === ANNOTATION LAYER: red dashed dimension lines (engineering markup) === -->\n"
            "      <g>\n"
            "        <!-- Top dimension: width -->\n"
            "        <line x1='180' y1='78' x2='720' y2='78' class='tech-annotation'\n"
            "              pathLength='1' stroke-dasharray='1' stroke-dashoffset='1'/>\n"
            "        <text x='450' y='68' text-anchor='middle' class='tech-annotation-label' opacity='0'>16-INCH DISPLAY</text>\n"
            "        <!-- Right dimension: bezel -->\n"
            "        <line x1='740' y1='100' x2='740' y2='360' class='tech-annotation'\n"
            "              pathLength='1' stroke-dasharray='1' stroke-dashoffset='1'/>\n"
            "        <text x='760' y='230' class='tech-annotation-label' opacity='0'\n"
            "              transform='rotate(90 760 230)'>5MM BEZEL</text>\n"
            "      </g>\n"
            "    </svg>\n"
            "\n"
            "    <!-- Fig caption (italic serif, bottom-left) -->\n"
            "    <div id='fig-caption' class='tech-annotation-caption' style='position:absolute; bottom:6%; left:6%;\n"
            "         opacity:0;'>Fig. 1 — Redesigned thermal architecture.</div>\n"
            "  </div>\n"
            "\n"
            "  <!-- Vignette overlay for scene-exit darkening (kept opacity:0 until shot end) -->\n"
            "  <div class='vignette-overlay'></div>\n"
            "</div>\n"
        ),
        "script_block": (
            "// Assume SHOT_END is the shot duration (pass from caller). Example timeline for a 5s shot.\n"
            "const SHOT_END = 5.0;\n"
            "\n"
            "// 0. MANDATORY continuous hold drift — whole composition drifts diagonally (12s loop)\n"
            "gsap.fromTo('.stage-drift', {x:0,y:0,scale:1}, {x:20,y:-10,scale:1.04, duration:12, ease:'none'});\n"
            "\n"
            "// 1. Draw primary line art — stroke-dashoffset works cleanly with filter='url(#roughen)'\n"
            "gsap.to('#laptop-screen', {strokeDashoffset:0, duration:1.0, delay:0.3, ease:'power2.inOut'});\n"
            "gsap.to('#laptop-base',   {strokeDashoffset:0, duration:0.5, delay:0.9, ease:'power2.inOut'});\n"
            "\n"
            "// 2. Draw red dashed dimension lines (engineering annotations)\n"
            "gsap.to('.tech-annotation', {strokeDashoffset:0, duration:0.7, delay:1.3, stagger:0.1, ease:'power2.out'});\n"
            "gsap.to('.tech-annotation-label', {opacity:1, duration:0.4, delay:1.7, stagger:0.1, ease:'power2.out'});\n"
            "\n"
            "// 3. Yellow flat-badge slams in from left (headline)\n"
            "gsap.to('#scene-label', {x:'0%', duration:0.45, delay:2.0, ease:'expo.out'});\n"
            "\n"
            "// 4. Focus target dot pops in (used as the zoom-through target on scene exit)\n"
            "gsap.fromTo('#focus-target', {scale:0, opacity:0},\n"
            "    {scale:1, opacity:1, duration:0.35, delay:2.4, ease:'back.out(2)', transformOrigin:'center center'});\n"
            "\n"
            "// 5. Italic serif fig caption fades in (textbook feel)\n"
            "gsap.to('#fig-caption', {opacity:1, duration:0.5, delay:2.8, ease:'power2.out'});\n"
            "\n"
            "// === SCENE EXIT — pick ONE of the two patterns below ===\n"
            "\n"
            "// OPTION A: ZOOM-THROUGH TRANSITION (camera pushes into focus-target)\n"
            "gsap.to('#focus-target', {scale:25, duration:0.8, delay:SHOT_END-0.8, ease:'power3.in'});\n"
            "gsap.to('.stage-drift', {opacity:0, duration:0.3, delay:SHOT_END-0.3, ease:'power2.in'});\n"
            "\n"
            "// OPTION B: VIGNETTE EXIT (radial darkening — cinematic breath-beat)\n"
            "// gsap.to('.vignette-overlay', {opacity:1, duration:0.6, delay:SHOT_END-0.6, ease:'power2.in'});\n"
            "\n"
            "// === BALL MOTIONPATH example (use for arcs, trajectories) ===\n"
            "// if (window.MotionPathPlugin) gsap.registerPlugin(MotionPathPlugin);\n"
            "// gsap.to('#ball', {motionPath:{path:'#arc', align:'#arc', alignOrigin:[0.5,0.5]},\n"
            "//     duration:1.5, delay:2.6, ease:'power1.inOut'});\n"
            "\n"
            "// === BLUEPRINT DRAFT pattern (for multi-node diagrams — pipelines, flow charts) ===\n"
            "// <g class='draft-guide'><path pathLength='1' stroke-dasharray='1' stroke-dashoffset='1'/></g>\n"
            "// <g class='solid-overlay'><path opacity='0'/></g>\n"
            "// gsap.to('.draft-guide path',   {strokeDashoffset:0, duration:1.2, stagger:0.08, ease:'power2.inOut'});\n"
            "// gsap.to('.solid-overlay path', {opacity:1, duration:0.3, delay:1.6, stagger:0.1, ease:'expo.out'});\n"
            "// gsap.fromTo('.node-badge', {x:-30, opacity:0},\n"
            "//     {x:0, opacity:1, duration:0.4, delay:2.2, stagger:0.12, ease:'expo.out'});\n"
        ),
        "guidelines": [
            "BACKGROUND: ALWAYS use `<div class='svg-canvas'>` as root — it provides cream #f5f0e8 + CSS grid.",
            "PALETTE: ONLY `var(--brand-primary)` and `var(--brand-accent)`. Never add a third color.",
            "DRAW-ON PATTERN (canonical): Add `pathLength='1' stroke-dasharray='1' stroke-dashoffset='1'` to every <path>/<rect>/<line>/<circle>/<ellipse> that should draw in. Then `gsap.to(el, {strokeDashoffset:0, duration:X, delay:Y, ease:'power2.inOut'});`.",
            "**BLUEPRINT DRAFT** (two-phase reveal — used by top-tier explainers like 'How to Play Volleyball'): "
            "Phase 1 draws a faint DASHED guide for the whole topology first. Phase 2 overlays SOLID-black nodes/badges on top. "
            "The dashed guide feels like an architect drafting, the solid overlay feels like ink landing. Example: "
            "`<g id='draft' stroke='rgba(0,0,0,0.35)' stroke-width='1.5' stroke-dasharray='4 4' fill='none'>"
            "<path d='M50,200 L200,200 L200,100 L400,100' pathLength='1' stroke-dashoffset='1'/></g>` "
            "then for the solid overlay: `<g id='solid' stroke='var(--brand-text)' stroke-width='2.5' fill='none'>"
            "<path d='M50,200 L200,200 L200,100 L400,100' opacity='0'/></g>`. "
            "Script: `gsap.to('#draft path', {strokeDashoffset:0, duration:1.2, ease:'power2.inOut', stagger:0.08});` "
            "then `gsap.to('#solid path', {opacity:1, duration:0.3, delay:1.4, stagger:0.1, ease:'expo.out'});`. "
            "Use this for: pipeline diagrams, flow charts, agent topologies, architectural schematics, map connectors.",
            "**PAPER GRAIN TEXTURE**: Add `.paper-texture` class to `.svg-canvas` root: "
            "`<div class='svg-canvas paper-texture'>` — applies a fibrous parchment noise overlay via SVG data-URI. "
            "Use `.paper-texture.strong` for a heavier sketchbook feel. Required for the 'MacBook Neo blueprint' look.",
            "**HAND-DRAWN WOBBLE**: Wrap line-art SVG elements in `<g filter='url(#roughen)'>` to make "
            "clean bezier paths look like architect sketches. Preserves `stroke-dashoffset` animation so "
            "draw-on still works. Use `url(#roughen-strong)` for bolder wobble. Example: "
            "`<g filter='url(#roughen)'><rect id='laptop' ... pathLength='1' stroke-dashoffset='1'/></g>`.",
            "**TECH ANNOTATIONS** (red dashed dimension lines — engineering drafting feel): "
            "Use `.tech-annotation` class for red dashed SVG strokes. Example: "
            "`<line x1='100' y1='40' x2='500' y2='40' class='tech-annotation' pathLength='1' stroke-dashoffset='1'/>` "
            "with a `<text class='tech-annotation-label' x='300' y='30'>16-INCH DISPLAY</text>` above it. "
            "Pair with `.tech-annotation-caption` italic serif for 'Fig. 1 — description' fig captions. "
            "Red annotations DON'T violate the 2-color rule — they read as 'utility markup', not content.",
            "**ZOOM-THROUGH TRANSITION** (scene exit via zoom into an element): "
            "Pick a small element in the current scene (crosshair dot, badge corner, node marker) and tween "
            "`gsap.to('#target', {scale:25, x:(window.innerWidth/2 - targetX), y:(window.innerHeight/2 - targetY), duration:0.8, delay:shotEnd-0.8, ease:'power3.in'});` "
            "Combine with `gsap.to('.stage-drift', {opacity:0, duration:0.3, delay:shotEnd-0.3, ease:'power2.in'});` "
            "for a seamless camera-push transition between scenes. Used in the MacBook Neo video between laptop → chip → OLED scenes.",
            "**VIGNETTE EXIT TRANSITION** (cinematic fade-out darkening from edges): "
            "Add `<div class='vignette-overlay'></div>` as the last child. Tween at the end of the shot: "
            "`gsap.to('.vignette-overlay', {opacity:1, duration:0.6, delay:shotEnd-0.6, ease:'power2.in'});` "
            "Gives a dramatic breath-beat before the outro. Pair with `.stage-drift` scale-up for "
            "zoom-while-darkening effect.",
            "CIRCLE/DOT ENTRANCE: `gsap.to('.dots', {scale:1, opacity:1, stagger:0.12, delay:1.0, ease:'back.out(2)', transformOrigin:'center center'});` (set initial scale:0, opacity:0 inline).",
            "BALL MOTION PATH: `<path id='arc' d='M...' fill='none' stroke='none'/>` + `<circle id='ball'/>` + `gsap.to('#ball', {motionPath:{path:'#arc', align:'#arc'}, duration:1.5, ease:'power1.inOut'});` — always guard with `if(window.MotionPathPlugin) gsap.registerPlugin(MotionPathPlugin);`.",
            "ISOMETRIC LAYOUT (optional for courts/maps): `<g style='transform:rotateX(60deg) rotateZ(-45deg); transform-style:preserve-3d;'>`.",
            "SECTION BADGE SLIDE-IN: `<div style='overflow:hidden;display:inline-block'><div id='badge' style='background:var(--brand-accent);padding:6px 18px;transform:translateX(-110%);border-radius:4px;'>1. THE PASS</div></div>` + `gsap.to('#badge',{x:'0%',duration:0.45,ease:'expo.out'});`.",
            "DO NOT: use `<img>`, `<video>`, `data-img-prompt`, dark backgrounds, more than 2 colors.",
            "DO NOT: use `background-image` referencing external URLs in any style attribute.",
            "STAGGER timing: entrance for each SVG element should be 0.1-0.2s apart. Keep total shot ≤5s.",
        ],
    },

    # ------------------------------------------------------------------
    # KINETIC_TITLE — bold full-screen typography, word-wipe reveal
    # ------------------------------------------------------------------
    "KINETIC_TITLE": {
        "id": "KINETIC_TITLE",
        "name": "Kinetic Title",
        "category": "text",
        "description": "Full-screen bold typography on cream background. Word-wipe reveal (translateY 100%→0%) with one accent-color word. For hooks, section intros, and outros.",
        "use_for": "Opening hooks, section headers ('1. THE PASS'), concluding calls-to-action ('GET OUT THERE AND PLAY'). No diagrams — single powerful phrase only.",
        "requires_image": False,
        "requires_video": False,
        "preferred_domains": ["general", "sports", "language", "history", "science"],
        "html_template": (
            "<!-- KINETIC_TITLE: cream bg, massive type, word-wipe reveal, 1 accent word -->\n"
            "<div class='svg-canvas' style='display:flex; flex-direction:column; align-items:center;\n"
            "     justify-content:center; overflow:hidden;'>\n"
            "\n"
            "  <!-- Word-wipe reveal: each word wrapped in overflow:hidden container -->\n"
            "  <div style='display:flex; flex-wrap:wrap; gap:0.3em; justify-content:center;\n"
            "       align-items:flex-end; line-height:1;'>\n"
            "\n"
            "    <div style='overflow:hidden;'>\n"
            "      <span id='kw-0' style='display:inline-block; transform:translateY(100%);\n"
            "          font-family:Bebas Neue,Impact,sans-serif; font-size:8rem;\n"
            "          color:var(--brand-primary); letter-spacing:0.06em;'>GET</span>\n"
            "    </div>\n"
            "\n"
            "    <div style='overflow:hidden;'>\n"
            "      <span id='kw-1' style='display:inline-block; transform:translateY(100%);\n"
            "          font-family:Bebas Neue,Impact,sans-serif; font-size:8rem;\n"
            "          color:var(--brand-primary); letter-spacing:0.06em;'>OUT</span>\n"
            "    </div>\n"
            "\n"
            "    <div style='overflow:hidden;'>\n"
            "      <span id='kw-2' style='display:inline-block; transform:translateY(100%);\n"
            "          font-family:Bebas Neue,Impact,sans-serif; font-size:8rem;\n"
            "          color:var(--brand-primary); letter-spacing:0.06em;'>THERE</span>\n"
            "    </div>\n"
            "\n"
            "    <div style='overflow:hidden;'>\n"
            "      <span id='kw-3' style='display:inline-block; transform:translateY(100%);\n"
            "          font-family:Bebas Neue,Impact,sans-serif; font-size:8rem;\n"
            "          color:var(--brand-accent); letter-spacing:0.06em;'>AND PLAY</span>\n"
            "    </div>\n"
            "\n"
            "  </div>\n"
            "\n"
            "  <!-- Optional: badge section intro (uncomment for section headers) -->\n"
            "  <!-- <div style='overflow:hidden;display:inline-block;margin-top:2rem;'>\n"
            "    <div id='badge' style='background:var(--brand-accent);color:#fff;\n"
            "        padding:8px 24px;border-radius:4px;font-family:Bebas Neue,sans-serif;\n"
            "        font-size:1.8rem;letter-spacing:0.1em;transform:translateX(-110%);'>1. THE PASS</div>\n"
            "  </div> -->\n"
            "\n"
            "</div>\n"
        ),
        "script_block": (
            "// Word-wipe: translateY(100% → 0%) staggered per word\n"
            "gsap.to('#kw-0', {y:'0%', duration:0.4, delay:0.05, ease:'power3.out'});\n"
            "gsap.to('#kw-1', {y:'0%', duration:0.4, delay:0.20, ease:'power3.out'});\n"
            "gsap.to('#kw-2', {y:'0%', duration:0.4, delay:0.35, ease:'power3.out'});\n"
            "gsap.to('#kw-3', {y:'0%', duration:0.45, delay:0.50, ease:'expo.out'});\n"
            "// For badge slide-in (if used):\n"
            "// gsap.to('#badge', {x:'0%', duration:0.45, delay:0.2, ease:'expo.out'});\n"
        ),
        "guidelines": [
            "BACKGROUND: Use `<div class='svg-canvas'>` — cream #f5f0e8 with grid. Never a dark background.",
            "TYPOGRAPHY: Bebas Neue or Impact, 7-10rem. All caps. Lots of whitespace.",
            "ACCENT WORD: The last word or key word gets `color:var(--brand-accent)`. All others use `var(--brand-primary)`.",
            "WORD-WIPE PATTERN: Wrap each word in `<div style='overflow:hidden'><span id='kw-N' style='display:inline-block;transform:translateY(100%)'>WORD</span></div>`. Animate: `gsap.to('#kw-N', {y:'0%', duration:0.4, delay:N*0.15, ease:'power3.out'});`.",
            "SECTION BADGE: `<div style='overflow:hidden;display:inline-block'><div id='badge' style='background:var(--brand-accent);transform:translateX(-110%)'>1. THE PASS</div></div>` + `gsap.to('#badge',{x:'0%',duration:0.45,ease:'expo.out'});`.",
            "KEEP IT MINIMAL: one phrase, 2-5 words. No body text, no diagrams, no images.",
            "Ideal duration: 1.5-3s. The words should all be visible by the 1s mark.",
        ],
    },

    # ------------------------------------------------------------------
    # ANIMATED_ASSET — cutout images with GSAP animation
    # ------------------------------------------------------------------
    "ANIMATED_ASSET": {
        "id": "ANIMATED_ASSET",
        "name": "Animated Asset",
        "category": "interactive",
        "description": "Cutout images with transparent backgrounds, positioned absolutely, animated with GSAP.",
        "use_for": "Illustrating concepts with floating objects — molecules, planets, animals, tools, historical artifacts.",
        "requires_image": True,
        "requires_video": False,
        "preferred_domains": ["science", "history", "general"],
        "html_template": (
            "<div style='position:relative; width:{canvas_width}px; height:{canvas_height}px; overflow:hidden;'>\n"
            "  <h1 id='title' style='opacity:0; position:absolute; top:80px; left:100px;\n"
            "      font-family:Montserrat,sans-serif; font-size:64px; font-weight:800;\n"
            "      color:var(--text-color,#fff);'>The Water Cycle</h1>\n"
            "  <img id='cloud' class='generated-image'\n"
            "       data-img-prompt='single white fluffy cumulus cloud, centered, isolated on solid dark blue background, no other objects, clean edges'\n"
            "       data-cutout='true' src='placeholder.png'\n"
            "       style='position:absolute; top:60px; right:100px; width:350px; opacity:0;' />\n"
            "  <img id='sun' class='generated-image'\n"
            "       data-img-prompt='bright yellow sun with gentle rays, centered, isolated on solid dark navy background, no other objects, clean edges'\n"
            "       data-cutout='true' src='placeholder.png'\n"
            "       style='position:absolute; top:30px; left:200px; width:200px; opacity:0;' />\n"
            "</div>\n"
        ),
        "script_block": (
            "fadeIn('#title', 0.5, 0);\n"
            "gsap.fromTo('#sun', {scale:0, opacity:0}, {scale:1, opacity:1, duration:1.2, delay:0.3, ease:'back.out(1.7)'});\n"
            "gsap.fromTo('#cloud', {x:300, opacity:0}, {x:0, opacity:1, duration:1.5, delay:0.8, ease:'power2.out'});\n"
        ),
        "guidelines": [
            "Use `position:absolute` for ALL elements so they can be placed freely",
            "Image prompts MUST describe a SINGLE object on a SOLID, HIGH-CONTRAST background for clean cutout",
            "  Good: 'single red apple, centered, isolated on solid white background, studio lighting'",
            "  Bad: 'apples on a table in a kitchen' (complex background = rough edges)",
            "ALWAYS end cutout prompts with: 'isolated on solid [color] background, no other objects, clean edges'",
            "Choose background color that CONTRASTS with the object",
            "Always include `data-cutout=\"true\"` on images needing background removal",
            "Keep animations simple: float-in, drop, scale-up, slide, gentle rotation",
            "Max 3 elements animating simultaneously. Stagger reveals 300-500ms apart.",
            "Easing: `power2.out` (standard), `expo.out` (grand), `sine.inOut` (smooth loops). Avoid `linear`.",
            "After entrance animation, objects must STAY VISIBLE during narration — don't animate out.",
        ],
    },
    # ------------------------------------------------------------------
    # SOURCE_CLIP — play a clip from the indexed source video with
    # transparent HTML overlays on top (captions, lower thirds, callouts)
    # ------------------------------------------------------------------
    "SOURCE_CLIP": {
        "id": "SOURCE_CLIP",
        "name": "Source Video Clip",
        "category": "video",
        "description": (
            "Play a clip from the indexed source video. The viewer sees the original footage "
            "(the speaker, the interview setting, the screen recording). HTML overlays render "
            "ON TOP of the video with a transparent background. Use for key quotes, soundbites, "
            "emotional moments, or showing the original content."
        ),
        "use_for": (
            "Showing the original speaker during impactful quotes, "
            "displaying screen recordings during key demonstrations, "
            "any moment where the source footage is more powerful than AI graphics."
        ),
        "requires_image": False,
        "requires_video": False,
        "preferred_domains": ["input_video_podcast", "input_video_demo", "general"],
        "html_template": (
            "<!-- SOURCE_CLIP: overlay on top of source video footage -->\n"
            "<!-- CRITICAL: background MUST be #000000 (black) — black pixels become transparent -->\n"
            "<!-- during compositing. The source video plays behind all non-black content. -->\n"
            "<div style='width:100%; height:100%; position:relative; background:#000000;'>\n"
            "\n"
            "  <!-- Lower-third caption (bottom 20% of screen) -->\n"
            "  <div style='position:absolute; bottom:8%; left:5%; right:5%;\n"
            "       background:rgba(0,0,0,0.7); padding:1.2rem 2rem; border-radius:0.5rem;\n"
            "       border-left:4px solid var(--brand-accent);'>\n"
            "    <div id='caption-text' style='font-family:Inter,sans-serif; font-size:1.8rem;\n"
            "         color:#fff; font-weight:600; opacity:0; transform:translateY(10px);'>\n"
            "      Design is how it works\n"
            "    </div>\n"
            "  </div>\n"
            "\n"
            "  <!-- Optional: speaker name title -->\n"
            "  <div id='name-tag' style='position:absolute; bottom:28%; left:5%;\n"
            "       opacity:0; transform:translateX(-20px);'>\n"
            "    <span style='font-family:Bebas Neue,sans-serif; font-size:1.3rem;\n"
            "         color:var(--brand-accent); letter-spacing:0.12em;'>STEVE JOBS</span>\n"
            "  </div>\n"
            "\n"
            "</div>\n"
        ),
        "script_block": (
            "// Animate caption in\n"
            "gsap.to('#caption-text', {opacity:1, y:0, duration:0.5, delay:0.3, ease:'power3.out'});\n"
            "// Animate name tag in\n"
            "gsap.to('#name-tag', {opacity:1, x:0, duration:0.4, delay:0.6, ease:'power2.out'});\n"
        ),
        "guidelines": [
            "Background MUST be solid #000000 (black). Black pixels become transparent during compositing.",
            "All non-black content renders as overlay on top of the source video footage.",
            "Keep overlays in the BOTTOM 30% of the screen — don't cover the speaker's face.",
            "Use semi-transparent dark backgrounds (rgba(0,0,0,0.7)) for text readability.",
            "Suggested elements: captions, lower thirds, name titles, callout arrows, stats.",
            "DO NOT use <img> tags or data-img-prompt — the video itself is the visual.",
            "DO NOT use data-video-query — the source video is already playing.",
            "Animations should be subtle — the video content is the star, overlays support it.",
        ],
    },
}


# ═══════════════════════════════════════════════════════════════════════════
# Key Takeaway + Wrong vs Right — reusable patterns included with TEXT_DIAGRAM
# ═══════════════════════════════════════════════════════════════════════════

KEY_TAKEAWAY_PATTERN = (
    "**KEY TAKEAWAY CARD (USE AT END OF EACH CONCEPT)**:\n"
    "```html\n"
    "<div class='key-takeaway'>\n"
    "  <div class='takeaway-icon'>💡</div>\n"
    "  <div class='takeaway-content'>\n"
    "    <span class='takeaway-label'>Key Takeaway</span>\n"
    "    <p class='takeaway-text'>Photosynthesis converts sunlight into food for plants.</p>\n"
    "  </div>\n"
    "</div>\n"
    "```\n\n"
)

WRONG_RIGHT_PATTERN = (
    "**WRONG VS RIGHT (USE FOR COMMON MISTAKES)**:\n"
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
    "```\n"
    "Animate: show wrong first (`fadeIn('.wrong-box', 0.5, 0)`), then right (`fadeIn('.right-box', 0.5, 1.5)`).\n\n"
)

DIAGRAM_TEMPLATES = (
    "**PRE-BUILT DIAGRAM TEMPLATES (data-attribute auto-render)**:\n"
    "1. **Timeline**: `<div data-diagram='timeline' data-items='[{\"year\":\"1969\",\"label\":\"Moon Landing\"}]'></div>`\n"
    "2. **Comparison**: `<div data-diagram='comparison' data-left='{\"title\":\"Pros\",\"items\":[\"Fast\"]}' data-right='{\"title\":\"Cons\",\"items\":[\"Limited\"]}'></div>`\n"
    "3. **Cycle**: `<div data-diagram='cycle' data-items='[\"Evaporation\",\"Condensation\",\"Precipitation\"]'></div>`\n"
    "4. **Hierarchy**: `<div data-diagram='hierarchy' data-root='{\"label\":\"Kingdom\",\"children\":[{\"label\":\"Phylum\"}]}'></div>`\n"
    "5. **Venn**: `<div data-diagram='venn' data-sets='[{\"label\":\"Plants\"},{\"label\":\"Animals\"}]' data-overlap='[\"Eukaryotic\"]'></div>`\n"
    "6. **Data Chart**: `<div data-diagram='data-chart' data-type='bar' data-values='[{\"label\":\"Q1\",\"value\":42}]'></div>`\n"
    "Use these instead of Mermaid for simple structured diagrams.\n\n"
)


# ═══════════════════════════════════════════════════════════════════════════
# Domain → shot type mapping
# ═══════════════════════════════════════════════════════════════════════════

# Maps subject domains to the shot types they should have access to.
# TEXT_DIAGRAM is always included. Order matters — first listed = most preferred.
DOMAIN_SHOT_TYPES: Dict[str, List[str]] = {
    # Education domains
    "coding": ["TEXT_DIAGRAM", "PROCESS_STEPS", "DATA_STORY", "IMAGE_SPLIT"],
    "history": ["IMAGE_HERO", "VIDEO_HERO", "IMAGE_SPLIT", "ANIMATED_ASSET", "TEXT_DIAGRAM", "LOWER_THIRD"],
    "science": ["IMAGE_SPLIT", "ANIMATED_ASSET", "TEXT_DIAGRAM", "ANNOTATION_MAP", "PROCESS_STEPS", "VIDEO_HERO"],
    "biology": ["ANNOTATION_MAP", "ANIMATED_ASSET", "IMAGE_SPLIT", "PROCESS_STEPS", "TEXT_DIAGRAM", "VIDEO_HERO"],
    "chemistry": ["ANIMATED_ASSET", "EQUATION_BUILD", "PROCESS_STEPS", "TEXT_DIAGRAM", "IMAGE_SPLIT"],
    "geography": ["VIDEO_HERO", "IMAGE_HERO", "ANNOTATION_MAP", "IMAGE_SPLIT", "TEXT_DIAGRAM", "DATA_STORY"],
    "math": ["TEXT_DIAGRAM", "EQUATION_BUILD", "PROCESS_STEPS"],
    "language": ["TEXT_DIAGRAM", "IMAGE_HERO", "LOWER_THIRD", "IMAGE_SPLIT"],
    # Marketing / business domains
    "saas_marketing": ["VIDEO_HERO", "IMAGE_HERO", "TEXT_DIAGRAM", "DATA_STORY", "IMAGE_SPLIT"],
    "business_marketing": ["VIDEO_HERO", "IMAGE_HERO", "TEXT_DIAGRAM", "DATA_STORY", "IMAGE_SPLIT"],
    "saas_demo": ["IMAGE_SPLIT", "PROCESS_STEPS", "TEXT_DIAGRAM", "ANNOTATION_MAP", "IMAGE_HERO"],
    # Creative domains
    "visual_storytelling": ["VIDEO_HERO", "IMAGE_HERO", "IMAGE_SPLIT", "ANIMATED_ASSET", "LOWER_THIRD"],
    # Illustrated SVG mode — pure SVG, no photos
    "illustrated_svg": ["KINETIC_TITLE", "INFOGRAPHIC_SVG", "KINETIC_TEXT"],
    # Product showcase — subject-centric brand reel
    "product_showcase": ["PRODUCT_HERO", "KINETIC_TITLE", "DATA_STORY", "LOWER_THIRD"],
    # Default
    "general": ["IMAGE_HERO", "VIDEO_HERO", "TEXT_DIAGRAM", "IMAGE_SPLIT", "ANIMATED_ASSET", "PROCESS_STEPS", "LOWER_THIRD"],
    # Input video modes — SOURCE_CLIP is the primary shot type
    "input_video_podcast": ["SOURCE_CLIP", "KINETIC_TITLE", "TEXT_DIAGRAM", "DATA_STORY", "LOWER_THIRD"],
    "input_video_demo": ["SOURCE_CLIP", "KINETIC_TITLE", "TEXT_DIAGRAM", "PROCESS_STEPS", "ANNOTATION_MAP", "LOWER_THIRD"],
}


def get_cards_for_domain(subject_domain: str) -> List[str]:
    """Return shot type IDs relevant to a subject domain.

    Always includes TEXT_DIAGRAM as the baseline. For domains not explicitly
    mapped, returns the 'general' set.
    """
    types = DOMAIN_SHOT_TYPES.get(subject_domain, DOMAIN_SHOT_TYPES["general"])
    # Ensure TEXT_DIAGRAM is always present
    if "TEXT_DIAGRAM" not in types:
        types = ["TEXT_DIAGRAM"] + types
    return types


def _format_card(card: Dict[str, Any]) -> str:
    """Format a single shot type card as prompt text."""
    lines = [
        f"**SHOT TYPE: {card['id']}** — {card['description']}",
        f"USE FOR: {card['use_for']}",
        "```html",
        card["html_template"].rstrip(),
        "```",
    ]
    if card.get("script_block"):
        lines.append("```javascript")
        lines.append(card["script_block"].rstrip())
        lines.append("```")
    if card.get("guidelines"):
        lines.append("Guidelines:")
        for g in card["guidelines"]:
            lines.append(f"- {g}")
    lines.append("")  # blank line separator
    return "\n".join(lines)


def build_filtered_system_prompt(
    subject_domain: str,
    width: int = 1920,
    height: int = 1080,
) -> str:
    """Build a system prompt containing only the shot types relevant to a subject domain.

    This replaces the monolithic HTML_GENERATION_SYSTEM_PROMPT_ADVANCED with a
    focused prompt that is 38-67% smaller depending on the domain.
    """
    aspect_label = "9:16 portrait" if width < height else "16:9"
    is_portrait = width < height

    # 1. Core preamble (always included)
    parts = [CORE_PREAMBLE]

    # 2. Shot type cards (domain-filtered)
    card_ids = get_cards_for_domain(subject_domain)
    parts.append(
        "**CINEMATIC SHOT TYPES (use these for high-quality videos)**:\n"
        "MIX these with text-based shots for visual variety.\n\n"
    )
    for cid in card_ids:
        card = SHOT_TYPE_CARDS.get(cid)
        if card:
            formatted = _format_card(card)
            # Replace dimension placeholders
            formatted = (
                formatted
                .replace("{canvas_width}", str(width))
                .replace("{canvas_height}", str(height))
                .replace("{aspect_label}", aspect_label)
            )
            parts.append(formatted)

    # 3. Image prompt guidelines (if any image-capable cards are included)
    has_image_cards = any(
        SHOT_TYPE_CARDS.get(cid, {}).get("requires_image") or
        SHOT_TYPE_CARDS.get(cid, {}).get("requires_video")
        for cid in card_ids
    )
    if has_image_cards:
        parts.append(
            IMAGE_PROMPT_GUIDELINES
            .replace("{aspect_label}", aspect_label)
        )

    # 4. Animation tools (always included)
    parts.append(ANIMATION_TOOLS)

    # 5. Educational principles (always included)
    parts.append(EDUCATIONAL_PRINCIPLES)

    # 6. Key Takeaway + Wrong vs Right patterns (if TEXT_DIAGRAM is included)
    if "TEXT_DIAGRAM" in card_ids:
        parts.append(KEY_TAKEAWAY_PATTERN)
        parts.append(WRONG_RIGHT_PATTERN)
        parts.append(DIAGRAM_TEMPLATES)

    # 7. DO NOT rules
    parts.append(DO_NOT_RULES)

    # 8. Layout rules
    parts.append(
        "**LAYOUT RULES**:\n"
        "- For text/diagram shots: WRAP content in `<div class='full-screen-center'>...</div>`\n"
        "- Use `.layout-split` for: Text on left, Visual on right\n"
        "- Use `.layout-hero` for: Single big concept in center\n"
        "- Use `.image-hero` for: Full-screen cinematic image with text overlay\n"
        "- Use `.image-split-layout` for: Image on one side, text on the other\n"
        "- Keep backgrounds clean — solid color from palette (except IMAGE_HERO which uses image)\n\n"
    )

    # 9. Portrait mode rules
    if is_portrait:
        parts.append(
            "**PORTRAIT MODE (9:16) LAYOUT RULES**:\n"
            "- Stack ALL content vertically — never side-by-side.\n"
            "- Use `grid-template-columns: 1fr` (single column) instead of `1fr 1fr`.\n"
            "- Image-split layouts: stack TOP/BOTTOM with `grid-template-rows: 1fr 1fr`.\n"
            "- Use larger font sizes — viewers are on mobile.\n\n"
        )

    # 10. Output JSON format
    parts.append(
        "Output JSON with 2-4 'shots' per segment. Each shot: one concept, clean visual, annotations for key terms.\n\n"
    )

    return "\n".join(parts)


def build_per_shot_system_prompt(
    shot_type: str,
    width: int = 1920,
    height: int = 1080,
) -> str:
    """Build a system prompt with only ONE shot type card.

    Used by Phase 2+3 (Director → per-shot HTML generation).
    Even smaller than build_filtered_system_prompt — includes only the single
    card needed plus shared tools and principles.
    """
    aspect_label = "9:16 portrait" if width < height else "16:9"

    card = SHOT_TYPE_CARDS.get(shot_type)
    if not card:
        # Fallback to TEXT_DIAGRAM if unknown type
        card = SHOT_TYPE_CARDS["TEXT_DIAGRAM"]

    parts = [
        CORE_PREAMBLE,
        _format_card(card)
            .replace("{canvas_width}", str(width))
            .replace("{canvas_height}", str(height))
            .replace("{aspect_label}", aspect_label),
    ]

    if card.get("requires_image") or card.get("requires_video"):
        parts.append(
            IMAGE_PROMPT_GUIDELINES.replace("{aspect_label}", aspect_label)
        )

    parts.append(ANIMATION_TOOLS)
    parts.append(EDUCATIONAL_PRINCIPLES)
    parts.append(DO_NOT_RULES)

    return "\n".join(parts)
