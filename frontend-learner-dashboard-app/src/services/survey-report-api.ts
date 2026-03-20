import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { SURVEY_STUDENT_REPORT_URL } from "@/constants/urls";
import { SurveyReportResponse } from "@/types/assessments/survey-report-type";

export const getSurveyStudentReport = async (
  assessmentId: string,
  instituteId: string
): Promise<SurveyReportResponse> => {
  const response = await authenticatedAxiosInstance({
    method: "GET",
    url: SURVEY_STUDENT_REPORT_URL,
    params: {
      assessmentId,
      instituteId,
    },
  });
  return response?.data;
};
