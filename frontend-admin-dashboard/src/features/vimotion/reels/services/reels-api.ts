/**
 * Typed HTTP client for the reels-from-long-video pipeline.
 *
 * Mirrors the convention from `routes/video-api-studio/-services/input-asset.ts`:
 * native fetch, X-Institute-Key auth, throw on non-OK responses with a
 * status-prefixed message.
 *
 * Endpoint contract: backend mounts the router at
 *   {AI_SERVICE_BASE_URL}/external/reels/v1/*
 * via app_factory.py — see `app/routers/reels.py` for the source of truth.
 */
import { AI_SERVICE_BASE_URL } from '@/constants/urls';

// ---------------------------------------------------------------------------
// Types — must stay in sync with app/schemas/reels.py
// ---------------------------------------------------------------------------

export type Aspect = '9:16' | '16:9' | '1:1';
export type Layout =
    | 'full_speaker_with_overlays'
    | 'split_top_speaker'
    | 'pip_corner_speaker'
    | 'lower_third_speaker'
    | 'book_quote'
    | 'stacked_speaker_with_broll';
export type CaptionPreset = 'hormozi' | 'karaoke' | 'pop' | 'clean';
export type SilenceTrim = 'off' | 'gentle' | 'on' | 'aggressive';
export type AudioStrategy = 'keep_speaker' | 'keep_speaker_plus_bgm' | 'tts_overdub';
export type ReelStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface ScoreAxes {
    hook: number;
    pacing: number;
    info: number;
    loop: number;
    composite: number;
}

export interface ScoreBreakdown {
    opener_quality?: number | null;
    energy_first_2_5s?: number | null;
    first_sentence_complete?: boolean | null;
    silence_fraction?: number | null;
    emphasis_density?: number | null;
    predicted_after_silence_s?: number | null;
    unique_content_words_per_s?: number | null;
    numeric_token_count?: number | null;
    first_last_mfcc_similarity?: number | null;
    has_verbal_cta_end?: boolean | null;
    word_cut_savings_needed_s?: number | null;
    word_cut_savings_pct?: number | null;
    speaker_moves_in_window?: number | null;
}

export interface ReelCandidate {
    candidate_id: string;
    rank: number;
    source_t_start: number;
    source_t_end: number;
    source_duration_s: number;
    predicted_output_duration_s: number;
    score: ScoreAxes;
    breakdown: ScoreBreakdown;
    transcript_snippet: string;
    thumbnail_strip_url: string | null;
    low_confidence: boolean;
}

export interface TimeRange {
    t_start: number;
    t_end: number;
}

export interface ScanRequest {
    input_asset_id: string;
    target_duration_sec?: number;
    duration_tolerance_sec?: number;
    scan_limit?: number;
    aspect?: Aspect;
    topic_keywords?: string[];
    must_include_ranges?: TimeRange[];
}

export interface ScanResponse {
    input_asset_id: string;
    config_hash: string;
    candidates: ReelCandidate[];
    total_returned: number;
    cache_ttl_seconds: number;
}

export interface CutSpan {
    t_start: number;
    t_end: number;
    kind: 'silence' | 'word' | 'filler';
}

export interface WordImportance {
    word: string;
    t_start: number;
    t_end: number;
    importance: 0 | 1 | 2 | 3;
    keyword_type?: 'important' | 'definition' | 'warning' | null;
}

export interface EnrichedCandidate {
    candidate_id: string;
    title: string;
    rationale: string;
    word_importance: WordImportance[];
    cut_plan: CutSpan[];
    predicted_output_duration_s: number;
}

export interface PreviewRequest {
    input_asset_id: string;
    candidate_ids: string[];
}

export interface PreviewResponse {
    enriched: EnrichedCandidate[];
}

export interface PaceConfig {
    silence_trim?: SilenceTrim;
    speed_multiplier?: number;
    word_trim?: boolean;
}

export interface VisualPreferences {
    stock_video?: 'no' | 'auto' | 'high';
    ai_imagery?: 'no' | 'auto' | 'high';
    svg_illustrated?: 'no' | 'auto' | 'high';
    motion_graphics?: 'no' | 'auto' | 'high';
    app_ui_mockup?: 'no' | 'auto' | 'high';
    text_density?: 'minimal' | 'low' | 'auto' | 'rich';
}

export interface CaptionConfig {
    enabled?: boolean;
    preset?: CaptionPreset;
    keyword_palette?: Record<string, string>;
}

