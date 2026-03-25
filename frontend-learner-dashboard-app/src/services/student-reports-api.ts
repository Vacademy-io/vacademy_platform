import { BASE_URL } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { getUserId } from "@/constants/getUserId";

export interface ReportContent {
  learning_frequency: string;
  progress: string;
  student_efforts: string;
  topics_of_improvement: string;
  topics_of_degradation: string;
  remedial_points: string;
  strengths: Record<string, number>;
  weaknesses: Record<string, number>;
}

export interface StudentReport {
  process_id: string;
  user_id: string;
  institute_id: string;
  start_date_iso: string;
  end_date_iso: string;
  status: string;
  created_at: string;
  updated_at: string;
  report: ReportContent;
}

export interface ReportsResponse {
  reports: StudentReport[];
  current_page: number;
  total_pages: number;
  total_elements: number;
  page_size: number;
}

export interface ReportDetailResponse {
  process_id: string;
  status: string;
  report: ReportContent;
  error_message: string;
}

export const fetchStudentReports = async (
  page: number = 0,
  size: number = 10
): Promise<ReportsResponse> => {
  const userId = await getUserId();
  const response = await authenticatedAxiosInstance.get<ReportsResponse>(
    `${BASE_URL}/admin-core-service/v1/student-analysis/reports/user/${userId}`,
    {
      params: { page, size },
    }
  );
  return response.data;
};

export const fetchStudentReportById = async (
  processId: string
): Promise<ReportDetailResponse> => {
  const response = await authenticatedAxiosInstance.get<ReportDetailResponse>(
    `${BASE_URL}/admin-core-service/v1/student-analysis/report/${processId}`
  );
  return response.data;
};
