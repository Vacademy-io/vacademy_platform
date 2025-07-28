import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet";
import { useEffect, useMemo, useState } from "react";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { format, isAfter, isBefore, parse, parseISO, startOfDay, subDays, subMonths, subYears } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, CaretDownIcon } from "@radix-ui/react-icons";
import { Checkbox } from "@/components/ui/checkbox";
import { MyPagination } from "@/components/design-system/pagination";
import { fetchAttendanceReport } from "@/services/attendance/getAttendanceReport";

export const Route = createFileRoute("/learning-centre/attendance/")({
  component: RouteComponent,
});

// ---------------------------------------------
// Types & Mock Data
// ---------------------------------------------
interface ClassAttendance {
  id: number;
  title: string;
  date: string; // "MMM dd, yyyy" or raw date
  time: string; // time info, now unused
  subject: string;
  batch: string;
  classType: "Public" | "Private";
  status: "Present" | "Absent";
}
// Define API session item and student wrapper types
interface SessionApiItem {
  scheduleId: string;
  sessionId: string;
  title: string;
  meetingDate: string; // YYYY-MM-DD
  startTime?: string;  // HH:mm:ss
  lastEntryTime?: string;
  isPrivate?: boolean;
  attendanceStatus: "PRESENT" | "ABSENT" | null;
}
interface StudentAttendanceApi {
  sessions: SessionApiItem[];
}

// Temporarily keep mock data for fallback or loading state reference
const MOCK_DATA: ClassAttendance[] = [];

