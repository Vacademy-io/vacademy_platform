import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useStudentPermissions } from "@/hooks/use-student-permissions";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import ReportDetailsPage from "@/components/common/my-reports/report-details-page";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { useReportStore } from "@/stores/report-store";

export const Route = createFileRoute("/my-reports/$processId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { processId } = Route.useParams();
  const { permissions, isLoading: permissionsLoading } =
    useStudentPermissions();
  const { selectedReport } = useReportStore();
  console.log("Selected Report in RouteComponent:", selectedReport);

  if (permissionsLoading) {
    return <DashboardLoader />;
  }

  if (!permissions.canViewReports) {
    return null; // Will redirect
  }

  if (!selectedReport) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-neutral-700 mb-2">
            Report Not Found
          </h2>
          <p className="text-neutral-500">
            The requested report could not be found. for {processId}
          </p>
          <button
            onClick={() => navigate({ to: "/my-reports" })}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Reports
          </button>
        </div>
      </div>
    );
  }

  return (
    <LayoutContainer>
      <ReportDetailsPage report={selectedReport} />
    </LayoutContainer>
  );
}
