// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => {},
  useParams: () => ({ tagName: "tag" }),
  useRouter: () => ({ navigate: () => {} }),
  Link: () => null,
}));
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { JsonRenderer } from "./JsonRenderer";
import { markResourceUnlocked } from "../-utils/resource-unlock";

/**
 * featureGrid `resource` style — the free-resources library card. Asserts the
 * card anatomy (thumbnail, badge, chips, button) and the email gate: a gated
 * link is a button that asks the page shell for the gate list's form, and
 * turns into a plain link once that list is unlocked in this browser.
 */
// This jsdom build ships no Storage; a Map-backed one is all the unlock needs.
const store = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  },
});

const GATE = "aud-free-pdfs";
const PDF = "https://cdn.example.com/CATALOGUE_DOCUMENTS/ADMIN/x-guide.pdf";

const features = [
  {
    title: "Daily Routine Chart",
    description: "A printable routine for mornings.",
    image: "https://img.example.com/thumb.png",
    badge: "Featured",
    chips: ["Ages 2–4", "PDF"],
    link: { text: "Download", url: PDF, gated: true },
  },
  {
    title: "Root Chakra Meditation",
    description: "Five quiet minutes.",
    image: "https://img.example.com/med.png",
    chips: ["5 min"],
    link: { text: "Listen", url: "https://www.youtube.com/watch?v=abc" },
  },
];

const element = (props: Record<string, unknown>) =>
  React.createElement(JsonRenderer, {
    page: {
      id: "p", route: "p", title: "p",
      components: [{ id: "lib", type: "featureGrid", enabled: true, props: { style: "resource", features, ...props } }],
    },
    globalSettings: {} as never,
    instituteId: "inst",
    tagName: "tag",
  } as never);

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const mount = async (props: Record<string, unknown>) => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(element(props)));
  return host;
};

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  window.localStorage.clear();
});

describe("featureGrid resource style", () => {
  it("paints thumbnail, badge, chips, title and the action label", () => {
    const html = renderToString(element({}));
    expect(html).toContain("https://img.example.com/thumb.png");
    expect(html).toContain("Featured");
    expect(html).toContain("Ages 2–4");
    expect(html).toContain("Daily Routine Chart");
    expect(html).toContain("Download");
    expect(html).toContain("Listen");
  });

  it("without a gate list every link is a plain link", async () => {
    const el = await mount({});
    expect(el.querySelectorAll("article button")).toHaveLength(0);
    expect(el.querySelector(`a[href="${PDF}"]`)).not.toBeNull();
  });

  it("a gated link opens the gate list's form with the file to hand over", async () => {
    const el = await mount({ gateAudienceId: GATE, gateTitle: "Get your free printables" });
    const seen: unknown[] = [];
    const onOpen = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener("openAudienceForm", onOpen);

    const button = el.querySelector("article button") as HTMLButtonElement;
    expect(button.textContent).toContain("Download");
    expect(el.querySelector(`a[href="${PDF}"]`)).toBeNull();
    // The ungated card stays a link.
    expect(el.querySelector('a[href="https://www.youtube.com/watch?v=abc"]')).not.toBeNull();

    await act(async () => button.click());
    window.removeEventListener("openAudienceForm", onOpen);
    expect(seen).toEqual([
      { audienceId: GATE, title: "Get your free printables", unlockUrl: PDF, unlockLabel: "Download" },
    ]);
  });

  it("unlocking the list turns the gated card into a direct link, live", async () => {
    const el = await mount({ gateAudienceId: GATE });
    expect(el.querySelector("article button")).not.toBeNull();
    await act(async () => markResourceUnlocked(GATE));
    expect(el.querySelector("article button")).toBeNull();
    expect(el.querySelector(`a[href="${PDF}"]`)).not.toBeNull();
  });

  it("gateAll gates every card in the section, not only flagged ones", async () => {
    const el = await mount({ gateAudienceId: GATE, gateAll: true });
    expect(el.querySelectorAll("article button")).toHaveLength(2);
    expect(el.querySelector('a[href="https://www.youtube.com/watch?v=abc"]')).toBeNull();
  });

  it("an earlier unlock in this browser is honoured on mount", async () => {
    window.localStorage.setItem(`catalogue-resource-unlock:${GATE}`, "1");
    const el = await mount({ gateAudienceId: GATE });
    expect(el.querySelector("article button")).toBeNull();
  });
});
