"""Shared dispatcher-install JS for the production renderer + preview paths.

This file holds the JavaScript that installs `window.__updateSnippets` and
related shadow-DOM dispatchers onto a Playwright page. It used to live
inline in `generate_video.py:_prepare_page`; it was extracted so the
single-shot preview path (`screenshot_worker.record_shot_mp4`) can install
the byte-identical dispatcher and produce a preview MP4 that matches what
the production /jobs render would produce for the same shot.

DO NOT edit the JS body without understanding both call sites:
  - generate_video.py:_prepare_page       (sync Playwright)
  - screenshot_worker.py:record_shot_mp4  (async Playwright)
Both pass the result of `get_dispatcher_install_js(libs)` to page.evaluate,
where `libs` is the local file:// URL where bundled assets live (used by the
character-mouth phoneme system; safely empty for the preview path).
"""
from __future__ import annotations


# REGULAR (non-raw) triple-quoted string so Python halves source backslashes
# (`\\s` → `\s`, `\\/` → `\/`) the same way the original
# `page.evaluate("""...""")` did in generate_video.py. Using r"""...""" here
# would double-escape regex literals and break JS parsing — which we already
# burned ourselves on.
# REPLACE_LIBS is substituted at install time with the assets/libs URL.
_DISPATCHER_INSTALL_JS_TEMPLATE = """
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
                  // DIAGNOSTIC: log exactly what the dispatcher receives for
                  // this shot. If timescale is undefined here for a shot that
                  // should have one, the data is being dropped between
                  // generate_video.py:_active_entries_at and JS — fix the
                  // Python side. If timescale arrives correctly but the
                  // [per-shot-timeline] line below never appears, the JS
                  // condition is rejecting it — fix JS.
                  console.log('[TS-RX] id=' + e.id
                    + ' timescale=' + (typeof e.timescale === 'number' ? e.timescale.toFixed(4) : String(e.timescale))
                    + ' inTime=' + e.inTime);
                  // Seek GSAP timeline to the shot's inTime BEFORE creating
                  // the snippet. Scripts inside the HTML create GSAP tweens
                  // with delays relative to the current globalTimeline time.
                  // Without this, tweens get wrong start times (especially in
                  // parallel workers that start mid-video).
                  if (window.gsap && typeof e.inTime === 'number') {
                    try {
                      gsap.globalTimeline.totalTime(e.inTime);
                    } catch(err) {}
                  }
                  host = document.createElement('div');
                  host.id = e.id;
                  host.dataset.inTime = String(e.inTime || 0);
                  host.style.position = 'absolute';
                  host.style.overflow = 'visible'; // Allow annotations to flow outside
                  host.style.pointerEvents = 'none';
                  host.style.background = 'transparent';
                  const world = document.getElementById('world-layer') || document.body;
                  world.appendChild(host);

                  // ── Per-shot child timeline for FE-editor vx-timescale ──
                  // The FE editor injects `<script data-vx-timescale="X">gsap.globalTimeline.timeScale(X)`
                  // which would poison globalTimeline if applied directly (every other shot's
                  // tweens would slow down/speed up too). shot_preprocess.py strips that <script>
                  // and passes the timescale value via `e.timescale`. We create a child timeline at
                  // e.inTime with timeScale(X) and route the shot's gsap.* calls through it (see
                  // createScopedGsap below). All tween timing constants — including variable
                  // expressions like `delay: i * 0.9` — get the timescale applied automatically.
                  if (window.gsap
                      && typeof e.timescale === 'number'
                      && e.timescale > 0
                      && Math.abs(e.timescale - 1) > 0.001) {
                      try {
                          // Order matters: add() re-parents and can reset some
                          // internal state; we set timeScale AFTER the add to
                          // guarantee it sticks. Using lib.globalTimeline.add()
                          // first attaches at the right startTime, then
                          // .timeScale() applies the editor scale.
                          const _shotTL = window.gsap.timeline({ paused: false });
                          window.gsap.globalTimeline.add(_shotTL, e.inTime || 0);
                          _shotTL.timeScale(e.timescale);
                          host._shotTL = _shotTL;
                          // DIAGNOSTIC: log not just the requested timescale
                          // but the EFFECTIVE timeScale gsap reports back, plus
                          // the parent gtl time at attach. If applied!=requested
                          // something is silently overriding it (e.g. legacy
                          // vx-timescale per-child loop firing on shotTL).
                          var _applied = (typeof _shotTL.timeScale === 'function')
                              ? _shotTL.timeScale() : 'n/a';
                          var _gtl_t = (window.gsap.globalTimeline
                              && typeof window.gsap.globalTimeline.totalTime === 'function')
                              ? window.gsap.globalTimeline.totalTime() : 'n/a';
                          console.log('[per-shot-timeline] ' + e.id
                              + ' requested=' + e.timescale.toFixed(4)
                              + ' applied=' + (typeof _applied === 'number' ? _applied.toFixed(4) : _applied)
                              + ' inTime=' + (e.inTime || 0)
                              + ' gtl.totalTime=' + (typeof _gtl_t === 'number' ? _gtl_t.toFixed(2) : _gtl_t));
                      } catch (err) {
                          console.warn('[per-shot-timeline] failed for ' + e.id + ':',
                              err && err.message);
                      }
                  }

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

                  // 1.5. Rewrite :root to :host so CSS variables apply inside shadow DOM.
                  // The LLM often generates `:root { --primary: ... }` which doesn't work
                  // in shadow DOM (no document root). `:host` is the shadow DOM equivalent.
                  processedHtml = processedHtml.split(':root').join(':host');

                  // 1.6. Rewrite body/html selectors for shadow DOM compatibility.
                  // LLM generates full HTML documents with `body { width:100vw; ... }`
                  // which works in iframe (FE) but not in shadow DOM (render).
                  processedHtml = processedHtml.replace(/(?:^|[\\s,;{}])body\\s*\\{/gm, ' #content-wrapper {');
                  processedHtml = processedHtml.replace(/(?:^|[\\s,;{}])html\\s*\\{/gm, ' :host {');

                  // 1.7. Strip full document structure (<!DOCTYPE>, <html>, <head>, <body>)
                  if (processedHtml.includes('<!DOCTYPE') || processedHtml.includes('<html')) {
                    const headMatch = processedHtml.match(/<head[^>]*>([\\s\\S]*?)<\\/head>/i);
                    const headContent = headMatch ? headMatch[1] : '';
                    const bodyMatch = processedHtml.match(/<body[^>]*>([\\s\\S]*?)<\\/body>/i);
                    const bodyContent = bodyMatch ? bodyMatch[1] : processedHtml;
                    const styles = (headContent.match(/<style[\\s\\S]*?<\\/style>/gi) || []).join('');
                    const links = (headContent.match(/<link[^>]*>/gi) || []).join('');
                    processedHtml = styles + links + bodyContent;
                  }

                  // 2. placeholder.png: replace with transparent 1x1 GIF
                  if (processedHtml.includes('placeholder.png')) {
                    const TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                    processedHtml = processedHtml.replace(/src=['"]placeholder\\.png['"]/g, 'src="' + TRANSPARENT + '"');
                    processedHtml = '<style>.generated-image{opacity:0!important}.image-hero{background:linear-gradient(160deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)!important}</style>' + processedHtml;
                  }

                  wrapper.innerHTML = processedHtml;
                  root.appendChild(wrapper);
                  window.__activeSnippets.set(e.id, host);

                  // Mirror every external stylesheet AND inline @font-face rule from
                  // the shadow root into document.head so fonts register globally with
                  // document.fonts. Shadow-DOM-only stylesheets don't always populate
                  // the doc-level FontFaceSet reliably, causing fallback fonts to
                  // render with wrong text metrics (e.g. Montserrat → system sans,
                  // "PASSWORDS" overflows canvas). Three vectors covered:
                  //   1. <link rel="stylesheet"> (anywhere in shadow root)
                  //   2. @import url(...) inside <style> blocks
                  //   3. @font-face { src: url(...) } inside <style> blocks
                  // De-dupe by href/url so we don't re-fetch on every segment.
                  if (!window.__globalLinkCache) window.__globalLinkCache = new Set();
                  if (!window.__globalFontFaceCache) window.__globalFontFaceCache = new Set();
                  const __addGlobalStylesheet = (href) => {
                      if (!href || window.__globalLinkCache.has(href)) return;
                      window.__globalLinkCache.add(href);
                      const clone = document.createElement('link');
                      clone.rel = 'stylesheet';
                      clone.href = href;
                      document.head.appendChild(clone);
                  };
                  const __addGlobalFontFace = (cssBlock) => {
                      const key = cssBlock.replace(/\\s+/g, ' ').trim();
                      if (!key || window.__globalFontFaceCache.has(key)) return;
                      window.__globalFontFaceCache.add(key);
                      const styleEl = document.createElement('style');
                      styleEl.setAttribute('data-snippet-fontface', '1');
                      styleEl.textContent = cssBlock;
                      document.head.appendChild(styleEl);
                  };
                  // Walk both wrapper and the shadow root itself (renderer adds Google
                  // Fonts / KaTeX / Prism links directly to root, not inside wrapper).
                  const __scanLinks = (scope) => {
                      scope.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
                          __addGlobalStylesheet(l.getAttribute('href'));
                      });
                  };
                  __scanLinks(wrapper);
                  // root.querySelectorAll only descends into shadow root direct children,
                  // not into the wrapper subtree (already covered above).
                  Array.from(root.children).forEach(child => {
                      if (child.tagName === 'LINK' && child.rel === 'stylesheet') {
                          __addGlobalStylesheet(child.getAttribute('href'));
                      }
                  });
                  // Pull @import urls and @font-face blocks out of inline <style> tags
                  const __importRe = /@import\\s+(?:url\\()?["']?([^"')]+)["']?\\)?[^;]*;?/g;
                  const __fontFaceRe = /@font-face\\s*\\{[^}]*\\}/g;
                  const __scanStyles = (scope) => {
                      scope.querySelectorAll('style').forEach(s => {
                          const css = s.textContent || '';
                          let m;
                          while ((m = __importRe.exec(css)) !== null) {
                              __addGlobalStylesheet(m[1]);
                          }
                          let f;
                          while ((f = __fontFaceRe.exec(css)) !== null) {
                              __addGlobalFontFace(f[0]);
                          }
                      });
                  };
                  __scanStyles(wrapper);
                  Array.from(root.children).forEach(child => {
                      if (child.tagName === 'STYLE') {
                          const css = child.textContent || '';
                          let m;
                          while ((m = __importRe.exec(css)) !== null) {
                              __addGlobalStylesheet(m[1]);
                          }
                          let f;
                          while ((f = __fontFaceRe.exec(css)) !== null) {
                              __addGlobalFontFace(f[0]);
                          }
                      }
                  });

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
                  // ── PRE-SCRIPT GSAP CHECKPOINT ──
                  // Snapshot globalTimeline children that exist BEFORE this shot's
                  // scripts run. The pipeline injects a stretch-to-fit-audio script
                  //   <script data-vx-timescale="X">gsap.globalTimeline.timeScale(X);</script>
                  // but mutating timeScale on the GLOBAL timeline (a) leaks into every
                  // subsequent shot in the chunk — they share the same globalTimeline,
                  // see worker.py:312 — and (b) is applied AFTER the LLM tweens are
                  // placed, so scrub-rendering's `totalTime(state.t)` maps onto the
                  // wrong child positions and tweens never fire in their shot window.
                  // Fix: scale only the children added by this shot, computed as the
                  // diff against this checkpoint, via per-child .timeScale().
                  const _gtlPreSet = (() => {
                      try {
                          if (!window.gsap || !window.gsap.globalTimeline) return new Set();
                          return new Set(window.gsap.globalTimeline.getChildren(false, true, true));
                      } catch (_err) { return new Set(); }
                  })();
                  const _gtlPreStashKey = '__sd_gtl_pre_' + e.id;
                  window[_gtlPreStashKey] = _gtlPreSet;
                  const scripts = wrapper.querySelectorAll('script');
                  scripts.forEach(oldScript => {
                      // ── External script (src=...) — DO NOT activate ──
                      // LLM-generated HTML sometimes injects a CDN load like
                      //   <script src="https://cdnjs.../gsap.min.js"></script>
                      // The harness already provides gsap, anime, RoughNotation,
                      // Vivus, KaTeX, Prism. Letting the LLM's CDN script load
                      // re-assigns window.gsap to a fresh instance — orphaning
                      // the harness's globalTimeline (which the scrub-renderer
                      // calls totalTime() on) and breaking every subsequent
                      // shot in the chunk. Skip activation entirely; the inert
                      // <script src="..."> tag injected via innerHTML never
                      // executes on its own, so leaving it is harmless.
                      if (oldScript.hasAttribute && oldScript.hasAttribute('src')) {
                          const _src = oldScript.getAttribute('src') || '';
                          console.warn('[snippet shot=' + e.id + '] skipping external script load (would orphan harness globals): ' + _src);
                          try { oldScript.remove(); } catch (_e) {}
                          return;
                      }
                      const newScript = document.createElement('script');
                      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));

                      // Wrap content in IIFE with scoped GSAP.
                      // Rewrite the LLM source so window.RoughNotation/window.Vivus/document.querySelector
                      // calls go through our scoped helpers and resolve elements from the shadow root.
                      let originalCode = oldScript.textContent;
                      // ── data-vx-timescale handling ──
                      // If this is the pipeline's stretch-script, replace the body with
                      // per-child timeScale on just this shot's new globalTimeline kids.
                      // Otherwise, defensively neutralise any direct globalTimeline.timeScale
                      // call so a stray LLM/template snippet can't leak into other shots.
                      const _vxTs = (oldScript.dataset && oldScript.dataset.vxTimescale)
                          ? parseFloat(oldScript.dataset.vxTimescale) : NaN;
                      if (!isNaN(_vxTs) && _vxTs > 0 && Math.abs(_vxTs - 1) > 1e-6) {
                          originalCode = '(function(){\\n'
                              + '  try {\\n'
                              + '    var lib = window.gsap;\\n'
                              + '    if (!lib || !lib.globalTimeline) return;\\n'
                              + '    var pre = window["' + _gtlPreStashKey + '"] || new Set();\\n'
                              + '    var kids = lib.globalTimeline.getChildren(false, true, true);\\n'
                              + '    var scaled = 0;\\n'
                              + '    for (var i = 0; i < kids.length; i++) {\\n'
                              + '      var c = kids[i];\\n'
                              + '      if (pre.has(c)) continue;\\n'
                              + '      try { c.timeScale(' + _vxTs + '); scaled++; } catch (e) {}\\n'
                              + '    }\\n'
                              + '    if (scaled > 0) console.log("[vx-timescale shot=' + e.id + '] scaled " + scaled + " children by ' + _vxTs + '");\\n'
                              + '  } catch (e) { console.warn("[vx-timescale] failed:", e && e.message); }\\n'
                              + '})();';
                      } else {
                          originalCode = originalCode.replace(
                              /gsap\\s*\\.\\s*globalTimeline\\s*\\.\\s*timeScale\\s*\\([^)]*\\)/g,
                              '/* sd-blocked: globalTimeline.timeScale leaks across shots */ undefined'
                          );
                      }
                      originalCode = originalCode.split('window.RoughNotation').join('__sd_RoughNotation');
                      originalCode = originalCode.split('new Vivus').join('new __sd_Vivus');
                      originalCode = originalCode.split('window.Vivus').join('__sd_Vivus');
                      originalCode = originalCode.split('window.d3').join('d3');
                      // Route `window.gsap.*` through the scoped `gsap` so `window.gsap.to()`
                      // / `window.gsap.timeline()` etc. pick up the per-shot child timeline
                      // when one is set (see Fix-2 in createScopedGsap above). Without this,
                      // a shot that explicitly addresses `window.gsap` bypasses our routing
                      // and its tweens land on globalTimeline at unscaled timing.
                      originalCode = originalCode.split('window.gsap').join('gsap');
                      originalCode = originalCode.split('document.getElementById').join('__sd_getElementById');
                      originalCode = originalCode.split('document.querySelectorAll').join('__sd_querySelectorAll');
                      originalCode = originalCode.split('document.querySelector').join('__sd_querySelector');
                      // Unwrap `document.addEventListener("DOMContentLoaded", handler)` and
                      // `window.addEventListener("load", handler)` — snippets run AFTER the page
                      // has loaded, so those events never fire. We convert them to direct
                      // invocation: `document.addEventListener("DOMContentLoaded", fn)` → `(fn)()`.
                      // Strategy: locate the call, find its matching close paren, then rewrite.
                      const _unwrapReadyListener = (src) => {
                          const pattern = /(document|window)\s*\.\s*addEventListener\s*\(\s*["'](DOMContentLoaded|load|readystatechange)["']\s*,\s*/g;
                          let out = '', last = 0, m;
                          while ((m = pattern.exec(src)) !== null) {
                              out += src.slice(last, m.index);
                              // find matching close paren for the addEventListener call
                              let i = m.index + m[0].length, depth = 1, inStr = null, esc = false;
                              while (i < src.length && depth > 0) {
                                  const c = src[i];
                                  if (esc) { esc = false; }
                                  else if (inStr) {
                                      if (c === '\\\\') esc = true;
                                      else if (c === inStr) inStr = null;
                                  } else if (c === '"' || c === "'" || c === '`') inStr = c;
                                  else if (c === '(') depth++;
                                  else if (c === ')') depth--;
                                  if (depth === 0) break;
                                  i++;
                              }
                              // handler expression is src[m.index+m[0].length .. i-1], optionally followed by ", options"
                              let handler = src.slice(m.index + m[0].length, i);
                              // Drop trailing options arg (simple heuristic: last top-level comma)
                              let pd = 0, cut = -1, ins = null, es = false;
                              for (let j = 0; j < handler.length; j++) {
                                  const ch = handler[j];
                                  if (es) { es = false; continue; }
                                  if (ins) { if (ch === '\\\\') es = true; else if (ch === ins) ins = null; continue; }
                                  if (ch === '"' || ch === "'" || ch === '`') { ins = ch; continue; }
                                  if (ch === '(' || ch === '[' || ch === '{') pd++;
                                  else if (ch === ')' || ch === ']' || ch === '}') pd--;
                                  else if (ch === ',' && pd === 0) cut = j;
                              }
                              if (cut >= 0) handler = handler.slice(0, cut);
                              out += '(' + handler + ')()';
                              last = i + 1;
                              pattern.lastIndex = last;
                          }
                          out += src.slice(last);
                          return out;
                      };
                      originalCode = _unwrapReadyListener(originalCode);
                      const scopedCode = `
                        (function(scope) {
                            // Helper to resolve selectors in this shadow root
                            const resolve = (s) => {
                                const el = (typeof s === 'string' ? scope.querySelector(s) : s);
                                // Don't warn — LLM-generated selectors may reference elements
                                // that don't exist yet or are in a different shadow root
                                return el;
                            };
                            const resolveAll = (s) => (typeof s === 'string' ? scope.querySelectorAll(s) : s);

                            // Shadow-DOM-aware document.* replacements (used after rewriting LLM source)
                            const __sd_getElementById = (id) => scope.querySelector('#' + CSS.escape(id));
                            const __sd_querySelector = (sel) => scope.querySelector(sel);
                            const __sd_querySelectorAll = (sel) => scope.querySelectorAll(sel);


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
                            const animateSVG = (id, dur, cb) => {
                                // Resolve from shadow root, retrying if not yet present
                                const tryResolve = (attempts) => {
                                    let el;
                                    if (typeof id === 'string') {
                                        // Try by ID then by tag/id selector inside shadow root
                                        el = scope.querySelector('#' + id) || scope.querySelector(id);
                                    } else {
                                        el = id;
                                    }
                                    if (el) {
                                        window.animateSVG(el, dur, cb);
                                    } else if (attempts > 0) {
                                        setTimeout(() => tryResolve(attempts - 1), 100);
                                    }
                                    // Silently give up after retries — element never appeared
                                };
                                tryResolve(15);
                            };

                            // Creator of scoped GSAP instance.
                            //
                            // When shotTL is provided (set by __updateSnippets when the entry
                            // has a non-identity vx-timescale), tween-creation calls are routed
                            // through that child timeline instead of gsap.globalTimeline. The
                            // child timeline carries the shot's per-shot timeScale, so EVERY
                            // tween authored by the shot — including variable-expression timing
                            // like delay = i * 0.9 — automatically gets the editor-edited
                            // duration, with no source rewriting required.
                            //
                            // To preserve the gsap.to() play-at-NOW+delay semantics that shot
                            // scripts assume (vs. tl.to()s default append-at-duration semantics),
                            // we explicitly pass shotTL.totalTime() as the position arg on
                            // every routed call. That places the tween at the timeline's
                            // current playhead, which at shot-mount time is 0, and during
                            // delayed callbacks tracks the parent's advancing playhead.
                            const createScopedGsap = (shotTL) => {
                                const _wg = window.gsap;
                                const _g = (typeof window.gsap !== 'undefined') ? window.gsap : _wg;
                                const g = _g ? { ..._g } : {};

                                const resolveGsap = (target) => {
                                    if (target == null) return target;
                                    if (typeof target === 'string') {
                                        return Array.from(scope.querySelectorAll(target));
                                    }
                                    if (Array.isArray(target)) {
                                        const out = [];
                                        for (const t of target) {
                                            if (typeof t === 'string') {
                                                for (const el of scope.querySelectorAll(t)) out.push(el);
                                            } else if (t) {
                                                out.push(t);
                                            }
                                        }
                                        return out;
                                    }
                                    return target;
                                };

                                // _safeCall always uses the live window.gsap when present,
                                // otherwise the captured _wg, otherwise a no-op. This
                                // prevents "Cannot read properties of undefined (reading
                                // fromTo)" errors that lock elements at opacity:0.
                                const _safeCall = (method, ...args) => {
                                    const lib = window.gsap || _wg;
                                    if (!lib || typeof lib[method] !== 'function') return undefined;
                                    try { return lib[method](...args); } catch (e) {
                                        console.warn('[scoped-gsap] ' + method + ' failed:', e && e.message);
                                        return undefined;
                                    }
                                };

                                // _safeShotCall routes through the per-shot child timeline,
                                // explicitly passing shotTL.totalTime() as the position so the
                                // tween appears at the timeline's current playhead (matching
                                // gsap.to's "play now + delay" semantics, NOT tl.to's default
                                // "append at duration" semantics).
                                const _safeShotCall = (method, target, vars) => {
                                    if (!shotTL || typeof shotTL[method] !== 'function') return shotTL;
                                    try {
                                        const pos = shotTL.totalTime();
                                        if (vars === undefined) {
                                            return shotTL[method](target, pos);
                                        }
                                        return shotTL[method](target, vars, pos);
                                    } catch (e) {
                                        console.warn('[per-shot-timeline] ' + method + ' failed:', e && e.message);
                                        return shotTL;
                                    }
                                };
                                const _safeShotFromTo = (target, fromVars, toVars) => {
                                    if (!shotTL || typeof shotTL.fromTo !== 'function') return shotTL;
                                    try {
                                        const pos = shotTL.totalTime();
                                        return shotTL.fromTo(target, fromVars, toVars, pos);
                                    } catch (e) {
                                        console.warn('[per-shot-timeline] fromTo failed:', e && e.message);
                                        return shotTL;
                                    }
                                };

                                if (shotTL) {
                                    g.to = (target, vars) => _safeShotCall('to', resolveGsap(target), vars);
                                    g.from = (target, vars) => _safeShotCall('from', resolveGsap(target), vars);
                                    g.fromTo = (target, f, t) => _safeShotFromTo(resolveGsap(target), f, t);
                                    // gsap.set MUST stay as instant passthrough — do NOT route through shotTL.
                                    // Reason: shot scripts authoring gsap.set on an element expect the
                                    // values applied to the DOM RIGHT NOW so the very first rendered frame (taken
                                    // before shotTL ticks for the first time) shows the correct initial state.
                                    // Routing through shotTL.set(target, vars, 0) queues the set as a 0-duration
                                    // tween at position 0; in nested timelines that is NOT honored as
                                    // immediate-render at insertion the same way gsap.set is, so elements
                                    // stay at CSS-default opacity:0 for the first frame(s) → entire shot
                                    // renders white. Per-shot timeScale only needs to scale animated tweens
                                    // (to/from/fromTo/delayedCall); set is timing-independent by definition.
                                    g.set = (target, vars) => _safeCall('set', resolveGsap(target), vars);
                                    g.delayedCall = (delay, callback, params) => {
                                        try {
                                            const pos = shotTL.totalTime() + (delay || 0);
                                            return shotTL.call(callback, params, pos);
                                        } catch (e) {
                                            console.warn('[per-shot-timeline] delayedCall failed:', e && e.message);
                                            return shotTL;
                                        }
                                    };
                                } else {
                                    g.to = (target, vars) => _safeCall('to', resolveGsap(target), vars);
                                    g.from = (target, vars) => _safeCall('from', resolveGsap(target), vars);
                                    g.fromTo = (target, f, t) => _safeCall('fromTo', resolveGsap(target), f, t);
                                    g.set = (target, vars) => _safeCall('set', resolveGsap(target), vars);
                                    g.delayedCall = (delay, callback, params) => _safeCall('delayedCall', delay, callback, params);
                                }

                                g.timeline = (vars) => {
                                    const lib = window.gsap || _wg;
                                    if (!lib || typeof lib.timeline !== 'function') {
                                        // Stub timeline so .to/.from/.fromTo/.set chains don't crash.
                                        const stub = {
                                            to: () => stub, from: () => stub,
                                            fromTo: () => stub, set: () => stub,
                                            add: () => stub, addLabel: () => stub,
                                            play: () => stub, pause: () => stub,
                                            seek: () => stub, kill: () => stub,
                                            duration: () => 0, totalDuration: () => 0,
                                        };
                                        return stub;
                                    }
                                    // gsap.timeline(vars) auto-attaches to gtl at startTime =
                                    // gtl.totalTime() (which the dispatcher just seeked to e.inTime).
                                    // Instead of re-parenting under shotTL (which empirically does
                                    // NOT propagate ticks reliably from gtl through shotTL into the
                                    // re-parented child — that was the v23–v28 bug: shotTL had the
                                    // right timeScale and the right children, but those children
                                    // never ticked, so all their tweens stayed at fromVars and the
                                    // shot rendered as its initial state forever) — we KEEP the new
                                    // tl as a direct child of gtl and just apply the per-shot
                                    // timeScale to it. tl is at the correct startTime already; with
                                    // tl.timeScale(shotTL.timeScale()) all its internal tween
                                    // positions / delays scale uniformly. Free-standing
                                    // gsap.to/from/fromTo/set/delayedCall calls in the same shot
                                    // still go through shotTL routing to get their delays scaled.
                                    const tl = lib.timeline(vars);
                                    if (shotTL && typeof shotTL.timeScale === 'function'
                                        && typeof tl.timeScale === 'function') {
                                        try { tl.timeScale(shotTL.timeScale()); }
                                        catch (e) {
                                            console.warn('[per-shot-timeline] tl.timeScale failed:', e && e.message);
                                        }
                                    }
                                    // ── Proxy wrapper instead of method-mutation ──
                                    // The previous explicitProxy approach mutated
                                    // tlInstance.to/from/fromTo/set directly with
                                    // own-property overrides. Empirically that broke
                                    // gsap's internal tick propagation: the underlying
                                    // tl was attached to gtl with the right startTime
                                    // / timeScale / paused=false / 19 inner tweens,
                                    // BUT those tweens did not advance forward when
                                    // gtl.totalTime() scrubbed past them — only the
                                    // immediate-render fromVars applied at script
                                    // time stuck. Visual evidence: shot-2 rendered
                                    // 100% white (tl.fromTo opacity:0->1 stuck at 0),
                                    // shot-1 EXECUTION GAP rendered at scale 0.5 not
                                    // scale 2 (tl.to scale tween never progressed),
                                    // shot-22 flash words stuck visible (first .to
                                    // fired but second .to didn't). Free-standing
                                    // gsap.to/fromTo/set calls (which bypass this
                                    // proxy) all worked.
                                    //
                                    // The Proxy below leaves the underlying tl's
                                    // own properties intact, so gsap's internal render
                                    // pipeline keeps treating it as a normal Timeline.
                                    // We only intercept the four selector-taking
                                    // methods to pre-resolve string targets via
                                    // shadow-DOM scope. Every other method passes
                                    // through, with its return value remapped to the
                                    // proxy so chains stay on the proxy.
                                    return new Proxy(tl, {
                                        get(target, prop, receiver) {
                                            const val = Reflect.get(target, prop);
                                            if (typeof val !== 'function') return val;
                                            if (prop === 'to' || prop === 'from' || prop === 'set') {
                                                return function (t, v, p) {
                                                    try { val.call(target, resolveGsap(t), v, p); }
                                                    catch (e) {
                                                        console.warn('[scoped-gsap] tl.' + prop + ' failed:', e && e.message);
                                                    }
                                                    return receiver;
                                                };
                                            }
                                            if (prop === 'fromTo') {
                                                return function (t, f, to, p) {
                                                    try { val.call(target, resolveGsap(t), f, to, p); }
                                                    catch (e) {
                                                        console.warn('[scoped-gsap] tl.fromTo failed:', e && e.message);
                                                    }
                                                    return receiver;
                                                };
                                            }
                                            // Generic passthrough: invoke method on the underlying
                                            // timeline. If gsap returns the timeline itself (typical
                                            // for chainable methods like .play/.pause/.seek), remap
                                            // the return value to the proxy so further chained calls
                                            // still go through our selector-resolving wrappers.
                                            return function (...args) {
                                                const result = val.apply(target, args);
                                                return result === target ? receiver : result;
                                            };
                                        }
                                    });
                                };
                                return g;
                            };

                            // Pull the per-shot timeline off the host, if __updateSnippets
                            // attached one (i.e., the entry has a non-identity vx-timescale).
                            // When null, scoped gsap falls back to the original globalTimeline
                            // routing — identical to pre-Fix-2 behavior for shots without
                            // editor-edited duration.
                            const _shotTL = (scope.host && scope.host._shotTL) || null;
                            const gsap = createScopedGsap(_shotTL);

                            // Scoped d3 proxy — d3.select/selectAll search inside shadow root
                            const d3 = window.d3 ? (() => {
                                const proxy = Object.create(window.d3);
                                proxy.select = (s) => typeof s === 'string'
                                    ? window.d3.select(scope.querySelector(s))
                                    : window.d3.select(s);
                                proxy.selectAll = (s) => typeof s === 'string'
                                    ? window.d3.selectAll(Array.from(scope.querySelectorAll(s)))
                                    : window.d3.selectAll(s);
                                return proxy;
                            })() : undefined;

                            // ── Scoped Anime.js proxy — resolves selectors inside this shadow root ──
                            // LLM uses: anime({targets: '#el', ...}) → scoped to shadow DOM
                            // LLM registers seekable timelines with: _animeR({instance: anime({autoplay:false,...}), startMs:500})
                            const anime = window.anime ? (function() {
                                const resolveTargets = (targets) => {
                                    if (typeof targets === 'string') {
                                        return Array.from(scope.querySelectorAll(targets));
                                    }
                                    return targets;
                                };
                                return function(opts) {
                                    const resolved = Object.assign({}, opts);
                                    if (opts.targets) resolved.targets = resolveTargets(opts.targets);
                                    const instance = window.anime(resolved);
                                    return instance;
                                };
                            })() : function(o) { return { seek: function(){}, duration: 0 }; };
                            // Copy static methods (stagger, timeline, set, etc.)
                            if (window.anime) {
                                anime.stagger = window.anime.stagger.bind(window.anime);
                                anime.timeline = function(opts) {
                                    // timeline() needs its own target resolution on .add()
                                    const tl = window.anime.timeline(opts);
                                    const origAdd = tl.add.bind(tl);
                                    tl.add = function(o, offset) {
                                        const r = Object.assign({}, o);
                                        if (o.targets && typeof o.targets === 'string') {
                                            r.targets = Array.from(scope.querySelectorAll(o.targets));
                                        }
                                        return origAdd(r, offset);
                                    };
                                    return tl;
                                };
                                anime.set = window.anime.set ? window.anime.set.bind(window.anime) : undefined;
                                anime.remove = window.anime.remove ? window.anime.remove.bind(window.anime) : undefined;
                                anime.get = window.anime.get ? window.anime.get.bind(window.anime) : undefined;
                                anime.random = window.anime.random ? window.anime.random.bind(window.anime) : undefined;
                                anime.running = window.anime.running;
                                anime.easings = window.anime.easings;
                            }
                            // _animeR: register a seekable Anime.js instance with its shot-relative start time
                            const _animeR = function(entry) { if (window._animeR) window._animeR(entry); };

                            // ── Shadow-DOM-aware helpers (called from rewritten LLM code) ──
                            // The LLM source is rewritten before injection so that:
                            //   document.querySelector(...)    → __sd_querySelector(...)
                            //   document.getElementById(...)   → __sd_getElementById(...)
                            //   document.querySelectorAll(...) → __sd_querySelectorAll(...)
                            //   window.RoughNotation           → __sd_RoughNotation
                            //   window.Vivus                   → __sd_Vivus
                            //   new Vivus(...)                 → new __sd_Vivus(...)
                            // These helpers are unique names to avoid TDZ from shadowing globals.
                            const __sd_RoughNotation = window.RoughNotation ? {
                                annotate: function(el, opts) {
                                    if (typeof el === 'string') {
                                        const resolved = scope.querySelector(el);
                                        if (!resolved) return { show: function(){}, hide: function(){}, isShowing: false };
                                        el = resolved;
                                    }
                                    return window.RoughNotation.annotate(el, opts);
                                },
                                annotationGroup: window.RoughNotation.annotationGroup
                                    ? window.RoughNotation.annotationGroup.bind(window.RoughNotation)
                                    : undefined
                            } : undefined;

                            function __sd_Vivus(el, opts, cb) {
                                if (!window.Vivus) return { play: function(){}, stop: function(){}, reset: function(){} };
                                if (typeof el === 'string') {
                                    const resolved = scope.querySelector('#' + CSS.escape(el));
                                    if (!resolved) return { play: function(){}, stop: function(){}, reset: function(){} };
                                    el = resolved;
                                }
                                return new window.Vivus(el, opts, cb);
                            }
                            if (window.Vivus) {
                                __sd_Vivus.EASE = window.Vivus.EASE;
                                __sd_Vivus.EASE_IN = window.Vivus.EASE_IN;
                                __sd_Vivus.EASE_OUT = window.Vivus.EASE_OUT;
                                __sd_Vivus.LINEAR = window.Vivus.LINEAR;
                            }

                            try {
                                ${originalCode}
                            } catch (e) {
                                console.error("[SCRIPT-ERR shot=${e.id}] Script execution error in snippet:", e && (e.message || e));
                                // Visual recovery: when the LLM script crashes mid-animation,
                                // GSAP often leaves elements stuck at the from state
                                // (opacity:0, scale, transform) because fromTo applies the
                                // from values immediately then errors before queuing the tween.
                                // Walk the shadow root and force any element with an
                                // invisible inline style back to a visible neutral state —
                                // matching what admin FE preview shows when animations
                                // play out fully.
                                try {
                                    const _all = scope.querySelectorAll('*');
                                    for (const _el of _all) {
                                        const _st = _el.style;
                                        if (!_st) continue;
                                        // opacity:0 → 1 (covers fade-in animations that crashed)
                                        if (_st.opacity !== '' && parseFloat(_st.opacity) < 1) {
                                            _st.opacity = '1';
                                        }
                                        // visibility:hidden → visible
                                        if (_st.visibility === 'hidden') {
                                            _st.visibility = 'visible';
                                        }
                                        // scale:0/0.something → reset transform if it's an entrance scale
                                        if (_st.transform && /scale\((0(\.\d+)?|0\.\d)\)/.test(_st.transform)) {
                                            _st.transform = '';
                                        }
                                        // clip-path: inset(...) hidden states
                                        if (_st.clipPath && /inset\(.*100%.*\)/.test(_st.clipPath)) {
                                            _st.clipPath = '';
                                        }
                                    }
                                } catch (_recoveryErr) {
                                    // Recovery itself shouldn't crash; log and move on.
                                    console.warn("[SCRIPT-ERR shot=${e.id}] visual recovery failed:", _recoveryErr && _recoveryErr.message);
                                }
                            }
                        })(document.getElementById('${e.id}').shadowRoot);
                      `;
                      
                      newScript.textContent = scopedCode;
                      oldScript.parentNode.replaceChild(newScript, oldScript);
                  });
                  // POST-SCRIPT VERIFICATION: did anything during shot script
                  // execution mutate shotTL.timeScale away from the value we
                  // requested? (e.g. a stray legacy vx-timescale loop, or an
                  // LLM script that called gsap.globalTimeline.timeScale().)
                  // Also count children + dump their startTimes/durations so
                  // we can verify tweens were placed where we expect.
                  // POSTSCRIPT (unconditional in v31): even when host._shotTL is null
                  // we want to see the gtl new-children added by THIS shot's scripts
                  // (master tl, free-standing tweens, etc.) so we can verify their
                  // attachment, startTime, timeScale, duration, paused state, and
                  // inner-tween count. This is the only signal that proves whether
                  // shot scripts actually populated gtl as expected, vs. silently
                  // failed somewhere in the explicitProxy/_safeCall path.
                  if (true) {
                      try {
                          var _tl = host._shotTL;
                          if (_tl) {
                              var _ts_now = (typeof _tl.timeScale === 'function') ? _tl.timeScale() : 'n/a';
                              var _kids = (typeof _tl.getChildren === 'function')
                                  ? _tl.getChildren(false, true, true) : [];
                              var _dur = (typeof _tl.duration === 'function') ? _tl.duration() : 'n/a';
                              console.log('[per-shot-timeline-postscript] ' + e.id
                                  + ' timeScale=' + (typeof _ts_now === 'number' ? _ts_now.toFixed(4) : _ts_now)
                                  + ' duration=' + (typeof _dur === 'number' ? _dur.toFixed(2) : _dur)
                                  + ' children=' + _kids.length);
                          }
                          // ALWAYS dump gtl children added by THIS shot's scripts. These
                          // are tls/tweens created by gsap.timeline()/gsap.to/etc. that
                          // weren't in pre-script set and aren't shotTL itself.
                          try {
                              var _preSet = window[_gtlPreStashKey] || new Set();
                              var _gtlKids = window.gsap.globalTimeline.getChildren(false, true, true);
                              var _newKids = [];
                              for (var _i = 0; _i < _gtlKids.length; _i++) {
                                  var _gk = _gtlKids[_i];
                                  if (_tl && _gk === _tl) continue;
                                  if (_preSet.has(_gk)) continue;
                                  _newKids.push(_gk);
                              }
                              console.log('[per-shot-timeline-postscript-gtl] ' + e.id
                                  + ' new_gtl_children=' + _newKids.length
                                  + ' total_gtl_children=' + _gtlKids.length
                                  + ' gtl.totalTime=' + window.gsap.globalTimeline.totalTime().toFixed(2));
                              for (var _j = 0; _j < Math.min(6, _newKids.length); _j++) {
                                  var _nk = _newKids[_j];
                                  var _nkSt = (typeof _nk.startTime === 'function') ? _nk.startTime() : 'n/a';
                                  var _nkTs = (typeof _nk.timeScale === 'function') ? _nk.timeScale() : 'n/a';
                                  var _nkDur = (typeof _nk.duration === 'function') ? _nk.duration() : 'n/a';
                                  var _nkPaused = (typeof _nk.paused === 'function') ? _nk.paused() : 'n/a';
                                  var _nkChildren = (typeof _nk.getChildren === 'function') ? _nk.getChildren(false, true, true).length : 'n/a';
                                  console.log('[per-shot-timeline-postscript-gtl] ' + e.id
                                      + ' new_child[' + _j + ']'
                                      + ' startTime=' + (typeof _nkSt === 'number' ? _nkSt.toFixed(2) : _nkSt)
                                      + ' timeScale=' + (typeof _nkTs === 'number' ? _nkTs.toFixed(4) : _nkTs)
                                      + ' duration=' + (typeof _nkDur === 'number' ? _nkDur.toFixed(2) : _nkDur)
                                      + ' paused=' + _nkPaused
                                      + ' inner_children=' + _nkChildren);
                              }
                          } catch (_gtlErr) {
                              console.warn('[per-shot-timeline-postscript-gtl] failed: ' + (_gtlErr && _gtlErr.message));
                          }
                          // Dump first 6 children so we can sanity-check tween placement.
                          for (var _k = 0; _k < Math.min(6, _kids.length); _k++) {
                              var _c = _kids[_k];
                              var _st = (typeof _c.startTime === 'function') ? _c.startTime() : 'n/a';
                              var _d = (typeof _c.duration === 'function') ? _c.duration() : 'n/a';
                              var _vars = _c.vars || {};
                              var _tgt = _vars.targets ? _vars.targets : (_c._targets || '');
                              var _tgtStr = '';
                              try {
                                  if (Array.isArray(_tgt)) _tgtStr = '[' + _tgt.length + ' els]';
                                  else if (_tgt && _tgt.tagName) _tgtStr = _tgt.tagName + (_tgt.id ? '#' + _tgt.id : '');
                                  else _tgtStr = String(_tgt).slice(0, 40);
                              } catch (_e) {}
                              console.log('[per-shot-timeline-postscript] ' + e.id
                                  + ' child[' + _k + ']'
                                  + ' startTime=' + (typeof _st === 'number' ? _st.toFixed(3) : _st)
                                  + ' duration=' + (typeof _d === 'number' ? _d.toFixed(3) : _d)
                                  + ' tgt=' + _tgtStr);
                          }
                      } catch (_diagErr) {
                          console.warn('[per-shot-timeline-postscript] diag failed: ' + (_diagErr && _diagErr.message));
                      }
                  }
                  // Drop the pre-script globalTimeline snapshot once all scripts have
                  // run — keeps a strong ref to dead tweens until they're GSAP-killed
                  // at the next segment boundary.
                  try { delete window[_gtlPreStashKey]; } catch (_e) {}

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
                              
                              if (el.tagName.toLowerCase() === 'code' && el.parentElement && el.parentElement.tagName.toLowerCase() === 'pre') {
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
                // Clamp snippet dimensions to viewport to prevent overflow
                // (LLM may generate 1920px width for portrait 1080px canvas)
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const clampedW = Math.min(e.w | 0, vw);
                const clampedH = Math.min(e.h | 0, vh);
                host.style.left = Math.max(0, Math.min(e.x | 0, vw - clampedW)) + 'px';
                host.style.top = Math.max(0, Math.min(e.y | 0, vh - clampedH)) + 'px';
                host.style.width = clampedW + 'px';
                host.style.height = clampedH + 'px';
                if (typeof e.z !== 'undefined') host.style.zIndex = String(e.z);
                if (typeof e.opacity !== 'undefined') host.style.opacity = String(e.opacity);
                // Store timing for video sync
                if (typeof e.inTime !== 'undefined') host.dataset.inTime = String(e.inTime);
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
                wrapper.style.minHeight = '100%';
                wrapper.style.overflow = 'hidden';
                wrapper.style.position = 'relative';
                wrapper.style.boxSizing = 'border-box';
                root.appendChild(wrapper);
                window.__activeSnippets.set(id, host);
              }
              const root = host.shadowRoot;
              const wrapper = root.getElementById('content-wrapper');
              wrapper.innerHTML = e.html;
              // Match client AIContentPlayer behavior: every entry fills the
              // full viewport (top:0 left:0 100% 100%) regardless of x/y/w/h.
              // This ensures the rendered video looks identical to the client.
              // Branding watermarks are excluded since they need positioning.
              if (e.id && e.id.startsWith('branding-')) {
                host.style.left = (e.x | 0) + 'px';
                host.style.top = (e.y | 0) + 'px';
                host.style.width = (e.w | 0) + 'px';
                host.style.height = (e.h | 0) + 'px';
                console.log('[SIZING-DIAG] branding ' + e.id + ' size=' + e.w + 'x' + e.h + ' pos=' + e.x + ',' + e.y);
              } else {
                host.style.left = '0px';
                host.style.top = '0px';
                host.style.width = window.innerWidth + 'px';
                host.style.height = window.innerHeight + 'px';
                host.style.overflow = 'hidden';
                host.style.background = getComputedStyle(document.body).backgroundColor || '#ffffff';
                // Force the inner content to stretch to fill — prevents white gap at bottom
                const wr = host.shadowRoot.getElementById('content-wrapper');
                if (wr) {
                  wr.style.minHeight = window.innerHeight + 'px';
                  // Find the first child div and stretch it too
                  const firstChild = wr.firstElementChild;
                  if (firstChild && firstChild.tagName === 'STYLE') {
                    // Skip <style> tags, get the first content element
                    const contentEl = firstChild.nextElementSibling;
                    if (contentEl) {
                      contentEl.style.minHeight = '100%';
                      contentEl.style.boxSizing = 'border-box';
                    }
                  } else if (firstChild) {
                    firstChild.style.minHeight = '100%';
                    firstChild.style.boxSizing = 'border-box';
                  }
                }
                console.log('[SIZING-DIAG] full-viewport ' + e.id + ' (orig size=' + e.w + 'x' + e.h + ', forced=' + window.innerWidth + 'x' + window.innerHeight + ')');
              }
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
        """


def get_dispatcher_install_js(libs: str = "") -> str:
    """Return the JS string that installs the harness dispatchers.

    `libs` is substituted into the template at the REPLACE_LIBS marker.
    Pass empty string from the preview path — the only feature it disables
    is the character-mouth phoneme image lookup, which the preview never
    uses.
    """
    return _DISPATCHER_INSTALL_JS_TEMPLATE.replace("REPLACE_LIBS", libs)
