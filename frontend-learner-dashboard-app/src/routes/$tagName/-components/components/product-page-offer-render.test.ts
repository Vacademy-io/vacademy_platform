import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/constants/urls", () => ({
  BASE_URL: "",
  GET_PRODUCT_PAGE_BY_CODE: () => "",
  VALIDATE_PRODUCT_PAGE_COUPON: "",
  PRODUCT_PAGE_FORM_SUBMIT: "",
  PRODUCT_PAGE_ENROLL: "",
  PRODUCT_PAGE_CPO_ENROLL: "",
  PEYMENT_LOG_STATUS_URL: "",
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: string | Record<string, unknown>) =>
      typeof opts === "string" ? opts : typeof opts?.defaultValue === "string" ? opts.defaultValue : key,
    i18n: { language: "en" },
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    React.createElement("a", { className }, children),
  useLocation: () => ({ pathname: "/", searchStr: "" }),
  useRouter: () => ({ history: { push: () => {}, replace: () => {} } }),
  useNavigate: () => () => Promise.resolve(),
}));
vi.mock("@/components/common/layout-container/sidebar/utils", () => ({
  getTerminology: () => "Course",
  getTerminologyPlural: () => "Courses",
}));
vi.mock("@/utils/ios-iap-compliance", () => ({ shouldHidePaidPurchaseUI: () => false }));
vi.mock("@/services/upload_file", () => ({ getPublicUrlWithoutLogin: () => Promise.resolve("") }));

const { ProductPageOfferComponent } = await import("./ProductPageOfferComponent");
const { useSiteCartStore } = await import("../../-stores/site-cart-store");

const INSTITUTE = "inst-1";
const CODE = "OFFER";
const mapping = (ps: string, pkg: string, order: number) => ({
  id: `m-${ps}`,
  ps_invite_payment_option_id: `b-${ps}`,
  package_session_id: ps,
  package_id: pkg,
  package_name: `Course ${pkg}`,
  level_name: "English",
  status: "ACTIVE",
  display_order: order,
  payment_plan: { actual_price: 100, currency: "INR" },
});

const render = (props: Record<string, unknown>) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["PRODUCT_PAGE_BY_CODE", CODE, INSTITUTE], {
    id: "p",
    code: CODE,
    name: "Offer",
    settings_json: null,
    mappings: [mapping("ps-2", "B", 1), mapping("ps-1", "A", 0)],
  });
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(ProductPageOfferComponent, {
        productPageCode: CODE,
        instituteId: INSTITUTE,
        enableCart: true,
        showSearch: false,
        ...props,
      }),
    ),
  );
};

const addedCount = (html: string) => (html.match(/productPageOffer\.added/g) || []).length;

describe("productPageOffer and the site cart", () => {
  // Server rendering reads zustand's server snapshot — the store's INITIAL
  // state object — so the visitor's cart is seeded there (and restored after).
  const initial = useSiteCartStore.getInitialState();
  const pristine = { ...initial };
  beforeEach(() => {
    // A visitor whose site cart already holds course A.
    Object.assign(initial, {
      instituteId: INSTITUTE,
      hydrated: true,
      items: [{ packageSessionId: "ps-1", courseId: "A", title: "Course A" }],
    });
  });
  afterEach(() => {
    Object.assign(initial, pristine);
  });

  it("ignores the site cart on a site without one (its own basket, as before)", () => {
    const html = render({});
    expect(addedCount(html)).toBe(0);
    expect(html).not.toContain("productPageOffer.selectedCount");
  });

  it("shows the site cart's courses as added when the site has a site cart", () => {
    const html = render({ globalSettings: { siteCart: { enabled: true, storeProductPageCode: "STORE" } } });
    expect(addedCount(html)).toBe(1);
    expect(html).toContain("productPageOffer.selectedCount");
  });

  it("lists courses in display order", () => {
    const html = render({});
    expect(html.indexOf("Course A")).toBeLessThan(html.indexOf("Course B"));
  });
});
