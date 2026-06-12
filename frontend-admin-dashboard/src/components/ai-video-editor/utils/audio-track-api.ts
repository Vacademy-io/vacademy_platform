/**
 * API helpers for managing extra audio tracks in the video timeline.
 * Each call mutates meta.audio_tracks in the S3 timeline JSON via the ai_service endpoints.
 *
 * Endpoints differ by editor kind: AI-gen videos use
 * /external/video/v1/audio-track/* (id in the body as `video_id`, update is
 * PATCH); studio builds use /external/studio/v1/builds/{id}/audio-track/*
 * (build id in the PATH, all three ops are POST, responses carry `build_id`
 * instead of `video_id`). Results are normalised so callers never see the
 * difference. NOTE: kind='reel' falls through to the video endpoints, which
 * resolve ids against the ai_gen_video table only — reel audio tracks have
 * never persisted (pre-existing backend gap); the panel surfaces the API
 * error as a toast.
 */

import { AudioTrack } from '@/components/ai-video-player/types';
import { AI_SERVICE_BASE_URL } from '@/constants/urls';
import type { EditorKind } from '../stores/video-editor-store';

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

function headers(apiKey: string) {
    return { 'Content-Type': 'application/json', 'X-Institute-Key': apiKey };
}

function endpoint(
    kind: EditorKind,
    videoId: string,
    op: 'add' | 'update' | 'delete'
): { url: string; method: string; idBody: Record<string, string> } {
    if (kind === 'studio') {
        return {
            url: `${AI_SERVICE_BASE_URL}/external/studio/v1/builds/${videoId}/audio-track/${op}`,
            method: 'POST',
            idBody: {},
        };
    }
    return {
        url: `${AI_SERVICE_BASE_URL}/external/video/v1/audio-track/${op}`,
        method: op === 'update' ? 'PATCH' : 'POST',
        idBody: { video_id: videoId },
    };
}

export async function apiAddAudioTrack(
    videoId: string,
    apiKey: string,
    track: Omit<AudioTrack, 'id'> & { id?: string },
    kind: EditorKind = 'video'
): Promise<ApiResult<{ track_id: string }>> {
    try {
        const { url, method, idBody } = endpoint(kind, videoId, 'add');
        const res = await fetch(url, {
            method,
            headers: headers(apiKey),
            body: JSON.stringify({
                ...idBody,
                label: track.label,
                url: track.url,
                volume: track.volume,
                delay: track.delay,
                fade_in: track.fadeIn,
                fade_out: track.fadeOut,
                loop: track.loop ?? false,
                track_id: track.id,
            }),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            return { ok: false, error: text };
        }
        const json = await res.json();
        return { ok: true, data: { track_id: json.track_id } };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}

export async function apiUpdateAudioTrack(
    videoId: string,
    apiKey: string,
    trackId: string,
    patch: Partial<Omit<AudioTrack, 'id'>>,
    kind: EditorKind = 'video'
): Promise<ApiResult<void>> {
    try {
        const { url, method, idBody } = endpoint(kind, videoId, 'update');
        const res = await fetch(url, {
            method,
            headers: headers(apiKey),
            body: JSON.stringify({
                ...idBody,
                track_id: trackId,
                label: patch.label,
                url: patch.url,
                volume: patch.volume,
                delay: patch.delay,
                fade_in: patch.fadeIn,
                fade_out: patch.fadeOut,
                loop: patch.loop,
            }),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            return { ok: false, error: text };
        }
        return { ok: true, data: undefined };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}

export async function apiDeleteAudioTrack(
    videoId: string,
    apiKey: string,
    trackId: string,
    kind: EditorKind = 'video'
): Promise<ApiResult<void>> {
    try {
        const { url, method, idBody } = endpoint(kind, videoId, 'delete');
        const res = await fetch(url, {
            method,
            headers: headers(apiKey),
            body: JSON.stringify({ ...idBody, track_id: trackId }),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            return { ok: false, error: text };
        }
        return { ok: true, data: undefined };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}
