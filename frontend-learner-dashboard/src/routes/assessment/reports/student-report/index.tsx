import { Preferences } from "@capacitor/preferences";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { viewStudentReport } from "../-components/reportMain";
import { useEffect, useState } from "react";
import { TestReportDialog } from "@/components/common/student-test-records/test-report-dialog";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { GET_ASSESSMENT_DETAILS } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { useSuspenseQuery } from "@tanstack/react-query";

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
  return response?.data ;
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
  
  const [studentReportData, setStudentReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [instituteId, setInstituteId] = useState<string | undefined>(undefined);

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
  const { data: assessmentDetails, isLoading: isAssessmentLoading } = useSuspenseQuery(
    getAssessmentDetails({
      assessmentId,
      instituteId,
      type: "EXAM",
    })
  );

  // Fetch student report after institute ID is available
  useEffect(() => {
    async function fetchStudentReport() {
      if (!instituteId) return;
      
      try {
        const data = await viewStudentReport(
          assessmentId || "",
          attemptId || "",
          instituteId
        );
        setStudentReportData(data);
      } catch (error) {
        console.error("Error fetching student report:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStudentReport();
  }, [instituteId, assessmentId, attemptId]);

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
        <TestReportDialog
          testReport={studentReportData}
          examType={"EXAM"}
          assessmentDetails={assessmentDetails}
        />
      </LayoutContainer>
    </>
  );
}