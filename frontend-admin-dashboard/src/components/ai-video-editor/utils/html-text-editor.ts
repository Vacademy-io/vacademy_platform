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
    whiteSpace: string;
    lineHeight: string;
    /** Translate offset parsed from element's CSS transform (canvas px). */
    translateX: number;
    translateY: number;
    /**
     * Set when the text is *not* a static DOM text node but is injected at
     * runtime by an inline `<script>` (e.g. `el.innerHTML = "..."`). Text
     * patches for these entries rewrite the script's string literal instead
     * of mutating the DOM; style patches still apply to the target element's
     * inline style.
     */
    scriptInjection?: ScriptInjectionRef;
}

export interface ScriptInjectionRef {
    /** CSS selector resolved from the script's `document.querySelector` /
     *  `document.getElementById` binding. */
    selector: string;
    /** Which assignment property was used. */
    method: 'innerHTML' | 'textContent';
    /** Quote character that wrapped the literal in the source. */
    quote: '"' | "'" | '`';
    /** Original literal contents (between the quotes, with escapes intact)
     *  — used as a signature so the patch path can re-locate it in the HTML
     *  even after offsets shift. */
    originalLiteral: string;
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
            whiteSpace: style.whiteSpace || '',
            lineHeight: style.lineHeight || '',
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
 *
 * In addition to walking static DOM text, this also scans inline `<script>`
 * blocks for the LLM's common runtime-injection pattern:
 *
 *     const titleEl = document.querySelector('#s2_title');
 *     titleEl.innerHTML = "<span>TELANGANA</span>";
 *
 * Each detected injection is surfaced as a synthetic `TextElement` carrying
 * a `scriptInjection` ref. The Text tab can then expose "TELANGANA" as
 * editable; `applyTextPatch` rewrites the string literal in the script
 * rather than mutating the (empty) DOM node.
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
        // Append script-injected texts after the DOM-walk results so existing
        // indices stay stable for callers that have stored them.
        const injections = extractScriptInjections(html, doc.body);
        for (const inj of injections) {
            results.push({ ...inj, index: results.length });
        }
        return results;
    } catch {
        return [];
    }
}

