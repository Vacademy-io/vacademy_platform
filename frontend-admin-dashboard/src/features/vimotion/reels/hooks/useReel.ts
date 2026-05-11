/**
 * Full reel record with adaptive polling.
 *
 * Why the full record (not /status): the detail page shows everything —
 * progress, stages, error_message, s3_urls.video, config, trim_map. The
 * full record is ~1KB; one poll every 3s while running is fine.
 */
import { useQuery } from '@tanstack/react-query';
import { getReel, type ReelResponse } from '../services/reels-api';

export interface UseReelOptions {
    apiKey: string | undefined;
    reelId: string | undefined;
}

export function useReel({ apiKey, reelId }: UseReelOptions) {
    return useQuery<ReelResponse>({
        queryKey: ['reel', reelId, apiKey],
        enabled: !!apiKey && !!reelId,
        queryFn: () => {
            if (!apiKey || !reelId) {
                return Promise.reject(new Error('Missing apiKey or reelId'));
            }
            return getReel(apiKey, reelId);
        },
        // Adaptive polling — same pattern as useReelsList.
        refetchInterval: (query) => {
            const data: ReelResponse | undefined = query.state.data;
            if (!data) return 3_000;
            if (data.status === 'PENDING' || data.status === 'IN_PROGRESS') return 3_000;
            return false; // terminal — stop polling
        },
    });
}
