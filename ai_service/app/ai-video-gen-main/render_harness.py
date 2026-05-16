"""Shared render-page harness used by both generate_video.py (full timeline render) and screenshot_worker.py (single-shot screenshot for vision review).

The harness is a single HTML page that loads all libraries the LLM-generated shots may use (GSAP, anime.js, Iconify, KaTeX, Mermaid, Vivus, Rough Notation, Howler, D3) and exposes window.__updateSnippets() — the dispatcher that injects each shot's HTML into a shadow-DOM-scoped wrapper, applies LLM-output preprocessing (:root → :host, body → #content-wrapper, etc.), and seeks gsap.globalTimeline.totalTime() to the shot's inTime so per-shot tween delays compose correctly.

This module exists so the screenshot endpoint and the production renderer use byte-identical harness HTML — what the vision reviewer sees equals what the MP4 will produce.
"""
from __future__ import annotations


HARNESS_TEMPLATE = """
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8" />

                <!-- Google Fonts (must match client-side html-processor.ts) -->
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&family=Fira+Code:wght@400;500;600&family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">

                <!-- GSAP -->
                <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js"></script>
                <!-- MorphSVGPlugin is a GSAP premium plugin — not on public CDN. Provide stub. -->
                <script>
                    window.MorphSVGPlugin = { version: '3.12.5', name: 'MorphSVGPlugin', default: {} };
                </script>

                <!-- Mermaid -->
                <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

                <!-- Rough Notation -->
                <script src="https://unpkg.com/rough-notation/lib/rough-notation.iife.js"></script>

                <!-- Vivus -->
                <script src="https://cdn.jsdelivr.net/npm/vivus@0.4.6/dist/vivus.min.js"></script>

                <!-- KaTeX -->
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
                <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
                <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>

                <!-- Prism -->
                <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
                <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>

                <!-- Howler -->
                <script src="https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js"></script>

                <!-- D3.js (data visualizations, charts) -->
                <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>

                <!-- Anime.js v3 — SVG morphing, stagger grids, spring physics -->
                <!-- Frame-seeking: create animations with autoplay:false, register via window._animeR({instance, startMs}) -->
                <script src="https://cdn.jsdelivr.net/npm/animejs@3.2.1/lib/anime.min.js"></script>
                <script>
                    // Anime.js frame-seek registry.
                    // LLM code registers seekable animations with: window._animeR({instance: anime({autoplay:false,...}), startMs:500})
                    // The renderer calls window._animeSeek(t_seconds) every frame alongside gsap.globalTimeline.totalTime(t).
                    window._animeTimelines = [];
                    window._animeR = function(entry) { window._animeTimelines.push(entry); };
                    window._animeSeek = function(tSec) {
                        var tMs = tSec * 1000;
                        window._animeTimelines.forEach(function(e) {
                            if (!e || !e.instance || typeof e.instance.seek !== 'function') return;
                            var elapsed = tMs - (e.startMs || 0);
                            if (elapsed >= 0) {
                                e.instance.seek(Math.min(elapsed, e.instance.duration || 0));
                            }
                        });
                    };
                </script>

                <!-- Iconify (Web Component — 275k+ icons) -->
                <script src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js"></script>

                <style>
                  /* ===== BASE STYLES (must match client html-processor.ts getBaseStyles) ===== */
                  :root {
                    --text-color: #1e293b;
                    --text-secondary: #475569;
                    --primary-color: #2563eb;
                    --accent-color: #f59e0b;
                    --background-color: #ffffff;
                  }
                  * { box-sizing: border-box; }
                  html, body { margin:0; padding:0; width:100%; height:100%; background:REPLACE_BG; overflow:hidden; font-family: 'Inter', 'Noto Sans', sans-serif; color: var(--text-color); }
                  body { position:relative; }
                  /* Note: body * opacity:1 is NOT set here — it's inside shadow DOM CSS only */
                  pre { white-space: pre-wrap; word-wrap: break-word; }

                  /* Typography classes */
                  .text-display { font-family: 'Montserrat', 'Noto Sans', sans-serif; font-size: 64px; font-weight: 800; line-height: 1.1; }
                  .text-h2 { font-family: 'Montserrat', 'Noto Sans', sans-serif; font-size: 48px; font-weight: 700; margin-bottom: 16px; }
                  .text-body { font-family: 'Inter', 'Noto Sans', sans-serif; font-size: 28px; font-weight: 400; line-height: 1.5; }
                  .text-label { font-family: 'Fira Code', monospace; font-size: 18px; text-transform: uppercase; letter-spacing: 0.1em; }

                  .full-screen-center {
                    width: 100%; height: 100%;
                    display: flex; flex-direction: column;
                    align-items: center; justify-content: center;
                    text-align: center; padding: 60px 80px;
                  }

                  .highlight {
                    background: linear-gradient(120deg, rgba(255, 226, 89, 0.6) 0%, rgba(255, 233, 148, 0.4) 100%);
                    padding: 0 4px; border-radius: 4px;
                  }
                  .emphasis { color: var(--primary-color); font-weight: bold; }
                  .mermaid { display: flex; justify-content: center; width: 100%; margin: 20px auto; }
                  .layout-split {
                    display: grid; grid-template-columns: 1fr 1fr; gap: 60px;
                    width: 90%; max-width: 1700px; align-items: center;
                  }

                  /* Key Takeaway Card */
                  .key-takeaway { display: flex; align-items: center; gap: 20px; padding: 24px 32px; border-left: 5px solid #10b981; background: rgba(16, 185, 129, 0.1); margin: 20px 0; }
                  .takeaway-icon { font-size: 48px; }
                  .takeaway-label { font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #10b981; font-weight: 700; }
                  .takeaway-text { font-size: 28px; margin-top: 8px; font-weight: 600; }

                  /* Wrong vs Right Pattern */
                  .wrong-right-container { display: flex; gap: 40px; width: 100%; }
                  .wrong-box, .right-box { flex: 1; padding: 24px; border-radius: 12px; }
                  .wrong-box { border: 3px solid #ef4444; background: rgba(239, 68, 68, 0.1); }
                  .right-box { border: 3px solid #10b981; background: rgba(16, 185, 129, 0.1); }
                  .wr-header { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
                  .wrong-box .wr-header { color: #ef4444; }
                  .right-box .wr-header { color: #10b981; }
                  .wr-icon { font-size: 24px; margin-right: 8px; }
                  .wr-text { font-size: 24px; }

                  /* Cutout asset images */
                  .generated-image[data-cutout="true"] {
                    background: transparent; mix-blend-mode: normal;
                    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));
                  }

                  /* ===== KEN BURNS CINEMATIC ENGINE (must match html-processor.ts getKenBurnsStyles) ===== */
                  .image-hero { position: relative; width: 100%; height: 100%; overflow: hidden; }
                  .image-hero > img {
                    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
                    transform-origin: center; will-change: transform;
                    animation-duration: var(--kb-duration, 12s);
                    animation-timing-function: ease-in-out; animation-fill-mode: both;
                  }
                  .image-text-overlay {
                    position: absolute; inset: 0; display: flex; flex-direction: column;
                    justify-content: flex-end; padding: 80px 100px; z-index: 2;
                  }
                  .image-text-overlay > * { position: relative; z-index: 1; }
                  .image-text-overlay.gradient-bottom::before,
                  .image-text-overlay:not([class*="gradient-"])::before {
                    content: ""; position: absolute; inset: 0;
                    background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 40%, transparent 70%);
                    pointer-events: none; z-index: 0;
                  }
                  .image-text-overlay.gradient-full::before {
                    content: ""; position: absolute; inset: 0;
                    background: rgba(0,0,0,0.45); pointer-events: none; z-index: 0;
                  }
                  .image-text-overlay.gradient-center { justify-content: center; align-items: center; text-align: center; }
                  .image-text-overlay.gradient-center::before {
                    content: ""; position: absolute; inset: 0;
                    background: radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 70%);
                    pointer-events: none; z-index: 0;
                  }
                  .image-text-overlay h1, .image-text-overlay .hero-title {
                    font-family: 'Montserrat', sans-serif; font-size: 64px; font-weight: 800;
                    color: #fff; line-height: 1.1; margin: 0 0 16px 0;
                    text-shadow: 0 2px 20px rgba(0,0,0,0.3);
                  }
                  .image-text-overlay p, .image-text-overlay .hero-subtitle {
                    font-family: 'Inter', sans-serif; font-size: 28px;
                    color: rgba(255,255,255,0.9); line-height: 1.4; margin: 0; max-width: 800px;
                  }

                  /* VIDEO_HERO: Full-screen stock video background */
                  .video-hero { position: relative; width: 100%; height: 100%; overflow: hidden; }
                  .video-hero > video, .video-hero > .stock-video {
                      position: absolute; inset: 0; width: 100%; height: 100%;
                      object-fit: cover; z-index: 0;
                  }
                  .stock-video { object-fit: cover; width: 100%; height: 100%; }

                  /* IMAGE_SPLIT */
                  .image-split-layout { display: grid; grid-template-columns: 1fr 1fr; width: 100%; height: 100%; overflow: hidden; }
                  .image-split-layout .split-image { position: relative; overflow: hidden; }
                  .image-split-layout .split-image img {
                    width: 100%; height: 100%; object-fit: cover; will-change: transform;
                    animation-duration: var(--kb-duration, 12s);
                    animation-timing-function: ease-in-out; animation-fill-mode: both;
                  }
                  .image-split-layout .split-text { display: flex; flex-direction: column; justify-content: center; padding: 60px 80px; }

                  /* Portrait (9:16) responsive overrides */
                  @media (max-width: 1100px) {
                    .full-screen-center { padding: 40px; }
                    .text-display { font-size: 48px; }
                    .text-h2 { font-size: 36px; }
                    .text-body { font-size: 24px; }
                    .layout-split { grid-template-columns: 1fr; gap: 30px; }
                    .image-split-layout { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
                    .image-split-layout .split-text { padding: 30px 40px; }
                    .image-text-overlay { justify-content: center; align-items: center; text-align: center; padding: 40px; }
                    .image-text-overlay::before { background: rgba(0,0,0,0.5) !important; }
                    .image-text-overlay > * { background: rgba(0,0,0,0.65); padding: 20px 32px; border-radius: 12px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
                    .image-text-overlay > *::before { display: none; }
                    .image-text-overlay h1, .image-text-overlay .hero-title { font-size: 48px; text-align: center; }
                    .image-text-overlay p, .image-text-overlay .hero-subtitle { font-size: 24px; max-width: 100%; text-align: center; }
                    .lower-third { bottom: 80px; left: 40px; }
                  }

                  /* LOWER_THIRD */
                  .lower-third {
                    position: absolute; bottom: 120px; left: 100px;
                    display: flex; align-items: stretch;
                    animation: ltSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; z-index: 20;
                  }
                  .lower-third .lt-accent-bar { width: 6px; background: linear-gradient(180deg, #3b82f6, #8b5cf6); border-radius: 3px 0 0 3px; }
                  .lower-third .lt-content { background: rgba(0,0,0,0.85); padding: 16px 32px; border-radius: 0 8px 8px 0; display: flex; flex-direction: column; gap: 4px; }
                  .lower-third .lt-label { font-family: 'Fira Code', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; color: #3b82f6; font-weight: 600; }
                  .lower-third .lt-text { font-family: 'Inter', sans-serif; font-size: 24px; color: #fff; font-weight: 600; }
                  @keyframes ltSlideIn { from { transform: translateX(-40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

                  /* ANNOTATION_MAP */
                  .annotation-map-container { position: relative; width: 100%; height: 100%; overflow: hidden; }
                  .annotation-map-container .annotation-map-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; will-change: transform; animation-duration: var(--kb-duration, 12s); animation-timing-function: ease-in-out; animation-fill-mode: both; }
                  .annotation-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; }

                  /* PROCESS_STEPS */
                  .process-flow { display: flex; flex-direction: column; align-items: center; width: 80%; max-width: 960px; }
                  .process-node { display: flex; align-items: center; gap: 24px; background: var(--card-bg, rgba(30,41,59,0.6)); border: 2px solid var(--primary-color, #3b82f6); border-radius: 12px; padding: 20px 32px; width: 100%; }
                  .node-num { width: 52px; height: 52px; border-radius: 50%; background: var(--primary-color, #3b82f6); color: #fff; font-size: 24px; font-weight: 800; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; }
                  .node-body { display: flex; flex-direction: column; gap: 4px; }
                  .node-title { font-size: 22px; font-weight: 700; font-family: 'Montserrat', sans-serif; color: var(--text-color, #fff); }
                  .node-desc { font-size: 16px; font-family: 'Inter', sans-serif; color: var(--text-secondary, #94a3b8); }
                  .process-connector { width: 20px; height: 40px; flex-shrink: 0; color: var(--primary-color, #3b82f6); }

                  /* EQUATION_BUILD */
                  .equation-build-row { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; margin: 48px 0 32px; }
                  .equation-build-row .eq-term, .equation-build-row .eq-sep { display: inline-flex; align-items: center; font-size: 3.5rem; }
                  .equation-build-row .eq-sep { font-size: 3rem; margin: 0 4px; }

                  /* Ken Burns motion keyframes */
                  .kb-zoom-in     { animation-name: kbZoomIn; }
                  .kb-zoom-out    { animation-name: kbZoomOut; }
                  .kb-pan-left    { animation-name: kbPanLeft; }
                  .kb-pan-right   { animation-name: kbPanRight; }
                  .kb-pan-up      { animation-name: kbPanUp; }
                  .kb-zoom-pan-tl { animation-name: kbZoomPanTL; }
                  @keyframes kbZoomIn    { from { transform: scale(1.0); }  to { transform: scale(1.15); } }
                  @keyframes kbZoomOut   { from { transform: scale(1.20); } to { transform: scale(1.05); } }
                  @keyframes kbPanLeft   { from { transform: scale(1.15) translateX(3%); }  to { transform: scale(1.15) translateX(-3%); } }
                  @keyframes kbPanRight  { from { transform: scale(1.15) translateX(-3%); } to { transform: scale(1.15) translateX(3%); } }
                  @keyframes kbPanUp     { from { transform: scale(1.15) translateY(3%); }  to { transform: scale(1.15) translateY(-3%); } }
                  @keyframes kbZoomPanTL { from { transform: scale(1.0) translate(2%, 2%); } to { transform: scale(1.15) translate(-2%, -2%); } }
                  .shot-enter { animation: shotFadeIn 0.6s ease-out forwards; }
                  @keyframes shotFadeIn { from { opacity: 0; } to { opacity: 1; } }

                  /* ====================================================================
                     CSS visibility safety net (Phase 1.2)

                     If the LLM-emitted script sets an element to `opacity:0` inline and
                     then fails to run its GSAP/anime/etc. fade-in (because an optional
                     library threw, the JS sanitizer missed an edge case, or the script
                     never reached the relevant tween), this rule force-reveals the
                     element after 5 seconds. The shot may look stiff, but it ships
                     CONTENT — never a blank canvas (the shot-2-white failure mode).

                     Scope guards:
                       • `[style*="opacity:0"]` matches only INLINE-styled opacity:0 —
                         CSS class-driven opacity (used by deterministic templates) is
                         untouched, because those have known animations.
                       • `[data-allow-hidden]` is the LLM opt-out for elements that
                         legitimately stay hidden (e.g. error-state divs).
                       • `[data-vx-managed]` is set by the dispatcher on any element
                         it knows GSAP / anime / Vivus owns, so legitimate long-delay
                         entrances (e.g. delay:8s) aren't double-revealed by this rule.

                     Use `animation` not `transition`: animations fire unconditionally
                     when the rule applies; transitions require a property change after
                     load and won't help if the JS that would change it never ran.
                  */
                  @keyframes __sd_force_reveal { to { opacity: 1; } }
                  [style*="opacity:0"]:not([data-allow-hidden]):not([data-vx-managed]),
                  [style*="opacity: 0"]:not([data-allow-hidden]):not([data-vx-managed]) {
                    animation: __sd_force_reveal 0.4s linear 5s forwards;
                  }
                </style>

                <script>
                  /* Library-load receipts (Phase 1.3 telemetry). One line per page.
                     Captured by the Playwright `page.on("console")` hook in the
                     render worker and written to shot_telemetry.jsonl. Use the
                     `[SHOT-TELEM]` prefix so grep-by-prefix lifts everything. */
                  (function () {
                    try {
                      var receipt = {
                        gsap:           typeof gsap !== 'undefined',
                        MotionPath:     typeof MotionPathPlugin !== 'undefined',
                        anime:          typeof anime !== 'undefined',
                        RoughNotation:  typeof RoughNotation !== 'undefined',
                        Vivus:          typeof Vivus !== 'undefined',
                        Howler:         typeof Howler !== 'undefined',
                        katex:          typeof katex !== 'undefined',
                        mermaid:        typeof mermaid !== 'undefined',
                        Prism:          typeof Prism !== 'undefined',
                        d3:             typeof d3 !== 'undefined',
                        splitReveal:    typeof splitReveal !== 'undefined'
                      };
                      console.log('[SHOT-TELEM] library_receipts=' + JSON.stringify(receipt));
                    } catch (e) { /* never break the page on telemetry */ }
                  })();
                </script>
              </head>
              <body>
                <!-- World Layer: Camera moves this. Contains Snippets & Character -->
                <div id="camera-wrapper" style="position:absolute; top:0; left:0; width:100%; height:100%; overflow:hidden;">
                  <div id="world-layer" style="position:absolute; top:0; left:0; width:100%; height:100%; transform-origin: center center; will-change: transform;"></div>
                </div>
                
                <!-- UI Layer: Fixed HUD. Contains Captions & Branding -->
                <div id="ui-layer" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:9999;"></div>

                <script>
                  // ========== AI VIDEO HELPER FUNCTIONS ==========

                  // Re-render Math using KaTeX
                  window.renderMath = function(selector) {
                      if (window.renderMathInElement && window.katex) {
                           const el = selector ? (typeof selector === 'string' ? document.querySelector(selector) : selector) : document.body;
                           if(el) {
                               try {
                                   renderMathInElement(el, {
                                      delimiters: [
                                          {left: '$$', right: '$$', display: true},
                                          {left: '$', right: '$', display: false},
                                          {left: '\\\\(', right: '\\\\)', display: false},
                                          {left: '\\\\[', right: '\\\\]', display: true}
                                      ],
                                      throwOnError : false,
                                      strict: false
                                  });
                               } catch (e) {
                                   console.warn('KaTeX render error:', e);
                               }
                           }
                      }
                  };

                  // Highlight Code using Prism
                  window.highlightCode = function() {
                      if (window.Prism) {
                          Prism.highlightAll();
                      }
                  };

                  // SVG drawing animation
                  window.animateSVG = function(svgIdOrEl, duration, callback) {
                    if (!window.Vivus) return;
                    var cb = typeof callback === 'function' ? callback : undefined;
                    function tryInit(attemptsLeft) {
                      // Accept either an element (from scoped resolve) or an ID string.
                      // Pass the element (not ID) to Vivus so it works inside shadow DOM.
                      var el = (typeof svgIdOrEl === 'string')
                          ? document.getElementById(svgIdOrEl)
                          : svgIdOrEl;
                      if (!el) {
                        if (attemptsLeft > 0) {
                          setTimeout(function() { tryInit(attemptsLeft - 1); }, 100);
                        }
                        return;
                      }
                      try {
                        // Pass element directly — Vivus accepts SVG elements
                        new Vivus(el, {
                          duration: duration || 100,
                          type: 'oneByOne',
                          animTimingFunction: Vivus.EASE_OUT
                        }, cb);
                      } catch(e) { console.warn('Vivus init error', e); }
                    }
                    tryInit(10);
                  };

                  // Hand-drawn annotation
                  window.annotate = function(selectorOrEl, options) {
                    if (!window.RoughNotation) return null;
                    const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
                    if (!el) return null;
                    // Backward compatibility: annotate(el, 'underline', 'red', 5)
                    const opts = typeof options === 'object' ? options : {
                      type: options || 'underline',
                      color: arguments[2] || '#dc2626',
                      padding: arguments[3] || 5
                    };
                    try {
                      const annotation = RoughNotation.annotate(el, {
                        type: opts.type || 'underline',
                        color: opts.color || '#dc2626',
                        strokeWidth: opts.strokeWidth || 3,
                        padding: opts.padding || 5,
                        animationDuration: opts.duration || 800
                      });
                      annotation.show();
                      return annotation;
                    } catch(e) { console.warn('annotate error', e); return null; }
                  };

                  // Simple fade in
                  window.fadeIn = function(selector, duration, delay) {
                    try {
                        gsap.fromTo(selector, 
                          {opacity: 0}, 
                          {opacity: 1, duration: duration || 0.5, delay: delay || 0, ease: 'power2.out'}
                        );
                    } catch (e) { console.warn('fadeIn error', e); }
                  };

                  // Typewriter effect (supports useSplit flag for smoother splitReveal-based animation)
                  window.typewriter = function(selectorOrEl, duration, delay, useSplit) {
                    if (useSplit && window.splitReveal) {
                      window.splitReveal(selectorOrEl, { type: 'chars', stagger: (duration || 1) / 50, delay: delay || 0 });
                      return;
                    }
                    const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
                    if (!el) return;
                    const text = el.textContent;
                    el.textContent = '';
                    el.style.opacity = '1';
                    let i = 0;
                    const speed = (duration || 1) * 1000 / Math.max(1, text.length);
                    setTimeout(() => {
                      const interval = setInterval(() => {
                        if (i < text.length) {
                          el.textContent += text.charAt(i);
                          i++;
                        } else {
                          clearInterval(interval);
                        }
                      }, speed);
                    }, (delay || 0) * 1000);
                  };

                  // Pop in with scale
                  window.popIn = function(selector, duration, delay) {
                    try {
                        gsap.fromTo(selector,
                          {opacity: 0, scale: 0.85},
                          {opacity: 1, scale: 1, duration: duration || 0.4, delay: delay || 0, ease: 'back.out(1.7)'}
                        );
                    } catch (e) { console.warn('popIn error', e); }
                  };

                  // Slide up from below
                  window.slideUp = function(selector, duration, delay) {
                    try {
                        gsap.fromTo(selector,
                          {opacity: 0, y: 30},
                          {opacity: 1, y: 0, duration: duration || 0.5, delay: delay || 0, ease: 'power2.out'}
                        );
                    } catch (e) { console.warn('slideUp error', e); }
                  };

                  // Reveal lines with stagger (falls back to splitReveal word-by-word if no .line children)
                  window.revealLines = function(selectorOrEl, staggerDelay) {
                    const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
                    if (!el) return;
                    const lines = el.querySelectorAll('.line');
                    if (lines.length === 0) {
                      if (window.splitReveal) {
                        window.splitReveal(el, { type: 'words', stagger: staggerDelay || 0.05 });
                      } else {
                        window.fadeIn(el, 0.5);
                      }
                      return;
                    }
                    try {
                      gsap.fromTo(lines,
                        {opacity: 0, y: 20},
                        {opacity: 1, y: 0, duration: 0.4, stagger: staggerDelay || 0.3, ease: 'power2.out'}
                      );
                    } catch(e) { console.warn('revealLines error', e); }
                  };

                  // Show text then annotate
                  window.showThenAnnotate = function(textSelector, termSelector, annotationType, annotationColor, textDelay, annotationDelay) {
                    window.fadeIn(textSelector, 0.5, textDelay || 0);
                    setTimeout(() => {
                      window.annotate(termSelector, {
                        type: annotationType || 'underline',
                        color: annotationColor || '#dc2626',
                        duration: 600
                      });
                    }, ((textDelay || 0) + (annotationDelay || 0.8)) * 1000);
                  };

                  // Split text into chars or words and animate with stagger (SplitText alternative)
                  window.splitReveal = function(selectorOrEl, options) {
                    const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
                    if (!el || !window.gsap) return;
                    const opts = Object.assign({
                      type: 'chars', stagger: 0.03, duration: 0.5,
                      delay: 0, ease: 'power2.out', y: 20
                    }, options);
                    const text = el.textContent;
                    if (!text || !text.trim()) return;
                    el.innerHTML = '';
                    el.style.opacity = '1';
                    const allSpans = [];
                    if (opts.type === 'words') {
                      text.split(/\\s+/).forEach(function(word, i, arr) {
                        var span = document.createElement('span');
                        span.style.display = 'inline-block';
                        span.style.whiteSpace = 'nowrap';
                        span.style.opacity = '0';
                        span.textContent = word + (i < arr.length - 1 ? '\u00A0' : '');
                        el.appendChild(span);
                        allSpans.push(span);
                      });
                    } else {
                      // Char mode: group chars of the same word in a nowrap wrapper so
                      // the browser never line-breaks mid-word between inline-block spans.
                      var wordBuf = [];
                      var flushWord = function() {
                        if (!wordBuf.length) return;
                        var wrapper = document.createElement('span');
                        wrapper.style.display = 'inline-block';
                        wrapper.style.whiteSpace = 'nowrap';
                        wordBuf.forEach(function(s) { wrapper.appendChild(s); });
                        el.appendChild(wrapper);
                        wordBuf = [];
                      };
                      text.split('').forEach(function(ch) {
                        if (ch === ' ' || ch === '\u00A0') {
                          flushWord();
                          var sp = document.createElement('span');
                          sp.style.display = 'inline-block';
                          sp.textContent = '\u00A0';
                          el.appendChild(sp);
                        } else {
                          var span = document.createElement('span');
                          span.style.display = 'inline-block';
                          span.style.opacity = '0';
                          span.textContent = ch;
                          wordBuf.push(span);
                          allSpans.push(span);
                        }
                      });
                      flushWord();
                    }
                    try {
                      gsap.fromTo(allSpans,
                        { opacity: 0, y: opts.y },
                        { opacity: 1, y: 0, duration: opts.duration, stagger: opts.stagger, delay: opts.delay, ease: opts.ease }
                      );
                    } catch(e) {
                      // Fallback: just show the text
                      el.textContent = text;
                      el.style.opacity = '1';
                    }
                  };

                  window.sounds = {
                    pop: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
                    click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
                    whoosh: 'https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3',
                    success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'
                  };

                  window.playSound = function(soundName) {
                    if (window.sounds && window.sounds[soundName]) {
                      const audio = new Audio(window.sounds[soundName]);
                      audio.volume = 0.5;
                      audio.play().catch(e => console.log('Sound play failed:', e));
                    }
                  };

                  // ── Diagram Templates (auto-render data-diagram elements) ──
                  window.initDiagramTemplates = function(scope) {
                    var root = scope || document;
                    var els = root.querySelectorAll('[data-diagram]');
                    els.forEach(function(el) {
                      if (el.getAttribute('data-rendered') === 'true') return;
                      try {
                        var type = el.getAttribute('data-diagram');
                        var pj = function(s, f) { try { return JSON.parse(s); } catch(e) { return f; } };
                        var gc = function(n, f) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f; };
                        var primary = gc('--primary-color', '#2563eb');
                        var textColor = gc('--text-color', '#1e293b');
                        var animIn = function(nodes, opts) {
                          if (!window.gsap) { Array.from(nodes).forEach(function(n){ n.style.opacity='1'; }); return; }
                          try { gsap.fromTo(nodes, {opacity:0,y:opts.y||20}, {opacity:1,y:0,duration:opts.dur||0.5,stagger:opts.stg||0.15,delay:opts.del||0.3,ease:'power2.out'}); }
                          catch(e) { Array.from(nodes).forEach(function(n){ n.style.opacity='1'; }); }
                        };
                        if (type === 'data-chart') {
                          var vals = pj(el.getAttribute('data-values'), []);
                          var ctype = el.getAttribute('data-type') || 'bar';
                          if (ctype === 'bar' && vals.length) {
                            var mx = Math.max.apply(null, vals.map(function(v){return v.value||0;})) || 1;
                            var h = '<div style="display:flex;align-items:flex-end;gap:12px;height:200px;padding:20px;justify-content:center">';
                            vals.forEach(function(v) {
                              var bh = Math.max(8, (v.value/mx)*160);
                              h += '<div class="dg-bar" style="display:flex;flex-direction:column;align-items:center;opacity:0">'
                                + '<div style="font-size:14px;font-weight:700;color:'+textColor+';margin-bottom:4px">'+v.value+'</div>'
                                + '<div style="width:48px;height:0;background:'+primary+';border-radius:4px 4px 0 0" data-th="'+bh+'"></div>'
                                + '<div style="font-size:12px;color:'+textColor+'99;margin-top:6px">'+( v.label||'')+'</div></div>';
                            });
                            h += '</div>';
                            el.innerHTML = h;
                            if (window.gsap) {
                              el.querySelectorAll('[data-th]').forEach(function(b,i){ gsap.to(b,{height:parseInt(b.getAttribute('data-th')),duration:0.6,delay:0.3+i*0.1,ease:'power2.out'}); });
                              gsap.to(el.querySelectorAll('.dg-bar'), {opacity:1,duration:0.3,stagger:0.08,delay:0.2});
                            }
                          }
                        }
                        // More diagram types are handled client-side via diagram-templates.ts
                        el.setAttribute('data-rendered', 'true');
                      } catch(e) { console.warn('Diagram template error:', e); }
                    });
                  };

                  // Render Mermaid
                  window.renderMermaid = function(selector) {
                      if (window.mermaid) {
                          try {
                              mermaid.init(undefined, selector ? document.querySelectorAll(selector) : document.querySelectorAll('.mermaid'));
                          } catch (e) {
                              console.error('Mermaid render error:', e);
                          }
                      }
                  };

                  // Initialize
                  window.addEventListener('load', () => {
                      if(window.gsap) {
                         if(window.MotionPathPlugin) gsap.registerPlugin(MotionPathPlugin);
                         if(window.MorphSVGPlugin && typeof window.MorphSVGPlugin.version === 'string') {
                             try { gsap.registerPlugin(MorphSVGPlugin); } catch(e) { console.warn('MorphSVG registration failed', e); }
                         }
                      }

                      if (window.RoughNotation && !window.RoughNotation.annotateAll) {
                          window.RoughNotation.annotateAll = function(annotations) {
                              if (Array.isArray(annotations) && window.RoughNotation.annotationGroup) {
                                   const group = window.RoughNotation.annotationGroup(annotations);
                                   group.show();
                              } else if (Array.isArray(annotations)) {
                                   annotations.forEach(a => a.show && a.show());
                              }
                          };
                      }

                      if(window.mermaid) mermaid.initialize({startOnLoad:true});
                      if(window.renderMathInElement && window.katex) window.renderMath();
                      if(window.Prism) window.highlightCode();
                      if(window.initDiagramTemplates) window.initDiagramTemplates();
                      
                      // Pause global timeline for frame rendering
                      if (window.gsap) {
                          gsap.ticker.remove(gsap.ticker.tick);
                          gsap.globalTimeline.pause();
                      }

                      // Monkey-patch RoughNotation to register all annotations
                      // and record the GSAP time when show() is called,
                      // so we can do time-aware show/hide during frame rendering.
                      window.__registeredAnnotations = [];
                      window.__annotationShowTimes = new Map();
                      if (window.RoughNotation && window.RoughNotation.annotate) {
                          const _origAnnotate = window.RoughNotation.annotate;
                          window.RoughNotation.annotate = function(el, opts) {
                              // Force animation duration to 0 so show() completes instantly
                              // (we render frame-by-frame, async animations won't finish before screenshot)
                              const patchedOpts = Object.assign({}, opts, { animationDuration: 0 });
                              const a = _origAnnotate(el, patchedOpts);
                              const _origShow = a.show.bind(a);
                              a.show = function() {
                                  // Record the GSAP time when show() is triggered
                                  const gsapTime = (window.gsap && gsap.globalTimeline)
                                      ? gsap.globalTimeline.totalTime() : 0;
                                  window.__annotationShowTimes.set(a, gsapTime);
                                  return _origShow();
                              };
                              window.__registeredAnnotations.push(a);
                              return a;
                          };
                      }
                  });

                  // ── Shadow DOM CSS ──
                  // All styles that must be injected into each shadow root.
                  // Shadow DOM is style-isolated: global <style> rules do NOT apply inside.
                  // This must match html-processor.ts getBaseStyles() + getKenBurnsStyles().
                  window.__SHADOW_CSS = `
                    /* Fonts loaded via <link> in __updateSnippets — not @import (doesn't work reliably in shadow DOM) */

                    :host {
                      --text-color: #1e293b;
                      --text-secondary: #475569;
                      --primary-color: #2563eb;
                      --accent-color: #f59e0b;
                      --background-color: #ffffff;
                    }

                    /* NOTE: Do NOT force opacity:1 !important here — it breaks GSAP
                       animations that use opacity:0 as their starting state, causing
                       elements to appear before their animated reveal. */

                    * { box-sizing: border-box; }
                    html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; font-family: 'Inter', 'Noto Sans', sans-serif; color: var(--text-color); }

                    /* Fix word-smashing: LLM sometimes wraps each word in inline-block
                       spans without whitespace between them. This ensures a gap. */
                    span[style*="inline-block"] + span[style*="inline-block"] { margin-left: 0.25em; }
                    div[style*="inline-block"] + div[style*="inline-block"] { margin-left: 0.25em; }
                    /* Also catch class-based word wrappers */
                    [class*="word"] { display: inline-block; margin-right: 0.2em; }
                    .word-wrapper, .word-wrap, .word { margin-right: 0.2em; }

                    /* Prevent text from overflowing — shrink to fit, never break mid-word */
                    h1, h2, h3, .text-display, .text-h2 {
                      max-width: 95vw; word-break: keep-all; overflow-wrap: normal;
                      padding-left: 3%; padding-right: 3%;
                      /* Scale down oversized text to fit viewport width */
                      max-inline-size: 95vw;
                    }

                    /* Default centering for content-wrapper — centers even if HTML lacks .full-screen-center */
                    #content-wrapper {
                      display: flex; flex-direction: column;
                      align-items: center; justify-content: center;
                      min-height: 100%; width: 100%;
                      box-sizing: border-box;
                    }

                    /* Cutout asset images */
                    .generated-image[data-cutout="true"] {
                      background: transparent;
                      mix-blend-mode: normal;
                      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));
                    }

                    /* SVG Maps */
                    .map-svg { display: block; margin: 0 auto; }
                    .map-svg path { transition: fill 0.3s ease; }

                    /* Typography */
                    .text-display { font-family: 'Montserrat', 'Noto Sans', sans-serif; font-size: 64px; font-weight: 800; line-height: 1.1; }
                    .text-h2 { font-family: 'Montserrat', 'Noto Sans', sans-serif; font-size: 48px; font-weight: 700; margin-bottom: 16px; }
                    .text-body { font-family: 'Inter', 'Noto Sans', sans-serif; font-size: 28px; font-weight: 400; line-height: 1.5; }
                    .text-label { font-family: 'Fira Code', monospace; font-size: 18px; text-transform: uppercase; letter-spacing: 0.1em; }

                    /* Layout */
                    .full-screen-center {
                      width: 100%; height: 100%;
                      display: flex; flex-direction: column;
                      align-items: center; justify-content: center;
                      text-align: center; padding: 60px 80px;
                    }
                    .highlight {
                      background: linear-gradient(120deg, rgba(255, 226, 89, 0.6) 0%, rgba(255, 233, 148, 0.4) 100%);
                      padding: 0 4px; border-radius: 4px;
                    }
                    .emphasis { color: var(--primary-color); font-weight: bold; }
                    .mermaid { display: flex; justify-content: center; width: 100%; margin: 20px auto; }
                    .layout-split {
                      display: grid; grid-template-columns: 1fr 1fr; gap: 60px;
                      width: 90%; max-width: 1700px; align-items: center;
                    }
                    pre { white-space: pre-wrap; word-wrap: break-word; }

                    /* ===== KEN BURNS CINEMATIC ENGINE ===== */
                    .image-hero {
                      position: relative; width: 100%; height: 100%; overflow: hidden;
                    }
                    .image-hero > img {
                      position: absolute; inset: 0; width: 100%; height: 100%;
                      object-fit: cover; transform-origin: center; will-change: transform;
                      animation-duration: var(--kb-duration, 12s);
                      animation-timing-function: ease-in-out; animation-fill-mode: both;
                    }
                    .image-text-overlay {
                      position: absolute; inset: 0; display: flex; flex-direction: column;
                      justify-content: flex-end; padding: 80px 100px; z-index: 2;
                    }
                    .image-text-overlay > * { position: relative; z-index: 1; }
                    .image-text-overlay.gradient-bottom::before,
                    .image-text-overlay:not([class*="gradient-"])::before {
                      content: ""; position: absolute; inset: 0;
                      background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 40%, transparent 70%);
                      pointer-events: none; z-index: 0;
                    }
                    .image-text-overlay.gradient-full::before {
                      content: ""; position: absolute; inset: 0;
                      background: rgba(0,0,0,0.45); pointer-events: none; z-index: 0;
                    }
                    .image-text-overlay.gradient-center {
                      justify-content: center; align-items: center; text-align: center;
                    }
                    .image-text-overlay.gradient-center::before {
                      content: ""; position: absolute; inset: 0;
                      background: radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 70%);
                      pointer-events: none; z-index: 0;
                    }
                    .image-text-overlay h1, .image-text-overlay .hero-title {
                      font-family: 'Montserrat', sans-serif; font-size: 64px; font-weight: 800;
                      color: #fff; line-height: 1.1; margin: 0 0 16px 0;
                      text-shadow: 0 2px 20px rgba(0,0,0,0.3);
                    }
                    .image-text-overlay p, .image-text-overlay .hero-subtitle {
                      font-family: 'Inter', sans-serif; font-size: 28px; color: rgba(255,255,255,0.9);
                      line-height: 1.4; margin: 0; max-width: 800px;
                    }
                    /* VIDEO_HERO: Full-screen stock video background */
                    .video-hero { position: relative; width: 100%; height: 100%; overflow: hidden; }
                    .video-hero > video, .video-hero > .stock-video {
                        position: absolute; inset: 0; width: 100%; height: 100%;
                        object-fit: cover; z-index: 0;
                    }
                    .stock-video { object-fit: cover; width: 100%; height: 100%; }

                    .image-split-layout {
                      display: grid; grid-template-columns: 1fr 1fr;
                      width: 100%; height: 100%; overflow: hidden;
                    }
                    .image-split-layout .split-image { position: relative; overflow: hidden; }
                    .image-split-layout .split-image img {
                      width: 100%; height: 100%; object-fit: cover; will-change: transform;
                      animation-duration: var(--kb-duration, 12s);
                      animation-timing-function: ease-in-out; animation-fill-mode: both;
                    }
                    .image-split-layout .split-text {
                      display: flex; flex-direction: column;
                      justify-content: center; padding: 60px 80px;
                    }

                    /* Portrait (9:16) responsive overrides */
                    @media (max-width: 1100px) {
                      .full-screen-center { padding: 40px; }
                      .text-display { font-size: 48px; }
                      .text-h2 { font-size: 36px; }
                      .text-body { font-size: 24px; }
                      .layout-split { grid-template-columns: 1fr; gap: 30px; }
                      .image-split-layout { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
                      .image-split-layout .split-text { padding: 30px 40px; }
                      .image-text-overlay { justify-content: center; align-items: center; text-align: center; padding: 40px; }
                      .image-text-overlay::before { background: rgba(0,0,0,0.5) !important; }
                      .image-text-overlay > * { background: rgba(0,0,0,0.65); padding: 20px 32px; border-radius: 12px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
                      .image-text-overlay > *::before { display: none; }
                      .image-text-overlay h1, .image-text-overlay .hero-title { font-size: 48px; text-align: center; }
                      .image-text-overlay p, .image-text-overlay .hero-subtitle { font-size: 24px; max-width: 100%; text-align: center; }
                      .lower-third { bottom: 80px; left: 40px; }
                    }

                    .lower-third {
                      position: absolute; bottom: 120px; left: 100px;
                      display: flex; align-items: stretch;
                      animation: ltSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                      z-index: 20;
                    }
                    .lower-third .lt-accent-bar {
                      width: 6px; background: linear-gradient(180deg, #3b82f6, #8b5cf6);
                      border-radius: 3px 0 0 3px;
                    }
                    .lower-third .lt-content {
                      background: rgba(0,0,0,0.85); padding: 16px 32px;
                      border-radius: 0 8px 8px 0; display: flex; flex-direction: column; gap: 4px;
                    }
                    .lower-third .lt-label {
                      font-family: 'Fira Code', monospace; font-size: 12px;
                      text-transform: uppercase; letter-spacing: 0.15em; color: #3b82f6; font-weight: 600;
                    }
                    .lower-third .lt-text {
                      font-family: 'Inter', sans-serif; font-size: 24px; color: #fff; font-weight: 600;
                    }
                    @keyframes ltSlideIn {
                      from { transform: translateX(-40px); opacity: 0; }
                      to   { transform: translateX(0); opacity: 1; }
                    }
                    .annotation-map-container { position: relative; width: 100%; height: 100%; overflow: hidden; }
                    .annotation-map-container .annotation-map-bg {
                      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                      object-fit: cover; will-change: transform;
                      animation-duration: var(--kb-duration, 12s);
                      animation-timing-function: ease-in-out; animation-fill-mode: both;
                    }
                    .annotation-overlay {
                      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                      pointer-events: none; z-index: 5;
                    }
                    .process-flow {
                      display: flex; flex-direction: column;
                      align-items: center; width: 80%; max-width: 960px;
                    }
                    .process-node {
                      display: flex; align-items: center; gap: 24px;
                      background: var(--card-bg, rgba(30,41,59,0.6));
                      border: 2px solid var(--primary-color, #3b82f6);
                      border-radius: 12px; padding: 20px 32px; width: 100%;
                    }
                    .node-num {
                      width: 52px; height: 52px; border-radius: 50%;
                      background: var(--primary-color, #3b82f6); color: #fff;
                      font-size: 24px; font-weight: 800; flex-shrink: 0;
                      display: flex; align-items: center; justify-content: center;
                      font-family: 'Montserrat', sans-serif;
                    }
                    .node-body { display: flex; flex-direction: column; gap: 4px; }
                    .node-title {
                      font-size: 22px; font-weight: 700;
                      font-family: 'Montserrat', sans-serif; color: var(--text-color, #fff);
                    }
                    .node-desc {
                      font-size: 16px; font-family: 'Inter', sans-serif;
                      color: var(--text-secondary, #94a3b8);
                    }
                    .process-connector {
                      width: 20px; height: 40px; flex-shrink: 0;
                      color: var(--primary-color, #3b82f6);
                    }
                    .equation-build-row {
                      display: flex; align-items: center; justify-content: center;
                      flex-wrap: wrap; gap: 8px; margin: 48px 0 32px;
                    }
                    .equation-build-row .eq-term,
                    .equation-build-row .eq-sep {
                      display: inline-flex; align-items: center; font-size: 3.5rem;
                    }
                    .equation-build-row .eq-sep { font-size: 3rem; margin: 0 4px; }

                    /* Ken Burns keyframes */
                    .kb-zoom-in     { animation-name: kbZoomIn; }
                    .kb-zoom-out    { animation-name: kbZoomOut; }
                    .kb-pan-left    { animation-name: kbPanLeft; }
                    .kb-pan-right   { animation-name: kbPanRight; }
                    .kb-pan-up      { animation-name: kbPanUp; }
                    .kb-zoom-pan-tl { animation-name: kbZoomPanTL; }
                    @keyframes kbZoomIn    { from { transform: scale(1.0); }  to { transform: scale(1.15); } }
                    @keyframes kbZoomOut   { from { transform: scale(1.20); } to { transform: scale(1.05); } }
                    @keyframes kbPanLeft   { from { transform: scale(1.15) translateX(3%); }  to { transform: scale(1.15) translateX(-3%); } }
                    @keyframes kbPanRight  { from { transform: scale(1.15) translateX(-3%); } to { transform: scale(1.15) translateX(3%); } }
                    @keyframes kbPanUp     { from { transform: scale(1.15) translateY(3%); }  to { transform: scale(1.15) translateY(-3%); } }
                    @keyframes kbZoomPanTL { from { transform: scale(1.0) translate(2%, 2%); } to { transform: scale(1.15) translate(-2%, -2%); } }
                    .shot-enter { animation: shotFadeIn 0.6s ease-out forwards; }
                    @keyframes shotFadeIn { from { opacity: 0; } to { opacity: 1; } }
                  `;
                </script>
              </body>
            </html>
            """


def build_harness_html(background_color: str) -> str:
    """Return the harness HTML with REPLACE_BG substituted for the supplied background colour.

    background_color: any CSS colour value (hex, rgb(), named). Substituted into the html, body { background:REPLACE_BG; ... } rule.
    """
    return HARNESS_TEMPLATE.replace('REPLACE_BG', background_color)
