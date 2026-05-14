/**
 * Inlined script appended to every entry HTML rendered inside the editor's
 * iframes. Bridges the parent editor's currentTime to the iframe's animation
 * libraries so the canvas shows the *frame at currentTime* — not the frame at
 * "iframe load + N seconds".
 *
 * Mirrors what the Playwright render server does (see AI_VIDEO_GENERATION.md
 * §5): pause `gsap.globalTimeline`, then on each seek call
 * `gsap.globalTimeline.totalTime(t)` plus `_animeSeek(t)` for registered
 * anime.js instances.
 *
 * Messages:
 *   { type: 'vx-seek',  tSec }   parent → iframe : seek to tSec (paused)
 *   { type: 'vx-play'  }         parent → iframe : resume gsap.globalTimeline
 *   { type: 'vx-pause' }         parent → iframe : pause gsap.globalTimeline
 *   { type: 'vx-iframe-ready' }  iframe → parent : libs loaded, ready for seeks
 *
 *   { type: 'vx-get-rect', path, requestId } parent → iframe : ask for the
 *     element-at-path's bounding rect in canvas coords (1920×1080 viewport).
 *   { type: 'vx-rect', requestId, ok, rect, transform } iframe → parent :
 *     reply with axis-aligned rect plus the current inline `transform` string.
 *   { type: 'vx-set-style', path, style } parent → iframe : apply inline-style
 *     declarations live, without re-mounting the iframe. Used during drag/
 *     resize/rotate gestures; final value is committed to the entry HTML on
 *     pointerup via the React store, which causes one final re-mount.
 *   { type: 'vx-resize-to-rect', path, requestId, left, top, width, height }
 *     parent → iframe : resize the element so its post-transform bounding rect
 *     lands at the requested (left, top, width, height) in iframe-viewport
 *     coords. Compensates for any centering `translate(...%, ...%)` in the
 *     existing transform by writing width/height first, re-measuring, then
 *     adjusting `left`/`top` to absorb the drift.
 *   { type: 'vx-resize-applied', requestId, ok, leftPx, topPx, width, height }
 *     iframe → parent : echo back the computed inline style values so the
 *     parent can commit the same values to the entry HTML on pointerup.
 */
