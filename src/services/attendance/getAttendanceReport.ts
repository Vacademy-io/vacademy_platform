import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { LIVE_SESSION_ATTENDANCE_REPORT_BY_BATCH } from "@/constants/urls";

export interface AttendanceReportParams {
  batchSessionId: string;
  startDate: string; // Format: YYYY-MM-DD
  endDate: string;   // Format: YYYY-MM-DD
}

export const fetchAttendanceReport = async ({ batchSessionId, startDate, endDate }: AttendanceReportParams) => {
  const response = await authenticatedAxiosInstance.get(LIVE_SESSION_ATTENDANCE_REPORT_BY_BATCH, {
    params: {
      batchSessionId,
      startDate,
      endDate,
    },
  });
  return response.data;
}; 