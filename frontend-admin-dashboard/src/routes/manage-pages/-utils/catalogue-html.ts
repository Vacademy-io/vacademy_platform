/**
 * Custom-HTML section ("htmlBlock") safety layer — SHARED between the admin
 * page-builder and the learner renderer (kept byte-identical by
 * scripts/check-style-engine-sync.mjs).
 *
 * htmlBlock is the page-builder's governed escape hatch: AI (or an admin)
 * supplies free-form HTML + CSS for bespoke sections the typed component
 * catalog can't express. Safety model, in order:
 *   1. ai_service sanitizes AI-emitted html/css server-side (nh3 + CSS scrub).
 *   2. This module re-sanitizes at render time (DOMPurify + the same CSS
 *      scrub) — defense in depth, and the ONLY line of defense for HTML an
 *      admin pastes by hand (that path never crosses ai_service).
 *   3. The markup renders inside a shadow root on a `.catalogue-html-section`
 *      host (transform + overflow:clip), so custom CSS cannot leak out and
 *      position:fixed cannot escape the section to overlay the page.
 *
 * Theme integration: CSS custom properties inherit through shadow boundaries,
 * so sections style themselves with var(--primary-*), var(--catalogue-*) and
 * var(--catalogue-heading-font) and stay re-themeable like typed components.
 */
import DOMPurify from 'dompurify';

/** Structural/text tags only — no script/style/iframe/svg/media/form inputs. */
const ALLOWED_TAGS = [
    'a', 'article', 'aside', 'b', 'blockquote', 'br', 'button', 'caption',
    'cite', 'code', 'dd', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure',
    'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'img',
    'li', 'mark', 'nav', 'ol', 'p', 'pre', 's', 'section', 'small', 'span',
    'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
    'time', 'tr', 'u', 'ul',
];

const ALLOWED_ATTR = [
    'class', 'id', 'style', 'title', 'role', 'aria-label', 'aria-hidden',
    'href', 'target', 'rel',
    'src', 'alt', 'width', 'height', 'loading',
    'datetime', 'colspan', 'rowspan', 'scope',
];

const CSS_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const CSS_URL_RE = /url\s*\([^)]*\)/gi;
const CSS_BANNED_RE = /@import\b|expression\s*\(|behavior\s*:|-moz-binding|javascript\s*:/gi;
const MAX_HTML = 30000;
const MAX_CSS = 20000;

/**
 * Scrub a custom-CSS blob: no imports, no url() (assets belong in <img> tags
 * with vetted URLs), no legacy script vectors, and no `</` so the blob cannot
 * break out of the <style> tag it is injected into.
 */
export const scrubCss = (css: string): string =>
    css
        .slice(0, MAX_CSS)
        .replace(CSS_COMMENT_RE, '')
        .replace(CSS_URL_RE, 'none')
        .replace(CSS_BANNED_RE, '')
        .replace(/<\//g, ' ');

export const sanitizeCustomHtml = (html: string): string =>
    DOMPurify.sanitize(html.slice(0, MAX_HTML), {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOW_DATA_ATTR: false,
    });

/**
 * Render a custom-HTML section into `host`'s shadow root (created on first
 * call). Both renderers call this from an effect keyed on html/css.
 */
export const renderHtmlSection = (host: HTMLElement, html: string, css: string): void => {
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    root.innerHTML =
        `<style>:host{display:block;font-family:inherit;color:inherit;}` +
        `${scrubCss(css || '')}</style>${sanitizeCustomHtml(html || '')}`;
};
