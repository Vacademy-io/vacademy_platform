import { DownloadsPage } from "@/components/common/offline/downloads-page";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/downloads/")({
  // `?tab=settings` lets other screens deep-link straight to the settings tab —
  // e.g. the "Change settings" action on the Wi-Fi-only download toast.
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === "settings" ? ("settings" as const) : undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LayoutContainer>
      <DownloadsPage />
    </LayoutContainer>
  );
}
