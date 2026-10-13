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
import { activeMappingCounts, type StoreMappingLike } from "./site-cart-precheck";

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
  /** Does the store list this version at all (one ACTIVE mapping or more)? Always false until ready. */
  lists: (packageSessionId: string | null | undefined) => boolean;
}

const none = () => false;

/** The store's state from its product-page query (data wins over a failed background refetch). */
export const storeSaleFrom = (
  on: boolean,
  query: {
    data?: { mappings?: StoreMappingLike[] | null } | null;
    isError: boolean;
  },
): StoreSale => {
  if (!on) return { status: "off", sells: none, lists: none };
  if (query.data) {
    const counts = activeMappingCounts(query.data.mappings);
    return {
      status: "ready",
      sells: (id) => !!id && counts.get(id) === 1,
      lists: (id) => !!id && counts.has(id),
    };
  }
  return { status: query.isError ? "error" : "loading", sells: none, lists: none };
};

/**
 * Does a product page's own checkout sell this version as it is (one ACTIVE
 * mapping)? From the page's mappings — what storeCartRoute asks of the
 * section's own page.
 */
export const pageSells = (mappings: StoreMappingLike[] | null | undefined) => {
  const counts = activeMappingCounts(mappings);
  return (packageSessionId: string | null | undefined): boolean =>
    !!packageSessionId && counts.get(packageSessionId) === 1;
};

/**
 * Where a section sends these courses on a site with a site cart: "cart" when
 * the store sells every one of them, "page" (the section's own product page
 * checkout) when it does not or could not be read, and "pending" while it
 * loads — neither action is offered until it is known.
 */
export type StoreCartRoute = "cart" | "page" | "pending";

/**
 * A checkout selects EVERY mapping of a course it is sent, so a page that
 * lists a course twice charges it twice. A course the store lists twice goes
 * to the section's own checkout when that sells all of them as they are; when
 * it would charge one twice too (the section shows the store page itself, or
 * its page lists the course twice as well) they go to the cart, as long as
 * the store lists them all — its pre-check holds that course back and says
 * why, where the own checkout would have charged it twice.
 */
export const storeCartRoute = (
  sale: StoreSale,
  packageSessionIds: Array<string | null | undefined>,
  /** Does the section's own product page sell this version as it is? (pageSells) */
  ownPageSells: (packageSessionId: string | null | undefined) => boolean,
): StoreCartRoute => {
  if (sale.status === "loading") return "pending";
  if (sale.status !== "ready" || packageSessionIds.length === 0) return "page";
  if (packageSessionIds.every((id) => sale.sells(id))) return "cart";
  const ownPageCannot = !packageSessionIds.every((id) => ownPageSells(id));
  return ownPageCannot && packageSessionIds.every((id) => sale.lists(id)) ? "cart" : "page";
};
