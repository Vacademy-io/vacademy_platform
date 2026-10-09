/**
 * Site content languages for catalogue (website-builder) sites — SHARED between
 * the admin page-builder and the learner renderer (kept byte-identical by
 * scripts/check-style-engine-sync.mjs). Pure: no imports, no React.
 *
 * MODEL: a site is authored in ONE base language (its JSON props, unchanged).
 * Every other language is a DICTIONARY in globalSettings.i18n.strings:
 *
 *     { hi: { "Learn the Indian way of learning.": "सीखने का भारतीय तरीका।" } }
 *
 * keyed by the base-language source string. At render time every component's
 * props are walked and each text value with a translation is swapped
 * (localizeDeep); anything untranslated falls back to the base text, so a
 * half-translated site never shows blanks.
 *
 * WHY A DICTIONARY, NOT A PER-COMPONENT COPY: the site's structure (sections,
 * items, links, colours, toggles) is shared by every language, so adding,
 * removing or reordering an item in the base language needs no second edit,
 * and live data that never lives in the page JSON (course names, folder names)
 * is translated by the very same table. The cost: one source string has one
 * translation per language, which is the right default for a website.
 *
 * The builder's Hindi editing mode goes through applyLocalizedEdit, which
 * routes text edits into the dictionary and every other edit into the shared
 * base props — so none of the per-component editors needs to know about it.
 */

export interface CatalogueLocale {
    /** BCP-47-ish code: 'en', 'hi', 'mr'… */
    code: string;
    /** What the switcher shows: 'EN', 'हिन्दी'. */
    label: string;
}

export interface CatalogueI18nSettings {
    /** Shows the language switcher and honours ?lang=. Off = single-language site. */
    enabled?: boolean;
    /** The language the site is authored in. Defaults to 'en'. */
    defaultLocale?: string;
    /** Languages offered, base language included. */
    locales?: CatalogueLocale[];
    /** locale → (base-language source string → translation). */
    strings?: Record<string, Record<string, string>>;
}

export type TranslationDictionary = Record<string, string>;

/** The URL parameter that carries the visitor's language (?lang=hi). */
export const LOCALE_PARAM = 'lang';

const DEFAULT_LOCALES: CatalogueLocale[] = [
    { code: 'en', label: 'EN' },
    { code: 'hi', label: 'हिन्दी' },
];

/* ── which strings are text ─────────────────────────────────────────── */

/** Keys whose string values are never prose: ids, links, colours, enums… */
const NON_TEXT_KEYS = new Set(
    [
        'id', 'type', 'variant', 'layout', 'align', 'alignment', 'style', 'size', 'scale', 'position',
        'icon', 'font', 'route', 'url', 'href', 'link', 'target', 'src', 'image', 'logo', 'avatar',
        'video', 'poster', 'email', 'phone', 'whatsapp', 'color', 'action', 'code', 'slug', 'tag',
        'tags', 'currency', 'css', 'html_css', 'prompt', 'animation', 'motion', 'preset', 'shape',
        'pattern', 'theme', 'mode', 'sort', 'field', 'source', 'status', 'format', 'locale', 'lang',
        'width', 'height', 'fit', 'ratio', 'aspect', 'easing', 'direction', 'orientation', 'kind',
        'param', 'op', 'key', 'ref', 'columns', 'gap', 'radius', 'showcondition', 'visiblewhen',
    ].map((k) => k.toLowerCase())
);

/** camelCase / snake_case endings that mark a non-text key (backgroundColor, productPageCode, image_url…). */
const NON_TEXT_SUFFIX =
    /(Id|Ids|Url|URL|Uri|Href|Route|Routes|Color|Colour|Code|Src|Slug|Key|Css|Class|ClassName|Image|Images|Logo|Icon|Font|Mode|Type|Style|Layout|Align|Position|Width|Height|Size|Variant|Target|Action|Email|Phone|Date|Time|Pattern|Preset|Shape|Animation|Ratio|Fit|Format|Currency|Locale|Lang|Tag|Tags|Param|Path)$|_(id|ids|url|uri|href|route|color|colour|code|src|slug|key|css|class|image|logo|icon|font|mode|type|style|layout|align|date|time|currency|locale|lang|tag|tags|path)$/;

