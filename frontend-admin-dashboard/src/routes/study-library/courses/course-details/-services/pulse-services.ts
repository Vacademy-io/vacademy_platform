import { COURSE_PULSE_SUMMARY } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import type { PulseSummaryResponse } from '../-types/pulse-types';

export const getPulseSummary = async (
    batchId: string,
    limit?: number
): Promise<PulseSummaryResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: COURSE_PULSE_SUMMARY,
        params: { batchId, ...(limit ? { limit } : {}) },
    });
    return response.data;
};

/**
 * TanStack Query options for the live Roster poll. Refetches every 15s while the
 * tab is visible; `refetchIntervalInBackground` defaults to false, so polling
 * pauses when the browser tab is hidden.
 */
export const pulseSummaryQueryOptions = (batchId: string) => ({
    queryKey: ['course-pulse-summary', batchId],
    queryFn: () => getPulseSummary(batchId),
    refetchInterval: 15000,
    enabled: !!batchId,
});
