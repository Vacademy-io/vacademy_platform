/**
 * Utilities for extracting and updating text elements inside entry HTML strings.
 *
 * Strategy: parse the HTML fragment into a real DOM via DOMParser, walk the tree
 * to find elements that carry direct text content, then serialize back after edits.
 * All operations run entirely in the browser — no server round-trips.
 */

export interface TextElement {
    /** Stable index within the entry (determined by tree-walk order). */
    index: number;
    tagName: string;
    /** Current text content (may be multi-line). */
    text: string;
    /** Inline style values extracted from the element. */
    fontSize: string;
    color: string;
    fontWeight: string;
    textAlign: string;
    fontFamily: string;
    /** Translate offset parsed from element's CSS transform (canvas px). */
    translateX: number;
    translateY: number;
}

/** Parse translate(Xpx, Ypx) from a CSS transform string. */
function parseTranslate(transform: string): { x: number; y: number } {
    const m = transform.match(/translate\(\s*([+-]?[\d.]+)px\s*,\s*([+-]?[\d.]+)px\s*\)/);
    if (m) return { x: parseFloat(m[1]!), y: parseFloat(m[2]!) };
    // also handle translate(X, Y) without px unit
    const m2 = transform.match(/translate\(\s*([+-]?[\d.]+)\s*,\s*([+-]?[\d.]+)\s*\)/);
    if (m2) return { x: parseFloat(m2[1]!), y: parseFloat(m2[2]!) };
    return { x: 0, y: 0 };
}

/** Tags whose subtrees we never descend into for text extraction. */
const SKIP_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'SVG',
    'CANVAS',
    'IMG',
    'VIDEO',
    'AUDIO',
    'IFRAME',
    'INPUT',
    'TEXTAREA',
]);

/** Minimum meaningful text length — avoids picking up icon ligatures etc. */
const MIN_TEXT_LEN = 2;

function hasDirectText(el: Element): boolean {
    for (const node of el.childNodes) {
        if (
            node.nodeType === Node.TEXT_NODE &&
            (node.textContent?.trim().length ?? 0) >= MIN_TEXT_LEN
        ) {
            return true;
        }
    }
    return false;
}

function walkElements(root: Element, results: TextElement[], counter: { n: number }) {
    if (SKIP_TAGS.has(root.tagName)) return;

    if (hasDirectText(root)) {
        const style = (root as HTMLElement).style;
        const translate = parseTranslate(style.transform || '');
        results.push({
            index: counter.n++,
            tagName: root.tagName,
            text: root.textContent?.trim() ?? '',
            fontSize: style.fontSize || '',
            color: style.color || '',
            fontWeight: style.fontWeight || '',
            textAlign: style.textAlign || '',
            fontFamily: style.fontFamily || '',
            translateX: translate.x,
            translateY: translate.y,
        });
        // Don't descend further — this node owns the text
        return;
    }

    for (const child of root.children) {
        walkElements(child, results, counter);
    }
}

/**
 * Parse an HTML fragment and return all text-bearing elements as a flat list.
 * Returns [] if called outside a browser environment.
 */
export function extractTextElements(html: string): TextElement[] {
    if (typeof window === 'undefined' || !html) return [];

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(
            `<!DOCTYPE html><html><body>${html}</body></html>`,
            'text/html'
        );
        const results: TextElement[] = [];
        walkElements(doc.body, results, { n: 0 });
        return results;
    } catch {
        return [];
    }
}

export interface TextPatch {
    text?: string;
    fontSize?: string;
    color?: string;
    fontWeight?: string;
    textAlign?: string;
    fontFamily?: string;
    /** Canvas-space pixel offsets applied via CSS transform: translate(). */
    translateX?: number;
    translateY?: number;
}

/**
 * Remove the text element at `index` from the HTML fragment entirely.
 */
export function deleteTextElement(html: string, index: number): string {
    if (typeof window === 'undefined' || !html) return html;
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(
            `<!DOCTYPE html><html><body>${html}</body></html>`,
            'text/html'
        );
        const counter = { n: 0 };
        let target: Element | null = null;

        const findTarget = (root: Element): void => {
            if (target) return;
            if (SKIP_TAGS.has(root.tagName)) return;
            if (hasDirectText(root)) {
                if (counter.n === index) {
                    target = root;
                    return;
                }
                counter.n++;
                return;
            }
            for (const child of root.children) findTarget(child);
        };

        findTarget(doc.body);
        const found = target as Element | null;
        if (found) found.parentElement?.removeChild(found);
        return doc.body.innerHTML;
    } catch {
        return html;
    }
}

/**
 * Apply a patch to the text element at `index` inside `html` and return the
 * updated HTML fragment string.
 */
export function applyTextPatch(html: string, index: number, patch: TextPatch): string {
    if (typeof window === 'undefined' || !html) return html;

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(
            `<!DOCTYPE html><html><body>${html}</body></html>`,
            'text/html'
        );
        const counter = { n: 0 };
        let target: Element | null = null;

        const findTarget = (root: Element): void => {
            if (target) return;
            if (SKIP_TAGS.has(root.tagName)) return;
            if (hasDirectText(root)) {
                if (counter.n === index) {
                    target = root;
                    return;
                }
                counter.n++;
                return;
            }
            for (const child of root.children) findTarget(child);
        };

        findTarget(doc.body);
        if (!target) return html;

        const el = target as HTMLElement;

        // Update text content — replace only the first direct text node to
        // preserve any child inline elements (e.g. <strong>, <em>).
        // Replace the full text content of the element. Setting textContent
        // removes all child nodes (including inline elements like <span>),
        // which prevents leftover children from appearing alongside the new text.
        if (patch.text !== undefined) {
            el.textContent = patch.text;
        }

        if (patch.fontSize !== undefined) el.style.fontSize = patch.fontSize;
        if (patch.color !== undefined) el.style.color = patch.color;
        if (patch.fontWeight !== undefined) el.style.fontWeight = patch.fontWeight;
        if (patch.textAlign !== undefined) el.style.textAlign = patch.textAlign;
        if (patch.fontFamily !== undefined) el.style.fontFamily = patch.fontFamily;

        // Position via translate — merge with any existing non-translate transforms
        if (patch.translateX !== undefined || patch.translateY !== undefined) {
            const existing = parseTranslate(el.style.transform || '');
            const tx = patch.translateX ?? existing.x;
            const ty = patch.translateY ?? existing.y;
            // Strip old translate, keep other transforms (rotate, scale, etc.)
            const otherTransforms = (el.style.transform || '')
                .replace(/translate\([^)]*\)\s*/g, '')
                .trim();
            const translatePart = `translate(${tx}px, ${ty}px)`;
            el.style.transform = otherTransforms
                ? `${translatePart} ${otherTransforms}`
                : translatePart;
            // Ensure the element is positioned so translate has visual effect
            if (!el.style.position) el.style.position = 'relative';
        }

        return doc.body.innerHTML;
    } catch {
        return html;
    }
}
