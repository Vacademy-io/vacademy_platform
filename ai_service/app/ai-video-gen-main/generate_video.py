import base64
import json
import math
import os
import shutil
import sys
import re
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import argparse


from moviepy.audio.io.AudioFileClip import AudioFileClip
from moviepy.video.io.ImageSequenceClip import ImageSequenceClip
from moviepy.video.io.VideoFileClip import VideoFileClip
from moviepy.video.compositing.CompositeVideoClip import CompositeVideoClip
from playwright.sync_api import sync_playwright


def _html_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def _prepare_page(page, width: int, height: int, background_color: str = "#000") -> None:
    """Initialize a blank page with desired viewport and helper updaters for snippets/captions."""
    libs = f"file://{Path.cwd()}/assets/libs"
    page.set_viewport_size({"width": width, "height": height})
    # Install updater that creates/removes/positions shadow-root wrapped snippets and scales to fit.


    page.add_init_script(
        """
        window.__updateCharacter = (state) => {
          let container = document.getElementById('character-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'character-container';
            container.style.position = 'absolute';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.pointerEvents = 'none';
            container.style.userSelect = 'none';
            container.style.zIndex = '10';
            container.style.zIndex = '10';
            const world = document.getElementById('world-layer') || document.body;
            world.appendChild(container);

            const pose = document.createElement('img');
            pose.id = 'char-pose';
            pose.style.position = 'absolute';
            pose.style.left = '0';
            pose.style.top = '0';
            pose.style.transformOrigin = 'top left';
            pose.style.willChange = 'transform';
            container.appendChild(pose);

            const mouth = document.createElement('img');
            mouth.id = 'char-mouth';
            mouth.style.position = 'absolute';
            mouth.style.transformOrigin = 'top left';
            mouth.style.willChange = 'transform';
            container.appendChild(mouth);
          }

          if (!state || !state.visible) {
            container.style.display = 'none';
            return;
          }

          container.style.display = 'block';
          if (typeof state.zIndex !== 'undefined') {
            container.style.zIndex = String(state.zIndex);
          }

          const poseImg = document.getElementById('char-pose');
          const mouthImg = document.getElementById('char-mouth');

          if (state.poseSrc && poseImg.getAttribute('data-src') !== state.poseSrc) {
            poseImg.src = state.poseSrc;
            poseImg.setAttribute('data-src', state.poseSrc);
          }
          if (state.mouthSrc && mouthImg.getAttribute('data-src') !== state.mouthSrc) {
            mouthImg.src = state.mouthSrc;
            mouthImg.setAttribute('data-src', state.mouthSrc);
          }

          poseImg.style.left = (state.poseX || 0) + 'px';
          poseImg.style.top = (state.poseY || 0) + 'px';
          poseImg.style.transform = `scale(${state.poseScale || 1})`;
          poseImg.style.display = 'block';

          mouthImg.style.left = (state.mouthX || 0) + 'px';
          mouthImg.style.top = (state.mouthY || 0) + 'px';
          mouthImg.style.transform = `scale(${state.mouthScale || 1})`;
          mouthImg.style.display = state.mouthSrc ? 'block' : 'none';
        };
        """
    )


    
    # Camera updater
    page.add_init_script(
        """
        window.__updateCamera = (state) => {
            const world = document.getElementById('world-layer');
            if (!world) return;
            if (!state) {
                world.style.transform = 'translate(0px, 0px) scale(1)';
                return;
            }
            // state: { x, y, scale }
            // Transform origin is center center. 
            // To zoom into (x, y), we need to translate the world such that (x,y) moves to center, then scale.
            // Simplified: We assume x,y are offsets from center (0,0).
            // Actually, let's keep it simple: translate then scale.
            // transform: translate(dx, dy) scale(s)
            
            const x = state.x || 0;
            const y = state.y || 0;
            const s = state.scale || 1;
            
            // To make (x,y) the new center:
            // translate = -x, -y
            // But we might want smooth drift. state.x/y should be computed offsets.
            // Let's assume input state.x/y are in pixels (displacement from center).
            
            world.style.transform = `translate(${-x}px, ${-y}px) scale(${s})`;
        };
        """
    )

    # Base content with background color. HTML overlays are transparent.
    # We inject educational libraries: KaTeX, Prism, Mermaid, GSAP, Vivus, Rough Notation, Howler
    html_content = """
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
                <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MorphSVGPlugin.min.js"></script>
                <script>
                    if (typeof window.MorphSVGPlugin === 'undefined') {
                        window.MorphSVGPlugin = { version: '3.12.5', name: 'MorphSVGPlugin', default: {} };
                    }
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
                    animation-timing-function: linear; animation-fill-mode: both;
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
                    animation-timing-function: linear; animation-fill-mode: both;
                  }
                  .image-split-layout .split-text { display: flex; flex-direction: column; justify-content: center; padding: 60px 80px; }

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
                  .annotation-map-container .annotation-map-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; will-change: transform; animation-duration: var(--kb-duration, 12s); animation-timing-function: linear; animation-fill-mode: both; }
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
                </style>
              </head>
              <body>
                <!-- World Layer: Camera moves this. Contains Snippets & Character -->
                <div id="world-layer" style="position:absolute; top:0; left:0; width:100%; height:100%; transform-origin: center center; will-change: transform;"></div>
                
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
                  window.animateSVG = function(svgId, duration, callback) {
                    if (!window.Vivus) return;
                    var cb = typeof callback === 'function' ? callback : undefined;
                    function tryInit(attemptsLeft) {
                      var el = typeof svgId === 'string' ? document.getElementById(svgId) : svgId;
                      if (!el) {
                        if (attemptsLeft > 0) {
                          setTimeout(function() { tryInit(attemptsLeft - 1); }, 100);
                        }
                        return;
                      }
                      try {
                        new Vivus(svgId, {
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
                    const units = opts.type === 'words' ? text.split(/\\s+/) : text.split('');
                    units.forEach(function(unit, i) {
                      var span = document.createElement('span');
                      span.style.display = 'inline-block';
                      span.style.opacity = '0';
                      span.textContent = unit + (opts.type === 'words' && i < units.length - 1 ? '\u00A0' : '');
                      el.appendChild(span);
                    });
                    try {
                      gsap.fromTo(el.children,
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
                              const a = _origAnnotate(el, opts);
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

                    /* Ensure content visible — GSAP timeline seeking doesn't reliably
                       update computed styles inside shadow DOM. This may show elements
                       that should be hidden at certain timestamps, but it's better than
                       having all content invisible. */
                    * { opacity: 1 !important; visibility: visible !important; }

                    * { box-sizing: border-box; }
                    html, body { margin:0; padding:0; width:100%; height:100%; font-family: 'Inter', 'Noto Sans', sans-serif; color: var(--text-color); }

                    /* Default centering for content-wrapper — centers even if HTML lacks .full-screen-center */
                    #content-wrapper {
                      display: flex; flex-direction: column;
                      align-items: center; justify-content: center;
                      min-height: 100%; width: 100%;
                      padding-bottom: 12%;
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
                      animation-timing-function: linear; animation-fill-mode: both;
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
                      animation-timing-function: linear; animation-fill-mode: both;
                    }
                    .image-split-layout .split-text {
                      display: flex; flex-direction: column;
                      justify-content: center; padding: 60px 80px;
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
                      animation-timing-function: linear; animation-fill-mode: both;
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
            """.replace("REPLACE_BG", background_color)
    
    temp_html_path = Path.cwd() / ".render_page.html"
    temp_html_path.write_text(html_content, encoding="utf-8")
    page.goto(f"file://{temp_html_path}", wait_until="domcontentloaded")

    # Replace background color token
    # page.evaluate("(bg) => { document.querySelector('style').textContent = document.querySelector('style').textContent.replace('REPLACE_BG', bg); }", background_color)
    # Ensure functions exist on current document as well
    page.evaluate(
        """
        () => {
          if (typeof window.__updateSnippets !== 'function' || typeof window.__updateCaption !== 'function') {
            window.__activeSnippets = new Map();
            window.__updateSnippets = (entries) => {
              const activeIds = new Set(entries.map(e => e.id));
              for (const [id, host] of Array.from(window.__activeSnippets.entries())) {
                if (!activeIds.has(id)) {
                  try { host.remove(); } catch (e) {}
                  window.__activeSnippets.delete(id);
                }
              }
              for (const e of entries) {
                let host = window.__activeSnippets.get(e.id);
                if (!host) {
                  host = document.createElement('div');
                  host.id = e.id;
                  host.style.position = 'absolute';
                  host.style.overflow = 'visible'; // Allow annotations to flow outside
                  host.style.pointerEvents = 'none';
                  host.style.background = 'transparent';
                  const world = document.getElementById('world-layer') || document.body;
                  world.appendChild(host);
                  const root = host.attachShadow({ mode: 'open' });
                  const wrapper = document.createElement('div');
                  wrapper.id = 'content-wrapper';
                  // Fill the host container — let CSS classes like .full-screen-center handle centering
                  wrapper.style.width = '100%';
                  wrapper.style.height = '100%';
                  wrapper.style.overflow = 'visible'; // Allow Rough Notation SVGs to extend outside elements

                  // Inject ALL CSS into Shadow DOM (shadow DOM is style-isolated)
                  // Google Fonts must be a <link> (not @import in <style>) for shadow DOM
                  const fontLink = document.createElement('link');
                  fontLink.rel = 'stylesheet';
                  fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&family=Fira+Code:wght@400;500;600&family=Noto+Sans:wght@400;500;600;700&display=swap';
                  root.appendChild(fontLink);

                  const shadowStyle = document.createElement('style');
                  shadowStyle.textContent = window.__SHADOW_CSS || '';
                  root.appendChild(shadowStyle);

                  const katexCss = document.createElement('link');
                  katexCss.rel = 'stylesheet';
                  katexCss.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';

                  const prismCss = document.createElement('link');
                  prismCss.rel = 'stylesheet';
                  prismCss.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';

                  root.appendChild(katexCss);
                  root.appendChild(prismCss);

                  // Pre-process HTML before injection (match client's processHtmlContent)
                  let processedHtml = e.html;

                  // 1. Ken Burns: inject kb-{motion} CSS class from data-ken-burns attribute
                  processedHtml = processedHtml.replace(
                    /(<img[^>]*)\\bdata-ken-burns=["']([\\w-]+)["']([^>]*>)/gi,
                    (match, before, motion, after) => {
                      const className = 'kb-' + motion;
                      if (/class=["']/.test(before)) {
                        return before.replace(/class=["']([^"']*)["']/, 'class="$1 ' + className + '"')
                          + 'data-ken-burns="' + motion + '"' + after;
                      }
                      return before + ' class="' + className + '" data-ken-burns="' + motion + '"' + after;
                    }
                  );

                  // 2. placeholder.png: replace with transparent 1x1 GIF
                  if (processedHtml.includes('placeholder.png')) {
                    const TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                    processedHtml = processedHtml.replace(/src=['"]placeholder\\.png['"]/g, 'src="' + TRANSPARENT + '"');
                    processedHtml = '<style>.generated-image{opacity:0!important}.image-hero{background:linear-gradient(160deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)!important}</style>' + processedHtml;
                  }

                  wrapper.innerHTML = processedHtml;
                  root.appendChild(wrapper);
                  window.__activeSnippets.set(e.id, host);

                  // Trigger KaTeX for Math
                  if (window.renderMathInElement) {
                      window.renderMathInElement(wrapper, {
                          delimiters: [
                              {left: '$$', right: '$$', display: true},
                              {left: '$', right: '$', display: false},
                              {left: '\\(', right: '\\)', display: false},
                              {left: '\\[', right: '\\]', display: true}
                          ],
                          throwOnError: false,
                          strict: false
                      });
                  }

                  // Manually activate scripts
                  // Manually activate scripts with Scoped GSAP Proxy
                  const scripts = wrapper.querySelectorAll('script');
                  scripts.forEach(oldScript => {
                      const newScript = document.createElement('script');
                      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                      
                      // Wrap content in IIFE with scoped GSAP
                      const originalCode = oldScript.textContent;
                      const scopedCode = `
                        (function(scope) {
                            // Helper to resolve selectors in this shadow root
                            const resolve = (s) => {
                                const el = (typeof s === 'string' ? scope.querySelector(s) : s);
                                if (!el && typeof s === 'string') console.warn('Scoped resolve failed for:', s);
                                return el;
                            };
                            const resolveAll = (s) => (typeof s === 'string' ? scope.querySelectorAll(s) : s);

                            // Proxy global helpers to use scoped resolution
                            const annotate = (target, opts) => {
                                console.log('Proxy annotate:', target, opts);
                                try { window.annotate(resolve(target), opts); } catch(e) { console.error('Annotate error:', e); }
                            };
                            const typewriter = (target, dur, del) => window.typewriter(resolve(target), dur, del);
                            const fadeIn = (target, dur, del) => window.fadeIn(resolve(target), dur, del);
                            const popIn = (target, dur, del) => window.popIn(resolve(target), dur, del);
                            const slideUp = (target, dur, del) => window.slideUp(resolve(target), dur, del);
                            const revealLines = (target, stag) => window.revealLines(resolve(target), stag);
                            const showThenAnnotate = (txt, term, type, col, txtDel, annDel) => {
                                console.log('Proxy showThenAnnotate:', txt, term);
                                window.showThenAnnotate(resolve(txt), resolve(term), type, col, txtDel, annDel);
                            };
                            const animateSVG = (id, dur, cb) => window.animateSVG(resolve(id) || id, dur, cb);

                            // Creator of scoped GSAP instance
                            const createScopedGsap = () => {
                                const g = { ...window.gsap }; // shallow clone
                                
                                const resolveGsap = (target) => {
                                    if (typeof target === 'string') {
                                        return Array.from(scope.querySelectorAll(target));
                                    }
                                    return target;
                                };

                                g.to = (target, vars) => window.gsap.to(resolveGsap(target), vars);
                                g.from = (target, vars) => window.gsap.from(resolveGsap(target), vars);
                                g.fromTo = (target, f, t) => window.gsap.fromTo(resolveGsap(target), f, t);
                                g.set = (target, vars) => window.gsap.set(resolveGsap(target), vars);
                                g.timeline = (vars) => {
                                    const tl = window.gsap.timeline(vars);
                                    const explicitProxy = (tlInstance) => {
                                        const originalTo = tlInstance.to.bind(tlInstance);
                                        const originalFrom = tlInstance.from.bind(tlInstance);
                                        const originalFromTo = tlInstance.fromTo.bind(tlInstance);
                                        const originalSet = tlInstance.set.bind(tlInstance);
                                        
                                        tlInstance.to = (t, v, p) => { originalTo(resolveGsap(t), v, p); return tlInstance; };
                                        tlInstance.from = (t, v, p) => { originalFrom(resolveGsap(t), v, p); return tlInstance; };
                                        tlInstance.fromTo = (t, f, to, p) => { originalFromTo(resolveGsap(t), f, to, p); return tlInstance; };
                                        tlInstance.set = (t, v, p) => { originalSet(resolveGsap(t), v, p); return tlInstance; };
                                        return tlInstance;
                                    };
                                    return explicitProxy(tl);
                                };
                                return g;
                            };

                            const gsap = createScopedGsap();
                            
                            try {
                                ${originalCode}
                            } catch (e) {
                                console.error("Script execution error in snippet:", e);
                            }
                        })(document.getElementById('${e.id}').shadowRoot);
                      `;
                      
                      newScript.textContent = scopedCode;
                      oldScript.parentNode.replaceChild(newScript, oldScript);
                  });

                  // Force-show all registered Rough Notation annotations after layout settles
                  // Use double-rAF to ensure layout is computed before annotations measure positions
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      if (window.__registeredAnnotations && window.__registeredAnnotations.length > 0) {
                        window.__registeredAnnotations.forEach(a => {
                          try {
                            if (a && a.isShowing) {
                              // Already showing but may have wrong position — hide and re-show
                              a.hide();
                              a.show();
                            } else if (a && !a.isShowing) {
                              a.show();
                            }
                          } catch(e) {}
                        });
                      }
                    });
                  });

                  // Trigger Mermaid (Robust)
                  const promises = [];
                  if (window.mermaid) {
                      if (!window.mermaidInitialized) {
                          window.mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
                          window.mermaidInitialized = true;
                      }
                      const nodes = wrapper.querySelectorAll('.mermaid, pre > code.language-mermaid, div.mermaid');
                      const p = Promise.all(Array.from(nodes).map(async (el, index) => {
                          const id = 'mermaid-' + e.id + '-' + index + '-' + Math.round(Math.random() * 10000);
                          var targetContainer = el; // Use var to ensure function scope hoisting awareness
                          try {
                              let graphDefinition = el.textContent.trim();
                              if (!graphDefinition) return;
                              
                              if (el.tagName.toLowerCase() === 'code' && el.parentElement.tagName.toLowerCase() === 'pre') {
                                  const div = document.createElement('div');
                                  div.id = id;
                                  div.className = 'mermaid-diagram';
                                  div.style.display = 'flex';
                                  div.style.justifyContent = 'center';
                                  el.parentElement.replaceWith(div);
                              } else {
                                  el.id = id;
                              }
                              
                              // JSON is cleaned, disabling potentially dangerous regex
                              // graphDefinition = graphDefinition.replace(/[^\\x00-\\x7F]+/g, ''); 
                              
                              const { svg } = await window.mermaid.render(id, graphDefinition);
                              const successContainer = document.getElementById(id);
                              if (successContainer) successContainer.innerHTML = svg;
                          } catch (err) {
                              console.error('Mermaid render error for id ' + id, err);
                              const errorContainer = document.getElementById(id);
                              if (errorContainer) {
                                errorContainer.innerHTML = '<div style="color:red;border:1px solid red;padding:10px;background:rgba(0,0,0,0.8);font-size:12px;"> Mermaid Error: ' + err.message + '</div>';
                              }
                          }
                      }));
                      promises.push(p);
                  }

                  // Trigger Prism
                  if (window.Prism) {
                      window.Prism.highlightAllUnder(wrapper);
                  }

                  // Trigger diagram templates inside this shadow root's wrapper
                  if (window.initDiagramTemplates) {
                      window.initDiagramTemplates(wrapper);
                  }

                  // Wait for async rendering (Mermaid etc.) before proceeding
                  Promise.all(promises).catch(() => {});
                }
                host.style.left = (e.x | 0) + 'px';
                host.style.top = (e.y | 0) + 'px';
                host.style.width = (e.w | 0) + 'px';
                host.style.height = (e.h | 0) + 'px';
                if (typeof e.z !== 'undefined') host.style.zIndex = String(e.z);
              }
            };

            // Define caption updater fallback as well
            window.__updateCaption = (entryOrNull) => {
              const id = 'caption';
              if (!entryOrNull) {
                const host = window.__activeSnippets.get(id);
                if (host) { try { host.remove(); } catch (e) {}; window.__activeSnippets.delete(id); }
                return;
              }
              const e = entryOrNull;
              let host = window.__activeSnippets.get(id);
              if (!host) {
                host = document.createElement('div');
                host.id = id;
                host.style.position = 'absolute';
                host.style.overflow = 'hidden';
                host.style.pointerEvents = 'none';
                host.style.background = 'transparent';
                const ui = document.getElementById('ui-layer') || document.body;
                ui.appendChild(host);
                const root = host.attachShadow({ mode: 'open' });
                const wrapper = document.createElement('div');
                wrapper.id = 'content-wrapper';
                wrapper.style.width = '100%';
                wrapper.style.height = '100%';
                wrapper.style.overflow = 'hidden';
                root.appendChild(wrapper);
                window.__activeSnippets.set(id, host);
              }
              const root = host.shadowRoot;
              const wrapper = root.getElementById('content-wrapper');
              wrapper.innerHTML = e.html;
              host.style.left = (e.x | 0) + 'px';
              host.style.top = (e.y | 0) + 'px';
              host.style.width = (e.w | 0) + 'px';
              host.style.height = (e.h | 0) + 'px';
            };
          }

          if (typeof window.__updateCharacter !== 'function') {
            window.__updateCharacter = (state) => {
              let container = document.getElementById('character-container');
              if (!container) {
                container = document.createElement('div');
                container.id = 'character-container';
                container.style.position = 'absolute';
                container.style.top = '0';
                container.style.left = '0';
                container.style.width = '100%';
                container.style.height = '100%';
                container.style.pointerEvents = 'none';
                container.style.userSelect = 'none';
                container.style.zIndex = '10';
                container.style.zIndex = '10';
                const world = document.getElementById('world-layer') || document.body;
                world.appendChild(container);

                const pose = document.createElement('img');
                pose.id = 'char-pose';
                pose.style.position = 'absolute';
                pose.style.left = '0';
                pose.style.top = '0';
                pose.style.transformOrigin = 'top left';
                pose.style.willChange = 'transform';
                container.appendChild(pose);

                const mouth = document.createElement('img');
                mouth.id = 'char-mouth';
                mouth.style.position = 'absolute';
                mouth.style.transformOrigin = 'top left';
                mouth.style.willChange = 'transform';
                container.appendChild(mouth);
              }

              if (!state || !state.visible) {
                container.style.display = 'none';
                return;
              }

              container.style.display = 'block';
              if (typeof state.zIndex !== 'undefined') {
                container.style.zIndex = String(state.zIndex);
              }

              const poseImg = document.getElementById('char-pose');
              const mouthImg = document.getElementById('char-mouth');

              if (state.poseSrc && poseImg.getAttribute('data-src') !== state.poseSrc) {
                poseImg.src = state.poseSrc;
                poseImg.setAttribute('data-src', state.poseSrc);
              }
              if (state.mouthSrc && mouthImg.getAttribute('data-src') !== state.mouthSrc) {
                mouthImg.src = state.mouthSrc;
                mouthImg.setAttribute('data-src', state.mouthSrc);
              }

              poseImg.style.left = (state.poseX || 0) + 'px';
              poseImg.style.top = (state.poseY || 0) + 'px';
              poseImg.style.transform = `scale(${state.poseScale || 1})`;
              poseImg.style.display = 'block';

              mouthImg.style.left = (state.mouthX || 0) + 'px';
              mouthImg.style.top = (state.mouthY || 0) + 'px';
              mouthImg.style.transform = `scale(${state.mouthScale || 1})`;
              mouthImg.style.display = state.mouthSrc ? 'block' : 'none';
            };
          }
        }
        """.replace("REPLACE_LIBS", libs)
    )