export function getEditorIframeAgentScript(): string {
    return `<script>
(function(){
    var pendingSeek = 0;
    var ready = false;

    // ── Critical: pause GSAP synchronously right now ─────────────────
    // This script is injected at the top of body, AFTER gsap is loaded in
    // the head but BEFORE the shot inline script tags execute. Pausing the
    // global timeline here means every subsequent tween is added to a paused
    // timeline — so the animation never auto-plays and the canvas stays at
    // frame 0 until we call totalTime(currentTime). Without this, the tween
    // runs for ~50-200ms (until DOMContentLoaded) and the user sees a
    // visible flicker on every iframe re-mount.
    function pauseGsapNow() {
        try {
            if (window.gsap && window.gsap.globalTimeline) {
                window.gsap.globalTimeline.pause();
                return true;
            }
        } catch(e) {}
        return false;
    }
    pauseGsapNow();
    // If gsap hasn't loaded yet (rare — should be in <head>), keep retrying
    // until it appears, then pause immediately. Capped at ~3s.
    if (!window.gsap) {
        var pauseRetry = setInterval(function() {
            if (pauseGsapNow()) clearInterval(pauseRetry);
        }, 4);
        setTimeout(function(){ clearInterval(pauseRetry); }, 3000);
    }

    function applySeek(tSec) {
        try {
            var g = window.gsap;
            if (g && g.globalTimeline) {
                g.globalTimeline.pause();
                g.globalTimeline.totalTime(Math.max(0, tSec || 0));
            }
        } catch(e) {}
        try {
            if (typeof window._animeSeek === 'function') {
                window._animeSeek(Math.max(0, tSec || 0));
            }
        } catch(e) {}
    }

    // Replace the no-op _animeSeek shim from html-processor with a real
    // implementation that walks the registered anime.js entries. We also
    // pause each instance after seeking so a freshly-fired delayedCall (from
    // the existing _animeR scheduling) can't kick the animation forward when
    // the editor is meant to be paused at a specific frame.
    function installAnimeSeek() {
        window._animeSeek = function(tSec) {
            var ms = (tSec || 0) * 1000;
            var list = window._animeTimelines || [];
            for (var i = 0; i < list.length; i++) {
                try {
                    var entry = list[i];
                    if (!entry || !entry.instance) continue;
                    var localMs = ms - (entry.startMs || 0);
                    if (typeof entry.instance.seek === 'function') {
                        entry.instance.seek(Math.max(0, localMs));
                    }
                    if (typeof entry.instance.pause === 'function') {
                        entry.instance.pause();
                    }
                } catch(e) {}
            }
        };
    }

    function pauseAllAnime() {
        var list = window._animeTimelines || [];
        for (var i = 0; i < list.length; i++) {
            try {
                var entry = list[i];
                if (entry && entry.instance && typeof entry.instance.pause === 'function') {
                    entry.instance.pause();
                }
            } catch(e) {}
        }
    }

    function init() {
        installAnimeSeek();
        // Pause GSAP so it doesn't auto-progress — we drive the clock.
        try { if (window.gsap && window.gsap.globalTimeline) window.gsap.globalTimeline.pause(); } catch(e) {}
        pauseAllAnime();
        ready = true;
        applySeek(pendingSeek);
        try { window.parent.postMessage({ type: 'vx-iframe-ready' }, '*'); } catch(e) {}
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // Defer one tick so any inline <script> later in the body has run
        // (some shots register anime instances synchronously after libs load).
        setTimeout(init, 0);
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }

    // ── Path-addressed element lookup ────────────────────────────────────
    // Mirror of the parent's html-tree walk: skip ignored tags and walk
    // visible-child indices down from <body>.
    var IGNORED = { script: 1, style: 1, link: 1, meta: 1 };
    function findElementAtPath(path) {
        var cur = document.body;
        if (!cur || !path || !path.length) return cur;
        for (var i = 0; i < path.length; i++) {
            if (!cur) return null;
            var visible = [];
            for (var j = 0; j < cur.children.length; j++) {
                var child = cur.children[j];
                if (child && !IGNORED[child.tagName.toLowerCase()]) visible.push(child);
            }
            cur = visible[path[i]] || null;
        }
        return cur;
    }

    function elementRect(el) {
        if (!el || typeof el.getBoundingClientRect !== 'function') return null;
        var r = el.getBoundingClientRect();
        // Resolved px values for left/top so the parent can commit moves
        // through layout properties — gsap/anime constantly re-write inline
        // transform on every seek, which would clobber a transform-based move.
        var cs = el.ownerDocument && el.ownerDocument.defaultView
            ? el.ownerDocument.defaultView.getComputedStyle(el)
            : null;
        var leftPx = cs ? parseFloat(cs.left) : NaN;
        var topPx = cs ? parseFloat(cs.top) : NaN;
        return {
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            leftPx: isFinite(leftPx) ? leftPx : null,
            topPx: isFinite(topPx) ? topPx : null,
        };
    }

    function applyStylePatch(el, style) {
        if (!el || !style) return;
        for (var k in style) {
            if (!Object.prototype.hasOwnProperty.call(style, k)) continue;
            // Parse out trailing "!important" so the parent can mark inline
            // writes as important — required when the shot's gsap/anime
            // animation animates the same property and would otherwise
            // overwrite our value on every seek.
            var v = style[k];
            var priority = '';
            if (typeof v === 'string') {
                var m = /^(.*?)\\s*!important\\s*$/.exec(v);
                if (m) { v = m[1].trim(); priority = 'important'; }
            }
            try { el.style.setProperty(k, v, priority); } catch (_) {}
        }
    }

    // Parse a CSS declaration string ("left:10px; top:20px !important") into
    // an array of {prop, value, priority} entries.
    function parseDeclarations(styleString) {
        var out = [];
        if (!styleString) return out;
        var decls = styleString.split(';');
        for (var i = 0; i < decls.length; i++) {
            var d = decls[i].trim();
            if (!d) continue;
            var idx = d.indexOf(':');
            if (idx <= 0) continue;
            var prop = d.slice(0, idx).trim();
            var val = d.slice(idx + 1).trim();
            var priority = '';
            var m = /^(.*?)\\s*!important\\s*$/.exec(val);
            if (m) { val = m[1].trim(); priority = 'important'; }
            if (prop) out.push({ prop: prop, value: val, priority: priority });
        }
        return out;
    }

    // Walk live DOM and the parsed new-HTML body in lockstep; whenever an
    // element's style attribute differs, replay the new declarations on the
    // live element via setProperty (so !important is respected and any
    // gsap/anime-managed properties NOT listed in the new HTML are left
    // alone — we never blow away a transform that the animation library is
    // actively tweening). This is what lets style-only edits propagate to
    // the iframe without forcing an iframe re-mount.
    function syncStylesFromHtml(html) {
        if (!html) return;
        try {
            var newDoc = new DOMParser().parseFromString(html, 'text/html');
            var newBody = newDoc.body;
            if (newBody && document.body) syncStylesRecursive(document.body, newBody);
        } catch (_) {}
    }

    function syncStylesRecursive(oldEl, newEl) {
        if (!oldEl || !newEl) return;
        if (oldEl.tagName !== newEl.tagName) return;
        var oldStyle = oldEl.getAttribute('style') || '';
        var newStyle = newEl.getAttribute('style') || '';
        if (oldStyle !== newStyle) {
            // Additive sync: apply every declaration from the new style.
            // Anything in the OLD style that's NOT in the new style is left
            // in place; this is intentional so gsap-set inline values (e.g.
            // transform on an animated element) don't get cleared mid-tween.
            var decls = parseDeclarations(newStyle);
            for (var i = 0; i < decls.length; i++) {
                var d = decls[i];
                try { oldEl.style.setProperty(d.prop, d.value, d.priority); } catch (_) {}
            }
        }
        var oldKids = [];
        var newKids = [];
        for (var i = 0; i < oldEl.children.length; i++) {
            var c = oldEl.children[i];
            if (c && !IGNORED[c.tagName.toLowerCase()]) oldKids.push(c);
        }
        for (var j = 0; j < newEl.children.length; j++) {
            var c2 = newEl.children[j];
            if (c2 && !IGNORED[c2.tagName.toLowerCase()]) newKids.push(c2);
        }
        var len = Math.min(oldKids.length, newKids.length);
        for (var k = 0; k < len; k++) {
            syncStylesRecursive(oldKids[k], newKids[k]);
        }
    }

    window.addEventListener('message', function(e) {
        var msg = e && e.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'vx-seek') {
            pendingSeek = msg.tSec || 0;
            if (ready) applySeek(pendingSeek);
        } else if (msg.type === 'vx-play') {
            try { if (window.gsap && window.gsap.globalTimeline) window.gsap.globalTimeline.play(); } catch(e) {}
        } else if (msg.type === 'vx-pause') {
            try { if (window.gsap && window.gsap.globalTimeline) window.gsap.globalTimeline.pause(); } catch(e) {}
        } else if (msg.type === 'vx-get-rect') {
            var el = findElementAtPath(msg.path || []);
            var rect = elementRect(el);
            // Read both the legacy transform-rotate and the modern standalone
            // rotate property so the parent can pick up either source.
            var inlineRotate = el && el.style ? el.style.rotate || '' : '';
            try {
                window.parent.postMessage({
                    type: 'vx-rect',
                    requestId: msg.requestId,
                    ok: !!rect,
                    rect: rect,
                    transform: el ? (el.style && el.style.transform) || '' : '',
                    rotate: inlineRotate
                }, '*');
            } catch (_) {}
        } else if (msg.type === 'vx-set-style') {
            applyStylePatch(findElementAtPath(msg.path || []), msg.style);
        } else if (msg.type === 'vx-sync-styles') {
            // Parent committed a style-only edit; reapply inline styles to
            // the existing DOM rather than reloading the iframe.
            syncStylesFromHtml(msg.html || '');
        } else if (msg.type === 'vx-resize-to-rect') {
            var target = findElementAtPath(msg.path || []);
            var ok = false;
            var leftPx = null, topPx = null, w = null, h = null;
            if (target) {
                try {
                    target.style.position = 'absolute';
                    target.style.width = (msg.width || 0) + 'px';
                    target.style.height = (msg.height || 0) + 'px';
                    // Re-read after width/height applied. Any percentage-based
                    // translate in the existing transform now resolves against
                    // the new size; we read the resulting rect and absorb the
                    // drift by adjusting left/top.
                    var r2 = target.getBoundingClientRect();
                    var cs2 = target.ownerDocument.defaultView.getComputedStyle(target);
                    var curLeft = parseFloat(cs2.left) || 0;
                    var curTop = parseFloat(cs2.top) || 0;
                    var dx = (msg.left || 0) - r2.left;
                    var dy = (msg.top || 0) - r2.top;
                    var newLeft = curLeft + dx;
                    var newTop = curTop + dy;
                    target.style.left = newLeft + 'px';
                    target.style.top = newTop + 'px';
                    leftPx = newLeft;
                    topPx = newTop;
                    w = msg.width || 0;
                    h = msg.height || 0;
                    ok = true;
                } catch (_) {}
            }
            try {
                window.parent.postMessage({
                    type: 'vx-resize-applied',
                    requestId: msg.requestId,
                    ok: ok,
                    leftPx: leftPx,
                    topPx: topPx,
                    width: w,
                    height: h
                }, '*');
            } catch (_) {}
        }
    });
})();
</script>`;
}
