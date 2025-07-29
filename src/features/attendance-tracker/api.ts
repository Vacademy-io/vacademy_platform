import axios from "axios";
import { AttendanceReport } from "./types";

const BASE_URL = "https://backend-stage.vacademy.io";
const ENDPOINT = "/admin-core-service/live-session-report/by-batch-session";

/**
 * Fetches attendance report data from the API.
 */
export async function fetchAttendanceReport(
  batchSessionId: string,
  startDate: string,
  endDate: string
): Promise<AttendanceReport> {
  const token = import.meta.env.VITE_API_TOKEN;
  if (!token) {
    throw new Error("Missing API token. Define VITE_API_TOKEN in your environment.");
  }
  try {
    const response = await axios.get<AttendanceReport | { data: AttendanceReport }>(
      `${BASE_URL}${ENDPOINT}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          batchSessionId,
          startDate,
          endDate,
        },
      }
    );
    // Unwrap response: API may return array directly or under `data` property
    const raw = response.data as AttendanceReport | { data: AttendanceReport };
    if (Array.isArray(raw)) {
      return raw;
    } else if (raw && Array.isArray((raw as any).data)) {
      return (raw as any).data;
    } else {
      console.warn('Unexpected attendance report response shape:', raw);
      return [];
    }
  } catch (error) {
    console.error("Error fetching attendance report:", error);
    throw error;
  }
} 