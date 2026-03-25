import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { fetchMembershipStats, getMembershipStatsQueryKey } from '@/services/membership-stats';
import { subDays, subMonths, format, startOfToday, endOfDay } from 'date-fns';

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
        user_types: undefined, // Total users
        institute_id: 'auto', // Handled by service
        sort_columns: undefined,
        search_name: undefined,
    };

    // Summary Queries
    const summaryQueries = [
        // Index 0: Last 24h
        {
            queryKey: getMembershipStatsQueryKey(0, 1, {
                ...commonQuery,
                start_date_in_utc: formatDate(last24hStart),
                end_date_in_utc: formatDate(last24hEnd),
            }),
            queryFn: () =>
                fetchMembershipStats(0, 1, {
                    ...commonQuery,
                    start_date_in_utc: formatDate(last24hStart),
                    end_date_in_utc: formatDate(last24hEnd),
                }),
        },
        // Index 1: Last 7d
        {
            queryKey: getMembershipStatsQueryKey(0, 1, {
                ...commonQuery,
                start_date_in_utc: formatDate(last7dStart),
                end_date_in_utc: formatDate(now),
            }),
            queryFn: () =>
                fetchMembershipStats(0, 1, {
                    ...commonQuery,
                    start_date_in_utc: formatDate(last7dStart),
                    end_date_in_utc: formatDate(now),
                }),
        },
        // Index 2: Last 30d
        {
            queryKey: getMembershipStatsQueryKey(0, 1, {
                ...commonQuery,
                start_date_in_utc: formatDate(last30dStart),
                end_date_in_utc: formatDate(now),
            }),
            queryFn: () =>
                fetchMembershipStats(0, 1, {
                    ...commonQuery,
                    start_date_in_utc: formatDate(last30dStart),
                    end_date_in_utc: formatDate(now),
                }),
        },
    ];

    // Graph Queries (Last 7 days, daily)
    // From 6 days ago -> Today (7 points)
    const days = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(today, 6 - i); // 6 days ago, 5 days ago ... 0 days ago (today)
        return {
            date: d,
            start: d,
            end: endOfDay(d),
            label: format(d, 'EEE'), // Mon, Tue...
            fullLabel: format(d, 'MMM dd'),
        };
    });

    const graphQueries = days.map((day) => ({
        queryKey: getMembershipStatsQueryKey(0, 1, {
            ...commonQuery,
            start_date_in_utc: formatDate(day.start),
            end_date_in_utc: formatDate(day.end),
        }),
        queryFn: () =>
            fetchMembershipStats(0, 1, {
                ...commonQuery,
                start_date_in_utc: formatDate(day.start),
                end_date_in_utc: formatDate(day.end),
            }),
    }));

    const results = useQueries({
        queries: [...summaryQueries, ...graphQueries],
    });

    const summaryResults = results.slice(0, 3);
    const graphResults = results.slice(3);

    const isLoading = results.some((r) => r.isLoading);

    // Process Graph Data
    const graphData = days.map((day, index) => {
        const queryResult = graphResults[index];
        return {
            date: day.label,
            fullDate: day.fullLabel,
            users: queryResult?.data?.total_elements || 0,
        };
    });

    return {
        stats: {
            last24Hours: summaryResults[0]?.data?.total_elements || 0,
            last7Days: summaryResults[1]?.data?.total_elements || 0,
            last30Days: summaryResults[2]?.data?.total_elements || 0,
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
