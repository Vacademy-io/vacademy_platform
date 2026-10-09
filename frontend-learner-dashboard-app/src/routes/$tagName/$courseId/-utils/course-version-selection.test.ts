import { describe, expect, it, vi } from "vitest";

vi.mock("@/constants/urls", () => ({
  ENROLLMENT_INVITE_URL: "https://api.test/invite",
  urlCourseDetails: "https://api.test/search",
  GET_PRODUCT_PAGE_BY_CODE: () => "https://api.test/by-code",
}));

import { DEFAULT_COURSE_LANGUAGES, preferredCourseLanguage } from "../../-utils/course-variants";
import type { CourseLevel } from "../../-services/course-levels-service";
import {
  buildCourseCartItem,
  effectiveInviteIdFor,
  languageOptionsFor,
  localizeCourseDisplay,
  orderVersions,
  pickInitialVersion,
  resolveVersionOffer,
  urlDesignatedVersion,
  versionSearchUpdates,
  type VersionSelectionInput,
} from "./course-version-selection";

const languages = DEFAULT_COURSE_LANGUAGES; // en (EN), hi (हिं)

const version = (over: Partial<CourseLevel> & { packageSessionId: string }): CourseLevel => ({
  levelId: null,
  levelName: null,
  sessionId: null,
  sessionName: null,
  enrollInviteId: null,
  price: null,
  elevatedPrice: null,
  currency: null,
  availability: null,
  availableSlots: null,
  durationMinutes: null,
  instructors: null,
  source: "catalogue",
  ...over,
});

const hi = version({ packageSessionId: "ps-hi", levelName: "Hindi", enrollInviteId: "inv-hi", price: 499 });
const en = version({ packageSessionId: "ps-en", levelName: "English", enrollInviteId: "inv-en", price: 999 });
const enNoInvite = version({ packageSessionId: "ps-en-2", levelName: "Beginner English" });
const misc = version({ packageSessionId: "ps-misc", levelName: "Batch 2", enrollInviteId: "inv-misc" });

const input = (over: Partial<VersionSelectionInput> = {}): VersionSelectionInput => ({ languages, ...over });

describe("orderVersions", () => {
  it("follows the site's language order, unknown languages last, source order within", () => {
    expect(orderVersions([misc, hi, enNoInvite, en], languages).map((v) => v.packageSessionId)).toEqual([
      "ps-en-2",
      "ps-en",
      "ps-hi",
      "ps-misc",
    ]);
  });

  it("leaves the order alone when language versions are off", () => {
    const list = [hi, en];
    expect(orderVersions(list, [])).toBe(list);
  });
});

describe("languageOptionsFor", () => {
  const ordered = orderVersions([hi, enNoInvite, en, misc], languages);

  it("offers one segment per language with labels and chips from the site settings", () => {
    const options = languageOptionsFor(ordered, languages, null);
    expect(options).toEqual([
      { code: "en", label: "English", chip: "EN", packageSessionId: "ps-en", disabled: false },
      { code: "hi", label: "Hindi", chip: "हिं", packageSessionId: "ps-hi", disabled: false },
    ]);
  });

  it("lets the selected version represent its language", () => {
    const options = languageOptionsFor(ordered, languages, "ps-en-2");
    expect(options[0]).toMatchObject({ packageSessionId: "ps-en-2", disabled: true });
  });

  it("disables a language whose versions have no invite", () => {
    const options = languageOptionsFor([enNoInvite, hi], languages, "ps-hi");
    expect(options.find((o) => o.code === "en")).toMatchObject({ disabled: true });
  });

  it("has fewer than two options when the course is single-language (no picker)", () => {
    expect(languageOptionsFor([en, enNoInvite, misc], languages, null)).toHaveLength(1);
  });
});

describe("pickInitialVersion", () => {
  const versions = orderVersions([hi, en, enNoInvite], languages);

  it("1. honours ?packageSessionId, even for a version without an invite", () => {
    expect(pickInitialVersion(versions, input({ urlPackageSessionId: "ps-hi", preferredLanguage: "en" }))).toBe(hi);
    expect(pickInitialVersion(versions, input({ urlPackageSessionId: "ps-en-2" }))).toBe(enNoInvite);
  });

  it("2. else the level of ?enrollInviteId (default invite or one the invite sells)", () => {
    expect(pickInitialVersion(versions, input({ urlEnrollInviteId: "inv-hi", preferredLanguage: "en" }))).toBe(hi);
    expect(
      pickInitialVersion(versions, input({ urlEnrollInviteId: "special", urlInvitePackageSessionIds: ["ps-hi"] })),
    ).toBe(hi);
  });

  it("2b. one invite selling both languages resolves to the visitor's language", () => {
    const shared = [
      version({ packageSessionId: "a-en", levelName: "English", enrollInviteId: "bundle" }),
      version({ packageSessionId: "a-hi", levelName: "Hindi", enrollInviteId: "bundle" }),
    ];
    expect(pickInitialVersion(shared, input({ urlEnrollInviteId: "bundle", preferredLanguage: "hi" }))?.packageSessionId).toBe("a-hi");
    expect(pickInitialVersion(shared, input({ urlEnrollInviteId: "bundle" }))?.packageSessionId).toBe("a-en");
  });

  it("3. else the visitor's language from the site locale", () => {
    const preferred = preferredCourseLanguage("hi", languages);
    expect(pickInitialVersion(versions, input({ preferredLanguage: preferred }))).toBe(hi);
  });

  it("3b. a stale ?packageSessionId falls through to the next rule", () => {
    expect(pickInitialVersion(versions, input({ urlPackageSessionId: "gone", preferredLanguage: "hi" }))).toBe(hi);
  });

  it("4. else the first version with an invite; 5. else the first version", () => {
    expect(pickInitialVersion(versions, input())).toBe(en);
    expect(pickInitialVersion(versions, input({ preferredLanguage: "mr" }))).toBe(en);
    expect(pickInitialVersion([enNoInvite], input())).toBe(enNoInvite);
    expect(pickInitialVersion([], input())).toBeNull();
  });

  it("does not auto-pick a preferred-language version nobody can enrol in", () => {
    const hiClosed = version({ packageSessionId: "ps-hi-x", levelName: "Hindi" });
    expect(pickInitialVersion([en, hiClosed], input({ preferredLanguage: "hi" }))).toBe(en);
  });
});

