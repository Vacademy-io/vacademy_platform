import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getTokenDecodedData,
  getTokenFromStorage,
} from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { fetchPastSessionsForMultipleBatches } from "./usePastSessions";
import { PastSessionDetails } from "../-types/types";

const formatDateToISO = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface MonthPastWindow {
  startDate: string;
  endDate: string;
  /** Number of past days in the visible month — used as the page `size` so
   * we fetch exactly the past window, never an arbitrary large page. */
  size: number;
}

/**
 * Computes the past-date window for a calendar month, relative to "now":
 * - Month entirely in the future → null (nothing to fetch).
 * - Month containing today → 1st of month through yesterday.
 * - Month entirely in the past → the whole month.
 */
export const computeMonthPastWindow = (
  visibleMonth: Date,
  now: Date = new Date()
): MonthPastWindow | null => {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0); // last calendar day of the month
  const today = startOfDay(now);

  if (monthStart > today) {
    // Entirely future — no past days to show.
    return null;
  }

  let windowEnd: Date;
  if (monthEnd < today) {
    // Entirely past month.
    windowEnd = monthEnd;
  } else {
    // Current month — past days are strictly before today.
    windowEnd = new Date(today.getTime() - MS_PER_DAY);
    if (windowEnd < monthStart) {
      // Today is the 1st of the month — no past days yet this month.
      return null;
    }
  }

  const size = Math.round((windowEnd.getTime() - monthStart.getTime()) / MS_PER_DAY) + 1;

  return {
    startDate: formatDateToISO(monthStart),
    endDate: formatDateToISO(windowEnd),
    size,
  };
};

/**
 * Month-scoped past sessions for the Calendar View. Fetches exactly the past
 * days visible in `visibleMonth` (page size bounded to that day count, not
 * a large flat page), per batch in parallel. Only enabled when the calendar
 * view is active and the institute has `show_past_sessions` turned on —
 * callers pass that flag in via `enabled` (reusing the flags already
 * fetched by `usePastSessions` for the List View, so this doesn't need its
 * own settings round-trip).
 */
export const useCalendarPastSessions = (
  batchIds: string[] | null,
  visibleMonth: Date,
  enabled: boolean
) => {
  const window = useMemo(
    () => computeMonthPastWindow(visibleMonth),
    [visibleMonth]
  );

  const query = useQuery({
    queryKey: [
      "calendarPastSessions",
      batchIds,
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      window?.startDate,
      window?.endDate,
    ],
    queryFn: async () => {
      const accessToken = await getTokenFromStorage(TokenKey.accessToken);
      const tokenData = getTokenDecodedData(accessToken);
      return fetchPastSessionsForMultipleBatches(batchIds!, tokenData?.user, {
        page: 0,
        size: window!.size,
        startDate: window!.startDate,
        endDate: window!.endDate,
      });
    },
    enabled: enabled && !!batchIds && batchIds.length > 0 && !!window,
    // Past data is cold — refetch on mount/month-change only, no polling.
    refetchInterval: false,
  });

  const sessions: PastSessionDetails[] = query.data?.sessions ?? [];

  return {
    sessions,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
};
