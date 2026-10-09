// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Courses grid's card CTA on a site with the site cart, rendered. The cart
 * checks out through the store page, so a card offers "Add to cart" only for
 * the versions the store sells; any other card keeps its own CTA to the course
 * page, as on a site without a site cart.
 */

const h = vi.hoisted(() => ({
  rows: [
    // The store sells A. It skipped B (a paid course its sync left out), and C is free.
    { id: "a", package_name: "Course A", package_session_id: "a-1", level_name: "Beginner", min_plan_actual_price: 300 },
    { id: "b", package_name: "Course B", package_session_id: "b-1", level_name: "Beginner", min_plan_actual_price: 200 },
    { id: "c", package_name: "Course C", package_session_id: "c-1", level_name: "Beginner", min_plan_actual_price: 0 },
  ],
  /** Answers a GET of the store page. */
  store: (async () => ({ data: { mappings: [{ package_session_id: "a-1", status: "ACTIVE" }] } })) as (
    url: string,
  ) => Promise<unknown>,
  gets: [] as string[],
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => Promise.resolve(),
  useRouter: () => ({
    navigate: () => Promise.resolve(),
    latestLocation: { search: {} },
    history: { push: () => {}, replace: () => {}, location: { href: "/courses" } },
  }),
  useLocation: (opts?: { select?: (location: unknown) => unknown }) => {
    const location = { pathname: "/courses", searchStr: "", search: {}, hash: "", href: "/courses" };
    return opts?.select ? opts.select(location) : location;
  },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) =>
      typeof opts === "string"
        ? opts
        : typeof (opts as { defaultValue?: unknown } | undefined)?.defaultValue === "string"
          ? (opts as { defaultValue: string }).defaultValue
          : key,
    i18n: { language: "en" },
  }),
}));
vi.mock("@/components/common/layout-container/sidebar/utils", () => ({
  getTerminology: (_term: string, fallback: string) => fallback,
  getTerminologyPlural: (_term: string, fallback: string) => `${fallback}s`,
}));
vi.mock("@/services/upload_file", () => ({ getPublicUrlWithoutLogin: async () => "" }));
vi.mock("@/utils/ios-iap-compliance", () => ({ shouldHidePaidPurchaseUI: () => false }));
vi.mock("../../-services/route-matcher", () => ({ RouteMatcher: { basePath: () => "" } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("axios", () => {
  const api: Record<string, unknown> = {
    post: async () => ({ data: { content: h.rows, totalElements: h.rows.length } }),
    get: async (url: string) => {
      h.gets.push(url);
      return url.includes("by-code?code=STORE") ? h.store(url) : { data: {} };
    },
  };
  api.create = () => api;
  return { default: api };
});

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CourseCatalogComponent } from "./CourseCatalogComponent";
import { useSiteCartStore } from "../../-stores/site-cart-store";

const e = React.createElement;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const SITE_CART = { siteCart: { enabled: true, storeProductPageCode: "STORE" }, payment: { enabled: true } };

const mount = async (globalSettings: Record<string, unknown>) => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  // No delay before the store page's one retry (useStoreSale), so a failing read settles here.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  const section = e(CourseCatalogComponent, {
    title: "Courses",
    showFilters: false,
    render: { layout: "grid", cardFields: [] },
    instituteId: "inst-1",
    tagName: "site",
    globalSettings,
  } as unknown as React.ComponentProps<typeof CourseCatalogComponent>);
  await act(async () => {
    root!.render(e(QueryClientProvider, { client }, section));
  });
  await act(tick);
  await act(tick);
  return host;
};

/** A card's buttons by what they say (their label, else their text). */
const cardButtons = (host: HTMLElement, title: string) => {
  const heading = [...host.querySelectorAll("h3.font-bold")].find((t) => t.textContent === title);
  const card = heading?.closest(".cursor-pointer");
  expect(card, `card ${title}`).toBeTruthy();
  return [...card!.querySelectorAll("button")].map((b) => ({
    text: b.getAttribute("aria-label") || b.textContent?.trim() || "",
    disabled: b.disabled,
    busy: b.getAttribute("aria-busy") === "true",
    primary: b.className.includes("catalogue-btn-primary"),
    el: b,
  }));
};
const texts = (buttons: ReturnType<typeof cardButtons>) => buttons.map((b) => b.text);
const storeReads = () => h.gets.filter((url: string) => url.includes("by-code"));