describe("effectiveInviteIdFor", () => {
  it("keeps the URL's invite for the version the URL names, the version's own otherwise", () => {
    const urlVersion = urlDesignatedVersion([en, hi], input({ urlPackageSessionId: "ps-hi", urlEnrollInviteId: "promo" }));
    expect(urlVersion).toBe(hi);
    expect(effectiveInviteIdFor(hi, "promo", urlVersion)).toBe("promo");
    expect(effectiveInviteIdFor(en, "promo", urlVersion)).toBe("inv-en");
    expect(effectiveInviteIdFor(en, undefined, null)).toBe("inv-en");
    expect(effectiveInviteIdFor(enNoInvite, undefined, null)).toBeNull();
  });
});

describe("resolveVersionOffer", () => {
  const invite = {
    availability_status: "EXPIRED",
    setting_json: '{"setting":{}}',
    package_session_to_payment_options: [
      { package_session_id: "ps-en", payment_option: { payment_plans: [{ actual_price: 899, elevated_price: 1299, currency: "USD" }] } },
      { package_session_id: "ps-hi", payment_option: { payment_plans: [{ actual_price: 0, currency: "INR" }] } },
    ],
  };

  it("uses the invite plan of THIS version's entry", () => {
    expect(resolveVersionOffer(hi, invite)).toEqual({
      price: 0,
      elevatedPrice: undefined,
      currency: "INR",
      availability: "EXPIRED",
      settingJson: '{"setting":{}}',
    });
    expect(resolveVersionOffer(en, invite)).toMatchObject({ price: 899, elevatedPrice: 1299, currency: "USD" });
  });

  it("shows the search row's price until the invite has loaded", () => {
    const row = version({ packageSessionId: "ps-en", levelName: "English", price: 999, elevatedPrice: 1500, currency: "INR", availability: "AVAILABLE" });
    expect(resolveVersionOffer(row, null)).toEqual({ price: 999, elevatedPrice: 1500, currency: "INR", availability: "AVAILABLE", settingJson: undefined });
    expect(resolveVersionOffer(enNoInvite, null).price).toBe(0);
  });

  it("keeps a product page version on that page's own plan", () => {
    const pp = version({ packageSessionId: "ps-en", levelName: "English", price: 450, currency: "INR", source: "productPage" });
    expect(resolveVersionOffer(pp, invite)).toMatchObject({ price: 450, currency: "INR", availability: "EXPIRED" });
  });
});

describe("versionSearchUpdates", () => {
  it("names the picked version and drops the link's price/slots", () => {
    expect(versionSearchUpdates(hi)).toEqual({
      packageSessionId: "ps-hi",
      enrollInviteId: "inv-hi",
      level: "Hindi",
      price: null,
      available_slots: null,
    });
  });
});

describe("buildCourseCartItem", () => {
  it("builds a base-language cart line for the version", () => {
    expect(
      buildCourseCartItem({
        courseId: "pkg-yoga",
        title: "Yoga",
        packageSessionId: "ps-hi",
        levelName: "Hindi",
        languages,
        price: 499,
        currency: "INR",
        image: "media-1",
        enrollInviteId: "inv-hi",
      }),
    ).toEqual({
      packageSessionId: "ps-hi",
      courseId: "pkg-yoga",
      title: "Yoga",
      levelName: "Hindi",
      languageCode: "hi",
      price: 499,
      elevatedPrice: undefined,
      currency: "INR",
      image: "media-1",
      enrollInviteId: "inv-hi",
      source: { kind: "course" },
    });
  });

  it("drops placeholder images and empty invites", () => {
    const item = buildCourseCartItem({ courseId: "c", title: "T", packageSessionId: "p", languages, image: "/api/placeholder/800/400", enrollInviteId: "" });
    expect(item.image).toBeUndefined();
    expect(item.enrollInviteId).toBeUndefined();
    expect(item.languageCode).toBeUndefined();
  });
});

describe("localizeCourseDisplay", () => {
  const dict: Record<string, string> = { Yoga: "योग", Hindi: "हिन्दी", Wellness: "स्वास्थ्य" };
  const t = (s: string) => dict[s] ?? s;

  it("translates live text for display", () => {
    const course = { title: "Yoga", level: "Hindi", tags: ["Wellness", "Beginner"], price: 499, packageSessionId: "ps-hi" };
    expect(localizeCourseDisplay(course, t)).toEqual({ ...course, title: "योग", level: "हिन्दी", tags: ["स्वास्थ्य", "Beginner"] });
  });

  it("returns the same object when nothing is translated", () => {
    const course = { title: "Pilates", tags: ["Core"], price: 1 };
    expect(localizeCourseDisplay(course, t)).toBe(course);
    expect(localizeCourseDisplay(course, (s) => s)).toBe(course);
  });
});
