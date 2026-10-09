import { describe, expect, it } from "vitest";
import { withSearchParams } from "../../../-utils/catalogue-url-state";
import {
  countDiscoveryFilters,
  discoveryPatchToParams,
  formatPriceParam,
  parsePriceParam,
  readDiscoveryParams,
  readStreamParams,
  samePrice,
  searchToParam,
  sortFromToken,
  sortToToken,
  SORT_URL_TOKENS,
  type DiscoveryValidation,
} from "./catalog-url";
import { COURSE_CATALOG_SORT_OPTIONS } from "../../../-types/course-catalogue-types";

const V: DiscoveryValidation = {
  streams: [
    { slug: "shiksha", categories: [{ slug: "vedic-maths" }, { slug: "sanskrit" }] },
    { slug: "kala", categories: [{ slug: "music" }] },
  ],
  languageCodes: ["en", "hi"],
};

describe("price param", () => {
  it("parses free, paid and max:<n>", () => {
    expect(parsePriceParam("free")).toEqual({ kind: "free" });
    expect(parsePriceParam(" PAID ")).toEqual({ kind: "paid" });
    expect(parsePriceParam("max:1000")).toEqual({ kind: "max", max: 1000 });
    expect(parsePriceParam("max:499.5")).toEqual({ kind: "max", max: 499.5 });
  });

  it("ignores anything else", () => {
    for (const bad of [null, "", "cheap", "max:", "max:abc", "max:0", "max:-5", "min:100"]) {
      expect(parsePriceParam(bad)).toBeNull();
    }
  });

  it("round-trips", () => {
    for (const raw of ["free", "paid", "max:1000"]) expect(formatPriceParam(parsePriceParam(raw))).toBe(raw);
    expect(formatPriceParam(null)).toBeNull();
    expect(samePrice({ kind: "max", max: 5 }, { kind: "max", max: 5 })).toBe(true);
    expect(samePrice({ kind: "free" }, null)).toBe(false);
  });
});

describe("sort tokens", () => {
  it("has one unique token per sort option", () => {
    const tokens = COURSE_CATALOG_SORT_OPTIONS.map((o) => SORT_URL_TOKENS[o]);
    expect(new Set(tokens).size).toBe(COURSE_CATALOG_SORT_OPTIONS.length);
    for (const option of COURSE_CATALOG_SORT_OPTIONS) expect(sortFromToken(SORT_URL_TOKENS[option])).toBe(option);
  });

  it("matches the documented URL vocabulary", () => {
    expect(sortFromToken("popular")).toBe("Popular");
    expect(sortFromToken("PRICE-ASC")).toBe("Price: Low to High");
    expect(sortFromToken("name-desc")).toBe("Name Z-A");
    expect(sortFromToken("bogus")).toBeNull();
    expect(sortFromToken(null)).toBeNull();
  });

  it("leaves the default sort out of the URL", () => {
    expect(sortToToken("Newest", "Newest")).toBeNull();
    expect(sortToToken("Popular", "Newest")).toBe("popular");
    expect(sortToToken("Newest", "Popular")).toBe("newest");
  });
});

describe("readDiscoveryParams", () => {
  it("reads a full mega-menu / shared link", () => {
    const s = readDiscoveryParams(
      "?stream=Shiksha&category=sanskrit,vedic-maths&language=hi&price=max:1000&badge=new,bestseller&utm_source=x",
      V,
    );
    expect(s).toEqual({
      stream: "shiksha",
      categories: ["sanskrit", "vedic-maths"],
      languages: ["hi"],
      price: { kind: "max", max: 1000 },
      badges: ["new", "bestseller"],
    });
  });

  it("ignores unknown and invalid values", () => {
    const s = readDiscoveryParams("?stream=nope&category=music&language=ta,HI,hi&price=cheap&badge=hot,FREE", V);
    expect(s).toEqual({ stream: null, categories: [], languages: ["hi"], price: null, badges: ["free"] });
  });

  it("only accepts categories of the selected stream", () => {
    expect(readStreamParams("?stream=kala&category=music,sanskrit", V)).toEqual({
      stream: "kala",
      categories: ["music"],
    });
    expect(readStreamParams("?category=music", V)).toEqual({ stream: null, categories: [] });
  });

  it("drops languages when the site has none", () => {
    expect(readDiscoveryParams("?language=hi", { ...V, languageCodes: [] }).languages).toEqual([]);
  });
});

describe("discoveryPatchToParams", () => {
  it("writes only the keys in the patch, removing empty ones", () => {
    expect(discoveryPatchToParams({ stream: "kala", categories: [] })).toEqual({ stream: "kala", category: null });
    expect(discoveryPatchToParams({ price: { kind: "max", max: 500 }, badges: ["new"] })).toEqual({
      price: "max:500",
      badge: ["new"],
    });
    expect(discoveryPatchToParams({ languages: [], price: null, stream: null })).toEqual({
      language: null,
      price: null,
      stream: null,
    });
  });

  it("round-trips through the query string and keeps unrelated params", () => {
    const state = {
      stream: "shiksha",
      categories: ["vedic-maths"],
      languages: ["en", "hi"],
      price: { kind: "free" as const },
      badges: ["popular" as const],
    };
    const qs = withSearchParams("?lang=hi&utm=1", discoveryPatchToParams(state));
    expect(qs).toContain("lang=hi");
    expect(qs).toContain("utm=1");
    expect(readDiscoveryParams(qs, V)).toEqual(state);
  });
});

describe("misc", () => {
  it("trims and bounds the search param", () => {
    expect(searchToParam("  yoga ")).toBe("yoga");
    expect(searchToParam("   ")).toBeNull();
    expect(searchToParam("x".repeat(500))?.length).toBe(200);
  });

  it("counts applied discovery filters (not the stream)", () => {
    expect(
      countDiscoveryFilters({ stream: "kala", categories: ["a"], languages: ["hi", "en"], price: { kind: "paid" }, badges: [] }),
    ).toBe(4);
  });
});
