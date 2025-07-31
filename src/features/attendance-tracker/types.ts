export interface Session {
  scheduleId: string;
  sessionId: string;
  title: string;
  meetingDate: string; // format: YYYY-MM-DD
  startTime: string; // format: HH:mm:ss
  lastEntryTime?: string; // format: HH:mm:ss
  attendanceStatus: "PRESENT" | "ABSENT" | null;
  attendanceDetails?: any;
  attendanceTimestamp?: string; // ISO datetime
}

export interface Student {
  studentId: string;
  fullName: string;
  email: string;
  sessions: Session[];
}

export type AttendanceReport = Student[]; 