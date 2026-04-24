import { YooptaPlugin } from '@yoopta/editor';

// Stashes the raw code in a base64 data-code attribute so newlines survive
// any HTML-whitespace normalization (CSS pre-line, server round-trip,
// innerHTML reflow, etc.). Deserialize prefers the attribute, falling back
// to <code> textContent so old slides without the attribute still load.

const encode = (text: string): string => {
    try {
        return btoa(unescape(encodeURIComponent(text)));
    } catch {
        return '';
    }
};

const decode = (b64: string): string => {
    try {
        return decodeURIComponent(escape(atob(b64)));
    } catch {
        return '';
    }
};

const escapeHtml = (s: string): string =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

export function CodeWithPreservedNewlines(baseCode: any): any {
    const basePlugin = baseCode?.getPlugin || baseCode;
    const baseParsers = basePlugin?.parsers || {};
    const baseHtml = baseParsers.html || {};

    return new YooptaPlugin({
        ...basePlugin,
        parsers: {
            ...baseParsers,
            html: {
                ...baseHtml,
                deserialize: {
                    nodeNames: ['PRE'],
                    parse: (el: HTMLElement) => {
                        if (el.nodeName !== 'PRE') return undefined;
                        const encoded = el.getAttribute('data-code') || '';
                        const codeEl = el.querySelector('code');
                        const fallback = codeEl ? codeEl.textContent : el.textContent;
                        const text = encoded ? decode(encoded) : fallback || '';
                        const language = el.getAttribute('data-language') || 'javascript';
                        const theme = el.getAttribute('data-theme') || 'VSCode';
                        return {
                            children: [{ text }],
                            type: 'code',
                            id: `code-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                            props: { language, theme, nodeType: 'void' },
                        } as any;
                    },
                },
                serialize: (element: any, _text: string, meta: any) => {
                    const code: string =
                        (element?.children || [])
                            .map((c: any) => (typeof c?.text === 'string' ? c.text : ''))
                            .join('') || '';
                    const language = element?.props?.language || 'javascript';
                    const theme = element?.props?.theme || 'VSCode';
                    const align = meta?.align || 'left';
                    const depth = meta?.depth || 0;
                    const justify =
                        align === 'center'
                            ? 'center'
                            : align === 'right'
                              ? 'flex-end'
                              : 'flex-start';
                    const encoded = encode(code);
                    const style = `margin-left: ${
                        20 * depth
                    }px; display: flex; width: 100%; justify-content: ${justify}; background-color: #263238; color: #fff; padding: 20px 24px; white-space: pre;`;
                    return `<pre data-code="${encoded}" data-theme="${theme}" data-language="${language}" data-meta-align="${align}" data-meta-depth="${depth}" style="${style}"><code>${escapeHtml(
                        code
                    )}</code></pre>`;
                },
            },
        },
    } as any);
}
