// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ── mocks: network, router, and the heavy children of the page ───────── */

// Vite `define` globals the app reads at runtime.
vi.hoisted(() => {
  (globalThis as Record<string, unknown>).__MAC_APP_STORE__ = false;
});

const net = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("axios", () => {
  const instance = () => ({
    get: net.get,
    post: net.post,
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn(), eject: vi.fn() }, response: { use: vi.fn(), eject: vi.fn() } },
    defaults: { headers: { common: {} } },
  });
  return { default: { ...instance(), create: instance, isAxiosError: () => false } };
});

vi.mock("@/constants/urls", () => ({
  BASE_URL: "https://api.test",
  ENROLLMENT_INVITE_URL: "https://api.test/admin-core-service/open/learner/enroll-invite",
  urlCourseDetails: "https://api.test/admin-core-service/open/packages/v2/search",
  GET_PRODUCT_PAGE_BY_CODE: (code: string, instituteId: string) =>
    `https://api.test/by-code?code=${code}&instituteId=${instituteId}`,
}));

const router = vi.hoisted(() => ({
  location: { pathname: "/site/pkg", searchStr: "", hash: "" },
  replace: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => router.navigate,
  useRouter: () => ({ state: { location: router.location }, history: { replace: router.replace, push: vi.fn() } }),
  useLocation: () => router.location,
  useParams: () => ({}),
  useSearch: () => ({}),
  Link: () => null,
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, opts?: string | { defaultValue?: string }) =>
      typeof opts === "string" ? opts : (opts?.defaultValue ?? key),
    i18n: { language: "en" },
  }),
}));

const catalogue = vi.hoisted(() => ({ data: null as unknown }));
vi.mock("../../-services/course-catalogue-service", () => ({
  CourseCatalogueService: { getCourseCatalogueByTag: vi.fn(async () => catalogue.data) },
}));
vi.mock("@/hooks/use-domain-routing", () => ({ useDomainRouting: () => ({ instituteId: "inst", isLoading: false }) }));
vi.mock("../../-utils/institute-naming-seed", () => ({ useInstituteNamingSettings: () => true }));
vi.mock("@/services/upload_file", () => ({ getPublicUrlWithoutLogin: vi.fn(async () => "") }));
vi.mock("@/components/core/dashboard-loader", () => ({ DashboardLoader: () => null }));

const children = vi.hoisted(() => ({ dialog: null as Record<string, unknown> | null }));
vi.mock("../../-components/JsonRenderer", async () => {
  const React = await import("react");
  return {
    JsonRenderer: ({ page, courseData }: { page: { id: string }; courseData?: { title?: string } }) =>
      React.createElement("div", { "data-json": page.id }, courseData?.title ?? ""),
  };
});
vi.mock("../../-components/components/HtmlPageSection", () => ({ OPEN_COURSE_ENROLLMENT_EVENT: "openCourseEnrollment" }));
vi.mock("../../-components/EnrollmentPaymentDialog", () => ({
  EnrollmentPaymentDialog: (props: Record<string, unknown>) => {
    children.dialog = props;
    return null;
  },
}));
vi.mock("../../-components/LeadCollectionModal", () => ({ LeadCollectionModal: () => null }));
vi.mock("../../-components/AudienceFormModal", () => ({ AudienceFormModal: () => null }));
vi.mock("../../-components/CourseStructureDetails", () => ({ CourseStructureDetails: () => null }));
vi.mock("@/components/common/enroll-by-invite/-components/InviteUnavailableMessage", () => ({
  InviteUnavailableMessage: () => null,
}));

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CourseDetailsPage } from "./CourseDetailsPage";
import { useSiteCartStore } from "../../-stores/site-cart-store";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const memoryStorage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => memoryStorage.get(k) ?? null,
    setItem: (k: string, v: string) => void memoryStorage.set(k, String(v)),
    removeItem: (k: string) => void memoryStorage.delete(k),
    clear: () => memoryStorage.clear(),
  },
});

