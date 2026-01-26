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
from tqdm import tqdm

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
        window.__activeSnippets = new Map();
        window.__updateSnippets = async (entries) => {
          const activeIds = new Set(entries.map(e => e.id));
          
          // Remove no longer active snippets
          for (const [id, host] of Array.from(window.__activeSnippets.entries())) {
            if (!activeIds.has(id)) {
              try { host.remove(); } catch (e) {}
              window.__activeSnippets.delete(id);
            }
          }

          const promises = [];

          // Add/update active snippets
          for (const e of entries) {
            let host = window.__activeSnippets.get(e.id);
            if (!host) {
              host = document.createElement('div');
              host.id = e.id;
              host.style.position = 'absolute';
              host.style.overflow = 'hidden';
              host.style.pointerEvents = 'none';
              host.style.background = 'transparent';
              document.body.appendChild(host);

              // Use Light DOM (direct append) so scripts like GSAP can find elements
              const root = host; 
              const wrapper = document.createElement('div');
                  wrapper.className = 'content-wrapper'; // Use class instead of ID to avoid dupes
                  wrapper.style.position = 'absolute';
                  wrapper.style.left = '0px';
                  wrapper.style.top = '0px';
                  wrapper.style.transformOrigin = 'top left';
                  // Force centering
                  wrapper.style.display = 'flex';
                  wrapper.style.flexDirection = 'column';
                  wrapper.style.justifyContent = 'center';
                  wrapper.style.alignItems = 'center';
                  wrapper.style.textAlign = 'center';

                  wrapper.innerHTML = e.html; // snippet HTML
                  root.appendChild(wrapper);
                  
                  // Manually activate scripts injected via innerHTML
                  wrapper.querySelectorAll('script').forEach(oldScript => {
                    const newScript = document.createElement('script');
                    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                    newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                  });

                  // Re-run Prism highlighting for any new code blocks
                  if (window.Prism) {
                     window.Prism.highlightAllUnder(wrapper);
                  }

                  // Render KaTeX math
                  if (window.renderMathInElement) {
                      window.renderMathInElement(wrapper, {
                          delimiters: [
                              {left: '$$', right: '$$', display: true},
                              {left: '$', right: '$', display: false}
                          ]
                      });
                  }

                  // Trigger Mermaid (Robust)
                  if (window.mermaid) {
                      if (!window.mermaidInitialized) {
                          window.mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
                          window.mermaidInitialized = true;
                      }
                      
                      const nodes = wrapper.querySelectorAll('.mermaid, pre > code.language-mermaid, div.mermaid');
                      if (nodes.length > 0) {
                          const p = Promise.all(Array.from(nodes).map(async (el, index) => {
                              const id = 'mermaid-' + e.id + '-' + index + '-' + Math.round(Math.random() * 10000);
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
                                  
                                  const { svg } = await window.mermaid.render(id, graphDefinition);
                                  const successContainer = document.getElementById(id);
                                  if (successContainer) successContainer.innerHTML = svg;
                              } catch (err) {
                                  console.error('Mermaid render error for id ' + id, err);
                                  const errorContainer = document.getElementById(id);
                                  if (errorContainer) {
                                    errorContainer.innerHTML = '<div style="color:red;border:1px solid red;padding:5px;font-size:10px;">Mermaid Error: ' + err.message + '</div>';
                                  }
                              }
                          }));
                          promises.push(p);
                      }
                  }


                  // Ensure we append to #world-layer
                  const world = document.getElementById('world-layer') || document.body;
                  world.appendChild(host);
                  window.__activeSnippets.set(e.id, host);

              const scaleToFit = () => {
                const targetW = host.clientWidth;
                const targetH = host.clientHeight;
                const rect = wrapper.getBoundingClientRect();
                const rawW = rect.width || wrapper.scrollWidth || 1;
                const rawH = rect.height || wrapper.scrollHeight || 1;
                const scale = Math.min(targetW / rawW, targetH / rawH);
                wrapper.style.transform = `scale(${scale})`;
                const scaledW = rawW * scale;
                const scaledH = rawH * scale;
                const offsetX = Math.max(0, (targetW - scaledW) / 2);
                const offsetY = Math.max(0, (targetH - scaledH) / 2);
                wrapper.style.left = offsetX + 'px';
                wrapper.style.top = offsetY + 'px';
              };
              // Initial scale after layout
              requestAnimationFrame(scaleToFit);
              // Recompute when media loads
              wrapper.querySelectorAll('img,video').forEach((el) => {
                if (el.complete) {
                  requestAnimationFrame(scaleToFit);
                } else {
                  el.addEventListener('load', () => requestAnimationFrame(scaleToFit), { once: true });
                }
              });
            }

            // Always update geometry (in case dimensions/position change)
            host.style.left = (e.x | 0) + 'px';
            host.style.top = (e.y | 0) + 'px';
            host.style.width = (e.w | 0) + 'px';
            host.style.height = (e.h | 0) + 'px';
            if (typeof e.z !== 'undefined') host.style.zIndex = String(e.z);
          }
          await Promise.all(promises);
        };
        // Caption helper: unique caption host (id: caption)
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
            document.body.appendChild(host);
            const root = host.attachShadow({ mode: 'open' });
            const wrapper = document.createElement('div');
            wrapper.id = 'content-wrapper';
            wrapper.style.position = 'absolute';
            wrapper.style.left = '0px';
            wrapper.style.top = '0px';
            wrapper.style.transformOrigin = 'top left';
            root.appendChild(wrapper);
            // Append to UI layer (HUD)
            const ui = document.getElementById('ui-layer') || document.body;
            ui.appendChild(host);
            window.__activeSnippets.set(id, host);
          }
          const root = host.shadowRoot;
          const wrapper = root.getElementById('content-wrapper');
          wrapper.innerHTML = e.html;
          // position and scale
          host.style.left = (e.x | 0) + 'px';
          host.style.top = (e.y | 0) + 'px';
          host.style.width = (e.w | 0) + 'px';
          host.style.height = (e.h | 0) + 'px';
          requestAnimationFrame(() => {
            const targetW = host.clientWidth;
            const targetH = host.clientHeight;
            const rect = wrapper.getBoundingClientRect();
            const rawW = rect.width || wrapper.scrollWidth || 1;
            const rawH = rect.height || wrapper.scrollHeight || 1;
            const scale = Math.min(targetW / rawW, targetH / rawH);
            wrapper.style.transform = `scale(${scale})`;
            const scaledW = rawW * scale;
            const scaledH = rawH * scale;
            const offsetX = Math.max(0, (targetW - scaledW) / 2);
            const offsetY = Math.max(0, (targetH - scaledH) / 2);
            wrapper.style.left = offsetX + 'px';
            wrapper.style.top = offsetY + 'px';
          });
        };
        """
    )

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

                <style>
                  html, body { margin:0; padding:0; width:100%; height:100%; background:REPLACE_BG; overflow:hidden; }
                  body { position:relative; }
                  pre { white-space: pre-wrap; word-wrap: break-word; }

                  /* Visual cues for interactive elements */
                  .hover-target:hover { outline: 2px dashed #3b82f6; cursor: grab; }
                  .is-dragging { outline: 2px solid #3b82f6; cursor: grabbing; user-select: none; }
                  [contenteditable="true"] { outline: 2px solid #22c55e; cursor: text; min-width: 10px; }

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
                                      throwOnError : false
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
                    if (window.Vivus) {
                      var cb = typeof callback === 'function' ? callback : undefined;
                      try {
                          let target = svgId;
                          if (typeof svgId === 'string' && !svgId.startsWith('#') && !document.getElementById(svgId)) {
                               new Vivus(svgId, {
                                duration: duration || 100,
                                type: 'oneByOne',
                                animTimingFunction: Vivus.EASE_OUT
                              }, cb);
                          } else {
                               new Vivus(svgId, {
                                duration: duration || 100,
                                type: 'oneByOne',
                                animTimingFunction: Vivus.EASE_OUT
                              }, cb);
                          }
                      } catch(e) { console.warn('Vivus init error', e); }
                    }
                  };

                  // Hand-drawn annotation
                  window.annotate = function(selectorOrEl, options) {
                    if (window.RoughNotation) {
                      const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
                      if (el) {
                        const annotation = RoughNotation.annotate(el, {
                          type: options.type || 'underline',
                          color: options.color || '#dc2626',
                          strokeWidth: options.strokeWidth || 3,
                          padding: options.padding || 5,
                          animationDuration: options.duration || 800
                        });
                        annotation.show();
                        return annotation;
                      }
                    }
                    return null;
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

                  // Typewriter effect
                  window.typewriter = function(selectorOrEl, duration, delay) {
                    const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
                    if (!el) return;
                    const text = el.textContent;
                    el.textContent = '';
                    el.style.opacity = '1';
                    let i = 0;
                    const speed = (duration || 1) * 1000 / text.length;
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

                  // Reveal lines with stagger
                  window.revealLines = function(selectorOrEl, staggerDelay) {
                    const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
                    if (!el) return;
                    const lines = el.querySelectorAll('.line');
                    if (lines.length === 0) {
                      window.fadeIn(el, 0.5);
                      return;
                    }
                    gsap.fromTo(lines,
                      {opacity: 0, y: 20},
                      {opacity: 1, y: 0, duration: 0.4, stagger: staggerDelay || 0.3, ease: 'power2.out'}
                    );
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
                      
                      // Pause global timeline for frame rendering
                      if (window.gsap) {
                          gsap.ticker.remove(gsap.ticker.tick);
                          gsap.globalTimeline.pause();
                      }
                  });
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
                  host.style.overflow = 'hidden';
                  host.style.pointerEvents = 'none';
                  host.style.background = 'transparent';
                  host.style.pointerEvents = 'none';
                  host.style.background = 'transparent';
                  const world = document.getElementById('world-layer') || document.body;
                  world.appendChild(host);
                  const root = host.attachShadow({ mode: 'open' });
                  const wrapper = document.createElement('div');
                  wrapper.id = 'content-wrapper';
                  wrapper.style.position = 'absolute';
                  wrapper.style.left = '0px';
                  wrapper.style.top = '0px';
                  wrapper.style.transformOrigin = 'top left';
                  // Force centering
                  wrapper.style.display = 'flex';
                  wrapper.style.flexDirection = 'column';
                  wrapper.style.justifyContent = 'center';
                  wrapper.style.alignItems = 'center';
                  wrapper.style.textAlign = 'center';

                  wrapper.style.textAlign = 'center';

                  // Inject CSS into Shadow DOM for KaTeX and Prism
                  const katexCss = document.createElement('link');
                  katexCss.rel = 'stylesheet';
                  katexCss.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
                  
                  const prismCss = document.createElement('link');
                  prismCss.rel = 'stylesheet';
                  prismCss.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';

                  root.appendChild(katexCss);
                  root.appendChild(prismCss);

                  wrapper.innerHTML = e.html;
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
                          throwOnError: false
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
                            // Creator of scoped GSAP instance
                            const createScopedGsap = () => {
                                const g = { ...window.gsap }; // shallow clone
                                
                                const resolve = (target) => {
                                    if (typeof target === 'string') {
                                        return Array.from(scope.querySelectorAll(target));
                                    }
                                    return target;
                                };

                                g.to = (target, vars) => window.gsap.to(resolve(target), vars);
                                g.from = (target, vars) => window.gsap.from(resolve(target), vars);
                                g.fromTo = (target, f, t) => window.gsap.fromTo(resolve(target), f, t);
                                g.set = (target, vars) => window.gsap.set(resolve(target), vars);
                                g.timeline = (vars) => {
                                    const tl = window.gsap.timeline(vars);
                                    // Wrap timeline methods if needed, but usually .to/.from are called on tl
                                    // For now, let's assume simple usage. 
                                    // Getting extensive with timeline proxying is complex. 
                                    // Let's rely on g.from/g.to interactions.
                                    // Ideally we proxy the timeline object too:
                                    const explicitProxy = (tlInstance) => {
                                        const originalTo = tlInstance.to.bind(tlInstance);
                                        const originalFrom = tlInstance.from.bind(tlInstance);
                                        const originalFromTo = tlInstance.fromTo.bind(tlInstance);
                                        const originalSet = tlInstance.set.bind(tlInstance);
                                        
                                        tlInstance.to = (t, v, p) => { originalTo(resolve(t), v, p); return tlInstance; };
                                        tlInstance.from = (t, v, p) => { originalFrom(resolve(t), v, p); return tlInstance; };
                                        tlInstance.fromTo = (t, f, to, p) => { originalFromTo(resolve(t), f, to, p); return tlInstance; };
                                        tlInstance.set = (t, v, p) => { originalSet(resolve(t), v, p); return tlInstance; };
                                        return tlInstance;
                                    };
                                    return explicitProxy(tl);
                                };
                                return g;
                            };

                            const gsap = createScopedGsap();
                            // Also expose standard ScrollTrigger? Not relevant for video.
                            
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

                  // Trigger Mermaid (Robust)
                  const promises = [];
                  if (window.mermaid) {
                      if (!window.mermaidInitialized) {
                          window.mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
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

                  Promise.all(promises).then(() => {
                      requestAnimationFrame(scaleToFit);
                  });

                  const scaleToFit = () => {
                    const targetW = host.clientWidth;
                    const targetH = host.clientHeight;
                    const rect = wrapper.getBoundingClientRect();
                    const rawW = rect.width || wrapper.scrollWidth || 1;
                    const rawH = rect.height || wrapper.scrollHeight || 1;
                    const scale = Math.min(targetW / rawW, targetH / rawH);
                    wrapper.style.transform = `scale(${scale})`;
                    const scaledW = rawW * scale;
                    const scaledH = rawH * scale;
                    const offsetX = Math.max(0, (targetW - scaledW) / 2);
                    const offsetY = Math.max(0, (targetH - scaledH) / 2);
                    wrapper.style.left = offsetX + 'px';
                    wrapper.style.top = offsetY + 'px';
                  };
                  requestAnimationFrame(scaleToFit);
                  wrapper.querySelectorAll('img,video').forEach((el) => {
                    if (el.complete) {
                      requestAnimationFrame(scaleToFit);
                    } else {
                      el.addEventListener('load', () => requestAnimationFrame(scaleToFit), { once: true });
                    }
                  });
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
                host.style.pointerEvents = 'none';
                host.style.background = 'transparent';
                const ui = document.getElementById('ui-layer') || document.body;
                ui.appendChild(host);
                const root = host.attachShadow({ mode: 'open' });
                const wrapper = document.createElement('div');
                wrapper.id = 'content-wrapper';
                wrapper.style.position = 'absolute';
                wrapper.style.left = '0px';
                wrapper.style.top = '0px';
                wrapper.style.transformOrigin = 'top left';
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
              requestAnimationFrame(() => {
                const targetW = host.clientWidth;
                const targetH = host.clientHeight;
                const rect = wrapper.getBoundingClientRect();
                const rawW = rect.width || wrapper.scrollWidth || 1;
                const rawH = rect.height || wrapper.scrollHeight || 1;
                const scale = Math.min(targetW / rawW, targetH / rawH);
                wrapper.style.transform = `scale(${scale})`;
                const scaledW = rawW * scale;
                const scaledH = rawH * scale;
                const offsetX = Math.max(0, (targetW - scaledW) / 2);
                const offsetY = Math.max(0, (targetH - scaledH) / 2);
                wrapper.style.left = offsetX + 'px';
                wrapper.style.top = offsetY + 'px';
              });
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
    if not isinstance(data, list):
        raise ValueError("JSON root must be a list of entries")
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
    if not words:
        return []
    segments: List[Dict[str, Any]] = []
    current: List[Dict[str, Any]] = [words[0]]
    for prev, cur in zip(words, words[1:]):
        gap = max(0.0, cur["start"] - prev["end"])
        if gap > gap_threshold:
            start = current[0]["start"]
            end = current[-1]["end"]
            text = " ".join(w["word"] for w in current)
            segments.append({"start": start, "end": end, "text": text})
            current = [cur]
        else:
            current.append(cur)
    if current:
        start = current[0]["start"]
        end = current[-1]["end"]
        text = " ".join(w["word"] for w in current)
        segments.append({"start": start, "end": end, "text": text})
    return segments


def _active_caption_at(segments: List[Dict[str, Any]], t: float) -> Dict[str, Any]:
    for seg in segments:
        if seg["start"] <= t <= seg["end"]:
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
    # defaults
    return {
        "font_family": data.get("font_family", "Inter, sans-serif"),
        "font_size": data.get("font_size", 48),
        "font_color": data.get("font_color", "#FFFFFF"),
        "font_weight": data.get("font_weight", 700),
        "background_color": data.get("background_color", "rgba(0,0,0,0.55)"),
        "padding_px": data.get("padding_px", 16),
        "border_radius_px": data.get("border_radius_px", 12),
        "gap_threshold_seconds": data.get("gap_threshold_seconds", 0.6),
        "box": data.get("box", {"x": 120, "y": 840, "w": 1680, "h": 200}),
        "text_align": data.get("text_align", "center"),
        "line_height": data.get("line_height", 1.2),
        "max_lines": data.get("max_lines", 2),
        # When true, do not escape caption text; allow inline HTML annotations
        "allow_html": data.get("allow_html", False),
        # When true, render per-word spans and highlight the active word
        "annotate_active_word": data.get("annotate_active_word", False),
        # Style for the active word span (applied when annotate_active_word=true)
        "active_word_css": data.get("active_word_css", "font-weight:700; text-decoration:underline;"),
        # Style for non-active word spans
        "inactive_word_css": data.get("inactive_word_css", "opacity:0.9;"),
        # Limit for single-line sliding window (number of words)
        "max_words_per_line": int(data.get("max_words_per_line", 8)),
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
    duration: float = float(audio_clip.duration)
    total_frames = int(math.ceil(duration * fps))

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
        caption_words = words
        caption_settings = _load_caption_settings(settings_p)
        caption_segments = _build_caption_segments(words, caption_settings["gap_threshold_seconds"])
        caption_styles = caption_settings
        box = caption_settings["box"]
        caption_box = {"x": int(box.get("x", 120)), "y": int(box.get("y", height - 280)), "w": int(box.get("w", width - 240)), "h": int(box.get("h", 200))}

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
        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
        
        _prepare_page(page, width=width, height=height, background_color=background_color)
        if not show_character:
            page.evaluate("() => window.__updateCharacter && window.__updateCharacter(null)")

        for frame_index in tqdm(range(total_frames), total=total_frames, desc="Rendering frames", unit="frame"):
            t = frame_index / float(fps)
            active = _active_entries_at(timeline, t)
            # Add branding if enabled
            if show_branding and branding_entry:
                active.append(branding_entry)
            # Update DOM for overlays
            # Update DOM for current time
            # Update DOM for overlays
            # Update DOM for current time
            page.evaluate("async (entries) => await window.__updateSnippets(entries)", active)

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

            # Update caption if enabled
            if show_captions and caption_segments:
                seg = _active_caption_at(caption_segments, t)
                if seg:
                    style = caption_styles
                    allow_html = bool(style.get("allow_html", False))
                    annotate_active_word = bool(style.get("annotate_active_word", False))

                    # Build caption inner HTML (either plain text or per-word spans)
                    content_html = ""
                    if caption_words:
                        # Gather words within the current segment
                        seg_start = float(seg.get("start", t)) if "start" in seg else None
                        seg_end = float(seg.get("end", t)) if "end" in seg else None
                        if seg_start is None or seg_end is None:
                            raw_text = seg.get("text", "")
                            content_html = raw_text if allow_html else _html_escape(raw_text)
                        else:
                            active_css = str(style.get("active_word_css", "font-weight:700; text-decoration:underline;"))
                            inactive_css = str(style.get("inactive_word_css", "opacity:0.9;"))
                            words_in_seg: List[Dict[str, Any]] = [
                                w for w in caption_words
                                if (w["start"] >= seg_start - 1e-6 and w["end"] <= seg_end + 1e-6)
                            ]
                            if not words_in_seg:
                                raw_text = seg.get("text", "")
                                content_html = raw_text if allow_html else _html_escape(raw_text)
                            else:
                                # Determine active word index
                                active_index = 0
                                for i, w in enumerate(words_in_seg):
                                    if w["start"] <= t <= w["end"]:
                                        active_index = i
                                        break
                                    if w["start"] > t:
                                        active_index = max(0, i - 1)
                                        break

                                # For single-line display, create a sliding window around the active word
                                try:
                                    max_words = max(1, int(style.get("max_words_per_line", 8)))
                                except Exception:
                                    max_words = 8

                                # Center active word when possible
                                half = max_words // 2
                                start_i = max(0, active_index - half)
                                end_i = min(len(words_in_seg), start_i + max_words)
                                start_i = max(0, end_i - max_words)

                                window = words_in_seg[start_i:end_i]

                                pieces: List[str] = []
                                for i, w in enumerate(window):
                                    original_index = start_i + i
                                    is_active = (original_index == active_index)
                                    word_text = w["word"] if allow_html else _html_escape(str(w["word"]))
                                    css = active_css if (annotate_active_word and is_active) else inactive_css
                                    pieces.append(f"<span style=\"{css}\">{word_text}</span>")
                                content_html = " ".join(pieces) if pieces else (seg.get("text", "") if allow_html else _html_escape(seg.get("text", "")))
                    else:
                        raw_text = seg.get("text", "") if seg else ""
                        content_html = raw_text if allow_html else _html_escape(raw_text)

                    # Build line handling CSS
                    try:
                        max_lines_val = int(style.get("max_lines", 0))
                    except Exception:
                        max_lines_val = 0
                    if max_lines_val == 1:
                        clamp_css = "display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
                    elif max_lines_val and max_lines_val > 1:
                        clamp_css = f"display:-webkit-box; -webkit-line-clamp:{max_lines_val}; -webkit-box-orient: vertical; overflow:hidden; white-space:normal;"
                    else:
                        clamp_css = "display:block; overflow:hidden; white-space:normal;"

                    html = (
                        f"<div style=\"width:{caption_box['w']}px; height:{caption_box['h']}px; display:flex; align-items:center; justify-content:center;\">"
                        f"<div style=\"max-width:100%; width:100%; box-sizing:border-box; color:{style['font_color']}; "
                        f"font-family:{style['font_family']}; font-size:{style['font_size']}px; "
                        f"font-weight:{style['font_weight']}; line-height:{style['line_height']}; "
                        f"text-align:{style['text_align']}; background:{style['background_color']}; "
                        f"padding:{style['padding_px']}px; border-radius:{style['border_radius_px']}px; {clamp_css} word-break:break-word;\">{content_html}</div>"
                        f"</div>"
                    )
                    entry = {"x": caption_box["x"], "y": caption_box["y"], "w": caption_box["w"], "h": caption_box["h"], "html": html}
                    page.evaluate("(entry) => window.__updateCaption(entry)", entry)
                else:
                    page.evaluate("() => window.__updateCaption(null)")
            else:
                # ensure no caption if disabled
                page.evaluate("() => window.__updateCaption && window.__updateCaption(null)")

            # Capture frame immediately after state change (represents time t)
            if frame_index % 30 == 0:
                print(f"DEBUG: Processing frame {frame_index}/{total_frames} (t={t:.2f}s)")

            # Capture frame immediately after state change (represents time t)
            # Sync GSAP animation to exact time t
            page.evaluate(f"gsap.globalTimeline.totalTime({t}); void 0;")

            # Capture frame immediately after state change (represents time t)
            frame_path = frames_dir / f"frame_{frame_index:06d}.png"
            try:
                page.screenshot(path=str(frame_path), type="png", timeout=5000)
            except Exception as e:
                print(f"❌ Screenshot failed at frame {frame_index}: {e}")
                # Try to proceed or abort? Aborting is safer to avoid long hangs.
                raise e

        print("DEBUG: Finished rendering loop. Closing context...")
        context.close()
        print("DEBUG: Context closed. Closing browser...")
        browser.close()
        print("DEBUG: Browser closed.")

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
    )
    print(f"Video written to: {result_path}")


