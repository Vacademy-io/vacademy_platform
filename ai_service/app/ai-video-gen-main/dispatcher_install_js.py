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
                      // ── Navigation / document-wipe neutralization ──
                      // A headless render must NEVER navigate away or wipe the
                      // document: either destroys the JS execution context the
                      // scrub-renderer drives via page.evaluate() on EVERY frame,
                      // which aborts the whole multi-minute render ("Execution
                      // context was destroyed, most likely because of a navigation").
                      // LLM shot scripts occasionally do this by accident. Route the
                      // offending calls to the inert __sd_* stand-ins defined in the
                      // scoped IIFE below. page.route() can't catch these — they're
                      // in-page JS (location assignment / document.write), not network
                      // requests.
                      originalCode = originalCode.split('window.location').join('__sd_loc');
                      originalCode = originalCode.split('document.location').join('__sd_loc');
                      originalCode = originalCode.split('window.open').join('__sd_open');
                      originalCode = originalCode.split('document.writeln').join('__sd_docWrite');
                      originalCode = originalCode.split('document.write').join('__sd_docWrite');
                      // Bare `location.href = ...` / `location.reload()` / `location.assign(...)`
                      // — rewritten only when `location` is a standalone identifier
                      // (NOT el.location, geolocation, relocation, etc.). The boundary
                      // class excludes a preceding word-char or dot; the trailing class
                      // requires a `.` or `=` so plain string mentions are left alone.
                      originalCode = originalCode.replace(/(^|[^\\w.$])location(\\s*[.=])/g, '$1__sd_loc$2');
                      // String.raw — NOT a plain template literal. Inside this block
                      // we embed regex literals (`/circle\(\s*0.../`, `/scale\((0...)/`)
                      // and JS escape-character literals that MUST keep their backslashes
                      // intact. A plain template literal silently drops unrecognized
                      // backslash escapes (`\(` → `(`, `\s` → `s`, `\d` → `d`), which
                      // turned every regex below into an invalid `Unterminated group`
                      // SyntaxError at `<script>` parse time — killing the LLM-authored
                      // shot script entirely, leaving GSAP with zero registered tweens
                      // and no animations in the rendered MP4. String.raw preserves all
                      // backslashes verbatim while still doing `${...}` interpolation,
                      // so embedded regexes work AND `${e.id}` still substitutes.
                      const scopedCode = String.raw`
                        (function(scope) {
                            // Helper to resolve selectors in this shadow root
                            const resolve = (s) => {
                                const el = (typeof s === 'string' ? scope.querySelector(s) : s);
                                // Don't warn — LLM-generated selectors may reference elements
                                // that don't exist yet or are in a different shadow root
                                return el;
                            };
                            const resolveAll = (s) => {
                                if (typeof s === 'string') return scope.querySelectorAll(s);
                                if (Array.isArray(s)) {
                                    const out = [];
                                    for (const t of s) {
                                        if (typeof t === 'string') { for (const el of scope.querySelectorAll(t)) out.push(el); }
                                        else if (t) out.push(t);
                                    }
                                    return out;
                                }
                                return s;
                            };

                            // Shadow-DOM-aware document.* replacements (used after rewriting LLM source)
                            const __sd_getElementById = (id) => scope.querySelector('#' + CSS.escape(id));
                            const __sd_querySelector = (sel) => scope.querySelector(sel);
                            const __sd_querySelectorAll = (sel) => scope.querySelectorAll(sel);

                            // ── Navigation / document-wipe stand-ins ──
                            // Targets of the source rewrites above (window.location,
                            // document.location, window.open, document.write(ln), bare
                            // location). Reads degrade to '' ; assignments and calls are
                            // swallowed. Any stray ReferenceError from an edge-case
                            // rewrite (e.g. window.opener) is caught by the try/catch that
                            // wraps the shot script below, so the shot still recovers.
                            const __sd_navNoop = function () { return null; };
                            const __sd_loc = new Proxy(
                                { assign: __sd_navNoop, replace: __sd_navNoop, reload: __sd_navNoop, toString: function () { return ''; } },
                                { get: function (o, k) { return (k in o) ? o[k] : ''; }, set: function () { return true; } }
                            );
                            const __sd_open = __sd_navNoop;
                            const __sd_docWrite = __sd_navNoop;


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
                            // Craft-contract helpers — scoped to this shadow root
                            const dimOthers = (dims, opts) => window.dimOthers(resolveAll(dims), opts);
                            const setFocus = (focus, dims, opts) => window.setFocus(resolve(focus), resolveAll(dims), opts);
                            const resetFocus = (targets, opts) => window.resetFocus(resolveAll(targets), opts);
                            const morphElement = (target, vars, opts) => window.morphElement(resolve(target), vars, opts);

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

                            // ── Preserve CSS percentage-translate centering ──────────────
                            // LLM-authored shots commonly center elements with
                            //   transform: translate(-50%, -50%)
                            // and then animate y/scale/rotation via GSAP fromTo/to. GSAP
                            // reads getComputedStyle(el).transform to seed its internal
                            // x/y/xPercent/yPercent. The browser computes percentage
                            // translates into a matrix() with pixel values, losing the
                            // "percent" intent. In the production render's shadow DOM,
                            // this read sometimes happens before the matrix is populated,
                            // so GSAP records xPercent: 0, yPercent: 0 and every later
                            // write of transform drops the -50%/-50% centering — the
                            // element anchors at its top-left, not its center, and
                            // visibly shifts right and down.
                            //
                            // To stop that, walk the shot's <style> rules, find any
                            // selectors with transform: translate(X%, Y%), and pre-seed
                            // GSAP's transform state with xPercent/yPercent + x:0/y:0/
                            // scale:1/rotation:0. From this moment on, GSAP's tween
                            // pipeline knows the element's "natural" centering offset
                            // and preserves it through every subsequent fromTo/to/from.
                            try {
                                if (window.gsap && typeof window.gsap.set === 'function') {
                                    const _styles = scope.querySelectorAll('style');
                                    const _seen = new WeakSet();
                                    const _trRe = /translate(?:3d)?\s*\(\s*(-?\d+(?:\.\d+)?)\s*%\s*(?:,\s*(-?\d+(?:\.\d+)?)\s*%)?/i;
                                    for (let _si = 0; _si < _styles.length; _si++) {
                                        const _sheet = _styles[_si].sheet;
                                        if (!_sheet) continue;
                                        let _rules;
                                        try { _rules = _sheet.cssRules || _sheet.rules; } catch (e) { continue; }
                                        if (!_rules) continue;
                                        for (let _ri = 0; _ri < _rules.length; _ri++) {
                                            const _r = _rules[_ri];
                                            if (!_r || !_r.style || !_r.selectorText) continue;
                                            const _tf = _r.style.transform || _r.style.webkitTransform || '';
                                            if (!_tf) continue;
                                            const _m = _tf.match(_trRe);
                                            if (!_m) continue;
                                            const _xp = parseFloat(_m[1]);
                                            const _yp = _m[2] !== undefined ? parseFloat(_m[2]) : 0;
                                            if (!isFinite(_xp) && !isFinite(_yp)) continue;
                                            let _els;
                                            try { _els = scope.querySelectorAll(_r.selectorText); } catch (e) { continue; }
                                            if (!_els || !_els.length) continue;
                                            for (let _ei = 0; _ei < _els.length; _ei++) {
                                                const _el = _els[_ei];
                                                if (_seen.has(_el)) continue;
                                                _seen.add(_el);
                                                try {
                                                    window.gsap.set(_el, {
                                                        xPercent: isFinite(_xp) ? _xp : 0,
                                                        yPercent: isFinite(_yp) ? _yp : 0,
                                                        x: 0, y: 0,
                                                    });
                                                } catch (e) {
                                                    console.warn('[percent-translate-preinit] gsap.set failed for ' + _r.selectorText + ':', e && e.message);
                                                }
                                            }
                                        }
                                    }
                                }
                            } catch (_ptpErr) {
                                console.warn('[percent-translate-preinit] scan failed:', _ptpErr && _ptpErr.message);
                            }

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

                            // Phase 1.3 telemetry — emit ENTER on script eval so we
                            // can later see which shots failed to reach EXIT (= script
                            // threw mid-execution). The console listener in the render
                            // worker tees these to shot_telemetry.jsonl for grep-by-id.
                            try { console.log("[SHOT-TELEM] shot=${e.id} enter"); } catch (_te) {}

                            // Tag every element currently in the shadow scope with
                            // 'data-vx-managed' so the CSS visibility safety net's
                            // 5s force-reveal rule does NOT fire on elements that
                            // the dispatcher knows are owned by an active animation
                            // pipeline (their fades are handled by GSAP/anime, not
                            // by the LLM's inline-opacity:0). If the script
                            // subsequently errors, the recovery walker below still
                            // un-tags them so the safety net CAN fire on legitimately-
                            // stuck elements. Net effect: the safety net's 5s
                            // reveal only triggers when the dispatcher's recovery
                            // ALSO failed.
                            try {
                                const _scoped = scope.querySelectorAll('[style*="opacity:0"], [style*="opacity: 0"]');
                                for (const _el of _scoped) {
                                    if (_el && _el.setAttribute) _el.setAttribute('data-vx-managed', '1');
                                }
                            } catch (_tagErr) { /* tagging must never break the page */ }

                            // Helper: snapshot #shot-root opacity. The shot-2-white bug
                            // showed shot-root stuck at opacity 0 in the rendered MP4.
                            // Logging it at every exit (and in the catch) makes the
                            // failure mode visible in shot_telemetry.jsonl — easy to
                            // grep for 'root-opacity=0' to find blank shots before users do.
                            var __snapRootOpacity = function () {
                                try {
                                    var _r = scope.querySelector('#shot-root') || scope.host;
                                    if (!_r) return 'no-root';
                                    return (getComputedStyle ? getComputedStyle(_r).opacity : (_r.style && _r.style.opacity)) || '?';
                                } catch (_se) { return 'err'; }
                            };

                            // Helper: detect a clip-path value that collapses the
                            // element to ~0 visible area. Real-world patterns
                            // seen in the LLM output (verified against the
                            // Chanakya shot files):
                            //   shot-5:  polygon(0% 0%, 0% 0%, 0% 0%, 0% 100%)
                            //            → 3 of 4 vertices identical
                            //   shot-7:  inset(50% 0% 50% 0%)
                            //            → top+bottom sum to 100%, collapsed vertically
                            //   shot-10: polygon(50% 50%, ... , 50% 50%)
                            //            → all vertices identical
                            //   plus circle(0) / ellipse(0 0) / inset(100% ...)
                            // Returns true if the value would render essentially nothing.
                            var __isCollapsedClipPath = function (cp) {
                                if (!cp || cp === 'none') return false;
                                // inset(t r b l). Collapse cases:
                                //   • any side >= 100% → degenerate
                                //   • top + bottom >= 100% → 0 visible height (shot-7)
                                //   • left + right >= 100% → 0 visible width
                                // Non-percent units (px/em) are treated as 0 here —
                                // we can't know collapse without element size, but
                                // GSAP clipPath wipes consistently use %.
                                var insetMatch = cp.match(/inset\(\s*([^)]+)\)/);
                                if (insetMatch) {
                                    var raw = insetMatch[1].trim().split(/\s+/);
                                    var sides = [0, 0, 0, 0]; // top right bottom left
                                    for (var _si = 0; _si < Math.min(raw.length, 4); _si++) {
                                        var m = raw[_si].match(/^(-?[0-9]+(?:\.[0-9]+)?)%$/);
                                        sides[_si] = m ? parseFloat(m[1]) : 0;
                                    }
                                    // CSS shorthand: fewer values mirror to opposite sides.
                                    if (raw.length === 1) { sides[1] = sides[2] = sides[3] = sides[0]; }
                                    else if (raw.length === 2) { sides[2] = sides[0]; sides[3] = sides[1]; }
                                    else if (raw.length === 3) { sides[3] = sides[1]; }
                                    if (sides[0] >= 100 || sides[1] >= 100 || sides[2] >= 100 || sides[3] >= 100) return true;
                                    if (sides[0] + sides[2] >= 100) return true; // top+bottom
                                    if (sides[1] + sides[3] >= 100) return true; // left+right
                                }
                                // circle(0) / circle(0%) / circle(0px ...). Lookahead
                                // '(?![\d.])' blocks matching the leading "0" of
                                // "0.5em" or "05" as the full radius (no false fires
                                // on visibly-sized small clip circles).
                                if (/circle\(\s*0(?:\.0+)?(?:px|%|em|rem)?(?![\d.])/.test(cp)) return true;
                                if (/ellipse\(\s*0(?:\.0+)?(?:px|%|em|rem)?\s+0(?:\.0+)?(?:px|%|em|rem)?(?![\d.])/.test(cp)) return true;
                                if (/polygon\(/.test(cp)) {
                                    var pts = cp.match(/-?[0-9]+(?:\.[0-9]+)?%?\s+-?[0-9]+(?:\.[0-9]+)?%?/g) || [];
                                    if (pts.length < 3) return true; // not enough points for a real shape
                                    var uniq = {};
                                    for (var _i = 0; _i < pts.length; _i++) {
                                        uniq[pts[_i].replace(/\s+/g, ' ').trim()] = 1;
                                    }
                                    var u = Object.keys(uniq).length;
                                    // If 3+ vertices of an N-gon collapse to <=2 unique points
                                    // OR more than half the vertices share one coord, the
                                    // visible area is ~0. The exact threshold isn't critical
                                    // — false positives only fire when the script has ALSO
                                    // failed to open the reveal, in which case forcing
                                    // clip-path:none is the correct repair.
                                    if (u <= 2) return true;
                                    if (u < Math.max(2, Math.ceil(pts.length / 2))) return true;
                                }
                                return false;
                            };

                            // Helper: walk the shadow scope and force any element
                            // out of a hidden inline state back to a visible neutral
                            // state. 'force' is true when the script threw (we no
                            // longer trust ANY of its work); false for the success
                            // path, where we only repair elements that still look
                            // hidden AFTER the script ran (e.g. shot-5: clipPath
                            // collapses to a polygon with 3 identical points and
                            // the reveal tween never opened it).
                            var __vxRecover = function (force) {
                                try {
                                    if (force) {
                                        var _tagged = scope.querySelectorAll('[data-vx-managed]');
                                        for (var _ti = 0; _ti < _tagged.length; _ti++) {
                                            try { _tagged[_ti].removeAttribute('data-vx-managed'); } catch (_te) {}
                                        }
                                    }
                                    var _all = scope.querySelectorAll('*');
                                    for (var _ai = 0; _ai < _all.length; _ai++) {
                                        var _el = _all[_ai];
                                        var _st = _el.style;
                                        if (!_st) continue;
                                        if (force) {
                                            // opacity:0 → 1 (covers fade-in animations that crashed)
                                            if (_st.opacity !== '' && parseFloat(_st.opacity) < 1) _st.opacity = '1';
                                            // visibility:hidden → visible
                                            if (_st.visibility === 'hidden') _st.visibility = 'visible';
                                            // scale:0 / scale(0.x) → drop transform
                                            if (_st.transform && /scale\((0(\.\d+)?|0\.\d)\)/.test(_st.transform)) {
                                                _st.transform = '';
                                            }
                                        }
                                        // clip-path collapse — repair on BOTH paths.
                                        // On the success path this catches the
                                        // shot-5-white pattern where gsap.set hid the
                                        // root but the gsap.to reveal never applied
                                        // (scrub-mode edge / silent failure / etc.).
                                        if (_st.clipPath && __isCollapsedClipPath(_st.clipPath)) {
                                            _st.clipPath = 'none';
                                        }
                                    }
                                } catch (_recoveryErr) {
                                    console.warn("[SCRIPT-ERR shot=${e.id}] visual recovery failed:", _recoveryErr && _recoveryErr.message);
                                }
                            };

                            // Bug 5 (word-break root cause):
                            // Auto-scale-to-fit text helper. Runs AFTER the shot
                            // script (which may set initial transforms / opacities)
                            // and AFTER FontFace.ready (which finishes loading
                            // any @font-face declarations the shot CSS uses).
                            // Walks the shadow scope for text-bearing elements
                            // whose intrinsic width exceeds the container's
                            // max-content width AND that would otherwise wrap
                            // mid-word because of the universal 'word-break:
                            // break-word' foundation rule. For each such
                            // element, binary-searches a font-size scale
                            // between 0.55 and 1.0 of the computed font-size
                            // until the text fits on its allotted lines (or
                            // floor is reached). Applies the resulting size
                            // as inline 'font-size'.
                            //
                            // This makes the recurring "UPS/C", "DREA/M"
                            // character-break bug essentially impossible: the
                            // foundation rule still exists as a last-resort,
                            // but text never reaches it because the auto-scaler
                            // pre-empts overflow by shrinking the font.
                            //
                            // Cost: ~5-15 text elements per shot × ~7 binary-
                            // search iterations × 1 getBoundingClientRect each
                            // ≈ 50ms per shot. Acceptable for the small text
                            // count of typical generated HTML.
                            var __fitTextOne = function (el) {
                                try {
                                    if (!el || !el.style || !el.getBoundingClientRect) return;
                                    // Skip explicit opt-outs.
                                    if (el.hasAttribute('data-no-fit')) return;
                                    // Skip elements with no visible text node.
                                    var hasText = false;
                                    for (var ci = 0; ci < el.childNodes.length; ci++) {
                                        var cn = el.childNodes[ci];
                                        if (cn.nodeType === 3 && (cn.nodeValue || '').trim()) {
                                            hasText = true; break;
                                        }
                                    }
                                    if (!hasText) return;
                                    // Read computed font-size (in px). If it's already
                                    // small (<32px), don't bother — large display text
                                    // is the failure mode, not body copy.
                                    var cs = getComputedStyle(el);
                                    var fsPx = parseFloat(cs.fontSize);
                                    if (!fsPx || fsPx < 32) return;
                                    // Quick fit check: scrollWidth catches the natural
                                    // intrinsic width even when CSS overflow:hidden
                                    // would clip it visually.
                                    var initialScroll = el.scrollWidth;
                                    var initialClient = el.clientWidth;
                                    if (initialClient <= 0) return;
                                    // Allow a small tolerance — sub-pixel jitter.
                                    if (initialScroll <= initialClient + 2) return;
                                    // Binary-search font-size scale ∈ [0.55, 1.0].
                                    // 1.0 known to overflow (we hit this branch
                                    // because scrollWidth > clientWidth at the
                                    // original size); 0.55 is the floor.
                                    // Goal: find the LARGEST scale at which the
                                    // text fits. If it fits at mid, try larger
                                    // (lo = mid). If it overflows, try smaller
                                    // (hi = mid). Floor at 0.55 — below that
                                    // the text becomes unreadable; accept
                                    // overflow if even 0.55 won't fit.
                                    var lo = 0.55, hi = 1.0;
                                    var original = fsPx;
                                    var best = lo;  // pessimistic default
                                    for (var iter = 0; iter < 7; iter++) {
                                        var mid = (lo + hi) / 2;
                                        el.style.fontSize = (original * mid) + 'px';
                                        // Force layout flush by reading.
                                        if (el.scrollWidth <= el.clientWidth + 2) {
                                            best = mid; lo = mid;   // fits; try larger
                                        } else {
                                            hi = mid;                // overflows; try smaller
                                        }
                                    }
                                    el.style.fontSize = (original * best) + 'px';
                                    try {
                                        console.log(
                                            "[fit-text] shot=${e.id} " +
                                            "tag=" + el.tagName.toLowerCase() +
                                            " id=" + (el.id || '-') +
                                            " " + Math.round(original) + "px → " +
                                            Math.round(original * best) + "px"
                                        );
                                    } catch (_lge) {}
                                } catch (_fterr) { /* never break the shot */ }
                            };

                            var __fitTextSweep = function () {
                                try {
                                    var nodes = scope.querySelectorAll(
                                        // Restrict to nodes that the LLM tends to make
                                        // big-text containers. Skip <script>, <style>,
                                        // <video>, <img>, <svg>, etc. — they aren't
                                        // text containers and scrollWidth on them is
                                        // meaningless.
                                        'div, span, p, h1, h2, h3, h4, ' +
                                        '[class*="headline"], [class*="title"], [class*="display"], ' +
                                        '[id*="title"], [id*="headline"], [id*="display"], [id*="slam"]'
                                    );
                                    for (var ni = 0; ni < nodes.length; ni++) {
                                        __fitTextOne(nodes[ni]);
                                    }
                                } catch (_fserr) { /* never break the shot */ }
                            };

                            // Run the fit-text sweep when fonts are ready — running
                            // before fonts load gives stale measurements based on
                            // fallback fonts.
                            var __scheduleFit = function () {
                                try {
                                    if (document && document.fonts && document.fonts.ready) {
                                        document.fonts.ready.then(function () {
                                            // Defer one rAF so the shot script's
                                            // initial gsap.set / transforms have
                                            // applied before we measure.
                                            requestAnimationFrame(__fitTextSweep);
                                        });
                                    } else {
                                        requestAnimationFrame(__fitTextSweep);
                                    }
                                } catch (_se) {
                                    try { __fitTextSweep(); } catch (_se2) {}
                                }
                            };

                            try {
                                ${originalCode}
                                try { console.log("[SHOT-TELEM] shot=${e.id} exit ok root-opacity=" + __snapRootOpacity()); } catch (_te2) {}
                                // Soft sweep after a successful run. Only repairs
                                // collapsed clip-path — the script "succeeded" so
                                // we don't touch opacity / visibility / transform
                                // (those may be legitimate end-states for shots
                                // with delayed entrances or terminal hide-outs).
                                __vxRecover(false);
                                // Bug 5 — auto-scale text on the success path.
                                // Doesn't run on the catch path because the
                                // recovery already touched font sizes / transforms.
                                __scheduleFit();
                            } catch (e) {
                                try { console.log("[SHOT-TELEM] shot=${e.id} exit threw root-opacity=" + __snapRootOpacity() + " err=" + (e && (e.message || e))); } catch (_te3) {}
                                console.error("[SCRIPT-ERR shot=${e.id}] Script execution error in snippet:", e && (e.message || e));
                                // Hard sweep: script crashed, repair every hide state.
                                __vxRecover(true);
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
                // Caption host sits over the shot iframes as a transparent
                // full-viewport overlay. The inner caption HTML (emitted by
                // generate_video.py) is a `<div style="width:100%; height:100%; position:relative;">`
                // wrapper with an absolutely-positioned caption pill — so the
                // host must be viewport-sized for the percentage math to
                // resolve correctly, but MUST stay transparent. The earlier
                // version copy-pasted the shot-entry logic from
                // `__updateSnippets` and forced an opaque body-colored
                // background here, which turned every captioned frame into a
                // solid white screen with just the caption visible.
                host.style.left = '0px';
                host.style.top = '0px';
                host.style.width = window.innerWidth + 'px';
                host.style.height = window.innerHeight + 'px';
                host.style.overflow = 'hidden';
                host.style.background = 'transparent';
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
