/**
 * Courses-page filter state <-> query string. Pure.
 *
 *   ?stream=shiksha&category=vedic-maths,sanskrit&language=hi&price=max:1000
 *    &badge=new,bestseller&sort=popular&q=yoga
 *
 * A shared or mega-menu link reproduces the view. Every value is validated
 * against what the page actually offers (known streams, their categories,
 * the site's course languages…); anything unknown or malformed is ignored, so
 * a stale link degrades to the unfiltered grid instead of an empty one.
 */

import { ALL_BADGES, type CourseBadge } from "../../../-utils/course-badges";
import { URL_PARAMS, readListParam, readSearchParam } from "../../../-utils/catalogue-url-state";
import {
  COURSE_CATALOG_SORT_OPTIONS,
  type CourseCatalogSortOption,
} from "../../../-types/course-catalogue-types";

/** Not in the shared URL_PARAMS (yet): ?badge=new,bestseller. */
export const BADGE_PARAM = "badge";

export type PriceChoice = { kind: "free" } | { kind: "paid" } | { kind: "max"; max: number };

export interface DiscoveryState {
  /** Stream slug; null = "All courses". */
  stream: string | null;
  /** Category slugs inside the stream (OR). */
  categories: string[];
  /** Course language codes (OR). */
  languages: string[];
  price: PriceChoice | null;
  /** Badge filters (OR). */
  badges: CourseBadge[];
}

export const EMPTY_DISCOVERY_STATE: DiscoveryState = {
  stream: null,
  categories: [],
  languages: [],
  price: null,
  badges: [],
};

/** What a link may select on this page. */
export interface DiscoveryValidation {
  streams: { slug: string; categories: { slug: string }[] }[];
  /** Course language codes; empty when the site has no course languages. */
  languageCodes: string[];
}

/* ── sort ───────────────────────────────────────────────────────────── */

export const SORT_URL_TOKENS: Record<CourseCatalogSortOption, string> = {
  Newest: "newest",
  Oldest: "oldest",
  "Price: Low to High": "price-asc",
  "Price: High to Low": "price-desc",
  Rating: "rating",
  "Name A-Z": "name-asc",
  "Name Z-A": "name-desc",
  Popular: "popular",
};

export const sortFromToken = (token: string | null | undefined): CourseCatalogSortOption | null => {
  const t = (token || "").trim().toLowerCase();
  if (!t) return null;
  return COURSE_CATALOG_SORT_OPTIONS.find((option) => SORT_URL_TOKENS[option] === t) ?? null;
};

/** The ?sort= value, or null when it is the section's default (keeps URLs short). */
export const sortToToken = (
  sort: CourseCatalogSortOption,
  defaultSort: CourseCatalogSortOption,
): string | null => (sort === defaultSort ? null : SORT_URL_TOKENS[sort]);

/* ── price ──────────────────────────────────────────────────────────── */

export const parsePriceParam = (raw: string | null | undefined): PriceChoice | null => {
  const v = (raw || "").trim().toLowerCase();
  if (v === "free") return { kind: "free" };
  if (v === "paid") return { kind: "paid" };
  const m = /^max:(\d+(?:\.\d+)?)$/.exec(v);
  if (m) {
    const max = Number(m[1]);
    if (Number.isFinite(max) && max > 0) return { kind: "max", max };
  }
  return null;
};

export const formatPriceParam = (price: PriceChoice | null | undefined): string | null => {
  if (!price) return null;
  if (price.kind === "max") return `max:${price.max}`;
  return price.kind;
};

export const samePrice = (a: PriceChoice | null | undefined, b: PriceChoice | null | undefined): boolean =>
  formatPriceParam(a) === formatPriceParam(b);

/* ── state <-> params ───────────────────────────────────────────────── */

const unique = <T>(list: T[]): T[] => [...new Set(list)];

/** Stream and category only — what a mega-menu link carries. */
export const readStreamParams = (
  searchStr: string | null | undefined,
  v: DiscoveryValidation,
): Pick<DiscoveryState, "stream" | "categories"> => {
  const wanted = (readSearchParam(searchStr, URL_PARAMS.stream) || "").toLowerCase();
  const stream = wanted ? v.streams.find((s) => s.slug.toLowerCase() === wanted) : undefined;
  if (!stream) return { stream: null, categories: [] };
  const categories = unique(
    readListParam(searchStr, URL_PARAMS.category)
      .map((c) => c.toLowerCase())
      .map((c) => stream.categories.find((x) => x.slug.toLowerCase() === c)?.slug)
      .filter((c): c is string => !!c),
  );
  return { stream: stream.slug, categories };
};

export const readDiscoveryParams = (
  searchStr: string | null | undefined,
  v: DiscoveryValidation,
): DiscoveryState => {
  const codes = new Set(v.languageCodes.map((c) => c.toLowerCase()));
  return {
    ...readStreamParams(searchStr, v),
    languages: unique(
      readListParam(searchStr, URL_PARAMS.language)
        .map((c) => c.toLowerCase())
        .filter((c) => codes.has(c)),
    ),
    price: parsePriceParam(readSearchParam(searchStr, URL_PARAMS.price)),
    badges: unique(
      readListParam(searchStr, BADGE_PARAM)
        .map((b) => b.toLowerCase())
        .filter((b): b is CourseBadge => ALL_BADGES.includes(b as CourseBadge)),
    ),
  };
};

/** Query-string updates for the keys present in `patch` (null removes a key). */
export const discoveryPatchToParams = (
  patch: Partial<DiscoveryState>,
): Record<string, string | string[] | null> => {
  const out: Record<string, string | string[] | null> = {};
  if ("stream" in patch) out[URL_PARAMS.stream] = patch.stream || null;
  if ("categories" in patch) out[URL_PARAMS.category] = patch.categories?.length ? patch.categories : null;
  if ("languages" in patch) out[URL_PARAMS.language] = patch.languages?.length ? patch.languages : null;
  if ("price" in patch) out[URL_PARAMS.price] = formatPriceParam(patch.price);
  if ("badges" in patch) out[BADGE_PARAM] = patch.badges?.length ? patch.badges : null;
  return out;
};

/** Search text as it goes into ?q= — trimmed and bounded. */
export const searchToParam = (term: string): string | null => {
  const t = term.trim().slice(0, 200);
  return t || null;
};

/** Number of applied discovery filters (the stream is a tab, not a filter). */
export const countDiscoveryFilters = (s: DiscoveryState): number =>
  s.categories.length + s.languages.length + (s.price ? 1 : 0) + s.badges.length;
