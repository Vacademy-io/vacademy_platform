// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/constants/urls", () => ({
  ENROLLMENT_INVITE_URL: "https://api.test/invite",
  urlCourseDetails: "https://api.test/search",
  GET_PRODUCT_PAGE_BY_CODE: () => "https://api.test/by-code",
}));

const service = vi.hoisted(() => ({
  fetchCourseLevels: vi.fn(),
  getOpenEnrollInvite: vi.fn(),
}));
type CourseLevelsService = typeof import("../../-services/course-levels-service");
vi.mock("../../-services/course-levels-service", async (importActual: () => Promise<CourseLevelsService>) => ({
  ...(await importActual()),
  fetchCourseLevels: service.fetchCourseLevels,
  getOpenEnrollInvite: service.getOpenEnrollInvite,
}));

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DEFAULT_COURSE_LANGUAGES } from "../../-utils/course-variants";
import type { CourseLevel } from "../../-services/course-levels-service";
import { useCourseVersions, type CourseVersionsState } from "./use-course-versions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const level = (over: Partial<CourseLevel> & { packageSessionId: string }): CourseLevel => ({
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

const hi = level({ packageSessionId: "ps-hi", levelName: "Hindi", enrollInviteId: "inv-hi", price: 499 });
const en = level({ packageSessionId: "ps-en", levelName: "English", enrollInviteId: "inv-en", price: 999 });

type HookOpts = Parameters<typeof useCourseVersions>[0];
const baseOpts: HookOpts = {
  enabled: true,
  instituteId: "inst",
  courseId: "pkg",
  courseInit: null,
  languages: DEFAULT_COURSE_LANGUAGES,
  preferredLanguage: null,
};

let root: Root | null = null;
let latest: CourseVersionsState | null = null;

const Harness: React.FC<{ opts: HookOpts }> = ({ opts }) => {
  latest = useCourseVersions(opts);
  return null;
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const mount = async (opts: HookOpts) => {
  const host = document.createElement("div");
  root = createRoot(host);
  act(() => root!.render(React.createElement(Harness, { opts })));
  await flush();
};

const rerender = async (opts: HookOpts) => {
  act(() => root!.render(React.createElement(Harness, { opts })));
  await flush();
};

beforeEach(() => {
  service.fetchCourseLevels.mockReset().mockResolvedValue([hi, en]);
  service.getOpenEnrollInvite.mockReset().mockImplementation(async (_inst: string, id: string) => ({
    id,
    availability_status: "AVAILABLE",
    package_session_to_payment_options: [],
  }));
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  latest = null;
});

describe("useCourseVersions", () => {
  it("makes no request at all for a site that did not opt in", async () => {
    await mount({ ...baseOpts, enabled: false, urlEnrollInviteId: "inv-x" });
    expect(latest?.status).toBe("off");
    expect(latest?.selected).toBeNull();
    expect(service.fetchCourseLevels).not.toHaveBeenCalled();
    expect(service.getOpenEnrollInvite).not.toHaveBeenCalled();
  });

  it("orders versions by language, selects the first with an invite and loads its invite", async () => {
    await mount(baseOpts);
    expect(service.fetchCourseLevels).toHaveBeenCalledWith({ instituteId: "inst", courseId: "pkg", productPageCode: undefined });
    expect(latest?.status).toBe("ready");
    expect(latest?.versions.map((v) => v.packageSessionId)).toEqual(["ps-en", "ps-hi"]);
    expect(latest?.selected?.packageSessionId).toBe("ps-en");
    expect(latest?.options.map((o) => o.code)).toEqual(["en", "hi"]);
    expect(service.getOpenEnrollInvite).toHaveBeenLastCalledWith("inst", "inv-en");
    expect(latest?.invite?.id).toBe("inv-en");
  });

  it("follows the URL and keeps the URL's invite for that version", async () => {
    await mount({ ...baseOpts, urlPackageSessionId: "ps-hi", urlEnrollInviteId: "promo-hi" });
    expect(latest?.selected?.packageSessionId).toBe("ps-hi");
    expect(latest?.selectedInviteId).toBe("promo-hi");
    expect(latest?.invite?.id).toBe("promo-hi");
  });

  it("prefers the visitor's language when the URL names no version", async () => {
    await mount({ ...baseOpts, preferredLanguage: "hi" });
    expect(latest?.selected?.packageSessionId).toBe("ps-hi");
  });

  it("switches on select() without refetching the versions", async () => {
    await mount(baseOpts);
    act(() => latest!.select("ps-hi"));
    await flush();
    expect(latest?.selected?.packageSessionId).toBe("ps-hi");
    expect(latest?.selectedInviteId).toBe("inv-hi");
    expect(latest?.invite?.id).toBe("inv-hi");
    expect(service.fetchCourseLevels).toHaveBeenCalledTimes(1);
  });

  it("keeps a pick once the URL reflects it, and lets a later URL take over", async () => {
    await mount(baseOpts);
    act(() => latest!.select("ps-hi"));
    await rerender({ ...baseOpts, urlPackageSessionId: "ps-hi", urlEnrollInviteId: "inv-hi" });
    expect(latest?.selected?.packageSessionId).toBe("ps-hi");
    // e.g. an in-page link or Back/Forward to the English version
    await rerender({ ...baseOpts, urlPackageSessionId: "ps-en", urlEnrollInviteId: "inv-en" });
    expect(latest?.selected?.packageSessionId).toBe("ps-en");
    expect(latest?.selectedInviteId).toBe("inv-en");
  });

  it("resolves a non-default ?enrollInviteId through the package sessions it sells", async () => {
    service.getOpenEnrollInvite.mockImplementation(async (_inst: string, id: string) => ({
      id,
      package_session_to_payment_options: id === "special" ? [{ package_session_id: "ps-hi" }] : [],
    }));
    await mount({ ...baseOpts, urlEnrollInviteId: "special" });
    await flush();
    expect(latest?.selected?.packageSessionId).toBe("ps-hi");
    expect(latest?.selectedInviteId).toBe("special");
  });

  it("stays usable when the versions cannot be loaded", async () => {
    service.fetchCourseLevels.mockRejectedValue(new Error("offline"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await mount(baseOpts);
    expect(latest?.status).toBe("error");
    expect(latest?.selected).toBeNull();
    expect(latest?.options).toEqual([]);
    warn.mockRestore();
  });

  it("starts over for another course", async () => {
    await mount(baseOpts);
    act(() => latest!.select("ps-hi"));
    service.fetchCourseLevels.mockResolvedValue([level({ packageSessionId: "ps-2", levelName: "English", enrollInviteId: "inv-2" })]);
    await rerender({ ...baseOpts, courseId: "pkg-2" });
    expect(latest?.selected?.packageSessionId).toBe("ps-2");
    expect(service.fetchCourseLevels).toHaveBeenCalledTimes(2);
  });
});
