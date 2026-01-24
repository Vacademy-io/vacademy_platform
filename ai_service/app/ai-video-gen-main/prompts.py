"""
Prompts configuration for StillLift Automation.
"""

# Background type presets for consistent theming
BACKGROUND_PRESETS = {
    "black": {
        "background": "#000000",
        "text": "#ffffff",
        "primary": "#3b82f6",
        "secondary": "#1e293b",
        "accent": "#38bdf8",
        "card_bg": "rgba(30, 41, 59, 0.8)",
        "card_border": "rgba(255, 255, 255, 0.1)",
        "mermaid_theme": "dark",
        "code_theme": "okaidia",
    },
    "white": {
        "background": "#ffffff",
        "text": "#1e293b",
        "primary": "#2563eb",
        "secondary": "#f1f5f9",
        "accent": "#0ea5e9",
        "card_bg": "rgba(241, 245, 249, 0.9)",
        "card_border": "rgba(0, 0, 0, 0.1)",
        "mermaid_theme": "default",
        "code_theme": "solarizedlight",
    },
}

SCRIPT_SYSTEM_PROMPT = (
    "You are a senior educational scriptwriter for energetic 16:9 explainer videos. "
    "Return JSON containing a single continuous narration script (multiple paragraphs allowed), "
    "plus a beat outline and CTA notes. Respond with JSON only."
)