export interface BrandingConfig {
    logo_url?: string | null;
    accent_color?: string | null;
    font_family?: string | null;
}

export interface RenderRequest {
    input_asset_id: string;
    candidate_id: string;
    aspect?: Aspect;
    layout?: Layout;
    pace?: PaceConfig;
    audio_strategy?: AudioStrategy;
    background_music_url?: string | null;
    /** Only consumed when layout=stacked_speaker_with_broll. Plays in the
     *  bottom half of the reel as ambient engagement footage. */
    background_video_url?: string | null;
    ducking?: boolean;
    captions?: CaptionConfig;
    branding?: BrandingConfig;
    visual_preferences?: VisualPreferences;
}

export interface StageProgress {
    stage: string;
    progress: number;
}

export interface ReelResponse {
    id: string;
    reel_id: string;
    institute_id: string;
    input_asset_id: string;
    candidate_id?: string | null;
    status: ReelStatus;
    current_stage: string;
    progress: number;
    stages: StageProgress[];
    error_message?: string | null;
    config: Record<string, unknown>;
    source_window: Record<string, unknown>;
    trim_map?: Record<string, unknown> | null;
    s3_urls: Record<string, string>;
    metadata: Record<string, unknown>;
    created_at: string | null;
    updated_at: string | null;
    completed_at: string | null;
}

export interface ReelStatusResponse {
    id: string;
    status: ReelStatus;
    current_stage: string;
    progress: number;
    stages: StageProgress[];
    error_message?: string | null;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const BASE = `${AI_SERVICE_BASE_URL}/external/reels/v1`;

function headers(apiKey: string): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'X-Institute-Key': apiKey,
    };
}

async function readError(resp: Response, fallback: string): Promise<string> {
    try {
        const body = await resp.text();
        return body ? `${fallback} (${resp.status}): ${body.slice(0, 200)}` : `${fallback} (${resp.status})`;
    } catch {
        return `${fallback} (${resp.status})`;
    }
}

export async function scanReelCandidates(
    apiKey: string,
    request: ScanRequest
): Promise<ScanResponse> {
    const resp = await fetch(`${BASE}/scan`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify(request),
    });
    if (!resp.ok) throw new Error(await readError(resp, 'Scan failed'));
    return resp.json();
}

export async function previewReelCandidates(
    apiKey: string,
    request: PreviewRequest
): Promise<PreviewResponse> {
    const resp = await fetch(`${BASE}/preview`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify(request),
    });
    if (!resp.ok) throw new Error(await readError(resp, 'Preview failed'));
    return resp.json();
}

export async function renderReel(
    apiKey: string,
    request: RenderRequest
): Promise<ReelResponse> {
    const resp = await fetch(`${BASE}/render`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify(request),
    });
    if (!resp.ok) throw new Error(await readError(resp, 'Render failed'));
    return resp.json();
}

export async function listReels(
    apiKey: string,
    inputAssetId?: string
): Promise<ReelResponse[]> {
    const url = inputAssetId
        ? `${BASE}/list?input_asset_id=${encodeURIComponent(inputAssetId)}`
        : `${BASE}/list`;
    const resp = await fetch(url, { method: 'GET', headers: headers(apiKey) });
    if (!resp.ok) throw new Error(await readError(resp, 'List failed'));
    return resp.json();
}

export async function getReel(apiKey: string, reelId: string): Promise<ReelResponse> {
    const resp = await fetch(`${BASE}/${encodeURIComponent(reelId)}`, {
        method: 'GET',
        headers: headers(apiKey),
    });
    if (!resp.ok) throw new Error(await readError(resp, 'Get reel failed'));
    return resp.json();
}

export async function getReelStatus(
    apiKey: string,
    reelId: string
): Promise<ReelStatusResponse> {
    const resp = await fetch(`${BASE}/${encodeURIComponent(reelId)}/status`, {
        method: 'GET',
        headers: headers(apiKey),
    });
    if (!resp.ok) throw new Error(await readError(resp, 'Status failed'));
    return resp.json();
}

export async function deleteReel(apiKey: string, reelId: string): Promise<void> {
    const resp = await fetch(`${BASE}/${encodeURIComponent(reelId)}`, {
        method: 'DELETE',
        headers: headers(apiKey),
    });
    if (!resp.ok) throw new Error(await readError(resp, 'Delete failed'));
}
