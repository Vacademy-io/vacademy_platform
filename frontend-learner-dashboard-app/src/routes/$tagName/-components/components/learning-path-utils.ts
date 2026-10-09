/**
 * Learning paths — pure helpers for the `learningPath` section.
 *
 * A learning path IS a product page: its courses, in the admin's display
 * order, are the path's numbered steps. A course offered in several language
 * versions (levels "Hindi" / "English") is ONE step with a language choice,
 * when the site groups versions (globalSettings.courseLanguages.enabled).
 * Levels that differ by more than their language ("Level 1" / "Level 2",
 * "Beginner Hindi" / "Advanced Hindi") stay separate steps: a path never hides
 * one of its courses.
 * The list mode reads the paths from the folder library: the product pages
 * under the stream folder named by ?stream=, a chosen folder, or all of them.
 */
import {
  languageOfLevel,
  variantForLanguage,
  type CourseGroup,
  type CourseLanguageOption,
} from "../../-utils/course-variants";
import { cartTotals, type CartTotals, type SiteCartItem } from "../../-utils/site-cart";
import { folderSlug, pathTo, type PublicFolderNode } from "../../-services/folder-library-service";
import { parseBasketPricing, quoteBasket } from "@/routes/product-pages/$productPageCode/-utils/basket-pricing";
import { bestOffer, parseOffers } from "@/routes/product-pages/$productPageCode/-utils/offers";
import { cartItemFromMapping, type CartMappingLike } from "../site-cart/site-cart-items";

/** The part of a by-code mapping a path step reads. */
export interface PathMapping extends CartMappingLike {
  status?: string | null;
  session_name?: string | null;
  display_order?: number | null;
}

export interface PathStep<T extends PathMapping = PathMapping> {
  /**
   * Unique within the path (the package session of the step's first version):
   * what the list and the visitor's language picks are keyed by. Two steps
   * can share a courseId; they never share a key.
   */
  key: string;
  /** package_id (or the package session for a mapping without one) — the site cart holds one version per courseId. */
  courseId: string;
  /** The course's versions in this step, in display order (one per language). */
  variants: T[];
  /** Languages the step is offered in, in the site's order. */
  languages: CourseLanguageOption[];
  /** The version shown first: the visitor's language when the step has it. */
  primary: T;
}

const isAscii = (s: string) => /^[\x00-\x7F]*$/.test(s);
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A level name without its language words — what two language versions of the
 * same level share: "Beginner Hindi" and "Beginner (English)" are both
 * "beginner"; plain "Hindi" / "English" are both "". Uses the same tokens as
 * languageOfLevel (whole words for ASCII, anywhere for other scripts).
 */
export const levelWithoutLanguage = (
  levelName: string | null | undefined,
  language: CourseLanguageOption,
): string => {
  let name = ` ${(levelName || "").toLowerCase()} `;
  const tokens = [...(language.match || []), language.label, language.code]
    .filter(Boolean)
    .map((t) => t.toLowerCase().trim())
    .filter(Boolean)
    // Longest first, so a longer token is not left half-removed by a shorter one.
    .sort((a, b) => b.length - a.length);
  for (const token of tokens) {
    name = isAscii(token)
      ? name.replace(new RegExp(`(^|[^a-z0-9])${escapeRegExp(token)}(?=[^a-z0-9]|$)`, "g"), "$1 ")
      : name.split(token).join(" ");
  }
  return name.replace(/[\s\-_.,:;|/\\()[\]{}·•–—]+/g, " ").trim();
};

/**
 * The path's steps: ACTIVE mappings in the order given (display order — the
 * product-page query sorts them), each package session once.
 *
 * With grouped versions, rows of one package fold into one step only when they
 * differ by language alone (same level apart from its language words, a
 * different language each). Every other row — a level with no language, a
 * second level of the same package, a second row in a language the step
 * already has — is a step of its own. Without grouping every row is a step.
 */
