/**
 * Faithful re-implementation of slide-material.tsx applyDocContentToEditor()'s
 * HTML preprocessing that runs BEFORE html.deserialize on slide reload. Kept in
 * sync with lines ~613-797 of slide-material.tsx. Used by the reproduction test
 * so the round-trip matches what the real app does on load.
 */
import { stripAwsQueryParamsFromUrls } from '../formatHtmlString';

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
    return contentForDeserialization || '';
}
