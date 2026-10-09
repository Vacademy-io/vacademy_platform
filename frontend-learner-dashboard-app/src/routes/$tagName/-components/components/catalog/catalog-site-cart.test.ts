import { describe, expect, it } from "vitest";
import { DEFAULT_COURSE_LANGUAGES as LANGS } from "../../../-utils/course-variants";
import type { CatalogRowLike } from "./catalog-cards";
import { cartVersionOf, isPurchasableRow, packageSessionOf, purchasableVersions, toSiteCartItem } from "./catalog-site-cart";

const row = (over: Partial<CatalogRowLike> & Record<string, unknown>): CatalogRowLike & Record<string, unknown> => ({
  id: "c1",
  title: "Yoga",
  description: "",
  price: 999,
  level: "Hindi",
  level_name: "Hindi",
  rating: 0,
  instructor: "",
  packageSessionId: "ps-hi",
  ...over,
});

describe("purchasable versions", () => {
  it("needs a package session, a price, an open window and no coming-soon", () => {
    expect(isPurchasableRow(row({}))).toBe(true);
    expect(isPurchasableRow(row({ packageSessionId: undefined, package_session_id: "ps-x" }))).toBe(true);
    expect(isPurchasableRow(row({ packageSessionId: undefined }))).toBe(false);
    expect(isPurchasableRow(row({ price: 0 }))).toBe(false);
    expect(isPurchasableRow(row({ enroll_invite_availability: "EXPIRED" }))).toBe(false);
    expect(isPurchasableRow(row({ coming_soon: { enabled: true } }))).toBe(false);
    expect(purchasableVersions([row({}), row({ price: 0, packageSessionId: "free" })]).map(packageSessionOf)).toEqual([
      "ps-hi",
    ]);
  });
});

describe("toSiteCartItem", () => {
  it("builds a cart line in the base language with the version's language", () => {
    expect(
      toSiteCartItem(
        row({ elevatedPrice: 1499, currency: "INR", thumbnail: "media-1", enrollInviteId: "inv-1" }),
        "c1",
        LANGS,
      ),
    ).toEqual({
      packageSessionId: "ps-hi",
      courseId: "c1",
      title: "Yoga",
      levelName: "Hindi",
      languageCode: "hi",
      price: 999,
      elevatedPrice: 1499,
      currency: "INR",
      image: "media-1",
      enrollInviteId: "inv-1",
      source: { kind: "catalog" },
    });
  });

  it("leaves out placeholders and unknown languages", () => {
    const item = toSiteCartItem(row({ level_name: "Beginner", level: "Beginner", thumbnail: "/api/placeholder/300/200" }), "c1", LANGS);
    expect(item.languageCode).toBeUndefined();
    expect(item.image).toBeUndefined();
  });

  it("finds the version of a course that is already in the cart", () => {
    const versions = [row({ packageSessionId: "ps-en" }), row({ packageSessionId: "ps-hi" })];
    expect(cartVersionOf(versions, new Set(["ps-hi", "other"]))?.packageSessionId).toBe("ps-hi");
    expect(cartVersionOf(versions, new Set())).toBeUndefined();
  });
});
