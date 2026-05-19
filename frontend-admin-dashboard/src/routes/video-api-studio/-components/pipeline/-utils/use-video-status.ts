import { useQuery } from '@tanstack/react-query';
import { getVideoStatus, type VideoStatusResponse } from '../../../-services/video-generation';

/**
 * Poll `/status` for a video. The response now carries a `live` payload
 * (RunStateAggregator snapshot) which is the single source of truth for
 * the pipeline view — both live runs and history reads consume it the
 * same way. While the run is IN_PROGRESS we refetch every 15 s; once it
 * reaches a terminal status (`COMPLETED` / `FAILED` / `STALLED`) we stop
 * polling. The user can force-refresh via the consumer-provided control.
 *
 * Cached per-`videoId`. `apiKey` participates in the key so a key
 * rotation invalidates the cache. We keep `staleTime: 0` so a refetch
 * always re-renders consumers with the freshest snapshot.
 */
const POLL_INTERVAL_MS = 15_000;
const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'STALLED', 'CANCELLED']);

export function useVideoStatus(videoId: string | undefined, apiKey: string | undefined) {
    return useQuery<VideoStatusResponse>({
        queryKey: ['video-status', videoId, apiKey],
        queryFn: () => {
            if (!videoId || !apiKey) throw new Error('missing videoId or apiKey');
            return getVideoStatus(videoId, apiKey);
        },
        enabled: !!videoId && !!apiKey,
        staleTime: 0,
        retry: 1,
        refetchOnWindowFocus: false,
        // Polling cadence: 15 s while running, stopped once terminal.
        // Returning `false` from `refetchInterval` halts the polling loop;
        // returning a number reschedules. React Query treats this as the
        // authoritative cadence — no need for a separate setInterval.
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            if (status && TERMINAL_STATUSES.has(status)) return false;
            return POLL_INTERVAL_MS;
        },
    });
}
