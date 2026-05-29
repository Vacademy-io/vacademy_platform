import React from "react";
import { Session } from "./types";

interface AttendanceTableProps {
  sessions: Session[];
  rows: { fullName: string; attendanceBySession: Record<string, string | null> }[];
}

const cellStyle: React.CSSProperties = {
  border: "1px solid #ddd", // design-lint-ignore: static inline table border (raw <table>, no class support)
  padding: "8px",
  textAlign: "center",
};

const headerCellStyle: React.CSSProperties = {
  ...cellStyle,
  backgroundColor: "#f2f2f2", // design-lint-ignore: static inline table header fill
  fontWeight: "bold",
};

export const AttendanceTable: React.FC<AttendanceTableProps> = ({ sessions, rows }) => (
  <table style={{ borderCollapse: "collapse", width: "100%" }}>
    <thead>
      <tr>
        <th style={headerCellStyle}>Student Name</th>
        {sessions.map((session) => (
          <th key={session.scheduleId} style={headerCellStyle}>
            <div>{session.title}</div>
            <div style={{ fontSize: "0.8em", color: "#555" }}> {/* design-lint-ignore: static inline table meta text color */}
              {session.meetingDate} {session.startTime}
            </div>
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, idx) => (
        <tr key={idx}>
          <td style={cellStyle}>{row.fullName}</td>
          {sessions.map((session) => {
            const status = row.attendanceBySession[session.scheduleId];
            const backgroundColor =
              status === "PRESENT"
                ? "#d4edda" // design-lint-ignore: static inline attendance status fill (present)
                : status === "ABSENT"
                ? "#f8d7da" // design-lint-ignore: static inline attendance status fill (absent)
                : "#eee"; // design-lint-ignore: static inline attendance status fill (none)
            return (
              <td key={session.scheduleId} style={{ ...cellStyle, backgroundColor }}>
                {status || "-"}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  </table>
); 