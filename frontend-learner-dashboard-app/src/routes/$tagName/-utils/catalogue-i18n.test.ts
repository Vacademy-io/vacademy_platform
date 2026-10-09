import { describe, expect, it } from "vitest";
import {
  applyLocalizedEdit,
  collectTranslatableStrings,
  dictionaryFor,
  isTextKey,
  localesOf,
  localizeDeep,
  mergeTranslations,
  resolveSiteLocale,
  translateText,
  translationCoverage,
} from "./catalogue-i18n";

const HI = {
  "Learn the Indian way of learning.": "सीखने का भारतीय तरीका।",
  Education: "शिक्षा",
  "Explore Education": "शिक्षा देखें",
  Courses: "पाठ्यक्रम",
};

describe("isTextKey", () => {
  it("treats prose keys as text and ids/links/colours/enums as data", () => {
    for (const k of ["title", "subtitle", "description", "label", "buttonText", "tagline", "showMoreLabel", "html", "alt"]) {
      expect(isTextKey(k)).toBe(true);
    }
    for (const k of ["id", "route", "href", "backgroundColor", "productPageCode", "image_url", "layout", "audienceId", "css", "tags"]) {
      expect(isTextKey(k)).toBe(false);
    }
  });
});

describe("resolveSiteLocale", () => {
  const settings = { enabled: true, defaultLocale: "en", locales: [{ code: "en", label: "EN" }, { code: "hi", label: "हिन्दी" }] };

  it("prefers ?lang=, then the remembered choice, then the base language", () => {
    expect(resolveSiteLocale({ settings, urlLocale: "hi", storedLocale: "en" })).toBe("hi");
    expect(resolveSiteLocale({ settings, urlLocale: null, storedLocale: "hi" })).toBe("hi");
    expect(resolveSiteLocale({ settings })).toBe("en");
  });

  it("ignores unknown languages and disabled sites", () => {
    expect(resolveSiteLocale({ settings, urlLocale: "fr" })).toBe("en");
    expect(resolveSiteLocale({ settings: { ...settings, enabled: false }, urlLocale: "hi" })).toBe("en");
    expect(resolveSiteLocale({ settings: undefined, urlLocale: "hi" })).toBe("en");
  });

  it("always lists the base language first, once", () => {
    expect(localesOf({ defaultLocale: "hi", locales: [{ code: "en", label: "EN" }, { code: "hi", label: "हिन्दी" }] }).map((l) => l.code)).toEqual(["hi", "en"]);
    expect(localesOf(undefined).map((l) => l.code)).toEqual(["en", "hi"]);
  });
});

describe("dictionaryFor", () => {
  it("is undefined for the base language, disabled sites and empty dictionaries", () => {
    const settings = { enabled: true, strings: { hi: HI, mr: {} } };
    expect(dictionaryFor(settings, "en")).toBeUndefined();
    expect(dictionaryFor(settings, "mr")).toBeUndefined();
    expect(dictionaryFor({ ...settings, enabled: false }, "hi")).toBeUndefined();
    expect(dictionaryFor(settings, "hi")).toBe(HI);
  });
});

