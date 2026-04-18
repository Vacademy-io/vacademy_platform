import { AI_SERVICE_BASE_URL } from '@/constants/urls';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InputVideoMode = 'podcast' | 'demo';

export type InputVideoStatus = 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface InputVideoRecord {
    id: string;
    institute_id: string;
    name: string;
    mode: InputVideoMode;
    status: InputVideoStatus;
    source_url: string;
    duration_seconds: number | null;
    resolution: string | null;
    context_json_url: string | null;
    spatial_db_url: string | null;
    assets_urls: Record<string, string> | null;
    render_job_id: string | null;
    progress: number;
    error_message: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface InputVideoStatusResponse {
    id: string;
    status: InputVideoStatus;
    progress: number;
    error_message: string | null;
}

export interface CreateInputVideoPayload {
    name: string;
    mode: InputVideoMode;
    source_url: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const BASE = `${AI_SERVICE_BASE_URL}/input-video`;

function headers(apiKey: string): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'X-Institute-Key': apiKey,
    };
}

/** Create a new input video record and start indexing. */
export async function createInputVideo(
    apiKey: string,
    payload: CreateInputVideoPayload
): Promise<InputVideoRecord> {
    const resp = await fetch(`${BASE}/create`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify(payload),
    });
    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Create failed (${resp.status}): ${err}`);
    }
    return resp.json();
}

/** List all input videos for the institute (newest first). */
export async function listInputVideos(apiKey: string): Promise<InputVideoRecord[]> {
    const resp = await fetch(`${BASE}/list`, {
        method: 'GET',
        headers: headers(apiKey),
    });
    if (!resp.ok) {
        throw new Error(`List failed (${resp.status})`);
    }
    return resp.json();
}

/** Get full details for a single input video. */
export async function getInputVideo(apiKey: string, id: string): Promise<InputVideoRecord> {
    const resp = await fetch(`${BASE}/${id}`, {
        method: 'GET',
        headers: headers(apiKey),
    });
    if (!resp.ok) {
        throw new Error(`Get failed (${resp.status})`);
    }
    return resp.json();
}

/** Lightweight status check for polling. */
export async function getInputVideoStatus(
    apiKey: string,
    id: string
): Promise<InputVideoStatusResponse> {
    const resp = await fetch(`${BASE}/${id}/status`, {
        method: 'GET',
        headers: headers(apiKey),
    });
    if (!resp.ok) {
        throw new Error(`Status check failed (${resp.status})`);
    }
    return resp.json();
}

/** Delete an input video record. */
export async function deleteInputVideo(apiKey: string, id: string): Promise<void> {
    const resp = await fetch(`${BASE}/${id}`, {
        method: 'DELETE',
        headers: headers(apiKey),
    });
    if (!resp.ok) {
        throw new Error(`Delete failed (${resp.status})`);
    }
}
