import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CaretDown, Check, ShoppingCart, Trash } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PriceWithMrp } from "@/components/common/price-with-mrp";
import { cn } from "@/lib/utils";
import { useSiteCartStore } from "../../../-stores/site-cart-store";
import type { CourseLanguageOption } from "../../../-utils/course-variants";
import { rowLanguage, type CatalogRowLike } from "./catalog-cards";
import { cartVersionOf, packageSessionOf, toSiteCartItem } from "./catalog-site-cart";
import { ThemedPortalSurface } from "./ThemedPortalSurface";

/**
 * The card CTA when the site-wide cart is on: "Add to cart" ⇄ "In cart".
 * A course sold in several languages opens a small chooser first; picking
 * another language swaps the version in the cart (one version per course).
 */
export const SiteCartCta = <R extends CatalogRowLike & { thumbnail?: string }>({
  courseId,
  versions,
  title,
  languages,
  translate,
  themeAnchor,
}: {
  courseId: string;
  /** Purchasable versions only (see purchasableVersions). */
  versions: R[];
  /** Base-language course title (translated here for display). */
  title: string;
  languages: CourseLanguageOption[];
  translate: (s: string) => string;
  /** Any element inside the catalogue section (finds the theme for the chooser). */
  themeAnchor: React.RefObject<HTMLElement | null>;
}) => {
  const { t } = useTranslation("coursePlayerB");
  const items = useSiteCartStore((s) => s.items);
  const add = useSiteCartStore((s) => s.add);
  const remove = useSiteCartStore((s) => s.remove);
  const [open, setOpen] = useState(false);

  const inCart = useMemo(() => new Set(items.map((i) => i.packageSessionId)), [items]);
  const current = cartVersionOf(versions, inCart);
  const displayTitle = translate(title);
  const languageOf = (v: R) => rowLanguage(v, languages);
  const versionLabel = (v: R) => {
    const lang = languageOf(v);
    return lang ? translate(lang.label || lang.code) : translate(String(v.level_name || v.level || ""));
  };

  const addVersion = (v: R) => {
    add(toSiteCartItem(v, courseId, languages));
    toast.success(t("courseCatalog.addedToCart", { title: displayTitle }));
    setOpen(false);
  };
  const removeVersion = (v: R) => {
    remove(packageSessionOf(v));
    toast.success(t("courseCatalog.removedFromCart", { title: displayTitle }));
    setOpen(false);
  };

  const currentLanguage = current ? languageOf(current) : null;
  const label = current
    ? versions.length > 1 && currentLanguage
      ? t("courseCatalog.inCartWithLanguage", {
          language: currentLanguage.chip || currentLanguage.label || currentLanguage.code,
          defaultValue: "In cart · {{language}}",
        })
      : t("courseCatalog.inCart", "In cart")
    : t("courseCatalog.addToCart", "Add to cart");
  const icon = current ? (
    <Check size={16} weight="bold" aria-hidden="true" />
  ) : (
    <ShoppingCart size={16} weight="bold" aria-hidden="true" />
  );
  const buttonClass = cn("catalogue-btn mt-2 w-full", current ? "catalogue-btn-secondary" : "catalogue-btn-primary");

  if (versions.length === 1) {
    const only = versions[0];
    return (
      <button
        type="button"
        aria-pressed={!!current}
        onClick={(e) => {
          e.stopPropagation();
          if (current) removeVersion(only);
          else addVersion(only);
        }}
        className={buttonClass}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" onClick={(e) => e.stopPropagation()} className={buttonClass}>
          {icon}
          {label}
          <CaretDown size={14} weight="bold" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="w-72 border-0 bg-transparent p-0 shadow-none"
        // React events bubble through portals: keep clicks in the chooser
        // from reaching the card, which would open the course page.
        onClick={(e) => e.stopPropagation()}
      >
        <ThemedPortalSurface
          anchor={themeAnchor}
          className="rounded-catalogue-lg border border-catalogue-border bg-catalogue-bg-elevated p-2 text-catalogue-text-primary shadow-lg"
        >
          <p className="px-2 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-catalogue-text-muted">
            {t("courseCatalog.chooseLanguage", "Choose a language")}
          </p>
          <ul className="space-y-0.5">
            {versions.map((v) => {
              const selected = current === v;
              const lang = languageOf(v);
              return (
                <li key={packageSessionOf(v)}>
                  <button
                    type="button"
                    aria-current={selected || undefined}
                    onClick={() => (selected ? setOpen(false) : addVersion(v))}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-catalogue-md px-2 py-2 text-start text-sm transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
                      selected ? "bg-primary-50" : "hover:bg-catalogue-interactive-hover",
                    )}
                  >
                    {lang?.chip && (
                      <span className="rounded-catalogue-sm border border-catalogue-border px-1.5 py-0.5 text-3xs font-semibold leading-none text-catalogue-text-secondary">
                        {lang.chip}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium">{versionLabel(v)}</span>
                    <PriceWithMrp
                      actual={v.price}
                      elevated={v.elevatedPrice}
                      currency={v.currency}
                      size="xs"
                      layout="inline"
                      hideBadge
                    />
                    {selected && <Check size={14} weight="bold" className="text-primary-500" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {current && (
            <button
              type="button"
              onClick={() => removeVersion(current)}
              className="mt-1 flex w-full items-center gap-2 rounded-catalogue-md px-2 py-2 text-start text-sm text-danger-600 transition-colors hover:bg-danger-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <Trash size={14} weight="bold" aria-hidden="true" />
              {t("courseCatalog.removeFromCart", "Remove from cart")}
            </button>
          )}
        </ThemedPortalSurface>
      </PopoverContent>
    </Popover>
  );
};
