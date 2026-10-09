import { describe, expect, it, vi } from "vitest";

// folder-library-service builds its API base from the browser location.
vi.mock("@/constants/urls", () => ({ BASE_URL: "" }));

import { DEFAULT_COURSE_LANGUAGES as LANGS } from "../../-utils/course-variants";
import type { PublicFolderNode } from "../../-services/folder-library-service";
import {
  buildPathSteps,
  chosenVariant,
  collectPathEntries,
  findFolderBySlug,
  missingFromCart,
  pathCartItems,
  pathCourseIds,
  pathSelection,
  pathTotals,
  pathsInScope,
  resolvePathScope,
  type PathMapping,
} from "./learning-path-utils";

const row = (
  package_id: string,
  package_session_id: string,
  level_name: string,
  price = 100,
  extra: Partial<PathMapping> = {},
): PathMapping => ({
  package_id,
  package_session_id,
  level_name,
  package_name: `Course ${package_id}`,
  status: "ACTIVE",
  payment_plan: { actual_price: price, elevated_price: price * 2, currency: "INR" },
  ...extra,
});

// Display order as the product-page query returns it.
const mappings = [
  row("c1", "c1-en", "English", 500),
  row("c1", "c1-hi", "Hindi", 400),
  row("c2", "c2-hi", "Hindi", 300),
  row("c3", "c3-en", "English", 200, { status: "DELETED" }),
  row("c2", "c2-hi", "Hindi", 300), // the same version listed twice
  row("c4", "c4-en", "English", 0),
];

describe("buildPathSteps", () => {
  it("groups a course's language versions into one step, in display order", () => {
    const steps = buildPathSteps(mappings, { groupVersions: true, languages: LANGS });
    expect(steps.map((s) => s.courseId)).toEqual(["c1", "c2", "c4"]);
    expect(steps[0]!.variants.map((v) => v.package_session_id)).toEqual(["c1-en", "c1-hi"]);
    expect(steps[0]!.languages.map((l) => l.code)).toEqual(["en", "hi"]);
    expect(steps[1]!.variants).toHaveLength(1);
  });

  it("starts each course in the visitor's language when it has one", () => {
    const steps = buildPathSteps(mappings, { groupVersions: true, languages: LANGS, preferredLanguage: "hi" });
    expect(steps.map((s) => s.primary.package_session_id)).toEqual(["c1-hi", "c2-hi", "c4-en"]);
  });

  it("keeps one step per mapping when the site does not group versions", () => {
    const steps = buildPathSteps(mappings, { groupVersions: false, languages: LANGS });
    expect(steps.map((s) => s.primary.package_session_id)).toEqual(["c1-en", "c1-hi", "c2-hi", "c4-en"]);
  });

  it("copes with no mappings", () => {
    expect(buildPathSteps(null, { groupVersions: true, languages: LANGS })).toEqual([]);
  });
});

describe("path selection, cart items and total", () => {
  const steps = buildPathSteps(mappings, { groupVersions: true, languages: LANGS });

  it("honours a per-course language pick and ignores a language the course lacks", () => {
    expect(chosenVariant(steps[0]!, "hi", LANGS).package_session_id).toBe("c1-hi");
    expect(chosenVariant(steps[1]!, "en", LANGS).package_session_id).toBe("c2-hi");
    expect(chosenVariant(steps[0]!, undefined, LANGS).package_session_id).toBe("c1-en");
  });

  it("totals the chosen versions and builds path-sourced cart items", () => {
    const chosen = pathSelection(steps, { c1: "hi" }, LANGS);
    expect(chosen.map((v) => v.package_session_id)).toEqual(["c1-hi", "c2-hi", "c4-en"]);
    const items = pathCartItems(chosen, { languages: LANGS, productPageCode: "PATH1", pathTitle: "Shiksha basics" });
    expect(items[0]).toMatchObject({
      packageSessionId: "c1-hi",
      courseId: "c1",
      languageCode: "hi",
      source: { kind: "path", productPageCode: "PATH1", pathTitle: "Shiksha basics" },
    });
    expect(pathTotals(items)).toEqual({ count: 3, total: 700, elevatedTotal: 1400, currency: "INR" });
    expect(pathCourseIds(chosen)).toBe("c1-hi,c2-hi,c4-en");
  });

  it("gives no single total across currencies", () => {
    const items = pathCartItems(
      [row("a", "a1", "English", 10), row("b", "b1", "English", 20, { payment_plan: { actual_price: 5, currency: "USD" } })],
      { languages: LANGS, productPageCode: "P" },
    );
    expect(pathTotals(items).total).toBeNull();
  });

  it("knows which chosen versions are not in the cart yet", () => {
    const items = pathCartItems(pathSelection(steps, {}, LANGS), { languages: LANGS, productPageCode: "P" });
    const inCart = new Set(["c1-en"]);
    expect(missingFromCart(items, (id) => inCart.has(id)).map((i) => i.packageSessionId)).toEqual(["c2-hi", "c4-en"]);
  });
});

