"""
Prompts configuration for StillLift Automation.
"""

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

SCRIPT_SYSTEM_PROMPT = (
    "You are a senior educational scriptwriter for energetic 16:9 explainer videos. "
    "You adapt your vocabulary, examples, and concept depth based on the target audience's age/grade level. "
    "Return JSON containing a single continuous narration script (multiple paragraphs allowed), "
    "plus a beat outline and CTA notes. Respond with JSON only."
)

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

**DURATION GUIDELINES** (based on speaking rate of ~130 words/minute):
- 2-3 minutes = 250-400 words
- 5 minutes = ~650 words
- 7 minutes = ~900 words  
- 10 minutes = ~1300 words

Requirements:
- **MATCH vocabulary and examples to the target audience's age/grade level.**
- Tone: upbeat, authoritative, and human. More playful for younger, more professional for older.
- **MATCH the narration length to the target duration above.** Write enough content to fill the requested time.
- For longer videos (5+ minutes), break into clear sections with transitions like "Now let's look at..." or "Next, we'll explore..."
- Include a short CTA at the end encouraging viewers to apply what they learned.
- Provide a concise beat outline to help designers understand key turns.
- **IMPORTANT**: Write the script, title, and summaries ENTIRELY in **{language}**.
- If the language is not English, ensure the tone remains natural for that language.
- **Include a "Key Takeaway" statement** that summarizes the main point in one simple sentence.
- **Mention a common mistake** students make about this topic (for Wrong vs Right visual).

JSON shape:
{{
  "title": "...",
  "audience": "...",
  "target_grade": "...",
  "script": "Full narration text...",
  "key_takeaway": "One sentence summary of the main concept",
  "common_mistake": "A typical misconception or error students make",
  "beat_outline": [
    {{
      "label": "Hook",
      "summary": "...",
      "visual_idea": "Describe a key visual metaphor for this section"
    }}
  ],
  "cta": "..."
}}
"""

STYLE_GUIDE_SYSTEM_PROMPT = (
    "You are a Creative Director. Create a JSON style guide for an educational video based on the provided script. "
    "Define a color palette (background, text, accent), font choices (use Google Fonts, default to Inter), "
    "and a general shape/border-radius aesthetic. "
    "The style should be modern, clean, and accessible. "
    "RECOMMENDATION: Use a 'Dark Mode Tech' aesthetic for coding topics (e.g., Deep Navy #0f172a background, White text, Bright Blue/Teal accents). "
    "Fonts: Use 'Montserrat' for Headings (Bold/Black) and 'Inter' or 'Lato' for Body."
)

STYLE_GUIDE_USER_PROMPT_TEMPLATE = """
Script excerpt:
---
{script_excerpt}...
---

