import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout for a selected child. Deliberately thin — it only renders the Outlet so
 * every nested screen (home + six modules) shows through. Each screen owns its
 * own ParentChildShell + data fetching (cached), which keeps deep-links and hard
 * refresh working on any route without a shared, un-persisted store.
 *
 * MUST render <Outlet/> — a layout file that doesn't is the /parent/documents.tsx bug.
 */
export const Route = createFileRoute("/parent/child/$childId")({
  component: () => <Outlet />,
});
