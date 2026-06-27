import {
  fetchFullAttendanceReport,
  type FullAttendanceReportSession,
} from "@/services/attendance/getFullAttendanceReport";

/** How far back to look for live-class attendance when evaluating badges. */
const DAYS_BACK = 120;

/**
 * Live-class attendance signals for badge triggers:
 *  - count:  total live classes attended (within the lookback window)
 *  - streak: live classes attended in a row, newest-first, stopping at the first miss
 *
 * Fetched lazily — only when a live-session badge is configured.
 */
export async function fetchLiveAttendanceStats(): Promise<{ count: number; streak: number }> {
  try {
    const report = await fetchFullAttendanceReport({ daysBack: DAYS_BACK });
    const students = report.students ?? [];

    let count = 0;
    const sessions: FullAttendanceReportSession[] = [];
    for (const s of students) {
      count += s.sessionsAttended ?? 0;
      if (Array.isArray(s.sessions)) sessions.push(...s.sessions);
    }

    // Consecutive PRESENT among marked sessions, newest first (UNMARKED is ignored).
    const marked = sessions
      .filter((x) => x.attendanceStatus === "PRESENT" || x.attendanceStatus === "ABSENT")
      .sort((a, b) =>
        a.meetingDate < b.meetingDate ? 1 : a.meetingDate > b.meetingDate ? -1 : 0
      );

    let streak = 0;
    for (const s of marked) {
      if (s.attendanceStatus === "PRESENT") streak++;
      else break;
    }

    return { count, streak };
  } catch (error) {
    console.error("[live-attendance-stats] fetch failed:", error);
    return { count: 0, streak: 0 };
  }
}
