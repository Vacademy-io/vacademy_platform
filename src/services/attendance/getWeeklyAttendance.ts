import { useQuery } from "@tanstack/react-query";
import { fetchAttendanceReport, ScheduleItem } from "./getAttendanceReport";
import { useGetBatchesQuery } from "../get-batches";
import {
  startOfWeek,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  addDays,
  startOfDay,
  isToday,
  isPast,
} from "date-fns";

export interface WeeklyAttendanceDay {
  day: string;
  dayName: string;
  status: "PRESENT" | "ABSENT" | "PENDING" | "NO_CLASS";
  date: Date;
  hasClass: boolean;
}

export interface WeeklyAttendanceData {
  days: WeeklyAttendanceDay[];
  weekRange: string;
  attendancePercentage: number;
}

export const useWeeklyAttendanceQuery = () => {
  const { data: batches } = useGetBatchesQuery();

  // Get the first batch's package_session_id as default
  const batchId =
    Array.isArray(batches) && batches.length > 0
      ? batches[0]?.batches?.[0]?.package_session_id
      : batches?.batches?.[0]?.package_session_id;

  return useQuery<WeeklyAttendanceData | null>({
    queryKey: ["WEEKLY_ATTENDANCE", batchId],
    queryFn: async () => {
      if (!batchId) return null;

      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday

      try {
        const response = await fetchAttendanceReport({
          startDate: format(weekStart, "yyyy-MM-dd"),
          endDate: format(weekEnd, "yyyy-MM-dd"),
          batchId: batchId,
        });

        // Generate days array for the week (Mon-Sun)
        const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const days: WeeklyAttendanceDay[] = weekDays.map((dayName, index) => {
          const dayDate = startOfDay(addDays(weekStart, index));

          // Determine if this day is past, today, or future
          const isDayInPast = isPast(dayDate) && !isToday(dayDate);

          // Find if there's a class scheduled for this day
          const daySchedule = response.schedules.find(
            (schedule: ScheduleItem) =>
              isSameDay(parseISO(schedule.meetingDate), dayDate)
          );

          let status: WeeklyAttendanceDay["status"];

          if (daySchedule) {
            // There's a class scheduled for this day
            if (daySchedule.attendanceStatus === "PRESENT") {
              status = "PRESENT";
            } else if (daySchedule.attendanceStatus === "ABSENT") {
              status = "ABSENT";
            } else {
              // No attendance status recorded yet
              if (isDayInPast) {
                status = "ABSENT";
              } else {
                status = "PENDING";
              }
            }
          } else {
            // No class scheduled for this day
            if (isDayInPast) {
              // Past day with no class = no class
              status = "NO_CLASS";
            } else {
              // Today or future day with no class = pending (might be scheduled later)
              status = "PENDING";
            }
          }

          return {
            day: dayName,
            dayName: dayName,
            status,
            date: dayDate,
            hasClass: !!daySchedule,
          };
        });

        return {
          days,
          weekRange: `${format(weekStart, "MMM dd")} - ${format(
            weekEnd,
            "MMM dd"
          )}`,
          attendancePercentage: response.attendancePercentage || 0,
        };
      } catch (error) {
        console.error("Failed to fetch weekly attendance:", error);

        // Return fallback data
        const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const fallbackDays: WeeklyAttendanceDay[] = weekDays.map(
          (dayName, index) => {
            const dayDate = startOfDay(addDays(weekStart, index));
            const isDayInPast = isPast(dayDate) && !isToday(dayDate);

            return {
              day: dayName,
              dayName: dayName,
              status: isDayInPast ? "NO_CLASS" : "PENDING",
              date: dayDate,
              hasClass: false,
            };
          }
        );

        return {
          days: fallbackDays,
          weekRange: `${format(weekStart, "MMM dd")} - ${format(
            weekEnd,
            "MMM dd"
          )}`,
          attendancePercentage: 0,
        };
      }
    },
    enabled: !!batchId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
};
