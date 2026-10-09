/**
 * Learning paths — pure helpers for the `learningPath` section.
 *
 * A learning path IS a product page: its courses, in the admin's display
 * order, are the path's numbered steps. A course offered in several language
 * versions (levels "Hindi" / "English") is ONE step with a language choice,
 * when the site groups versions (globalSettings.courseLanguages.enabled).
 * The list mode reads the paths from the folder library: the product pages
 * under the stream folder named by ?stream=, a chosen folder, or all of them.
 */
import {
  groupCourseVariants,
  variantForLanguage,
  type CourseGroup,
  type CourseLanguageOption,
} from "../../-utils/course-variants";
import { cartTotals, type CartTotals, type SiteCartItem } from "../../-utils/site-cart";
import { folderSlug, pathTo, type PublicFolderNode } from "../../-services/folder-library-service";
import { cartItemFromMapping, type CartMappingLike } from "../site-cart/site-cart-items";

/** The part of a by-code mapping a path step reads. */
export interface PathMapping extends CartMappingLike {
  status?: string | null;
  session_name?: string | null;
  display_order?: number | null;
}

export interface PathStep<T extends PathMapping = PathMapping> {
  /** package_id (or the package session for an ungrouped row). */
  courseId: string;
  /** The course's versions on this page, in display order. */
  variants: T[];
  /** Languages the course is offered in, in the site's order. */
  languages: CourseLanguageOption[];
  /** The version shown first: the visitor's language when the course has it. */
  primary: T;
}

/**
 * The path's steps: ACTIVE mappings in the order given (display order — the
 * product-page query sorts them), each package session once, one step per
 * course when versions are grouped and one per mapping otherwise.
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
  return groupCourseVariants(rows, {
    enabled: opts.groupVersions,
    languages: opts.languages,
    preferredLanguage: opts.preferredLanguage,
  }).map((g) => ({ courseId: g.courseId, variants: g.variants, languages: g.languages, primary: g.primary }));
};

/** The version chosen for a step: the visitor's language pick when the course has it, else its first version. */
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

/** One version per step, honouring the visitor's per-course language picks. */
export const pathSelection = <T extends PathMapping>(
  steps: PathStep<T>[],
  choices: Record<string, string | undefined>,
  languages: CourseLanguageOption[],
): T[] => steps.map((s) => chosenVariant(s, choices[s.courseId], languages));

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

/** ?courseIds= for the path's product-page checkout (package session ids). */
export const pathCourseIds = (variants: Array<{ package_session_id: string }>): string =>
  [...new Set(variants.map((v) => v.package_session_id).filter(Boolean))].join(",");

/** The chosen versions not yet in the site cart. */
export const missingFromCart = (items: SiteCartItem[], inCart: (packageSessionId: string) => boolean): SiteCartItem[] =>
  items.filter((i) => !inCart(i.packageSessionId));

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
