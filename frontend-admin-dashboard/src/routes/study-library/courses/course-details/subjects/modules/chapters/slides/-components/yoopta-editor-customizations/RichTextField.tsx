import { useEffect, useRef } from 'react';
import { getPublicUrl, UploadFileInS3 } from '@/services/upload_file';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

// Shared rich-text editor for Yoopta custom blocks (quiz, tabbed content, …).
// A lightweight controlled contentEditable with its own compact toolbar
// (B / I / U / bullet / numbered / link / image). It renders dependably inside
// the Slate/Yoopta document (unlike a full nested editor), commits on input +
// blur, isolates its native key/input events so the outer editor can't swallow
// Backspace/Delete, and never lets a stale value wipe what's being typed.

const C = {
    accent: '#4338ca', // design-lint-ignore: shared rich-text chrome — inline style required
    accentSoft: '#eef2ff', // design-lint-ignore: shared rich-text chrome — inline style required
    muted: '#666666', // design-lint-ignore: shared rich-text chrome — inline style required
    border: '#dddddd', // design-lint-ignore: shared rich-text chrome — inline style required
    surface: '#fafafa', // design-lint-ignore: shared rich-text chrome — inline style required
    white: '#ffffff', // design-lint-ignore: shared rich-text chrome — inline style required
};

/** Upload an image to S3 and return its public URL. Returns null on failure. */
async function uploadImage(file: File): Promise<string | null> {
    try {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const data = getTokenDecodedData(accessToken);
        const INSTITUTE_ID = (data && Object.keys(data.authorities)[0]) || undefined;
        const userId = data?.sub || 'unknown-user';
        const fileId = await UploadFileInS3(file, () => {}, userId, INSTITUTE_ID, 'STUDENTS', true);
        if (!fileId) return null;
        const url = await getPublicUrl(fileId);
        return url || null;
    } catch (e) {
        console.error('[RichText] image upload failed', e);
        return null;
    }
}

// Treat blank / "<p><br></p>" / nbsp-only / formatting-only content as empty,
// but never embedded media (image/video/etc.).
export const isRichTextEmpty = (html?: string): boolean => {
    if (!html) return true;
    if (/<(img|iframe|video|audio)\b/i.test(html)) return false;
    return (
        html.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').trim() === ''
    );
};

// Escape a JSON string for safe embedding in an HTML attribute (& first), so the
// stored rich-text HTML round-trips losslessly through getAttribute on reload.
export const escapeRichTextAttr = (s: string): string =>
    s
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

// Store a block's JSON payload as base64 inside a data-* attribute. Base64 uses
// only [A-Za-z0-9+/=], so the document-wide HTML sanitizers (stripAwsQueryParams,
// empty-img, data-meta strippers in formatHTMLString) can NEVER match — and thus
// can never truncate/corrupt the JSON. This was the root cause of vanishing
// quiz/tab content when an S3 image (…amazonaws.com?X-Amz-Signature=…) lived
// inside the rich text: the strip-aws regex ate across the encoded JSON quotes
// and broke JSON.parse on reload, resetting the block to empty defaults.
export const encodeBlockData = (obj: unknown): string => {
    try {
        return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
    } catch (e) {
        console.error('[BlockData] encode failed', e);
        return '';
    }
};

// Decode a data-* payload written by encodeBlockData. Backward compatible: older
// slides stored raw/escaped JSON (which getAttribute returns starting with { or
// [), so we parse that directly; newer slides store base64 (no leading brace).
export function decodeBlockData<T>(raw: string | null | undefined, fallback: T): T {
    if (raw == null) return fallback;
    const s = String(raw).trim();
    if (!s) return fallback;
    // Legacy uncoded JSON (getAttribute already entity-decoded it).
    if (s[0] === '{' || s[0] === '[') {
        try {
            return JSON.parse(s) as T;
        } catch {
            return fallback;
        }
    }
    // New base64 payload.
    try {
        return JSON.parse(decodeURIComponent(escape(atob(s)))) as T;
    } catch {
        // Last resort: maybe it really was JSON that didn't start with a brace.
        try {
            return JSON.parse(s) as T;
        } catch {
            return fallback;
        }
    }
}

const placeCaretAtEnd = (el: HTMLElement) => {
    try {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    } catch {
        /* noop */
    }
};

const safeLinkHref = (raw: string): string | null => {
    const url = raw.trim();
    if (!url) return null;
    if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(url)) return url;
    if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(url)) return `https://${url}`;
    return null;
};

