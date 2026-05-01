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
 */
export function getEditorIframeAgentScript(): string {
    return `<script>
(function(){
    var pendingSeek = 0;
    var ready = false;

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
            try { el.style.setProperty(k, style[k]); } catch (_) {}
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
            try {
                window.parent.postMessage({
                    type: 'vx-rect',
                    requestId: msg.requestId,
                    ok: !!rect,
                    rect: rect,
                    transform: el ? (el.style && el.style.transform) || '' : ''
                }, '*');
            } catch (_) {}
        } else if (msg.type === 'vx-set-style') {
            applyStylePatch(findElementAtPath(msg.path || []), msg.style);
        }
    });
})();
</script>`;
}