const folder = (id: string, children: PublicFolderNode[], extra: Partial<PublicFolderNode> = {}): PublicFolderNode => ({
  id,
  node_type: "FOLDER",
  title: id,
  children,
  ...extra,
});
const page = (id: string, code: string | null, extra: Partial<PublicFolderNode> = {}): PublicFolderNode => ({
  id,
  node_type: "PRODUCT_PAGE",
  product_page_code: code,
  children: [],
  ...extra,
});

const library: PublicFolderNode[] = [
  folder("shiksha", [
    page("p1", "PATH-A"),
    folder("vedic-maths", [page("p2", "PATH-B"), page("p2b", "PATH-A")], { slug: "vedic-maths" }),
    folder("soon", [page("p3", "PATH-SOON")], { coming_soon: true }),
  ], { slug: "shiksha", title: "शिक्षा", subtitle: "Education" }),
  folder("kala", [page("p4", "PATH-C"), page("p5", null)], { subtitle: "Arts" }),
];

describe("list mode: paths from the folder library", () => {
  it("collects product pages in library order, once each, skipping coming-soon folders", () => {
    const entries = collectPathEntries(library);
    expect(entries.map((e) => e.code)).toEqual(["PATH-A", "PATH-B", "PATH-C"]);
    expect(entries[1]!.parent?.id).toBe("vedic-maths");
    expect(entries[0]!.parent?.id).toBe("shiksha");
  });

  it("finds the stream folder by slug, top level first, case-insensitively", () => {
    expect(findFolderBySlug(library, "SHIKSHA")?.id).toBe("shiksha");
    expect(findFolderBySlug(library, "arts")?.id).toBe("kala"); // slug derived from the subtitle
    expect(findFolderBySlug(library, "vedic-maths")?.id).toBe("vedic-maths");
    expect(findFolderBySlug(library, "nope")).toBeNull();
    expect(findFolderBySlug(library, "")).toBeNull();
  });

  it("scopes the list to ?stream=, else the chosen folder, else everything", () => {
    const stream = resolvePathScope(library, { stream: "shiksha", folderId: "kala" });
    expect(stream).toMatchObject({ kind: "folder", fromStream: true });
    expect(pathsInScope(library, stream).map((e) => e.code)).toEqual(["PATH-A", "PATH-B"]);

    const chosen = resolvePathScope(library, { folderId: "kala" });
    expect(pathsInScope(library, chosen).map((e) => e.code)).toEqual(["PATH-C"]);

    expect(pathsInScope(library, resolvePathScope(library, {})).map((e) => e.code)).toEqual(["PATH-A", "PATH-B", "PATH-C"]);
  });

  it("shows nothing for a stream or folder that is not in the library", () => {
    expect(resolvePathScope(library, { stream: "unknown" })).toEqual({ kind: "missing" });
    expect(resolvePathScope(library, { folderId: "p1" })).toEqual({ kind: "missing" });
    expect(pathsInScope(library, { kind: "missing" })).toEqual([]);
    expect(pathsInScope(library, resolvePathScope(library, { folderId: "soon" }))).toEqual([]);
  });
});
