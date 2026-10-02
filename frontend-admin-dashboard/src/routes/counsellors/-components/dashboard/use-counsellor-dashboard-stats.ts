import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCounselorPerformance } from '@/routes/audience-manager/reports/-services/get-lead-reports';
import { fetchFollowupAging } from '@/routes/audience-manager/reports/-services/get-crm-reports';
import type { TargetPeriodValue } from '../targets/target-period-selector';
import { buildTotals, periodWindow } from '../../-utils/dashboard-stats';

/** Every query this dashboard owns starts with this key, so one invalidate refreshes them all. */
export const COUNSELLOR_DASHBOARD_QUERY_KEY = 'counsellor-dashboard';

/**
 * Reads the two existing report endpoints behind the Counsellors dashboard:
 *
 *   GET /v1/reports/counselor-performance — new leads, contacted, converted and
 *       first-response time for leads that came in during the selected period.
 *   GET /v1/reports/followup-aging        — open follow-ups due today / overdue,
 *       as of now (not tied to the period).
 *
 * Both are scoped server-side to the caller's hierarchy, the same way the
 * roster is. One request each for the whole page (never per counsellor). A
 * failure only blanks the numbers ("—"); the roster and its actions keep working.
 */
export function useCounsellorDashboardStats(
    instituteId: string | undefined,
    period: TargetPeriodValue
) {
    const range = periodWindow(period);

    const performanceQuery = useQuery({
        queryKey: [
            COUNSELLOR_DASHBOARD_QUERY_KEY,
            'performance',
            instituteId,
            range?.from,
            range?.to,
        ],
        enabled: !!instituteId && !!range,
        queryFn: () => fetchCounselorPerformance(instituteId!, range!.from, range!.to),
        staleTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: false,
    });

    const agingQuery = useQuery({
        queryKey: [COUNSELLOR_DASHBOARD_QUERY_KEY, 'followup-aging', instituteId],
        enabled: !!instituteId,
        queryFn: () => fetchFollowupAging({ instituteId: instituteId! }),
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: false,
    });

    const performance = performanceQuery.data;
    const aging = agingQuery.data;
    const totals = useMemo(() => buildTotals(performance, aging), [performance, aging]);

    return {
        performance,
        aging,
        totals,
        /** True until both reports have answered (or failed) at least once. */
        isLoading: performanceQuery.isLoading || agingQuery.isLoading,
        /** Custom range picked but not complete yet — period numbers are on hold. */
        periodIncomplete: !range,
    };
}