/* ── fixtures ─────────────────────────────────────────────────────────── */

const courseInit = (courseId: string) => [
  {
    course: { id: courseId, package_name: "Yoga", is_course_published_to_catalaouge: true },
    sessions: [
      {
        session_dto: { id: "ses", session_name: "2026" },
        level_with_details: [
          { id: "lvl-en", name: "English", read_time_in_minutes: 90, instructors: [] },
          { id: "lvl-hi", name: "Hindi", read_time_in_minutes: 120, instructors: [] },
        ],
      },
    ],
    package_sessions: [
      { id: `${courseId}-en`, level: { id: "lvl-en", level_name: "English" }, session: { id: "ses" } },
      { id: `${courseId}-hi`, level: { id: "lvl-hi", level_name: "Hindi" }, session: { id: "ses" } },
    ],
  },
];

const searchRows = (courseId: string) => [
  { id: courseId, package_session_id: `${courseId}-en`, level_id: "lvl-en", level_name: "English", session_id: "ses", enroll_invite_id: `${courseId}-inv-en`, min_plan_actual_price: 999, currency: "INR" },
  { id: courseId, package_session_id: `${courseId}-hi`, level_id: "lvl-hi", level_name: "Hindi", session_id: "ses", enroll_invite_id: `${courseId}-inv-hi`, min_plan_actual_price: 499, currency: "INR" },
  { id: "another-course", package_session_id: "zz", level_name: "English", enroll_invite_id: "zz-inv" },
];

const invite = (id: string, psId: string, price: number) => ({
  id,
  availability_status: "AVAILABLE",
  package_session_to_payment_options: [
    { package_session_id: psId, payment_option: { id: `po-${id}`, payment_plans: [{ actual_price: price, currency: "INR" }] } },
  ],
});

const settings = (extra: Record<string, unknown> = {}) => ({
  globalSettings: {
    courseCatalogeType: { enabled: false, value: "" },
    mode: "light",
    payment: { enabled: true, provider: "razorpay", fields: [] },
    leadCollection: { enabled: false },
    ...extra,
  },
  pages: [{ id: "details", route: "course-details", components: [{ id: "hero", type: "heroSection", props: {} }] }],
});

const routeNetwork = (courseId: string, invites: Record<string, unknown>, mappings: unknown[] = []) => {
  net.get.mockImplementation(async (url: string) => {
    if (url.includes("course-init")) return { data: courseInit(courseId) };
    if (url.includes("student-display")) return { data: { courseDetails: {} } };
    if (url.includes("by-code")) return { data: { mappings } };
    const inviteId = url.split("/").pop() as string;
    if (invites[inviteId]) return { data: invites[inviteId] };
    throw new Error(`unexpected GET ${url}`);
  });
  net.post.mockImplementation(async () => ({ data: { content: searchRows(courseId) } }));
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

const settle = async () => {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

const renderPage = async (props: Record<string, unknown>) => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      React.createElement(CourseDetailsPage, { tagName: "site", instituteId: "inst", ...(props as { courseId: string }) }),
    ),
  );
  await settle();
  return host;
};