// ---------------------------------------------
// Component
// ---------------------------------------------
function RouteComponent() {
  /* --------------------------------------------------------
   * Local state & Nav heading
   * ----------------------------------------------------- */
  const { setNavHeading } = useNavHeadingStore();
  useEffect(() => {
    setNavHeading("My Attendance");
  }, [setNavHeading]);

  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [batch, setBatch] = useState<string>("All Batches");
  const [subject, setSubject] = useState<string>("All Subjects");
  const [classType, setClassType] = useState<string>("All Types");

  /* --------------------------------------------------------
   * Attendance data fetched from API
   * ----------------------------------------------------- */
  const [attendanceData, setAttendanceData] = useState<ClassAttendance[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Effect: fetch attendance on initial load
  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      try {
        setIsLoading(true);
        const batchSessionId = "14b2df53-4fda-4c18-9ddf-f3e69508f3cc"; // TODO: Replace with dynamic value if available

        // Fetch full dataset once with wide date range
        const startDate = format(new Date(0), "yyyy-MM-dd"); // Unix epoch start
        const endDate = format(new Date(), "yyyy-MM-dd");

        const apiData = await fetchAttendanceReport({
          batchSessionId,
          startDate,
          endDate,
        });

        // Unwrap array of students or sessions
        const rawArray: StudentAttendanceApi[] | SessionApiItem[] = Array.isArray(apiData)
          ? apiData
          : Array.isArray(apiData?.data)
            ? apiData.data
            : [];

        // Flatten all sessions
        const sessionItems: SessionApiItem[] =
          (rawArray as StudentAttendanceApi[])[0]?.sessions !== undefined
            ? (rawArray as StudentAttendanceApi[]).flatMap((s) => s.sessions)
            : (rawArray as SessionApiItem[]);

        // Map sessions to ClassAttendance
        const transformed: ClassAttendance[] = sessionItems.map((session: SessionApiItem, idx: number) => ({
          id: idx,
          title: session.title,
          date: format(parseISO(session.meetingDate), "MMM dd, yyyy"),
          time: "",
          subject: "-",
          batch: "-",
          classType: session.isPrivate ? "Private" : "Public",
          status: session.attendanceStatus === "PRESENT" ? "Present" : "Absent",
        }));

        setAttendanceData(transformed);
      } catch (err) {
        console.error("Failed to fetch attendance report", err);
        setError((err as Error).message || "Failed to load attendance data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // ---------------------------------------------
  // Row selection (checkbox column)
  // ---------------------------------------------
  const [rowSelections, setRowSelections] = useState<Record<number, boolean>>({});

  // Pagination state
  const pageSize = 10;
  const [page, setPage] = useState(0);

  /* --------------------------------------------------------
   * Filtering logic
   * ----------------------------------------------------- */
  const filteredData = useMemo(() => {
    const source = attendanceData.length > 0 ? attendanceData : MOCK_DATA;
    return source.filter((cls) => {
      // Date range filter
      const dateObj = parse(cls.date, "MMM dd, yyyy", new Date());
      if (dateRange.from && isBefore(dateObj, dateRange.from)) return false;
      if (dateRange.to && isAfter(dateObj, dateRange.to)) return false;

      // Batch filter
      if (batch !== "All Batches" && cls.batch !== batch) return false;

      // Subject filter
      if (subject !== "All Subjects" && cls.subject !== subject) return false;

      // Class type filter
      if (classType !== "All Types" && cls.classType !== classType) return false;

      return true;
    });
  }, [dateRange, batch, subject, classType, attendanceData]);

  // Ensure page within bounds when filters change
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));

  useEffect(() => {
    if (page >= totalPages) setPage(totalPages - 1);
  }, [totalPages]);

  const paginatedData = useMemo(() => {
    const start = page * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page]);

  // Row selection helpers (dependent on paginatedData)
  // ---------------------------------------------
  const allRowsSelected =
    paginatedData.length > 0 && paginatedData.every((cls) => rowSelections[cls.id]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const sel: Record<number, boolean> = {};
      paginatedData.forEach((cls) => {
        sel[cls.id] = true;
      });
      setRowSelections(sel);
    } else {
      setRowSelections({});
    }
  };

  const toggleRowSelection = (id: number, checked: boolean) => {
    setRowSelections((prev) => {
      const newSel = { ...prev };
      if (checked) newSel[id] = true;
      else delete newSel[id];
      return newSel;
    });
  };

  /* --------------------------------------------------------
   * UI helpers
   * ----------------------------------------------------- */
  const clearFilters = () => {
    setDateRange({});
    setBatch("All Batches");
    setSubject("All Subjects");
    setClassType("All Types");
  };

  /* --------------------------------------------------------
   * Render
   * ----------------------------------------------------- */
  return (
    <LayoutContainer>
      <Helmet>
        <title>My Attendance</title>
        <meta name="description" content="Track your attendance for live classes and sessions" />
      </Helmet>

      <div className="flex flex-col gap-4">
        {/* Heading */}
        <div>
          <h1 className="text-2xl font-semibold text-neutral-800">My Attendance</h1>
          <p className="text-neutral-600">Track your attendance for live classes and sessions</p>
        </div>

        {/* Filters card */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {/* Date Range */}
            <RangeDateFilter range={dateRange} onChange={setDateRange} />

            {/* Batch */}
            <SimpleDropdown
              label="Batch"
              value={batch}
              options={["All Batches", "Batch A", "Batch B", "Batch C"]}
              onSelect={setBatch}
            />

            {/* Subject */}
            <SimpleDropdown
              label="Subject"
              value={subject}
              options={[
                "All Subjects",
                "React Development",
                "JavaScript",
                "Full Stack Development",
              ]}
              onSelect={setSubject}
            />

            {/* Class Type */}
            <SimpleDropdown
              label="Class Type"
              value={classType}
              options={["All Types", "Public", "Private"]}
              onSelect={setClassType}
            />
          </div>

          {/* Clear Filters button */}
          {(dateRange.from || dateRange.to || batch !== "All Batches" || subject !== "All Subjects" || classType !== "All Types") && (
            <div className="mt-4 text-right">
              <button
                onClick={clearFilters}
                className="inline-flex items-center rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        {/* Summary of fetched data */}
        {!isLoading && !error && attendanceData.length > 0 && (
          <div className="px-4 text-sm text-neutral-600">
            {`Showing ${filteredData.length} of ${attendanceData.length} attendance records`}
          </div>
        )}
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[800px] table-auto border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-primary-100 text-left text-sm font-medium text-neutral-600">
                  <th className="w-[40px] px-4 py-3">
                    <Checkbox
                      checked={allRowsSelected}
                      onCheckedChange={(val) => toggleSelectAll(!!val)}
                      className="border-neutral-400 bg-white text-neutral-600 data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
                    />
                  </th>
                  <th className="px-4 py-3">Live Class Title</th>
                  <th className="px-4 py-3">Date &amp; Time</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Class Type</th>
                  <th className="px-4 py-3">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-neutral-500">
                      Loading attendance data...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-danger-600">
                      Error: {error}
                    </td>
                  </tr>
                ) : filteredData.length > 0 ? (
                  paginatedData.map((cls) => (
                    <tr key={cls.id} className="border-b border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={!!rowSelections[cls.id]}
                          onCheckedChange={(val) => toggleRowSelection(cls.id, !!val)}
                          className="flex size-4 items-center justify-center border-neutral-400 text-neutral-600 shadow-none data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
                        />
                      </td>
                      <td className="px-4 py-3">{cls.title}</td>
                      <td className="px-4 py-3">
                        {cls.date}
                      </td>
                      <td className="px-4 py-3">{cls.subject}</td>
                      <td className="px-4 py-3">{cls.batch}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls.classType === "Public" ? "bg-primary-50 text-primary-600" : "bg-purple-50 text-purple-600"}`}
                        >
                          {cls.classType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-0.5 text-xs font-medium ${cls.status === "Present" ? "bg-success-50 text-success-600" : "bg-danger-100 text-danger-600"}`}
                        >
                          {cls.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-neutral-500">
                      No classes found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination controls */}
        <div className="mt-4">
          <MyPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </div>
    </LayoutContainer>
  );
}

// ---------------------------------------------
// Helper components
// ---------------------------------------------
interface RangeDateFilterProps {
  range: { from?: Date; to?: Date };
  onChange: (r: { from?: Date; to?: Date }) => void;
}

function RangeDateFilter({ range, onChange }: RangeDateFilterProps) {
  const { from, to } = range;
  return (
    <div className="w-full">
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={`flex h-9 w-full items-center justify-between rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm ${from || to ? "text-neutral-900" : "text-neutral-500"} focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
          >
            {from && to ? (
              <>{format(from, "dd/MM/yy")} - {format(to, "dd/MM/yy")}</>
            ) : from ? (
              <>From {format(from, "dd/MM/yy")}</>
            ) : (
              <>Select date range</>
            )}
            <CalendarIcon className="ml-2 size-4 text-neutral-500" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex gap-3">
            <Calendar
              mode="range"
              selected={range}
              onSelect={(sel: { from?: Date; to?: Date } | undefined) => onChange(sel || {})}
              className="border-r border-neutral-100 pr-3"
            />
            {/* Quick presets */}
            <div className="flex flex-col gap-2 pt-1">
              <h4 className="mb-1 text-xs font-medium text-neutral-500">Quick Select</h4>
              {[
                { label: "Past Day", from: startOfDay(subDays(new Date(), 1)) },
                { label: "Past Week", from: startOfDay(subDays(new Date(), 7)) },
                { label: "Past Month", from: startOfDay(subMonths(new Date(), 1)) },
                { label: "Past 6 Months", from: startOfDay(subMonths(new Date(), 6)) },
                { label: "Past Year", from: startOfDay(subYears(new Date(), 1)) },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => onChange({ from: preset.from, to: new Date() })}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-left text-xs hover:border-neutral-300 hover:bg-neutral-50"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface SimpleDropdownProps {
  label: string;
  value: string;
  options: string[];
  onSelect: (val: string) => void;
}

function SimpleDropdown({ label, value, options, onSelect }: SimpleDropdownProps) {
  return (
    <div className="w-full">
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={`flex h-9 w-full items-center justify-between rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm ${value !== options[0] ? "text-neutral-900" : "text-neutral-500"} focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
          >
            {value || label}
            <CaretDownIcon className="ml-2 size-4 text-neutral-500" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex flex-col gap-2">
            <h4 className="mb-1 text-xs font-medium text-neutral-500">{label}</h4>
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => onSelect(opt)}
                className={`w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-left text-xs hover:border-neutral-300 hover:bg-neutral-50 ${value === opt ? "bg-primary-50 text-primary-600" : ""}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
} 