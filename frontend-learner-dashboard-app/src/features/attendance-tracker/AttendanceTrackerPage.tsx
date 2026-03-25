import React, { useState } from "react";
import { fetchAttendanceReport } from "./api";
import { transformAttendanceData } from "./utils";
import { AttendanceTable } from "./AttendanceTable";

export const AttendanceTrackerPage: React.FC = () => {
  const [batchSessionId, setBatchSessionId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<import("./types").Session[]>([]);
  const [rows, setRows] = useState<
    { fullName: string; attendanceBySession: Record<string, string | null> }[]
  >([]);

  const handleFetch = async () => {
    if (!batchSessionId || !startDate || !endDate) {
      setError("Please provide batchSessionId, startDate, and endDate.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAttendanceReport(batchSessionId, startDate, endDate);
      const transformed = transformAttendanceData(data);
      setSessions(transformed.sessions);
      setRows(transformed.rows);
    } catch (err) {
      console.error(err);
      setError((err as Error).message || "Failed to fetch attendance report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Attendance Tracker</h1>
      <div style={{ marginBottom: "1rem" }}>
        <label>
          Batch Session ID:
          <input
            type="text"
            value={batchSessionId}
            onChange={(e) => setBatchSessionId(e.target.value)}
            style={{ margin: "0 1rem" }}
          />
        </label>
        <label>
          Start Date:
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ margin: "0 1rem" }}
          />
        </label>
        <label>
          End Date:
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ margin: "0 1rem" }}
          />
        </label>
        <button onClick={handleFetch} disabled={loading} style={{ padding: "0.5rem 1rem" }}>
          {loading ? "Loading..." : "Fetch Report"}
        </button>
      </div>

      {error && <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>}

      {!loading && !error && rows.length > 0 && (
        <AttendanceTable sessions={sessions} rows={rows} />
      )}

      {!loading && !error && rows.length === 0 && <div>No data to display.</div>}
    </div>
  );
}; 