/** Is a string stored under `key` prose (worth translating)? */
export const isTextKey = (key: string | number | undefined): boolean => {
    if (key === undefined || typeof key === 'number') return true; // array items inherit their parent's verdict
    if (NON_TEXT_KEYS.has(key.toLowerCase())) return false;
    if (NON_TEXT_SUFFIX.test(key)) return false;
    return true;
};

/** Values that are never prose even under a text key: links, colours, pure numbers/prices. */
const looksLikeData = (s: string): boolean => {
    const t = s.trim();
    if (!t) return true;
    if (/^(https?:|mailto:|tel:|data:|\/\/|\/|#[0-9a-f]{3,8}$|rgba?\(|hsla?\(|var\()/i.test(t)) return true;
    return /^[\d\s.,:;%+\-–—/×x*₹$€£¥()]+$/.test(t);
};

/* ── settings helpers ───────────────────────────────────────────────── */

export const baseLocaleOf = (settings: CatalogueI18nSettings | undefined | null): string =>
    (settings?.defaultLocale || 'en').toLowerCase();

/** Languages the switcher offers; always includes the base language first. */
export const localesOf = (settings: CatalogueI18nSettings | undefined | null): CatalogueLocale[] => {
    const base = baseLocaleOf(settings);
    const list = settings?.locales?.length ? settings.locales : DEFAULT_LOCALES;
    const cleaned = list
        .filter((l) => l && typeof l.code === 'string' && l.code.trim())
        .map((l) => ({ code: l.code.trim().toLowerCase(), label: (l.label || l.code).trim() }));
    const seen = new Set<string>();
    const out: CatalogueLocale[] = [];
    const baseEntry = cleaned.find((l) => l.code === base) || { code: base, label: base.toUpperCase() };
    for (const l of [baseEntry, ...cleaned]) {
        if (seen.has(l.code)) continue;
        seen.add(l.code);
        out.push(l);
    }
    return out;
};

/**
 * The language to render: an explicit ?lang= wins, then the visitor's remembered
 * choice, then the site's base language. Unknown codes and disabled sites
 * always resolve to the base language.
 */
export const resolveSiteLocale = (opts: {
    settings: CatalogueI18nSettings | undefined | null;
    urlLocale?: string | null;
    storedLocale?: string | null;
}): string => {
    const base = baseLocaleOf(opts.settings);
    if (!opts.settings?.enabled) return base;
    const allowed = new Set(localesOf(opts.settings).map((l) => l.code));
    for (const candidate of [opts.urlLocale, opts.storedLocale]) {
        const c = (candidate || '').trim().toLowerCase();
        if (c && allowed.has(c)) return c;
    }
    return base;
};

/** The dictionary for `locale`, or undefined when rendering the base language. */
export const dictionaryFor = (
    settings: CatalogueI18nSettings | undefined | null,
    locale: string
): TranslationDictionary | undefined => {
    if (!settings?.enabled) return undefined;
    if (locale === baseLocaleOf(settings)) return undefined;
    const dict = settings.strings?.[locale];
    return dict && Object.keys(dict).length ? dict : undefined;
};

/* ── rendering ──────────────────────────────────────────────────────── */

/** One string through the dictionary; untranslated (or missing) text comes back unchanged. */
export const translateText = (text: string, dict: TranslationDictionary | undefined): string => {
    if (!dict || !text) return text;
    const exact = dict[text];
    if (typeof exact === 'string' && exact !== '') return exact;
    const trimmed = text.trim();
    if (trimmed !== text) {
        const t = dict[trimmed];
        if (typeof t === 'string' && t !== '') return text.replace(trimmed, t);
    }
    return text;
};

/**
 * Walks props and swaps every translated text value. Returns the SAME
 * reference wherever nothing changed (whole tree included), so memoised
 * children and reference-equality checks keep working.
 */
export const localizeDeep = <T>(value: T, dict: TranslationDictionary | undefined, key?: string | number): T => {
    if (!dict) return value;
    if (typeof value === 'string') {
        if (!isTextKey(key)) return value;
        return translateText(value, dict) as unknown as T;
    }
    if (Array.isArray(value)) {
        let changed = false;
        const out = value.map((item) => {
            const next = localizeDeep(item, dict, typeof key === 'string' && !isTextKey(key) ? key : undefined);
            if (next !== item) changed = true;
            return next;
        });
        return (changed ? out : value) as unknown as T;
    }
    if (value && typeof value === 'object') {
        let changed = false;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            const next = localizeDeep(v, dict, k);
            if (next !== v) changed = true;
            out[k] = next;
        }
        return (changed ? out : value) as T;
    }
    return value;
};

/** Every distinct translatable string under `value`, in first-seen order (for AI translation and coverage). */
export const collectTranslatableStrings = (value: unknown, out: string[] = [], seen = new Set<string>(), key?: string | number): string[] => {
    if (typeof value === 'string') {
        if (isTextKey(key) && !looksLikeData(value) && !seen.has(value)) {
            seen.add(value);
            out.push(value);
        }
        return out;
    }
    if (Array.isArray(value)) {
        const inherited = typeof key === 'string' && !isTextKey(key) ? key : undefined;
        for (const item of value) collectTranslatableStrings(item, out, seen, inherited);
        return out;
    }
    if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) collectTranslatableStrings(v, out, seen, k);
    }
    return out;
};

