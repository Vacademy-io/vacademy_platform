/**
 * What a site's languages have to cover — pure helpers shared by the
 * Languages card, the Translations panel and the publish checks.
 *
 * Authored text = every translatable string a visitor can see in the page
 * sections (column children included), page SEO and the global header/footer.
 * It is exactly the set the learner renderer localizes, so "100%" means the
 * whole page reads in that language.
 */
import {
    collectTranslatableStrings,
    localesOf,
    mergeTranslations,
    translationCoverage,
    type CatalogueLocale,
    type TranslationDictionary,
} from '../../-utils/catalogue-i18n';
import type { CatalogueConfig, Component } from '../../-types/editor-types';
import { LOCALE_LABELS } from '@/i18n/locales';

type SiteConfig = Pick<CatalogueConfig, 'pages' | 'globalSettings'> | null | undefined;

/** What a language is called in the builder: its own name ('English', 'हिन्दी'). */
export const languageName = (code: string, fallbackLabel?: string): string =>
    (LOCALE_LABELS as Record<string, string>)[code] || fallbackLabel || code.toUpperCase();

const visitComponent = (c: Component | null | undefined, out: string[], seen: Set<string>) => {
    if (!c || typeof c !== 'object' || c.enabled === false) return;
    if (!c.props || typeof c.props !== 'object') return;
    collectTranslatableStrings(c.props, out, seen);
    // Column children sit under the opaque `slots` key: walk them as sections.
    const slots = c.props.slots;
    if (Array.isArray(slots)) {
        for (const slot of slots) {
            if (!Array.isArray(slot)) continue;
            for (const child of slot) visitComponent(child as Component, out, seen);
        }
    }
};

/** Distinct translatable texts of the site, in reading order (header, pages, footer). Hidden sections are skipped. */
export const collectSiteStrings = (config: SiteConfig): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    if (!config) return out;
    const layout = config.globalSettings?.layout;
    visitComponent(layout?.header, out, seen);
    for (const page of config.pages || []) {
        for (const c of page?.components || []) visitComponent(c, out, seen);
        if (page?.seo) collectTranslatableStrings(page.seo, out, seen);
    }
    visitComponent(layout?.footer, out, seen);
    return out;
};

export interface Coverage {
    total: number;
    translated: number;
    missing: string[];
    /** Rounded DOWN, so 99.6% never reads as done. */
    percent: number;
}

export const coverageOf = (
    sources: string[],
    dict: TranslationDictionary | undefined
): Coverage => {
    const c = translationCoverage(sources, dict);
    return { ...c, percent: c.total ? Math.floor((c.translated / c.total) * 100) : 100 };
};

export interface LocaleCoverage extends CatalogueLocale, Coverage {}

/** Coverage of the site's authored text for every offered language except the base. */
export const siteCoverage = (config: SiteConfig): LocaleCoverage[] => {
    const i18n = config?.globalSettings?.i18n;
    const sources = collectSiteStrings(config);
    return localesOf(i18n)
        .slice(1)
        .map((locale) => ({ ...locale, ...coverageOf(sources, i18n?.strings?.[locale.code]) }));
};

/**
 * "Same as the base language" (a brand name, 'NEET'): stored as an identity
 * entry. translateText renders it unchanged and translationCoverage counts it
 * as translated, so it stops showing up as missing. (mergeTranslations drops
 * identity values, so this is written directly.)
 */
export const keepAsBase = (
    dict: TranslationDictionary | undefined,
    sources: string[]
): TranslationDictionary => {
    const next: TranslationDictionary = { ...(dict || {}) };
    for (const s of sources) next[s] = s;
    return next;
};

export const isKeptAsBase = (dict: TranslationDictionary | undefined, source: string): boolean =>
    !!dict && dict[source] === source;

/** One inline edit: '' (or the base text itself) removes the entry. */
export const setTranslation = (
    dict: TranslationDictionary | undefined,
    source: string,
    value: string
): TranslationDictionary => mergeTranslations(dict, { [source]: value });

/**
 * Merges AI results. Results equal to their source are not stored (they would
 * read as "kept" without anyone deciding so) — they come back in `unchanged`
 * for the admin to confirm.
 */
export const mergeAiTranslations = (
    dict: TranslationDictionary | undefined,
    results: Record<string, string>
): { dict: TranslationDictionary; unchanged: string[] } => {
    const changes: Record<string, string> = {};
    const unchanged: string[] = [];
    for (const [source, value] of Object.entries(results || {})) {
        if (typeof value !== 'string' || !value.trim()) continue;
        if (value === source) unchanged.push(source);
        else changes[source] = value;
    }
    return { dict: mergeTranslations(dict, changes), unchanged };
};

export interface BatchLimits {
    /** Strings per request. */
    maxItems: number;
    /** Characters per request. */
    maxChars: number;
    /** A string this long goes in a request of its own. */
    longChars: number;
    /** Longer than this is not sent at all (whole pasted pages): translate by hand. */
    maxStringChars: number;
}

export const DEFAULT_BATCH_LIMITS: BatchLimits = {
    maxItems: 40,
    maxChars: 6000,
    longChars: 3000,
    maxStringChars: 30000,
};

/** Splits texts into AI requests that stay well inside the endpoint's limits and the browser timeout. */
export const batchForTranslation = (
    sources: string[],
    limits: BatchLimits = DEFAULT_BATCH_LIMITS
): { batches: string[][]; tooLong: string[] } => {
    const batches: string[][] = [];
    const tooLong: string[] = [];
    let current: string[] = [];
    let chars = 0;
    for (const s of sources) {
        if (s.length > limits.maxStringChars) {
            tooLong.push(s);
            continue;
        }
        if (s.length >= limits.longChars) {
            batches.push([s]);
            continue;
        }
        if (
            current.length > 0 &&
            (current.length >= limits.maxItems || chars + s.length > limits.maxChars)
        ) {
            batches.push(current);
            current = [];
            chars = 0;
        }
        current.push(s);
        chars += s.length;
    }
    if (current.length > 0) batches.push(current);
    return { batches, tooLong };
};
