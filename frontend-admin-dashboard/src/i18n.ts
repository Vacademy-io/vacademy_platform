// src/i18n.ts — i18next bootstrap (BCP-47 locales, lazy-loaded catalogs).
//
// Catalogs live in src/locales/<locale>/<namespace>.json and are loaded on
// demand via the inline backend below, so adding a language never grows the
// main bundle (Vite code-splits each JSON behind the dynamic import).
import i18n from 'i18next';
import type { BackendModule, ReadCallback } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, normalizeLocale } from './i18n/locales';

/** Must match the zustand persist key in stores/localization/useLanguageStore. */
const LOCALE_STORAGE_KEY = 'vacademy-locale';

/**
 * Reads the locale persisted by useLanguageStore (zustand persist envelope:
 * `{"state":{"locale":"en"},"version":0}`). Read directly from localStorage so
 * i18n init stays dependency-free and runs before any store code.
 */
function getPersistedLocale(): string | null {
    try {
        const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { state?: { locale?: unknown } };
        return typeof parsed?.state?.locale === 'string' ? parsed.state.locale : null;
    } catch {
        return null;
    }
}

/** Initial language: persisted choice → browser language → 'en'. */
const initialLocale = normalizeLocale(
    getPersistedLocale() ?? (typeof navigator !== 'undefined' ? navigator.language : null)
);

/**
 * Inline lazy backend — loads src/locales/<lng>/<ns>.json on demand. Written
 * inline instead of adding i18next-resources-to-backend as a dependency.
 */
const lazyLocaleBackend: BackendModule = {
    type: 'backend',
    init() {
        // No options needed.
    },
    read(lng: string, ns: string, callback: ReadCallback) {
        import(`./locales/${lng}/${ns}.json`)
            .then((module) => callback(null, module.default ?? module))
            .catch((error) => callback(error as Error, null));
    },
};

i18n.use(lazyLocaleBackend)
    .use(initReactI18next)
    .init({
        lng: initialLocale,
        fallbackLng: DEFAULT_LOCALE,
        supportedLngs: [...SUPPORTED_LOCALES],
        // 'en-US' resolves to 'en' instead of being rejected.
        nonExplicitSupportedLngs: true,
        load: 'languageOnly',
        defaultNS: 'common',
        ns: ['common'],
        interpolation: {
            escapeValue: false, // React already escapes.
        },
        react: {
            // Catalogs load async; don't suspend the whole tree while they do.
            useSuspense: false,
        },
    });

export default i18n;
