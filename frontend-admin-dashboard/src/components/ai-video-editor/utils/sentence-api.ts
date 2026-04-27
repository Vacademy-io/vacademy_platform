/**
 * Sentence-level audio editing API.
 *
 * Wraps the ai_service endpoints that the editor uses when re-narrating
 * a single sentence in the video. The store is what calls these — this
 * module only owns the HTTP boundary so the store can stay free of
 * fetch/error-string handling.
 *
 * Two endpoints today:
 *   - /sentences/build: idempotent backfill, ensures meta.sentences[]
 *     exists for older videos that were generated before per-sentence
 *     audio shipped.
 *   - /sentence/regenerate: TTS one sentence in the original voice,
 *     splice it into the global narration.mp3, ripple downstream
 *     timestamps, return the new sentence + duration delta.
 */

import { SentenceClip } from '@/components/ai-video-player/types';
import { AI_SERVICE_BASE_URL } from '@/constants/urls';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface RegenerateSentenceResponse {
    video_id: string;
    sentence: SentenceClip;
    /** new clip duration − old clip duration; ripple downstream timestamps by this. */
    duration_delta: number;
    new_global_audio_url: string;
    new_global_duration: number;
    timeline_url: string;
}

export interface BuildSentencesResponse {
    video_id: string;
    timeline_url: string;
    count: number;
    sentences: SentenceClip[];
    /** Set when the build was skipped (e.g. video missing required S3 URLs). */
    skipped_reason: string | null;
}

function headers(apiKey: string) {
    return { 'Content-Type': 'application/json', 'X-Institute-Key': apiKey };
}

async function readError(res: Response): Promise<string> {
    try {
        const text = await res.text();
        try {
            const json = JSON.parse(text) as { detail?: unknown };
            if (typeof json.detail === 'string') return json.detail;
        } catch {
            /* not JSON */
        }
        return text || res.statusText;
    } catch {
        return res.statusText;
    }
}

/**
 * Re-narrate one sentence using the same voice the video was originally
 * generated with. Returns the updated sentence plus the duration delta —
 * the caller is responsible for rippling its in-memory entries and
 * sentences[] by `duration_delta` (the server has already done the same
 * to the persisted timeline JSON).
 */
export async function apiRegenerateSentence(
    videoId: string,
    apiKey: string,
    sentenceId: string,
    newText: string,
): Promise<ApiResult<RegenerateSentenceResponse>> {
    try {
        const res = await fetch(
            `${AI_SERVICE_BASE_URL}/external/video/v1/sentence/regenerate`,
            {
                method: 'POST',
                headers: headers(apiKey),
                body: JSON.stringify({
                    video_id: videoId,
                    sentence_id: sentenceId,
                    new_text: newText,
                }),
            },
        );
        if (!res.ok) return { ok: false, error: await readError(res) };
        const data = (await res.json()) as RegenerateSentenceResponse;
        return { ok: true, data };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

/**
 * Trigger a backfill build of meta.sentences[] for an older video.
 * Safe to call on a video that already has sentences[] — the server
 * overwrites them at the same S3 keys.
 */
export async function apiBuildSentences(
    videoId: string,
    apiKey: string,
): Promise<ApiResult<BuildSentencesResponse>> {
    try {
        const res = await fetch(
            `${AI_SERVICE_BASE_URL}/external/video/v1/sentences/build`,
            {
                method: 'POST',
                headers: headers(apiKey),
                body: JSON.stringify({ video_id: videoId }),
            },
        );
        if (!res.ok) return { ok: false, error: await readError(res) };
        const data = (await res.json()) as BuildSentencesResponse;
        return { ok: true, data };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
