import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Preferences } from "@capacitor/preferences";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
  STUDENT_REPORT_DETAIL_URL,
  STUDENT_REPORT_URL,
} from "@/constants/urls";
import { useNavigate } from "@tanstack/react-router";
import { Report } from "@/types/assessments/assessment-data-type";
import { formatDuration, getSubjectNameById } from "@/constants/helper";
import { formatDateTime } from "@/lib/format-date";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { MyButton } from "@/components/design-system/button";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/design-system/states";
import { FileText } from "@phosphor-icons/react";

const PLAY_MODE_LABELS: Record<string, string> = {
  EXAM: "Exam",
  MOCK: "Mock",
  PRACTICE: "Practice",
  SURVEY: "Survey",
  MANUAL_UPLOAD_EXAM: "Offline exam",
};

export const viewStudentReport = async (
  assessmentId: string,
  attemptId: string,
  instituteId: string | null
) => {
  const response = await authenticatedAxiosInstance({
    method: "GET",
    url: STUDENT_REPORT_DETAIL_URL,
    params: {
      assessmentId,
      attemptId,
      instituteId,
    },
  });
  return response?.data;
};

export const handleGetStudentReport = ({
  assessmentId,
  attemptId,
  instituteId,
}: {
  assessmentId: string;
  attemptId: string;
  instituteId: string | null;
}) => {
  return {
    queryKey: ["GET_STUDENT_REPORT", assessmentId, attemptId, instituteId],
    queryFn: () => viewStudentReport(assessmentId, attemptId, instituteId),
    staleTime: 60 * 60 * 1000,
  };
};

