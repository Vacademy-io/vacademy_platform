import { fetchAttendanceReport as serviceFetchAttendanceReport } from "@/services/attendance/getAttendanceReport";
import { AttendanceReport } from "./types";

/**
 * Fetches attendance report data using the updated service implementation.
 */
export async function fetchAttendanceReport(
  _batchSessionId: string,
  startDate: string,
  endDate: string
): Promise<AttendanceReport> {
  // Delegate to service implementation which handles userId and static batchId
  return serviceFetchAttendanceReport({ startDate, endDate });
} 