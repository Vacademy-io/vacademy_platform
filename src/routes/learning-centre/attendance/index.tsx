import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet";
import { useEffect, useMemo, useState } from "react";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import {
  format,
  parseISO,
  startOfDay,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, CaretDownIcon } from "@radix-ui/react-icons";
import { Checkbox } from "@/components/ui/checkbox";
import { MyPagination } from "@/components/design-system/pagination";
import {
  fetchAttendanceReport,
  StudentAttendanceApi,
} from "@/services/attendance/getAttendanceReport";
import {
  BatchData,
  BatchType,
  useGetBatchesQuery,
} from "@/services/get-batches";
import { useQuery } from "@tanstack/react-query";
import { isNullOrEmptyOrUndefined } from "@/lib/utils";

export const Route = createFileRoute("/learning-centre/attendance/")({
  component: RouteComponent,
});

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
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const { data: batches } = useGetBatchesQuery();

  // Extract batch options for dropdown
  const batchOptions = useMemo(() => {
    if (!batches || !Array.isArray(batches))
      return [{ label: "All Batches", value: null }];

    const extractedBatches = batches.flatMap((batchData: BatchData) =>
      batchData.batches.map((batch: BatchType) => ({
        label: `${batch.batch_name} (${batch.invite_code})`,
        value: batch.package_session_id,
      }))
    );

    return [{ label: "All Batches", value: null }, ...extractedBatches];
  }, [batches]);

  // Set the first batch as default when batches are loaded
  useEffect(() => {
    if (batchOptions.length > 1 && selectedBatchId === null) {
      // Set the first actual batch (skip "All Batches" option)
      const firstBatch = batchOptions[1];
      if (firstBatch && firstBatch.value) {
        setSelectedBatchId(firstBatch.value);
      }
    }
  }, [batchOptions, selectedBatchId]);

  const {
    data: attendanceData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["ATTENDANCE_DATA", selectedBatchId, dateRange],
    queryFn: async () => {
      // Use date range if provided, otherwise use wide range
      const startDate = dateRange.from
        ? format(dateRange.from, "yyyy-MM-dd")
        : format(new Date(0), "yyyy-MM-dd"); // Unix epoch start
      const endDate = dateRange.to
        ? format(dateRange.to, "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd");

      const response = await fetchAttendanceReport({
        startDate,
        endDate,
        batchId: selectedBatchId || "",
      });

      return response as StudentAttendanceApi;
    },
    enabled: !!selectedBatchId, // Only run query when we have a selected batch ID
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const [rowSelections, setRowSelections] = useState<Record<number, boolean>>(
    {}
  );

  const pageSize = 10;
  const [page, setPage] = useState(0);

  const totalPages = Math.max(
    1,
    Math.ceil((attendanceData?.schedules?.length ?? 0) / pageSize)
  );

  useEffect(() => {
    if (page >= totalPages) setPage(totalPages - 1);
  }, [page, totalPages]);

  const paginatedData = useMemo(() => {
    const start = page * pageSize;
    return attendanceData?.schedules?.slice(start, start + pageSize);
  }, [attendanceData, page]);

  const allRowsSelected =
    !isNullOrEmptyOrUndefined(paginatedData) &&
    paginatedData?.every((_, idx) => rowSelections[idx]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const sel: Record<number, boolean> = {};
      paginatedData?.forEach((_, idx) => {
        sel[idx] = true;
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

  const clearFilters = () => {
    setDateRange({});
    setSelectedBatchId(null);
  };

  const selectedBatchLabel = useMemo(() => {
    if (!selectedBatchId) return "All Batches";
    const selectedBatch = batchOptions.find(
      (option) => option.value === selectedBatchId
    );
    return selectedBatch?.label || "All Batches";
  }, [selectedBatchId, batchOptions]);

  return (
    <LayoutContainer>
      <Helmet>
        <title>My Attendance</title>
        <meta
          name="description"
          content="Track your attendance for live classes and sessions"
        />
      </Helmet>

      <div className="flex flex-col gap-4">
        {/* Heading */}
        <div>
          <h1 className="text-2xl font-semibold text-neutral-800">
            My Attendance
          </h1>
          <p className="text-neutral-600">
            Track your attendance for live classes and sessions
          </p>
        </div>

        {/* Filters card */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Date Range */}
            <RangeDateFilter range={dateRange} onChange={setDateRange} />

            {/* Batch */}
            <BatchDropdown
              label="Batch"
              value={selectedBatchLabel}
              options={batchOptions}
              onSelect={(batchId) => setSelectedBatchId(batchId)}
            />
          </div>

          {/* Clear Filters button */}
          {(dateRange.from || dateRange.to || selectedBatchId !== null) && (
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
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Class Type</th>
                  <th className="px-4 py-3">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-8 text-center text-neutral-500"
                    >
                      Loading attendance data...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-danger-600">
                      Error: {(error as Error)?.message || "An error occurred"}
                    </td>
                  </tr>
                ) : !isNullOrEmptyOrUndefined(paginatedData) ? (
                  paginatedData?.map((cls, idx) => (
                    <tr
                      key={cls.sessionId}
                      className="border-b border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50"
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={!!rowSelections[idx]}
                          onCheckedChange={(val) =>
                            toggleRowSelection(idx, !!val)
                          }
                          className="flex size-4 items-center justify-center border-neutral-400 text-neutral-600 shadow-none data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
                        />
                      </td>
                      <td className="px-4 py-3">{cls.sessionTitle}</td>
                      <td className="px-4 py-3">
                        {format(parseISO(cls.meetingDate), "MMM dd, yyyy")}
                      </td>
                      <td className="px-4 py-3">{selectedBatchLabel}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            cls.accessLevel === "private"
                              ? "bg-primary-50 text-primary-600"
                              : "bg-purple-50 text-purple-600"
                          }`}
                        >
                          {cls.accessLevel === "private" ? "Private" : "Public"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                            cls.attendanceStatus === "PRESENT"
                              ? "bg-success-50 text-success-600"
                              : "bg-danger-100 text-danger-600"
                          }`}
                        >
                          {cls.attendanceStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-8 text-center text-neutral-500"
                    >
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
            className={`flex h-9 w-full items-center justify-between rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm ${
              from || to ? "text-neutral-900" : "text-neutral-500"
            } focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
          >
            {from && to ? (
              <>
                {format(from, "dd/MM/yy")} - {format(to, "dd/MM/yy")}
              </>
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
              onSelect={(sel: { from?: Date; to?: Date } | undefined) =>
                onChange(sel || {})
              }
              className="border-r border-neutral-100 pr-3"
            />
            {/* Quick presets */}
            <div className="flex flex-col gap-2 pt-1">
              <h4 className="mb-1 text-xs font-medium text-neutral-500">
                Quick Select
              </h4>
              {[
                { label: "Past Day", from: startOfDay(subDays(new Date(), 1)) },
                {
                  label: "Past Week",
                  from: startOfDay(subDays(new Date(), 7)),
                },
                {
                  label: "Past Month",
                  from: startOfDay(subMonths(new Date(), 1)),
                },
                {
                  label: "Past 6 Months",
                  from: startOfDay(subMonths(new Date(), 6)),
                },
                {
                  label: "Past Year",
                  from: startOfDay(subYears(new Date(), 1)),
                },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() =>
                    onChange({ from: preset.from, to: new Date() })
                  }
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

// New component for batch dropdown with batch ID handling
interface BatchDropdownProps {
  label: string;
  value: string;
  options: Array<{ label: string; value: string | null }>;
  onSelect: (batchId: string | null) => void;
}

function BatchDropdown({
  label,
  value,
  options,
  onSelect,
}: BatchDropdownProps) {
  return (
    <div className="w-full">
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={`flex h-9 w-full items-center justify-between rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm ${
              value !== "All Batches" ? "text-neutral-900" : "text-neutral-500"
            } focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
          >
            {value || label}
            <CaretDownIcon className="ml-2 size-4 text-neutral-500" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex flex-col gap-2">
            <h4 className="mb-1 text-xs font-medium text-neutral-500">
              {label}
            </h4>
            {options.map((opt) => (
              <button
                key={opt.value || "all"}
                onClick={() => onSelect(opt.value)}
                className={`w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-left text-xs hover:border-neutral-300 hover:bg-neutral-50 ${
                  value === opt.label ? "bg-primary-50 text-primary-600" : ""
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
