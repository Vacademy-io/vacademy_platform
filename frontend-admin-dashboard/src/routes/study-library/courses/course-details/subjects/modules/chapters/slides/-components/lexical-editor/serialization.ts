import { $getRoot, $insertNodes, $createParagraphNode, type LexicalEditor } from 'lexical';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { formatHTMLString } from '../slide-operations/formatHtmlString';

/**
 * HTML (de)serialization for the Lexical document editor.
 *
 * Stored format is identical to the Yoopta editor's: an HTML string wrapped by
 * formatHTMLString in `<html><head></head><body><div>…</div></body></html>`,
 * with one addition — the Lexical content sits inside a
 * `<div data-editor="lexical">…</div>` marker wrapper (see lexical-doc-marker.ts).
 *
 * Round-trip contract: importDocHtml strips the wrappers/marker before
 * $generateNodesFromDOM; exportDocHtml re-adds exactly one marker div and
 * re-runs formatHTMLString. Saving an unchanged document must be
 * byte-identical (the unsaved-changes baseline is an exact string compare).
 */

/** Unwrap the stored HTML down to the Lexical inner content:
 *  html/head/body skeleton → formatHTMLString's outer <div> → marker div. */
export function extractLexicalInnerHtml(storedHtml: string): string {
    if (!storedHtml) return '';
    try {
        const doc = new DOMParser().parseFromString(storedHtml, 'text/html');
        const marker = doc.querySelector('div[data-editor="lexical" i]');
        if (marker) return marker.innerHTML;
        // Defensive: no marker found (shouldn't happen for a routed slide) —
        // fall back to the body content, unwrapping formatHTMLString's outer div.
        const body = doc.body;
        if (!body) return storedHtml;
        if (
            body.children.length === 1 &&
            body.children[0]?.tagName === 'DIV' &&
            !body.children[0]?.attributes.length
        ) {
            return (body.children[0] as HTMLElement).innerHTML;
        }
        return body.innerHTML;
    } catch (e) {
        console.error('[Lexical] extractLexicalInnerHtml failed:', e);
        return storedHtml;
    }
}

/** Serialize the current editor state to the full stored-HTML format
 *  (marker wrapper + formatHTMLString skeleton). Deterministic. */
export function exportDocHtml(editor: LexicalEditor): string {
    let inner = '';
    editor.getEditorState().read(() => {
        inner = $generateHtmlFromNodes(editor, null);
    });
    return formatHTMLString(`<div data-editor="lexical">${inner}</div>`);
}

/** Load stored HTML into the editor (replaces the whole document). */
export function importDocHtml(editor: LexicalEditor, storedHtml: string): void {
    const inner = extractLexicalInnerHtml(storedHtml);
    editor.update(
        () => {
            const root = $getRoot();
            root.clear();
            const dom = new DOMParser().parseFromString(inner, 'text/html');
            const nodes = $generateNodesFromDOM(editor, dom);
            if (nodes.length === 0) {
                root.append($createParagraphNode());
                return;
            }
            root.select();
            $insertNodes(nodes);
            if (root.getChildrenSize() === 0) {
                root.append($createParagraphNode());
            }
        },
        // Synchronous commit so the caller can export the round-trip baseline
        // immediately after this returns.
        { discrete: true }
    );
}

/** Count custom-block markers per type in an HTML string. Cheap stand-in for
 *  the Yoopta path's detectDeserializeLoss: compares the stored source against
 *  the post-import round-trip to catch silently-dropped blocks before a save
 *  can persist the loss. Also counts the structural tags the backend's
 *  409-guard watches. */
function structuralCounts(htmlString: string): Map<string, number> {
    const counts = new Map<string, number>();
    const bump = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
    try {
        const doc = new DOMParser().parseFromString(htmlString, 'text/html');
        doc.querySelectorAll('[data-yoopta-type]').forEach((el) =>
            bump(el.getAttribute('data-yoopta-type') || 'unknown')
        );
        doc.querySelectorAll('div.mermaid').forEach(() => bump('mermaid'));
        doc.querySelectorAll('table').forEach(() => bump('table'));
        doc.querySelectorAll('img').forEach(() => bump('image'));
        doc.querySelectorAll('video, iframe').forEach(() => bump('video/embed'));
    } catch {
        /* count nothing on parse failure — never block on the guard itself */
    }
    return counts;
}

/** Block types present in `sourceHtml` but with fewer occurrences in
 *  `roundTripHtml` (i.e. dropped by import). Empty array = clean load. */
export function diffStructuralLoss(sourceHtml: string, roundTripHtml: string): string[] {
    const before = structuralCounts(sourceHtml);
    const after = structuralCounts(roundTripHtml);
    const lost: string[] = [];
    before.forEach((count, type) => {
        if ((after.get(type) ?? 0) < count) lost.push(type);
    });
    return lost;
}
