import { useQuery } from "@tanstack/react-query";
import { fetchAttendanceReport, ScheduleItem } from "./getAttendanceReport";
import { useGetBatchesQuery } from "../get-batches";
import { format, parseISO, subDays, subMonths, isPast, isToday } from "date-fns";

export type AttendancePeriod = "7d" | "30d" | "90d";

export interface AttendanceStats {
  attendancePercentage: number;
  currentStreak: number;
  totalClassDays: number;
  presentDays: number;
  absentDays: number;
  totalSessions: number;
}

/**
 * Pure function: compute day-wise attendance stats from raw schedules.
 * Multiple classes in one day count as one day.
 * PRESENT if any class that day was attended.
 */
export function computeAttendanceStats(
  schedules: ScheduleItem[]
): AttendanceStats {
  if (!schedules || schedules.length === 0) {
    return {
      attendancePercentage: 0,
      currentStreak: 0,
      totalClassDays: 0,
      presentDays: 0,
      absentDays: 0,
      totalSessions: schedules?.length ?? 0,
    };
  }

  // Group schedules by date
  const dayMap = new Map<string, ScheduleItem[]>();
  for (const schedule of schedules) {
    const dateKey = schedule.meetingDate; // yyyy-MM-dd string
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, []);
    }
    dayMap.get(dateKey)!.push(schedule);
  }

  // Compute per-day status
  const dayStatuses: { date: string; present: boolean }[] = [];

  for (const [dateKey, daySchedules] of dayMap) {
    const dayDate = parseISO(dateKey);
    const isDayInPast = isPast(dayDate) && !isToday(dayDate);

    const hasAnyPresent = daySchedules.some(
      (s) => s.attendanceStatus === "PRESENT"
    );
    const hasAnyPending = daySchedules.some((s) => !s.attendanceStatus);

    let isPresent: boolean;
    if (hasAnyPresent) {
      isPresent = true;
    } else if (hasAnyPending && !isDayInPast) {
      // Future/today with pending classes — skip from stats
      continue;
    } else {
      isPresent = false;
    }

    dayStatuses.push({ date: dateKey, present: isPresent });
  }

  const totalClassDays = dayStatuses.length;
  const presentDays = dayStatuses.filter((d) => d.present).length;
  const absentDays = totalClassDays - presentDays;
  const attendancePercentage =
    totalClassDays > 0 ? Math.round((presentDays / totalClassDays) * 100) : 0;

  // Streak: sort descending, walk from most recent, count consecutive PRESENT
  const sorted = [...dayStatuses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  let currentStreak = 0;
  for (const day of sorted) {
    if (day.present) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    attendancePercentage,
    currentStreak,
    totalClassDays,
    presentDays,
    absentDays,
    totalSessions: schedules.length,
  };
}

function getPeriodStartDate(period: AttendancePeriod): Date {
  const now = new Date();
  switch (period) {
    case "7d":
      return subDays(now, 7);
    case "30d":
      return subDays(now, 30);
    case "90d":
      return subMonths(now, 3);
  }
}

export const useAttendanceStats = (options?: {
  period?: AttendancePeriod;
  batchId?: string | null;
}) => {
  const period = options?.period ?? "7d";
  const { data: batches } = useGetBatchesQuery();

  // Resolve batchId: use passed value or fall back to first batch
  const resolvedBatchId =
    options?.batchId ??
    (Array.isArray(batches) && batches.length > 0
      ? batches[0]?.batches?.[0]?.package_session_id
      : batches?.batches?.[0]?.package_session_id) ??
    null;

  return useQuery<AttendanceStats | null>({
    queryKey: ["ATTENDANCE_STATS", resolvedBatchId, period],
    queryFn: async () => {
      if (!resolvedBatchId) return null;

      const startDate = format(getPeriodStartDate(period), "yyyy-MM-dd");
      const endDate = format(new Date(), "yyyy-MM-dd");

      const response = await fetchAttendanceReport({
        startDate,
        endDate,
        batchId: resolvedBatchId,
      });

      return computeAttendanceStats(response.schedules);
    },
    enabled: !!resolvedBatchId,
    staleTime: 5 * 60 * 1000,
  });
};
