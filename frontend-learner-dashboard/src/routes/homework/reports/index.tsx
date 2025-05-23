import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import AssessmentReportList from "@/routes/assessment/reports/-components/reportMain";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/homework/reports/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LayoutContainer>
      <AssessmentReportList assessment_types="HOMEWORK" />
    </LayoutContainer>
  );
}
