import AttendanceReportPage from "@/components/common/reports/attendance-report-page";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute } from "@tanstack/react-router";

interface AttendanceReportSearch {
  from?: string;
  to?: string;
  batchId?: string;
}

export const Route = createFileRoute("/reports/attendance/")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): AttendanceReportSearch => ({
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
    batchId: typeof search.batchId === "string" ? search.batchId : undefined,
  }),
});

function RouteComponent() {
  return (
    <LayoutContainer className="!m-0 !p-0 max-w-none">
      <AttendanceReportPage />
    </LayoutContainer>
  );
}
