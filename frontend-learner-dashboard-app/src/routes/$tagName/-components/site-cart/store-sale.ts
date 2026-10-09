/**
 * Can the site's STORE product page sell a course? Pure helpers behind
 * useStoreSale.
 *
 * Sections that sell courses of ANOTHER product page (productPageOffer, the
 * folder browser's offers, learning paths) put a course into the site cart
 * only when the store sells it — the cart checks out through the store, so
 * anything else would sit in the cart unbuyable. Such a course keeps its own
 * product page's checkout instead.
 */
import { storeSellableSessions, type StoreMappingLike } from "./site-cart-precheck";

export type StoreSaleStatus =
  /** No site cart: nothing is read. */
  | "off"
  | "loading"
  /** The store page could not be read: sections fall back to their own checkout. */
  | "error"
  | "ready";

export interface StoreSale {
  status: StoreSaleStatus;
  /** Does the store sell this version as it is (one ACTIVE mapping)? Always false until ready. */
  sells: (packageSessionId: string | null | undefined) => boolean;
}

const sellsNothing = () => false;

/** The store's state from its product-page query (data wins over a failed background refetch). */
export const storeSaleFrom = (
  on: boolean,
  query: {
    data?: { mappings?: StoreMappingLike[] | null } | null;
    isError: boolean;
  },
): StoreSale => {
  if (!on) return { status: "off", sells: sellsNothing };
  if (query.data) {
    const sellable = storeSellableSessions(query.data.mappings);
    return { status: "ready", sells: (id) => !!id && sellable.has(id) };
  }
  return { status: query.isError ? "error" : "loading", sells: sellsNothing };
};

/**
 * Where a section sends these courses on a site with a site cart: "cart" when
 * the store sells every one of them, "page" (the section's own product page
 * checkout) when it does not or could not be read, and "pending" while it
 * loads — neither action is offered until it is known.
 */
export type StoreCartRoute = "cart" | "page" | "pending";

export const storeCartRoute = (
  sale: StoreSale,
  packageSessionIds: Array<string | null | undefined>,
): StoreCartRoute => {
  if (sale.status === "loading") return "pending";
  return sale.status === "ready" && packageSessionIds.length > 0 && packageSessionIds.every((id) => sale.sells(id))
    ? "cart"
    : "page";
};