def _load_timeline(json_path: Path) -> List[Dict[str, Any]]:
    data = json.loads(json_path.read_text())
    # Support both new format {"meta": {...}, "entries": [...]} and old flat list [...]
    if isinstance(data, dict) and "entries" in data:
        data = data["entries"]
    if not isinstance(data, list):
        raise ValueError("JSON root must be a list of entries (or a dict with 'entries' key)")
    # normalize/validate
    timeline: List[Dict[str, Any]] = []
    for idx, item in enumerate(data):
        for k in ("inTime", "exitTime", "htmlStartX", "htmlStartY", "htmlEndX", "htmlEndY", "html"):
            if k not in item:
                raise ValueError(f"Timeline item {idx} missing key: {k}")
        entry = {
            "id": str(item.get("id") or f"snippet-{idx}"),
            "inTime": float(item["inTime"]),
            "exitTime": float(item["exitTime"]),
            "x": int(item["htmlStartX"]),
            "y": int(item["htmlStartY"]),
            "w": int(item["htmlEndX"]) - int(item["htmlStartX"]),
            "h": int(item["htmlEndY"]) - int(item["htmlStartY"]),
            "html": str(item["html"]),
        }
        if "z" in item:
            try:
                entry["z"] = int(item["z"])
            except (TypeError, ValueError):
                pass
        timeline.append(entry)
    return timeline