beforeEach(() => {
  h.gets = [];
  h.store = async () => ({ data: { mappings: [{ package_session_id: "a-1", status: "ACTIVE" }] } });
  // The stored cart has loaded (the catalogue hydrates it on a real page).
  useSiteCartStore.setState({ instituteId: "inst-1", items: [], hydrated: true, lastAddedAt: 0 });
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("Courses cards on a site with the site cart", () => {
  it("offers Add to cart only for a course the store sells; the others keep their own CTA", async () => {
    const host = await mount(SITE_CART);

    expect(texts(cardButtons(host, "Course A"))).toEqual(["Add to cart", "courseCatalog.viewCourse"]);
    // A paid course the store does not sell, and a free one: the course page, as without a site cart.
    for (const title of ["Course B", "Course C"]) {
      const [only, ...rest] = cardButtons(host, title);
      expect(rest).toEqual([]);
      expect(only.text).toBe("courseCatalog.viewCourse");
      expect(only.primary).toBe(true);
    }

    act(() => cardButtons(host, "Course A")[0].el.click());
    expect(useSiteCartStore.getState().items).toEqual([
      expect.objectContaining({ packageSessionId: "a-1", courseId: "a", price: 300 }),
    ]);
    expect(storeReads()).toHaveLength(1);
  });

  it("offers nothing to press on a course it could sell until the store page is known", async () => {
    let release: (value: unknown) => void = () => {};
    h.store = () => new Promise((resolve) => (release = resolve));
    const host = await mount(SITE_CART);

    for (const title of ["Course A", "Course B"]) {
      const [waiting, view] = cardButtons(host, title);
      expect(waiting).toMatchObject({ text: "Checking availability…", disabled: true, busy: true });
      expect(view.text).toBe("courseCatalog.viewCourse");
    }
    // A free course never waits for the store.
    expect(texts(cardButtons(host, "Course C"))).toEqual(["courseCatalog.viewCourse"]);
    expect(host.textContent).not.toContain("Add to cart");

    await act(async () => {
      release({ data: { mappings: [{ package_session_id: "a-1", status: "ACTIVE" }] } });
      await tick();
    });
    expect(texts(cardButtons(host, "Course A"))).toEqual(["Add to cart", "courseCatalog.viewCourse"]);
    expect(texts(cardButtons(host, "Course B"))).toEqual(["courseCatalog.viewCourse"]);
  });

  it("keeps every card's own CTA when the store page cannot be read", async () => {
    h.store = async () => {
      throw new Error("store page down");
    };
    const host = await mount(SITE_CART);
    await act(tick);

    for (const title of ["Course A", "Course B", "Course C"]) {
      expect(texts(cardButtons(host, title))).toEqual(["courseCatalog.viewCourse"]);
    }
    expect(host.textContent).not.toContain("Add to cart");
    expect(storeReads().length).toBeGreaterThan(0);
  });
});

describe("Courses cards on a site without the site cart", () => {
  it("reads no store page and keeps the card CTA as it was", async () => {
    const host = await mount({ payment: { enabled: true } });

    expect(storeReads()).toEqual([]);
    // The catalogue's own cart control beside "View course" on a paid course, as before.
    for (const title of ["Course A", "Course B"]) {
      expect(texts(cardButtons(host, title))).toEqual(["courseCatalog.add", "courseCatalog.viewCourse"]);
    }
    expect(texts(cardButtons(host, "Course C"))).toEqual(["courseCatalog.viewCourse"]);
    expect(host.textContent).not.toContain("Add to cart");
    expect(host.querySelector('[aria-label="Checking availability…"]')).toBeNull();
  });

  it("reads no store page when payments are off, even with a site cart configured", async () => {
    await mount({ ...SITE_CART, payment: { enabled: false } });
    expect(storeReads()).toEqual([]);
  });
});
