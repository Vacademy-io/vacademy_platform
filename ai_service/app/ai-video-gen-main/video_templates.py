"""
Pre-designed video templates for AI-generated slide generation.

Each template defines:
- preview_html:    Full 1920×1080 HTML page rendered in the UI gallery iframe
- palette_override: Partial palette dict merged on top of BACKGROUND_PRESETS
- style_injection:  CSS rules + mini HTML example injected into the LLM prompt

Priority chain during video generation:
  BACKGROUND_PRESETS  →  template.palette_override  →  brand primary_color (always wins)
"""
from __future__ import annotations
from typing import Dict, List, Optional, Any


# ---------------------------------------------------------------------------
# Template definitions
# ---------------------------------------------------------------------------

VIDEO_TEMPLATES: List[Dict[str, Any]] = [

    # ── 1. WHITEBOARD ───────────────────────────────────────────────────────
    {
        "id": "whiteboard",
        "name": "Whiteboard",
        "description": "Hand-drawn lesson style — like a teacher sketching on a whiteboard",
        "tags": ["light", "sketch", "educational", "hand-drawn"],
        "background_type": "white",
        "palette_override": {
            "background": "#fefece",
            "text": "#1a1a1a",
            "text_secondary": "#4a4a4a",
            "accent": "#2d2d2d",
            "primary": "#2d2d2d",
            "svg_stroke": "#1a1a1a",
            "svg_fill": "none",
            "annotation_color": "#c0392b",
            "card_bg": "transparent",
            "card_border": "#1a1a1a",
        },
        "preview_html": """<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1920px;height:1080px;overflow:hidden;background:#fefece;font-family:'Caveat',cursive;display:flex;align-items:center;justify-content:center}
.slide{width:1720px;padding:60px}
h1{font-size:88px;color:#1a1a1a;font-weight:700;border-bottom:4px solid #1a1a1a;padding-bottom:16px;margin-bottom:40px}
.row{display:flex;gap:40px}
.card{flex:1;border:3px solid #1a1a1a;padding:40px;background:transparent}
.card:nth-child(1){transform:rotate(-0.6deg)}
.card:nth-child(2){transform:rotate(0.4deg)}
.card:nth-child(3){transform:rotate(-0.3deg)}
h2{font-size:58px;color:#1a1a1a;margin-bottom:16px}
p{font-size:44px;color:#333;line-height:1.5}
.hi{text-decoration:underline wavy #c0392b;color:#c0392b}
.arrow{position:absolute;top:20px;right:20px;font-size:36px}
</style></head><body>
<div class="slide">
  <h1>How Photosynthesis Works</h1>
  <div class="row">
    <div class="card"><h2>☀️ Light Energy</h2><p>Chlorophyll absorbs <span class="hi">sunlight</span> to power the reaction</p></div>
    <div class="card"><h2>💧 Water + CO₂</h2><p>Roots absorb water, leaves take in <span class="hi">carbon dioxide</span></p></div>
    <div class="card"><h2>🌿 Output</h2><p>Plant produces <span class="hi">glucose</span> and releases oxygen</p></div>
  </div>
</div>
</body></html>""",
        "style_injection": """\
**CSS RULES — WHITEBOARD TEMPLATE**:
```css
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&display=swap');
body, .slide { background: #fefece; font-family: 'Caveat', cursive; }
h1, h2, h3 { font-family: 'Caveat', cursive; color: #1a1a1a; font-weight: 700;
              border-bottom: 3px solid #1a1a1a; padding-bottom: 12px; }
p, li       { font-family: 'Caveat', cursive; color: #333; font-size: 48px; }
.card, .box { border: 3px solid #1a1a1a; background: transparent;
              transform: rotate(-0.5deg); padding: 40px; }
svg text    { font-family: 'Caveat', cursive; fill: #1a1a1a; }
svg path, svg line, svg polyline { stroke: #1a1a1a; stroke-width: 3;
              stroke-linecap: round; stroke-linejoin: round; }
.highlight  { color: #c0392b; text-decoration: underline wavy #c0392b; }
```
**HTML STRUCTURE PATTERN**:
```html
<div style="background:#fefece;padding:80px;font-family:'Caveat',cursive;width:100%;height:100%;overflow:hidden">
  <h1 style="font-size:90px;color:#1a1a1a;border-bottom:4px solid #1a1a1a;padding-bottom:16px;margin-bottom:40px">Title</h1>
  <div style="border:3px solid #1a1a1a;padding:40px;transform:rotate(-0.5deg)">
    Content in handwritten style with <span style="color:#c0392b;text-decoration:underline wavy">highlights</span>
  </div>
</div>
```
**DESIGN RULES**: ALL text uses Caveat font. Boxes rotate ±0.5deg (hand-placed feel). NO gradients, NO box-shadows, NO rounded corners. SVG arrows use round caps. Highlights are wavy red underlines.
""",
    },

    # ── 2. CERULEAN ─────────────────────────────────────────────────────────
    {
        "id": "cerulean",
        "name": "Cerulean",
        "description": "Clean minimal with sky-blue accents — modern and professional",
        "tags": ["light", "minimal", "blue", "modern", "clean"],
        "background_type": "white",
        "palette_override": {
            "background": "#ffffff",
            "text": "#0f172a",
            "text_secondary": "#475569",
            "accent": "#0ea5e9",
            "primary": "#0284c7",
            "svg_stroke": "#0284c7",
            "svg_fill": "#e0f2fe",
            "annotation_color": "#0284c7",
            "card_bg": "#f0f9ff",
            "card_border": "#bae6fd",
        },
        "preview_html": """<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1920px;height:1080px;overflow:hidden;background:#ffffff;font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center}
.slide{width:1720px;padding:80px}
.accent-bar{width:80px;height:8px;background:#0ea5e9;border-radius:4px;margin-bottom:32px}
h1{font-size:80px;color:#0f172a;font-weight:700;margin-bottom:16px}
.sub{font-size:44px;color:#475569;margin-bottom:60px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:40px}
.card{background:#f0f9ff;border:2px solid #bae6fd;border-top:6px solid #0ea5e9;border-radius:12px;padding:48px}
h3{font-size:52px;color:#0f172a;font-weight:700;margin-bottom:20px}
p{font-size:38px;color:#475569;line-height:1.6}
.tag{display:inline-block;background:#e0f2fe;color:#0284c7;font-size:32px;padding:6px 20px;border-radius:20px;margin-top:20px}
</style></head><body>
<div class="slide">
  <div class="accent-bar"></div>
  <h1>Machine Learning Fundamentals</h1>
  <div class="sub">The three pillars of modern AI</div>
  <div class="grid">
    <div class="card"><h3>Supervised</h3><p>Learns from labelled examples to predict new outputs</p><div class="tag">Classification</div></div>
    <div class="card"><h3>Unsupervised</h3><p>Finds hidden patterns in unlabelled data</p><div class="tag">Clustering</div></div>
    <div class="card"><h3>Reinforcement</h3><p>Agent learns via reward and penalty feedback</p><div class="tag">Optimization</div></div>
  </div>
</div>
</body></html>""",
        "style_injection": """\
**CSS RULES — CERULEAN TEMPLATE**:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
body, .slide { background: #ffffff; font-family: 'Inter', sans-serif; color: #0f172a; }
h1, h2 { font-weight: 700; color: #0f172a; }
.accent-bar { width: 80px; height: 8px; background: #0ea5e9; border-radius: 4px; margin-bottom: 24px; }
.card { background: #f0f9ff; border: 2px solid #bae6fd; border-top: 6px solid #0ea5e9;
        border-radius: 12px; padding: 48px; }
.tag  { background: #e0f2fe; color: #0284c7; border-radius: 20px; padding: 6px 20px;
        font-size: 32px; display: inline-block; }
svg path, svg line { stroke: #0284c7; }
.highlight { color: #0284c7; font-weight: 600; }
```
**HTML STRUCTURE PATTERN**:
```html
<div style="background:#ffffff;padding:80px;font-family:'Inter',sans-serif;width:100%;height:100%;overflow:hidden">
  <div style="width:80px;height:8px;background:#0ea5e9;border-radius:4px;margin-bottom:24px"></div>
  <h1 style="font-size:80px;color:#0f172a;font-weight:700;margin-bottom:12px">Slide Title</h1>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:40px;margin-top:40px">
    <div style="background:#f0f9ff;border-top:6px solid #0ea5e9;border-radius:12px;padding:40px">Card content</div>
  </div>
</div>
```
**DESIGN RULES**: Clean white background. Accent bar (80×8px sky blue) above every title. Cards have top-border accent stripe. Tags use rounded pill badges. NO decorative illustrations.
""",
    },

    # ── 3. GLAMOUR ──────────────────────────────────────────────────────────
    {
        "id": "glamour",
        "name": "Glamour",
        "description": "Dark elegant with gold accents — luxurious, editorial",
        "tags": ["dark", "gold", "elegant", "serif", "luxury"],
        "background_type": "black",
        "palette_override": {
            "background": "#0d0d0d",
            "text": "#f5f0e8",
            "text_secondary": "#c9b99a",
            "accent": "#d4a843",
            "primary": "#d4a843",
            "svg_stroke": "#d4a843",
            "svg_fill": "rgba(212,168,67,0.15)",
            "annotation_color": "#e8c96d",
            "card_bg": "rgba(212,168,67,0.08)",
            "card_border": "rgba(212,168,67,0.3)",
        },
        "preview_html": """<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Inter:wght@300;400&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1920px;height:1080px;overflow:hidden;background:#0d0d0d;display:flex;align-items:center;justify-content:center}
.slide{width:1720px;padding:80px;display:flex;gap:80px;align-items:center}
.left{flex:1.2}
.right{flex:1;display:flex;flex-direction:column;gap:32px}
.eyebrow{font-family:'Inter',sans-serif;font-weight:300;font-size:36px;color:#d4a843;letter-spacing:8px;text-transform:uppercase;margin-bottom:20px}
h1{font-family:'Playfair Display',serif;font-size:88px;color:#f5f0e8;font-weight:700;line-height:1.1;margin-bottom:32px}
.divider{width:120px;height:2px;background:linear-gradient(90deg,#d4a843,transparent)}
.quote{font-family:'Playfair Display',serif;font-style:italic;font-size:46px;color:#c9b99a;line-height:1.6;padding-left:32px;border-left:3px solid #d4a843}
.card{background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.3);padding:36px 40px;border-radius:4px}
h3{font-family:'Inter',sans-serif;font-size:36px;font-weight:300;letter-spacing:3px;text-transform:uppercase;color:#d4a843;margin-bottom:12px}
p{font-family:'Inter',sans-serif;font-size:38px;color:#c9b99a;line-height:1.6}
</style></head><body>
<div class="slide">
  <div class="left">
    <div class="eyebrow">Chapter IV</div>
    <h1>The Art of Storytelling in Brand Design</h1>
    <div class="divider" style="margin-top:32px"></div>
    <div class="quote" style="margin-top:40px">"Design is not what it looks like — it is how it makes you feel."</div>
  </div>
  <div class="right">
    <div class="card"><h3>Narrative Arc</h3><p>Every great brand tells a story with a clear beginning, tension, and resolution</p></div>
    <div class="card"><h3>Visual Voice</h3><p>Color, type, and space combine to create an unmistakable emotional identity</p></div>
    <div class="card"><h3>Consistency</h3><p>The most luxurious brands earn trust through disciplined visual restraint</p></div>
  </div>
</div>
</body></html>""",
        "style_injection": """\
**CSS RULES — GLAMOUR TEMPLATE**:
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Inter:wght@300;400&display=swap');
body, .slide { background: #0d0d0d; color: #f5f0e8; }
h1, h2 { font-family: 'Playfair Display', serif; color: #f5f0e8; font-weight: 700; }
.eyebrow { font-family: 'Inter', sans-serif; font-weight: 300; letter-spacing: 8px;
           text-transform: uppercase; color: #d4a843; font-size: 36px; }
.divider { width: 120px; height: 2px; background: linear-gradient(90deg, #d4a843, transparent); }
.card   { background: rgba(212,168,67,0.08); border: 1px solid rgba(212,168,67,0.3);
           border-radius: 4px; padding: 36px 40px; }
.card h3 { font-family: 'Inter', sans-serif; font-weight: 300; letter-spacing: 3px;
           text-transform: uppercase; color: #d4a843; font-size: 34px; }
.quote  { border-left: 3px solid #d4a843; padding-left: 32px; font-style: italic;
          color: #c9b99a; }
p, li   { font-family: 'Inter', sans-serif; color: #c9b99a; line-height: 1.7; }
svg path, svg line { stroke: #d4a843; }
.highlight { color: #d4a843; }
```
**HTML STRUCTURE PATTERN**:
```html
<div style="background:#0d0d0d;padding:80px;width:100%;height:100%;overflow:hidden;display:flex;gap:80px;align-items:center">
  <div style="flex:1.2">
    <div style="font-family:'Inter';letter-spacing:8px;text-transform:uppercase;color:#d4a843;font-size:36px;margin-bottom:16px">SECTION TITLE</div>
    <h1 style="font-family:'Playfair Display',serif;font-size:88px;color:#f5f0e8;line-height:1.1">Main Heading in Serif</h1>
    <div style="width:120px;height:2px;background:linear-gradient(90deg,#d4a843,transparent);margin-top:32px"></div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;gap:28px">
    <div style="background:rgba(212,168,67,0.08);border:1px solid rgba(212,168,67,0.3);padding:36px">Card</div>
  </div>
</div>
```
**DESIGN RULES**: Dark #0d0d0d background. Playfair Display for ALL headings (serif, italic for quotes). Inter light-weight (300) for body + uppercase eyebrows with letter-spacing. Gold #d4a843 for all accents, borders, and decorative lines. Horizontal gradient divider line is a signature element. Very restrained — zero bright colors except gold.
""",
    },

    # ── 4. DIORAMA ──────────────────────────────────────────────────────────
    {
        "id": "diorama",
        "name": "Diorama",
        "description": "Layered 3D pop-up book feel — colorful, playful, warm",
        "tags": ["light", "3d", "playful", "colorful", "warm"],
        "background_type": "white",
        "palette_override": {
            "background": "#fff8f0",
            "text": "#2d1b0e",
            "text_secondary": "#7c4d2a",
            "accent": "#f97316",
            "primary": "#ea580c",
            "svg_stroke": "#ea580c",
            "svg_fill": "#fed7aa",
            "annotation_color": "#dc2626",
            "card_bg": "#ffffff",
            "card_border": "transparent",
        },
        "preview_html": """<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1920px;height:1080px;overflow:hidden;background:linear-gradient(160deg,#fff8f0 0%,#fef3e2 100%);font-family:'Poppins',sans-serif;display:flex;align-items:center;justify-content:center}
.slide{width:1720px;padding:60px}
h1{font-size:88px;color:#2d1b0e;font-weight:800;margin-bottom:16px}
.sub{font-size:40px;color:#7c4d2a;margin-bottom:60px}
.layers{display:flex;gap:40px;align-items:flex-end}
.layer{flex:1;background:#fff;border-radius:20px;padding:48px;position:relative;overflow:hidden}
.layer::before{content:'';position:absolute;top:0;left:0;right:0;height:8px;border-radius:20px 20px 0 0}
.l1::before{background:#f97316} .l2::before{background:#3b82f6} .l3::before{background:#22c55e}
.l1{box-shadow:0 20px 60px rgba(249,115,22,0.2);transform:translateY(20px)}
.l2{box-shadow:0 20px 60px rgba(59,130,246,0.2)}
.l3{box-shadow:0 20px 60px rgba(34,197,94,0.2);transform:translateY(-20px)}
.icon{font-size:72px;margin-bottom:20px}
h3{font-size:52px;color:#2d1b0e;font-weight:700;margin-bottom:16px}
p{font-size:38px;color:#7c4d2a;line-height:1.6}
.badge{display:inline-block;padding:8px 24px;border-radius:30px;font-size:32px;font-weight:600;margin-top:20px}
.b1{background:#fff7ed;color:#f97316} .b2{background:#eff6ff;color:#3b82f6} .b3{background:#f0fdf4;color:#22c55e}
</style></head><body>
<div class="slide">
  <h1>Sustainable Innovation</h1>
  <div class="sub">Three layers driving green technology forward</div>
  <div class="layers">
    <div class="layer l1"><div class="icon">🌱</div><h3>Regenerate</h3><p>Restore ecosystems through biomimicry and circular design</p><div class="badge b1">Layer 1</div></div>
    <div class="layer l2"><div class="icon">⚡</div><h3>Energise</h3><p>Replace fossil fuel systems with renewable micro-grids</p><div class="badge b2">Layer 2</div></div>
    <div class="layer l3"><div class="icon">🔄</div><h3>Circulate</h3><p>Design products for complete end-of-life material recovery</p><div class="badge b3">Layer 3</div></div>
  </div>
</div>
</body></html>""",
        "style_injection": """\
**CSS RULES — DIORAMA TEMPLATE**:
```css
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap');
body, .slide { background: linear-gradient(160deg, #fff8f0, #fef3e2); font-family: 'Poppins', sans-serif; }
h1, h2 { font-family: 'Poppins', sans-serif; font-weight: 800; color: #2d1b0e; }
.card  { background: #ffffff; border-radius: 20px; padding: 48px;
         box-shadow: 0 20px 60px rgba(0,0,0,0.12); position: relative; overflow: hidden; }
.card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 8px; border-radius: 20px 20px 0 0; }
/* Stagger cards for depth: first card translateY(+20px), middle at 0, last at -20px */
.depth-effect { transform: translateY(var(--dy, 0)); }
.badge { border-radius: 30px; padding: 8px 24px; font-size: 32px; font-weight: 600; display: inline-block; }
svg path { stroke: #ea580c; fill: none; }
.highlight { color: #f97316; font-weight: 700; }
```
**HTML STRUCTURE PATTERN**:
```html
<div style="background:linear-gradient(160deg,#fff8f0,#fef3e2);padding:60px;font-family:'Poppins',sans-serif;width:100%;height:100%;overflow:hidden">
  <h1 style="font-size:88px;color:#2d1b0e;font-weight:800">Main Title</h1>
  <div style="display:flex;gap:40px;align-items:flex-end;margin-top:48px">
    <div style="flex:1;background:#fff;border-radius:20px;padding:48px;box-shadow:0 20px 60px rgba(249,115,22,0.2);transform:translateY(20px)">
      <div style="height:8px;background:#f97316;border-radius:4px;margin-bottom:32px"></div>
      Card content here
    </div>
  </div>
</div>
```
**DESIGN RULES**: Warm gradient background (#fff8f0→#fef3e2). Cards are pure white with large box-shadow and staggered vertical offsets (pop-up book depth). Top accent stripe on each card changes color per card. Use emoji icons at 64-80px size. Rounded corners (border-radius: 20px) throughout. Poppins ExtraBold (800) for titles.
""",
    },

    # ── 5. NEON ─────────────────────────────────────────────────────────────
    {
        "id": "neon",
        "name": "Neon",
        "description": "Cyberpunk glow aesthetic — dark with electric neon highlights",
        "tags": ["dark", "neon", "cyberpunk", "glow", "tech"],
        "background_type": "black",
        "palette_override": {
            "background": "#050510",
            "text": "#e2e8f0",
            "text_secondary": "#94a3b8",
            "accent": "#39ff14",
            "primary": "#39ff14",
            "svg_stroke": "#39ff14",
            "svg_fill": "rgba(57,255,20,0.1)",
            "annotation_color": "#ff00ff",
            "card_bg": "rgba(57,255,20,0.05)",
            "card_border": "rgba(57,255,20,0.3)",
        },
        "preview_html": """<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1920px;height:1080px;overflow:hidden;background:#050510;font-family:'Orbitron',monospace;display:flex;align-items:center;justify-content:center}
.slide{width:1720px;padding:80px;position:relative}
.scanline{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(57,255,20,0.03) 3px,rgba(57,255,20,0.03) 4px);pointer-events:none}
.label{font-size:32px;color:#39ff14;letter-spacing:6px;text-transform:uppercase;margin-bottom:20px;font-family:'Share Tech Mono',monospace}
h1{font-size:88px;color:#e2e8f0;font-weight:900;text-shadow:0 0 40px rgba(57,255,20,0.5),0 0 80px rgba(57,255,20,0.2);margin-bottom:48px;line-height:1.1}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:32px}
.card{background:rgba(57,255,20,0.05);border:1px solid rgba(57,255,20,0.3);padding:40px;position:relative}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#39ff14,#ff00ff,#00ffff)}
h3{font-size:44px;color:#39ff14;font-weight:700;margin-bottom:16px;text-shadow:0 0 20px rgba(57,255,20,0.6)}
p{font-family:'Share Tech Mono',monospace;font-size:34px;color:#94a3b8;line-height:1.6}
.val{font-size:68px;font-weight:900;color:#39ff14;text-shadow:0 0 30px #39ff14;margin-bottom:8px}
</style></head><body>
<div class="slide">
  <div class="scanline"></div>
  <div class="label">&gt; SYSTEM_INIT // AI_MODULE_03</div>
  <h1>Neural Network Architecture</h1>
  <div class="grid">
    <div class="card"><div class="val">1.4T</div><h3>Parameters</h3><p>Transformer weights across 96 attention layers</p></div>
    <div class="card"><div class="val">128K</div><h3>Context Window</h3><p>Token capacity per forward pass in inference</p></div>
    <div class="card"><div class="val">99.2%</div><h3>Accuracy</h3><p>Benchmark score on MMLU reasoning tasks</p></div>
  </div>
</div>
</body></html>""",
        "style_injection": """\
**CSS RULES — NEON TEMPLATE**:
```css
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
body, .slide { background: #050510; font-family: 'Orbitron', monospace; color: #e2e8f0; }
/* Optional scanline overlay */
.scanline { background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(57,255,20,0.03) 3px, rgba(57,255,20,0.03) 4px); }
h1, h2 { font-family: 'Orbitron', monospace; font-weight: 900; color: #e2e8f0;
          text-shadow: 0 0 40px rgba(57,255,20,0.5), 0 0 80px rgba(57,255,20,0.2); }
.label  { font-family: 'Share Tech Mono', monospace; color: #39ff14; letter-spacing: 6px;
          text-transform: uppercase; font-size: 32px; }
.card   { background: rgba(57,255,20,0.05); border: 1px solid rgba(57,255,20,0.3); padding: 40px; }
.card::before { content: ''; display: block; height: 2px; margin-bottom: 32px;
                background: linear-gradient(90deg, #39ff14, #ff00ff, #00ffff); }
h3      { color: #39ff14; text-shadow: 0 0 20px rgba(57,255,20,0.6); }
p, .body { font-family: 'Share Tech Mono', monospace; color: #94a3b8; }
.glow-green { color: #39ff14; text-shadow: 0 0 30px #39ff14; }
.glow-pink  { color: #ff00ff; text-shadow: 0 0 30px #ff00ff; }
svg path, svg line { stroke: #39ff14; filter: drop-shadow(0 0 6px #39ff14); }
```
**HTML STRUCTURE PATTERN**:
```html
<div style="background:#050510;padding:80px;font-family:'Orbitron',monospace;width:100%;height:100%;overflow:hidden;position:relative">
  <div style="font-family:'Share Tech Mono';color:#39ff14;letter-spacing:6px;font-size:32px;margin-bottom:16px">> MODULE_LABEL</div>
  <h1 style="font-size:88px;font-weight:900;color:#e2e8f0;text-shadow:0 0 40px rgba(57,255,20,0.5);margin-bottom:48px">HEADING</h1>
  <div style="background:rgba(57,255,20,0.05);border:1px solid rgba(57,255,20,0.3);padding:40px">
    <div style="height:2px;background:linear-gradient(90deg,#39ff14,#ff00ff,#00ffff);margin-bottom:28px"></div>
    <h3 style="color:#39ff14;text-shadow:0 0 20px rgba(57,255,20,0.6)">Card Title</h3>
  </div>
</div>
```
**DESIGN RULES**: Very dark #050510 background. Orbitron font for headings (futuristic). Share Tech Mono for body/data. Neon green #39ff14 for accent text + glow text-shadow. Gradient border line (green→magenta→cyan) at top of each card. NO soft shadows — only glow (text-shadow/filter:drop-shadow).
""",
    },

    # ── 6. CHALKBOARD ───────────────────────────────────────────────────────
    {
        "id": "chalkboard",
        "name": "Chalkboard",
        "description": "Dark green classroom chalkboard — chalk-white handwriting",
        "tags": ["dark", "sketch", "chalk", "classroom", "educational"],
        "background_type": "black",
        "palette_override": {
            "background": "#1a3a2a",
            "text": "#f0ece0",
            "text_secondary": "#c8c0a8",
            "accent": "#f0ece0",
            "primary": "#f0ece0",
            "svg_stroke": "#f0ece0",
            "svg_fill": "rgba(240,236,224,0.1)",
            "annotation_color": "#ffcc44",
            "card_bg": "rgba(240,236,224,0.07)",
            "card_border": "rgba(240,236,224,0.3)",
        },
        "preview_html": """<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1920px;height:1080px;overflow:hidden;background:#1a3a2a;font-family:'Caveat',cursive;display:flex;align-items:center;justify-content:center}
.slide{width:1720px;padding:60px}
.frame{border:4px solid rgba(240,236,224,0.4);padding:48px;border-radius:4px}
h1{font-size:88px;color:#f0ece0;font-weight:700;border-bottom:3px dashed rgba(240,236,224,0.4);padding-bottom:20px;margin-bottom:40px}
.cols{display:flex;gap:60px}
.col{flex:1}
h2{font-size:58px;color:#ffcc44;margin-bottom:20px;font-weight:700}
p{font-size:44px;color:#c8c0a8;line-height:1.6}
ul{list-style:none;display:flex;flex-direction:column;gap:16px}
li{font-size:44px;color:#f0ece0;line-height:1.4;padding-left:40px;position:relative}
li::before{content:'→';position:absolute;left:0;color:#ffcc44}
.box{border:2px dashed rgba(240,236,224,0.4);padding:24px 32px;margin-top:24px;background:rgba(240,236,224,0.05)}
</style></head><body>
<div class="slide">
  <div class="frame">
    <h1>Laws of Thermodynamics</h1>
    <div class="cols">
      <div class="col">
        <h2>1st Law</h2>
        <p>Energy cannot be created or destroyed — only converted between forms</p>
        <div class="box">ΔU = Q − W</div>
      </div>
      <div class="col">
        <h2>2nd Law</h2>
        <ul>
          <li>Entropy always increases in closed systems</li>
          <li>Heat flows from hot to cold spontaneously</li>
          <li>No engine achieves 100% efficiency</li>
        </ul>
      </div>
    </div>
  </div>
</div>
</body></html>""",
        "style_injection": """\
**CSS RULES — CHALKBOARD TEMPLATE**:
```css
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&display=swap');
body, .slide { background: #1a3a2a; font-family: 'Caveat', cursive; }
h1, h2, h3   { font-family: 'Caveat', cursive; color: #f0ece0; font-weight: 700; }
.frame       { border: 4px solid rgba(240,236,224,0.35); border-radius: 4px; padding: 48px; }
h1           { border-bottom: 3px dashed rgba(240,236,224,0.35); padding-bottom: 16px; margin-bottom: 36px; }
h2, .label   { color: #ffcc44; }   /* yellow chalk for sub-headings */
p, li        { color: #c8c0a8; font-family: 'Caveat', cursive; font-size: 44px; }
.box, .formula { border: 2px dashed rgba(240,236,224,0.4); padding: 20px 32px;
                 background: rgba(240,236,224,0.05); display: inline-block; }
li::before   { content: '→'; color: #ffcc44; margin-right: 12px; }
svg path, svg line { stroke: #f0ece0; stroke-linecap: round; stroke-linejoin: round;
                     stroke-dasharray: 8 4; }  /* dashed = chalky lines */
.highlight   { color: #ffcc44; }
```
**HTML STRUCTURE PATTERN**:
```html
<div style="background:#1a3a2a;padding:60px;font-family:'Caveat',cursive;width:100%;height:100%;overflow:hidden">
  <div style="border:4px solid rgba(240,236,224,0.35);padding:48px;border-radius:4px">
    <h1 style="font-size:88px;color:#f0ece0;border-bottom:3px dashed rgba(240,236,224,0.35);padding-bottom:16px;margin-bottom:36px">Title on Chalkboard</h1>
    <div style="border:2px dashed rgba(240,236,224,0.4);padding:24px;background:rgba(240,236,224,0.05)">
      Formula or key point
    </div>
  </div>
</div>
```
**DESIGN RULES**: Dark green background (#1a3a2a). Caveat font (handwriting/chalk style). Main text is off-white (#f0ece0). Sub-headings and highlights in yellow chalk (#ffcc44). All borders are DASHED to simulate chalk lines. SVG lines use stroke-dasharray for chalky appearance. Outer frame border gives the chalkboard-within-a-chalkboard feel.
""",
    },

    # ── 7. BLUEPRINT ────────────────────────────────────────────────────────
    {
        "id": "blueprint",
        "name": "Blueprint",
        "description": "Technical architectural drawing on navy — precise, engineering aesthetic",
        "tags": ["dark", "blue", "technical", "engineering", "mono"],
        "background_type": "black",
        "palette_override": {
            "background": "#0a1628",
            "text": "#e8f4ff",
            "text_secondary": "#8ab4d4",
            "accent": "#4a9eff",
            "primary": "#4a9eff",
            "svg_stroke": "#4a9eff",
            "svg_fill": "rgba(74,158,255,0.1)",
            "annotation_color": "#ff9933",
            "card_bg": "rgba(74,158,255,0.06)",
            "card_border": "rgba(74,158,255,0.3)",
        },
        "preview_html": """<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1920px;height:1080px;overflow:hidden;background:#0a1628;font-family:'Courier Prime',monospace;display:flex;align-items:center;justify-content:center}
.bg{position:absolute;inset:0;background-image:linear-gradient(rgba(74,158,255,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(74,158,255,0.07) 1px,transparent 1px);background-size:60px 60px}
.slide{width:1720px;padding:60px;position:relative}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid rgba(74,158,255,0.5);padding-bottom:24px;margin-bottom:40px}
h1{font-size:80px;color:#e8f4ff;font-weight:700;line-height:1.1}
.meta{text-align:right;color:#8ab4d4;font-size:34px;line-height:1.8;font-family:'Share Tech Mono',monospace}
.grid{display:grid;grid-template-columns:1.4fr 1fr;gap:48px}
.diagram{background:rgba(74,158,255,0.06);border:2px solid rgba(74,158,255,0.3);padding:40px}
.specs{display:flex;flex-direction:column;gap:24px}
.spec{background:rgba(74,158,255,0.06);border-left:4px solid #4a9eff;padding:28px 32px}
h3{font-size:38px;color:#4a9eff;font-weight:700;margin-bottom:12px;letter-spacing:2px;text-transform:uppercase}
p{font-family:'Share Tech Mono',monospace;font-size:34px;color:#8ab4d4;line-height:1.6}
svg{display:block}
</style></head><body>
<div class="bg"></div>
<div class="slide">
  <div class="header">
    <h1>CPU Architecture<br>Diagram</h1>
    <div class="meta">DWG-2024-047<br>REV: 3.0<br>SCALE: 1:1</div>
  </div>
  <div class="grid">
    <div class="diagram">
      <svg width="100%" height="380" viewBox="0 0 800 380">
        <rect x="200" y="40" width="400" height="300" fill="none" stroke="#4a9eff" stroke-width="2"/>
        <rect x="240" y="80" width="140" height="80" fill="rgba(74,158,255,0.1)" stroke="#4a9eff" stroke-width="1.5"/>
        <text x="310" y="128" fill="#e8f4ff" font-family="Courier Prime" font-size="22" text-anchor="middle">ALU</text>
        <rect x="420" y="80" width="140" height="80" fill="rgba(74,158,255,0.1)" stroke="#4a9eff" stroke-width="1.5"/>
        <text x="490" y="128" fill="#e8f4ff" font-family="Courier Prime" font-size="22" text-anchor="middle">Control</text>
        <rect x="240" y="200" width="320" height="100" fill="rgba(74,158,255,0.1)" stroke="#4a9eff" stroke-width="1.5"/>
        <text x="400" y="258" fill="#e8f4ff" font-family="Courier Prime" font-size="22" text-anchor="middle">Cache Memory</text>
        <line x1="200" y1="190" x2="0" y2="190" stroke="#ff9933" stroke-width="2" stroke-dasharray="8,4"/>
        <text x="10" y="180" fill="#ff9933" font-family="Courier Prime" font-size="20">DATA BUS →</text>
      </svg>
    </div>
    <div class="specs">
      <div class="spec"><h3>Clock Speed</h3><p>3.6 GHz base / 5.2 GHz boost</p></div>
      <div class="spec"><h3>Cache</h3><p>32 MB L3 shared across 16 cores</p></div>
      <div class="spec"><h3>TDP</h3><p>125W thermal design power envelope</p></div>
    </div>
  </div>
</div>
</body></html>""",
        "style_injection": """\
**CSS RULES — BLUEPRINT TEMPLATE**:
```css
@import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Share+Tech+Mono&display=swap');
body, .slide { background: #0a1628; font-family: 'Courier Prime', monospace; color: #e8f4ff; }
/* Grid background */
.grid-bg { background-image: linear-gradient(rgba(74,158,255,0.07) 1px, transparent 1px),
           linear-gradient(90deg, rgba(74,158,255,0.07) 1px, transparent 1px);
           background-size: 60px 60px; }
h1, h2   { font-family: 'Courier Prime', monospace; color: #e8f4ff; font-weight: 700; }
.label, h3 { color: #4a9eff; letter-spacing: 2px; text-transform: uppercase;
             font-family: 'Share Tech Mono', monospace; }
.card, .box { background: rgba(74,158,255,0.06); border: 2px solid rgba(74,158,255,0.3); padding: 32px; }
.spec-card  { border-left: 4px solid #4a9eff; }
.meta-label { font-family: 'Share Tech Mono', monospace; color: #8ab4d4; letter-spacing: 1px; }
.annotation { color: #ff9933; }  /* orange for callout annotations */
.divider    { border-top: 2px solid rgba(74,158,255,0.5); }
p, li       { font-family: 'Share Tech Mono', monospace; color: #8ab4d4; }
svg rect    { fill: rgba(74,158,255,0.08); stroke: #4a9eff; stroke-width: 2; }
svg line    { stroke: #4a9eff; stroke-width: 1.5; stroke-dasharray: 8 4; }
svg text    { fill: #e8f4ff; font-family: 'Courier Prime', monospace; }
```
**HTML STRUCTURE PATTERN**:
```html
<div style="background:#0a1628;padding:60px;font-family:'Courier Prime',monospace;width:100%;height:100%;overflow:hidden;position:relative">
  <!-- Grid background overlay -->
  <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(74,158,255,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(74,158,255,0.07) 1px,transparent 1px);background-size:60px 60px;pointer-events:none"></div>
  <!-- Header row with title + drawing metadata -->
  <div style="display:flex;justify-content:space-between;border-bottom:2px solid rgba(74,158,255,0.5);padding-bottom:20px;margin-bottom:36px">
    <h1 style="font-size:80px;color:#e8f4ff">Component Title</h1>
    <div style="font-family:'Share Tech Mono';color:#8ab4d4;text-align:right;font-size:32px;line-height:1.8">DWG-REF<br>REV: 1.0</div>
  </div>
  <div style="background:rgba(74,158,255,0.06);border:2px solid rgba(74,158,255,0.3);padding:40px">
    SVG diagram or spec content here
  </div>
</div>
```
**DESIGN RULES**: Navy #0a1628 background with CSS grid lines (60px, 7% opacity). Courier Prime + Share Tech Mono fonts only. ALL labels uppercase with letter-spacing. Boxes use border-only style (no fills except 6% opacity). SVG elements use dashed strokes. Orange #ff9933 only for callout annotations/arrows. Include a drawing-reference metadata block (DWG number, revision) for authenticity.
""",
    },

    # ── 8. MINIMAL ──────────────────────────────────────────────────────────
    {
        "id": "minimal",
        "name": "Minimal",
        "description": "Ultra-clean whitespace — content-first, zero decoration",
        "tags": ["light", "clean", "minimal", "whitespace", "modern"],
        "background_type": "white",
        "palette_override": {
            "background": "#fafafa",
            "text": "#111827",
            "text_secondary": "#6b7280",
            "accent": "#374151",
            "primary": "#374151",
            "svg_stroke": "#374151",
            "svg_fill": "#f3f4f6",
            "annotation_color": "#dc2626",
            "card_bg": "#ffffff",
            "card_border": "#e5e7eb",
        },
        "preview_html": """<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1920px;height:1080px;overflow:hidden;background:#fafafa;font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center}
.slide{width:1440px;padding:80px}
.tag{font-size:32px;font-weight:600;color:#9ca3af;letter-spacing:4px;text-transform:uppercase;margin-bottom:20px}
h1{font-size:88px;color:#111827;font-weight:700;line-height:1.1;margin-bottom:16px}
.lead{font-size:44px;color:#6b7280;font-weight:300;line-height:1.6;margin-bottom:64px;max-width:1000px}
.list{display:flex;flex-direction:column;gap:0}
.item{display:flex;align-items:flex-start;gap:40px;padding:32px 0;border-bottom:1px solid #e5e7eb}
.item:first-child{border-top:1px solid #e5e7eb}
.num{font-size:36px;color:#d1d5db;font-weight:700;min-width:60px;margin-top:8px}
.text h3{font-size:48px;color:#111827;font-weight:600;margin-bottom:8px}
.text p{font-size:38px;color:#6b7280;font-weight:300;line-height:1.6}
</style></head><body>
<div class="slide">
  <div class="tag">Overview</div>
  <h1>The Three Principles of Good Design</h1>
  <div class="lead">Design that endures combines clarity, purpose, and restraint in equal measure.</div>
  <div class="list">
    <div class="item"><div class="num">01</div><div class="text"><h3>Form follows function</h3><p>Every element earns its place by serving a clear communicative purpose</p></div></div>
    <div class="item"><div class="num">02</div><div class="text"><h3>Hierarchy through contrast</h3><p>Size, weight, and spacing guide the eye without decorative interference</p></div></div>
    <div class="item"><div class="num">03</div><div class="text"><h3>Whitespace is content</h3><p>Empty space creates rhythm, focus, and breathing room for ideas</p></div></div>
  </div>
</div>
</body></html>""",
        "style_injection": """\
**CSS RULES — MINIMAL TEMPLATE**:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
body, .slide { background: #fafafa; font-family: 'Inter', sans-serif; color: #111827; }
h1, h2 { font-family: 'Inter', sans-serif; font-weight: 700; color: #111827; }
.tag, .label { font-size: 32px; font-weight: 600; color: #9ca3af;
               letter-spacing: 4px; text-transform: uppercase; }
.lead  { font-weight: 300; color: #6b7280; font-size: 44px; line-height: 1.7; }
.list-item { border-bottom: 1px solid #e5e7eb; padding: 28px 0;
             display: flex; gap: 40px; align-items: flex-start; }
.number { color: #d1d5db; font-size: 36px; font-weight: 700; min-width: 60px; }
.divider { border: none; border-top: 1px solid #e5e7eb; margin: 48px 0; }
p, li   { font-weight: 300; color: #6b7280; line-height: 1.7; }
.highlight { color: #111827; font-weight: 600; }
svg path, svg line { stroke: #374151; stroke-width: 1.5; }
/* NO shadows, NO gradients, NO rounded corners, NO background fills on cards */
```
**HTML STRUCTURE PATTERN**:
```html
<div style="background:#fafafa;padding:100px;font-family:'Inter',sans-serif;width:100%;height:100%;overflow:hidden">
  <div style="font-size:32px;font-weight:600;color:#9ca3af;letter-spacing:4px;text-transform:uppercase;margin-bottom:16px">SECTION LABEL</div>
  <h1 style="font-size:88px;color:#111827;font-weight:700;line-height:1.1;margin-bottom:20px">Clean Title</h1>
  <p style="font-size:44px;color:#6b7280;font-weight:300;line-height:1.7;max-width:1000px;margin-bottom:60px">Lead paragraph in light weight, generous line height.</p>
  <div style="border-top:1px solid #e5e7eb;padding-top:36px;display:flex;gap:40px">
    <span style="color:#d1d5db;font-size:36px;font-weight:700;min-width:60px">01</span>
    <div><h3 style="font-size:48px;color:#111827;font-weight:600">Item title</h3></div>
  </div>
</div>
```
**DESIGN RULES**: Off-white #fafafa background. Inter font ONLY — light (300) for body, bold (700) for headings, semibold (600) for labels. Wide padding (100px). Horizontal rule dividers (1px solid #e5e7eb) instead of card boxes. Numbered lists with muted gray sequence numbers. ZERO box-shadows, gradients, rounded corners, or decorative elements. Maximum whitespace.
""",
    },
]


# ---------------------------------------------------------------------------
# Index for O(1) lookup
# ---------------------------------------------------------------------------

_TEMPLATES_BY_ID: Dict[str, Dict[str, Any]] = {t["id"]: t for t in VIDEO_TEMPLATES}


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def get_template_by_id(template_id: str) -> Optional[Dict[str, Any]]:
    """Return the full template dict (including style_injection) or None."""
    return _TEMPLATES_BY_ID.get(template_id)


def list_templates() -> List[Dict[str, Any]]:
    """Return all template metadata for the API — style_injection and palette_override excluded."""
    EXCLUDE = {"style_injection", "palette_override"}
    return [{k: v for k, v in t.items() if k not in EXCLUDE} for t in VIDEO_TEMPLATES]


__all__ = ["VIDEO_TEMPLATES", "get_template_by_id", "list_templates"]