def _load_words(words_path: Path) -> List[Dict[str, Any]]:
    data = json.loads(words_path.read_text())
    if not isinstance(data, list):
        raise ValueError("Words JSON must be a list of {word,start,end}")
    words: List[Dict[str, Any]] = []
    for idx, w in enumerate(data):
        if not all(k in w for k in ("word", "start", "end")):
            raise ValueError(f"Word item {idx} missing required keys")
        words.append({
            "word": str(w["word"]),
            "start": float(w["start"]),
            "end": float(w["end"]),
        })
    return words


def _normalize_phone_code(phone: str) -> str:
    base = str(phone or "")
    if "_" in base:
        base = base.split("_", 1)[0]
    base = "".join(ch for ch in base if not ch.isdigit())
    normalized = base.strip().lower()
    return normalized or "closed"


def _load_character_config(path: Path) -> Dict[str, Any]:
    data = json.loads(path.read_text())
    poses = data.get("poses")
    if not isinstance(poses, dict) or not poses:
        raise ValueError("Character config must include a 'poses' mapping with at least one pose")
    return data


def _load_phoneme_map(path: Path) -> Dict[str, str]:
    raw = json.loads(path.read_text())
    if not isinstance(raw, dict):
        raise ValueError("Phoneme map JSON must be an object of {phone: filename}")
    mapping: Dict[str, str] = {}
    for key, value in raw.items():
        if not isinstance(value, str):
            continue
        normalized_key = _normalize_phone_code(key)
        if not normalized_key:
            continue
        mapping[normalized_key] = value
    if "closed" not in mapping:
        raise ValueError("Phoneme map missing required 'closed' entry")
    return mapping


