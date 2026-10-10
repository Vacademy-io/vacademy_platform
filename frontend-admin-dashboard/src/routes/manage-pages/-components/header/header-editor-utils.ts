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

/** A page as "Sync pages" sees it. */
export interface SyncablePage {
    id: string;
    route: string;
    title?: string;
    published?: boolean;
}

const isHomePage = (p: SyncablePage) =>
    p.id === 'home' || p.route === 'homepage' || p.route === '/' || p.route === '';

/** A nav route as a comparable page key: "/courses", "courses/" and "courses" match; "/" is the home page. */
const pageKeyOf = (route: string | null | undefined): string => {
    const key = (route || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
    return key === '' || key === 'homepage' ? 'homepage' : key;
};

/** A plain site page route ("courses"), not a URL, anchor or filtered link ("/courses?stream=x"). */
const isPlainPageRoute = (route: string | null | undefined): boolean => {
    const v = (route || '').trim();
    return !EXTERNAL.test(v) && !/[?#]/.test(v);
};

/**
 * "Sync pages": the nav lists every published page, in page order. It only
 * adds, removes and orders PAGE links — anything else the admin set up stays:
 * - a link that already points at a page keeps its own label, hidden flag and
 *   options (the same object);
 * - mega menus, external URLs and filtered or anchor links ("/courses?stream=x")
 *   keep their place;
 * - only a link to a page that no longer exists (or is unpublished) is dropped.
 * Pages fill the slots their links held before; new pages follow the last one.
 */
export const syncNavWithPages = <T extends HeaderNavItemValue>(
    current: readonly T[] | null | undefined,
    pages: readonly SyncablePage[]
): T[] => {
    const items = Array.isArray(current) ? current : [];
    const published = pages.filter((p) => p.published !== false);
    const keyOfPage = (p: SyncablePage) => (isHomePage(p) ? 'homepage' : pageKeyOf(p.route));
    const pageKeys = new Set(published.map(keyOfPage));
    // Home is also reachable as its own route ("home").
    const homeAliases = new Set(published.filter(isHomePage).map((p) => pageKeyOf(p.route)));
    const itemKey = (item: T) => {
        const key = pageKeyOf(item.route);
        return homeAliases.has(key) ? 'homepage' : key;
    };
    const isPageLink = (item: T) => item?.type !== 'megaMenu' && isPlainPageRoute(item?.route);

    const existing = new Map<string, T>();
    for (const item of items) {
        if (isPageLink(item) && pageKeys.has(itemKey(item)) && !existing.has(itemKey(item))) {
            existing.set(itemKey(item), item);
        }
    }
    const pageItems = published.map(
        (p) =>
            existing.get(keyOfPage(p)) ??
            ({
                label: p.title || p.route || p.id,
                route: isHomePage(p) ? 'homepage' : p.route,
                openInSameTab: true,
            } as T)
    );

    const out: T[] = [];
    let next = 0;
    for (const item of items) {
        if (!isPageLink(item)) out.push(item);
        else if (next < pageItems.length) out.push(pageItems[next++]!);
        // else: a page link with no page left for its slot — dropped.
    }
    const lastPageSlot = out.reduce(
        (last, item, i) => (pageItems.includes(item) ? i : last),
        out.length - 1
    );
    out.splice(lastPageSlot + 1, 0, ...pageItems.slice(next));
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
