import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { fetchMembershipExpiry, getMembershipExpiryQueryKey } from '@/services/membership-expiry';
import { subDays, addDays, startOfToday, endOfDay, format } from 'date-fns';

export function useMembershipExpiryAnalytics(packageSessionIds: string[] | undefined) {
    const { today, last30dStart, next30dEnd } = useMemo(() => {
        const t = startOfToday();
        const n = new Date();
        return {
            today: t,
            last30dStart: subDays(n, 30),
            next30dEnd: addDays(n, 30),
        };
    }, []);

    const formatDate = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm:ss'Z'");

    const commonQuery = {
        package_session_ids: packageSessionIds,
        institute_id: 'auto',
    };

    const queries = [
        // 1. Recently Expired (Last 30 Days)
        {
            queryKey: getMembershipExpiryQueryKey(0, 1, {
                ...commonQuery,
                start_date_in_utc: formatDate(last30dStart),
                end_date_in_utc: formatDate(today),
                membership_statuses: ['ENDED'],
            }),
            queryFn: () => fetchMembershipExpiry(0, 1, {
                ...commonQuery,
                start_date_in_utc: formatDate(last30dStart),
                end_date_in_utc: formatDate(today),
                membership_statuses: ['ENDED'],
            }),
        },
        // 2. Expiring Soon (Next 30 Days)
        {
            queryKey: getMembershipExpiryQueryKey(0, 1, {
                ...commonQuery,
                start_date_in_utc: formatDate(today),
                end_date_in_utc: formatDate(next30dEnd),
                membership_statuses: ['ABOUT_TO_END'],
            }),
            queryFn: () => fetchMembershipExpiry(0, 1, {
                ...commonQuery,
                start_date_in_utc: formatDate(today),
                end_date_in_utc: formatDate(next30dEnd),
                membership_statuses: ['ABOUT_TO_END'],
            }),
        },
    ];

    const results = useQueries({ queries });

    const isLoading = results.some(r => r.isLoading);

    return {
        stats: {
            recentlyExpired: results[0]?.data?.totalElements || 0,
            expiringSoon: results[1]?.data?.totalElements || 0,
        },
        dateRanges: {
            expired: { start: last30dStart, end: today, status: 'ENDED' as const },
            expiring: { start: today, end: next30dEnd, status: 'ABOUT_TO_END' as const },
        },
        isLoading,
    };
}
