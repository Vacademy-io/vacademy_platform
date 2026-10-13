/**
 * Authored option groups of the Courses page (courseCatalog.customFilters):
 * FORMAT ("E-books", "Live sessions"…) and FOR ("Parents", "Students"…). Pure.
 *
 *   customFilters: [
 *     { id: "format", label: "Format", source: "courseFormats" },          // options = globalSettings.courseFormats
 *     { id: "for", label: "For", showCounts: false, visibleCount: 4,
 *       options: [{ id: "parents", label: "Parents", tags: ["for-parents"] }, …] },
 *   ]
 *
 * An option matches a course when ANY version carries one of its tags or has
 * one of its level names (both case-insensitive) — the same rule as the shared
 * course-format helper, so a 'courseFormats' option matches exactly the cards
 * whose cardFormatKeys include its key. Options inside a group are OR-ed,
 * groups are AND-ed with every other filter. The group id is its URL
 * parameter (?format=ebook,video&for=parents).
 *
 * No customFilters → [] everywhere: no facet group, no URL parameter read, no
 * state key — every other site is untouched.
 */

import { resolveCourseFormats, rowTags, type CourseFormatRow } from "../../../-utils/course-format";
import { toSlug } from "./catalog-config";

export interface ResolvedCustomOption {
  id: string;
  /** Display text. `labelFromSite` = base-language globalSettings text: show through siteT. */
  label: string;
  /** Lower-case trimmed. */
  tags: string[];
  /** Lower-case trimmed. */
  levels: string[];
}

export interface ResolvedCustomFilter {
  id: string;
  label: string;
  /** Options come from globalSettings.courseFormats: their labels need siteT at display. */
  labelFromSite: boolean;
  /** null = follow the section's showFilterCounts. */
  showCounts: boolean | null;
  showEmpty: boolean;
  /** Rows before show-more; null = all. */
  visibleCount: number | null;
  showAllLabel: string;
  options: ResolvedCustomOption[];
}

/** Query parameters other catalogue features read — never a custom group id. */
export const RESERVED_FILTER_IDS = [
  "stream",
  "category",
  "language",
  "price",
  "sort",
  "q",
  "quick",
  "path",
  "badge",
  "lang",
  "page",
  "goal",
  "folder",
];

export const MAX_CUSTOM_FILTERS = 6;
export const MAX_CUSTOM_OPTIONS = 30;

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const lowerList = (v: unknown): string[] =>
  Array.isArray(v)
    ? [...new Set(v.map((x) => (typeof x === "string" ? x.trim().toLowerCase() : "")).filter(Boolean))]
    : [];
const positiveInt = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
};

const authoredOptions = (raw: unknown): ResolvedCustomOption[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ResolvedCustomOption[] = [];
  for (const item of raw) {
    if (!isObject(item)) continue;
    const label = text(item.label);
    const id = toSlug(text(item.id) || label);
    const tags = lowerList(item.tags);
    const levels = lowerList(item.levels);
    if (!id || !label || seen.has(id) || (!tags.length && !levels.length)) continue;
    seen.add(id);
    out.push({ id, label, tags, levels });
    if (out.length >= MAX_CUSTOM_OPTIONS) break;
  }
  return out;
};

const formatOptions = (globalSettings: unknown): ResolvedCustomOption[] => {
  const formats = resolveCourseFormats(isObject(globalSettings) ? globalSettings : null);
  return (formats?.list ?? [])
    .map((f) => ({ id: toSlug(f.key), label: f.label, tags: f.tags, levels: f.levels }))
    .filter((o) => !!o.id)
    .slice(0, MAX_CUSTOM_OPTIONS);
};

/** The section's custom groups, validated (bad ids, duplicates and empty groups dropped). */
export const resolveCustomFilters = (raw: unknown, globalSettings: unknown): ResolvedCustomFilter[] => {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  const out: ResolvedCustomFilter[] = [];
  for (const item of raw) {
    if (!isObject(item) || item.enabled === false) continue;
    const id = toSlug(text(item.id));
    if (!id || ids.has(id) || RESERVED_FILTER_IDS.includes(id) || id.startsWith("utm")) continue;
    const fromFormats = item.source === "courseFormats";
    const options = fromFormats ? formatOptions(globalSettings) : authoredOptions(item.options);
    if (!options.length) continue;
    ids.add(id);
    out.push({
      id,
      label: text(item.label),
      labelFromSite: fromFormats,
      showCounts: typeof item.showCounts === "boolean" ? item.showCounts : null,
      showEmpty: item.showEmpty !== false,
      visibleCount: positiveInt(item.visibleCount),
      showAllLabel: text(item.showAllLabel),
      options,
    });
    if (out.length >= MAX_CUSTOM_FILTERS) break;
  }
  return out;
};

const levelOf = (row: CourseFormatRow): string =>
  typeof (row.level_name ?? row.level) === "string" ? String(row.level_name ?? row.level).trim().toLowerCase() : "";

/** Does one version carry the option (a tag or a level name)? */
export const rowMatchesCustomOption = (row: CourseFormatRow, option: ResolvedCustomOption): boolean => {
  if (option.tags.length) {
    const tags = rowTags(row);
    if (option.tags.some((t) => tags.includes(t))) return true;
  }
  if (option.levels.length) {
    const level = levelOf(row);
    if (level && option.levels.includes(level)) return true;
  }
  return false;
};

/** Card-level: any version matches. */
export const cardMatchesCustomOption = (card: { rows: CourseFormatRow[] }, option: ResolvedCustomOption): boolean =>
  card.rows.some((row) => rowMatchesCustomOption(row, option));

/** The selected options of each group, from the state's { groupId: optionIds } (unknown ids dropped). */
export const selectedCustomOptions = (
  filters: ResolvedCustomFilter[],
  state: Record<string, string[]> | undefined,
): { id: string; options: ResolvedCustomOption[] }[] =>
  filters
    .map((f) => ({
      id: f.id,
      options: f.options.filter((o) => (state?.[f.id] ?? []).includes(o.id)),
    }))
    .filter((g) => g.options.length > 0);

/** Allowed option ids per group — what a link may select (DiscoveryValidation.custom). */
export const customValidation = (filters: ResolvedCustomFilter[]): Record<string, string[]> =>
  Object.fromEntries(filters.map((f) => [f.id, f.options.map((o) => o.id)]));

/** A state patch that clears every custom group. */
export const clearedCustomState = (filters: ResolvedCustomFilter[]): Record<string, string[]> =>
  Object.fromEntries(filters.map((f) => [f.id, []]));

/** The facet-group id of a custom group (kept apart from the built-in ids). */
export const customGroupId = (id: string): string => `custom:${id}`;
