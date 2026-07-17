/**
 * Canonical locale spec for the platform (BCP-47 codes).
 *
 * This is the single source of truth for which UI languages exist, their
 * native labels, scripts and text direction. Every locale-aware surface
 * (i18n init, language dropdown, Settings > Language, Accept-Language header,
 * Intl formatters) must import from here instead of redefining its own list.
 *
 * GENERATED from <monorepo root>/locales.json — regenerate with
 * `node scripts/gen-locales.mjs`; only RTL_READY is app-owned (preserved
 * across regeneration). The order of SUPPORTED_LOCALES is intentional
 * (en first, then priority languages) and is used as picker display order.
 */

export const SUPPORTED_LOCALES = [
    'en',
    'ar',
    'hi',
    'ta',
    'te',
    'bn',
    'mr',
    'gu',
    'kn',
    'ml',
    'pa',
    'or',
    'as',
    'es',
    'fr',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

/** Locales rendered right-to-left. */
export const RTL_LOCALES: readonly SupportedLocale[] = ['ar'];

/**
 * HARD GATE for RTL layout. The document `dir` attribute stays 'ltr' for every
 * locale (including Arabic) until the RTL codemod wave lands — flipping dir
 * before the codebase is logical-property clean would break most screens.
 * Flip to true only as part of that wave.
 */
export const RTL_READY: boolean = false;

/** Native (endonym) display names — what users see in language pickers. */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
    en: 'English',
    ar: 'العربية',
    hi: 'हिन्दी',
    ta: 'தமிழ்',
    te: 'తెలుగు',
    bn: 'বাংলা',
    mr: 'मराठी',
    gu: 'ગુજરાતી',
    kn: 'ಕನ್ನಡ',
    ml: 'മലയാളം',
    pa: 'ਪੰਜਾਬੀ',
    or: 'ଓଡ଼ିଆ',
    as: 'অসমীয়া',
    es: 'Español',
    fr: 'Français',
};

/** Writing script per locale (useful for font stacks / content pipelines). */
export const LOCALE_SCRIPTS: Record<SupportedLocale, string> = {
    en: 'latin',
    ar: 'arabic',
    hi: 'devanagari',
    ta: 'tamil',
    te: 'telugu',
    bn: 'bengali',
    mr: 'devanagari',
    gu: 'gujarati',
    kn: 'kannada',
    ml: 'malayalam',
    pa: 'gurmukhi',
    or: 'odia',
    as: 'bengali',
    es: 'latin',
    fr: 'latin',
};

export function isSupportedLocale(value: unknown): value is SupportedLocale {
    return (
        typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
    );
}

/**
 * Normalizes any language tag to a supported locale:
 * 'en-US' → 'en', 'hi-IN' → 'hi', unknown/empty → DEFAULT_LOCALE.
 */
export function normalizeLocale(value: string | null | undefined): SupportedLocale {
    if (!value || typeof value !== 'string') return DEFAULT_LOCALE;
    const trimmed = value.trim();
    if (isSupportedLocale(trimmed)) return trimmed;
    const base = trimmed.toLowerCase().split(/[-_]/)[0] ?? '';
    return isSupportedLocale(base) ? base : DEFAULT_LOCALE;
}
