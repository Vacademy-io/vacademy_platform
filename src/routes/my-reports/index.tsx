import MyReportsPage from "@/components/common/my-reports/my-reports-page";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/my-reports/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LayoutContainer className="!m-0 !p-0 max-w-none">
      <MyReportsPage />
    </LayoutContainer>
  );
}