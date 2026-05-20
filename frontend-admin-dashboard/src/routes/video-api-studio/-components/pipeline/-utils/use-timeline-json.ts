import { useQuery } from '@tanstack/react-query';
import {
    parseTimelineThumbnails,
    pickBackgroundMusicTrack,
    pickPalette,
    pickRecurringMotifs,
    pickShotMetaByIndex,
    type SceneThumbnails,
    type TimelineAudioTrack,
    type TimelineJson,
    type TimelinePalette,
    type TimelineShotMeta,
} from './parse-timeline-thumbnails';

/**
 * Lazily fetch the finished `time_based_frame.json` and pre-extract per-shot
 * thumbnails. Used by `<PipelineFlow>` to enrich scene nodes with image /
 * stock-video preview URLs once a run wraps.
 *
 * Cached per-`videoId` (the `timelineUrl` is technically the cache key but
 * `videoId` is the stable handle the caller has). 5-minute stale time —
 * timeline JSONs are immutable after the run finishes; the only reason to
 * refetch is if the user navigates back hours later, which is fine to
 * re-pull from S3.
 */
export function useTimelineJson(videoId: string | undefined, timelineUrl: string | undefined) {
    return useQuery({
        queryKey: ['video-timeline', videoId, timelineUrl],
        queryFn: async (): Promise<TimelineJson> => {
            if (!timelineUrl) throw new Error('no timeline url');
            const resp = await fetch(timelineUrl);
            if (!resp.ok) throw new Error(`timeline fetch failed: ${resp.status}`);
            return (await resp.json()) as TimelineJson;
        },
        enabled: !!timelineUrl,
        staleTime: 5 * 60 * 1000,
        // Timeline JSONs are big (~50KB×N entries) — keep one in memory but
        // don't aggressively retry on transient network blips.
        retry: 1,
        refetchOnWindowFocus: false,
    });
}

export function useSceneThumbnails(
    videoId: string | undefined,
    timelineUrl: string | undefined
): { byIndex: Record<number, SceneThumbnails>; loading: boolean } {
    const { data, isLoading } = useTimelineJson(videoId, timelineUrl);
    return {
        byIndex: data ? parseTimelineThumbnails(data) : {},
        loading: isLoading,
    };
}

/**
 * Background-music track extracted from the same cached timeline.json, so
 * `<ScoreNode>` (and its detail body) can play the merged Lyria score for
 * already-finished videos without a second fetch.
 */
export function useBackgroundMusicTrack(
    videoId: string | undefined,
    timelineUrl: string | undefined
): { track: TimelineAudioTrack | undefined; loading: boolean } {
    const { data, isLoading } = useTimelineJson(videoId, timelineUrl);
    return {
        track: data ? pickBackgroundMusicTrack(data) : undefined,
        loading: isLoading,
    };
}

/**
 * Style-guide palette extracted from the same cached timeline.json. Fed
 * into `processHtmlContent` so iframe-embedded scene previews seed the
 * same CSS variables the final-cut MP4 was rendered against.
 */
export function useTimelinePalette(
    videoId: string | undefined,
    timelineUrl: string | undefined
): TimelinePalette | undefined {
    const { data } = useTimelineJson(videoId, timelineUrl);
    return data ? pickPalette(data) : undefined;
}

/**
 * v3 per-shot meta (audio_policy, narration_brief, background_treatment,
 * AI-video telemetry, etc.) keyed by shot index. Lets `PipelineFlow` enrich
 * `state.scenes[]` with fields the live SSE shot plan didn't carry —
 * particularly important for history-loaded runs.
 */
export function useTimelineShotMeta(
    videoId: string | undefined,
    timelineUrl: string | undefined
): Record<number, TimelineShotMeta> {
    const { data } = useTimelineJson(videoId, timelineUrl);
    return data ? pickShotMetaByIndex(data) : {};
}

/** Plan-level recurring motifs from `meta.recurring_motifs[]` (v3 only). */
export function useTimelineRecurringMotifs(
    videoId: string | undefined,
    timelineUrl: string | undefined
): Array<{ description: string; screen_position?: string; when_visible?: string }> {
    const { data } = useTimelineJson(videoId, timelineUrl);
    return data ? pickRecurringMotifs(data) : [];
}
