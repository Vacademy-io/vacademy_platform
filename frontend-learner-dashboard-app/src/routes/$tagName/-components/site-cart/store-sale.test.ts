import { describe, expect, it } from "vitest";
import { storeCartRoute, storeSaleFrom } from "./store-sale";

const store = {
  mappings: [
    { package_session_id: "sold", status: "ACTIVE" },
    { package_session_id: "twice", status: "ACTIVE" },
    { package_session_id: "twice", status: "ACTIVE" },
    { package_session_id: "retired", status: "DELETED" },
  ],
};

describe("storeSaleFrom", () => {
  it("is off without a site cart, whatever the query holds", () => {
    const sale = storeSaleFrom(false, { data: store, isError: false });
    expect(sale.status).toBe("off");
    expect(sale.sells("sold")).toBe(false);
  });

  it("is loading until the store page arrives, and an error when it cannot", () => {
    expect(storeSaleFrom(true, { data: undefined, isError: false }).status).toBe("loading");
    const failed = storeSaleFrom(true, { data: undefined, isError: true });
    expect(failed.status).toBe("error");
    expect(failed.sells("sold")).toBe(false);
  });

  it("sells what the store maps exactly once — a page it has already read stays readable after a failed refetch", () => {
    for (const isError of [false, true]) {
      const sale = storeSaleFrom(true, { data: store, isError });
      expect(sale.status).toBe("ready");
      expect(sale.sells("sold")).toBe(true);
      expect(sale.sells("twice")).toBe(false);
      expect(sale.sells("retired")).toBe(false);
      expect(sale.sells("never")).toBe(false);
      expect(sale.sells(undefined)).toBe(false);
    }
  });
});

describe("storeCartRoute", () => {
  const ready = storeSaleFrom(true, { data: store, isError: false });

  it("goes to the cart only when the store sells every course", () => {
    expect(storeCartRoute(ready, ["sold"])).toBe("cart");
    expect(storeCartRoute(ready, ["sold", "never"])).toBe("page");
    expect(storeCartRoute(ready, ["twice"])).toBe("page");
    expect(storeCartRoute(ready, [])).toBe("page");
  });

  it("offers nothing while the store loads, and the own page when it cannot be read", () => {
    expect(storeCartRoute(storeSaleFrom(true, { data: undefined, isError: false }), ["sold"])).toBe("pending");
    expect(storeCartRoute(storeSaleFrom(true, { data: undefined, isError: true }), ["sold"])).toBe("page");
    expect(storeCartRoute(storeSaleFrom(false, { data: store, isError: false }), ["sold"])).toBe("page");
  });
});