const radios = () => Array.from(host!.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
const buttonByText = (text: string) =>
  Array.from(host!.querySelectorAll<HTMLButtonElement>("button")).filter((b) => b.textContent?.trim() === text);

beforeEach(() => {
  net.get.mockReset();
  net.post.mockReset();
  router.replace.mockReset();
  router.navigate.mockReset();
  router.location = { pathname: "/site/pkg", searchStr: "", hash: "" };
  children.dialog = null;
  memoryStorage.clear();
  useSiteCartStore.setState({ instituteId: null, items: [], hydrated: false, lastAddedAt: 0 });
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

/* ── tests ────────────────────────────────────────────────────────────── */

describe("CourseDetailsPage — a site without the new settings", () => {
  it("makes the same requests and renders the same enrol flow as before", async () => {
    const c = "c-plain";
    routeNetwork(c, { [`${c}-inv-en`]: invite(`${c}-inv-en`, `${c}-en`, 999) });
    catalogue.data = settings();
    await renderPage({ courseId: c, packageSessionId: `${c}-en`, enrollInviteId: `${c}-inv-en`, level: "English" });

    expect(net.post).not.toHaveBeenCalled(); // no catalogue search
    // Exactly the three reads the page always made: course-init, the student
    // display settings and the link's invite — nothing new, nothing twice.
    expect(net.get.mock.calls.map(([u]) => String(u).split("?")[0]).sort()).toEqual([
      "https://api.test/admin-core-service/open/institute/setting/v1/student-display",
      `https://api.test/admin-core-service/open/learner/enroll-invite/inst/${c}-inv-en`,
      "https://api.test/admin-core-service/open/v1/learner-study-library/course-init",
    ]);
    expect(radios()).toHaveLength(0); // no Language picker
    expect(host!.textContent).toContain("English"); // the Level row is still there
    expect(buttonByText("Add to cart")).toHaveLength(0);

    act(() => buttonByText("courseDetails.enrollNow")[0].click());
    expect(children.dialog).toMatchObject({
      open: true,
      courseData: expect.objectContaining({ packageSessionId: `${c}-en`, enrollInviteId: `${c}-inv-en`, price: 999 }),
    });
  });
});

describe("CourseDetailsPage — language versions", () => {
  it("shows the picker, switches version, writes the URL and enrols in the picked version", async () => {
    const c = "c-lang";
    routeNetwork(c, {
      [`${c}-inv-en`]: invite(`${c}-inv-en`, `${c}-en`, 999),
      [`${c}-inv-hi`]: invite(`${c}-inv-hi`, `${c}-hi`, 449),
    });
    catalogue.data = settings({ courseLanguages: { enabled: true } });
    router.location = { pathname: `/site/${c}`, searchStr: `?packageSessionId=${c}-en&enrollInviteId=${c}-inv-en&utm_source=x`, hash: "" };
    await renderPage({ courseId: c, packageSessionId: `${c}-en`, enrollInviteId: `${c}-inv-en`, level: "English" });

    expect(net.post.mock.calls[0][1].package_ids).toEqual([c]);
    // Desktop + mobile cards each carry the picker.
    expect(radios().map((r) => r.textContent)).toEqual(["ENEnglish", "हिंHindi", "ENEnglish", "हिंHindi"]);
    expect(radios()[0].getAttribute("aria-checked")).toBe("true");

    act(() => radios()[1].click());
    await settle();

    const href = router.replace.mock.calls.at(-1)?.[0] as string;
    const params = new URLSearchParams(href.split("?")[1]);
    expect(href.startsWith(`/site/${c}?`)).toBe(true);
    expect(params.get("packageSessionId")).toBe(`${c}-hi`);
    expect(params.get("enrollInviteId")).toBe(`${c}-inv-hi`);
    expect(params.get("level")).toBe("Hindi");
    expect(params.get("utm_source")).toBe("x"); // other params survive
    expect(radios()[1].getAttribute("aria-checked")).toBe("true");

    act(() => buttonByText("courseDetails.enrollNow")[0].click());
    expect(children.dialog).toMatchObject({
      courseData: expect.objectContaining({ packageSessionId: `${c}-hi`, enrollInviteId: `${c}-inv-hi`, price: 449 }),
    });
  });

  it("hands the picked version to the product page on a product page visit", async () => {
    const c = "c-path";
    const mappings = [
      { package_id: c, package_session_id: `${c}-en`, enroll_invite_id: "pp-en", level_name: "English", status: "ACTIVE", display_order: 1, payment_plan: { actual_price: 600, currency: "INR" } },
      { package_id: c, package_session_id: `${c}-hi`, enroll_invite_id: "pp-hi", level_name: "Hindi", status: "ACTIVE", display_order: 2, payment_plan: { actual_price: 500, currency: "INR" } },
    ];
    routeNetwork(c, { "pp-en": invite("pp-en", `${c}-en`, 1), "pp-hi": invite("pp-hi", `${c}-hi`, 1) }, mappings);
    catalogue.data = settings({ courseLanguages: { enabled: true }, siteCart: { enabled: true, storeProductPageCode: "STORE" } });
    await renderPage({ courseId: c, packageSessionId: `${c}-en`, enrollInviteId: "pp-en", productPageCode: "PATH", price: "600" });

    expect(net.post).not.toHaveBeenCalled(); // the product page's own mappings, not the catalogue
    expect(buttonByText("Add to cart")).toHaveLength(0); // its own checkout, not the site cart
    act(() => radios()[1].click());
    await settle();
    expect(host!.textContent).toContain("500"); // that page's price for the Hindi version

    act(() => buttonByText("courseDetails.enrollNow")[0].click());
    expect(router.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/product-pages/$productPageCode",
        params: { productPageCode: "PATH" },
        search: expect.objectContaining({ courseIds: `${c}-hi`, defaultTab: "CART" }),
      }),
    );
  });
});

describe("CourseDetailsPage — site cart", () => {
  it("adds the version to the site cart, then offers In cart and Buy now", async () => {
    const c = "c-cart";
    routeNetwork(c, {
      [`${c}-inv-en`]: invite(`${c}-inv-en`, `${c}-en`, 999),
      [`${c}-inv-hi`]: invite(`${c}-inv-hi`, `${c}-hi`, 449),
    });
    catalogue.data = settings({ siteCart: { enabled: true, storeProductPageCode: "STORE" } });
    const opened: unknown[] = [];
    const onOpen = (e: Event) => opened.push((e as CustomEvent).detail);
    window.addEventListener("siteCartOpen", onOpen);

    // A bare link: the first version with an invite is the one on screen.
    await renderPage({ courseId: c });

    const add = buttonByText("Add to cart");
    expect(add.length).toBeGreaterThan(0);
    expect(add[0].disabled).toBe(false);
    act(() => add[0].click());
    expect(useSiteCartStore.getState().items).toEqual([
      expect.objectContaining({ packageSessionId: `${c}-en`, courseId: c, title: "Yoga", levelName: "English", languageCode: "en", enrollInviteId: `${c}-inv-en` }),
    ]);
    expect(buttonByText("In cart").length).toBeGreaterThan(0);

    act(() => buttonByText("Buy now")[0].click());
    expect(opened).toEqual([{ intent: "checkout", packageSessionId: `${c}-en`, source: "course" }]);
    expect(useSiteCartStore.getState().items).toHaveLength(1);
    window.removeEventListener("siteCartOpen", onOpen);
  });
});

describe("CourseDetailsPage — site languages", () => {
  it("shows live course text in the visitor's language but submits the base values", async () => {
    const c = "c-i18n";
    routeNetwork(c, { [`${c}-inv-en`]: invite(`${c}-inv-en`, `${c}-en`, 999) });
    catalogue.data = settings({
      i18n: { enabled: true, defaultLocale: "en", locales: [{ code: "en", label: "EN" }, { code: "hi", label: "हिन्दी" }], strings: { hi: { Yoga: "योग" } } },
    });
    router.location = { pathname: `/site/${c}`, searchStr: "?lang=hi", hash: "" };
    await renderPage({ courseId: c, packageSessionId: `${c}-en`, enrollInviteId: `${c}-inv-en` });

    expect(host!.querySelector('[data-json="details"]')?.textContent).toBe("योग");
    expect(children.dialog).toMatchObject({ courseData: expect.objectContaining({ title: "Yoga" }) });
  });
});
