import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/domain-routing", () => ({ getCachedRootCatalogueTag: () => null }));

import {
  blockTypeLabel,
  isEditorMessage,
  isFramed,
  parseAdminOrigins,
  previewRouteFromHref,
  readyTargets,
} from "./preview-bridge";

/** The editor preview obeys only the frame that embeds it. */

const editor = { postMessage: () => {} } as unknown as Window;
const framed = { parent: editor } as unknown as Window;
const topLevel = {} as { parent: unknown };
topLevel.parent = topLevel;

describe("isEditorMessage", () => {
  it("accepts the embedding frame from any origin while no admin origins are set", () => {
    expect(isEditorMessage({ source: editor, origin: "https://admin.acme.in" }, framed, [])).toBe(true);
  });

  it("ignores a message from another window or frame", () => {
    const other = { postMessage: () => {} } as unknown as Window;
    expect(isEditorMessage({ source: other, origin: "https://admin.acme.in" }, framed, [])).toBe(false);
    expect(isEditorMessage({ source: null, origin: "https://admin.acme.in" }, framed, [])).toBe(false);
  });

  it("ignores everything when the page is not framed (a window opened by another site)", () => {
    const win = topLevel as unknown as Window;
    expect(isFramed(win)).toBe(false);
    expect(isEditorMessage({ source: win, origin: "https://evil.example" }, win, [])).toBe(false);
  });

  it("with admin origins set, ignores the parent when its origin is not listed", () => {
    const allowed = ["https://dash.vacademy.io"];
    expect(isEditorMessage({ source: editor, origin: "https://evil.example" }, framed, allowed)).toBe(false);
    expect(isEditorMessage({ source: editor, origin: "https://dash.vacademy.io" }, framed, allowed)).toBe(true);
  });
});

describe("admin origins", () => {
  it("parses a comma-separated list, trimming spaces and trailing slashes", () => {
    expect(parseAdminOrigins(" https://dash.vacademy.io/, https://admin.acme.in ,,")).toEqual([
      "https://dash.vacademy.io",
      "https://admin.acme.in",
    ]);
    expect(parseAdminOrigins(undefined)).toEqual([]);
  });

  it("announces READY to each listed origin, or to any when none are listed", () => {
    expect(readyTargets([])).toEqual(["*"]);
    expect(readyTargets(["https://a.io", "https://b.io"])).toEqual(["https://a.io", "https://b.io"]);
  });
});

describe("previewRouteFromHref", () => {
  const base = { origin: "https://learn.acme.in", tagName: "acme" };

  it("gives the page route after the catalogue base", () => {
    expect(previewRouteFromHref("https://learn.acme.in/acme/courses?format=live", base)).toBe("courses");
    expect(previewRouteFromHref("/acme/learning-paths", base)).toBe("learning-paths");
    expect(previewRouteFromHref("/acme/blog/first-post", base)).toBe("blog/first-post");
    expect(previewRouteFromHref("/acme", base)).toBe("");
  });

  it("is null for a link that leaves the site", () => {
    expect(previewRouteFromHref("https://wa.me/9199", base)).toBeNull();
    expect(previewRouteFromHref("mailto:hi@acme.in", base)).toBeNull();
  });
});

describe("blockTypeLabel", () => {
  it("reads a block type as words", () => {
    expect(blockTypeLabel("heroSection")).toBe("Hero section");
    expect(blockTypeLabel("ctaBanner")).toBe("Cta banner");
    expect(blockTypeLabel(undefined)).toBe("");
  });
});
