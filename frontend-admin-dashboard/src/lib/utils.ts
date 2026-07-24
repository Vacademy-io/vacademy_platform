import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function isNullOrEmptyOrUndefined<T>(
    value: T | null | undefined
): value is null | undefined {
    return value === null || value === undefined || (typeof value === 'string' && value === '');
}

export function convertCapitalToTitleCase(str: string) {
    return str;
}

export function parseHtmlToString(html: string) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || doc.body.innerText || '';
}

/**
 * Returns true when a rich-text/HTML value has no visible content — e.g. "",
 * "<p></p>", "<p><br></p>", "&nbsp;", or whitespace-only markup that a TipTap/
 * rich-text editor emits for an empty field. Media-only content (img, video,
 * iframe, audio, svg) counts as non-empty so we never hide a real explanation.
 * Use this instead of a bare `!html` / `html.trim()` truthiness check before
 * rendering an "Explanation" / rich-text box.
 */
export function isRichTextEmpty(html?: string | null): boolean {
    if (!html) return true;
    if (/<(img|video|iframe|audio|svg)[\s/>]/i.test(html)) return false;
    return /^\s*$/.test(parseHtmlToString(html));
}

/**
 * Title-cases a package/genre tag while preserving separators.
 * Bulk-create stores tags as trim().toLowerCase(), keeping spaces and
 * hyphens intact. This helper capitalizes each word without flattening
 * hyphens into spaces.
 *
 * Examples:
 *   "sci-fi"           -> "Sci-Fi"
 *   "science fiction"  -> "Science Fiction"
 *   "rom-com thriller" -> "Rom-Com Thriller"
 */
export function formatTagForDisplay(tag: string): string {
    if (!tag) return '';
    const cap = (s: string) =>
        s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
    return tag
        .trim()
        .split(/\s+/)
        .map((word) => word.split('-').map(cap).join('-'))
        .join(' ');
}

/**
 * Case-insensitive natural comparator for lists of `{ name }` objects, so
 * numbered items order the way people expect: "Class 9" before "Class 10"
 * (not after "Class 1"), then non-numeric names alphabetically. Use it to
 * sort filter option lists (e.g. levels) that would otherwise inherit an
 * arbitrary API/insertion order.
 */
export function compareByNameNatural<T extends { name: string }>(a: T, b: T): number {
    return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base',
    });
}

export const goToWhatsappSupport = () => {
    const phoneNumber = '+919201534254'; // Your WhatsApp number (with country code)
    const message = encodeURIComponent('Hello, I have a question.');

    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

    window.open(whatsappUrl, '_blank');
};

/**
 * Opens the user's default email client to send a support request.
 */
export const goToMailSupport = () => {
    const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'hello@vacademy.io';
    const subject = encodeURIComponent('Support Request');
    const body = encodeURIComponent('I need help with: \n[Describe your issue here]');

    const mailtoUrl = `mailto:${supportEmail}?subject=${subject}&body=${body}`;

    window.location.href = mailtoUrl;
};
