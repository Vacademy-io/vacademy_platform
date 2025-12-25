import { getUserId } from "@/constants/getUserId";
import { GET_AI_PROCESSED_LOGS } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { AxiosResponse } from "axios";
import { useEffect, useState } from "react";
import z from "zod";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import AIReportDetailsPage from "@/components/common/my-reports/ai-report-details-page";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { addHours, format } from "date-fns";

const aiReportParamsSchema = z.object({
  assessmentId: z.string(),
  assessmentName: z.string(),
});

export const Route = createFileRoute("/assessment/reports/ai-report/")({
  validateSearch: aiReportParamsSchema,
  component: RouteComponent,
});

interface AIReportData {
  id: string;
  user_id: string;
  slide_id: null;
  source_id: string;
  source_type: string;
  status: string;
  processed_json: string;
  created_at: string;
  updated_at: string;
}

interface ParsedProcessedJSON {
  performance_analysis: string;
  areas_of_improvement: string;
  improvement_path: string;
  flashcards: { front: string; back: string }[];
  weaknesses: Record<string, number>;
  strengths: Record<string, number>;
}

function RouteComponent() {
  const route = useRouter();
  const { assessmentId, assessmentName } = route.state.location.search;
  const [parsedProcessedJSON, setParsedProcessedJSON] =
    useState<ParsedProcessedJSON | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAIReport() {
      try {
        const userId = await getUserId();
        const response: AxiosResponse<{
          activity_logs: AIReportData[];
          count: number;
        }> = await authenticatedAxiosInstance({
          method: "GET",
          url: GET_AI_PROCESSED_LOGS,
          params: {
            userId: userId,
            sourceId: assessmentId,
          },
        });
        if (response.status !== 200) {
          throw new Error("Failed to fetch student report");
        }
        const json = parseProcessedJSON(
          response.data.activity_logs[0]?.processed_json || ""
        );
        setParsedProcessedJSON(json);
        console.log("Student Report Data:", response.data);
      } catch (error) {
        console.error("Error fetching student report:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAIReport();
  }, [assessmentId]);

  const parseProcessedJSON = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      return parsed as ParsedProcessedJSON;
    } catch (error) {
      console.error("Error parsing processed JSON:", error);
      return null;
    }
  };

  return (
    <>
      <LayoutContainer>
        {loading ? (
          <div className="flex items-center justify-center min-h-screen">
            <DashboardLoader />
          </div>
        ) : !parsedProcessedJSON ? (
          <div className="flex items-center justify-center min-h-screen w-full">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Report Not Available
              </h2>
              <p className="text-gray-600 flex items-center flex-col gap-2">
                The AI report for this assessment is not available.
                <span>We generate reports every hour.</span>
                <span className="text-black">
                  Please check after {format(addHours(new Date(), 1), "KK b")}.
                </span>
              </p>
            </div>
          </div>
        ) : (
          <AIReportDetailsPage
            report={parsedProcessedJSON}
            assessmentId={assessmentId as string}
            assessmentName={assessmentName as string}
          />
        )}
      </LayoutContainer>
    </>
  );
}
