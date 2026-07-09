/**
 * Faithful re-implementation of slide-material.tsx applyDocContentToEditor()'s
 * HTML preprocessing that runs BEFORE html.deserialize on slide reload. Kept in
 * sync with lines ~613-797 of slide-material.tsx. Used by the reproduction test
 * so the round-trip matches what the real app does on load.
 */
import { stripAwsQueryParamsFromUrls } from '../formatHtmlString';

// Wrapper elements to flatten (they carry no block meaning to Yoopta). AI-generated
// and pasted HTML nests content in these; Yoopta's html.deserialize does NOT reliably
// recurse into them, so any block (heading, paragraph, list, …) buried inside is
// silently dropped on reload. See docs/SLIDE_CONTENT_LOSS_INVESTIGATION.md.
const FLATTEN_TAGS = 'section, header, footer, article, main, aside, figure, figcaption, div';
// Elements that ARE (or whose descendants are) real blocks / block internals — never
// flatten these or anything inside them. Every custom Yoopta block serializes its root
// with data-yoopta-type, so that one selector covers all of them; the rest guards the
// built-in structural blocks (table, lists, callout <dl>, code, mermaid, accordion).
const PROTECTED_SELECTOR =
    '[data-yoopta-type],[data-tabs],[data-columns],[data-quiz],[data-steps],[data-front],[data-back],[data-flashcard],[data-tab-index],table,thead,tbody,tfoot,tr,td,th,caption,colgroup,ul,ol,li,dl,dt,dd,details,summary,pre,code,.mermaid';

/**
 * Recursively unwrap non-block wrapper elements (section/header/article/div/…),
 * promoting their children to the parent, so every block-level element becomes a
 * direct sibling that Yoopta's deserializer recognises. Elements that are (or live
 * inside) a real block — tables, lists, callouts, code, or any data-yoopta-type
 * custom block — are left completely untouched.
 *
 * This is the fix for the "reload drops headings/paragraphs nested in <section>/<div>"
 * data-loss (proven in doc-slide-integrity/test.tsx). Idempotent and order-preserving.
 */
export function flattenSemanticWrappers(innerHtml: string): string {
    if (!innerHtml || !innerHtml.includes('<')) return innerHtml;
    try {
        const doc = new DOMParser().parseFromString(innerHtml, 'text/html');
        let changed = true;
        let guard = 0;
        while (changed && guard++ < 200) {
            changed = false;
            const candidates = Array.from(doc.body.querySelectorAll(FLATTEN_TAGS));
            for (const el of candidates) {
                // Skip if this element IS, or is nested INSIDE, a protected block —
                // we must never disturb the internals of a table/list/custom block.
                if (el.closest(PROTECTED_SELECTOR)) continue;
                const parent = el.parentNode;
                if (!parent) continue;
                while (el.firstChild) parent.insertBefore(el.firstChild, el);
                parent.removeChild(el);
                changed = true;
            }
        }
        return doc.body.innerHTML.trim();
    } catch {
        // On any DOM failure, fall back to the unflattened HTML — never lose content.
        return innerHtml;
    }
}

export interface DeserializeLossReport {
    /** True when html.deserialize produced fewer real blocks than the source HTML had. */
    lossy: boolean;
    /** Human-readable list of what was dropped, e.g. ["1 table", "2 heading(s)"]. */
    lost: string[];
}

