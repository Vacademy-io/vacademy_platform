// src/i18n.ts — i18next bootstrap (BCP-47 locales, lazy-loaded catalogs).
//
// Catalogs live in public/locales/<locale>/<namespace>.json and are fetched on
// demand by the inline backend below, so adding a language never grows the
// main bundle.
//
// They live in public/ (served as static files) rather than src/ (bundled)
// deliberately: as src/ modules the ~3,200 catalogs entered the Rollup graph
// and each became its own chunk, which added ~1.2 GB to the build's peak
// memory (4.9 GB vs 3.7 GB measured) and pushed dist from ~900 to ~4,100
// files. That was enough to make the CI builder thrash in `rendering chunks`.
// Keep them out of the graph.
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
 * Inline lazy backend — fetches public/locales/<lng>/<ns>.json on demand.
 * Written inline instead of adding i18next-http-backend as a dependency.
 *
 * The `?v=` cache-bust matters: files under public/ are copied to dist
 * verbatim, so unlike hashed bundle assets their URLs never change between
 * releases. Keying on the app version stops a browser serving last release's
 * catalog after a deploy.
 *
 * NOTE: `/locales/*` must stay in the `exclude` list of public/_routes.json.
 * That file routes `/*` to the Pages Function, which answers unknown paths
 * with index.html — so without the exclusion these fetches would resolve to
 * HTML and every namespace would fail to parse.
 */
const lazyLocaleBackend: BackendModule = {
    type: 'backend',
    init() {
        // No options needed.
    },
    read(lng: string, ns: string, callback: ReadCallback) {
        fetch(`/locales/${lng}/${ns}.json?v=${__VERSION__}`)
            .then((res) => {
                if (!res.ok) throw new Error(`${res.status} loading ${lng}/${ns}`);
                return res.json();
            })
            .then((data) => callback(null, data))
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
