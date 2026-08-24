/**
 * Splits message text into plain-text and link segments so a bubble can render URLs,
 * emails and phone numbers as real anchors instead of dead text.
 *
 * Deliberately conservative: only `http(s)://`, `www.` and email/`tel` shapes are matched.
 * Bare domains are not, because ordinary prose ("Node.js", "etc.in", "3.5") would light up.
 */

export type LinkSegment = {
    kind: 'text' | 'link';
    /** The text as written in the message. */
    text: string;
    /** Only set for links: the normalised, safe `href`. */
    href?: string;
};

/**
 * `https://…` / `www.…` runs, an email address, or a +country phone number.
 * The URL branch grabs greedily up to whitespace; `trimTrailing` gives back the
 * sentence punctuation that a greedy match swallows.
 */
const LINK_PATTERN =
    /(?:https?:\/\/|www\.)[^\s<>"']+|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+|\+\d[\d\s-]{7,}\d/gi;

const TRAILING_PUNCTUATION = new Set(['.', ',', ';', ':', '!', '?', '"', "'", '’', '”', '»', '*', '_', '~']);

/** Closers that only belong to the link when the link also carries their opener. */
const BRACKET_PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

const countOf = (value: string, char: string): number =>
    value.split(char).length - 1;

/**
 * Peels punctuation that ended the *sentence* rather than the link — "…form.gle/x4E6."
 * and "(see www.a.com)" should link `…/x4E6` and `www.a.com`, not swallow the period or
 * the closing paren. Balanced brackets inside a URL (a Wikipedia `(disambiguation)` path)
 * are kept.
 */
function trimTrailing(raw: string): string {
    let value = raw;
    while (value.length > 0) {
        const last = value[value.length - 1] as string;
        if (TRAILING_PUNCTUATION.has(last)) {
            value = value.slice(0, -1);
            continue;
        }
        const opener = BRACKET_PAIRS[last];
        if (opener && countOf(value, opener) < countOf(value, last)) {
            value = value.slice(0, -1);
            continue;
        }
        break;
    }
    return value;
}

/** Builds the `href` for a matched run, or null when it is not safely linkable. */
function hrefFor(match: string): string | null {
    if (/^https?:\/\//i.test(match)) {
        // Reject anything that is not really a URL (a lone "https://" for instance).
        return /^https?:\/\/[^/\s]+/i.test(match) ? match : null;
    }
    if (/^www\./i.test(match)) return `https://${match}`;
    if (match.includes('@')) return `mailto:${match}`;
    if (match.startsWith('+')) return `tel:${match.replace(/[\s-]/g, '')}`;
    return null;
}

/** Splits `text` into ordered plain/link segments. Never returns an empty-text segment. */
export function linkifySegments(text: string): LinkSegment[] {
    const segments: LinkSegment[] = [];
    let cursor = 0;

    // `matchAll` needs the /g flag, which carries `lastIndex` state — build a fresh regex.
    const pattern = new RegExp(LINK_PATTERN.source, 'gi');
    for (const match of text.matchAll(pattern)) {
        const raw = match[0];
        const start = match.index ?? 0;
        const linkText = trimTrailing(raw);
        const href = linkText ? hrefFor(linkText) : null;

        if (!href) continue;

        if (start > cursor) {
            segments.push({ kind: 'text', text: text.slice(cursor, start) });
        }
        segments.push({ kind: 'link', text: linkText, href });
        cursor = start + linkText.length;
    }

    if (cursor < text.length) {
        segments.push({ kind: 'text', text: text.slice(cursor) });
    }
    return segments;
}

/** True when the text contains at least one linkable run. */
export function hasLink(text: string): boolean {
    return linkifySegments(text).some((segment) => segment.kind === 'link');
}
