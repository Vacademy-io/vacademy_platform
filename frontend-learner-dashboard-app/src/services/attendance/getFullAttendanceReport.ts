import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { LEARNER_FULL_ATTENDANCE_REPORT } from "@/constants/urls";

export interface FullAttendanceReportSession {
  sessionId: string;
  title: string;
  meetingDate: string;
  attendanceStatus: "PRESENT" | "ABSENT" | "UNMARKED" | null;
}

export interface FullAttendanceReportEngagementLog {
  sessionId: string;
  scheduleId: string;
  engagementData: string | null;
  providerTotalDurationMinutes: number | null;
  statusType: string;
  /** Per-session score breakdown (populated only when engagement data exists). */
  engagementScore?: number;
  attendancePoints?: number;
  interactionPoints?: number;
  meetingDurationMinutes?: number;
  interactionBreakdown?: {
    chats: number;
    raisehand: number;
    talks: number;
    talkTime: number;
    emojis: number;
    pollVotes: number;
  };
}

export interface FullAttendanceReportStudent {
  studentId: string;
  fullName: string;
  email: string;
  attendancePercentage: number;
  batchId: string;
  startDate: string;
  endDate: string;
  instituteName: string;
  reportUrl?: string;
  sessions: FullAttendanceReportSession[];
  engagementLogs: FullAttendanceReportEngagementLog[];
  totalDurationMinutes: number;
  totalChats: number;
  totalHandRaises: number;
  sessionsAttended: number;
  /** Pre-rendered HTML cards (same content shown in the email). */
  sessionsTableHtml: string;
}

export interface FullAttendanceReportResponse {
  students: FullAttendanceReportStudent[];
  totalStudents: number;
  startDate?: string;
  endDate?: string;
  batchId?: string;
  message?: string;
}

export interface FullAttendanceReportParams {
  /** Date range start (YYYY-MM-DD). Optional — defaults to last 7 days on server. */
  from?: string;
  /** Date range end (YYYY-MM-DD). */
  to?: string;
  /** Specific batch (optional — defaults to all enrolled batches). */
  batchId?: string;
  /** Number of days to report on. Used when from/to not given. */
  daysBack?: number;
  /** Optional institute scope. */
  instituteId?: string;
}

export const fetchFullAttendanceReport = async (
  params: FullAttendanceReportParams = {}
): Promise<FullAttendanceReportResponse> => {
  const queryParams: Record<string, string> = {};
  if (params.batchId) queryParams.batchId = params.batchId;
  if (params.instituteId) queryParams.instituteId = params.instituteId;
  if (params.daysBack !== undefined) queryParams.daysBack = String(params.daysBack);
  // Note: backend currently uses daysBack — from/to are accepted as URL params
  // for deep-linking from the email but the backend computes the window itself.
  if (params.from) queryParams.from = params.from;
  if (params.to) queryParams.to = params.to;

  const response = await authenticatedAxiosInstance.get(
    LEARNER_FULL_ATTENDANCE_REPORT,
    { params: queryParams }
  );
  return response.data as FullAttendanceReportResponse;
};
