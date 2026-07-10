/**
 * Utilities for the HTML document slide type (document_slide.type === 'HTML').
 *
 * HTML docs store clean HTML in document_slide.data and are edited with the
 * Tiptap editor (vs the legacy Yoopta 'DOC' type). These helpers keep the
 * platform-wide code-block contract intact and detect empty documents.
 */

export const HTML_DOC_TYPE = 'HTML';

/**
 * Re-attach the platform's lossless code-block contract to Tiptap output.
 *
 * The AI pipeline and the learner renderer use
 *   <pre data-code="<base64 utf-8>" data-language="x"><code class="language-x">…</code></pre>
 * data-code is the source of truth so indentation/newlines survive any later
 * HTML re-parsing (the historical "flattened code" bug), and its presence
 * tells the learner renderer "this is code, never mermaid".
 *
 * Tiptap parses those blocks fine (it reads <pre><code> text + language-x
 * class) but emits plain <pre><code> without data-code — so we re-encode on
 * every save. Mirrors ai_service document_postprocess.normalize_code_blocks.
 */
export function normalizeCodeBlocksHtml(htmlString: string): string {
    if (!htmlString || !htmlString.includes('<pre')) return htmlString;
    try {
        const doc = new DOMParser().parseFromString(htmlString, 'text/html');
        const pres = doc.querySelectorAll('pre');
        pres.forEach((pre) => {
            const code = pre.querySelector('code');
            if (!code) return;
            const codeText = (code.textContent || '').replace(/^\n+|\n+$/g, '');
            // btoa can't take raw UTF-8 — encode via percent-escapes first.
            const encoded = btoa(unescape(encodeURIComponent(codeText)));
            pre.setAttribute('data-code', encoded);
            const langMatch = (code.getAttribute('class') || '').match(/language-([\w+#-]+)/);
            if (langMatch && langMatch[1]) {
                pre.setAttribute('data-language', langMatch[1]);
            }
            pre.setAttribute('style', 'white-space: pre;');
        });
        return doc.body.innerHTML;
    } catch (e) {
        console.error('[html-doc] code-block normalization failed, keeping original HTML:', e);
        return htmlString;
    }
}

/**
 * True when the HTML holds no real content — no text and no media/structural
 * element. Used as the save guard so an empty editor (or a transient blank
 * state during slide switches) never clobbers stored content.
 */
export function isHtmlDocEmpty(htmlString: string | null | undefined): boolean {
    if (!htmlString) return true;
    try {
        const doc = new DOMParser().parseFromString(htmlString, 'text/html');
        const hasText = (doc.body.textContent || '').trim().length > 0;
        if (hasText) return false;
        const hasStructural = doc.body.querySelector(
            'img, video, audio, iframe, embed, object, table, hr, [data-drawing], .mermaid'
        );
        return !hasStructural;
    } catch {
        return htmlString.replace(/<[^>]*>/g, '').trim().length === 0;
    }
}

/**
 * Initial editor content for a slide: published snapshot when the slide is
 * PUBLISHED (matches the Yoopta DOC behaviour), else the draft data.
 */
export function getInitialHtmlDocContent(slide: {
    status?: string;
    document_slide?: { data?: string | null; published_data?: string | null } | null;
}): string {
    const ds = slide.document_slide;
    if (!ds) return '';
    if (slide.status === 'PUBLISHED') {
        return ds.published_data || ds.data || '';
    }
    return ds.data || ds.published_data || '';
}