def _load_alignment(path: Path) -> List[Dict[str, Any]]:
    data = json.loads(path.read_text())
    if not isinstance(data, dict):
        raise ValueError("Alignment JSON must be an object containing a 'words' array")
    phonemes: List[Dict[str, Any]] = []
    current_time = 0.0
    for word in data.get("words", []):
        if not isinstance(word, dict):
            continue
        if word.get("case") and word.get("case") != "success":
            continue
        word_start_raw = word.get("start")
        try:
            word_start = float(word_start_raw)
        except (TypeError, ValueError):
            word_start = current_time
        if word_start > current_time + 1e-6:
            phonemes.append({"phone": "closed", "start": current_time, "end": word_start})
            current_time = word_start
        else:
            current_time = max(current_time, word_start)
        phones = word.get("phones", [])
        if not isinstance(phones, list):
            phones = []
        for p in phones:
            if not isinstance(p, dict):
                continue
            duration_raw = p.get("duration", 0)
            try:
                duration = float(duration_raw)
            except (TypeError, ValueError):
                duration = 0.0
            if duration <= 0:
                continue
            phone_code = _normalize_phone_code(p.get("phone", ""))
            phonemes.append({
                "phone": phone_code,
                "start": current_time,
                "end": current_time + duration,
            })
            current_time += duration
        # If no phones were present but an end time exists, keep the mouth closed
        if not phones:
            word_end_raw = word.get("end")
            try:
                word_end = float(word_end_raw)
            except (TypeError, ValueError):
                word_end = current_time
            if word_end > current_time + 1e-6:
                phonemes.append({"phone": "closed", "start": current_time, "end": word_end})
                current_time = word_end
    return phonemes


def _get_active_phoneme(phonemes: List[Dict[str, Any]], t: float) -> str:
    for p in phonemes:
        if p["start"] <= t < p["end"]:
            return p["phone"]
    return "closed"


def _build_caption_segments(words: List[Dict[str, Any]], gap_threshold: float = 0.6) -> List[Dict[str, Any]]:
    """Build caption phrases matching the client-side buildPhrases algorithm from useCaptions.ts."""
    if not words:
        return []

    WORDS_PER_PHRASE = 10
    MIN_PHRASE_DURATION = 2.0
    MAX_PHRASE_DURATION = 5.0

    import re
    phrases: List[Dict[str, Any]] = []
    current_words: List[Dict[str, Any]] = []
    phrase_start_time = 0.0

    for i, word in enumerate(words):
        if not current_words:
            phrase_start_time = float(word["start"])
        current_words.append(word)

        phrase_duration = float(word["end"]) - phrase_start_time
        word_count = len(current_words)
        word_text = str(word.get("word", "")).strip()

        # Determine if we should end this phrase (matches client logic exactly)
        should_break = (
            # Natural sentence break (ends with punctuation)
            bool(re.search(r'[.!?]$', word_text)) or
            # Maximum words reached
            word_count >= WORDS_PER_PHRASE or
            # Maximum duration exceeded
            phrase_duration >= MAX_PHRASE_DURATION or
            # Comma/semicolon with enough words and time
            (bool(re.search(r'[,;:]$', word_text)) and
                word_count >= 5 and
                phrase_duration >= MIN_PHRASE_DURATION) or
            # Long pause between this word and next (natural break)
            (i < len(words) - 1 and float(words[i + 1]["start"]) - float(word["end"]) > 0.5)
        )

        if should_break or i == len(words) - 1:
            phrases.append({
                "start": phrase_start_time,
                "end": float(word["end"]),
                "text": " ".join(str(w["word"]) for w in current_words),
                "words": current_words[:],
            })
            current_words = []

    return phrases


def _active_caption_at(segments: List[Dict[str, Any]], t: float) -> Dict[str, Any]:
    # Add small tail (0.3s) after phrase ends and early start (0.1s) before phrase begins
    for seg in segments:
        if (seg["start"] - 0.1) <= t <= (seg["end"] + 0.3):
            return seg
    return {}


def _load_branding(branding_path: Path) -> Dict[str, Any]:
    data = json.loads(branding_path.read_text())
    for k in ("html", "x", "y", "w", "h"):
        if k not in data:
            raise ValueError(f"Branding JSON missing key: {k}")
    return {
        "id": "branding",
        "x": int(data["x"]),
        "y": int(data["y"]),
        "w": int(data["w"]),
        "h": int(data["h"]),
        "html": str(data["html"]),
        "z": int(data.get("z", 1000)),
    }


def _path_to_data_uri(path: Path) -> str:
    import mimetypes

    mime, _ = mimetypes.guess_type(str(path))
    if not mime:
        mime = "application/octet-stream"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def _convert_file_urls_to_data_uris(html: str) -> str:
    """Convert file:// URLs in img src attributes to data URIs."""
    import re
    
    def replace_file_url(match):
        quote_char = match.group(1)  # The quote character used (" or ')
        file_url = match.group(2)   # The file URL
        # Remove file:// prefix
        if file_url.startswith("file://"):
            file_path = file_url[7:]  # Remove "file://"
        else:
            file_path = file_url
        
        try:
            path = Path(file_path)
            if path.exists():
                data_uri = _path_to_data_uri(path)
                return f'src={quote_char}{data_uri}{quote_char}'
            else:
                print(f"Warning: Image file not found: {file_path}")
                return match.group(0)  # Return original if file doesn't exist
        except Exception as e:
            print(f"Warning: Failed to convert {file_url} to data URI: {e}")
            return match.group(0)  # Return original on error
    
    # Match src="file://..." or src='file://...' (handles both single and double quotes)
    pattern = r'src=(["\'])(file://[^"\']+)\1'
    return re.sub(pattern, replace_file_url, html)


def _load_video_options(options_path: Path) -> Dict[str, Any]:
    data = json.loads(options_path.read_text())
    return {
        "width": int(data.get("width", 1920)),
        "height": int(data.get("height", 1080)),
        "fps": int(data.get("fps", 30)),
        "background_color": str(data.get("background_color", "#000")),
        "show_captions": bool(data.get("show_captions", False)),
        "captions_settings_path": data.get("captions_settings_path"),
        "words_json_path": data.get("words_json_path"),
        "show_branding": bool(data.get("show_branding", False)),
        "branding_json_path": data.get("branding_json_path"),
        "frames_dir": data.get("frames_dir", ".render_frames"),
        "show_character": bool(data.get("show_character", False)),
        "character_config_path": data.get("character_config_path"),
        "phoneme_map_path": data.get("phoneme_map_path"),
        "alignment_json_path": data.get("alignment_json_path"),
        "character_pose": data.get("character_pose"),
    }


def _load_caption_settings(settings_path: Path) -> Dict[str, Any]:
    data = json.loads(settings_path.read_text())
    # Defaults now match client-side CaptionDisplay.tsx styling
    return {
        "font_family": data.get("font_family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"),
        "font_size": data.get("font_size", 20),  # Client default: medium=20px (at 1920w)
        "font_color": data.get("font_color", "#FFFFFF"),
        "font_weight": data.get("font_weight", 400),  # Client uses normal weight
        "background_color": data.get("background_color", "rgba(0,0,0,0.75)"),  # Client default opacity 0.75
        "padding_px": data.get("padding_px", 10),
        "border_radius_px": data.get("border_radius_px", 8),
        "gap_threshold_seconds": data.get("gap_threshold_seconds", 0.5),  # Matches client pause threshold
        "position": data.get("position", "bottom"),  # top or bottom — matches client
        "box": data.get("box", {"x": 0, "y": 0, "w": 1920, "h": 1080}),
        "text_align": data.get("text_align", "center"),
        "line_height": data.get("line_height", 1.5),
        "max_lines": data.get("max_lines", 2),
        "allow_html": data.get("allow_html", False),
        "annotate_active_word": data.get("annotate_active_word", False),
        "active_word_css": data.get("active_word_css", "font-weight:700; text-decoration:underline;"),
        "inactive_word_css": data.get("inactive_word_css", "opacity:0.9;"),
        "max_words_per_line": int(data.get("max_words_per_line", 10)),
    }


def _active_entries_at(timeline: List[Dict[str, Any]], t: float) -> List[Dict[str, Any]]:
    active: List[Dict[str, Any]] = []
    for item in timeline:
        if item["inTime"] <= t < item["exitTime"]:
            entry = {
                "id": item["id"],
                "x": item["x"],
                "y": item["y"],
                "w": item["w"],
                "h": item["h"],
                "html": item["html"],
            }
            if "z" in item:
                entry["z"] = item["z"]
            active.append(entry)
    return active


