"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAccessToken, getCurrentUserId } from "@/lib/auth/sessionUtility";
import {
  fetchStudentReports,
  StudentReport,
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
import { format } from "date-fns";
import ReportDetailsDialog from "./report-details-dialog";
import { X } from "phosphor-react";

export default function MyReportsPage() {
  const navigate = useNavigate();
  const { permissions, isLoading: permissionsLoading } =
    useStudentPermissions();
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedReport, setSelectedReport] = useState<StudentReport | null>(
    null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Redirect if user doesn't have permission to view reports
  useEffect(() => {
    if (!permissionsLoading && !permissions.canViewReports) {
      navigate({ to: "/dashboard" });
    }
  }, [permissions.canViewReports, permissionsLoading, navigate]);

  const { data: userId } = useQuery({
    queryKey: ["currentUserId"],
    queryFn: getCurrentUserId,
    enabled: !!permissions.canViewReports,
  });

  const { data: accessToken } = useQuery({
    queryKey: ["accessToken"],
    queryFn: getAccessToken,
    enabled: !!permissions.canViewReports,
  });

  const {
    data: reportsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["studentReports", userId, currentPage],
    queryFn: () => fetchStudentReports(userId!, accessToken!, currentPage, 20),
    enabled: !!userId && !!accessToken && !!permissions.canViewReports,
  });

  const handleViewDetails = (report: StudentReport) => {
    setSelectedReport(report);
    setIsDialogOpen(true);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page - 1); // MyPagination uses 1-based, API uses 0-based
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
      <div className="flex items-center justify-center min-h-[400px]">
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
      <div className="flex items-center justify-center min-h-[400px]">
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
              <CardTitle className="text-lg">
                {format(new Date(report.start_date_iso), "MMM dd, yyyy")} -{" "}
                {format(new Date(report.end_date_iso), "MMM dd, yyyy")}
              </CardTitle>
              <CardDescription>
                Created: {format(new Date(report.created_at), "MMM dd, yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    report.status === "COMPLETED"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {report.status}
                </span>
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

      <ReportDetailsDialog
        report={selectedReport}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
