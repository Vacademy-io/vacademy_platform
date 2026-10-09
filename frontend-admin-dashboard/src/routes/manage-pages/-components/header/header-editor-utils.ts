/**
 * Pure helpers for the header editor's mega-menu and button settings.
 * The learner header accepts only a site path ("/courses?stream=x") or a full
 * http(s) URL in these fields; the helpers below keep what the editor stores
 * in that shape.
 */

export const DEFAULT_STREAM_LINK_PATTERN = '/courses?stream={stream}';
export const DEFAULT_CATEGORY_LINK_PATTERN = '/courses?stream={stream}&category={category}';
export const DEFAULT_CTA_LABEL_PATTERN = 'Explore {stream}';
export const DEFAULT_CATEGORIES_HEADING = 'Categories in {stream}';

export interface MegaMenuConfig {
    libraryId?: string;
    libraryName?: string;
    eyebrow?: string;
    helpLabel?: string;
    helpRoute?: string;
    streamLinkPattern?: string;
    categoryLinkPattern?: string;
    ctaLabelPattern?: string;
    categoriesHeading?: string;
    showLegend?: boolean;
    footnote?: string;
}

/** A header nav item as stored; `type` absent = 'link'. */
export interface HeaderNavItemValue {
    label?: string;
    route?: string;
    openInSameTab?: boolean;
    enabled?: boolean;
    type?: 'link' | 'megaMenu';
    megaMenu?: MegaMenuConfig;
}

export type AuthLinkStyle = 'primary' | 'outline' | 'text';

const EXTERNAL = /^(https?:|mailto:|tel:)/i;

/** LinkPicker value (a page route like "about-us" / "homepage", or a URL) → stored site path. */
export const toSitePath = (value: string): string => {
    const v = (value || '').trim();
    if (!v || EXTERNAL.test(v)) return v;
    if (/^homepage$/i.test(v)) return '/';
    return v.startsWith('/') ? v : `/${v}`;
};

/** Stored site path → LinkPicker value, so the picker shows the page as selected. */
export const fromSitePath = (value: string | null | undefined): string => {
    const v = (value || '').trim();
    if (!v || EXTERNAL.test(v)) return v;
    if (v === '/') return 'homepage';
    return v.startsWith('/') && !/[?#]/.test(v) ? v.slice(1) : v;
};

/**
 * Would the live header use this link? Mirrors the learner rule: a site path
 * ("/x", never "//host") or an http(s) URL. Empty counts as fine (= unset).
 */
export const isUsableHeaderLink = (value: string | null | undefined): boolean => {
    const v = (value || '').trim();
    if (!v) return true;
    if (/^\/(?![/\\])/.test(v)) return true;
    return /^https?:\/\/[^/\s]+/i.test(v);
};

/** Placeholders a link pattern may use; anything else would reach the URL as typed. */
export const unknownPatternTokens = (
    pattern: string | null | undefined,
    allowed: string[]
): string[] => {
    const found = new Set<string>();
    for (const match of (pattern || '').matchAll(/\{(\w+)\}/g)) {
        if (!allowed.includes(match[1]!)) found.add(match[1]!);
    }
    return [...found];
};

/**
 * "Sync from pages" rebuilds the nav from the site's pages. A mega-menu item
 * is not a page, so rebuilding would silently drop it and its whole config:
 * each one is kept at its old position instead (clamped to the new list).
 */
export const keepMegaMenuItems = <T extends object>(
    current: readonly T[] | null | undefined,
    fromPages: readonly T[]
): T[] => {
    const out = [...fromPages];
    (Array.isArray(current) ? current : []).forEach((item: T, index: number) => {
        if ((item as { type?: unknown } | null)?.type === 'megaMenu') {
            out.splice(Math.min(index, out.length), 0, item);
        }
    });
    return out;
};

/** The patch that turns a nav item into a mega menu (or back into a link). */
export const navItemTypePatch = (
    item: HeaderNavItemValue,
    type: 'link' | 'megaMenu'
): Partial<HeaderNavItemValue> =>
    type === 'megaMenu'
        ? // A config kept from an earlier switch comes back as it was.
          { type, megaMenu: item.megaMenu ?? { showLegend: true } }
        : { type };