/** Match a `const|let|var NAME = document.querySelector('SELECTOR')` binding. */
const QS_BINDING_RE =
    /\b(?:const|let|var)\s+(\w+)\s*=\s*document\s*\.\s*querySelector\s*\(\s*(['"`])([^'"`]+)\2\s*\)/g;
/** Match a `const|let|var NAME = document.getElementById('ID')` binding. */
const GBI_BINDING_RE =
    /\b(?:const|let|var)\s+(\w+)\s*=\s*document\s*\.\s*getElementById\s*\(\s*(['"`])([^'"`]+)\2\s*\)/g;
/** Match `TARGET.innerHTML = "STRING"` or `.textContent = "STRING"`.
 *  TARGET may be a bare identifier or a direct `document.querySelector(...)` /
 *  `document.getElementById(...)` chain. The literal body allows escapes
 *  (`\\.`) but does not handle template-literal interpolations. */
const ASSIGN_RE =
    /(\w+|document\s*\.\s*(?:querySelector|getElementById)\s*\(\s*['"`][^'"`]+['"`]\s*\))\s*\.\s*(innerHTML|textContent)\s*=\s*(['"`])((?:\\.|(?!\3)[^\\])*)\3/g;

function decodeJsLiteral(raw: string, quote: '"' | "'" | '`'): string {
    // Replace JS string escapes. Template-literal interpolations (${...}) are
    // left as-is; they're not editable as plain text.
    return raw.replace(/\\(.)/g, (_m, ch) => {
        if (ch === 'n') return '\n';
        if (ch === 't') return '\t';
        if (ch === 'r') return '\r';
        if (ch === '\\') return '\\';
        if (ch === quote) return quote;
        return ch;
    });
}

function htmlLiteralToDisplayText(literal: string): string {
    if (typeof window === 'undefined') return literal;
    const doc = new DOMParser().parseFromString(
        `<!DOCTYPE html><body>${literal}</body>`,
        'text/html'
    );
    return doc.body.textContent ?? '';
}

function extractScriptInjections(
    html: string,
    parsedBody: HTMLElement
): Omit<TextElement, 'index'>[] {
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    const out: Omit<TextElement, 'index'>[] = [];
    const seenSignatures = new Set<string>(); // dedupe across multiple script tags

    for (const sm of scripts) {
        const content = sm[1];
        if (!content || (!content.includes('innerHTML') && !content.includes('textContent')))
            continue;

        // Resolve variable bindings inside this script.
        const bindings = new Map<string, string>();
        for (const bm of content.matchAll(QS_BINDING_RE)) bindings.set(bm[1]!, bm[3]!);
        for (const bm of content.matchAll(GBI_BINDING_RE)) bindings.set(bm[1]!, '#' + bm[3]!);

        for (const am of content.matchAll(ASSIGN_RE)) {
            const target = am[1]!.replace(/\s+/g, '');
            const method = am[2] as 'innerHTML' | 'textContent';
            const quote = am[3] as '"' | "'" | '`';
            const literal = am[4] ?? '';

            // Skip template literals with interpolations — they're not safe
            // to rewrite as a plain string.
            if (quote === '`' && literal.includes('${')) continue;

            // Resolve selector
            let selector: string | null = null;
            if (bindings.has(am[1]!.trim())) {
                selector = bindings.get(am[1]!.trim())!;
            } else {
                const sm2 = target.match(
                    /document\.(querySelector|getElementById)\(['"`]([^'"`]+)['"`]\)/
                );
                if (sm2) {
                    selector = sm2[1] === 'getElementById' ? '#' + sm2[2] : sm2[2]!;
                }
            }
            if (!selector) continue;

            // Dedupe: same selector+method+literal across renders.
            const sig = `${selector}|${method}|${literal}`;
            if (seenSignatures.has(sig)) continue;
            seenSignatures.add(sig);

            const decoded = decodeJsLiteral(literal, quote);
            const displayText =
                method === 'innerHTML' ? htmlLiteralToDisplayText(decoded) : decoded;
            // Skip empty or whitespace-only matches — they're noise.
            if (!displayText.trim()) continue;

            // Try to resolve the target element so we can inherit its tag
            // name + inline style for the editor UI.
            let targetEl: Element | null = null;
            try {
                targetEl = parsedBody.querySelector(selector);
            } catch {
                /* invalid selector — ignore */
            }
            const style = (targetEl as HTMLElement | null)?.style;
            const translate = parseTranslate(style?.transform || '');

            out.push({
                tagName: targetEl?.tagName ?? 'SCRIPT',
                text: displayText,
                fontSize: style?.fontSize || '',
                color: style?.color || '',
                fontWeight: style?.fontWeight || '',
                textAlign: style?.textAlign || '',
                fontFamily: style?.fontFamily || '',
                whiteSpace: style?.whiteSpace || '',
                lineHeight: style?.lineHeight || '',
                translateX: translate.x,
                translateY: translate.y,
                scriptInjection: {
                    selector,
                    method,
                    quote,
                    originalLiteral: literal,
                },
            });
        }
    }
    return out;
}

/** Escape a plain string so it can be safely embedded back into a JS literal
 *  of the given quote type. */
function escapeForJsLiteral(text: string, quote: '"' | "'" | '`'): string {
    let out = text.replace(/\\/g, '\\\\');
    if (quote === '"') out = out.replace(/"/g, '\\"');
    else if (quote === "'") out = out.replace(/'/g, "\\'");
    else out = out.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    // Newlines: keep as escape sequence so the JS literal stays single-line
    // (matches how the LLM emits them — `\n` rather than literal newlines).
    out = out.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    // Critical: a `</script>` substring inside an inline script literal
    // ends the script tag prematurely. Break it with a forward-slash escape
    // (meaningless to JS, but invisible to the HTML parser).
    out = out.replace(/<\/(script)/gi, '<\\/$1');
    return out;
}

/** Rewrite the inner contents of the originalLiteral so it contains
 *  `newPlainText` while preserving any wrapper HTML for innerHTML literals
 *  (so character spans, inline-block styles, etc. stay intact). */
function rebuildLiteralForText(ref: ScriptInjectionRef, newPlainText: string): string | null {
    if (ref.method === 'textContent') {
        return escapeForJsLiteral(newPlainText, ref.quote);
    }
    // innerHTML: parse the original HTML, replace the FIRST non-empty text
    // node with newPlainText, clear any trailing text nodes — preserves
    // <span style="display:inline-block">…</span> wrappers.
    if (typeof window === 'undefined') return null;
    try {
        const decoded = decodeJsLiteral(ref.originalLiteral, ref.quote);
        const doc = new DOMParser().parseFromString(
            `<!DOCTYPE html><body>${decoded}</body>`,
            'text/html'
        );
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
        let n = walker.nextNode();
        let replaced = false;
        while (n) {
            if (!replaced && (n.textContent ?? '').trim().length > 0) {
                n.textContent = newPlainText;
                replaced = true;
            } else if (replaced) {
                n.textContent = '';
            }
            n = walker.nextNode();
        }
        if (!replaced) {
            doc.body.textContent = newPlainText;
        }
        return escapeForJsLiteral(doc.body.innerHTML, ref.quote);
    } catch {
        return null;
    }
}

/** Locate and replace the assignment literal that matches `ref` inside the
 *  full HTML string. Returns the updated HTML or `null` if no match. */
function rewriteScriptLiteral(
    html: string,
    ref: ScriptInjectionRef,
    newLiteralBody: string
): string | null {
    // Build a regex that finds an assignment of the same property, with a
    // literal whose contents equal ref.originalLiteral exactly (escapes
    // included). The target may be any identifier — variable bindings can be
    // renamed across renders, so we don't lock to the original name.
    const q = ref.quote;
    const escapedLiteral = ref.originalLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const needle = new RegExp(`(\\.\\s*${ref.method}\\s*=\\s*)${q}${escapedLiteral}${q}`);
    if (!needle.test(html)) return null;
    // Function replacement so $ chars inside newLiteralBody aren't
    // misinterpreted as regex backreferences.
    return html.replace(needle, (_full, prefix: string) => `${prefix}${q}${newLiteralBody}${q}`);
}

/** Apply a text patch to a script-injected entry. Only `patch.text` is
 *  routed through the script rewriter; other style fields (fontSize, color,
 *  …) still go to the target element's inline style — that part shares the
 *  static-DOM code path below. */
function applyScriptInjectionPatch(
    html: string,
    ref: ScriptInjectionRef,
    patch: TextPatch
): string {
    let next = html;
    if (patch.text !== undefined) {
        const newLiteral = rebuildLiteralForText(ref, patch.text);
        if (newLiteral != null) {
            const rewritten = rewriteScriptLiteral(next, ref, newLiteral);
            if (rewritten != null) next = rewritten;
        }
    }
    // Forward style patches to the static target element if we can resolve it.
    if (
        patch.fontSize !== undefined ||
        patch.color !== undefined ||
        patch.fontWeight !== undefined ||
        patch.textAlign !== undefined ||
        patch.fontFamily !== undefined ||
        patch.whiteSpace !== undefined ||
        patch.lineHeight !== undefined ||
        patch.translateX !== undefined ||
        patch.translateY !== undefined
    ) {
        try {
            const doc = new DOMParser().parseFromString(
                `<!DOCTYPE html><body>${next}</body>`,
                'text/html'
            );
            const el = doc.body.querySelector(ref.selector) as HTMLElement | null;
            if (el) {
                const setForced = (prop: string, value: string | undefined) => {
                    if (value === undefined) return;
                    if (value === '') el.style.removeProperty(prop);
                    else el.style.setProperty(prop, value, 'important');
                };
                setForced('font-size', patch.fontSize);
                setForced('color', patch.color);
                setForced('font-weight', patch.fontWeight);
                setForced('text-align', patch.textAlign);
                setForced('font-family', patch.fontFamily);
                setForced('white-space', patch.whiteSpace);
                setForced('line-height', patch.lineHeight);
                if (patch.translateX !== undefined || patch.translateY !== undefined) {
                    const existing = parseTranslate(el.style.transform || '');
                    const tx = patch.translateX ?? existing.x;
                    const ty = patch.translateY ?? existing.y;
                    const other = (el.style.transform || '')
                        .replace(/translate\([^)]*\)\s*/g, '')
                        .trim();
                    const tp = `translate(${tx}px, ${ty}px)`;
                    el.style.transform = other ? `${tp} ${other}` : tp;
                    if (!el.style.position) el.style.position = 'relative';
                }
                next = doc.body.innerHTML;
            }
        } catch {
            /* selector might be malformed — best-effort */
        }
    }
    return next;
}

export interface TextPatch {
    text?: string;
    fontSize?: string;
    color?: string;
    fontWeight?: string;
    textAlign?: string;
    fontFamily?: string;
    whiteSpace?: string;
    lineHeight?: string;
    /** Canvas-space pixel offsets applied via CSS transform: translate(). */
    translateX?: number;
    translateY?: number;
}

/**
 * Remove the text element at `index` from the HTML fragment entirely. For
 * script-injected entries we instead empty the string literal (preserving
 * the assignment so the script doesn't crash on the variable reference).
 */
export function deleteTextElement(html: string, index: number): string {
    if (typeof window === 'undefined' || !html) return html;

    // Resolve the index through the same extraction the UI uses, so caller
    // indices line up with what the user sees in the Text tab.
    const elements = extractTextElements(html);
    const target = elements[index];
    if (target?.scriptInjection) {
        const rewritten = rewriteScriptLiteral(html, target.scriptInjection, '');
        return rewritten ?? html;
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(
            `<!DOCTYPE html><html><body>${html}</body></html>`,
            'text/html'
        );
        const counter = { n: 0 };
        let domTarget: Element | null = null;

        const findTarget = (root: Element): void => {
            if (domTarget) return;
            if (SKIP_TAGS.has(root.tagName)) return;
            if (hasDirectText(root)) {
                if (counter.n === index) {
                    domTarget = root;
                    return;
                }
                counter.n++;
                return;
            }
            for (const child of root.children) findTarget(child);
        };

        findTarget(doc.body);
        const found = domTarget as Element | null;
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

    // Script-injected entries route through the literal-rewriter; the
    // index-into-elements lookup matches what extractTextElements produced
    // for the UI.
    const elements = extractTextElements(html);
    const targetMeta = elements[index];
    if (targetMeta?.scriptInjection) {
        return applyScriptInjectionPatch(html, targetMeta.scriptInjection, patch);
    }

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

        // Apply user overrides with `!important` so they win over <style> rules
        // or clamp()/viewport-based values baked into the source HTML. Passing
        // an empty string clears the property (and its !important flag).
        const setForced = (prop: string, value: string | undefined) => {
            if (value === undefined) return;
            if (value === '') el.style.removeProperty(prop);
            else el.style.setProperty(prop, value, 'important');
        };
        setForced('font-size', patch.fontSize);
        setForced('color', patch.color);
        setForced('font-weight', patch.fontWeight);
        setForced('text-align', patch.textAlign);
        setForced('font-family', patch.fontFamily);
        setForced('white-space', patch.whiteSpace);
        setForced('line-height', patch.lineHeight);

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
