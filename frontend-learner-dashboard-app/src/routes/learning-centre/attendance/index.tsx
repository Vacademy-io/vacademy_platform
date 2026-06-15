import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet";
import { useEffect, useMemo, useState } from "react";
import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import {
  format,
  startOfDay,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { formatDate } from "@/lib/format-date";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarBlank, CaretDown, CalendarX, Fire } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingState } from "@/components/design-system/states";
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
import { computeAttendanceStats } from "@/services/attendance/useAttendanceStats";
import { getTerminology, getTerminologyPlural } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";

export const Route = createFileRoute("/learning-centre/attendance/")({
  component: RouteComponent,
});

function RouteComponent() {
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
      return [{ label: `All ${getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch)}`, value: null }];

    const extractedBatches = batches.flatMap((batchData: BatchData) =>
      batchData.batches.map((batch: BatchType) => ({
        label: `${batch.batch_name} (${batch.invite_code})`,
        value: batch.package_session_id,
      }))
    );

    return [{ label: `All ${getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch)}`, value: null }, ...extractedBatches];
  }, [batches]);

  // Set the first batch as default when batches are loaded
  useEffect(() => {
    if (batchOptions.length > 1 && selectedBatchId === null) {
      // Set the first actual batch (skip `All ${getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch)}` option)
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

  // const [rowSelections, setRowSelections] = useState<Record<number, boolean>>(
  //   {}
  // );

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

  // const allRowsSelected =
  //   !isNullOrEmptyOrUndefined(paginatedData) &&
  //   paginatedData?.every((_, idx) => rowSelections[idx]);

  // const toggleSelectAll = (checked: boolean) => {
  //   if (checked) {
  //     const sel: Record<number, boolean> = {};
  //     paginatedData?.forEach((_, idx) => {
  //       sel[idx] = true;
  //     });
  //     setRowSelections(sel);
  //   } else {
  //     setRowSelections({});
  //   }
  // };

  // const toggleRowSelection = (id: number, checked: boolean) => {
  //   console.log(id, checked);
  //   setRowSelections((prev) => {
  //     const newSel = { ...prev };
  //     if (checked) newSel[id] = true;
  //     else delete newSel[id];
  //     return newSel;
  //   });
  // };

  const clearFilters = () => {
    setDateRange({});
    setSelectedBatchId(null);
  };

  const selectedBatchLabel = useMemo(() => {
    if (!selectedBatchId) return `All ${getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch)}`;
    const selectedBatch = batchOptions.find(
      (option) => option.value === selectedBatchId
    );
    return selectedBatch?.label || `All ${getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch)}`;
  }, [selectedBatchId, batchOptions]);

  const attendanceStats = useMemo(() => {
    if (!attendanceData?.schedules) return null;
    return computeAttendanceStats(attendanceData.schedules);
  }, [attendanceData]);

  return (
    <LayoutContainer>
      <Helmet>
        <title>{document?.title || "My Attendance"}</title>
        <meta
          name="description"
          content="Track your attendance for live classes and sessions"
        />
      </Helmet>

      <div className="flex flex-col gap-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
            {isLoading ? (
              <div className="mx-auto h-8 w-12 animate-pulse rounded bg-neutral-100" />
            ) : (
              <div
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  (attendanceStats?.attendancePercentage ?? 0) >= 75
                    ? "text-success-600"
                    : (attendanceStats?.attendancePercentage ?? 0) >= 50
                      ? "text-warning-600"
                      : "text-danger-600",
                )}
              >
                {attendanceStats?.attendancePercentage ?? 0}%
              </div>
            )}
            <div className="mt-1 text-xs text-neutral-500">Overall %</div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
            {isLoading ? (
              <div className="mx-auto h-8 w-12 animate-pulse rounded bg-neutral-100" />
            ) : (
              <div className="flex items-center justify-center gap-1 text-2xl font-bold tabular-nums text-neutral-800">
                <Fire
                  size={22}
                  weight="fill"
                  aria-hidden="true"
                  className={cn(
                    attendanceStats?.currentStreak
                      ? "text-warning-500 [.ui-play_&]:text-play-warn"
                      : "text-neutral-300",
                  )}
                />
                {attendanceStats?.currentStreak ?? 0}
              </div>
            )}
            <div className="mt-1 text-xs text-neutral-500">Day Streak</div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
            {isLoading ? (
              <div className="mx-auto h-8 w-12 animate-pulse rounded bg-neutral-100" />
            ) : (
              <div className="text-2xl font-bold tabular-nums text-success-600">
                {attendanceStats?.presentDays ?? 0}
              </div>
            )}
            <div className="mt-1 text-xs text-neutral-500">Days Present</div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-3 text-center">
            {isLoading ? (
              <div className="mx-auto h-8 w-12 animate-pulse rounded bg-neutral-100" />
            ) : (
              <div className="text-2xl font-bold tabular-nums text-danger-500">
                {attendanceStats?.absentDays ?? 0}
              </div>
            )}
            <div className="mt-1 text-xs text-neutral-500">Days Absent</div>
          </div>
        </div>

        {/* Filters card */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Date Range */}
            <RangeDateFilter range={dateRange} onChange={setDateRange} />

            {/* Batch */}
            <BatchDropdown
              label={getTerminology(ContentTerms.Batch, SystemTerms.Batch)}
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

        {/* Mobile cards (visible on small screens) */}
        <div className="md:hidden">
          {isLoading ? (
            <LoadingState variant="list" count={4} />
          ) : error ? (
            <ErrorState
              variant="inline"
              message={(error as Error)?.message || "Could not load attendance data."}
            />
          ) : !isNullOrEmptyOrUndefined(paginatedData) ? (
            <div className="space-y-3">
              {paginatedData?.map((cls, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-neutral-200 bg-white p-3"
                >
                  <div className="mb-2 text-sm font-semibold text-neutral-800">
                    {cls.sessionTitle}
                  </div>
                  <div className="mb-2 text-xs text-neutral-600">
                    {formatDate(cls.meetingDate)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-caption font-medium",
                        cls.accessLevel === "private"
                          ? "bg-primary-50 text-primary-600"
                          : "bg-info-50 text-info-600",
                      )}
                    >
                      {cls.accessLevel === "private" ? "Private" : "Public"}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-3 py-0.5 text-caption font-medium",
                        cls.attendanceStatus === "PRESENT"
                          ? "bg-success-50 text-success-600"
                          : cls.attendanceStatus === "ABSENT"
                            ? "bg-danger-100 text-danger-600"
                            : "bg-neutral-100 text-neutral-500",
                      )}
                    >
                      {cls.attendanceStatus === "UNMARKED" ? "Unmarked" : cls.attendanceStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              icon={CalendarX}
              title="No classes found"
              description="No classes match the selected filters. Try a different date range."
              action={{ label: "Clear filters", onClick: clearFilters }}
              className="rounded-lg border border-neutral-200 bg-white"
            />
          )}
        </div>

        {/* Table (visible on md and larger) */}
        <div className="hidden overflow-hidden rounded-lg border border-neutral-200 md:block">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-table-wide table-auto border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-primary-100 text-left text-sm font-medium text-neutral-600">
                  {/* <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={allRowsSelected}
                      onCheckedChange={(val) => toggleSelectAll(!!val)}
                      className="border-neutral-400 bg-white text-neutral-600 data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
                    />
                  </th> */}
                  {/* Batch column removed: the attendance API does not return a
                      per-row batch, and printing the filter label here showed
                      false data for every row. */}
                  <th className="px-4 py-3">Live Class Title</th>
                  <th className="px-4 py-3">Date &amp; Time</th>
                  <th className="px-4 py-3">Class Type</th>
                  <th className="px-4 py-3">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="p-4">
                      <LoadingState variant="list" count={3} />
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={4} className="p-4">
                      <ErrorState
                        variant="inline"
                        message={(error as Error)?.message || "Could not load attendance data."}
                      />
                    </td>
                  </tr>
                ) : !isNullOrEmptyOrUndefined(paginatedData) ? (
                  paginatedData?.map((cls, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50"
                    >
                      {/* <td className="px-4 py-3">
                        <Checkbox
                          checked={!!rowSelections[idx]}
                          onCheckedChange={(val) => {
                            toggleRowSelection(idx, !!val);
                            console.log(rowSelections);
                          }}
                          className="flex size-4 items-center justify-center border-neutral-400 text-neutral-600 shadow-none data-[state=checked]:bg-primary-500 data-[state=checked]:text-white"
                        />
                      </td> */}
                      <td className="px-4 py-3">{cls.sessionTitle}</td>
                      <td className="px-4 py-3">
                        {formatDate(cls.meetingDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            cls.accessLevel === "private"
                              ? "bg-primary-50 text-primary-600"
                              : "bg-info-50 text-info-600",
                          )}
                        >
                          {cls.accessLevel === "private" ? "Private" : "Public"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-3 py-0.5 text-xs font-medium",
                            cls.attendanceStatus === "PRESENT"
                              ? "bg-success-50 text-success-600"
                              : cls.attendanceStatus === "ABSENT"
                                ? "bg-danger-100 text-danger-600"
                                : "bg-neutral-100 text-neutral-500",
                          )}
                        >
                          {cls.attendanceStatus === "UNMARKED" ? "Unmarked" : cls.attendanceStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-4">
                      <EmptyState
                        compact
                        icon={CalendarX}
                        title="No classes found"
                        description="No classes match the selected filters. Try a different date range."
                        action={{ label: "Clear filters", onClick: clearFilters }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination controls */}
        <div className="mt-4 flex justify-center md:justify-end">
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
            type="button"
            className={cn(
              "flex h-11 w-full items-center justify-between rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm",
              from || to ? "text-neutral-900" : "text-neutral-500",
              "focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500",
            )}
          >
            {from && to ? (
              <>
                {formatDate(from)} to {formatDate(to)}
              </>
            ) : from ? (
              <>From {formatDate(from)}</>
            ) : (
              <>Select date range</>
            )}
            <CalendarBlank className="ml-2 size-4 text-neutral-500" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-dialog-lg p-3 sm:w-auto" align="start">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Calendar
              mode="range"
              selected={range}
              onSelect={(sel: { from?: Date; to?: Date } | undefined) =>
                onChange(sel || {})
              }
              className="sm:border-r sm:border-neutral-100 sm:pr-3"
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
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-left text-xs hover:border-neutral-300 hover:bg-neutral-50"
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
            type="button"
            className={cn(
              "flex h-11 w-full items-center justify-between rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm",
              value !== `All ${getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch)}`
                ? "text-neutral-900"
                : "text-neutral-500",
              "focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500",
            )}
          >
            {value || label}
            <CaretDown className="ml-2 size-4 text-neutral-500" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-dialog-sm p-3 sm:w-auto" align="start">
          <div className="flex max-h-screen-50 flex-col gap-2 overflow-auto">
            <h4 className="mb-1 text-xs font-medium text-neutral-500">
              {label}
            </h4>
            {options.map((opt) => (
              <button
                key={opt.value || "all"}
                onClick={() => onSelect(opt.value)}
                className={`w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-left text-xs hover:border-neutral-300 hover:bg-neutral-50 ${
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
