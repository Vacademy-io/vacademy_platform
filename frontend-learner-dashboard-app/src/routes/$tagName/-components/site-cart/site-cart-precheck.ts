/**
 * Checkout pre-check: can the store product page sell everything in the cart?
 *
 * The store checkout selects courses by `?courseIds=` (package session ids)
 * and silently drops any id it has no ACTIVE mapping for, and it selects EVERY
 * mapping that matches an id — so a course listed twice on the store page is
 * charged twice. Both are decided here, before the visitor leaves the cart, so
 * an item is never dropped or double-charged without them seeing why.
 */
import type { SiteCartItem } from "../../-utils/site-cart";
import { SITE_CART_MAX_ITEMS } from "./site-cart-items";

export type PrecheckIssue =
  /** The store page has no ACTIVE mapping for this version. */
  | "notInStore"
  /** The store page maps this version more than once — checking out would charge it twice. */
  | "listedTwice"
  /** The cart holds this course (or this exact version) more than once. */
  | "duplicateInCart";

export interface StoreMappingLike {
  package_session_id?: string | null;
  status?: string | null;
  payment_plan?: { actual_price?: number | null; currency?: string | null } | null;
}

export interface FlaggedItem {
  item: SiteCartItem;
  issue: PrecheckIssue;
}

export interface PriceChange {
  item: SiteCartItem;
  storePrice: number;
  currency?: string;
}

export interface SiteCartPrecheck {
  /** Items the store checkout can sell, in cart order. */
  ready: SiteCartItem[];
  /** Items that must not go to checkout as they are, each with the reason. */
  flagged: FlaggedItem[];
  /** Ready items whose store price differs from the price the cart showed. */
  priceChanges: PriceChange[];
  /** The cart holds more items than one order may. */
  overLimit: boolean;
  /** True when the whole cart can go to checkout unchanged. */
  ok: boolean;
}

const isActive = (m: StoreMappingLike) => (m.status ?? "ACTIVE").toUpperCase() === "ACTIVE";

export const precheckSiteCart = (
  items: SiteCartItem[],
  storeMappings: StoreMappingLike[] | null | undefined,
  opts: { max?: number } = {},
): SiteCartPrecheck => {
  const max = opts.max ?? SITE_CART_MAX_ITEMS;

  const activeBySession = new Map<string, StoreMappingLike[]>();
  for (const m of storeMappings || []) {
    const id = m.package_session_id;
    if (!id || !isActive(m)) continue;
    const list = activeBySession.get(id);
    if (list) list.push(m);
    else activeBySession.set(id, [m]);
  }

  const ready: SiteCartItem[] = [];
  const flagged: FlaggedItem[] = [];
  const priceChanges: PriceChange[] = [];
  const seenSessions = new Set<string>();
  const seenCourses = new Set<string>();

  for (const item of items) {
    // Later copies are the duplicates; the first stays sellable.
    if (seenSessions.has(item.packageSessionId) || seenCourses.has(item.courseId)) {
      flagged.push({ item, issue: "duplicateInCart" });
      continue;
    }
    seenSessions.add(item.packageSessionId);
    seenCourses.add(item.courseId);

    const matches = activeBySession.get(item.packageSessionId) || [];
    if (matches.length === 0) {
      flagged.push({ item, issue: "notInStore" });
      continue;
    }
    if (matches.length > 1) {
      flagged.push({ item, issue: "listedTwice" });
      continue;
    }

    ready.push(item);
    const storePrice = matches[0]!.payment_plan?.actual_price;
    if (
      typeof item.price === "number" &&
      typeof storePrice === "number" &&
      Number.isFinite(storePrice) &&
      Math.abs(storePrice - item.price) >= 0.01
    ) {
      priceChanges.push({
        item,
        storePrice,
        currency: matches[0]!.payment_plan?.currency || item.currency,
      });
    }
  }

  const overLimit = items.length > max;
  return {
    ready,
    flagged,
    priceChanges,
    overLimit,
    ok: !overLimit && flagged.length === 0 && ready.length > 0,
  };
};

/**
 * Package session ids "Remove unavailable" takes out: the versions the store
 * cannot sell (or would charge twice). A duplicate copy is left to the visitor
 * — it can share its id with the copy that stays, and removing by id would
 * take both.
 */
export const unavailableSessionIds = (result: Pick<SiteCartPrecheck, "flagged">): string[] => [
  ...new Set(
    result.flagged
      .filter((f) => f.issue === "notInStore" || f.issue === "listedTwice")
      .map((f) => f.item.packageSessionId),
  ),
];
