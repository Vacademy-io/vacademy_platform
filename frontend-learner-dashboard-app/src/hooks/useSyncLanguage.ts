import { useEffect } from "react";
import i18n from "@/i18n";
import { useLanguageStore } from "@/stores/localization/useLanguageStore";
import { RTL_LOCALES, RTL_READY } from "@/i18n/locales";

/**
 * Keeps i18next and the document element in sync with the persisted locale.
 * `dir` stays 'ltr' for every locale until the RTL codemod wave flips
 * RTL_READY (see src/i18n/locales.ts).
 */
export const useSyncLanguage = () => {
  const locale = useLanguageStore((state) => state.locale);

  useEffect(() => {
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
    document.documentElement.lang = locale;
    document.documentElement.dir =
      RTL_READY && RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
  }, [locale]);
};