SCRIPT_USER_PROMPT_TEMPLATE = """
Base idea from the user:
---
{base_prompt}
---

Requirements:
- Audience: curious beginners.
- Tone: upbeat, authoritative, and human.
- Keep the narration ~2-3 minutes long (~250-350 words total). MAXIMUM 3 minutes.
- Include a short CTA at the end encouraging viewers to apply what they learned.
- Provide a concise beat outline to help designers understand key turns.
- **IMPORTANT**: Write the script, title, and summaries ENTIRELY in **{language}**.
- If the language is not English, ensure the tone remains natural for that language.

JSON shape:
{{
  "title": "...",
  "audience": "...",
  "script": "Full narration text...",
  "beat_outline": [
    {{
      "label": "Hook",
      "summary": "...",
      "visual_idea": "Describe a key visual metaphor for this section (e.g. 'A crumbling ancient pillar representing legacy code')"
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
    
    "**PLATFORM CAPABILITIES**:\n"
    "1. **Math**: Use LaTeX: `$$ E=mc^2 $$` (renders via KaTeX).\n"
    "2. **Code**: Use `<pre><code class='language-python'>...</code></pre>` (Prism.js).\n"
    "3. **Diagrams**: Use `<div class='mermaid'>graph TD; A-->B;</div>` (Mermaid.js).\n"
    "4. **SVG Animations**: **USE THIS FOR EXPLAINING CONCEPTS** - Draw lines, animate icons, show processes.\n"
    "5. **Images**: Include 1-2 AI images: `<img class='generated-image' data-img-prompt='...' src='placeholder.png' />`.\n\n"
    
    "**🎬 ANIMATION RULES (CRITICAL)**:\n"
    "- **DO animate**: SVG paths being drawn, arrows pointing, icons appearing, diagram connections forming.\n"
    "- **DON'T animate**: Text sliding in, cards bouncing, layouts moving around.\n"
    "- **Good example**: Draw an arrow from A to B while explaining the relationship.\n"
    "  ```javascript\n"
    "  // Draw an SVG arrow to show flow\n"
    "  gsap.from('#arrow-path', {strokeDashoffset: 500, strokeDasharray: 500, duration: 1.5});\n"
    "  ```\n"
    "- **Bad example**: Text flying in from the left with bounce effect.\n\n"
    
    "**🎓 EDUCATIONAL DESIGN PRINCIPLES**:\n"
    "1. **ONE CONCEPT AT A TIME**: Each shot = one idea. No clutter.\n"
    "2. **VISUAL EXPLANATION**: Use diagrams, flowcharts, SVG animations to SHOW the concept.\n"
    "3. **SIMPLE TEXT**: Large, readable text. Key term + brief explanation. That's it.\n"
    "4. **SIGNALING**: Use arrows, circles, highlights to direct attention.\n"
    "5. **BUILD-UP**: Show a diagram being built piece by piece, not all at once.\n\n"
    
    "**🎯 VISUAL ELEMENTS TO USE**:\n"
    "- **Inline SVG diagrams** with animated paths (flowcharts, arrows, icons)\n"
    "- **Simple text labels** with `.text-display` or `.text-body` classes\n"
    "- **Key terms** highlighted with `.key-term` class\n"
    "- **Mermaid diagrams** for flowcharts and processes\n"
    "- **AI-generated images** for real-world context\n"
    "- **Simple dividers/lines** to separate concepts\n\n"
    
    "**❌ DO NOT USE**:\n"
    "- Shadows (box-shadow, drop-shadow)\n"
    "- Glassmorphism or blur effects\n"
    "- Card-heavy layouts that look like apps\n"
    "- Fancy entrance animations for text\n"
    "- Gradient backgrounds on cards\n"
    "- Rounded card grids that look like mobile UI\n\n"
    
    "**LAYOUT RULES**:\n"
    "- **ALWAYS WRAP** content in `<div class='full-screen-center'>...</div>`\n"
    "- Use `.layout-split` for: Text on left, Visual (SVG/diagram/image) on right\n"
    "- Use `.layout-hero` for: Single big concept in center\n"
    "- Keep backgrounds clean - solid color from the palette\n\n"
    
    "**COLOR RULES**:\n"
    "- Use `var(--text-color)` for ALL text.\n"
    "- Use `var(--primary-color)` for accents, arrows, highlights.\n"
    "- Use `var(--accent-color)` for key terms.\n"
    "- Keep backgrounds solid, no gradients.\n\n"
    
    "**SVG ANIMATION EXAMPLES**:\n"
    "```html\n"
    "<svg viewBox='0 0 400 200' style='width:100%;height:auto;'>\n"
    "  <path id='arrow1' d='M50,100 L350,100' stroke='var(--primary-color)' stroke-width='3' fill='none'/>\n"
    "  <polygon id='arrowhead' points='340,90 360,100 340,110' fill='var(--primary-color)'/>\n"
    "</svg>\n"
    "<script>\n"
    "gsap.from('#arrow1', {strokeDashoffset: 300, strokeDasharray: 300, duration: 1});\n"
    "gsap.from('#arrowhead', {opacity: 0, x: -20, duration: 0.3, delay: 0.8});\n"
    "</script>\n"
    "```\n\n"
    
    "Output JSON with 2-4 'shots' per segment. Each shot: one concept, clean visual, educational focus.\n"
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
    "Return JSON ONLY in this form:\n"
    "{\n"
    '  "shots": [\n'
    "    {\n"
    '      "offsetSeconds": 0,\n'
    '      "start_word": "The first 3-5 words...",\n'
    '      "durationSeconds": 12,\n'
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

{style_context}
{beat_context}

**⚠️ REMINDER: EDUCATIONAL VIDEO, NOT APP UI**:
- NO shadows, NO glassmorphism, NO card-heavy design
- Animate CONCEPTS (SVG diagrams, arrows) NOT text/layouts
- Clean, minimal, like a whiteboard or Khan Academy

**MANDATORY STRUCTURE**:
```html
<div class="full-screen-center">
  <div class="layout-split">
    <div><!-- Text/explanation --></div>
    <div class="svg-diagram"><!-- SVG visual that explains the concept --></div>
  </div>
</div>
```

**🎬 WHAT TO CREATE FOR THIS SEGMENT**:
1. **IDENTIFY THE CONCEPT**: What is being explained in the narration?
2. **CREATE A VISUAL**: Draw an SVG diagram, flowchart, or icon that SHOWS the concept.
3. **ANIMATE THE VISUAL**: Use GSAP to draw lines, reveal parts, show flow.
4. **ADD SIMPLE TEXT**: Key term + brief label. That's it.

**SVG ANIMATION EXAMPLE** (use this pattern):
```html
<svg viewBox="0 0 400 200" class="svg-diagram">
  <text x="50" y="40" fill="var(--text-color)" font-size="24">Input</text>
  <path id="flow-arrow" d="M100,50 L300,50" stroke="var(--primary-color)" stroke-width="3" fill="none"/>
  <polygon id="arrow-head" points="290,40 310,50 290,60" fill="var(--primary-color)"/>
  <text x="320" y="40" fill="var(--text-color)" font-size="24">Output</text>
</svg>
<script>
gsap.from('#flow-arrow', {{strokeDashoffset: 200, strokeDasharray: 200, duration: 1}});
gsap.from('#arrow-head', {{opacity: 0, x: -10, duration: 0.3, delay: 0.8}});
</script>
```

**VISUAL COMPONENTS**:
- `<span class="key-term">Term</span>` - Highlight vocabulary
- `<div class="step-item"><span class="step-number">1</span><div class="step-content">...</div></div>` - Process steps
- `<div class="comparison"><div class="side before">...</div><div class="side after">...</div></div>` - Compare
- `<ul class="simple-list"><li>Point 1</li></ul>` - Simple bullet points
- `<div class="svg-diagram">...</div>` - Container for SVG diagrams

**DO NOT**:
- Add shadows or blur effects
- Create app-like card grids
- Animate text flying/sliding in
- Use gradients on backgrounds

**AI Images**: Include 1-2 images for real-world context:
`<img class="generated-image" data-img-prompt="description" src="placeholder.png" style="max-width:400px;" />`

**Language**: {language}

{safe_area}
"""
