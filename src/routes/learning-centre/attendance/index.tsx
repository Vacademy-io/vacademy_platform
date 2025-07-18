import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet";
import { useEffect, useMemo, useState } from "react";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { format, isAfter, isBefore, parse, startOfDay, subDays, subMonths, subYears } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, CaretDownIcon } from "@radix-ui/react-icons";
import { Checkbox } from "@/components/ui/checkbox";
import { MyPagination } from "@/components/design-system/pagination";

export const Route = createFileRoute("/learning-centre/attendance/")({
  component: RouteComponent,
});

// ---------------------------------------------
// Types & Mock Data
// ---------------------------------------------
interface ClassAttendance {
  id: number;
  title: string;
  date: string; // "Jan 15, 2024"
  time: string; // "10:00 AM"
  subject: string;
  batch: string;
  classType: "Public" | "Private";
  status: "Present" | "Absent";
}

const MOCK_DATA: ClassAttendance[] = [
  {
    id: 1,
    title: "Introduction to React Hooks",
    date: "Jan 15, 2024",
    time: "10:00 AM",
    subject: "React Development",
    batch: "Batch A",
    classType: "Public",
    status: "Present",
  },
  {
    id: 2,
    title: "Advanced State Management",
    date: "Jan 16, 2024",
    time: "2:00 PM",
    subject: "React Development",
    batch: "Batch A",
    classType: "Private",
    status: "Absent",
  },
  {
    id: 3,
    title: "JavaScript Fundamentals",
    date: "Jan 17, 2024",
    time: "11:00 AM",
    subject: "JavaScript",
    batch: "Batch A",
    classType: "Public",
    status: "Present",
  },
  {
    id: 4,
    title: "API Integration Workshop",
    date: "Jan 18, 2024",
    time: "3:00 PM",
    subject: "Full Stack Development",
    batch: "Batch A",
    classType: "Private",
    status: "Present",
  },
  // --- added extra mock rows for pagination demo ---
  {
    id: 5,
    title: "TypeScript Basics",
    date: "Jan 19, 2024",
    time: "09:00 AM",
    subject: "TypeScript",
    batch: "Batch A",
    classType: "Public",
    status: "Present",
  },
  {
    id: 6,
    title: "CSS Grid Layout",
    date: "Jan 20, 2024",
    time: "12:00 PM",
    subject: "CSS",
    batch: "Batch B",
    classType: "Public",
    status: "Absent",
  },
  {
    id: 7,
    title: "Functional Programming in JS",
    date: "Jan 21, 2024",
    time: "01:00 PM",
    subject: "JavaScript",
    batch: "Batch B",
    classType: "Private",
    status: "Present",
  },
  {
    id: 8,
    title: "React Performance Optimisation",
    date: "Jan 22, 2024",
    time: "10:30 AM",
    subject: "React Development",
    batch: "Batch B",
    classType: "Public",
    status: "Present",
  },
  {
    id: 9,
    title: "GraphQL Introduction",
    date: "Jan 23, 2024",
    time: "02:30 PM",
    subject: "GraphQL",
    batch: "Batch C",
    classType: "Public",
    status: "Absent",
  },
  {
    id: 10,
    title: "Node.js Streams",
    date: "Jan 24, 2024",
    time: "11:15 AM",
    subject: "Node.js",
    batch: "Batch C",
    classType: "Private",
    status: "Present",
  },
  {
    id: 11,
    title: "Unit Testing with Jest",
    date: "Jan 25, 2024",
    time: "04:00 PM",
    subject: "Testing",
    batch: "Batch C",
    classType: "Public",
    status: "Present",
  },
  {
    id: 12,
    title: "Docker Basics",
    date: "Jan 26, 2024",
    time: "09:45 AM",
    subject: "DevOps",
    batch: "Batch A",
    classType: "Private",
    status: "Absent",
  },
  {
    id: 13,
    title: "CI/CD with GitHub Actions",
    date: "Jan 27, 2024",
    time: "02:15 PM",
    subject: "DevOps",
    batch: "Batch A",
    classType: "Public",
    status: "Present",
  },
  {
    id: 14,
    title: "Introduction to Redux",
    date: "Jan 28, 2024",
    time: "10:00 AM",
    subject: "State Management",
    batch: "Batch A",
    classType: "Public",
    status: "Present",
  },
  {
    id: 15,
    title: "Advanced TypeScript Types",
    date: "Jan 29, 2024",
    time: "01:30 PM",
    subject: "TypeScript",
    batch: "Batch B",
    classType: "Private",
    status: "Absent",
  },
  {
    id: 16,
    title: "Sass Fundamentals",
    date: "Jan 30, 2024",
    time: "11:00 AM",
    subject: "CSS",
    batch: "Batch C",
    classType: "Public",
    status: "Present",
  },
  {
    id: 17,
    title: "Responsive Design Best Practices",
    date: "Jan 31, 2024",
    time: "09:30 AM",
    subject: "Design",
    batch: "Batch A",
    classType: "Public",
    status: "Present",
  },
  {
    id: 18,
    title: "Introduction to Web Accessibility",
    date: "Feb 01, 2024",
    time: "02:00 PM",
    subject: "Accessibility",
    batch: "Batch B",
    classType: "Private",
    status: "Absent",
  },
  {
    id: 19,
    title: "Debugging JavaScript Effectively",
    date: "Feb 02, 2024",
    time: "01:00 PM",
    subject: "JavaScript",
    batch: "Batch C",
    classType: "Public",
    status: "Present",
  },
  {
    id: 20,
    title: "Introduction to Next.js",
    date: "Feb 03, 2024",
    time: "10:15 AM",
    subject: "React Development",
    batch: "Batch A",
    classType: "Private",
    status: "Present",
  },
  {
    id: 21,
    title: "Server-Side Rendering with React",
    date: "Feb 04, 2024",
    time: "03:30 PM",
    subject: "React Development",
    batch: "Batch B",
    classType: "Public",
    status: "Absent",
  },
  {
    id: 22,
    title: "Webpack Deep Dive",
    date: "Feb 05, 2024",
    time: "11:45 AM",
    subject: "Tooling",
    batch: "Batch C",
    classType: "Public",
    status: "Present",
  },
  {
    id: 23,
    title: "State Machines with XState",
    date: "Feb 06, 2024",
    time: "12:30 PM",
    subject: "State Management",
    batch: "Batch A",
    classType: "Private",
    status: "Present",
  },
  {
    id: 24,
    title: "Unit Testing React Components",
    date: "Feb 07, 2024",
    time: "09:00 AM",
    subject: "Testing",
    batch: "Batch B",
    classType: "Public",
    status: "Absent",
  },
  {
    id: 25,
    title: "End-to-End Testing with Cypress",
    date: "Feb 08, 2024",
    time: "02:20 PM",
    subject: "Testing",
    batch: "Batch C",
    classType: "Private",
    status: "Present",
  },
  {
    id: 26,
    title: "GraphQL Advanced Queries",
    date: "Feb 09, 2024",
    time: "01:40 PM",
    subject: "GraphQL",
    batch: "Batch A",
    classType: "Public",
    status: "Present",
  },
  {
    id: 27,
    title: "Building REST APIs with Express",
    date: "Feb 10, 2024",
    time: "10:10 AM",
    subject: "Node.js",
    batch: "Batch B",
    classType: "Public",
    status: "Absent",
  },
  {
    id: 28,
    title: "Authentication with JWT",
    date: "Feb 11, 2024",
    time: "03:00 PM",
    subject: "Security",
    batch: "Batch C",
    classType: "Private",
    status: "Present",
  },
  {
    id: 29,
    title: "Introduction to Docker Compose",
    date: "Feb 12, 2024",
    time: "11:30 AM",
    subject: "DevOps",
    batch: "Batch A",
    classType: "Public",
    status: "Present",
  },
  {
    id: 30,
    title: "Monitoring Apps with Prometheus",
    date: "Feb 13, 2024",
    time: "09:50 AM",
    subject: "DevOps",
    batch: "Batch B",
    classType: "Public",
    status: "Absent",
  },
];

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
  const [batch, setBatch] = useState<string>("Batch A");
  const [subject, setSubject] = useState<string>("All Subjects");
  const [classType, setClassType] = useState<string>("All Types");

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
    return MOCK_DATA.filter((cls) => {
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
  }, [dateRange, batch, subject, classType]);

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
    setBatch("Batch A");
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
              options={["Batch A", "Batch B", "Batch C", "All Batches"]}
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
          {(dateRange.from || dateRange.to || batch !== "Batch A" || subject !== "All Subjects" || classType !== "All Types") && (
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
                {paginatedData.length > 0 ? (
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
                        {cls.date} at {cls.time}
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