/**
 * Layer-2 safety net: after html.deserialize, compare the structural blocks the source
 * HTML contained against the blocks Yoopta actually produced. A DECREASE in any custom
 * block (data-yoopta-type), table, image, video/embed, or heading means the deserialize
 * silently dropped content — the slide must NOT be re-saved from this editor state, or
 * the loss becomes permanent. This catches block types the flatten fix doesn't cover
 * (unknown / future blocks) without ever firing on a legitimate user edit (it compares
 * load input vs load output, not old vs new content).
 *
 * Reliability: custom-block subtrees are removed before counting tables/images/headings,
 * so media/headings nested INSIDE a quiz/columns/flashcard block don't cause a false
 * "loss" (those are part of the custom block, not standalone Yoopta blocks).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function detectDeserializeLoss(
    sourceHtml: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deserializedValue: Record<string, any>
): DeserializeLossReport {
    const lost: string[] = [];
    try {
        const doc = new DOMParser().parseFromString(sourceHtml || '', 'text/html');

        // Source custom blocks (by data-yoopta-type), counted BEFORE stripping.
        const srcCustom: Record<string, number> = {};
        doc.body.querySelectorAll('[data-yoopta-type]').forEach((el) => {
            const t = el.getAttribute('data-yoopta-type') || 'unknown';
            srcCustom[t] = (srcCustom[t] || 0) + 1;
        });
        // Remove custom-block subtrees so their inner media/headings aren't counted.
        doc.body.querySelectorAll('[data-yoopta-type]').forEach((el) => el.remove());
        const srcTable = doc.body.querySelectorAll('table').length;
        const srcImg = doc.body.querySelectorAll('img').length;
        const srcVideo =
            doc.body.querySelectorAll('video').length + doc.body.querySelectorAll('iframe').length;
        const srcHeading = doc.body.querySelectorAll('h1, h2, h3').length;

        // Editor block-type counts.
        const tc: Record<string, number> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.values(deserializedValue || {}).forEach((b: any) => {
            const t = b?.type ?? 'UNKNOWN';
            tc[t] = (tc[t] || 0) + 1;
        });
        const edTable = tc['Table'] || 0;
        const edImg = tc['Image'] || 0;
        const edVideo = (tc['Video'] || 0) + (tc['Embed'] || 0);
        const edHeading = (tc['HeadingOne'] || 0) + (tc['HeadingTwo'] || 0) + (tc['HeadingThree'] || 0);

        Object.keys(srcCustom).forEach((t) => {
            const drop = (srcCustom[t] || 0) - (tc[t] || 0);
            if (drop > 0) lost.push(`${drop} ${t}`);
        });
        if (srcTable > edTable) lost.push(`${srcTable - edTable} table(s)`);
        if (srcImg > edImg) lost.push(`${srcImg - edImg} image(s)`);
        if (srcVideo > edVideo) lost.push(`${srcVideo - edVideo} video/embed(s)`);
        if (srcHeading > edHeading) lost.push(`${srcHeading - edHeading} heading(s)`);
    } catch {
        // Detection must never throw or block a load — treat as non-lossy on failure.
        return { lossy: false, lost: [] };
    }
    return { lossy: lost.length > 0, lost };
}

export function appReloadPreprocess(storedHtml: string): string {
    let sanitized = stripAwsQueryParamsFromUrls(storedHtml || '');
    let contentForDeserialization = sanitized || '';
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(contentForDeserialization, 'text/html');
        if (doc.body) {
            const unwrapFromDiv = (el: Element) => {
                const parent = el.parentElement;
                if (parent && parent.tagName === 'DIV') {
                    const fragment = document.createDocumentFragment();
                    while (parent.firstChild) fragment.appendChild(parent.firstChild);
                    if (parent.parentNode) parent.parentNode.replaceChild(fragment, parent);
                }
            };

            doc.body.querySelectorAll('img').forEach((img) => {
                const src = img.getAttribute('src');
                if (src && src !== 'null' && src !== 'undefined') return;
                const parent = img.parentElement;
                const isImageBlockWrapper =
                    parent &&
                    parent.tagName === 'DIV' &&
                    parent.children.length === 1 &&
                    parent.firstElementChild === img &&
                    !parent.hasAttribute('data-yoopta-type') &&
                    !parent.hasAttribute('data-tab-index') &&
                    !parent.hasAttribute('data-front') &&
                    !parent.hasAttribute('data-back');
                if (isImageBlockWrapper) parent.remove();
                else img.remove();
            });

            doc.body.querySelectorAll('iframe').forEach(unwrapFromDiv);
            doc.body.querySelectorAll('video').forEach(unwrapFromDiv);
            doc.body.querySelectorAll('img').forEach(unwrapFromDiv);
            doc.body.querySelectorAll('a[download]').forEach(unwrapFromDiv);

            const accordionWrappers = new Set<Element>();
            doc.body.querySelectorAll('details').forEach((d) => {
                const p = d.parentElement;
                if (
                    p &&
                    p.tagName === 'DIV' &&
                    !p.hasAttribute('data-yoopta-type') &&
                    Array.from(p.children).every((c) => c.tagName === 'DETAILS')
                ) {
                    accordionWrappers.add(p);
                }
            });
            accordionWrappers.forEach((wrapper) => {
                while (wrapper.firstChild)
                    wrapper.parentNode?.insertBefore(wrapper.firstChild, wrapper);
                wrapper.remove();
            });

            const convertNewlinesToBr = (node: Node) => {
                const children = Array.from(node.childNodes);
                for (const child of children) {
                    if (child.nodeType === 3) {
                        const raw = child.textContent || '';
                        const text = raw.replace(/\r\n?/g, '\n');
                        if (!text.includes('\n')) continue;
                        if (text.trim() === '') continue;
                        const parent = child.parentNode;
                        if (!parent) continue;
                        const tag = (parent as Element).tagName;
                        if (tag === 'PRE' || tag === 'CODE' || tag === 'SCRIPT' || tag === 'STYLE')
                            continue;
                        if ((parent as Element).closest?.('pre')) continue;
                        if ((parent as Element).closest?.('li, dl, .mermaid, [data-yoopta-type]'))
                            continue;
                        const parts = text.split('\n');
                        const frag = doc.createDocumentFragment();
                        parts.forEach((part, i) => {
                            if (i > 0) frag.appendChild(doc.createElement('br'));
                            if (part) frag.appendChild(doc.createTextNode(part));
                        });
                        parent.replaceChild(frag, child);
                    } else if (child.nodeType === 1) {
                        const tag = (child as Element).tagName;
                        if (tag === 'PRE' || tag === 'SCRIPT' || tag === 'STYLE') continue;
                        convertNewlinesToBr(child);
                    }
                }
            };
            convertNewlinesToBr(doc.body);

            contentForDeserialization = doc.body.innerHTML.trim();

            const wrapper = document.createElement('div');
            wrapper.innerHTML = contentForDeserialization;
            let current: Element = wrapper;
            while (current.children.length === 1) {
                const firstChild = current.children[0];
                if (
                    firstChild &&
                    firstChild.tagName === 'DIV' &&
                    !firstChild.classList.contains('mermaid') &&
                    !firstChild.hasAttribute('data-yoopta-type')
                ) {
                    current = firstChild;
                } else {
                    break;
                }
            }
            contentForDeserialization = current.innerHTML.trim();
        }
    } catch (e) {
        // ignore
    }
    // Flatten semantic wrappers LAST, so headings/paragraphs nested in <section>/<div>
    // survive html.deserialize (the reload data-loss fix).
    contentForDeserialization = flattenSemanticWrappers(contentForDeserialization);
    return contentForDeserialization || '';
}
