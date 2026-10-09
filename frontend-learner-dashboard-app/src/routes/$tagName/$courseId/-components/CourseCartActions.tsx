import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, Lightning, ShoppingCartSimple } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * Enrol actions when the site has a site-wide cart (globalSettings.siteCart):
 * "Add to cart" (then "In cart", which opens the cart) and "Buy now", which
 * adds the version and goes on to checkout. Once the version is in the cart,
 * "Buy now" becomes the emphasised action. `ready` is false while the cart is
 * still being read from storage or the course's versions are loading.
 */
export const CourseCartActions: React.FC<{
  inCart: boolean;
  ready: boolean;
  onAdd: () => void;
  onBuyNow: () => void;
  onViewCart: () => void;
  /** Shown under the buttons, e.g. that another version of the course is in the cart. */
  note?: string | null;
  /** stack = overview cards; row = the mobile bottom bar. */
  layout?: "stack" | "row";
  className?: string;
}> = ({ inCart, ready, onAdd, onBuyNow, onViewCart, note, layout = "stack", className }) => {
  const { t } = useTranslation("coursePlayerB");
  const base = "catalogue-btn min-h-11 w-full text-sm font-semibold";
  const inCartLabel = t("courseDetails.siteCart.inCart", "In cart");

  return (
    <div className={cn(layout === "row" ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2", className)}>
      {inCart ? (
        <button
          type="button"
          onClick={onViewCart}
          aria-label={t("courseDetails.siteCart.inCartViewCart", "In cart, view cart")}
          className={cn(base, "catalogue-btn-secondary")}
        >
          <CheckCircle weight="fill" className="size-4 shrink-0 text-success-600" aria-hidden="true" />
          {inCartLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          disabled={!ready}
          className={cn(base, "catalogue-btn-primary shadow-md")}
        >
          <ShoppingCartSimple weight="bold" className="size-4 shrink-0" aria-hidden="true" />
          {t("courseDetails.siteCart.addToCart", "Add to cart")}
        </button>
      )}
      <button
        type="button"
        onClick={onBuyNow}
        disabled={!ready}
        className={cn(base, inCart ? "catalogue-btn-primary shadow-md" : "catalogue-btn-secondary")}
      >
        <Lightning weight="fill" className="size-4 shrink-0" aria-hidden="true" />
        {t("courseDetails.siteCart.buyNow", "Buy now")}
      </button>
      {note && (
        <p className={cn("text-center text-xs text-catalogue-text-muted", layout === "row" && "col-span-2")}>
          {note}
        </p>
      )}
    </div>
  );
};

export default CourseCartActions;
