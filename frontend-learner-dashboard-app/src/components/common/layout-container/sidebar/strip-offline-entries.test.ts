import { describe, expect, it } from "vitest";
import { stripOfflineEntries } from "./utils";
import type { SidebarItemsType } from "../../../../types/layout-container-types";

// The icon is irrelevant here; the filter keys off `to` / `subItemLink`.
const icon = (() => null) as unknown as SidebarItemsType["icon"];

const items: SidebarItemsType[] = [
  { icon, id: "dashboard", title: "Dashboard", to: "/dashboard" },
  {
    icon,
    id: "study-library",
    title: "Learning Center",
    subItems: [
      { subItem: "Courses", subItemLink: "/study-library/courses" },
      { subItem: "Downloads", subItemLink: "/downloads" },
    ],
  },
  { icon, id: "offline-downloads", title: "Downloads", to: "/downloads" },
];

describe("stripOfflineEntries", () => {
  // Offline is native-only AND admin-gated. If either gate is off, the learner
  // must not be offered a Downloads screen that can never hold anything — and
  // on web the storage layer actively wipes itself, so the promise is a lie.
  it("removes the top-level offline item and the study-library sub-item", () => {
    const stripped = stripOfflineEntries(items);

    expect(stripped.map((i) => i.id)).toEqual(["dashboard", "study-library"]);
    expect(stripped[1]?.subItems?.map((s) => s.subItemLink)).toEqual([
      "/study-library/courses",
    ]);
  });

  it("leaves everything else untouched and does not mutate the input", () => {
    const stripped = stripOfflineEntries(items);

    expect(stripped[0]).toEqual(items[0]);
    // original still has both offline entries
    expect(items).toHaveLength(3);
    expect(items[1]?.subItems).toHaveLength(2);
  });
});
