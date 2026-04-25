import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchFullAttendanceReport,
  type FullAttendanceReportStudent,
} from "@/services/attendance/getFullAttendanceReport";
import { convertHtmlToPdf } from "@/utils/html-to-pdf";

interface SearchParams {
  from?: string;
  to?: string;
  batchId?: string;
}

export default function AttendanceReportPage() {
  const search = useSearch({ from: "/reports/attendance/" }) as SearchParams;
  const [downloading, setDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const daysBack = useMemo(() => {
    if (search.from && search.to) {
      const ms = new Date(search.to).getTime() - new Date(search.from).getTime();
      return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }
    return 7;
  }, [search.from, search.to]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["attendance-report", search.batchId, search.from, search.to, daysBack],
    queryFn: () =>
      fetchFullAttendanceReport({
        batchId: search.batchId,
        daysBack,
        from: search.from,
        to: search.to,
      }),
    staleTime: 60 * 1000,
  });

  const student: FullAttendanceReportStudent | undefined = data?.students?.[0];

  const handleDownloadPdf = async () => {
    if (!reportRef.current || !student) return;
    setDownloading(true);
    try {
      const blob = await convertHtmlToPdf(reportRef.current.outerHTML);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-report-${student.startDate}-to-${student.endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <p className="text-red-600">Failed to load report.</p>
        <p className="mt-2 text-sm text-gray-500">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <p className="text-gray-700">No attendance data available for this period.</p>
        {data?.message && <p className="mt-2 text-sm text-gray-500">{data.message}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      {/* Action bar — not included in PDF */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800">Attendance Report</h1>
        <Button
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="gap-2"
        >
          <Download size={16} />
          {downloading ? "Generating..." : "Download PDF"}
        </Button>
      </div>

      {/* Report body — what gets exported to PDF */}
      <div
        ref={reportRef}
        style={{
          fontFamily: "Arial, sans-serif",
          maxWidth: 600,
          margin: "0 auto",
          padding: 24,
          background: "#ffffff",
        }}
      >
        <h2 style={{ color: "#1a1a1a" }}>Attendance Report</h2>
        <p style={{ color: "#444", lineHeight: 1.6 }}>
          Hi <strong>{student.fullName}</strong>, here's your attendance summary for{" "}
          <strong>{student.startDate}</strong> to <strong>{student.endDate}</strong>:
        </p>

        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 12,
            padding: 24,
            textAlign: "center",
            margin: "20px 0",
          }}
        >
          <div
            style={{
              fontSize: 44,
              fontWeight: "bold",
              color: "#16a34a",
              lineHeight: 1.2,
            }}
          >
            {student.attendancePercentage}%
          </div>
          <div style={{ color: "#444", marginTop: 12, fontSize: 14 }}>
            Attendance Rate
          </div>
          <div style={{ color: "#666", marginTop: 6, fontSize: 13 }}>
            {student.sessionsAttended} sessions attended &middot;{" "}
            {student.totalDurationMinutes} min total
          </div>
        </div>

        <h3 style={{ color: "#1e293b", marginTop: 24 }}>Session Details</h3>
        {/* Reuse the exact same pre-rendered HTML the backend builds for emails */}
        <div dangerouslySetInnerHTML={{ __html: student.sessionsTableHtml }} />

        <p style={{ color: "#444", lineHeight: 1.6, marginTop: 16 }}>
          Regular attendance is the key to success.
        </p>
        <p style={{ color: "#888", fontSize: 13, marginTop: 32 }}>
          Best regards,
          <br />
          {student.instituteName}
        </p>
      </div>
    </div>
  );
}