const AssessmentReportList = ({
  assessment_types,
}: {
  assessment_types: "HOMEWORK" | "ASSESSMENT";
}) => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pageNo, setPageNo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 10;
  const observer = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement | null>(null);
  const [instituteDetails, setInstituteDetails] = useState<any>(null);
  const { setNavHeading } = useNavHeadingStore();

  useEffect(() => {
    setNavHeading("Reports");
  }, []);

  useEffect(() => {
    const fetchInstituteDetails = async () => {
      const response = await Preferences.get({ key: "InstituteDetails" });
      console.log("response InstituteDetails", response);
      setInstituteDetails(response?.value ? JSON.parse(response.value) : null);
    };

    fetchInstituteDetails();
  }, []);
  const handleViewAIReport = (report: Report) => {
    navigate({
      to: `/assessment/reports/ai-report`,
      search: {
        assessmentId: report.assessment_id,
        assessmentName: report.assessment_name,
        attemptId: report.attempt_id,
      },
    });
  };

  const handleViewComparison = (report: Report) => {
    navigate({
      to: `/assessment/reports/comparison`,
      search: {
        assessmentId: report.assessment_id,
        attemptId: report.attempt_id,
      },
      state: {
        report,
        assessmentName: report.assessment_name,
      } as any,
    });
  };

  const fetchReports = async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);
      setError(null);

      // Get details from Preferences
      const StudentDetails = await Preferences.get({ key: "StudentDetails" });
      const InstituteDetails = await Preferences.get({
        key: "InstituteDetails",
      });

      // Parse the JSON strings from Preferences
      const studentData = JSON.parse(StudentDetails.value || "{}");
      const instituteData = JSON.parse(InstituteDetails.value || "{}");

      const response = await authenticatedAxiosInstance.post(
        STUDENT_REPORT_URL,
        {
          name: "",
          status: ["ENDED"],
          // Include PENDING so submitted-but-not-yet-evaluated attempts also show
          // (as "Pending evaluation"). Marks/report stay gated until RELEASED.
          release_result_status: ["RELEASED", "PENDING"],
          assessment_type: [assessment_types],
          sort_columns: {},
        },
        {
          params: {
            studentId: studentData.user_id,
            instituteId: instituteData.id,
            pageNo,
            pageSize,
          },
        }
      );

      const newReports = response.data.content;
      setReports((prev) =>
        pageNo === 0 ? newReports : [...prev, ...newReports]
      );
      setHasMore(!response.data.last);
    } catch (err) {
      console.error("Error fetching reports:", err);
      setError("Failed to load reports. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Setup intersection observer for infinite scrolling
  const lastReportElementRef = useCallback(
    (node: HTMLDivElement) => {
      if (loading) return;

      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            setPageNo((prevPageNo) => prevPageNo + 1);
          }
        },
        { threshold: 0.5 }
      );

      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  // Load initial data
  useEffect(() => {
    fetchReports();
  }, [pageNo]);

  // Cleanup observer on component unmount
  useEffect(() => {
    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, []);

  // Legacy rows (no status field) are treated as released to preserve old behavior.
  const isReportReleased = (report: Report) =>
    report.report_release_status !== "PENDING";

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy hh:mm a");
    } catch (err) {
      console.error("Date formatting error:", err);
      return dateString;
    }
  };

  if (error && reports.length === 0) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <ErrorState
          title="Could not load reports"
          message={error}
          onRetry={() => fetchReports()}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 p-4 md:p-6 lg:p-8">
      {reports.map((report: Report, index: number) => (
        <div
          key={report.attempt_id}
          ref={index === reports.length - 1 ? lastReportElementRef : null}
        >
          <Card className="w-full transition-all hover:shadow-md">
            <CardHeader className="pb-2">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle className="text-base sm:text-lg font-semibold text-foreground">
                  {report.assessment_name}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {report.evaluation_type && (
                    <Badge
                      variant="outline"
                      className="text-xs font-semibold px-2.5 py-0.5 border bg-slate-100 text-slate-700 border-slate-200"
                    >
                      {report.evaluation_type === "MANUAL" ? "Manual" : "Auto"}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-semibold px-2.5 py-0.5 border",
                      isReportReleased(report)
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-amber-100 text-amber-700 border-amber-200"
                    )}
                  >
                    {isReportReleased(report) ? "Released" : "Pending evaluation"}
                  </Badge>
                  {assessment_types !== "HOMEWORK" && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-semibold px-2.5 py-0.5 border",
                        playModeStyles[report.play_mode as PlayMode]
                      )}
                    >
                      {report.play_mode}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-8 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      Attempt Date:
                    </span>
                    <span>{formatDateTime(report.attempt_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {getTerminology(
                        ContentTerms.Subjects,
                        SystemTerms.Subjects
                      )}
                      :
                    </span>
                    <span>
                      {getSubjectNameById(
                        instituteDetails?.subjects || [],
                        report?.subject_id
                      ) || "-"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      Duration:
                    </span>
                    <span>
                      {report.duration_in_seconds
                        ? formatDuration(report.duration_in_seconds)
                        : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Marks:</span>
                    <span>
                      {isReportReleased(report)
                        ? report.total_marks
                        : "Awaiting evaluation"}
                    </span>
                  </div>
                  {metaParts.length > 0 && (
                    <p className="mt-1 text-caption text-muted-foreground">
                      {metaParts.join(" · ")}
                    </p>
                  )}
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <MyButton
                    className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                    onClick={() => handleViewAIReport(report)}
                    disable={!isReportReleased(report)}
                  >
                    View AI Report
                  </MyButton>
                  <MyButton
                    buttonType="secondary"
                    className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                    onClick={() => handleViewComparison(report)}
                    disabled={!isReportReleased(report)}
                  >
                    Report
                  </MyButton>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}

      {loading && (
        <div ref={loadingRef}>
          <LoadingState variant="list" count={3} />
        </div>
      )}

      {!hasMore && reports.length > 0 && (
        <p className="text-center text-caption text-muted-foreground py-4">
          No more reports to load
        </p>
      )}

      {reports.length === 0 && !loading && (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          description="Reports appear here once you finish a test and its results are released."
          action={{
            label: assessment_types === "HOMEWORK" ? "Go to homework" : "Go to tests",
            onClick: () =>
              navigate({
                to:
                  assessment_types === "HOMEWORK"
                    ? "/homework/list"
                    : "/assessment/examination",
              }),
          }}
        />
      )}
    </div>
  );
};

export default AssessmentReportList;
