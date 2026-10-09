import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── environment stubs (node, no router / browser) ──────────────────────────
vi.mock("@/constants/urls", () => ({
  BASE_URL: "",
  GET_PRODUCT_PAGE_BY_CODE: (code: string, id: string) => `/by-code?code=${code}&instituteId=${id}`,
  VALIDATE_PRODUCT_PAGE_COUPON: "",
  PRODUCT_PAGE_FORM_SUBMIT: "",
  PRODUCT_PAGE_ENROLL: "",
  PRODUCT_PAGE_CPO_ENROLL: "",
  PEYMENT_LOG_STATUS_URL: "",
}));

const interpolate = (text: string, vars: Record<string, unknown> = {}) =>
  text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ""));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: string | Record<string, unknown>) =>
      typeof opts === "string"
        ? opts
        : opts?.defaultValue
          ? interpolate(String(opts.defaultValue), opts)
          : key === "productPageOffer.free"
            ? "Free"
            : key,
    i18n: { language: "en" },
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    search,
    children,
    className,
  }: {
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string | undefined>;
    children?: React.ReactNode;
    className?: string;
  }) => {
    const path = to.replace(/\$(\w+)/g, (_, k: string) => params?.[k] ?? "");
    const qs = new URLSearchParams(
      Object.entries(search || {}).filter((e): e is [string, string] => typeof e[1] === "string"),
    ).toString();
    return React.createElement("a", { href: qs ? `${path}?${qs}` : path, className }, children);
  },
  useLocation: () => ({ pathname: "/courses", searchStr: "" }),
  useRouter: () => ({ history: { push: () => {}, replace: () => {} } }),
  useNavigate: () => () => Promise.resolve(),
}));

vi.mock("@/components/common/layout-container/sidebar/utils", () => ({
  getTerminology: () => "Course",
  getTerminologyPlural: () => "Courses",
}));
vi.mock("@/utils/ios-iap-compliance", () => ({ shouldHidePaidPurchaseUI: () => false }));
vi.mock("@/services/upload_file", () => ({ getPublicUrlWithoutLogin: () => Promise.resolve("") }));

const { LearningPathComponent } = await import("./LearningPathComponent");
const { SiteCartButton } = await import("../site-cart/SiteCartButton");

// ─── fixtures ───────────────────────────────────────────────────────────────
const INSTITUTE = "inst-1";
const CODE = "PATH1";

const mapping = (pkg: string, ps: string, level: string, price: number, order: number) => ({
  id: `m-${ps}`,
  ps_invite_payment_option_id: `b-${ps}`,
  package_session_id: ps,
  package_id: pkg,
  package_name: `Course ${pkg.toUpperCase()}`,
  level_name: level,
  session_name: "default",
  status: "ACTIVE",
  display_order: order,
  payment_plan: { actual_price: price, elevated_price: price, currency: "INR" },
});

const page = {
  id: "page-1",
  code: CODE,
  name: "Shiksha basics",
  mappings: [
    // Server order is not display order: the select sorts it.
    mapping("c2", "c2-hi", "Hindi", 300, 2),
    mapping("c1", "c1-en", "English", 500, 0),
    mapping("c1", "c1-hi", "Hindi", 400, 1),
  ],
};

const render = (props: Record<string, unknown>) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["PRODUCT_PAGE_BY_CODE", CODE, INSTITUTE], page);
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(LearningPathComponent, { instituteId: INSTITUTE, tagName: "site", ...props }),
    ),
  );
};

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const grouped = { courseLanguages: { enabled: true } };

describe("learningPath (single)", () => {
  it("shows the courses as numbered steps in display order, one step per course", () => {
    const lines = text(render({ productPageCode: CODE, globalSettings: grouped }));
    expect(lines).toContain("Shiksha basics");
    const c1 = lines.indexOf("Course C1");
    const c2 = lines.indexOf("Course C2");
    expect(c1).toBeGreaterThan(-1);
    expect(c2).toBeGreaterThan(c1);
    expect(lines.filter((l) => l === "Course C1")).toHaveLength(1);
    // The two-version course offers both language chips.
    expect(lines).toContain("EN");
    expect(lines).toContain("हिं");
    expect(lines).toContain("2 courses");
  });

  it("without a site cart, enrols through the path's product page with every course", () => {
    const html = render({ productPageCode: CODE, globalSettings: grouped });
    expect(html).toContain("Enrol in this path");
    expect(html).toContain("/product-pages/PATH1?instituteId=inst-1&amp;tagName=site&amp;courseIds=c1-en%2Cc2-hi&amp;defaultTab=CART");
    expect(html).not.toContain("Add whole path to cart");
  });

  it("with a site cart, offers to add the whole path to it", () => {
    const html = render({
      productPageCode: CODE,
      addAllLabel: "",
      globalSettings: { ...grouped, siteCart: { enabled: true, storeProductPageCode: "STORE" } },
    });
    expect(html).toContain("Add whole path to cart");
    expect(html).not.toContain("Enrol in this path");
  });

  it("keeps one step per version when the site does not group versions", () => {
    const lines = text(render({ productPageCode: CODE, globalSettings: {} }));
    expect(lines.filter((l) => l === "Course C1")).toHaveLength(2);
    expect(lines).toContain("3 courses");
  });

  it("renders nothing for visitors until configured, and a hint in the builder preview", () => {
    expect(render({ productPageCode: "" })).toBe("");
    expect(render({ productPageCode: "", isPreviewMode: true })).toContain("Pick the product page");
  });
});

describe("SiteCartButton", () => {
  const button = (props: Record<string, unknown>) =>
    renderToStaticMarkup(
      React.createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        React.createElement(SiteCartButton, { instituteId: INSTITUTE, tagName: "site", ...props }),
      ),
    );

  it("renders nothing on a site without a site cart", () => {
    expect(button({})).toBe("");
    expect(button({ settings: { enabled: true } })).toBe("");
    expect(button({ settings: { enabled: false, storeProductPageCode: "STORE" } })).toBe("");
    expect(button({ instituteId: "", settings: { enabled: true, storeProductPageCode: "STORE" } })).toBe("");
  });

  it("renders the cart icon button when the site has one", () => {
    const html = button({ settings: { enabled: true, storeProductPageCode: "STORE" } });
    expect(html).toContain('aria-label="Open cart"');
    expect(html).toContain('aria-haspopup="dialog"');
  });
});
