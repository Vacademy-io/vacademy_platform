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
    "Think: Khan Academy, 3Blue1Brown, whiteboard explainer videos.\n\n"

    "**CRITICAL: THIS IS A LEARNING VIDEO, NOT AN APP**:\n"
    "- **NO drop-shadows / box-shadows** on UI elements. Keep it flat and clean.\n"
    "- **Gradient scrims ARE allowed** only as legibility overlays on IMAGE_HERO / IMAGE_SPLIT shots.\n"
    "- **NO APP-LIKE CARDS** - Don't make things look like mobile app UI or web dashboards.\n"
    "- **NO FANCY TEXT ANIMATIONS** - Text should appear simply (fadeIn/popIn). No flying/bouncing/spinning.\n"
    "- **ANIMATE CONCEPTS, NOT LAYOUTS** - Use animations to EXPLAIN (draw arrows, build diagrams, show flow).\n"
    "- **CLEAN & MINIMAL** - Like a whiteboard or documentary, not a website.\n\n"

    "**PLATFORM CAPABILITIES**:\n"
    "1. **Math**: Use LaTeX: `$$ E=mc^2 $$` (renders via KaTeX).\n"
    "2. **Code**: Use `<pre><code class='language-python'>...</code></pre>` (Prism.js).\n"
    "3. **Diagrams**: Use `<div class='mermaid'>graph TD; A-->B;</div>` (Mermaid.js).\n"
    "4. **SVG Animations**: **USE THIS FOR EXPLAINING CONCEPTS** - Draw lines, animate icons, show processes.\n"
    "5. **Images**: Use stock photos (preferred) or AI generation:\n"
    "   `<img class='generated-image' data-img-prompt='description' data-img-source='stock' src='placeholder.png' />`\n"
    "   - `data-img-source='stock'` **(PREFERRED)**: Real-world stock photography (Pexels).\n"
    "   - `data-img-source='generate'`: AI-generated image. Use ONLY for: cutout objects, fictional scenes, stylized art.\n"
    "   - DEFAULT TO STOCK. Only use 'generate' when stock photography cannot provide what you need.\n"
    "6. **Icons**: Use Iconify: `<iconify-icon icon='mdi:atom' width='48'></iconify-icon>`. "
    "Sets: `mdi:`, `lucide:`, `tabler:`, `noto:`, `fluent-emoji:`.\n"
    "7. **SVG Maps**: For geography/history, embed maps: "
    "`<img src='https://vacademy-media.s3.ap-south-1.amazonaws.com/assets/maps/us.svg' class='map-svg' .../>`. "
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
    "9. **splitReveal** - Cinematic text entrance: `splitReveal('#title', {type:'chars', stagger:0.03});`\n\n"

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
    "- Rounded card grids that look like mobile UI\n\n"
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
        "description": "Animated bar/line chart that builds during narration.",
        "use_for": "Historical population data, scientific measurements, statistics with real numbers.",
        "requires_image": False,
        "requires_video": False,
        "preferred_domains": ["science", "history", "general"],
        "html_template": (
            "<div class='full-screen-center'>\n"
            "  <div class='layout-hero'>\n"
            "    <h2 id='chart-title' style='opacity:0'>Population Growth Over Time</h2>\n"
            "    <svg id='d3-chart' width='1400' height='480' style='margin-top:24px; overflow:visible;'></svg>\n"
            "  </div>\n"
            "</div>\n"
        ),
        "script_block": (
            "fadeIn('#chart-title', 0.5, 0);\n"
            "const data = [{label:'1800',value:1},{label:'1900',value:1.6},{label:'1950',value:2.5},{label:'2000',value:6.1}];\n"
            "const svgEl = d3.select('#d3-chart');\n"
            "const m = {top:20,right:30,bottom:50,left:70};\n"
            "const W = 1400-m.left-m.right, H = 480-m.top-m.bottom;\n"
            "const g = svgEl.append('g').attr('transform',`translate(${m.left},${m.top})`);\n"
            "const x = d3.scaleBand().domain(data.map(d=>d.label)).range([0,W]).padding(0.35);\n"
            "const y = d3.scaleLinear().domain([0,d3.max(data,d=>d.value)*1.15]).range([H,0]);\n"
            "g.append('g').attr('transform',`translate(0,${H})`).call(d3.axisBottom(x));\n"
            "g.append('g').call(d3.axisLeft(y).ticks(5));\n"
            "g.selectAll('.bar').data(data).enter().append('rect')\n"
            "  .attr('x',d=>x(d.label)).attr('width',x.bandwidth())\n"
            "  .attr('y',H).attr('height',0).attr('rx',6)\n"
            "  .style('fill','var(--primary-color)')\n"
            "  .transition().delay((_,i)=>600+i*450).duration(900).ease(d3.easeCubicOut)\n"
            "  .attr('y',d=>y(d.value)).attr('height',d=>H-y(d.value));\n"
        ),
        "guidelines": [
            "Only use when narration explicitly mentions numbers/data worth visualizing",
            "Bars build with staggered animation (delay per bar)",
            "Use `var(--primary-color)` for bar fills, `currentColor` for axis text/lines",
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
    # Default
    "general": ["IMAGE_HERO", "VIDEO_HERO", "TEXT_DIAGRAM", "IMAGE_SPLIT", "ANIMATED_ASSET", "PROCESS_STEPS", "LOWER_THIRD"],
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
