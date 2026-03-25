import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { ScheduleTestMainComponent } from "@/routes/assessment/examination/-components/ScheduleTestMainComponent";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/assessment/list/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LayoutContainer>
      <ScheduleTestMainComponent assessment_types="ASSESSMENT" />
    </LayoutContainer>
  );
}
