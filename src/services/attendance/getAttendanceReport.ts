import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { LIVE_SESSION_ATTENDANCE_REPORT_BY_STUDENT } from "@/constants/urls";
import { getAccessToken, getTokenDecodedData } from "@/lib/auth/sessionUtility";

export interface AttendanceReportParams {
  startDate: string; // Format: YYYY-MM-DD
  endDate: string;   // Format: YYYY-MM-DD
}

export const fetchAttendanceReport = async ({ startDate, endDate }: AttendanceReportParams) => {
  const token = await getAccessToken();
  const tokenData = getTokenDecodedData(token);
  console.log("[AttendanceService] Decoded token data:", tokenData);
  const userId = tokenData?.user as string;
  console.log("[AttendanceService] Using userId:", userId);
  const response = await authenticatedAxiosInstance.get(
    LIVE_SESSION_ATTENDANCE_REPORT_BY_STUDENT,
    {
      params: {
        userId,
        batchId: "14b2df53-4fda-4c18-9ddf-f3e69508f3cc",
        startDate,
        endDate,
      },
    }
  );
  return response.data;
}; 