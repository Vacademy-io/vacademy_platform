/**
 * Institute language configuration — cached locally from the institute
 * settings JSON (setting.LANGUAGE_SETTING.data) by getInstituteDetails.ts,
 * the same way NAMING_SETTING populates the 'namingSettings' key. Written
 * back on save from Settings > Language Settings.
 */
import {
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    isSupportedLocale,
    normalizeLocale,
    type SupportedLocale,
} from '@/i18n/locales';

export const LANGUAGE_SETTING_STORAGE_KEY = 'languageSetting';

/** Shape persisted at LANGUAGE_SETTING.data (snake_case backend contract). */
export interface LanguageSetting {
    default_locale?: string;
    enabled_locales?: string[];
    content_source_locale?: string;
    timezone?: string;
}

/** Reads the cached institute language setting; null when absent/corrupt. */
export function getLanguageSetting(): LanguageSetting | null {
    try {
        const raw = localStorage.getItem(LANGUAGE_SETTING_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? (parsed as LanguageSetting) : null;
    } catch {
        return null;
    }
}

export function setLanguageSettingCache(setting: LanguageSetting): void {
    try {
        localStorage.setItem(LANGUAGE_SETTING_STORAGE_KEY, JSON.stringify(setting));
    } catch {
        // Storage full/unavailable — non-fatal, pickers fall back to defaults.
    }
}

export function clearLanguageSettingCache(): void {
    try {
        localStorage.removeItem(LANGUAGE_SETTING_STORAGE_KEY);
    } catch {
        // Non-fatal.
    }
}

/**
 * Locales the language picker should offer, in canonical SUPPORTED_LOCALES
 * order. Uses the institute's enabled_locales when configured; when the
 * institute has no LANGUAGE_SETTING (all existing institutes), defaults to
 * English plus whatever the user currently has selected, so an already-made
 * choice never becomes unselectable.
 */
export function getEnabledLocales(currentLocale?: string): SupportedLocale[] {
    const setting = getLanguageSetting();
    const configured = (setting?.enabled_locales ?? []).filter(isSupportedLocale);

    const enabled = new Set<SupportedLocale>(
        configured.length > 0 ? configured : [DEFAULT_LOCALE]
    );
    if (currentLocale) {
        enabled.add(normalizeLocale(currentLocale));
    }

    return SUPPORTED_LOCALES.filter((locale) => enabled.has(locale));
}
