import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  LOCALE_PARAM,
  baseLocaleOf,
  dictionaryFor,
  localesOf,
  resolveSiteLocale,
  translateText,
  type CatalogueI18nSettings,
  type CatalogueLocale,
  type TranslationDictionary,
} from "./catalogue-i18n";
import { useCatalogueSearchParams } from "./catalogue-url-state";

/**
 * The visitor's site language, for every catalogue section (see
 * catalogue-i18n.ts for the model). Mounted once around the page tree; a
 * section reads it with useCatalogueLocale(), and live-data sections (course
 * names, folder names) translate their strings with useSiteT().
 *
 * Without a provider — or on a single-language site — everything resolves to
 * the base language with no dictionary, so sections behave exactly as before.
 */

export interface CatalogueLocaleValue {
  /** Language being rendered. */
  locale: string;
  /** Language the site is authored in. */
  baseLocale: string;
  /** Languages offered by the switcher (base first). Empty when the site is single-language. */
  locales: CatalogueLocale[];
  /** True when a switcher should show. */
  enabled: boolean;
  /** Translations for `locale`; undefined when rendering the base language. */
  dict: TranslationDictionary | undefined;
  /** Switches language: remembered for the visitor and reflected in ?lang=. */
  setLocale: (code: string) => void;
  /** One string through the dictionary (identity in the base language). */
  t: (text: string | null | undefined) => string;
}

const identity = (text: string | null | undefined) => text ?? "";

const FALLBACK: CatalogueLocaleValue = {
  locale: "en",
  baseLocale: "en",
  locales: [],
  enabled: false,
  dict: undefined,
  setLocale: () => {},
  t: identity,
};

const CatalogueLocaleContext = createContext<CatalogueLocaleValue>(FALLBACK);

const storageKey = (scope: string) => `catalogue-locale:${scope}`;

const readStored = (scope: string): string | null => {
  try {
    return localStorage.getItem(storageKey(scope));
  } catch {
    return null;
  }
};

const writeStored = (scope: string, code: string) => {
  try {
    localStorage.setItem(storageKey(scope), code);
  } catch {
    // Private mode: the choice lasts as long as ?lang= stays in the URL.
  }
};

export const CatalogueLocaleProvider: React.FC<{
  /** globalSettings.i18n of the site being rendered. */
  settings: CatalogueI18nSettings | undefined | null;
  /** Remembers the choice per site (tag name or institute id). */
  scope: string;
  children: React.ReactNode;
}> = ({ settings, scope, children }) => {
  const { get, update } = useCatalogueSearchParams();
  const urlLocale = get(LOCALE_PARAM);
  const [stored, setStored] = useState<string | null>(() => readStored(scope));

  useEffect(() => {
    setStored(readStored(scope));
  }, [scope]);

  const enabled = !!settings?.enabled;
  const baseLocale = baseLocaleOf(settings);
  const locale = resolveSiteLocale({ settings, urlLocale, storedLocale: stored });
  const dict = dictionaryFor(settings, locale);

  // An explicit ?lang= is also the visitor's choice from now on.
  useEffect(() => {
    if (enabled && urlLocale && urlLocale.toLowerCase() === locale && stored !== locale) {
      writeStored(scope, locale);
      setStored(locale);
    }
  }, [enabled, urlLocale, locale, stored, scope]);

  // Screen readers and the browser's own translate prompt read <html lang>.
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const previous = document.documentElement.lang;
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [enabled, locale]);

  const setLocale = useCallback(
    (code: string) => {
      const next = resolveSiteLocale({ settings, urlLocale: code });
      writeStored(scope, next);
      setStored(next);
      // The base language needs no parameter; any other language is put in the
      // URL so a shared link opens in the language the sharer was reading.
      update({ [LOCALE_PARAM]: next === baseLocale ? null : next });
    },
    [settings, scope, update, baseLocale],
  );

  const t = useCallback((text: string | null | undefined) => translateText(text ?? "", dict), [dict]);

  const value = useMemo<CatalogueLocaleValue>(
    () => ({
      locale,
      baseLocale,
      locales: enabled ? localesOf(settings) : [],
      enabled,
      dict,
      setLocale,
      t,
    }),
    [locale, baseLocale, enabled, settings, dict, setLocale, t],
  );

  return <CatalogueLocaleContext.Provider value={value}>{children}</CatalogueLocaleContext.Provider>;
};

export const useCatalogueLocale = (): CatalogueLocaleValue => useContext(CatalogueLocaleContext);

/** Translate live-data strings (course names, folder titles…) in the visitor's language. */
export const useSiteT = () => useContext(CatalogueLocaleContext).t;
