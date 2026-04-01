import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { fetchMembershipStats, getMembershipStatsQueryKey } from '@/services/membership-stats';
import { subDays, subMonths, format, startOfToday, endOfDay } from 'date-fns';

const USER_TYPES = ['NEW_USER', 'RETAINER'] as const;

export function useMembershipAnalytics(packageSessionIds: string[] | undefined) {
    // Generate dates (Memoized to prevent infinite refetching due to changing 'now')
    const { today, now, last24hStart, last24hEnd, last7dStart, last30dStart } = useMemo(() => {
        const t = startOfToday();
        const n = new Date();
        return {
            today: t,
            now: n,
            last24hStart: subDays(n, 1),
            last24hEnd: n,
            last7dStart: subDays(n, 7),
            last30dStart: subDays(n, 30),
        };
    }, []); // Run once on mount

    // Format for API
    const formatDate = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm:ss'Z'");

    // Common query config
    const commonQuery = {
        package_session_ids: packageSessionIds,
        institute_id: 'auto', // Handled by service
        sort_columns: undefined,
        search_name: undefined,
    };

    // Helper to build queries for a date range — total + per user type
    const buildRangeQueries = (startDateStr: string, endDateStr: string) => {
        const baseFilter = {
            ...commonQuery,
            start_date_in_utc: startDateStr,
            end_date_in_utc: endDateStr,
        };

        // Total (no user_types filter)
        const totalQuery = {
            queryKey: getMembershipStatsQueryKey(0, 1, { ...baseFilter, user_types: undefined }),
            queryFn: () => fetchMembershipStats(0, 1, { ...baseFilter, user_types: undefined }),
        };

        // Per user type
        const typeQueries = USER_TYPES.map((userType) => ({
            queryKey: getMembershipStatsQueryKey(0, 1, { ...baseFilter, user_types: [userType] }),
            queryFn: () => fetchMembershipStats(0, 1, { ...baseFilter, user_types: [userType] }),
        }));

        return [totalQuery, ...typeQueries]; // [total, NEW_USER, RETAINER]
    };

    // Summary Queries: 3 ranges × 3 queries each = 9
    const summaryQueries = [
        ...buildRangeQueries(formatDate(last24hStart), formatDate(last24hEnd)),   // indices 0-2
        ...buildRangeQueries(formatDate(last7dStart), formatDate(now)),            // indices 3-5
        ...buildRangeQueries(formatDate(last30dStart), formatDate(now)),           // indices 6-8
    ];

    // Graph Queries (Last 7 days, daily)
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(today, 6 - i);
        return {
            date: d,
            start: d,
            end: endOfDay(d),
            label: format(d, 'EEE'),
            fullLabel: format(d, 'MMM dd'),
        };
    });

    // 7 days × 3 queries each = 21
    const graphQueries = days.flatMap((day) =>
        buildRangeQueries(formatDate(day.start), formatDate(day.end))
    );

    const results = useQueries({
        queries: [...summaryQueries, ...graphQueries],
    });

    const summaryResults = results.slice(0, 9);
    const graphResults = results.slice(9);

    const isLoading = results.some((r) => r.isLoading);

    // Helper to extract total_elements
    const getCount = (index: number) => results[index]?.data?.total_elements || 0;

    // Process Graph Data — each day has 3 results (total, NEW_USER, RETAINER)
    const graphData = days.map((day, index) => {
        const base = index * 3;
        return {
            date: day.label,
            fullDate: day.fullLabel,
            users: graphResults[base]?.data?.total_elements || 0,
            newUsers: graphResults[base + 1]?.data?.total_elements || 0,
            retainers: graphResults[base + 2]?.data?.total_elements || 0,
        };
    });

    return {
        stats: {
            last24Hours: {
                total: getCount(0),
                newUsers: getCount(1),
                retainers: getCount(2),
            },
            last7Days: {
                total: getCount(3),
                newUsers: getCount(4),
                retainers: getCount(5),
            },
            last30Days: {
                total: getCount(6),
                newUsers: getCount(7),
                retainers: getCount(8),
            },
        },
        dateRanges: {
            last24h: { start: last24hStart, end: last24hEnd },
            last7d: { start: last7dStart, end: now },
            last30d: { start: last30dStart, end: now },
        },
        graphData,
        isLoading,
    };
}
