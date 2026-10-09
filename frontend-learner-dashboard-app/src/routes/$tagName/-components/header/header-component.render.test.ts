// @vitest-environment jsdom
/**
 * The site header, rendered for real (React DOM in jsdom; no JSX so the
 * project's *.test.ts pattern picks it up). Pins that a header without the
 * new props keeps its exact classes and behaviour, that logic reads the
 * authored values (baseProps), and the mega menu / search / language switch
 * interactions.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  history: { push: vi.fn(), replace: vi.fn() },
  location: { pathname: "/new/about", searchStr: "", search: {}, href: "/new/about", hash: "" } as {
    pathname: string;
    searchStr: string;
    search: Record<string, unknown>;
    href: string;
    hash: string;
  },
  fetchTree: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  useLocation: () => mocks.location,
  useRouter: () => ({ history: mocks.history }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, a?: unknown, b?: unknown) => {
      const opts = (typeof a === "object" && a) || (typeof b === "object" && b) || {};
      const o = opts as Record<string, unknown>;
      const text = typeof a === "string" ? a : typeof o.defaultValue === "string" ? o.defaultValue : key;
      return text.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(o[k] ?? ""));
    },
  }),
}));
vi.mock("@/constants/urls", () => ({ BASE_URL: "https://api.test", urlCourseDetails: "https://api.test/v2/search" }));
vi.mock("@/hooks/use-domain-routing", () => ({
  useDomainRouting: () => ({
    instituteId: "inst-1",
    instituteName: "Test Institute",
    instituteLogoFileId: null,
    homeIconClickRoute: null,
  }),
}));
vi.mock("@/services/upload_file", () => ({ getPublicUrlWithoutLogin: vi.fn(async () => null) }));
vi.mock("@/services/domain-routing", () => ({ getCachedRootCatalogueTag: () => null }));
vi.mock("../../-stores/cart-store", () => ({
  useCartStore: () => ({ getItemCountByMode: async () => 0, items: [], syncCart: async () => {} }),
}));
vi.mock("@/hooks/useIsIOS", () => ({ isIOSPlatform: () => false }));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: () => "web" } }));
vi.mock("@/lib/auth/sessionUtility", () => ({ getAccessToken: async () => null, isTokenExpired: () => true }));
vi.mock("@/components/announcements", () => ({ SystemAlertsBar: () => null }));
vi.mock("@/components/common/layout-container/sidebar/logoutSidebar", () => ({ LogoutSidebar: () => null }));
vi.mock("@/components/common/layout-container/sidebar/useSidebar", () => ({
  default: () => ({ setSidebarOpen: vi.fn() }),
}));
vi.mock("@/components/common/auth/modal/AuthModal", () => ({ AuthModal: () => null }));
vi.mock("@/services/student-display-settings", () => ({
  getStudentDisplaySettings: async () => ({ signup: { enabled: true, presentation: "page" } }),
}));
vi.mock(
  "../../-services/folder-library-service",
  async (importOriginal: () => Promise<Record<string, unknown>>) => ({
    ...(await importOriginal()),
    fetchPublicFolderTree: mocks.fetchTree,
  }),
);

import { HeaderComponent } from "../components/HeaderComponent";
import { CatalogueLocaleProvider } from "../../-utils/catalogue-locale";

const h = React.createElement;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CATALOGUE = {
  globalSettings: { courseCatalogeType: { enabled: false, value: "Course" } },
  pages: [
    { id: "home", route: "", title: "Home", components: [] },
    { id: "about", route: "about", title: "About us", components: [] },
    { id: "courses", route: "courses", title: "Courses", components: [] },
  ],
};

const TREE = {
  library: { id: "lib-1", name: "Streams" },
  roots: [
    {
      id: "edu",
      node_type: "FOLDER",
      title: "शिक्षा",
      subtitle: "Education",
      tagline: "Learn the Indian way of learning.",
      description: "Rooted in tradition.",
      children: [
        { id: "vedic", node_type: "FOLDER", title: "वैदिक गणित", subtitle: "Vedic Maths", description: "Speed maths", children: [] },
        { id: "sanskrit", node_type: "FOLDER", title: "Sanskrit", coming_soon: true, audience_id: "aud-1", children: [] },
      ],
    },
    { id: "kala", node_type: "FOLDER", title: "कला", subtitle: "Arts", tagline: "Create with your hands.", children: [] },
  ],
};

const MEGA_ITEM = {
  label: "Knowledge Streams",
  route: "",
  type: "megaMenu" as const,
  megaMenu: {
    libraryId: "lib-1",
    eyebrow: "Six streams of knowledge",
    helpLabel: "Find your path",
    helpRoute: "/find-your-path",
    showLegend: true,
    footnote: "Coming soon subjects: click to be notified.",
  },
};

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
let lastElement: React.ReactElement;

const mount = (el: React.ReactElement) => h(QueryClientProvider, { client }, el);

const render = async (el: React.ReactElement) => {
  lastElement = el;
  container = document.createElement("div");
  container.setAttribute("data-catalogue-theme", "default");
  document.body.appendChild(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(mount(el));
  });
};

// A fresh element, so React re-renders the tree (the same element would bail out).
const rerender = async () => {
  await act(async () => {
    root.render(mount(React.cloneElement(lastElement)));
  });
};

const flush = async (times = 5) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

const header = (props: Record<string, unknown>) =>
  h(HeaderComponent as unknown as React.FC<Record<string, unknown>>, { tagName: "new", catalogueData: CATALOGUE, ...props });

const buttons = (scope: ParentNode = container) => Array.from(scope.querySelectorAll("button"));
const byText = (text: string, scope: ParentNode = container) =>
  buttons(scope).filter((b) => b.textContent?.trim() === text);
const click = async (el: Element) => {
  await act(async () => {
    (el as HTMLElement).click();
  });
};
const key = async (target: EventTarget, k: string) => {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
  });
};
const type = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

beforeEach(() => {
  mocks.location = { pathname: "/new/about", searchStr: "", search: {}, href: "/new/about", hash: "" };
  mocks.fetchTree.mockResolvedValue(TREE);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const NAV_BASE = "px-4 py-2 rounded-catalogue-sm text-sm font-medium transition-colors duration-200";

describe("header without the new props", () => {
  it("keeps its nav and auth button classes", async () => {
    await render(
      header({
        navigation: [
          { label: "Home", route: "" },
          { label: "About", route: "about" },
          { label: "Hidden", route: "x", enabled: false },
        ],
        authLinks: [
          { label: "Login", route: "login" },
          { label: "Get Started", route: "get-started" },
        ],
      }),
    );
    const nav = container.querySelector("nav")!;
    const navButtons = buttons(nav);
    expect(navButtons.map((b) => b.textContent)).toEqual(["Home", "About"]);
    expect(navButtons[1].className).toBe(`${NAV_BASE} text-primary-500 bg-primary-50`);
    expect(navButtons[0].className).toBe(
      `${NAV_BASE} text-catalogue-text-secondary hover:text-catalogue-text-primary hover:bg-catalogue-interactive-hover`,
    );
    expect(byText("Login")[0].className).toBe(`${NAV_BASE} bg-primary-500 text-white hover:bg-primary-400`);
    expect(byText("Get Started")[0].className).toBe(
      `${NAV_BASE} border border-primary-500 text-primary-500 hover:bg-primary-50`,
    );
    // None of the opt-in controls.
    expect(container.querySelector('[aria-haspopup="dialog"]')).toBeNull();
    expect(container.querySelector('[role="group"]')).toBeNull();
    expect(container.querySelector("[aria-controls]")).toBeNull();
    const toggle = container.querySelector('[aria-label="header.toggleMenu"]')!;
    expect(toggle.className).not.toContain("order-last");
  });

  it("keeps the mobile menu's first-filled, rest-text rule", async () => {
    await render(
      header({ authLinks: [{ label: "Login", route: "login" }, { label: "Enquire", route: "contact" }] }),
    );
    await click(container.querySelector('[aria-label="header.toggleMenu"]')!);
    const [, mobileLogin] = byText("Login");
    const [, mobileEnquire] = byText("Enquire");
    expect(mobileLogin.className).toContain("bg-primary-500 text-white hover:bg-primary-400");
    expect(mobileEnquire.className).toMatch(/text-primary-500 hover:bg-primary-50$/);
  });

  it("navigates a plain nav item through the router as before", async () => {
    await render(header({ navigation: [{ label: "Courses", route: "courses" }] }));
    await click(byText("Courses")[0]);
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/new/courses" });
  });
});

describe("authored values decide, translated labels only display", () => {
  it("treats a translated 'Get Started' as the lead-form button", async () => {
    const onLead = vi.fn();
    window.addEventListener("openLeadCollection", onLead);
    await render(
      header({
        authLinks: [{ label: "शुरू करें", route: "apply" }],
        baseProps: { authLinks: [{ label: "Get Started", route: "apply" }] },
      }),
    );
    await click(byText("शुरू करें")[0]);
    expect(onLead).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).not.toHaveBeenCalled();
    window.removeEventListener("openLeadCollection", onLead);
  });

  it("without base props the label is what it is", async () => {
    const onLead = vi.fn();
    window.addEventListener("openLeadCollection", onLead);
    await render(header({ authLinks: [{ label: "शुरू करें", route: "apply" }] }));
    await click(byText("शुरू करें")[0]);
    // A plain page link (wherever the existing page matcher sends it), not the lead form.
    expect(onLead).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledTimes(1);
    window.removeEventListener("openLeadCollection", onLead);
  });

  it("opens a campaign form with the translated title", async () => {
    const onForm = vi.fn();
    window.addEventListener("openAudienceForm", onForm);
    await render(
      header({
        authLinks: [{ label: "पूछताछ", route: "", audienceId: "aud-9", formTitle: "हमसे पूछें" }],
        baseProps: { authLinks: [{ label: "Enquire", route: "", audienceId: "aud-9", formTitle: "Ask us" }] },
      }),
    );
    await click(byText("पूछताछ")[0]);
    expect((onForm.mock.calls[0][0] as CustomEvent).detail).toEqual({ audienceId: "aud-9", title: "हमसे पूछें" });
    window.removeEventListener("openAudienceForm", onForm);
  });
});

describe("button and active styles", () => {
  it("applies per-button styles", async () => {
    await render(
      header({
        authLinks: [
          { label: "Login", route: "login", style: "text" },
          { label: "Become a member", route: "join", style: "primary" },
        ],
      }),
    );
    expect(byText("Login")[0].className).toContain("text-catalogue-text-primary");
    expect(byText("Login")[0].className).not.toContain("bg-primary-500");
    expect(byText("Become a member")[0].className).toContain("bg-primary-500 text-white");
  });

  it("underlines the current page's item", async () => {
    await render(header({ activeStyle: "underline", navigation: [{ label: "About", route: "about" }] }));
    const about = byText("About")[0];
    expect(about.className).toContain("underline");
    expect(about.className).not.toContain("bg-primary-50");
  });
});

describe("mega menu (desktop)", () => {
  const openMenu = async () => {
    await render(header({ instituteId: "inst-1", navigation: [MEGA_ITEM, { label: "About", route: "about" }] }));
    const trigger = container.querySelector("nav [aria-controls]") as HTMLButtonElement;
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await click(trigger);
    await flush();
    return trigger;
  };

  it("opens on click with the tiles, the selected stream's detail and its categories", async () => {
    const trigger = await openMenu();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(mocks.fetchTree).toHaveBeenCalledWith("inst-1", "lib-1");
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!)!;
    expect(panel.getAttribute("role")).toBe("region");
    const text = panel.textContent || "";
    for (const piece of [
      "Six streams of knowledge",
      "Find your path",
      "शिक्षा",
      "Education",
      "Learn the Indian way of learning.",
      "Explore Education",
      "Categories in Education",
      "available",
      "वैदिक गणित",
      "Vedic Maths",
      "Coming soon",
      "Coming soon subjects: click to be notified.",
    ]) {
      expect(text).toContain(piece);
    }
    const cta = Array.from(panel.querySelectorAll("a")).find((a) => a.textContent?.includes("Explore Education"))!;
    expect(cta.getAttribute("href")).toBe("/new/courses?stream=education");
  });

  it("moves between tiles with the arrow keys and updates the detail panel", async () => {
    const trigger = await openMenu();
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!)!;
    const tiles = Array.from(panel.querySelectorAll("ul")[0].querySelectorAll("a, button")) as HTMLElement[];
    expect(tiles.map((t) => t.tabIndex)).toEqual([0, -1]);
    await act(async () => tiles[0].focus());
    await key(tiles[0], "ArrowRight");
    expect(document.activeElement).toBe(tiles[1]);
    expect(tiles.map((t) => t.tabIndex)).toEqual([-1, 0]);
    expect(panel.textContent).toContain("Create with your hands.");
    expect(panel.textContent).toContain("Explore Arts");
  });

  it("follows a category through the router and closes", async () => {
    const trigger = await openMenu();
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!)!;
    const vedic = Array.from(panel.querySelectorAll("a")).find((a) => a.textContent?.includes("Vedic Maths"))!;
    expect(vedic.getAttribute("href")).toBe("/new/courses?stream=education&category=vedic-maths");
    await click(vedic);
    expect(mocks.navigate).toHaveBeenCalledWith({ href: "/new/courses?stream=education&category=vedic-maths" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens the notify form for a coming-soon category", async () => {
    const onForm = vi.fn();
    window.addEventListener("openAudienceForm", onForm);
    const trigger = await openMenu();
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!)!;
    const soon = buttons(panel).find((b) => b.textContent?.includes("Sanskrit"))!;
    await click(soon);
    expect((onForm.mock.calls[0][0] as CustomEvent).detail).toEqual({ audienceId: "aud-1", title: "Sanskrit" });
    window.removeEventListener("openAudienceForm", onForm);
  });

  it("closes on Escape (focus back on the button), outside click and route change", async () => {
    const trigger = await openMenu();
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!)!;
    const firstTile = panel.querySelector("ul a") as HTMLElement;
    await act(async () => firstTile.focus());
    await key(document, "Escape");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);

    await click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await act(async () => {
      document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    mocks.location = { ...mocks.location, pathname: "/new/courses", href: "/new/courses" };
    await rerender();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens on the stream named in ?stream=", async () => {
    // "कला · Arts" has no explicit slug, so its link key comes from its subtitle.
    mocks.location = { ...mocks.location, searchStr: "?stream=arts" };
    const trigger = await openMenu();
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!)!;
    expect(panel.textContent).toContain("Create with your hands.");
  });

  it("does not fetch before the visitor shows intent", async () => {
    await render(header({ instituteId: "inst-1", navigation: [MEGA_ITEM] }));
    await flush();
    expect(mocks.fetchTree).not.toHaveBeenCalled();
  });

  it("keeps a mega item without a library as a plain link", async () => {
    await render(header({ navigation: [{ ...MEGA_ITEM, route: "courses", megaMenu: { libraryId: "" } }] }));
    expect(container.querySelector("nav [aria-controls]")).toBeNull();
    await click(byText("Knowledge Streams")[0]);
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/new/courses" });
  });
});

describe("mega menu (phone menu)", () => {
  it("expands into streams, then a stream into its categories and CTA", async () => {
    await render(header({ instituteId: "inst-1", navigation: [MEGA_ITEM] }));
    await click(container.querySelector('[aria-label="header.toggleMenu"]')!);
    const accordion = container.querySelector('[aria-controls^="mobile-mega-"]') as HTMLButtonElement;
    expect(accordion.getAttribute("aria-expanded")).toBe("false");
    await click(accordion);
    await flush();
    expect(accordion.getAttribute("aria-expanded")).toBe("true");
    const list = document.getElementById(accordion.getAttribute("aria-controls")!)!;
    const eduButton = buttons(list).find((b) => b.textContent?.includes("शिक्षा"))!;
    await click(eduButton);
    expect(eduButton.getAttribute("aria-expanded")).toBe("true");
    const cta = Array.from(list.querySelectorAll("a")).find((a) => a.textContent?.includes("Explore Education"))!;
    await click(cta);
    expect(mocks.navigate).toHaveBeenCalledWith({ href: "/new/courses?stream=education" });
    // The hamburger menu closed.
    expect(container.querySelector('[aria-controls^="mobile-mega-"]')).toBeNull();
  });
});

describe("site search", () => {
  it("searches courses, streams and pages, and opens the highlighted result", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({
      data: {
        content: [
          { id: "c1", package_name: "Vedic Maths Masterclass", package_session_id: "ps1", level_name: "English" },
          { id: "c2", package_name: "Yoga Basics", package_session_id: "ps2" },
        ],
      },
    });
    await render(header({ instituteId: "inst-1", showSearch: true, navigation: [MEGA_ITEM] }));
    const trigger = container.querySelector('[aria-haspopup="dialog"]') as HTMLButtonElement;
    await click(trigger);
    await flush();
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    const input = dialog.querySelector('input[role="combobox"]') as HTMLInputElement;
    // Before typing: suggestions (streams and pages).
    expect(dialog.textContent).toContain("About us");

    await type(input, "vedic");
    await flush();
    const options = Array.from(dialog.querySelectorAll('[role="option"]'));
    // The course title starts with the query; the category only has it as a later word.
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Vedic Maths Masterclass"),
      expect.stringContaining("वैदिक गणित · Vedic Maths"),
    ]);
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);

    await key(input, "ArrowDown");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[1].id);
    await key(input, "ArrowDown");
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);
    await key(input, "Enter");
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: "/new/c1?packageSessionId=ps1&level=English",
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("closes on Escape and says when nothing matches", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { content: [] } });
    await render(header({ instituteId: "inst-1", showSearch: true }));
    await click(container.querySelector('[aria-haspopup="dialog"]')!);
    await flush();
    const dialog = container.querySelector('[role="dialog"]')!;
    await type(dialog.querySelector("input") as HTMLInputElement, "zzz");
    await flush();
    expect(dialog.textContent).toContain("No results for “zzz”");
    await key(dialog.querySelector("input")!, "Escape");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("moves the phone menu toggle to the end when the bar gains controls", async () => {
    await render(header({ showSearch: true, navigation: [{ label: "About", route: "about" }] }));
    expect(container.querySelector('[aria-label="header.toggleMenu"]')!.className).toContain("order-last");
  });
});

describe("language switch", () => {
  const i18n = {
    enabled: true,
    defaultLocale: "en",
    locales: [
      { code: "hi", label: "हिन्दी" },
      { code: "en", label: "EN" },
    ],
  };

  it("shows the site's languages in the authored order and switches through the provider", async () => {
    await render(
      h(CatalogueLocaleProvider, {
        settings: i18n,
        scope: "new",
        children: header({ showLanguageSwitcher: true, globalSettings: { ...CATALOGUE.globalSettings, i18n } }),
      }),
    );
    const group = container.querySelector('[role="group"]')!;
    const options = buttons(group);
    expect(options.map((b) => [b.textContent, b.getAttribute("aria-pressed")])).toEqual([
      ["हिन्दी", "false"],
      ["EN", "true"],
    ]);
    await click(options[0]);
    expect(mocks.history.replace).toHaveBeenCalledWith("/new/about?lang=hi");
  });

  it("stays hidden on a single-language site", async () => {
    await render(header({ showLanguageSwitcher: true }));
    expect(container.querySelector('[role="group"]')).toBeNull();
  });

  it("stays hidden without the prop", async () => {
    await render(h(CatalogueLocaleProvider, { settings: i18n, scope: "new", children: header({}) }));
    expect(container.querySelector('[role="group"]')).toBeNull();
  });
});
