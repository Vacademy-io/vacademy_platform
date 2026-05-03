import { useQuery } from '@tanstack/react-query';
import { getVideoStatus, type VideoStatusResponse } from '../../../-services/video-generation';

/**
 * Lazily fetch `/status` for a video. The response carries
 * `generation_progress.shot_plan` (canonical Director plan) and
 * `cumulative_tokens` — both of which `currentGeneration` doesn't include
 * when a history item is opened directly. PipelineFlow uses this to
 * synthesize per-scene nodes for already-finished videos.
 *
 * Cached per-`videoId`. 1-minute stale time so an in-flight run still
 * refreshes occasionally; for a wrapped run the data is immutable so the
 * single fetch is a one-off cost.
 */
export function useVideoStatus(videoId: string | undefined, apiKey: string | undefined) {
    return useQuery<VideoStatusResponse>({
        // apiKey participates in the key so a key rotation invalidates the
        // cached status — practically rare but lets the query plugin pass
        // its exhaustive-deps lint without an exemption.
        queryKey: ['video-status', videoId, apiKey],
        queryFn: () => {
            if (!videoId || !apiKey) throw new Error('missing videoId or apiKey');
            return getVideoStatus(videoId, apiKey);
        },
        enabled: !!videoId && !!apiKey,
        staleTime: 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
    });
}
