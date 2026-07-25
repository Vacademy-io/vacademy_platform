import { COURSE_PULSE_CONTENT_MAP, COURSE_PULSE_FEED, COURSE_PULSE_SUMMARY } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import type {
    ContentMapResponse,
    PulseFeedResponse,
    PulseSummaryResponse,
} from '../-types/pulse-types';

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

export const getPulseContentMap = async (batchId: string): Promise<ContentMapResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: COURSE_PULSE_CONTENT_MAP,
        params: { batchId },
    });
    return response.data;
};

export const pulseContentMapQueryOptions = (batchId: string, enabled: boolean) => ({
    queryKey: ['course-pulse-content-map', batchId],
    queryFn: () => getPulseContentMap(batchId),
    refetchInterval: 15000,
    enabled: enabled && !!batchId,
});

export const getPulseFeed = async (
    batchId: string,
    windowMinutes?: number
): Promise<PulseFeedResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: COURSE_PULSE_FEED,
        params: { batchId, ...(windowMinutes ? { windowMinutes } : {}) },
    });
    return response.data;
};

export const pulseFeedQueryOptions = (batchId: string, enabled: boolean) => ({
    queryKey: ['course-pulse-feed', batchId],
    queryFn: () => getPulseFeed(batchId),
    refetchInterval: 15000,
    enabled: enabled && !!batchId,
});