export const buildPathSteps = <T extends PathMapping>(
  mappings: T[] | null | undefined,
  opts: { groupVersions: boolean; languages: CourseLanguageOption[]; preferredLanguage?: string | null },
): PathStep<T>[] => {
  const seen = new Set<string>();
  const rows = (mappings || []).filter((m) => {
    if (!m?.package_session_id) return false;
    if ((m.status ?? "ACTIVE").toUpperCase() !== "ACTIVE") return false;
    // A page that lists the same version twice still shows it once.
    if (seen.has(m.package_session_id)) return false;
    seen.add(m.package_session_id);
    return true;
  });

  const languageCode = (row: T) => languageOfLevel(row.level_name, opts.languages)?.code ?? null;
  const steps: PathStep<T>[] = [];
  const foldable = new Map<string, PathStep<T>>();
  const newStep = (row: T): PathStep<T> => {
    const packageId = typeof row.package_id === "string" ? row.package_id.trim() : "";
    const step: PathStep<T> = {
      key: row.package_session_id,
      courseId: packageId || row.package_session_id,
      variants: [row],
      languages: [],
      primary: row,
    };
    steps.push(step);
    return step;
  };

  for (const row of rows) {
    const language = opts.groupVersions && row.package_id ? languageOfLevel(row.level_name, opts.languages) : null;
    if (!language) {
      newStep(row);
      continue;
    }
    const foldKey = `${row.package_id}\u0000${levelWithoutLanguage(row.level_name, language)}`;
    const step = foldable.get(foldKey);
    if (!step) {
      foldable.set(foldKey, newStep(row));
    } else if (step.variants.some((v) => languageCode(v) === language.code)) {
      // Two rows in the same language are two courses, not two versions.
      newStep(row);
    } else {
      step.variants.push(row);
    }
  }

  for (const step of steps) {
    const present = new Set(step.variants.map(languageCode).filter((code): code is string => !!code));
    step.languages = opts.languages.filter((l) => present.has(l.code));
    if (opts.preferredLanguage) {
      const preferred = step.variants.find((v) => languageCode(v) === opts.preferredLanguage);
      if (preferred) step.primary = preferred;
    }
  }
  return steps;
};

/** The version chosen for a step: the visitor's language pick when the step has it, else its first version. */
export const chosenVariant = <T extends PathMapping>(
  step: PathStep<T>,
  languageCode: string | null | undefined,
  languages: CourseLanguageOption[],
): T => {
  if (languageCode) {
    const picked = variantForLanguage(step as CourseGroup<T>, languageCode, languages);
    if (picked) return picked;
  }
  return step.primary;
};

/** One version per step, honouring the visitor's language picks (keyed by step key). */
export const pathSelection = <T extends PathMapping>(
  steps: PathStep<T>[],
  choices: Record<string, string | undefined>,
  languages: CourseLanguageOption[],
): T[] => steps.map((s) => chosenVariant(s, choices[s.key], languages));

/** The chosen versions as site-cart items (titles stay raw — translated only when shown). */
export const pathCartItems = (
  variants: PathMapping[],
  opts: { languages: CourseLanguageOption[]; productPageCode: string; pathTitle?: string },
): SiteCartItem[] =>
  variants.map((m) =>
    cartItemFromMapping(m, {
      languages: opts.languages,
      source: {
        kind: "path",
        productPageCode: opts.productPageCode,
        ...(opts.pathTitle ? { pathTitle: opts.pathTitle } : {}),
      },
    }),
  );

/** The path's price: the chosen versions summed (null when currencies differ). */
export const pathTotals = (items: SiteCartItem[]): CartTotals => cartTotals(items);

/**
 * What "Enrol in this path" charges before a coupon, priced the way the
 * product page's checkout prices the same courses (product-page-store
 * finalPrice): a basket price configured on the page ("any 3 for ₹799")
 * replaces the sum of the courses, then the page's best offer comes off.
 * `plain` (cartTotals of the same courses) is returned untouched when neither
 * applies or the currencies differ. The struck-through figure becomes what the
 * courses list at, when that is more than the total.
 */
export const pathCheckoutTotals = (
  plain: CartTotals,
  variants: Array<Pick<PathMapping, "level_name" | "package_name" | "payment_plan">>,
  settingsJson: string | null | undefined,
): CartTotals => {
  if (plain.total === null || !variants.length || !settingsJson) return plain;
  let base = plain.total;
  let listTotal = plain.elevatedTotal ?? plain.total;
  try {
    const quote = quoteBasket(
      parseBasketPricing(settingsJson),
      variants.map((m) => ({
        levelName: m.level_name,
        packageName: m.package_name,
        price: m.payment_plan?.actual_price ?? 0,
      })),
    );
    if (quote) {
      base = quote.total;
      listTotal = Math.max(listTotal, quote.itemTotal);
    }
  } catch {
    // An unreadable basket configuration: the courses' own prices stand.
  }
  const total = Math.max(0, base - (bestOffer(parseOffers(settingsJson), base, variants.length)?.amount ?? 0));
  if (total === plain.total) return plain;
  return { ...plain, total, elevatedTotal: listTotal > total ? listTotal : null };
};

/** ?courseIds= for the path's product-page checkout (package session ids). */
export const pathCourseIds = (variants: Array<{ package_session_id: string }>): string =>
  [...new Set(variants.map((v) => v.package_session_id).filter(Boolean))].join(",");

/** The chosen versions not yet in the site cart. */
export const missingFromCart = (items: SiteCartItem[], inCart: (packageSessionId: string) => boolean): SiteCartItem[] =>
  items.filter((i) => !inCart(i.packageSessionId));

