/**
 * Rewrites the OLD Yoopta editor's serialized HTML into the shapes the Lexical
 * importer (Lexical core + our custom nodes) recognises, so converting a legacy
 * document carries its images, checkboxes, callouts, embeds, etc. across.
 *
 * Runs before $generateNodesFromDOM (see importDocHtml). It must be a no-op on
 * already-Lexical content: every rule keys on a Yoopta-only shape (a <dl>
 * callout, an `[x] ` text checkbox marker, Yoopta's flex media wrapper, one
 * <ul> per list item), none of which our own exportDOM produces.
 *
 * Yoopta serialization facts this relies on (verified against @yoopta/* dist):
 *  - No `data-yoopta-type` anywhere; blocks are plain tags + `data-meta-*`.
 *  - Callout  = `<dl data-theme="info|success|warning|error|default">…</dl>`.
 *  - Todo     = `<ul><li>[x] …</li></ul>` / `[ ] ` — a literal text marker.
 *  - Image    = `<div style="…flex…"><img … objectFit …/></div>` (block).
 *  - Embed / Video / File = same flex `<div>` wrapping an <iframe>/<video>/<a download>.
 *  - Each list item is its own `<ul>`/`<ol>` block (must merge runs).
 */

const CHECK_MARKER = /^\s*\[([xX ])\]\s?/;

/** Callout theme names line up 1:1 between Yoopta and our CalloutBlock. */
const CALLOUT_THEMES = new Set(['default', 'info', 'success', 'warning', 'error']);

export function normalizeYooptaHtml(inner: string): string {
    if (!inner || !inner.trim()) return inner;
    let doc: Document;
    try {
        doc = new DOMParser().parseFromString(inner, 'text/html');
    } catch {
        return inner;
    }
    const body = doc.body;
    if (!body) return inner;

    normalizeCallouts(body, doc);
    unwrapMediaWrappers(body);
    normalizeTodoItems(body);
    mergeAdjacentLists(body);

    return body.innerHTML;
}

/** `<dl data-theme=…>text</dl>` → `<div data-yoopta-type="callout" data-theme=…>`. */
function normalizeCallouts(body: HTMLElement, doc: Document): void {
    body.querySelectorAll('dl').forEach((dl) => {
        const rawTheme = (dl.getAttribute('data-theme') || 'info').toLowerCase();
        const theme = CALLOUT_THEMES.has(rawTheme) ? rawTheme : 'info';
        const div = doc.createElement('div');
        div.setAttribute('data-yoopta-type', 'callout');
        div.setAttribute('data-editor-type', 'calloutEditor');
        div.setAttribute('data-theme', theme);
        // CalloutBlock stores rich HTML, so carry the markup across instead of
        // flattening to textContent — that dropped bold/links inside a callout,
        // and any nested table/image with them (which then read as structural
        // loss to the backend guard on the next save).
        div.innerHTML = dl.innerHTML;
        dl.replaceWith(div);
    });
}

/** Promote an <img>/<iframe>/<video>/<a download> out of Yoopta's flex-wrapper
 *  `<div>` so it lands at block level where our decorator importers match it.
 *  Only unwraps when the media element is the wrapper's sole element child.
 *
 *  Two things it must NEVER unwrap, because `replaceWith` deletes the wrapper
 *  outright — everything the wrapper carried goes with it:
 *   - a CUSTOM BLOCK's own marker div (a callout holding just an image, and by
 *     extension any future block shaped that way): the block, its theme and its
 *     text were replaced by the bare image, so the slide lost a callout the
 *     author never touched — visible only as a "will remove 1 callout" confirm
 *     on the next save.
 *   - a wrapper carrying its own text: Yoopta's media wrapper never does, so
 *     text here means the div is real content, not a wrapper. */
function unwrapMediaWrappers(body: HTMLElement): void {
    body.querySelectorAll('img, iframe, video, a[download]').forEach((media) => {
        const parent = media.parentElement;
        if (
            parent &&
            parent.tagName === 'DIV' &&
            parent !== body &&
            parent.children.length === 1 &&
            parent.children[0] === media &&
            !parent.hasAttribute('data-yoopta-type') &&
            !parent.hasAttribute('data-editor-type') &&
            (parent.textContent || '').trim() === ''
        ) {
            parent.replaceWith(media);
        }
    });
}

/** Convert Yoopta text-marker todos into Lexical checklist markup. A `<ul>`
 *  whose item text starts with `[x] `/`[ ] ` becomes
 *  `<ul data-is-checklist="1"><li aria-checked="true|false">…</li></ul>`. */
function normalizeTodoItems(body: HTMLElement): void {
    body.querySelectorAll('ul').forEach((ul) => {
        let isTodo = false;
        ul.querySelectorAll(':scope > li').forEach((li) => {
            const stripped = stripLeadingCheckMarker(li);
            if (stripped !== null) {
                isTodo = true;
                li.setAttribute('aria-checked', stripped ? 'true' : 'false');
            }
        });
        if (isTodo) ul.setAttribute('data-is-checklist', '1');
    });
}

/** If the list item's leading visible text is a `[x]`/`[ ]` marker, remove it
 *  from the first text node and return the checked state; else return null. */
function stripLeadingCheckMarker(li: Element): boolean | null {
    // Find the first non-empty text node in document order.
    const walker = li.ownerDocument.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node && !node.nodeValue?.trim()) node = walker.nextNode() as Text | null;
    if (!node || !node.nodeValue) return null;
    const m = node.nodeValue.match(CHECK_MARKER);
    if (!m) return null;
    node.nodeValue = node.nodeValue.replace(CHECK_MARKER, '');
    return (m[1] ?? '').toLowerCase() === 'x';
}

/** Yoopta emits one `<ul>`/`<ol>` per item; merge adjacent same-kind lists into
 *  one so Lexical builds a single list (and a single checklist). */
function mergeAdjacentLists(body: HTMLElement): void {
    const kindOf = (el: Element): 'ol' | 'check' | 'ul' | null => {
        if (el.tagName === 'OL') return 'ol';
        if (el.tagName === 'UL')
            return el.getAttribute('data-is-checklist') === '1' ? 'check' : 'ul';
        return null;
    };
    let child = body.firstElementChild;
    while (child) {
        const kind = kindOf(child);
        let next = child.nextElementSibling;
        if (kind) {
            // Absorb following siblings of the same kind into `child`.
            while (next && kindOf(next) === kind) {
                const following = next.nextElementSibling;
                while (next.firstChild) child.appendChild(next.firstChild);
                next.remove();
                next = following;
            }
        }
        child = next;
    }
}
