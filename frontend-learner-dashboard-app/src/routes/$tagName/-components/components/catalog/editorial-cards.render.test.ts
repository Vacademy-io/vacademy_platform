// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Feature 'cards' in the real Courses grid: the editorial card
 * (render.cardStyle "editorial"), the grid heading (render.gridHeading) and
 * Load more paging (render.pagination.mode "loadMore") — and that a section
 * without them still renders the original card and numbered pages.
 */

const h = vi.hoisted(() => {
  const row = (n: number, extra: Record<string, unknown> = {}) => ({
    id: `c${n}`,
    package_id: `c${n}`,
    package_name: `Course ${n}`,
    package_session_id: `c${n}-ps`,
    enroll_invite_id: `inv-${n}`,
    level_name: n % 3 === 0 ? "Short Film" : "eBook",
    min_plan_actual_price: n % 2 === 0 ? 0 : 100 * n,
    currency: "INR",
    course_html_description_html: `<p>About course ${n}</p>`,
    comma_separeted_tags: n % 2 ? "swasthya,English" : "kala,English",
    created_at: `2026-0${(n % 9) + 1}-01T00:00:00Z`,
    ...extra,
  });
  return {
    row,
    rows: [] as Record<string, unknown>[],
    navigate: [] as unknown[],
    /** react-i18next resources for the mocked t (null = the defaultValue). */
    dict: null as Record<string, unknown> | null,
  };
});

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => (opts: unknown) => {
    h.navigate.push(opts);
    return Promise.resolve();
  },
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
    t: (key: string, opts?: unknown) => {
      const values = typeof opts === "object" && opts ? (opts as Record<string, unknown>) : {};
      const fromDict = h.dict
        ? key.split(".").reduce<unknown>((node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined), h.dict)
        : undefined;
      const text =
        typeof fromDict === "string"
          ? fromDict
          : typeof opts === "string"
            ? opts
            : typeof values.defaultValue === "string"
              ? values.defaultValue
              : key;
      return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
    },
    i18n: { language: "en" },
  }),
}));
vi.mock("@/components/common/layout-container/sidebar/utils", () => ({
  getTerminology: (_term: string, fallback: string) => fallback,
  getTerminologyPlural: (_term: string, fallback: string) => `${fallback}s`,
}));
vi.mock("@/services/upload_file", () => ({ getPublicUrlWithoutLogin: async () => "" }));
vi.mock("@/utils/ios-iap-compliance", () => ({ shouldHidePaidPurchaseUI: () => false }));
vi.mock("@/constants/urls", () => ({ BASE_URL: "", urlCourseDetails: "/courses-search" }));
vi.mock("../../../-services/route-matcher", () => ({ RouteMatcher: { basePath: () => "" } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("axios", () => {
  const api: Record<string, unknown> = {
    post: async () => ({ data: { content: h.rows, totalElements: h.rows.length } }),
    get: async () => ({ data: {} }),
  };
  api.create = () => api;
  return { default: api };
});

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CourseCatalogComponent } from "../CourseCatalogComponent";

const e = React.createElement;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const LIBRARY = "lib-bv";
const TREE = {
  library: { id: LIBRARY, name: "Streams" },
  roots: [
    {
      id: "s1",
      node_type: "FOLDER",
      title: "स्वास्थ्य",
      subtitle: "Health | Ayurveda",
      slug: "swasthya",
      image_url: "https://cdn.example.com/swasthya.png",
      children: [],
    },
    { id: "s2", node_type: "FOLDER", title: "कला", subtitle: "Skills | Craft", slug: "kala", children: [] },
  ],
};

const GLOBAL = {
  courseLanguages: { enabled: true },
  courseFormats: {
    ebook: { label: "E-books", levels: ["eBook"] },
    animation: { label: "Short film / Animation", levels: ["Short Film"] },
  },
};

const EDITORIAL = {
  defaultSort: "Popular",
  streams: { enabled: true, source: "folderLibrary", libraryId: LIBRARY, labelMode: "subtitle" },
  syncUrl: false,
  groupLanguageVersions: true,
  quickFilters: [{ id: "free", label: "", kind: "free" }],
  render: {
    layout: "grid",
    cardFields: [],
    cardStyle: "editorial",
    card: {
      formatLabels: { ebook: "E-book", animation: "Animation" },
      freeCtaByFormat: { animation: "watch", ebook: "read" },
    },
    pagination: { mode: "loadMore", pageSize: 9 },
    gridHeading: { title: "All courses" },
  },
};

let root: Root | null = null;
let host: HTMLDivElement;

const mount = async (props: Record<string, unknown>, globalSettings: Record<string, unknown> = GLOBAL) => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  qc.setQueryData(["FOLDER_LIBRARY_PUBLIC", "inst-1", LIBRARY], TREE);
  await act(async () => {
    root!.render(
      e(
        QueryClientProvider,
        { client: qc },
        e(CourseCatalogComponent, {
          title: "",
          showFilters: false,
          render: { layout: "grid", cardFields: [] },
          instituteId: "inst-1",
          tagName: "site",
          globalSettings,
          ...props,
        } as unknown as React.ComponentProps<typeof CourseCatalogComponent>),
      ),
    );
  });
  await act(tick);
  await act(tick);
};

const cards = () => [...host.querySelectorAll<HTMLElement>("[data-editorial-card]")];
const byText = (selector: string, text: string) =>
  [...host.querySelectorAll<HTMLElement>(selector)].find((el) => el.textContent?.trim() === text);
const click = async (el: HTMLElement | undefined) => {
  expect(el).toBeTruthy();
  await act(async () => el!.click());
  await act(tick);
};

const scrollSpy = vi.fn();
beforeEach(() => {
  h.rows = Array.from({ length: 24 }, (_, i) => h.row(i + 1));
  h.navigate = [];
  h.dict = null;
  scrollSpy.mockReset();
  Element.prototype.scrollIntoView = scrollSpy;
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("editorial cards + heading + load more (opt-in)", () => {
  it("renders 9 editorial cards with the Figma anatomy and no cart buttons", async () => {
    await mount(EDITORIAL);
    expect(cards()).toHaveLength(9);
    expect(host.querySelector(".catalogue-btn")).toBeNull();
    expect(host.textContent).not.toContain("Add to cart");

    const first = cards()[0];
    // c1: paid e-book in the swasthya stream.
    expect(first.querySelector("h3")?.textContent).toBe("Course 1");
    expect(first.textContent).toContain("Health | Ayurveda");
    expect(first.querySelector("img[src='https://cdn.example.com/swasthya.png']")).toBeTruthy();
    expect(first.textContent).toContain("E-book");
    expect(first.textContent).toContain("About course 1");
    expect(first.textContent).toContain("₹100");
    expect(first.querySelector("[data-card-cta]")?.textContent).toBe("View course→");
    expect(byText("[data-editorial-card] span[aria-hidden]", "English")?.className).toContain("font-bold");

    // c2: free e-book → Free pill + Free price + Read free.
    const second = cards()[1];
    expect([...second.querySelectorAll("span")].filter((s) => s.textContent === "Free")).toHaveLength(2);
    expect(second.querySelector("[data-card-cta]")?.textContent).toBe("Read free→");
    // c6: free short film → Watch free + Animation pill.
    const sixth = cards()[5];
    expect(sixth.textContent).toContain("Animation");
    expect(sixth.querySelector("[data-card-cta]")?.textContent).toBe("Watch free→");
  });

  it("heading follows the sort; Load more reveals 9 at a time without scrolling, then hides", async () => {
    await mount(EDITORIAL);
    const heading = host.querySelector("[data-grid-heading]");
    expect(heading?.querySelector("h2")?.textContent).toBe("All courses");
    expect(heading?.textContent).toContain("Sorted by most popular");
    expect(host.textContent).toContain("Showing 9 of 24");
    expect(host.querySelector("nav[aria-label]")).toBeNull();

    scrollSpy.mockReset();
    await click(byText("button", "Load more courses"));
    expect(cards()).toHaveLength(18);
    expect(host.textContent).toContain("Showing 18 of 24");
    expect(document.activeElement).toBe(cards()[9].querySelector("[data-card-cta]"));
    await click(byText("button", "Load more courses"));
    expect(cards()).toHaveLength(24);
    expect(host.textContent).toContain("Showing 24 of 24");
    expect(byText("button", "Load more courses")).toBeUndefined();
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("a filter change starts again from the first batch", async () => {
    await mount(EDITORIAL);
    await click(byText("button", "Load more courses"));
    expect(cards()).toHaveLength(18);
    await click(host.querySelector<HTMLElement>("button[aria-pressed]")!);
    expect(cards()).toHaveLength(9);
    expect(host.textContent).toContain("Showing 9 of 12");
  });

  it("the card and its CTA open the course; a coming-soon CTA opens the notify form", async () => {
    h.rows = [h.row(1), h.row(3, { coming_soon: { enabled: true, audience_id: "aud-1", button_text: "Notify me" } })];
    await mount(EDITORIAL);
    await click(cards()[0]);
    await click(cards()[0].querySelector<HTMLElement>("[data-card-cta]")!);
    expect(h.navigate).toHaveLength(2);
    const events: unknown[] = [];
    const onForm = (ev: Event) => events.push((ev as CustomEvent).detail);
    window.addEventListener("openAudienceForm", onForm);
    const soon = cards()[1];
    expect(soon.textContent).not.toContain("Animation");
    expect(soon.querySelector("[data-card-cta]")?.textContent).toBe("Notify me→");
    await click(soon.querySelector<HTMLElement>("[data-card-cta]")!);
    window.removeEventListener("openAudienceForm", onForm);
    expect(events).toHaveLength(1);
    expect((events[0] as { audienceId: string }).audienceId).toBe("aud-1");
    expect(h.navigate).toHaveLength(2);
  });

  it("one card per authored EN + HI pair (globalSettings.courseLanguages.versionGroups)", async () => {
    h.rows = [
      h.row(1, { package_name: "Vedic Parenting - eBook", comma_separeted_tags: "swasthya,English" }),
      h.row(2, { package_name: "वैदिक पेरेंटिंग - ई पुस्तक", comma_separeted_tags: "swasthya,Hindi" }),
      h.row(5),
    ];
    await mount(EDITORIAL, { ...GLOBAL, courseLanguages: { enabled: true, versionGroups: [["c1", "c2"]] } });
    expect(cards()).toHaveLength(2);
    const merged = cards()[0];
    expect(merged.querySelector("h3")?.textContent).toBe("Vedic Parenting - eBook");
    expect(byText("[data-editorial-card] span[aria-hidden]", "Hindi")?.className).toContain("font-normal");
    expect(merged.textContent).toContain("English");
    expect(merged.textContent).toContain("Hindi");
    expect(merged.textContent).toContain("₹100");
    expect(host.textContent).toContain("Showing 2 of 2");
  });

  it("Hindi UI strings come from the hi locale file", async () => {
    h.dict = JSON.parse(readFileSync(resolve(process.cwd(), "src/locales/hi/coursePlayerB.json"), "utf8"));
    // No authored title: the translated default.
    await mount({ ...EDITORIAL, render: { ...EDITORIAL.render, gridHeading: {} } });
    expect(host.querySelector("[data-grid-heading] h2")?.textContent).toBe("सभी कोर्स");
    expect(host.textContent).toContain("सबसे लोकप्रिय क्रम में");
    expect(byText("button", "और कोर्स देखें")).toBeTruthy();
    expect(host.textContent).toContain("24 में से 9 दिखाए जा रहे हैं");
    expect(cards()[0].querySelector("[data-card-cta]")?.textContent).toBe("कोर्स देखें→");
    expect(cards()[1].querySelector("[data-card-cta]")?.textContent).toBe("मुफ़्त पढ़ें→");
  });

  it("loading: the editorial skeleton grid", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const qc = new QueryClient();
    const html = renderToStaticMarkup(
      e(QueryClientProvider, { client: qc }, e(CourseCatalogComponent, {
        title: "",
        showFilters: false,
        instituteId: "inst-1",
        tagName: "site",
        globalSettings: GLOBAL,
        ...EDITORIAL,
      } as unknown as React.ComponentProps<typeof CourseCatalogComponent>)),
    );
    expect(html.match(/aspect-\[264\/150\]/g)).toHaveLength(9);
  });

  it("each opt-in works alone: heading only / load more only keep the original card", async () => {
    await mount({ render: { layout: "grid", cardFields: [], gridHeading: { showSort: false } } });
    expect(cards()).toHaveLength(0);
    expect(host.querySelector("[data-grid-heading]")?.textContent).toBe("All courses");
    expect(host.querySelectorAll(".catalogue-btn-primary").length).toBe(12);
    act(() => root?.unmount());
    document.body.innerHTML = "";
    await mount({ render: { layout: "grid", cardFields: [], pagination: { mode: "loadMore", pageSize: 5 } } });
    expect(cards()).toHaveLength(0);
    expect(host.querySelectorAll(".catalogue-btn-primary").length).toBe(5);
    expect(host.textContent).toContain("Showing 5 of 24");
  });
});

describe("a section without the props renders as before", () => {
  it("original card, numbered pages, no heading", async () => {
    await mount({ render: { layout: "grid", cardFields: [] } });
    expect(cards()).toHaveLength(0);
    expect(host.querySelector("[data-grid-heading]")).toBeNull();
    expect(host.querySelector("[data-load-more]")).toBeNull();
    expect(host.querySelectorAll(".catalogue-btn-primary").length).toBe(12);
    expect(host.querySelector("nav[aria-label]")).toBeTruthy();
    // The original count line (its i18n key: the mocked t has no default for it).
    expect(host.textContent).toContain("courseCatalog.showingRange");
    expect(host.textContent).not.toContain("Showing");
  });
});
