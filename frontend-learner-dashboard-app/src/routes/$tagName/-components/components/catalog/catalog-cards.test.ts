import { describe, expect, it } from "vitest";
import { DEFAULT_COURSE_LANGUAGES as LANGS } from "../../../-utils/course-variants";
import { buildCatalogCards, courseTagsOf, isComingSoonRow, isPureLanguageLevel, rowLanguage, type CatalogRowLike } from "./catalog-cards";

const row = (over: Partial<CatalogRowLike> & Record<string, unknown>): CatalogRowLike & Record<string, unknown> => ({
  id: "c1",
  title: "Yoga",
  description: "Learn yoga",
  price: 0,
  level: "Beginner",
  rating: 0,
  instructor: "Asha",
  ...over,
});

const ROWS = [
  row({ id: "c1", packageSessionId: "c1-en", level: "English", level_name: "English", price: 1200, comma_separeted_tags: "shiksha, yoga" }),
  row({ id: "c2", packageSessionId: "c2-hi", level: "Hindi", level_name: "Hindi", price: 500, comma_separeted_tags: "kala" }),
  row({ id: "c1", packageSessionId: "c1-hi", level: "Hindi", level_name: "Hindi", price: 800, comma_separeted_tags: "Yoga,  hindi-medium" }),
  row({ id: "c3", packageSessionId: "c3-x", level: "Beginner", level_name: null, price: 300 }),
];

describe("buildCatalogCards", () => {
  it("keeps one card per row, in order, when grouping is off (the original grid)", () => {
    const cards = buildCatalogCards(ROWS, { grouping: false, languages: LANGS });
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => c.primary)).toEqual(ROWS);
    expect(cards.every((c) => c.rows.length === 1 && c.languages.length === 0)).toBe(true);
    expect(cards.map((c) => c.sortPrice)).toEqual([1200, 500, 800, 300]);
  });

  it("folds a course's versions into one card where its first row sat", () => {
    const cards = buildCatalogCards(ROWS, { grouping: true, languages: LANGS });
    expect(cards.map((c) => c.courseId)).toEqual(["c1", "c2", "c3"]);
    const c1 = cards[0];
    expect(c1.rows.map((r) => r.packageSessionId)).toEqual(["c1-en", "c1-hi"]);
    expect(c1.languages.map((l) => l.chip)).toEqual(["EN", "हिं"]);
    expect(c1.primary.packageSessionId).toBe("c1-en");
    expect([...c1.tagSet].sort()).toEqual(["hindi-medium", "shiksha", "yoga"]);
  });

  it("computes the 'from' price across versions", () => {
    const [c1, c2] = buildCatalogCards(ROWS, { grouping: true, languages: LANGS });
    expect(c1).toMatchObject({ minPrice: 800, maxPrice: 1200, priceVaries: true, sortPrice: 800 });
    expect(c2).toMatchObject({ minPrice: 500, maxPrice: 500, priceVaries: false });
  });

  it("opens the preferred language's version when the course has one", () => {
    const cards = buildCatalogCards(ROWS, { grouping: true, languages: LANGS, preferredLanguage: "hi" });
    expect(cards[0].primary.packageSessionId).toBe("c1-hi");
    expect(cards[2].primary.packageSessionId).toBe("c3-x");
  });

  it("leaves coming-soon versions out of the price summary", () => {
    const soon = { enabled: true, launch_date: "2099-01-01" };
    const [card] = buildCatalogCards(
      [row({ id: "c9", price: 0, coming_soon: soon }), row({ id: "c9", price: 0, coming_soon: soon, packageSessionId: "b" })],
      { grouping: true, languages: LANGS },
    );
    expect(card).toMatchObject({ minPrice: null, maxPrice: null, priceVaries: false, sortPrice: 0 });
  });
});

describe("row helpers", () => {
  it("reads course tags from the v2 field and an array", () => {
    expect(courseTagsOf({ comma_separeted_tags: " a, ,b " })).toEqual(["a", "b"]);
    expect(courseTagsOf({ comma_separeted_tags: null, tags: ["x", 3, " y "] })).toEqual(["x", "y"]);
  });

  it("spots pure-language levels only", () => {
    expect(isPureLanguageLevel("Hindi", LANGS)).toBe(true);
    expect(isPureLanguageLevel(" english ", LANGS)).toBe(true);
    expect(isPureLanguageLevel("हिन्दी", LANGS)).toBe(true);
    expect(isPureLanguageLevel("Beginner Hindi", LANGS)).toBe(false);
    expect(isPureLanguageLevel("Hindi - Batch 2", LANGS)).toBe(false);
    expect(isPureLanguageLevel("Engineering", LANGS)).toBe(false);
    expect(isPureLanguageLevel(null, LANGS)).toBe(false);
  });

  it("reads a row's language from its level name", () => {
    expect(rowLanguage({ level_name: "Advanced Hindi" }, LANGS)?.code).toBe("hi");
    expect(rowLanguage({ level_name: null, level: "Beginner" }, LANGS)).toBeNull();
  });

  it("recognises coming-soon rows", () => {
    expect(isComingSoonRow({ coming_soon: { enabled: true } })).toBe(true);
    expect(isComingSoonRow({ coming_soon: null })).toBe(false);
  });
});
