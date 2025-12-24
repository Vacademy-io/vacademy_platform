import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { Preferences } from "@capacitor/preferences";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
  STUDENT_REPORT_DETAIL_URL,
  STUDENT_REPORT_URL,
} from "@/constants/urls";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "@tanstack/react-router";
import { Report } from "@/types/assessments/assessment-data-type";
import { formatDuration, getSubjectNameById } from "@/constants/helper";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { PlayMode } from "@/components/design-system/chips";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { cn } from "@/lib/utils";

const playModeStyles: { [key: string]: string } = {
  EXAM: "bg-green-100 text-green-700 hover:bg-green-200 border-green-200",
  MOCK: "bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200",
  PRACTICE: "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200",
  SURVEY: "bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200",
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
  const handleViewReport = (report: Report) => {
    navigate({
      to: `/assessment/reports/student-report`,
      search: {
        assessmentId: report.assessment_id,
        attemptId: report.attempt_id,
      },
      state: {
        report,
        evaluationType: report.evaluation_type,
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
          release_result_status: ["RELEASED"],
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

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm");
    } catch (err) {
      console.error("Date formatting error:", err);
      return dateString;
    }
  };

  if (error && reports.length === 0) {
    return (
      <div className="text-center py-4 text-destructive">
        <p>{error}</p>
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
                {assessment_types !== "HOMEWORK" && (
                  <Badge
                    variant="outline"
                    className={cn("text-xs font-semibold px-2.5 py-0.5 border", playModeStyles[report.play_mode as PlayMode])}
                  >
                    {report.play_mode}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-8 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Attempt Date:</span>
                    <span>{formatDateTime(report.attempt_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {getTerminology(ContentTerms.Subjects, SystemTerms.Subjects)}:
                    </span>
                    <span>
                      {getSubjectNameById(instituteDetails?.subjects || [], report?.subject_id) || "-"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Duration:</span>
                    <span>
                      {report.duration_in_seconds ? formatDuration(report.duration_in_seconds) : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">Marks:</span>
                    <span>{report.total_marks}</span>
                  </div>
                </div>

                <div className="w-full md:w-auto mt-2 md:mt-0">
                  <Button
                    variant="secondary"
                    className="w-full md:w-auto min-w-[120px]"
                    onClick={() => handleViewReport(report)}
                  >
                    View Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}

      {loading && (
        <div className="flex justify-center p-4" ref={loadingRef}>
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      )}

      {!hasMore && reports.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          No more reports to load
        </p>
      )}

      {reports.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">No reports found</p>
        </div>
      )}
    </div>
  );
};

export default AssessmentReportList;
