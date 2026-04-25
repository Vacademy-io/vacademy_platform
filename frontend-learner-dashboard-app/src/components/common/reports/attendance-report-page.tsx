import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { Preferences } from "@capacitor/preferences";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchFullAttendanceReport,
  type FullAttendanceReportStudent,
} from "@/services/attendance/getFullAttendanceReport";
import { convertHtmlToPdf } from "@/utils/html-to-pdf";
import { getPublicUrl } from "@/services/upload_file";

interface InstituteBranding {
  name: string;
  logoUrl: string;
  address: string;
}

/**
 * Read InstituteDetails from Preferences (already cached at app boot) and
 * resolve the logo file ID to a public URL. Returns null if not available.
 */
async function loadInstituteBranding(): Promise<InstituteBranding | null> {
  try {
    const stored = await Preferences.get({ key: "InstituteDetails" });
    if (!stored.value) return null;
    const details = JSON.parse(stored.value) as Record<string, unknown>;

    const name = (details.institute_name as string) || "";
    const logoFileId = (details.institute_logo_file_id as string) || "";
    const addressLine = (details.address as string) || "";
    const city = (details.city as string) || "";
    const state = (details.state as string) || "";
    const country = (details.country as string) || "";

    const logoUrl = logoFileId ? await getPublicUrl(logoFileId).catch(() => "") : "";
    const addressParts = [addressLine, city, state, country].filter(Boolean);
    return { name, logoUrl, address: addressParts.join(", ") };
  } catch (e) {
    console.warn("[Report] Could not load institute branding:", e);
    return null;
  }
}

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

  // Fetch institute branding (logo + address) lazily — used for the page header & PDF.
  // Loaded from Preferences (already cached at app boot) + on-demand logo URL resolution.
  const { data: branding } = useQuery({
    queryKey: ["institute-branding-for-report"],
    queryFn: loadInstituteBranding,
    staleTime: 10 * 60 * 1000, // 10 min — branding doesn't change often
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
        {/* Branded letterhead — institute logo + name + address.
            Branding is fetched on the frontend (from Preferences + media service)
            so the email response stays lightweight. */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            borderBottom: "2px solid #e2e8f0",
            paddingBottom: 16,
            marginBottom: 20,
          }}
        >
          <tbody>
            <tr>
              {branding?.logoUrl && (
                <td style={{ width: 80, verticalAlign: "middle", paddingRight: 16 }}>
                  <img
                    src={branding.logoUrl}
                    alt={branding.name || student.instituteName}
                    crossOrigin="anonymous"
                    style={{
                      width: 64,
                      height: 64,
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                </td>
              )}
              <td style={{ verticalAlign: "middle" }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: "bold",
                    color: "#1a1a1a",
                    lineHeight: 1.2,
                  }}
                >
                  {branding?.name || student.instituteName}
                </div>
                {branding?.address && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      marginTop: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    {branding.address}
                  </div>
                )}
              </td>
              <td style={{ textAlign: "right", verticalAlign: "top", fontSize: 11, color: "#94a3b8" }}>
                <div>Generated</div>
                <div style={{ marginTop: 2 }}>{new Date().toLocaleDateString()}</div>
              </td>
            </tr>
          </tbody>
        </table>

        <h2 style={{ color: "#1a1a1a", marginTop: 0 }}>Attendance Report</h2>
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
