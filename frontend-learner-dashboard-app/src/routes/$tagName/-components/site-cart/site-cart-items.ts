/**
 * Pure helpers shared by everything that puts courses into the site cart
 * (catalogue offer cards, learning paths, the drawer). The cart model and the
 * store live in -utils/site-cart.ts and -stores/site-cart-store.ts.
 */
import {
  DEFAULT_COURSE_LANGUAGES,
  languageOfLevel,
  type CourseLanguageOption,
} from "../../-utils/course-variants";
import { upsertCartItems, type SiteCartItem, type SiteCartSource } from "../../-utils/site-cart";

/** One order through the store checkout holds at most this many courses. */
export const SITE_CART_MAX_ITEMS = 40;

/** `?source=` on the store checkout when the site cart sent the visitor there. */
export const SITE_CART_CHECKOUT_SOURCE = "siteCart";

/**
 * Is this location the store checkout itself? Checking out again from there
 * (its header has the cart too) replaces the history entry, so the
 * checkout's Back still returns to the page the cart was first opened on and
 * never to a stale basket.
 */
export const isStoreCheckoutPath = (pathname: string | null | undefined, storeCode: string): boolean => {
  const code = storeCode.trim();
  if (!code) return false;
  const path = (pathname || "").replace(/\/+$/, "");
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // A malformed escape: compare it as it is.
  }
  return decoded === `/product-pages/${code}`;
};

export interface CapResult {
  /** The cart after the accepted items were added. */
  next: SiteCartItem[];
  /** Incoming items now in the cart (new courses, or a course switched to this version). */
  accepted: SiteCartItem[];
  /** Incoming items left out because the cart would grow past the cap. */
  rejected: SiteCartItem[];
  /** Incoming items that were already in the cart (same version) — nothing to do. */
  alreadyIn: SiteCartItem[];
}

/**
 * Adds `incoming` with the cart's one-version-per-course rule, but never lets
 * the cart grow past `max`. Swapping a course to another language version does
 * not grow the cart, so it is always accepted — even in a full cart. Items are
 * taken in order, so a learning path keeps its first steps when it overflows.
 */
export const capCartAdd = (
  current: SiteCartItem[],
  incoming: SiteCartItem[],
  max: number = SITE_CART_MAX_ITEMS,
): CapResult => {
  let next = current;
  const accepted: SiteCartItem[] = [];
  const rejected: SiteCartItem[] = [];
  const alreadyIn: SiteCartItem[] = [];
  for (const item of incoming) {
    if (next.some((i) => i.packageSessionId === item.packageSessionId)) {
      alreadyIn.push(item);
      continue;
    }
    const grows = !next.some((i) => i.courseId === item.courseId);
    if (grows && next.length >= max) {
      rejected.push(item);
      continue;
    }
    next = upsertCartItems(next, [item]);
    accepted.push(item);
  }
  return { next, accepted, rejected, alreadyIn };
};

/** The minimum of a product-page mapping (by-code response) a cart item is built from. */
export interface CartMappingLike {
  package_session_id: string;
  package_id?: string | null;
  package_name?: string | null;
  level_name?: string | null;
  enroll_invite_id?: string | null;
  course_preview_image_media_id?: string | null;
  payment_plan?: {
    actual_price?: number | null;
    elevated_price?: number | null;
    currency?: string | null;
  } | null;
}

const numberOrUndefined = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

const textOrUndefined = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/**
 * A cart item for one product-page mapping (one language version of one
 * course). The title is the RAW course name — it is translated when shown,
 * never when stored. A mapping without a package id stands alone as its own
 * "course", so it can never replace an unrelated item.
 */
export const cartItemFromMapping = (
  m: CartMappingLike,
  opts: { languages?: CourseLanguageOption[]; source?: SiteCartSource } = {},
): SiteCartItem => {
  const languages = opts.languages?.length ? opts.languages : DEFAULT_COURSE_LANGUAGES;
  const language = languageOfLevel(m.level_name, languages);
  return {
    packageSessionId: m.package_session_id,
    courseId: textOrUndefined(m.package_id) ?? m.package_session_id,
    title: textOrUndefined(m.package_name) ?? "",
    levelName: textOrUndefined(m.level_name),
    languageCode: language?.code,
    price: numberOrUndefined(m.payment_plan?.actual_price),
    elevatedPrice: numberOrUndefined(m.payment_plan?.elevated_price),
    currency: textOrUndefined(m.payment_plan?.currency),
    image: textOrUndefined(m.course_preview_image_media_id),
    enrollInviteId: textOrUndefined(m.enroll_invite_id),
    ...(opts.source ? { source: opts.source } : {}),
  };
};

/** Level names the backend uses as placeholders for an unlevelled package. */
const SENTINEL_LEVELS = new Set(["default", "none", "null", "undefined", ""]);

export const isMeaningfulLevel = (level: string | null | undefined): boolean =>
  !!level && !SENTINEL_LEVELS.has(level.trim().toLowerCase());

/** The language option for a code, from the site's languages (or the EN / हिं defaults). */
export const languageOption = (
  code: string | null | undefined,
  languages?: CourseLanguageOption[],
): CourseLanguageOption | null => {
  if (!code) return null;
  const list = languages?.length ? languages : DEFAULT_COURSE_LANGUAGES;
  return list.find((l) => l.code === code) ?? null;
};

/**
 * What a cart row says about its version: the language chip ("हिं") when the
 * level names a language, otherwise the level itself ("Batch 2"), otherwise
 * nothing.
 */
export const versionLabel = (
  item: Pick<SiteCartItem, "languageCode" | "levelName">,
  languages?: CourseLanguageOption[],
): { chip: string; label: string } | null => {
  const lang = languageOption(item.languageCode, languages);
  if (lang) return { chip: lang.chip || lang.label, label: lang.label };
  if (item.languageCode) return { chip: item.languageCode.toUpperCase(), label: item.languageCode };
  if (isMeaningfulLevel(item.levelName)) return { chip: item.levelName!, label: item.levelName! };
  return null;
};