describe("localizeDeep", () => {
  it("swaps translated text, leaves untranslated text and data alone", () => {
    const props = {
      title: "Education",
      subtitle: "Not translated yet",
      route: "Courses",
      backgroundColor: "rgb(255, 255, 255)",
      button: { text: "Explore Education", route: "/courses?stream=shiksha" },
      items: [{ label: "Courses" }, "Education"],
      tags: ["Education"],
    };
    const out = localizeDeep(props, HI);
    expect(out.title).toBe("शिक्षा");
    expect(out.subtitle).toBe("Not translated yet");
    expect(out.route).toBe("Courses");
    expect(out.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(out.button).toEqual({ text: "शिक्षा देखें", route: "/courses?stream=shiksha" });
    expect(out.items).toEqual([{ label: "पाठ्यक्रम" }, "शिक्षा"]);
    expect(out.tags).toEqual(["Education"]);
  });

  it("returns the same references when nothing changes", () => {
    const props = { title: "Untranslated", nested: { a: [1, 2], b: "x" } };
    expect(localizeDeep(props, HI)).toBe(props);
    expect(localizeDeep(props, undefined)).toBe(props);
    const mixed = { title: "Education", nested: { b: "x" } };
    expect(localizeDeep(mixed, HI).nested).toBe(mixed.nested);
  });

  it("keeps surrounding whitespace when only the trimmed text is translated", () => {
    expect(translateText("  Education ", HI)).toBe("  शिक्षा ");
  });
});

describe("collectTranslatableStrings", () => {
  it("lists distinct prose only, skipping links, colours and numbers", () => {
    const props = {
      title: "Education",
      price: "₹1,000",
      link: "https://x.io",
      stats: [{ value: "1,200+", label: "Learners" }, { label: "Education" }],
      href: "/courses",
      color: "rgb(255, 255, 255)",
    };
    expect(collectTranslatableStrings(props)).toEqual(["Education", "Learners"]);
  });

  it("reports coverage against a dictionary", () => {
    expect(translationCoverage(["Education", "New"], HI)).toEqual({ total: 2, translated: 1, missing: ["New"] });
  });
});

describe("applyLocalizedEdit", () => {
  const base = {
    title: "Education",
    subtitle: "Learn the Indian way of learning.",
    backgroundColor: "rgb(255, 255, 255)",
    items: [{ label: "Courses", route: "/courses" }, { label: "Paths", route: "/paths" }],
  };

  it("routes a text edit into the dictionary and keeps the English base", () => {
    const localized = localizeDeep(base, HI);
    const edited = { ...localized, subtitle: "भारतीय तरीके से सीखें।" };
    const res = applyLocalizedEdit(base, localized, edited);
    expect(res.base).toEqual(base);
    expect(res.translations).toEqual({ "Learn the Indian way of learning.": "भारतीय तरीके से सीखें।" });
  });

  it("applies non-text edits to the shared base", () => {
    const localized = localizeDeep(base, HI);
    const edited = { ...localized, backgroundColor: "rgb(0, 0, 0)" };
    const res = applyLocalizedEdit(base, localized, edited);
    expect(res.base.backgroundColor).toBe("rgb(0, 0, 0)");
    expect(res.base.title).toBe("Education");
    expect(res.translations).toEqual({});
  });

  it("edits a text field inside an item without touching its link", () => {
    const localized = localizeDeep(base, HI);
    const items = localized.items.map((it, i) => (i === 1 ? { ...it, label: "पथ" } : it));
    const res = applyLocalizedEdit(base, localized, { ...localized, items });
    expect(res.base.items).toEqual(base.items);
    expect(res.translations).toEqual({ Paths: "पथ" });
  });

  it("removes and reorders items in the base by identity", () => {
    const localized = localizeDeep(base, HI);
    const removed = applyLocalizedEdit(base, localized, { ...localized, items: [localized.items[1]] });
    expect(removed.base.items).toEqual([base.items[1]]);
    const reordered = applyLocalizedEdit(base, localized, { ...localized, items: [localized.items[1], localized.items[0]] });
    expect(reordered.base.items).toEqual([base.items[1], base.items[0]]);
    expect(reordered.translations).toEqual({});
  });

  it("adds a new item to the base", () => {
    const localized = localizeDeep(base, HI);
    const added = applyLocalizedEdit(base, localized, { ...localized, items: [...localized.items, { label: "New", route: "/new" }] });
    expect(added.base.items).toHaveLength(3);
    expect(added.base.items[0]).toBe(base.items[0]);
    expect(added.base.items[2]).toEqual({ label: "New", route: "/new" });
  });

  it("clearing or retyping the English removes the translation", () => {
    const localized = localizeDeep(base, HI);
    const cleared = applyLocalizedEdit(base, localized, { ...localized, title: "" });
    expect(cleared.translations).toEqual({ Education: "" });
    expect(mergeTranslations(HI, cleared.translations)).not.toHaveProperty("Education");
    const same = applyLocalizedEdit(base, localized, { ...localized, title: "Education" });
    expect(same.translations).toEqual({ Education: "" });
  });
});