def _validate_assets(
    audio_path: Path,
    timeline_path: Path,
    show_captions: bool,
    captions_words_path: str,
    captions_settings_path: str,
    show_branding: bool,
    branding_json_path: str,
    show_character: bool,
    character_config_path: str,
    phoneme_map_path: str,
    alignment_json_path: str,
) -> None:
    """Pre-flight check to ensure all referenced assets exist."""
    print("🔍 Validating assets...")
    errors = []

    if not audio_path.exists():
        errors.append(f"Audio file missing: {audio_path}")
    
    if not timeline_path.exists():
        errors.append(f"Timeline JSON missing: {timeline_path}")
    else:
        # Check assets referenced in timeline HTML
        try:
            import re
            timeline_data = json.loads(timeline_path.read_text())
            # Support new format {"meta": {...}, "entries": [...]}
            if isinstance(timeline_data, dict) and "entries" in timeline_data:
                timeline_data = timeline_data["entries"]
            for idx, item in enumerate(timeline_data):
                html = item.get("html", "")
                # Find all file:// paths
                # Regex matches src="file://..." or src='file://...'
                matches = re.finditer(r'src=["\']file://([^"\']+)["\']', html)
                for m in matches:
                    file_path = Path(m.group(1))
                    if not file_path.exists():
                        errors.append(f"Missing asset in timeline item {idx}: {file_path}")
        except Exception as e:
            errors.append(f"Failed to parse timeline JSON for validation: {e}")

    if show_captions:
        if not captions_words_path:
            errors.append("Captions enabled but words JSON path not provided.")
        elif not Path(captions_words_path).exists():
            errors.append(f"Captions words JSON missing: {captions_words_path}")
            
        if not captions_settings_path:
            errors.append("Captions enabled but settings JSON path not provided.")
        elif not Path(captions_settings_path).exists():
            errors.append(f"Captions settings JSON missing: {captions_settings_path}")

    if show_branding:
        if not branding_json_path:
            errors.append("Branding enabled but branding JSON path not provided.")
        elif not Path(branding_json_path).exists():
            errors.append(f"Branding JSON missing: {branding_json_path}")
        else:
            # Check image in branding if present
            try:
                import re
                branding_data = json.loads(Path(branding_json_path).read_text())
                html = branding_data.get("html", "")
                matches = re.finditer(r'src=["\']file://([^"\']+)["\']', html)
                for m in matches:
                    file_path = Path(m.group(1))
                    if not file_path.exists():
                        errors.append(f"Missing asset in branding JSON: {file_path}")
            except Exception as e:
                errors.append(f"Failed to parse branding JSON for validation: {e}")

    if show_character:
        if not character_config_path:
            errors.append("Character enabled but config path not provided.")
        elif not Path(character_config_path).exists():
            errors.append(f"Character config missing: {character_config_path}")
        else:
            # Check character assets (simplified check)
            try:
                config_p = Path(character_config_path)
                char_data = json.loads(config_p.read_text())
                poses_dir = config_p.parent / "poses"
                pose = char_data.get("poses", {}).get(char_data.get("defaultPose", "normal"))
                if pose and "image" in pose:
                    if not (poses_dir / pose["image"]).exists():
                        errors.append(f"Character default pose image missing: {pose['image']}")
            except Exception:
                 pass # Warning only, strictly checked later

        if not phoneme_map_path:
            # Default check handled in logic, but if provided must exist
            pass 
        elif not Path(phoneme_map_path).exists():
            errors.append(f"Phoneme map missing: {phoneme_map_path}")

        if not alignment_json_path:
            pass # logic tries default
        elif not Path(alignment_json_path).exists():
            errors.append(f"Alignment JSON missing: {alignment_json_path}")

    if errors:
        print("\n❌ Asset Validation Failed:")
        for err in errors:
            print(f"  - {err}")
        raise FileNotFoundError("One or more required assets are missing. See log above.")
    
    print("✅ Assets validated.")
