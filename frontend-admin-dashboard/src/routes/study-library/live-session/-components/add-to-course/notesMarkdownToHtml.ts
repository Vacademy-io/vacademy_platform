import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Convert lecture-notes markdown to an HTML string using the EXACT same parser
 * the transcript preview uses (react-markdown + remark-gfm), rendered to a
 * static string.
 *
 * Why not the hand-rolled markdownToHtml: that naive line converter mishandles
 * images (`![alt](url)` leaked as `!alt` links), intraword/edge-case bold, and
 * blockquotes — so the DOC slide and PDF did not match the preview. Rendering
 * through react-markdown guarantees the stored HTML is byte-for-byte the
 * rendering the user already saw: correct images, bold/italic, blockquotes,
 * tables, lists, code.
 *
 * Runs in the admin (desktop) browser at slide-creation time and produces a
 * plain HTML string — no remark runs when a learner later views the slide.
 */
/**
 * Wrap an <img> in the editor's (Yoopta) expected image-block structure so it
 * renders in the DOC slide. A bare <img> is dropped on deserialization — this
 * mirrors the markup the bulk-upload image slide produces.
 */
const buildImageBlock = (imgTag: string): string => {
    const src = (imgTag.match(/\ssrc="([^"]*)"/) || [])[1] || '';
    const alt = (imgTag.match(/\salt="([^"]*)"/) || [])[1] || '';
    if (!src) return '';
    return `<div style="margin-left: 0px; display: flex; width: 100%; justify-content: center;"><img data-meta-align="center" data-meta-depth="0" src="${src}" alt="${alt}" width="0" height="0" objectFit="contain"/></div>`;
};

export function notesMarkdownToHtml(markdown: string): string {
    if (!markdown?.trim()) return '';
    let html = renderToStaticMarkup(
        createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], children: markdown })
    );

    // The DOC slide imports this HTML through Yoopta's html.deserialize, which
    // is lossy. Normalise the markup the same way the proven bulk-DOC importer
    // (doc-to-html.ts) does, so bold/lists/spacing survive the round-trip.
    const INLINE_TAGS = 'strong|em|b|i|u|code|span|mark|sub|sup|small';
    html = html
        // 1) Strip inter-tag whitespace/newlines react-markdown emits between
        //    blocks → otherwise Yoopta turns those text nodes into empty blocks
        //    (the large gaps). Nesting is preserved (depth → indentation).
        .replace(/>\s+</g, '><')
        .replace(/\s+<(ul|ol)>/g, '<$1>')
        // 2) Move whitespace sitting next to an inline mark INSIDE it as &nbsp;.
        //    Yoopta's Slate deserializer trims text/inline boundaries, which both
        //    glued words together ("ofcellulose") AND dropped the mark when the
        //    space was a plain space. &nbsp; is content, so the space — and the
        //    bold — survive. (Mirrors doc-to-html.ts normalizeInlineWhitespace.)
        .replace(new RegExp(`( |&nbsp;|\\u00a0)(<(?:${INLINE_TAGS})(?:\\s[^>]*)?>)`, 'gi'), '$2&nbsp;')
        .replace(new RegExp(`(</(?:${INLINE_TAGS})>)( |&nbsp;|\\u00a0)`, 'gi'), '&nbsp;$1')
        // 3) Drop empty paragraphs.
        .replace(/<p>\s*<\/p>/g, '');

    return (
        html
            // Wrap images in Yoopta's image-block markup (a bare <img> is dropped
            // on deserialization). Single pass so each is wrapped exactly once.
            .replace(
                /<p>\s*(<img\b[^>]*>)\s*<\/p>|(<img\b[^>]*>)/g,
                (_m, pImg, bareImg) => buildImageBlock(pImg || bareImg)
            )
            // Cap tables to full width.
            .replace(/<table(\s|>)/g, '<table style="max-width:100%;border-collapse:collapse;"$1')
    );
}