/** How much of `sources` has a translation in `dict`. */
export const translationCoverage = (
    sources: string[],
    dict: TranslationDictionary | undefined
): { total: number; translated: number; missing: string[] } => {
    const missing = sources.filter((s) => !dict || !dict[s]);
    return { total: sources.length, translated: sources.length - missing.length, missing };
};

/* ── editing in a non-base language ─────────────────────────────────── */

export interface LocalizedEditResult<T> {
    /** The base-language props to store (text untouched; structure/toggles from the edit). */
    base: T;
    /** Dictionary changes: source → translation ('' = remove the translation). */
    translations: Record<string, string>;
}

/**
 * The builder's non-base-language editing mode. The admin edits `localized`
 * (= localizeDeep(base, dict)) through the ordinary per-component editors,
 * which hand back `edited`. This splits that edit:
 *
 *  - a text value that existed in the base (same position) → a dictionary
 *    entry for its base source; the base text stays as it was;
 *  - anything else (toggles, colours, links, a NEW item, a removed or
 *    reordered item) → applied to the base, shared by every language.
 *
 * Items are matched by reference first (unchanged items keep their identity
 * through the editors' spread/filter/splice), then by position.
 */
export const applyLocalizedEdit = <T>(base: T, localized: T, edited: T): LocalizedEditResult<T> => {
    const translations: Record<string, string> = {};

    const rebuild = (b: unknown, before: unknown, after: unknown, key?: string | number): unknown => {
        if (after === before) return b === undefined ? after : b;
        if (typeof after === 'string') {
            if (isTextKey(key) && typeof before === 'string' && typeof b === 'string' && b.trim() !== '') {
                translations[b] = after === b ? '' : after;
                return b;
            }
            return after;
        }
        if (Array.isArray(after)) {
            const bArr = Array.isArray(b) ? b : [];
            const beforeArr = Array.isArray(before) ? before : [];
            const childKey = typeof key === 'string' && !isTextKey(key) ? key : undefined;
            return after.map((item, i) => {
                const j = beforeArr.indexOf(item);
                if (j >= 0) return j < bArr.length ? bArr[j] : item;
                // A modified item: pair it with the item that sat at the same
                // position, unless that one survived elsewhere in the list.
                if (i < beforeArr.length && !after.includes(beforeArr[i])) {
                    return rebuild(bArr[i], beforeArr[i], item, childKey);
                }
                return item;
            });
        }
        if (after && typeof after === 'object') {
            const bObj = b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
            const beforeObj =
                before && typeof before === 'object' && !Array.isArray(before) ? (before as Record<string, unknown>) : {};
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(after as Record<string, unknown>)) {
                out[k] = rebuild(bObj[k], beforeObj[k], v, k);
            }
            return out;
        }
        return after;
    };

    return { base: rebuild(base, localized, edited) as T, translations };
};

/** Applies translation changes from applyLocalizedEdit ('' removes an entry). */
export const mergeTranslations = (
    dict: TranslationDictionary | undefined,
    changes: Record<string, string>
): TranslationDictionary => {
    const next: TranslationDictionary = { ...(dict || {}) };
    for (const [source, value] of Object.entries(changes)) {
        if (!value || value === source) delete next[source];
        else next[source] = value;
    }
    return next;
};
