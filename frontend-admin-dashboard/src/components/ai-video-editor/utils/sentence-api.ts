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

import { Entry, SentenceClip, ShotClip } from '@/components/ai-video-player/types';
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

export interface FriendlyError {
    /** Short, user-readable sentence — safe for toasts and inline display. */
    message: string;
    /** Raw backend text when it differs from `message` — for a "Technical
     *  details" disclosure and bug reports, never for toasts. */
    detail?: string;
}

/**
 * Narration endpoints surface raw render-worker output on failure (hundreds
 * of characters of ffmpeg stream metadata). Map the known failure families
 * to one readable sentence and keep the raw text as `detail`.
 *
 * Safe-to-retry wording is justified by the server's ordering: TTS, splice,
 * and the implausible-delta sanity guard all run BEFORE the timeline JSON or
 * audio pointer is persisted, so those failures leave the video unchanged.
 * Network failures get weaker wording — the request may have landed.
 */
export function humanizeNarrationError(
    raw: string,
    fallback = 'Re-narration failed'
): FriendlyError {
    const text = (raw || '').trim();
    if (!text) return { message: fallback };
    const lower = text.toLowerCase();
    let message: string | null = null;
    if (/splice_audio|slice_audio|silence_audio|ffmpeg|acrossfade/.test(lower)) {
        message =
            'The narration audio could not be rebuilt. Your video was not changed — please try again.';
    } else if (lower.includes('implausible')) {
        message =
            'The audio service returned an unexpected result. Your video was not changed — please try again.';
    } else if (/tts|synthes|voice provider/.test(lower)) {
        message = 'Voice generation failed. Please try again in a moment.';
    } else if (/timeout|timed out|failed to fetch|networkerror|load failed/.test(lower)) {
        message =
            'Network problem while updating the narration — check your connection, then reload the editor to see the current state.';
    } else if (text.length > 160) {
        message = `${fallback} — please try again.`;
    }
    // Short server messages ("Shot 3 not found") are already readable.
    if (!message) return { message: text };
    return { message, detail: text };
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
    newText: string
): Promise<ApiResult<RegenerateSentenceResponse>> {
    try {
        const res = await fetch(`${AI_SERVICE_BASE_URL}/external/video/v1/sentence/regenerate`, {
            method: 'POST',
            headers: headers(apiKey),
            body: JSON.stringify({
                video_id: videoId,
                sentence_id: sentenceId,
                new_text: newText,
            }),
        });
        if (!res.ok) return { ok: false, error: await readError(res) };
        const data = (await res.json()) as RegenerateSentenceResponse;
        return { ok: true, data };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

/**
 * Mute one sentence — replace its audio with synthesized silence of equal
 * length so the timing slot is preserved. Returns the same shape as
 * regenerate so callers can apply the response identically. The sentence
 * stays in `meta.sentences[]` with empty `text` and `audio_url`, which
 * the editor uses to render it as a "silenced" slot the user can later
 * re-narrate.
 */
export async function apiSilenceSentence(
    videoId: string,
    apiKey: string,
    sentenceId: string
): Promise<ApiResult<RegenerateSentenceResponse>> {
    try {
        const res = await fetch(`${AI_SERVICE_BASE_URL}/external/video/v1/sentence/silence`, {
            method: 'POST',
            headers: headers(apiKey),
            body: JSON.stringify({
                video_id: videoId,
                sentence_id: sentenceId,
            }),
        });
        if (!res.ok) return { ok: false, error: await readError(res) };
        const data = (await res.json()) as RegenerateSentenceResponse;
        return { ok: true, data };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

export interface InsertShotResponse {
    video_id: string;
    /** New timeline entry, ready to splice into the editor's `entries[]`. */
    entry: Entry;
    timeline_url: string;
}

/**
 * Generate a new HTML shot to fill a gap in the timeline. The server
 * builds the shot from the narration in [gap_start, gap_end] plus an
 * optional one-line user hint, then inserts it into meta.entries[] and
 * re-uploads the timeline JSON. Audio is untouched (gap-filling is
 * duration-neutral) so no ripple is needed on the client.
 */
export async function apiInsertShot(
    videoId: string,
    apiKey: string,
    gapStart: number,
    gapEnd: number,
    userHint: string | null
): Promise<ApiResult<InsertShotResponse>> {
    try {
        const res = await fetch(`${AI_SERVICE_BASE_URL}/external/video/v1/shot/insert`, {
            method: 'POST',
            headers: headers(apiKey),
            body: JSON.stringify({
                video_id: videoId,
                gap_start: gapStart,
                gap_end: gapEnd,
                user_hint: userHint || null,
            }),
        });
        if (!res.ok) return { ok: false, error: await readError(res) };
        const data = (await res.json()) as InsertShotResponse;
        return { ok: true, data };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

// ─────────────────────────────────────────────────────────────────────
// Shot-level audio editing (v3 pipeline)
//
// Mirrors the sentence-level helpers above but targets `meta.shots[]` —
// the v3 editor unit. ShotClip-based videos prefer these calls; legacy
// sentence-based videos continue to use `apiRegenerateSentence`.
// ─────────────────────────────────────────────────────────────────────

export interface RegenerateShotResponse {
    video_id: string;
    shot: ShotClip;
    /** new clip duration − old clip duration; ripple downstream shot start_times by this. */
    duration_delta: number;
    new_global_audio_url: string;
    new_global_duration: number;
    timeline_url: string;
}

/**
 * Re-narrate one shot using the same voice the video was originally
 * generated with. Returns the updated shot plus the duration delta — the
 * caller is responsible for rippling `meta.shots[]` and `entries[]` by
 * `duration_delta` (the server has already done the same to the persisted
 * timeline JSON).
 *
 * Refuses (HTTP 400) when:
 *   - the shot is `audio_policy: 'intrinsic_only'` (source-clip speaker /
 *     Veo audio): nothing to re-narrate.
 *   - the video has no `meta.shots[]` yet (pre-v3 timeline). Caller should
 *     fall back to `apiRegenerateSentence` for those videos.
 */
export async function apiRegenerateShot(
    videoId: string,
    apiKey: string,
    shotIdx: number,
    newText: string
): Promise<ApiResult<RegenerateShotResponse>> {
    try {
        const res = await fetch(`${AI_SERVICE_BASE_URL}/external/video/v1/shot/regenerate`, {
            method: 'POST',
            headers: headers(apiKey),
            body: JSON.stringify({
                video_id: videoId,
                shot_idx: shotIdx,
                new_text: newText,
            }),
        });
        if (!res.ok) return { ok: false, error: await readError(res) };
        const data = (await res.json()) as RegenerateShotResponse;
        return { ok: true, data };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

/**
 * Mute one shot — replace its audio with synthesized silence of equal length
 * so the timing slot (and downstream timing) is preserved. Returns the same
 * shape as regenerate so callers apply the response identically. The shot
 * stays in `meta.shots[]` with empty `text`/`audio_url` and `audio_skipped`,
 * which the editor renders as a "muted" slot the user can later re-narrate.
 *
 * Refuses (HTTP 400) for `audio_policy: 'intrinsic_only'` shots and pre-v3
 * timelines (no meta.shots[]).
 */
export async function apiSilenceShot(
    videoId: string,
    apiKey: string,
    shotIdx: number
): Promise<ApiResult<RegenerateShotResponse>> {
    try {
        const res = await fetch(`${AI_SERVICE_BASE_URL}/external/video/v1/shot/silence`, {
            method: 'POST',
            headers: headers(apiKey),
            body: JSON.stringify({
                video_id: videoId,
                shot_idx: shotIdx,
            }),
        });
        if (!res.ok) return { ok: false, error: await readError(res) };
        const data = (await res.json()) as RegenerateShotResponse;
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
    apiKey: string
): Promise<ApiResult<BuildSentencesResponse>> {
    try {
        const res = await fetch(`${AI_SERVICE_BASE_URL}/external/video/v1/sentences/build`, {
            method: 'POST',
            headers: headers(apiKey),
            body: JSON.stringify({ video_id: videoId }),
        });
        if (!res.ok) return { ok: false, error: await readError(res) };
        const data = (await res.json()) as BuildSentencesResponse;
        return { ok: true, data };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
