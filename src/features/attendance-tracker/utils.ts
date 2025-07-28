import { AttendanceReport, Student, Session } from "./types";

export interface AttendanceRow {
  fullName: string;
  attendanceBySession: Record<string, string | null>;
}

/**
 * Transforms raw attendance data into table-friendly format.
 * @param data Raw AttendanceReport array from API.
 * @returns Object with sorted unique sessions and array of rows.
 */
export function transformAttendanceData(data: AttendanceReport): {
  sessions: Session[];
  rows: AttendanceRow[];
} {
  // Flatten all sessions and ensure uniqueness by scheduleId
  const sessionMap = new Map<string, Session>();
  data.forEach((student: Student) => {
    student.sessions.forEach((session: Session) => {
      if (!sessionMap.has(session.scheduleId)) {
        sessionMap.set(session.scheduleId, session);
      }
    });
  });

  // Sort sessions by meetingDate then startTime
  const sessions = Array.from(sessionMap.values()).sort((a, b) => {
    if (a.meetingDate !== b.meetingDate) {
      return a.meetingDate.localeCompare(b.meetingDate);
    }
    return a.startTime.localeCompare(b.startTime);
  });

  // Build rows
  const rows: AttendanceRow[] = data.map((student: Student) => {
    const attendanceBySession: Record<string, string | null> = {};
    sessions.forEach((session) => {
      const found = student.sessions.find((s) => s.scheduleId === session.scheduleId);
      attendanceBySession[session.scheduleId] = found?.attendanceStatus ?? null;
    });
    return { fullName: student.fullName, attendanceBySession };
  });

  return { sessions, rows };
} 