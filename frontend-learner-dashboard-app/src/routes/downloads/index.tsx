import { DownloadsPage } from "@/components/common/offline/downloads-page";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/downloads/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LayoutContainer>
      <DownloadsPage />
    </LayoutContainer>
  );
}
