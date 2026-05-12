/**
 * Vimotion intent-aware thumbnails API client.
 *
 * Backend: ai_service `/external/video/v1/thumbnail/*` routes, authed by the
 * institute's `X-Institute-Key` (auto-provisioned by `useVimotionApiKey`).
 *
 * The thumbnail set is also embedded in the `getRemoteHistory` payload and on
 * `getVideoUrls` — these helpers are for explicit fetch / swap / regenerate
 * actions from the production view + editor.
 */
import {
    VIMOTION_VIDEO_THUMBNAIL,
    VIMOTION_VIDEO_THUMBNAIL_REGENERATE,
} from '@/constants/urls';
import type {
    ThumbnailSet,
    ThumbnailOption,
} from '@/routes/video-api-studio/-services/video-generation';

export type { ThumbnailSet, ThumbnailOption };

function authHeaders(apiKey: string): Record<string, string> {
    return {
        'X-Institute-Key': apiKey,
        accept: 'application/json',
    };
}

/** Normalise the wire response (which may include `{}` for an unset set). */
function normaliseThumbnailSet(raw: unknown): ThumbnailSet | null {
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Partial<ThumbnailSet>;
    if (!Array.isArray(obj.options) || obj.options.length === 0) return null;
    return obj as ThumbnailSet;
}

export async function getThumbnailSet(
    videoId: string,
    apiKey: string
): Promise<ThumbnailSet | null> {
    const response = await fetch(VIMOTION_VIDEO_THUMBNAIL(videoId), {
        headers: authHeaders(apiKey),
    });
    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error(`Failed to fetch thumbnail set: ${response.statusText}`);
    }
    const data = await response.json();
    return normaliseThumbnailSet(data);
}

export async function setSelectedThumbnail(
    videoId: string,
    selectedId: string,
    apiKey: string
): Promise<ThumbnailSet> {
    const response = await fetch(VIMOTION_VIDEO_THUMBNAIL(videoId), {
        method: 'PATCH',
        headers: {
            ...authHeaders(apiKey),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selected_id: selectedId }),
    });
    if (!response.ok) {
        // 400 = selected_id not in option set; 404 = no thumbnails yet.
        const text = await response.text().catch(() => response.statusText);
        throw new Error(text || `Failed to update thumbnail: ${response.status}`);
    }
    return (await response.json()) as ThumbnailSet;
}

export async function regenerateThumbnails(
    videoId: string,
    apiKey: string
): Promise<{ video_id: string; status: string; message?: string }> {
    const response = await fetch(VIMOTION_VIDEO_THUMBNAIL_REGENERATE(videoId), {
        method: 'POST',
        headers: authHeaders(apiKey),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(text || `Failed to regenerate thumbnails: ${response.status}`);
    }
    return (await response.json()) as {
        video_id: string;
        status: string;
        message?: string;
    };
}
