/**
 * Media picker API — stock search (Pexels/Pixabay), AI image generation,
 * re-host, and the per-institute saved asset library. Wraps the ai_service
 * `/external/video/v1/media/*` endpoints. Mirrors the HTTP-boundary style of
 * `audio-track-api.ts` / `sentence-api.ts`.
 */
import { AI_SERVICE_BASE_URL } from '@/constants/urls';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type MediaKind = 'image' | 'video';
export type MediaProvider = 'pexels' | 'pixabay' | 'auto';
export type MediaSource = 'upload' | 'pexels' | 'pixabay' | 'ai';

export interface MediaSearchItem {
    url: string;
    thumb: string;
    photographer: string;
    photographer_url: string;
    alt: string;
    source: string;
    source_url: string;
    width?: number | null;
    height?: number | null;
    duration?: number | null;
    kind: MediaKind;
}

export interface MediaSearchResponse {
    items: MediaSearchItem[];
    provider_used: string;
}

export interface SavedAsset {
    id: string;
    url: string;
    thumb_url: string | null;
    kind: MediaKind;
    source: MediaSource;
    prompt: string | null;
    source_url: string | null;
    photographer: string | null;
    width: number | null;
    height: number | null;
    duration: number | null;
    created_at: string | null;
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

async function post<T>(path: string, apiKey: string, body: unknown): Promise<ApiResult<T>> {
    try {
        const res = await fetch(`${AI_SERVICE_BASE_URL}${path}`, {
            method: 'POST',
            headers: headers(apiKey),
            body: JSON.stringify(body),
        });
        if (!res.ok) return { ok: false, error: await readError(res) };
        return { ok: true, data: (await res.json()) as T };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

export function apiSearchImages(
    apiKey: string,
    query: string,
    provider: MediaProvider,
    orientation: string
): Promise<ApiResult<MediaSearchResponse>> {
    return post('/external/video/v1/media/search-images', apiKey, {
        query,
        provider,
        orientation,
    });
}

export function apiSearchVideos(
    apiKey: string,
    query: string,
    provider: MediaProvider,
    orientation: string
): Promise<ApiResult<MediaSearchResponse>> {
    return post('/external/video/v1/media/search-videos', apiKey, {
        query,
        provider,
        orientation,
    });
}

export function apiGenerateImage(
    apiKey: string,
    prompt: string,
    orientation: string
): Promise<ApiResult<{ url: string }>> {
    return post('/external/video/v1/media/generate-image', apiKey, { prompt, orientation });
}

export function apiRehost(
    apiKey: string,
    url: string,
    kind: MediaKind
): Promise<ApiResult<{ url: string }>> {
    return post('/external/video/v1/media/rehost', apiKey, { url, kind });
}

export function apiSaveAsset(
    apiKey: string,
    asset: {
        url: string;
        kind: MediaKind;
        source: MediaSource;
        thumb_url?: string | null;
        prompt?: string | null;
        source_url?: string | null;
        photographer?: string | null;
        width?: number | null;
        height?: number | null;
        duration?: number | null;
    }
): Promise<ApiResult<SavedAsset>> {
    return post('/external/video/v1/media/asset', apiKey, asset);
}

export async function apiListAssets(
    apiKey: string,
    kind?: MediaKind,
    q?: string
): Promise<ApiResult<SavedAsset[]>> {
    try {
        const params = new URLSearchParams();
        if (kind) params.set('kind', kind);
        if (q) params.set('q', q);
        const res = await fetch(
            `${AI_SERVICE_BASE_URL}/external/video/v1/media/assets?${params.toString()}`,
            { headers: headers(apiKey) }
        );
        if (!res.ok) return { ok: false, error: await readError(res) };
        return { ok: true, data: (await res.json()) as SavedAsset[] };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

export async function apiDeleteAsset(
    apiKey: string,
    assetId: string
): Promise<ApiResult<{ deleted: boolean }>> {
    try {
        const res = await fetch(`${AI_SERVICE_BASE_URL}/external/video/v1/media/asset/${assetId}`, {
            method: 'DELETE',
            headers: headers(apiKey),
        });
        if (!res.ok) return { ok: false, error: await readError(res) };
        return { ok: true, data: (await res.json()) as { deleted: boolean } };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
