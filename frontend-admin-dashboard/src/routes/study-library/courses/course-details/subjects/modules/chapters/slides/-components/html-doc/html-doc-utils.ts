/**
 * Utilities for the HTML document slide type (document_slide.type === 'HTML').
 *
 * HTML docs store clean HTML in document_slide.data and are edited with the
 * Tiptap editor (vs the legacy Yoopta 'DOC' type). These helpers keep the
 * platform-wide code-block contract intact and detect empty documents.
 */

export const HTML_DOC_TYPE = 'HTML';

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
