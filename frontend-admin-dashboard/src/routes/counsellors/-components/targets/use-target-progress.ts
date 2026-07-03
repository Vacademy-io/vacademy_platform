import { useQuery } from '@tanstack/react-query';
import {
    fetchTargetProgress,
    type TargetProgressItem,
} from '../../-services/counsellor-target-services';
import type { TargetPeriodValue } from './target-period-selector';

/**
 * Target-vs-completed for a page of counsellors over the selected window, in one
 * request. Returns a lookup keyed by counsellor user_id so the roster card/row
 * can render its own progress without an N-request fan-out.
 */
export function useTargetProgress(
    instituteId: string | undefined,
    counsellorUserIds: string[],
    period: TargetPeriodValue
) {
    const customIncomplete = period.periodType === 'CUSTOM' && (!period.from || !period.to);
    const ids = [...counsellorUserIds].sort();

    const query = useQuery({
        queryKey: [
            'counsellor-target-progress',
            instituteId,
            period.periodType,
            period.from,
            period.to,
            ids,
        ],
        enabled: !!instituteId && ids.length > 0 && !customIncomplete,
        staleTime: 60_000,
        queryFn: () =>
            fetchTargetProgress({
                institute_id: instituteId ?? '',
                counsellor_user_ids: ids,
                period_type: period.periodType,
                from_date: period.from,
                to_date: period.to,
            }),
    });

    const byUser: Record<string, TargetProgressItem[]> = {};
    for (const row of query.data?.rows ?? []) {
        byUser[row.counsellor_user_id] = row.items;
    }

    return {
        byUser,
        window: query.data ? { from: query.data.from_date, to: query.data.to_date } : null,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
    };
}
