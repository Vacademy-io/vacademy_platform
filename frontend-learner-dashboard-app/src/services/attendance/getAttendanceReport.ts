import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { LIVE_SESSION_ATTENDANCE_REPORT_BY_STUDENT } from "@/constants/urls";
import { getAccessToken, getTokenDecodedData } from "@/lib/auth/sessionUtility";

export interface AttendanceReportParams {
  startDate: string;
  endDate: string;
  batchId: string;
}

export interface ScheduleItem {
  accessLevel: "private" | "public";
  attendanceStatus: "PRESENT" | "ABSENT" | "UNMARKED" | null;
  lastEntryTime: string;
  meetingDate: string;
  scheduleId: string;
  sessionId: string;
  sessionStatus: string;
  sessionTitle: string;
  startTime: string;
  subject: string;
}
export interface StudentAttendanceApi {
  userId: string;
  attendancePercentage: number;
  schedules: ScheduleItem[];
}

export const fetchAttendanceReport = async ({
  startDate,
  endDate,
  batchId,
}: AttendanceReportParams) => {
  const token = await getAccessToken();
  const tokenData = getTokenDecodedData(token);
  const userId = tokenData?.user as string;

  // Prepare params object
  const params: Record<string, string> = {
    userId,
    batchId,
    startDate,
    endDate,
  };

  const response = await authenticatedAxiosInstance.get(
    LIVE_SESSION_ATTENDANCE_REPORT_BY_STUDENT,
    {
      params,
    }
  );
  return response.data as StudentAttendanceApi;
};