def render_video_from_json(
    audio_path: str,
    json_path: str,
    output_path: str = "output.mp4",
    width: Optional[int] = None,
    height: Optional[int] = None,
    fps: Optional[int] = None,
    temp_frames_dir: Optional[str] = None,
    background_color: Optional[str] = None,
    video_options_path: str = "",
    captions_words_path: str = "",
    captions_settings_path: str = "",
    show_captions: bool = False,
    branding_json_path: str = "",
    show_branding: bool = False,
    show_character: bool = False,
    character_config_path: str = "",
    phoneme_map_path: str = "",
    alignment_json_path: str = "",
    character_pose: str = "",
    avatar_video_path: str = "",
    audio_delay: float = 0.0,
    frames_only: bool = False,
    start_frame: Optional[int] = None,
    end_frame: Optional[int] = None,
) -> Path:
    """
    Render a portrait video by placing timed HTML overlays (from JSON) on a 1080x1920 canvas
    and combining the frames with the provided MP3 narration.

    Args:
        audio_path: Path to the narration audio (e.g., MP3).
        json_path: Path to timeline JSON (list of entries with inTime/exitTime and HTML + box).
        output_path: Output MP4 filepath.
        width: Video width (default 1080).
        height: Video height (default 1920).
        fps: Frames per second (default 30).
        temp_frames_dir: Directory to store intermediate PNG frames.
        show_character: Enable Matamata-style lip-sync rendering.
        character_config_path: Path to the character pose configuration JSON.
        phoneme_map_path: Path to phoneme->mouth sprite mapping JSON.
        alignment_json_path: Path to Gentle alignment JSON containing phoneme timings.
        character_pose: Optional pose name override (defaults to config's default).

    Returns:
        Path to the generated MP4 file.
    """
    audio_p = Path(audio_path).expanduser().resolve()
    json_p = Path(json_path).expanduser().resolve()
    out_p = Path(output_path).expanduser().resolve()

    # Apply video options file if provided
    opts: Dict[str, Any] = {}
    if video_options_path:
        opts = _load_video_options(Path(video_options_path).expanduser().resolve())
    # Resolve final render settings with precedence: CLI args > options.json > defaults
    width = width if width is not None else opts.get("width", 1920)
    height = height if height is not None else opts.get("height", 1080)
    fps = fps if fps is not None else opts.get("fps", 30)
    background_color = background_color if background_color is not None and background_color != "" else opts.get("background_color", "#000")
    temp_frames_dir = temp_frames_dir if temp_frames_dir else opts.get("frames_dir", ".render_frames")
    if opts.get("show_captions"):
        show_captions = True
        if not captions_words_path and opts.get("words_json_path"):
            captions_words_path = opts["words_json_path"]
        if not captions_settings_path and opts.get("captions_settings_path"):
            captions_settings_path = opts["captions_settings_path"]
    if opts.get("show_branding"):
        show_branding = True
        if not branding_json_path and opts.get("branding_json_path"):
            branding_json_path = opts["branding_json_path"]
    if opts.get("show_character"):
        show_character = True
    if not character_config_path and opts.get("character_config_path"):
        character_config_path = opts["character_config_path"]
    if not phoneme_map_path and opts.get("phoneme_map_path"):
        phoneme_map_path = opts["phoneme_map_path"]
    if not alignment_json_path and opts.get("alignment_json_path"):
        alignment_json_path = opts["alignment_json_path"]
    if not character_pose and opts.get("character_pose"):
        character_pose = opts["character_pose"]

    # --- Pre-Validation Step ---
    _validate_assets(
        audio_path=audio_p,
        timeline_path=json_p,
        show_captions=show_captions,
        captions_words_path=captions_words_path,
        captions_settings_path=captions_settings_path,
        show_branding=show_branding,
        branding_json_path=branding_json_path,
        show_character=show_character,
        character_config_path=character_config_path,
        phoneme_map_path=phoneme_map_path,
        alignment_json_path=alignment_json_path,
    )
    # ---------------------------

    frames_dir = Path(temp_frames_dir).expanduser().resolve()

    if not audio_p.exists():
        raise FileNotFoundError(f"Audio not found: {audio_p}")
    if not json_p.exists():
        raise FileNotFoundError(f"JSON not found: {json_p}")

    # Prepare timeline, audio, optional captions/branding
    timeline = _load_timeline(json_p)

    # Convert file:// URLs in timeline HTML to data URIs so images can load in browser
    for entry in timeline:
        h = entry.get("html", "")
        if not isinstance(h, str):
            continue

        # Sanitize common LLM artifacts where attributes are wrapped in brackets e.g. class="]mermaid["
        # Regex for class="]value[" -> class="value"
        h = re.sub(r'=(["\'])\](.*?)\[\1', r'=\1\2\1', h)

        entry["html"] = _convert_file_urls_to_data_uris(h)

    audio_clip = AudioFileClip(str(audio_p))
    audio_duration: float = float(audio_clip.duration)
    
    # Calculate total video duration from timeline (which includes intro/outro if present)
    # The timeline now has branding entries that extend beyond the audio
    timeline_max_end = max((float(e.get("exitTime", 0)) for e in timeline), default=audio_duration)
    
    # If audio_delay is specified, the audio starts after intro, so total duration is:
    # intro_duration + audio_duration + outro_duration
    # The timeline already accounts for this, so we use the timeline's max end time
    duration: float = max(audio_duration + audio_delay, timeline_max_end)
    total_frames = int(math.ceil(duration * fps))
    
    print(f"DEBUG: Audio duration: {audio_duration}s")
    print(f"DEBUG: Audio delay (intro): {audio_delay}s")
    print(f"DEBUG: Timeline max end: {timeline_max_end}s")
    print(f"DEBUG: Total video duration: {duration}s")
    print(f"DEBUG: Total frames to render: {total_frames}")
    
    # Apply audio delay - audio will start after the intro
    if audio_delay > 0:
        print(f"DEBUG: Applying audio delay of {audio_delay}s for intro silence")
        audio_clip = audio_clip.with_start(audio_delay)

    caption_segments: List[Dict[str, Any]] = []
    caption_words: List[Dict[str, Any]] = []
    caption_styles: Dict[str, Any] = {}
    caption_box: Dict[str, int] = {}
    if show_captions:
        if not captions_words_path or not captions_settings_path:
            raise ValueError("Captions requested but words path or settings path not provided")
        words_p = Path(captions_words_path).expanduser().resolve()
        settings_p = Path(captions_settings_path).expanduser().resolve()
        if not words_p.exists():
            raise FileNotFoundError(f"Words JSON not found: {words_p}")
        if not settings_p.exists():
            raise FileNotFoundError(f"Caption settings JSON not found: {settings_p}")
        words = _load_words(words_p)
        
        # Offset caption word timings by audio_delay (for intro silence)
        if audio_delay > 0:
            for word in words:
                word["start"] = float(word.get("start", 0)) + audio_delay
                word["end"] = float(word.get("end", 0)) + audio_delay
        
        caption_words = words
        caption_settings = _load_caption_settings(settings_p)
        caption_segments = _build_caption_segments(words, caption_settings["gap_threshold_seconds"])
        caption_styles = caption_settings
        # Caption is now rendered as a full-viewport overlay with CSS positioning
        # (matching client-side CaptionDisplay.tsx approach)
        caption_box = {
            "x": 0,
            "y": 0,
            "w": width,
            "h": height,
        }
        # Scale caption font size proportionally to width
        # Client defaults: S=16, M=20, L=28 at 1920w
        caption_font_scale = width / 1920.0
        base_font_size = caption_settings.get("font_size", 20)
        caption_settings["font_size"] = max(12, int(base_font_size * caption_font_scale))

    branding_entry: Dict[str, Any] = {}
    if show_branding:
        if not branding_json_path:
            raise ValueError("Branding requested but branding_json_path not provided")
        branding_p = Path(branding_json_path).expanduser().resolve()
        if not branding_p.exists():
            raise FileNotFoundError(f"Branding JSON not found: {branding_p}")
        branding_entry = _load_branding(branding_p)
        # Convert file:// URLs in branding HTML to data URIs
        if "html" in branding_entry:
            branding_entry["html"] = _convert_file_urls_to_data_uris(branding_entry["html"])

    alignment_phonemes: List[Dict[str, Any]] = []
    phoneme_map_lookup: Dict[str, str] = {}
    pose_image_src: str = ""
    pose_offset_x = 0.0
    pose_offset_y = 0.0
    mouth_anchor_x = 0.0
    mouth_anchor_y = 0.0
    pose_scale_value = 1.0
    mouth_scale_value = 1.0
    character_z_index = 10
    mouths_dir: Optional[Path] = None
    mouth_src_cache: Dict[str, str] = {}

    if show_character:
        if not character_config_path:
            default_character_candidates = [
                Path("assets/character/character.json"),
                Path("assets/character/SampleCharacter/character.json"),
            ]
            for candidate in default_character_candidates:
                if candidate.exists():
                    character_config_path = str(candidate)
                    break
        if not character_config_path:
            raise ValueError("Character rendering requested but character_config_path not provided")
        config_p = Path(character_config_path).expanduser().resolve()
        if not config_p.exists():
            raise FileNotFoundError(f"Character config not found: {config_p}")
        char_config = _load_character_config(config_p)
        poses_config = char_config.get("poses", {})
        pose_defs: Dict[str, Dict[str, Any]] = {
            name: data
            for name, data in poses_config.items()
            if isinstance(data, dict) and "image" in data
        }
        if not pose_defs:
            raise ValueError("Character config does not define any usable poses")
        resolved_pose_name = character_pose or poses_config.get("defaultPose") or char_config.get("defaultPose") or "normal"
        if resolved_pose_name not in pose_defs:
            resolved_pose_name = next(iter(pose_defs.keys()))
        default_mouth_scale = float(poses_config.get("defaultMouthScale", char_config.get("defaultMouthScale", 1.0)))
        character_dir = config_p.parent
        poses_dir = (character_dir / "poses").expanduser().resolve()
        mouths_dir = (character_dir / "mouths").expanduser().resolve()
        if not poses_dir.exists():
            raise FileNotFoundError(f"Character poses directory not found: {poses_dir}")
        if not mouths_dir.exists():
            raise FileNotFoundError(f"Character mouths directory not found: {mouths_dir}")
        pose_sources: Dict[str, str] = {}
        for pose_name, pose_data in pose_defs.items():
            image_name = pose_data.get("image")
            if not image_name:
                raise ValueError(f"Pose '{pose_name}' missing image filename")
            pose_path = (poses_dir / image_name).expanduser().resolve()
            if not pose_path.exists():
                raise FileNotFoundError(f"Pose image not found: {pose_path}")
            pose_sources[pose_name] = _path_to_data_uri(pose_path)
        pose_data = pose_defs[resolved_pose_name]
        pose_image_src = pose_sources[resolved_pose_name]
        pose_offset_x = float(pose_data.get("poseX", pose_data.get("offsetX", 0.0)))
        pose_offset_y = float(pose_data.get("poseY", pose_data.get("offsetY", 0.0)))
        mouth_anchor_x = float(pose_data.get("mouthX", pose_data.get("x", 0.0)))
        mouth_anchor_y = float(pose_data.get("mouthY", pose_data.get("y", 0.0)))
        pose_scale_value = float(pose_data.get("poseScale", pose_data.get("scale", 1.0)))
        mouth_scale_value = float(pose_data.get("mouthScale", 1.0)) * float(default_mouth_scale) * pose_scale_value
        character_z_index = int(pose_data.get("zIndex", 10))

        if not phoneme_map_path:
            default_phoneme_map = Path("assets/phonemes.json")
            if default_phoneme_map.exists():
                phoneme_map_path = str(default_phoneme_map)
        if not phoneme_map_path:
            raise ValueError("Character rendering requires phoneme_map_path or assets/phonemes.json")
        phoneme_map_p = Path(phoneme_map_path).expanduser().resolve()
        if not phoneme_map_p.exists():
            raise FileNotFoundError(f"Phoneme map not found: {phoneme_map_p}")
        phoneme_map_lookup = _load_phoneme_map(phoneme_map_p)

        if not alignment_json_path:
            for candidate in (Path("alignment.json"), Path("assets/alignment.json")):
                if candidate.exists():
                    alignment_json_path = str(candidate)
                    break
        if not alignment_json_path:
            raise ValueError("Character rendering requires alignment_json_path (Gentle output)")
        alignment_p = Path(alignment_json_path).expanduser().resolve()
        if not alignment_p.exists():
            raise FileNotFoundError(f"Alignment JSON not found: {alignment_p}")
        alignment_phonemes = _load_alignment(alignment_p)
        if not alignment_phonemes:
            raise ValueError(f"Alignment JSON '{alignment_p}' did not provide any phonemes")

    # Frames directory
    if frames_dir.exists():
        shutil.rmtree(frames_dir)
    frames_dir.mkdir(parents=True, exist_ok=True)

    # Render frames using Playwright (CSS animations run in real-time between frames)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--allow-file-access-from-files",
                "--disable-web-security",
            ],
        )
        print("🎥 High DPI Rendering Enabled (Scale Factor: 2)")
        context = browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=2,
        )
        page = context.new_page()
        
        # Hook up console logging to Python stdout for debugging
        # Log errors, warnings, and info for full visibility
        _browser_error_count = [0]
        def _on_console(msg):
            if msg.type in ("error", "warning"):
                _browser_error_count[0] += 1
                print(f"[BROWSER {msg.type.upper()}] {msg.text}")
            elif msg.type == "info":
                print(f"[BROWSER INFO] {msg.text}")
        page.on("console", _on_console)
        def _on_pageerror(err):
            _browser_error_count[0] += 1
            print(f"[BROWSER EXCEPTION] {err}")
        page.on("pageerror", _on_pageerror)
        
        _prepare_page(page, width=width, height=height, background_color=background_color)
        # Wait for fonts and libraries to load before rendering frames
        try:
            page.wait_for_load_state("networkidle", timeout=10000)
        except Exception:
            pass
        if not show_character:
            page.evaluate("() => window.__updateCharacter && window.__updateCharacter(null)")

        _render_start = start_frame if start_frame is not None else 0
        _render_end = end_frame if end_frame is not None else total_frames
        print(f"DEBUG: Rendering frame range [{_render_start}, {_render_end}) of {total_frames} total")

        _prev_active_ids = set()

        for frame_index in range(_render_start, _render_end):
            t = frame_index / float(fps)
            active = _active_entries_at(timeline, t)
            # Add branding if enabled
            if show_branding and branding_entry:
                active.append(branding_entry)
            # Update DOM for overlays
            page.evaluate("async (entries) => await window.__updateSnippets(entries)", active)

            # Wait for images/fonts/annotations to load when active segments change
            _cur_active_ids = {e["id"] for e in active}
            if _cur_active_ids != _prev_active_ids:
                try:
                    page.wait_for_load_state("networkidle", timeout=5000)
                except Exception:
                    pass  # timeout is fine — best effort
                # Wait for Rough Notation annotations to position after layout
                page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
                _prev_active_ids = _cur_active_ids

            # --- Calculate Camera Drift ---
            # 1. Identify active visuals (exclude branding/character)
            primary_visuals = [e for e in active if e.get("id") != "branding"]
            
            cam_scale = 1.0
            cam_x = 0.0
            cam_y = 0.0
            
            if primary_visuals:
                # Let's map active IDs back to timeline entries to find start times
                active_ids = {e["id"] for e in primary_visuals}
                # Find corresponding timeline items
                relevant_items = [
                    item for item in timeline 
                    if item["id"] in active_ids 
                    and item["id"] != "branding"
                ]
                if relevant_items:
                    # Sort by start time, picking the most recent one as the "anchor"
                    focus_item = sorted(relevant_items, key=lambda x: x["inTime"])[-1]
                    
                    # Deterministically pick a move type based on the shot ID
                    # This ensures the same shot always gets the same move type
                    shot_hash = sum(ord(c) for c in str(focus_item["id"]))
                    move_types = ["zoom_in", "zoom_out", "pan_right", "pan_left", "semistatic"]
                    move_type = move_types[shot_hash % len(move_types)]

                    # Calculate progress in this shot
                    shot_duration = max(0.1, focus_item["exitTime"] - focus_item["inTime"])
                    shot_progress = (t - focus_item["inTime"]) / shot_duration
                    shot_progress = max(0, min(1, shot_progress))
                    
                    # Apply Transform Math
                    # Scale base = 1.05 to allow wiggle room for pans/zooms without black bars
                    # (Assumes we are okay with slight cropping)
                    # Actually, if we scale < 1, we get black bars. So base scale should be >= 1.0.
                    
                    if move_type == "zoom_in":
                        # 1.0 -> 1.15 (More noticeable)
                        cam_scale = 1.0 + (shot_progress * 0.15)
                        cam_x = 0
                        cam_y = 0
                    elif move_type == "zoom_out":
                        # 1.15 -> 1.0
                        cam_scale = 1.15 - (shot_progress * 0.15)
                        cam_x = 0
                        cam_y = 0
                    elif move_type == "pan_right":
                        # Move left to simulate camera panning right
                        # x: 0 -> -60, Scale constant 1.05 to avoid edges
                        cam_scale = 1.05
                        cam_x = (shot_progress * 60.0)
                        cam_y = 0
                    elif move_type == "pan_left":
                        # x: -60 -> 0 
                        cam_scale = 1.05
                        cam_x = -60.0 + (shot_progress * 60.0)
                        cam_y = 0
                    else: # semistatic
                        # Breathe slightly more
                        cam_scale = 1.02 + (math.sin(shot_progress * 3.14) * 0.02)
                        cam_x = 0
                        cam_y = 0

            # Only print occasionally to avoid spam, or finding a way to log debug info
            # print(f"DEBUG: T={t:.2f} Cam: {move_type} S={cam_scale:.3f} X={cam_x:.1f}") (Commented out for speed)
            
            page.evaluate("(state) => window.__updateCamera && window.__updateCamera(state)", {
                "x": cam_x,
                "y": cam_y,
                "scale": cam_scale
            })
            # ------------------------------

            if show_character:
                phone_code = _normalize_phone_code(_get_active_phoneme(alignment_phonemes, t))
                mouth_file = (
                    phoneme_map_lookup.get(phone_code)
                    or phoneme_map_lookup.get("sil")
                    or phoneme_map_lookup.get("closed")
                )
                if not mouth_file:
                    raise ValueError(f"No mouth sprite configured for phoneme '{phone_code}' and no 'closed' fallback")
                if mouths_dir is None:
                    raise RuntimeError("Mouths directory is not initialized for character rendering")
                mouth_src = mouth_src_cache.get(mouth_file)
                if not mouth_src:
                    mouth_path = (mouths_dir / mouth_file).expanduser().resolve()
                    if not mouth_path.exists():
                        raise FileNotFoundError(f"Mouth sprite not found: {mouth_path}")
                    mouth_src = _path_to_data_uri(mouth_path)
                    mouth_src_cache[mouth_file] = mouth_src
                char_state = {
                    "visible": True,
                    "poseSrc": pose_image_src,
                    "mouthSrc": mouth_src,
                    "poseX": pose_offset_x,
                    "poseY": pose_offset_y,
                    "poseScale": pose_scale_value,
                    "mouthX": pose_offset_x + mouth_anchor_x,
                    "mouthY": pose_offset_y + mouth_anchor_y,
                    "mouthScale": mouth_scale_value,
                    "zIndex": character_z_index,
                }
                page.evaluate("(state) => window.__updateCharacter(state)", char_state)

            # Update caption if enabled — matching client-side CaptionDisplay.tsx styling
            if show_captions and caption_segments:
                seg = _active_caption_at(caption_segments, t)
                if seg:
                    style = caption_styles
                    allow_html = bool(style.get("allow_html", False))

                    # Show entire phrase text (matching client buildPhrases approach)
                    raw_text = seg.get("text", "")
                    content_html = raw_text if allow_html else _html_escape(raw_text)

                    # Determine caption position (matches client CaptionDisplay.tsx)
                    cap_position = str(style.get("position", "bottom"))
                    if cap_position == "top":
                        position_css = f"top:{int(height * 0.037)}px; bottom:auto;"
                    else:
                        position_css = f"bottom:{int(height * 0.074)}px; top:auto;"

                    # Font size (scaled proportionally)
                    font_size = int(style.get("font_size", 20))

                    # Build caption HTML matching client CaptionDisplay.tsx exactly
                    html = (
                        f'<div style="width:100%; height:100%; position:relative;">'
                        f'<div style="position:absolute; left:50%; transform:translateX(-50%); '
                        f'max-width:85%; padding:10px 20px; border-radius:8px; '
                        f'background:{style["background_color"]}; text-align:center; '
                        f"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif; "
                        f'font-size:{font_size}px; font-weight:400; color:{style["font_color"]}; '
                        f'text-shadow:0 1px 3px rgba(0,0,0,0.4); line-height:1.5; letter-spacing:0.02em; '
                        f'min-height:44px; display:flex; align-items:center; justify-content:center; '
                        f'{position_css}">'
                        f'<div style="display:inline-block; text-shadow:0 1px 3px rgba(0,0,0,0.4);">'
                        f'{content_html}</div></div></div>'
                    )
                    # Use full-viewport overlay so position CSS works correctly
                    entry = {"x": 0, "y": 0, "w": width, "h": height, "html": html}
                    page.evaluate("(entry) => window.__updateCaption(entry)", entry)
                else:
                    page.evaluate("() => window.__updateCaption(null)")
            else:
                # ensure no caption if disabled
                page.evaluate("() => window.__updateCaption && window.__updateCaption(null)")

            # Capture frame immediately after state change (represents time t)
            if frame_index % 30 == 0:
                print(f"DEBUG: Processing frame {frame_index}/{total_frames} (t={t:.2f}s)")

            # Sync GSAP animation to exact time t
            page.evaluate(f"gsap.globalTimeline.totalTime({t}); void 0;")

            # Time-aware Rough Notation: only show annotations whose show()
            # was triggered at or before current time t. This prevents annotations
            # from appearing before their intended GSAP timeline position.
            page.evaluate(f"""() => {{
                const currentTime = {t};
                if (window.__registeredAnnotations && window.__annotationShowTimes) {{
                    window.__registeredAnnotations.forEach(a => {{
                        const showTime = window.__annotationShowTimes.get(a);
                        if (showTime !== undefined && showTime <= currentTime) {{
                            // Show this annotation — it should be visible at this time
                            try {{ if (!a.isShowing) a.show(); }} catch(e) {{}}
                        }} else {{
                            // Hide this annotation — it shouldn't be visible yet
                            try {{ if (a.isShowing) a.hide(); }} catch(e) {{}}
                            // Also force-hide the SVG element since the blanket
                            // * {{ opacity: 1 !important }} rule would otherwise show it
                            try {{
                                if (a._e && a._e.nextElementSibling && a._e.nextElementSibling.tagName === 'svg') {{
                                    a._e.nextElementSibling.style.setProperty('opacity', '0', 'important');
                                    a._e.nextElementSibling.style.setProperty('visibility', 'hidden', 'important');
                                }}
                            }} catch(e) {{}}
                        }}
                    }});
                }}
                // Also force-hide/show annotation SVGs in shadow DOMs
                document.querySelectorAll('[id^="snippet-"], [id^="segment-"], [id^="branding-"]').forEach(host => {{
                    const root = host.shadowRoot;
                    if (!root) return;
                    root.querySelectorAll('svg.rough-annotation').forEach(svg => {{
                        // Check if parent annotation is registered and has a show-time
                        // If we can't determine, default to visible (matches old behavior)
                        const parentEl = svg.previousElementSibling;
                        let shouldShow = true;
                        if (window.__registeredAnnotations && parentEl) {{
                            for (const a of window.__registeredAnnotations) {{
                                if (a._e === parentEl) {{
                                    const st = window.__annotationShowTimes.get(a);
                                    shouldShow = (st !== undefined && st <= currentTime);
                                    break;
                                }}
                            }}
                        }}
                        if (shouldShow) {{
                            svg.style.setProperty('opacity', '1', 'important');
                            svg.style.setProperty('visibility', 'visible', 'important');
                        }} else {{
                            svg.style.setProperty('opacity', '0', 'important');
                            svg.style.setProperty('visibility', 'hidden', 'important');
                        }}
                    }});
                }});
            }}""")

            # Capture frame
            frame_path = frames_dir / f"frame_{frame_index:06d}.png"
            try:
                page.screenshot(path=str(frame_path), type="png", timeout=5000)
            except Exception as e:
                print(f"❌ Screenshot failed at frame {frame_index}: {e}")
                # Try to proceed or abort? Aborting is safer to avoid long hangs.
                raise e

        if _browser_error_count[0] > 0:
            print(f"[BROWSER SUMMARY] Total browser errors/exceptions during render: {_browser_error_count[0]}")
        print("DEBUG: Finished rendering loop. Closing context...")
        context.close()
        print("DEBUG: Context closed. Closing browser...")
        browser.close()
        print("DEBUG: Browser closed.")

    # If frames-only mode, skip video assembly (caller handles it)
    if frames_only:
        rendered_count = len(list(frames_dir.glob("frame_*.png")))
        print(f"DEBUG: Frames-only mode complete. Rendered {rendered_count} frames to {frames_dir}")
        return frames_dir

    # Assemble video
    print("DEBUG: Collecting frame files...")
    frame_files = sorted(str(p) for p in frames_dir.glob("frame_*.png"))
    print(f"DEBUG: Found {len(frame_files)} frames.")
    if len(frame_files) != total_frames:
        raise RuntimeError(
            f"Expected {total_frames} frames, found {len(frame_files)} in {frames_dir}"
        )

    print("DEBUG: Creating ImageSequenceClip...")
    video_clip = ImageSequenceClip(frame_files, fps=fps).with_audio(audio_clip).with_duration(duration)
    print("DEBUG: ImageSequenceClip created.")

    if avatar_video_path and Path(avatar_video_path).exists():
        try:
            print(f"Overlaying avatar video from: {avatar_video_path}")
            avatar_clip = VideoFileClip(avatar_video_path)
            
            # Ensure avatar clip matches duration (loop or cut)
            if avatar_clip.duration < duration:
                # Loop if too short (unlikely if generated from same audio, but safe)
                # Actually SadTalker should match. If header/footer silence, might differ slightly.
                # We'll just let it play. If it stops, it disappears? Or freeze?
                # Best to ensure it covers the duration.
                pass
            
            # Resize and position
            # Make it 1/3 height
            target_h = height // 3
            avatar_clip = avatar_clip.resized(height=target_h)
            
            # Position bottom right with margin
            margin_x = 50
            margin_y = 50
            pos_x = width - avatar_clip.w - margin_x
            pos_y = height - avatar_clip.h - margin_y
            
            avatar_clip = avatar_clip.with_position((pos_x, pos_y))
            
            # Composite
            video_clip = CompositeVideoClip([video_clip, avatar_clip]).with_duration(duration).with_audio(audio_clip)

        except Exception as e:
            print(f"Failed to overlay avatar video: {e}")

    # Ensure parent directory exists
    out_p.parent.mkdir(parents=True, exist_ok=True)

    # libx264 + aac, yuv420p is broadly compatible
    # threads=1 is CRITICAL for stability on macOS/MoviePy to avoid multiprocessing crashes/leaks
    print(f"DEBUG: Writing video to {out_p} with threads=1...")
    video_clip.write_videofile(
        str(out_p),
        fps=fps,
        codec="libx264",
        audio_codec="aac",
        preset="medium",
        threads=1,
        ffmpeg_params=["-pix_fmt", "yuv420p"],
    )
    print("DEBUG: Video writing complete.")

    # Cleanup moviepy clips
    video_clip.close()
    audio_clip.close()

    return out_p


