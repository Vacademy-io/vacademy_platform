import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { CatalogueLocale } from "../../-utils/catalogue-i18n";
import { useCatalogueLocale } from "../../-utils/catalogue-locale";
import { orderSwitcherLocales } from "./header-variants";

/**
 * हिन्दी | EN — the site-language switch in the header. Renders only on a
 * site with more than one language (globalSettings.i18n.enabled); switching
 * goes through the catalogue locale provider, which remembers the choice and
 * reflects it in ?lang= (never the logged-in app's own language setting).
 */
export const HeaderLanguageSwitcher: React.FC<{
  /** globalSettings.i18n.locales as authored — sets the order of the options. */
  authoredLocales?: Array<Partial<CatalogueLocale>> | null;
  className?: string;
}> = ({ authoredLocales, className }) => {
  const { t } = useTranslation("coursePlayerB");
  const { enabled, locales, locale, setLocale } = useCatalogueLocale();
  if (!enabled || locales.length < 2) return null;
  const options = orderSwitcherLocales(locales, authoredLocales);

  return (
    <div
      role="group"
      aria-label={t("header.language.label", "Site language")}
      className={cn("inline-flex shrink-0 items-center rounded-full border border-catalogue-border p-0.5", className)}
    >
      {options.map((option) => {
        const active = option.code === locale;
        return (
          <button
            key={option.code}
            type="button"
            lang={option.code}
            aria-pressed={active}
            onClick={() => {
              if (!active) setLocale(option.code);
            }}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold leading-none transition-colors duration-200",
              active
                ? "bg-primary-500 text-white"
                : "text-catalogue-text-secondary hover:text-catalogue-text-primary hover:bg-catalogue-interactive-hover",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default HeaderLanguageSwitcher;
