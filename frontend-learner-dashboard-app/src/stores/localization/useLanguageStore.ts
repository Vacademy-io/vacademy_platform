import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  type SupportedLocale,
} from "@/i18n/locales";

interface LanguageState {
  /** Active UI locale (BCP-47 base code, e.g. 'en', 'ar', 'hi'). */
  locale: SupportedLocale;
  /** Accepts any language tag; normalized to a supported locale on set. */
  setLocale: (locale: string) => void;
}

/**
 * Persisted at localStorage 'vacademy-locale'. src/i18n.ts reads the same key
 * (raw) for its initial language — keep the key names in sync. Mirrors the
 * admin app's stores/localization/useLanguageStore.ts.
 */
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      // First visit (nothing persisted yet): follow the browser language,
      // falling back to 'en' — mirrors the init order in src/i18n.ts.
      locale: normalizeLocale(
        typeof navigator !== "undefined" ? navigator.language : DEFAULT_LOCALE
      ),
      setLocale: (locale) => set({ locale: normalizeLocale(locale) }),
    }),
    {
      name: "vacademy-locale",
    }
  )
);