def _parse_args(argv: List[str]):
    parser = argparse.ArgumentParser(description="Render MP4 from audio + timed HTML overlays JSON")
    parser.add_argument("audio", help="Path to narration audio (e.g., MP3)")
    parser.add_argument("timeline", help="Path to timeline JSON with HTML overlays")
    parser.add_argument("output", nargs="?", default="output.mp4", help="Output MP4 path (default: output.mp4)")
    parser.add_argument("--width", type=int, default=None, help="Video width (overrides options JSON)")
    parser.add_argument("--height", type=int, default=None, help="Video height (overrides options JSON)")
    parser.add_argument("--fps", type=int, default=None, help="Frames per second (overrides options JSON)")
    parser.add_argument("--frames-dir", default=None, help="Temp frames directory (overrides options JSON)")
    parser.add_argument("--background", default=None, help="Background color (CSS), overrides options JSON")
    parser.add_argument("--video-options", default="", help="Path to video options JSON")
    parser.add_argument("--show-captions", action="store_true", help="Enable captions from words JSON + settings")
    parser.add_argument("--captions-words", default="", help="Path to words JSON for captions")
    parser.add_argument("--captions-settings", default="", help="Path to captions settings JSON")
    parser.add_argument("--show-branding", action="store_true", help="Enable branding overlay")
    parser.add_argument("--branding-json", default="", help="Path to branding JSON")
    parser.add_argument("--show-character", action="store_true", help="Enable Matamata-style character animation")
    parser.add_argument("--character-config", default="", help="Path to character configuration JSON")
    parser.add_argument("--phoneme-map", default="", help="Path to phoneme-to-mouth mapping JSON")
    parser.add_argument("--alignment-json", default="", help="Path to Gentle alignment JSON with phonemes")
    parser.add_argument("--character-pose", default="", help="Pose name override for the animated character")
    parser.add_argument("--avatar-video", default="", help="Path to generated avatar video loop/clip")
    parser.add_argument("--audio-delay", type=float, default=0.0, help="Delay audio start by this many seconds (for intro silence)")
    parser.add_argument("--frames-only", action="store_true", help="Only render frames (skip video assembly). Used for parallel rendering.")
    parser.add_argument("--start-frame", type=int, default=None, help="First frame index to render (inclusive). Used with --frames-only for parallel.")
    parser.add_argument("--end-frame", type=int, default=None, help="Last frame index to render (exclusive). Used with --frames-only for parallel.")
    return parser.parse_args(argv[1:])


if __name__ == "__main__":
    args = _parse_args(sys.argv)
    result_path = render_video_from_json(
        audio_path=args.audio,
        json_path=args.timeline,
        output_path=args.output,
        width=args.width,
        height=args.height,
        fps=args.fps,
        temp_frames_dir=args.frames_dir,
        background_color=args.background,
        video_options_path=args.video_options,
        captions_words_path=args.captions_words,
        captions_settings_path=args.captions_settings,
        show_captions=args.show_captions,
        branding_json_path=args.branding_json,
        show_branding=args.show_branding,
        show_character=args.show_character,
        character_config_path=args.character_config,
        phoneme_map_path=args.phoneme_map,
        alignment_json_path=args.alignment_json,
        character_pose=args.character_pose,
        avatar_video_path=args.avatar_video,
        audio_delay=args.audio_delay,
        frames_only=args.frames_only,
        start_frame=args.start_frame,
        end_frame=args.end_frame,
    )
    print(f"Video written to: {result_path}")


