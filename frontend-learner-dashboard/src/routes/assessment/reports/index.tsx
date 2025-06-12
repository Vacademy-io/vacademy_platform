import { createFileRoute } from "@tanstack/react-router";
import AssessmentReportList from "./-components/reportMain";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";

export const Route = createFileRoute("/assessment/reports/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <LayoutContainer>
      <AssessmentReportList assessment_types="ASSESSMENT" />
    </LayoutContainer>
  );
}
