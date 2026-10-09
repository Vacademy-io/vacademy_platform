/**
 * Catalogue rows -> cards. Pure.
 *
 * The open catalogue search returns one row per package session (one level of
 * one course). Without grouping every row is its own card — the original
 * grid. With grouping (groupLanguageVersions) a course's language versions
 * fold into ONE card that knows its languages (EN / हिं chips), its lowest
 * price ("from ₹X" when versions differ) and which version it opens.
 */

import {
  groupCourseVariants,
  languageOfLevel,
  type CourseLanguageOption,
} from "../../../-utils/course-variants";
import { readComingSoon } from "../../../-utils/coming-soon";

/** The fields of a catalogue row the discovery logic reads. */
export interface CatalogRowLike {
  /** package id */
  id: string;
  title: string;
  description: string;
  price: number;
  elevatedPrice?: number;
  currency?: string;
  level: string;
  rating: number;
  instructor: string;
  createdAt?: string;
  sessionId?: string;
  packageSessionId?: string;
  enrollInviteId?: string;
  package_id?: string | null;
  package_session_id?: string | null;
  level_name?: string | null;
  comma_separeted_tags?: string | null;
  coming_soon?: unknown;
  enroll_invite_availability?: string | null;
}

export interface CatalogCard<R extends CatalogRowLike> {
  /** package id */
  courseId: string;
  /** The card's versions (one row when grouping is off). */
  rows: R[];
  /** The version the card shows and links to. */
  primary: R;
  /** Languages offered (grouping only; [] otherwise). */
  languages: CourseLanguageOption[];
  /** Lower-case course tags of every version. */
  tagSet: Set<string>;
  /** Price used by the price sorts: the lowest version price. */
  sortPrice: number;
  /** Lowest / highest price among the versions that can be bought now. */
  minPrice: number | null;
  maxPrice: number | null;
  /** The versions differ in price ("from ₹X"). */
  priceVaries: boolean;
}

const toNumber = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);

/** A row's course tags, trimmed (comma_separeted_tags is the v2 search field). */
export const courseTagsOf = (row: { comma_separeted_tags?: string | null; tags?: unknown }): string[] => {
  const out: string[] = [];
  if (typeof row.comma_separeted_tags === "string") {
    for (const t of row.comma_separeted_tags.split(",")) if (t.trim()) out.push(t.trim());
  }
  if (Array.isArray(row.tags)) {
    for (const t of row.tags) if (typeof t === "string" && t.trim()) out.push(t.trim());
  }
  return out;
};

/** Coming-soon rows have no real price yet. */
export const isComingSoonRow = (row: { coming_soon?: unknown }): boolean => readComingSoon(row.coming_soon) !== null;

/**
 * A level that is ONLY a language ("Hindi", "English", "हिन्दी") — with
 * grouping on, the language chips already say it, so it is noise as a Level
 * filter option or card label. "Beginner Hindi" is a real level and stays.
 */
export const isPureLanguageLevel = (
  levelName: string | null | undefined,
  languages: CourseLanguageOption[],
): boolean => {
  const lang = languageOfLevel(levelName, languages);
  if (!lang) return false;
  const name = (levelName || "").toLowerCase().replace(/[\s\-_.,:;()/|]+/g, " ").trim();
  const tokens = [...(lang.match || []), lang.label, lang.code]
    .filter((t): t is string => typeof t === "string" && !!t.trim())
    .map((t) => t.toLowerCase().trim());
  return tokens.includes(name);
};

const priceSummary = (rows: CatalogRowLike[]) => {
  const prices = rows.filter((r) => !isComingSoonRow(r)).map((r) => toNumber(r.price));
  if (!prices.length) return { minPrice: null, maxPrice: null, priceVaries: false };
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  return { minPrice, maxPrice, priceVaries: minPrice !== maxPrice };
};

const tagSetOf = (rows: CatalogRowLike[]) =>
  new Set(rows.flatMap((r) => courseTagsOf(r)).map((t) => t.toLowerCase()));

const makeCard = <R extends CatalogRowLike>(
  courseId: string,
  rows: R[],
  primary: R,
  languages: CourseLanguageOption[],
): CatalogCard<R> => ({
  courseId,
  rows,
  primary,
  languages,
  tagSet: tagSetOf(rows),
  sortPrice: Math.min(...rows.map((r) => toNumber(r.price))),
  ...priceSummary(rows),
});

/**
 * Cards in catalogue order. Grouping off: one card per row, in row order (the
 * original grid). Grouping on: one card per course where its first row sat,
 * opening the preferred language's version when the course has one.
 */
export const buildCatalogCards = <R extends CatalogRowLike>(
  rows: R[],
  opts: { grouping: boolean; languages: CourseLanguageOption[]; preferredLanguage?: string | null },
): CatalogCard<R>[] => {
  if (!opts.grouping) return rows.map((row) => makeCard(String(row.id || ""), [row], row, []));
  const withPackage = rows.map((row) => ({ row, package_id: row.package_id || row.id || null, package_session_id: row.package_session_id ?? row.packageSessionId ?? null, level_name: row.level_name ?? row.level }));
  return groupCourseVariants(withPackage, {
    enabled: true,
    languages: opts.languages,
    preferredLanguage: opts.preferredLanguage,
  }).map((group) =>
    makeCard(
      group.courseId,
      group.variants.map((v) => v.row),
      group.primary.row,
      group.languages,
    ),
  );
};

/** The language a row is in, read from its level name. */
export const rowLanguage = (
  row: { level_name?: string | null; level?: string },
  languages: CourseLanguageOption[],
): CourseLanguageOption | null => languageOfLevel(row.level_name ?? row.level, languages);
