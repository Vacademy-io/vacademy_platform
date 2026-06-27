"use client";

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  fetchMyReports,
  type ReportListItem,
  type StudentReport,
} from "@/services/student-reports-api";
import { useStudentPermissions } from "@/hooks/use-student-permissions";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { MyPagination } from "@/components/design-system/pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MyButton } from "@/components/design-system/button";
import { useReportStore } from "@/stores/report-store";
import { X } from "@phosphor-icons/react";
import { useEffect } from "react";

function safeFormatDate(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/** Label to show in the card title: report name if set, else date range. */
function reportLabel(report: ReportListItem): string {
  if (report.name) return report.name;
  const start = safeFormatDate(report.start_date_iso);
  const end = safeFormatDate(report.end_date_iso);
  return `${start} — ${end}`;
}

export default function MyReportsPage() {
  const navigate = useNavigate();
  const { permissions, isLoading: permissionsLoading } =
    useStudentPermissions();
  const { setSelectedReport } = useReportStore();
  const [currentPage, setCurrentPage] = useState(0);

  // Redirect if user doesn't have permission to view reports
  useEffect(() => {
    if (!permissionsLoading && !permissions.canViewReports) {
      navigate({ to: "/dashboard" });
    }
  }, [permissions.canViewReports, permissionsLoading, navigate]);

  const {
    data: reportsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["myReports", currentPage],
    queryFn: () => fetchMyReports(currentPage, 20),
    enabled: !!permissions.canViewReports,
  });

  const handleViewDetails = (item: ReportListItem) => {
    // For v1 reports: pre-populate the store so the detail page can show date
    // range without a second fetch. V2 reports don't use the store.
    if (item.report_version !== "v2" && item.report) {
      const synthetic: StudentReport = {
        process_id: item.process_id,
        user_id: "",
        institute_id: "",
        start_date_iso: item.start_date_iso,
        end_date_iso: item.end_date_iso,
        status: item.status,
        created_at: item.created_at,
        updated_at: "",
        report: item.report,
      };
      setSelectedReport(synthetic);
    }
    navigate({ to: `/my-reports/${item.process_id}` });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page - 1); // MyPagination is 1-based, API is 0-based
  };

  const handleClose = () => {
    navigate({ to: "/dashboard" });
  };

  if (permissionsLoading) {
    return <DashboardLoader />;
  }

  if (!permissions.canViewReports) {
    return null; // Will redirect
  }

  if (isLoading) {
    return <DashboardLoader />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-reg-400">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-neutral-700 mb-2">
            Error Loading Reports
          </h2>
          <p className="text-neutral-500">Please try again later.</p>
        </div>
      </div>
    );
  }

  if (!reportsData || reportsData.reports.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-reg-400">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-neutral-700 mb-2">
            No Reports Found
          </h2>
          <p className="text-neutral-500">You don't have any reports yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24 md:pb-8">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="w-full py-4 px-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 md:hidden"
              >
                <X size={24} />
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                My Reports
              </h1>
            </div>
            <div className="hidden md:flex gap-3">
              <MyButton
                type="button"
                scale="medium"
                buttonType="secondary"
                layoutVariant="default"
                onClick={handleClose}
              >
                Back to Dashboard
              </MyButton>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 w-full py-6 md:py-8 px-4">
        {reportsData.reports.map((report) => (
          <Card
            key={report.process_id}
            className="hover:shadow-lg transition-shadow"
          >
            <CardHeader>
              <CardTitle className="text-lg">{reportLabel(report)}</CardTitle>
              <CardDescription>
                {report.created_at
                  ? `Created: ${safeFormatDate(report.created_at)}`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      report.status === "COMPLETED"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {report.status}
                  </span>
                  {report.report_version === "v2" && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-600 border border-primary-200">
                      Comprehensive
                    </span>
                  )}
                </div>
                <MyButton
                  onClick={() => handleViewDetails(report)}
                  size="sm"
                  buttonType="secondary"
                >
                  View Details
                </MyButton>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {reportsData.total_pages > 1 && (
        <div className="mt-8 flex justify-center">
          <MyPagination
            currentPage={currentPage + 1}
            totalPages={reportsData.total_pages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