/**
 * The versions the site cart can take from a path: one per course, because the
 * cart holds one (a second version of a course replaces the first). A course
 * the path lists more than once — two of its levels, or ungrouped language
 * versions — keeps the version already in the cart, else its first step's.
 * Path order is kept.
 */
export const onePerCourse = (
  items: SiteCartItem[],
  inCart: (packageSessionId: string) => boolean,
): SiteCartItem[] => {
  const byCourse = new Map<string, SiteCartItem>();
  for (const item of items) {
    const held = byCourse.get(item.courseId);
    if (!held || (!inCart(held.packageSessionId) && inCart(item.packageSessionId))) {
      byCourse.set(item.courseId, item);
    }
  }
  const kept = new Set(byCourse.values());
  return items.filter((i) => kept.has(i));
};

export interface PathCartPlan {
  /** What "Add whole path to cart" aims for: one version per course. */
  targets: SiteCartItem[];
  /** Targets not in the cart yet — what the next add puts in. */
  missing: SiteCartItem[];
  /** Every target is in the cart. */
  allInCart: boolean;
  /** Some targets are in the cart, some are not. */
  someInCart: boolean;
  /** The path lists more versions than the cart can hold (one per course). */
  collapsed: boolean;
}

/**
 * The path against the site cart. Built on onePerCourse, so one add always
 * settles it: after adding `missing`, every target is in the cart.
 */
export const planPathCart = (
  items: SiteCartItem[],
  inCart: (packageSessionId: string) => boolean,
): PathCartPlan => {
  const targets = onePerCourse(items, inCart);
  const missing = missingFromCart(targets, inCart);
  return {
    targets,
    missing,
    allInCart: targets.length > 0 && missing.length === 0,
    someInCart: missing.length > 0 && missing.length < targets.length,
    collapsed: targets.length < items.length,
  };
};

// ─── list mode (folder library) ─────────────────────────────────────────────

export interface PathEntry {
  node: PublicFolderNode;
  /** product_page_code — what ?path= carries. */
  code: string;
  /** The folder the path sits in (null at the library's top level). */
  parent: PublicFolderNode | null;
}

/**
 * The paths (product pages) under `nodes`, in library order, each code once.
 * Coming-soon folders are not opened: what is inside them has not launched.
 */
export const collectPathEntries = (
  nodes: PublicFolderNode[] | null | undefined,
  parent: PublicFolderNode | null = null,
  seen: Set<string> = new Set(),
): PathEntry[] => {
  const out: PathEntry[] = [];
  for (const n of nodes || []) {
    if (n.node_type === "PRODUCT_PAGE") {
      const code = (n.product_page_code || "").trim();
      if (code && !seen.has(code)) {
        seen.add(code);
        out.push({ node: n, code, parent });
      }
    } else if (!n.coming_soon) {
      out.push(...collectPathEntries(n.children, n, seen));
    }
  }
  return out;
};

/**
 * The folder a ?stream= value names: a top-level folder first (streams are the
 * library's top level), else the first folder anywhere with that slug.
 * Matching ignores case.
 */
export const findFolderBySlug = (roots: PublicFolderNode[], slug: string | null | undefined): PublicFolderNode | null => {
  const key = (slug || "").trim().toLowerCase();
  if (!key) return null;
  const matches = (n: PublicFolderNode) => n.node_type === "FOLDER" && folderSlug(n).toLowerCase() === key;
  const top = roots.find(matches);
  if (top) return top;
  const queue = roots.flatMap((n) => n.children || []);
  while (queue.length) {
    const n = queue.shift()!;
    if (matches(n)) return n;
    queue.push(...(n.children || []));
  }
  return null;
};

export type PathScope =
  | { kind: "all" }
  | { kind: "folder"; folder: PublicFolderNode; fromStream: boolean }
  /** The stream / folder asked for is not in the library (or is hidden). */
  | { kind: "missing" };

/** Where the list's paths come from: ?stream= (when read), else the chosen folder, else everything. */
export const resolvePathScope = (
  roots: PublicFolderNode[],
  opts: { stream?: string | null; folderId?: string | null },
): PathScope => {
  if (opts.stream) {
    const folder = findFolderBySlug(roots, opts.stream);
    return folder ? { kind: "folder", folder, fromStream: true } : { kind: "missing" };
  }
  if (opts.folderId) {
    const trail = pathTo(roots, opts.folderId);
    const hit = trail[trail.length - 1];
    return hit && hit.node_type === "FOLDER" ? { kind: "folder", folder: hit, fromStream: false } : { kind: "missing" };
  }
  return { kind: "all" };
};

export const pathsInScope = (roots: PublicFolderNode[], scope: PathScope): PathEntry[] => {
  if (scope.kind === "all") return collectPathEntries(roots);
  if (scope.kind === "missing" || scope.folder.coming_soon) return [];
  return collectPathEntries(scope.folder.children, scope.folder);
};