// Inject (and keep up to date) the shared field styles: placeholder, focus ring,
// and list markers re-enabled past Tailwind's `list-style: none` preflight reset.
export function ensureRichTextStyles() {
    if (typeof document === 'undefined') return;
    const css = `
        .rich-text-field:empty:before { content: attr(data-placeholder); color: ${C.muted}; pointer-events: none; }
        .rich-text-box:focus-within { border-color: ${C.accent} !important; box-shadow: 0 0 0 1px ${C.accent}; }
        .rich-text-field img, .rich-text-html img { max-width: 100%; height: auto; border-radius: 4px; }
        .rich-text-field p, .rich-text-field div, .rich-text-html p, .rich-text-html div { margin: 0; }
        .rich-text-field ul, .rich-text-html ul { list-style: disc outside !important; margin: 4px 0; padding-left: 26px; }
        .rich-text-field ol, .rich-text-html ol { list-style: decimal outside !important; margin: 4px 0; padding-left: 26px; }
        .rich-text-field li, .rich-text-html li { display: list-item !important; margin: 2px 0; }
        .rich-text-field a, .rich-text-html a { color: ${C.accent}; text-decoration: underline; }
    `;
    let style = document.getElementById('rich-text-field-styles') as HTMLStyleElement | null;
    if (!style) {
        style = document.createElement('style');
        style.id = 'rich-text-field-styles';
        document.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
}

/** Renders stored rich-text HTML (preview / read-only states). */
export function RichTextHtml({ html, style }: { html: string; style?: React.CSSProperties }) {
    return (
        <div
            className="rich-text-html"
            style={style}
            dangerouslySetInnerHTML={{ __html: html || '' }}
        />
    );
}

export function RichTextField({
    value,
    onChange,
    placeholder,
    minHeight,
}: {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    minHeight?: number;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        ensureRichTextStyles();
    }, []);

    // Sync DOM only on an EXTERNAL value change (never our own keystrokes) so the
    // caret never jumps; and never let a stale/empty value wipe what's being typed.
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (el.innerHTML === (value || '')) return;
        if (
            document.activeElement === el &&
            isRichTextEmpty(value || '') &&
            !isRichTextEmpty(el.innerHTML)
        ) {
            return;
        }
        el.innerHTML = value || '';
    }, [value]);

    // Stop the outer Slate editor's NATIVE beforeinput/keydown from swallowing
    // Backspace/Delete inside this nested contentEditable. (Not `input`, so the
    // change is still captured.)
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const stopNative = (e: Event) => e.stopPropagation();
        el.addEventListener('beforeinput', stopNative);
        el.addEventListener('keydown', stopNative);
        el.addEventListener('keyup', stopNative);
        return () => {
            el.removeEventListener('beforeinput', stopNative);
            el.removeEventListener('keydown', stopNative);
            el.removeEventListener('keyup', stopNative);
        };
    }, []);

    const fire = () => {
        if (ref.current) onChange(ref.current.innerHTML);
    };

    const exec = (command: string, val?: string) => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        document.execCommand(command, false, val);
        fire();
    };

    const insertLink = () => {
        const el = ref.current;
        if (!el) return;
        const raw = window.prompt('Link URL:');
        if (!raw) return;
        const href = safeLinkHref(raw);
        if (!href) return;
        el.focus();
        document.execCommand('createLink', false, href);
        fire();
    };

    const insertImage = () => {
        const el = ref.current;
        if (!el) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            const url = await uploadImage(file);
            const node = ref.current;
            if (!url || !node) return;
            node.focus();
            placeCaretAtEnd(node);
            document.execCommand(
                'insertHTML',
                false,
                `<img src="${url.replace(/"/g, '&quot;')}" alt="" style="max-width:100%;" />`
            );
            // A trailing image leaves no caret position after it — add an empty
            // line and move the caret into it so you can type below the image.
            const line = document.createElement('div');
            line.appendChild(document.createElement('br'));
            node.appendChild(line);
            try {
                const range = document.createRange();
                range.setStart(line, 0);
                range.collapse(true);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
            } catch {
                /* noop */
            }
            fire();
        };
        input.click();
    };

    const stop = (e: React.SyntheticEvent) => e.stopPropagation();

    const tbBtn = (
        label: string,
        onClick: () => void,
        title: string,
        extra?: React.CSSProperties
    ) => (
        <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            title={title}
            style={{
                minWidth: '26px',
                height: '24px',
                padding: '0 6px',
                fontSize: '13px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                color: C.muted,
                cursor: 'pointer',
                ...extra,
            }}
            onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.accentSoft;
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
        >
            {label}
        </button>
    );

    return (
        <div
            className="rich-text-box"
            style={{
                border: `1px solid ${C.border}`,
                borderRadius: '6px',
                overflow: 'hidden',
                backgroundColor: C.white,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1px',
                    flexWrap: 'wrap',
                    padding: '3px 4px',
                    borderBottom: `1px solid ${C.border}`,
                    backgroundColor: C.surface,
                }}
            >
                {tbBtn('B', () => exec('bold'), 'Bold', { fontWeight: 700 })}
                {tbBtn('I', () => exec('italic'), 'Italic', { fontStyle: 'italic' })}
                {tbBtn('U', () => exec('underline'), 'Underline', { textDecoration: 'underline' })}
                {tbBtn('•', () => exec('insertUnorderedList'), 'Bullet list')}
                {tbBtn('1.', () => exec('insertOrderedList'), 'Numbered list')}
                {tbBtn('🔗', insertLink, 'Insert link')}
                {tbBtn('🖼', insertImage, 'Insert image')}
            </div>

            <div
                ref={ref}
                contentEditable
                suppressContentEditableWarning
                className="rich-text-field"
                data-placeholder={placeholder || ''}
                onInput={fire}
                onBlur={fire}
                onKeyDown={stop}
                onKeyUp={stop}
                onMouseDown={stop}
                onPaste={stop}
                onCut={stop}
                onCopy={stop}
                onDrop={stop}
                style={{
                    minHeight: minHeight ? `${minHeight}px` : '40px',
                    padding: '8px 10px',
                    fontSize: '14px',
                    lineHeight: 1.5,
                    outline: 'none',
                    overflowWrap: 'anywhere',
                }}
            />
        </div>
    );
}
