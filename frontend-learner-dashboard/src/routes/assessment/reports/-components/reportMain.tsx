import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { Preferences } from "@capacitor/preferences";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
  STUDENT_REPORT_DETAIL_URL,
  STUDENT_REPORT_URL,
} from "@/constants/urls";
import { MyButton } from "@/components/design-system/button";
import { useNavigate } from "@tanstack/react-router";
import { Report } from "@/types/assessments/assessment-data-type";
import { formatDuration, getSubjectNameById } from "@/constants/helper";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { PlayMode, StatusChip } from "@/components/design-system/chips";

const playModeColors: { [key: string]: string } = {
  EXAM: "bg-green-500 text-white",
  MOCK: "bg-purple-500 text-white",
  PRACTICE: "bg-blue-500 text-white",
  SURVEY: "bg-red-500 text-white",
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
      state: { report } as any,
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
          // release_result_status: ["RELEASED"],
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
      <div className="text-center py-4 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 p-4">
      {reports.map((report: Report, index: number) => (
        <div
          key={report.attempt_id}
          ref={index === reports.length - 1 ? lastReportElementRef : null}
        >
          <Card className="w-full p-6 space-y-2">
            <h2 className="text-sm lg:text-base font-semibold text-gray-900">
              {report.assessment_name}
            </h2>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                {assessment_types !== "HOMEWORK" && (
                  <div className="flex gap-3 pb-3 items-center">
                    <StatusChip
                      playMode={report.play_mode as PlayMode}
                      className={playModeColors[report.play_mode as PlayMode]}
                    />
                  </div>
                )}
                <div className="space-y-2 text-xs lg:text-sm text-gray-600">
                  <div>Attempt Date: {formatDateTime(report.attempt_date)}</div>
                  <div>
                    Subject:{" "}
                    {getSubjectNameById(
                      instituteDetails?.subjects || [],
                      report?.subject_id
                    ) || ""}
                  </div>
                  <div>
                    Duration:{" "}
                    {report.duration_in_seconds
                      ? formatDuration(report.duration_in_seconds)
                      : "N/A"}
                  </div>
                  <div>Marks: {report.total_marks}</div>
                </div>
              </div>
              <div className="w-full md:w-auto">
                <MyButton
                  buttonType="secondary"
                  className="w-full max-w-xs md:w-[200px] lg:w-[300px]"
                  onClick={() => handleViewReport(report)}
                >
                  View Report
                </MyButton>
              </div>
            </div>
          </Card>
        </div>
      ))}

      {loading && (
        <div className="flex justify-center p-4" ref={loadingRef}>
          <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
        </div>
      )}

      {!hasMore && reports.length > 0 && (
        <p className="text-center text-sm text-gray-500 py-4">
          No more reports to load
        </p>
      )}

      {reports.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">No reports found</p>
        </div>
      )}
    </div>
  );
};

export default AssessmentReportList;
