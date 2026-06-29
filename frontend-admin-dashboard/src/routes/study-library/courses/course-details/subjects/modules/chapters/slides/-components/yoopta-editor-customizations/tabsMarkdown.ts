/**
 * Lightweight, security-hardened Markdown → HTML for Tabbed Content blocks.
 *
 * Why a dedicated converter (instead of the shared markdownToHtml util):
 *  - The shared util preserves raw HTML blocks and carries mermaid logic we
 *    don't want inside a tab body. Here we ESCAPE all HTML first (keeping the
 *    block's original no-injection posture), then re-introduce a small,
 *    known-safe tag set.
 *  - It also uses regex LOOKBEHIND, which throws "invalid group specifier
 *    name" on iOS <=16.3 — and this admin app ships as a Capacitor iOS build.
 *    Everything below is lookbehind-free.
 *  - Inline styles are emitted on lists/links so markers + formatting render
 *    identically in the admin preview AND the serialized learner HTML,
 *    independent of global CSS resets (Tailwind's preflight strips list
 *    markers, so a bare <ul> would show no bullets).
 *
 * Supported: # / ## / ### headings, - / * / + bullets, 1. numbered lists,
 * **bold**, *italic*, `code`, [text](url), and line breaks.
 */

const escapeHtml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Only allow safe link targets; anything else renders as plain label text.
const safeHref = (raw: string): string | null => {
    const url = raw.trim();
    if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(url)) {
        return url.replace(/"/g, '&quot;');
    }
    return null;
};

// Inline formatting. Input is ALREADY HTML-escaped, so the markdown markers
// (* ` [ ] ( )) survive while real angle brackets do not. Bold runs before
// italic so a single-asterisk pass never eats the `**` pair — this lets the
// italic regex stay lookbehind-free.
const inline = (escaped: string): string =>
    escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
        .replace(
            /`([^`]+?)`/g,
            '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:0.9em;">$1</code>'
        )
        .replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, (_m, label: string, url: string) => {
            const href = safeHref(url);
            return href
                ? `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#007acc;text-decoration:underline;">${label}</a>`
                : label;
        });

const UL_STYLE = 'margin:4px 0;padding-left:22px;list-style:disc;';
const OL_STYLE = 'margin:4px 0;padding-left:22px;list-style:decimal;';
const LI_STYLE = 'margin:2px 0;';

export function renderTabMarkdown(md: string): string {
    if (!md) return '';

    const lines = md.split('\n');
    const out: string[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let textBuf: string[] = [];

    const flushText = () => {
        if (textBuf.length) {
            out.push(textBuf.join('<br/>'));
            textBuf = [];
        }
    };
    const closeList = () => {
        if (listType) {
            out.push(`</${listType}>`);
            listType = null;
        }
    };

    for (const rawLine of lines) {
        const line = rawLine.replace(/\s+$/, '');

        // Headings (#, ##, ### — rendered as styled blocks, not real <hN>, so
        // they never leak into the document-level Table of Contents scanner).
        const heading = /^(#{1,3})\s+(.*)$/.exec(line);
        if (heading) {
            flushText();
            closeList();
            const level = heading[1]!.length;
            const size = level === 1 ? '1.3em' : level === 2 ? '1.15em' : '1.05em';
            out.push(
                `<div style="font-weight:600;font-size:${size};margin:8px 0 4px;">${inline(escapeHtml(heading[2]!))}</div>`
            );
            continue;
        }

        // Unordered list item
        const ul = /^[-*+]\s+(.*)$/.exec(line);
        if (ul) {
            flushText();
            if (listType !== 'ul') {
                closeList();
                out.push(`<ul style="${UL_STYLE}">`);
                listType = 'ul';
            }
            out.push(`<li style="${LI_STYLE}">${inline(escapeHtml(ul[1]!))}</li>`);
            continue;
        }

        // Ordered list item
        const ol = /^\d+\.\s+(.*)$/.exec(line);
        if (ol) {
            flushText();
            if (listType !== 'ol') {
                closeList();
                out.push(`<ol style="${OL_STYLE}">`);
                listType = 'ol';
            }
            out.push(`<li style="${LI_STYLE}">${inline(escapeHtml(ol[1]!))}</li>`);
            continue;
        }

        // Blank line → paragraph / block break
        if (line.trim() === '') {
            flushText();
            closeList();
            continue;
        }

        // Regular text line — soft breaks join with <br/> (matches the
        // block's original newline → <br/> behaviour).
        closeList();
        textBuf.push(inline(escapeHtml(line)));
    }

    flushText();
    closeList();
    return out.join('\n');
}
