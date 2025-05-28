import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { ScheduleTestMainComponent } from "@/routes/assessment/examination/-components/ScheduleTestMainComponent";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/homework/list/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LayoutContainer>
      {/* <Helmet>
      <title>Assessment</title>
      <meta name="description" content="Assessment page" />
    </Helmet> */}
      <ScheduleTestMainComponent assessment_types = "HOMEWORK" />
    </LayoutContainer>
  );
}
