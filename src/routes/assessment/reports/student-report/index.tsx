import { Preferences } from "@capacitor/preferences";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { viewStudentReport } from "../-components/reportMain";
import { useEffect, useState } from "react";
import { TestReportDialog } from "@/components/common/student-test-records/test-report-dialog";
import { SurveyReportDialog } from "@/components/common/student-test-records/survey-report-dialog";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { GET_ASSESSMENT_DETAILS } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ParsedHistoryState } from "@/types/assessments/assessment-data-type";
import { getSurveyStudentReport } from "@/services/survey-report-api";
import { SurveyReportResponse } from "@/types/assessments/survey-report-type";

const studentReportParamsSchema = z.object({
  assessmentId: z.string(),
  attemptId: z.string(),
});

export const Route = createFileRoute("/assessment/reports/student-report/")({
  validateSearch: studentReportParamsSchema,
  component: RouteComponent,
});

export const getAssessmentDetailsData = async ({
  assessmentId,
  instituteId,
  type,
}: {
  assessmentId: string | null | undefined;
  instituteId: string | undefined;
  type: string | undefined;
}) => {
  const response = await authenticatedAxiosInstance({
    method: "GET",
    url: GET_ASSESSMENT_DETAILS,
    params: {
      assessmentId,
      instituteId,
      type,
    },
  });
  return response?.data;
};

export const getAssessmentDetails = ({
  assessmentId,
  instituteId,
  type,
}: {
  assessmentId: string | null | undefined;
  instituteId: string | undefined;
  type: string | undefined;
}) => {
  return {
    queryKey: ["GET_ASSESSMENT_DETAILS", assessmentId, instituteId, type],
    queryFn: () =>
      getAssessmentDetailsData({ assessmentId, instituteId, type }),
    staleTime: 60 * 60 * 1000,
    enabled: !!assessmentId && !!instituteId, // Only enable when both IDs are available
  };
};

async function fetchInstituteDetails() {
  const { value: InstituteDetails } = await Preferences.get({
    key: "InstituteDetails",
  });
  return InstituteDetails;
}

function RouteComponent() {
  const route = useRouter();
  const { assessmentId, attemptId } = route.state.location.search;
  const state = route.state.location.state as ParsedHistoryState;
  const evaluationType = state?.evaluationType;
  const reportFromState = state?.report;
  const playModeFromState = (state as any)?.playMode;

  const [studentReportData, setStudentReportData] = useState(null);
  const [surveyReportData, setSurveyReportData] = useState<SurveyReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [instituteId, setInstituteId] = useState<string | undefined>(undefined);
  const [isSurvey, setIsSurvey] = useState(false);

  // First, fetch the institute ID
  useEffect(() => {
    async function fetchData() {
      try {
        const InstituteDetails = await fetchInstituteDetails();
        const parsedDetails = JSON.parse(InstituteDetails || "{}");
        setInstituteId(parsedDetails?.id || undefined);
      } catch (error) {
        console.error("Error fetching institute details:", error);
      }
    }
    fetchData();
  }, []);

  // Use the query with enabled condition based on instituteId
  const { data: assessmentDetails, isLoading: isAssessmentLoading } =
    useSuspenseQuery(
      getAssessmentDetails({
        assessmentId,
        instituteId,
        type: "EXAM",
      })
    );

  // Check if this is a survey assessment
  useEffect(() => {
    console.log("=== CHECKING SURVEY STATUS ===");
    console.log("Report from state:", reportFromState);
    console.log("PlayMode from state:", playModeFromState);
    
    // First check if we have playMode directly from state (from AssessmentCard)
    if (playModeFromState) {
      const isSurveyFromPlayMode = playModeFromState === "SURVEY";
      console.log("Survey status from playMode state:", isSurveyFromPlayMode);
      setIsSurvey(isSurveyFromPlayMode);
      return;
    }
    
    // Second check if we have a report from state with play_mode
    if (reportFromState?.play_mode) {
      const isSurveyFromReport = reportFromState.play_mode === "SURVEY";
      console.log("Survey status from report state:", isSurveyFromReport);
      setIsSurvey(isSurveyFromReport);
      return;
    }
    
    // Fallback to checking assessment details
    if (assessmentDetails && assessmentDetails.length > 0) {
      const assessment = assessmentDetails[0];
      console.log("Assessment Details:", assessment);
      console.log("Saved Data:", assessment?.saved_data);
      
      // Check multiple possible locations for play_mode
      const playMode = assessment?.play_mode || assessment?.saved_data?.play_mode;
      const isSurveyAssessment = playMode === "SURVEY";
      
      console.log("Play Mode found:", playMode);
      console.log("Is Survey Assessment:", isSurveyAssessment);
      
      setIsSurvey(isSurveyAssessment);
    }
  }, [assessmentDetails, reportFromState, playModeFromState]);

  // Fetch student report after institute ID is available
  useEffect(() => {
    async function fetchStudentReport() {
      if (!instituteId) return;

      console.log("=== FETCHING REPORT ===");
      console.log("isSurvey:", isSurvey);
      console.log("assessmentId:", assessmentId);
      console.log("attemptId:", attemptId);
      console.log("instituteId:", instituteId);

      try {
        if (isSurvey) {
          // Fetch survey report
          console.log("Fetching SURVEY report...");
          const data = await getSurveyStudentReport(assessmentId || "", instituteId);
          setSurveyReportData(data);
          console.log("Survey Report Data:", data);
        } else {
          // Fetch regular report
          console.log("Fetching REGULAR report...");
          const data = await viewStudentReport(
            assessmentId || "",
            attemptId || "",
            instituteId
          );
          setStudentReportData(data);
          console.log("Student Report Data:", data);
        }
      } catch (error) {
        console.error("Error fetching student report:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStudentReport();
  }, [instituteId, assessmentId, attemptId, isSurvey]);

  // Show loading state if any of the data is still loading
  if (loading || isAssessmentLoading || !instituteId) {
    return (
      <div className="flex justify-center items-center h-screen w-screen">
        <DashboardLoader />
      </div>
    );
  }

  return (
    <>
      <LayoutContainer>
        {isSurvey ? (
          <>
            {console.log("=== RENDERING SURVEY REPORT ===")}
            <SurveyReportDialog
              surveyReport={surveyReportData}
              assessmentDetails={assessmentDetails}
              evaluationType={evaluationType ?? ""}
            />
          </>
        ) : (
          <>
            {console.log("=== RENDERING REGULAR REPORT ===")}
            <TestReportDialog
              testReport={studentReportData}
              examType={"EXAM"}
              assessmentDetails={assessmentDetails}
              evaluationType={evaluationType ?? ""}
            />
          </>
        )}
      </LayoutContainer>
    </>
  );
}
