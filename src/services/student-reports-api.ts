import axios from 'axios';
import { BASE_URL } from '@/constants/urls';

export interface StudentReport {
  process_id: string;
  user_id: string;
  institute_id: string;
  start_date_iso: string;
  end_date_iso: string;
  status: string;
  created_at: string;
  updated_at: string;
  report: {
    learning_frequency: string;
    progress: string;
    topics_of_improvement: string;
    topics_of_degradation: string;
    remedial_points: string;
    strengths: Record<string, number>;
    weaknesses: Record<string, number>;
  };
}

export interface ReportsResponse {
  reports: StudentReport[];
  current_page: number;
  total_pages: number;
  total_elements: number;
  page_size: number;
}

export const fetchStudentReports = async (
  userId: string,
  accessToken: string,
  page: number = 0,
  size: number = 10
): Promise<ReportsResponse> => {
  const response = await axios.get<ReportsResponse>(
    `${BASE_URL}/admin-core-service/v1/student-analysis/reports/user/${userId}`,
    {
      params: { page, size },
      headers: {
        'accept': '*/*',
        'authorization': `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
    }
  );
  return response.data;
};