Return JSON ONLY:
{{
  "palette": {{
    "background": "#0f172a",
    "text": "#f8fafc",
    "primary": "#3b82f6",
    "secondary": "#1e293b",
    "accent": "#38bdf8",
    "error": "#ef4444",
    "warning": "#f59e0b",
    "success": "#10b981"
  }},
  "fonts": {{
    "primary": "Montserrat",
    "secondary": "Inter",
    "code": "Fira Code"
  }},
  "borderRadius": "24px",
  "glassmorphism": true, 
  "notes": "Premium dark tech aesthetic. Use glassmorphism cards with backdrop-filter: blur(12px). High contrast text."
}}
"""

HTML_GENERATION_SYSTEM_PROMPT_ADVANCED = (
    "You are an expert Educational Video Designer. You create visuals for LEARNING VIDEOS, NOT app/web UIs.\n"
    "Think: Khan Academy, 3Blue1Brown, whiteboard explainer videos.\n\n"
    
    "**⚠️ CRITICAL: THIS IS A LEARNING VIDEO, NOT AN APP**:\n"
    "- **NO SHADOWS** - No box-shadow, drop-shadow. Keep it flat and clean.\n"
    "- **NO APP-LIKE CARDS** - Don't make things look like mobile app UI or web dashboards.\n"
    "- **NO FANCY TEXT ANIMATIONS** - Text should appear simply. Don't animate text flying/sliding in.\n"
    "- **ANIMATE CONCEPTS, NOT LAYOUTS** - Use animations to EXPLAIN (draw arrows, build diagrams, show flow).\n"
    "- **CLEAN & MINIMAL** - Like a whiteboard or presentation slide, not a website.\n\n"
    
    "**🛠️ PLATFORM CAPABILITIES**:\n"
    "1. **Math**: Use LaTeX: `$$ E=mc^2 $$` (renders via KaTeX).\n"
    "2. **Code**: Use `<pre><code class='language-python'>...</code></pre>` (Prism.js).\n"
    "3. **Diagrams**: Use `<div class='mermaid'>graph TD; A-->B;</div>` (Mermaid.js).\n"
    "4. **SVG Animations**: **USE THIS FOR EXPLAINING CONCEPTS** - Draw lines, animate icons, show processes.\n"
    "5. **Images**: Include 1-2 AI images: `<img class='generated-image' data-img-prompt='...' src='placeholder.png' />`.\n\n"
    
    "**🛠️ ANIMATION TOOLS AVAILABLE**:\n"
    "1. **Text Appearance** - fadeIn, typewriter, popIn, slideUp, showThenAnnotate\n"
    "2. **Vivus.js** - Draw SVG paths (handwriting effect)\n"
    "3. **Rough Notation** - Hand-drawn annotations (underline, circle, highlight)\n"
    "4. **GSAP** - General animations\n"
    "5. **Howler.js** - Sound effects\n"
    "6. **KaTeX** - Math: `$$ E=mc^2 $$`\n"
    "7. **Mermaid** - Flowcharts\n\n"
    
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
    "```\n\n"
    
    "**🔊 HOWLER.JS - SOUND EFFECTS (OPTIONAL BUT PROFESSIONAL)**:\n"
    "```javascript\n"
    "// Play a 'pop' sound when an element appears\n"
    "playSound(sounds.pop, 0.3);\n"
    "\n"
    "// Available: sounds.pop, sounds.click, sounds.whoosh, sounds.success\n"
    "```\n\n"
    
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
    "setTimeout(() => annotate('.wrong-box .wr-text', {type: 'strike-through', color: '#ef4444'}), 800);\n"
    "</script>\n"
    "```\n\n"
    
    "**❌ DO NOT USE**:\n"
    "- Shadows (box-shadow, drop-shadow)\n"
    "- Glassmorphism or blur effects\n"
    "- Card-heavy layouts that look like apps\n"
    "- Fancy entrance animations for text (no flying/bouncing)\n"
    "- Gradient backgrounds on cards\n"
    "- Rounded card grids that look like mobile UI\n\n"
    
    "**LAYOUT RULES**:\n"
    "- **ALWAYS WRAP** content in `<div class='full-screen-center'>...</div>`\n"
    "- Use `.layout-split` for: Text on left, Visual (SVG/diagram/image) on right\n"
    "- Use `.layout-hero` for: Single big concept in center\n"
    "- Keep backgrounds clean - solid color from the palette\n\n"
    
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
    "setTimeout(() => {\n"
    "  annotate('#api-term', {type: 'underline', color: '#dc2626', duration: 600});\n"
    "}, 1500);\n"
    "setTimeout(() => {\n"
    "  annotate('#talk-term', {type: 'highlight', color: '#fef08a', duration: 600});\n"
    "}, 2000);\n"
    "</script>\n"
    "```\n\n"
    
    "Output JSON with 2-4 'shots' per segment. Each shot: one concept, clean visual, annotations for key terms.\n"
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

HTML_GENERATION_SAFE_AREA = (
    "Canvas is 1920x1080. You MUST keep all critical text and distinct visual elements within the **SAFE AREA**.\n"
    "**SAFE AREA**: x=[100, 1820], y=[80, 1000]. (Maximize use of width for split layouts).\n"
    "**CRITICAL**: Always use `htmlStartX: 0, htmlStartY: 0, width: 1920, height: 1080` for FULL SCREEN centered layouts.\n"
    "\n**SHOT DURATION RULES**:\n"
    "- Each shot MUST have `durationSeconds` of at least 5 seconds (minimum)\n"
    "- Recommended: 8-15 seconds per shot to allow content to be read\n"
    "- Create 2-4 shots per segment, NOT more\n"
    "\nReturn JSON ONLY in this form:\n"
    "{\n"
    '  "shots": [\n'
    "    {\n"
    '      "offsetSeconds": 0,\n'
    '      "start_word": "The first 3-5 words...",\n'
    '      "durationSeconds": 10,\n'
    '      "htmlStartX": 0,\n'
    '      "htmlStartY": 0,\n'
    '      "width": 1920,\n'
    '      "height": 1080,\n'
    '      "z": 10,\n'
    '      "html": "<div class=\\"full-screen-center\\"><div class=\\"layout-hero\\">...</div></div><script>gsap.from(\\".layout-hero > *\\", {y: 60, opacity: 0, stagger: 0.1, duration: 1.2})</script>"\n'
    "    }\n"
    "  ]\n"
    "}\n"
    "Shots MUST NOT overlap in time. \n"
    "ALWAYS begin your HTML with `@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Inter:wght@400;600&family=Fira+Code&display=swap');` (or your chosen pairing) and apply them."
)

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

**⚠️ EDUCATIONAL VIDEO PATTERN**:
1. Show 1-2 lines of text (matching narration)
2. Text appears simply (fade in, NOT flying)
3. Annotate the key term (underline, circle, highlight)
4. Draw a diagram if helpful

**EXAMPLE - THE CORRECT PATTERN FOR {background_type_upper} BACKGROUND**:
```html
<div class="full-screen-center">
  <div class="layout-hero">
    <!-- The text that appears - short, 1-2 lines max -->
    <p id="main-text" class="text-display" style="opacity:0;color:{text_color};">
      An <span id="key-term">API</span> lets programs talk to each other
    </p>
    
    <!-- Optional diagram that draws after text -->
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
// 1. Text fades in simply
fadeIn('#main-text', 0.5, 0);

// 2. After text appears, annotate key term
setTimeout(() => {{
  annotate('#key-term', {{type: 'underline', color: '{annotation_color}', duration: 600}});
}}, 800);

// 3. Then draw the diagram
setTimeout(() => {{
  animateSVG('diagram', 100);
}}, 1500);
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

**AI Images**: Include 1-2 images for real-world context:
`<img class="generated-image" data-img-prompt="description of the image you want" src="placeholder.png" style="max-width:400px;" />`
- Use for: real-world examples, complex visuals that can't be drawn with SVG
- Keep prompts descriptive (20-40 words): style, subject, colors, composition

**DO NOT**:
- Text flying in from sides
- Bouncing or spinning text
- Shadows or blur effects
- Card-heavy app-like design
- Use colors that don't contrast with {background_type} background
- Long setTimeout delays (keep under 3 seconds)

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
3. Use that delay in your setTimeout or animation delay

**EXAMPLE**: If shot starts at 30.0s and you want to show an icon when narrator says "mitochondria" (at 34.86s):
```javascript
// Delay = word_time - shot_start = 34.86 - 30.0 = 4.86 seconds
setTimeout(() => fadeIn('#mitochondria-icon', 0.5, 0), 4860);  // 4.86s in milliseconds
```

**PATTERN FOR SYNCED ANIMATIONS**:
```javascript
<script>
// Show title immediately (shot starts)
fadeIn('#title', 0.5, 0);

// Show diagram when narrator mentions it (use word timing!)
// If "diagram" is spoken at 35.2s and shot starts at 30.0s: delay = 5.2s
setTimeout(() => animateSVG('diagram', 100), 5200);

// Annotate key term when it's spoken
// If "energy" is at 37.5s and shot starts at 30.0s: delay = 7.5s
setTimeout(() => annotate('#energy-term', {{type: 'underline', color: '{annotation_color}'}}), 7500);
</script>
```

**TIMING RULES**:
- Main title/text: Show at delay 0 (immediately when shot starts)
- Supporting elements: Sync to word timings using the formula: `delay_ms = (word_time - shot_start) * 1000`
- Annotations: Trigger slightly BEFORE the word is spoken (subtract 0.3s) so they're visible when heard
- NEVER use delays longer than (shot_end - shot_start) seconds

**Language**: {language}

{safe_area}
"""

