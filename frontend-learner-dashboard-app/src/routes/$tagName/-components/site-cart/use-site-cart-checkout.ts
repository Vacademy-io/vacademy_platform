import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { handleGetProductPage } from "@/routes/product-pages/$productPageCode/-services/product-page-service";
import { storeCheckoutTarget, type SiteCartItem, type SiteCartSettings } from "../../-utils/site-cart";
import { useCatalogueLocale } from "../../-utils/catalogue-locale";
import { precheckSiteCart, type SiteCartPrecheck } from "./site-cart-precheck";
import { SITE_CART_MAX_ITEMS } from "./site-cart-items";

export type CheckoutState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "overLimit" }
  | { status: "error" }
  /** Some items cannot go to checkout as they are; the visitor decides. */
  | { status: "review"; result: SiteCartPrecheck };

/** How fresh the store page must be for the pre-check (the checkout then reuses it). */
const STORE_STALE_MS = 30_000;

/**
 * "Checkout" for the site cart: confirms the store product page can sell every
 * item (see site-cart-precheck), then opens its checkout on the cart step with
 * exactly those courses. Anything the store cannot sell is put in front of the
 * visitor instead of being dropped.
 */
export const useSiteCartCheckout = ({
  instituteId,
  tagName,
  settings,
  onNavigate,
}: {
  instituteId: string;
  tagName?: string;
  settings: SiteCartSettings | null | undefined;
  /** Called just before navigating (e.g. to close the drawer). */
  onNavigate?: () => void;
}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { enabled: languagesEnabled, locale, baseLocale } = useCatalogueLocale();
  const [state, setState] = useState<CheckoutState>({ status: "idle" });
  // Bumped by reset(): a check still in flight when the drawer closes or the
  // cart changes must neither navigate nor show a stale result.
  const runRef = useRef(0);

  const storeCode = settings?.storeProductPageCode?.trim() || "";

  const goToCheckout = useCallback(
    (items: SiteCartItem[]) => {
      if (!storeCode || !items.length) return;
      const target = storeCheckoutTarget(storeCode, items, { instituteId, tagName });
      // The visitor's language rides along, so the checkout opens in it.
      const lang = languagesEnabled && locale !== baseLocale ? locale : undefined;
      onNavigate?.();
      setState({ status: "idle" });
      void navigate({ ...target, search: { ...target.search, ...(lang ? { lang } : {}) } });
    },
    [storeCode, instituteId, tagName, languagesEnabled, locale, baseLocale, onNavigate, navigate],
  );

  const runCheckout = useCallback(
    async (items: SiteCartItem[]): Promise<SiteCartPrecheck | null> => {
      if (!storeCode || !items.length) return null;
      if (items.length > SITE_CART_MAX_ITEMS) {
        setState({ status: "overLimit" });
        return null;
      }
      const run = ++runRef.current;
      setState({ status: "checking" });
      try {
        const { queryKey, queryFn } = handleGetProductPage(storeCode, instituteId);
        const page = await queryClient.fetchQuery({ queryKey, queryFn, staleTime: STORE_STALE_MS });
        if (run !== runRef.current) return null;
        const result = precheckSiteCart(items, page?.mappings);
        if (result.ok) goToCheckout(result.ready);
        else setState({ status: "review", result });
        return result;
      } catch {
        if (run === runRef.current) setState({ status: "error" });
        return null;
      }
    },
    [storeCode, instituteId, queryClient, goToCheckout],
  );

  const reset = useCallback(() => {
    runRef.current += 1;
    setState({ status: "idle" });
  }, []);

  return { state, runCheckout, goToCheckout, reset, storeCode };
};
