import { AI_SERVICE_BASE_URL } from '@/constants/urls';

export type VideoStage = 'PENDING' | 'SCRIPT' | 'TTS' | 'WORDS' | 'HTML' | 'RENDER';
export type VideoStatusType = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'STALLED';

export type VoiceGender = 'female' | 'male';
export type TtsProvider = 'standard' | 'premium';

/**
 * A single TTS voice option returned by the /tts/voices API
 */
export interface TtsVoice {
    id: string;
    name: string;
    provider: 'edge' | 'google' | 'sarvam';
    sample_url: string;
}

/**
 * Response from GET /tts/voices
 */
export interface TtsVoicesResponse {
    tier: string;
    provider: string;
    language: string;
    gender: string;
    voices: TtsVoice[];
}

/**
 * All supported content types from the API
 */
export type ContentType =
    | 'VIDEO' // Time-synced HTML overlays with audio (default)
    | 'QUIZ' // Question-based assessments
    | 'STORYBOOK' // Page-by-page narratives
    | 'INTERACTIVE_GAME' // Self-contained HTML games
    | 'PUZZLE_BOOK' // Collection of puzzles (crossword, word search)
    | 'SIMULATION' // Physics/economic sandboxes
    | 'FLASHCARDS' // Spaced-repetition cards
    | 'MAP_EXPLORATION' // Interactive SVG maps
    | 'WORKSHEET' // Printable/interactive homework
    | 'CODE_PLAYGROUND' // Interactive code exercises
    | 'TIMELINE' // Chronological event visualization
    | 'CONVERSATION' // Language learning dialogues
    | 'SLIDES'; // HTML presentation / PPT-style slide deck

/**
 * Navigation modes for content playback
 */
export type NavigationMode = 'time_driven' | 'user_driven' | 'self_contained';

/**
 * Mapping of content types to navigation modes
 */
export const CONTENT_TYPE_NAVIGATION: Record<ContentType, NavigationMode> = {
    VIDEO: 'time_driven',
    QUIZ: 'user_driven',
    STORYBOOK: 'user_driven',
    INTERACTIVE_GAME: 'self_contained',
    PUZZLE_BOOK: 'user_driven',
    SIMULATION: 'self_contained',
    FLASHCARDS: 'user_driven',
    MAP_EXPLORATION: 'user_driven',
    WORKSHEET: 'user_driven',
    CODE_PLAYGROUND: 'self_contained',
    TIMELINE: 'user_driven',
    CONVERSATION: 'user_driven',
    SLIDES: 'user_driven',
};

/**
 * Content type options with labels and emojis for UI
 */
export const CONTENT_TYPES = [
    {
        value: 'VIDEO' as ContentType,
        label: '📹 Video',
        description: 'Narrated videos with animations and visuals',
    },
    {
        value: 'SLIDES' as ContentType,
        label: '🖼️ Slides',
        description: 'Slide decks with images, charts, and diagrams',
    },
    { value: 'QUIZ' as ContentType, label: '❓ Quiz', description: 'Interactive quizzes to test knowledge' },
    {
        value: 'STORYBOOK' as ContentType,
        label: '📚 Storybook',
        description: 'Illustrated stories to flip through',
    },
    {
        value: 'INTERACTIVE_GAME' as ContentType,
        label: '🎮 Interactive Game',
        description: 'Playable games that teach through interaction',
    },
    {
        value: 'PUZZLE_BOOK' as ContentType,
        label: '🧩 Puzzle Book',
        description: 'Crosswords, word searches, and brain teasers',
    },
    {
        value: 'SIMULATION' as ContentType,
        label: '🔬 Simulation',
        description: 'Hands-on science and physics simulations',
    },
    {
        value: 'FLASHCARDS' as ContentType,
        label: '📇 Flashcards',
        description: 'Study flashcards for quick memorization',
    },
    {
        value: 'MAP_EXPLORATION' as ContentType,
        label: '🗺️ Map Exploration',
        description: 'Interactive maps to click and explore',
    },
    {
        value: 'WORKSHEET' as ContentType,
        label: '📝 Worksheet',
        description: 'Practice worksheets with exercises and answers',
    },
    {
        value: 'CODE_PLAYGROUND' as ContentType,
        label: '💻 Code Playground',
        description: 'Coding challenges with a live editor',
    },
    {
        value: 'TIMELINE' as ContentType,
        label: '⏳ Timeline',
        description: 'Interactive, scrollable event timelines',
    },
    {
        value: 'CONVERSATION' as ContentType,
        label: '💬 Conversation',
        description: 'Real-world conversation simulations',
    },
] as const;

export type VideoOrientation = 'landscape' | 'portrait';
export type QualityTier = 'free' | 'standard' | 'premium' | 'ultra';

export interface ReferenceFile {
    url: string;
    name: string;
    type: 'image' | 'pdf';
}

export interface GenerateVideoRequest {
    prompt: string;
    content_type?: ContentType; // NEW: Default "VIDEO"
    language: string;
    voice_gender: VoiceGender;
    tts_provider: TtsProvider;
    voice_id?: string; // Specific voice for premium TTS (Sarvam/Google voice name)
    captions_enabled: boolean;
    html_quality: 'classic' | 'advanced';
    target_audience: string;
    target_duration: string;
    model: string;
    quality_tier: QualityTier;
    video_id?: string; // Optional: auto-generated if not provided
    reference_files?: ReferenceFile[];
    orientation?: VideoOrientation;
}

export const QUALITY_TIERS: Array<{
    value: QualityTier;
    label: string;
    description: string;
    badge?: string;
}> = [
    {
        value: 'free',
        label: 'Free',
        description: 'Fast generation, basic quality',
    },
    {
        value: 'standard',
        label: 'Standard',
        description: 'Smart visuals with diversity & validation',
    },
    {
        value: 'premium',
        label: 'Premium',
        description: 'Script review + image enhancement',
    },
    {
        value: 'ultra',
        label: 'Ultra',
        description: 'Best quality — all enhancements enabled',
        badge: 'Default',
    },
];

export interface ProgressEvent {
    type: 'progress';
    stage: VideoStage;
    message: string;
    percentage: number;
    video_id: string;
    content_type?: ContentType; // NEW: Included in events
    files?: {
        script?: { file_id: string; s3_url: string };
        audio?: { file_id: string; s3_url: string };
        words?: { file_id: string; s3_url: string };
        timeline?: { file_id: string; s3_url: string };
        video?: { file_id: string; s3_url: string };
    };
}

export interface CompletedEvent {
    type: 'completed';
    video_id?: string;
    content_type?: ContentType; // NEW: Included in events
    files: {
        video?: string;
        script?: string;
        audio?: string;
        timeline?: string;
        words?: string;
    };
    percentage: number;
}

export interface InfoEvent {
    type: 'info';
    message: string;
    video_id?: string;
    content_type?: ContentType;
}

export interface ErrorEvent {
    type: 'error';
    message: string;
    stage?: VideoStage;
    video_id?: string;
}

export type SSEEvent = ProgressEvent | CompletedEvent | InfoEvent | ErrorEvent;

export interface VideoUrls {
    video_id: string;
    html_url: string | null;
    audio_url: string | null;
    words_url: string | null;
    avatar_url?: string | null;
    video_url?: string | null;
    status: VideoStatusType;
    current_stage: VideoStage;
    updated_at?: string | null;
    error_message?: string | null;
    render_job_id?: string | null;
}

export interface VideoStatusResponse {
    id: string;
    video_id: string;
    current_stage: VideoStage;
    status: VideoStatusType;
    s3_urls: {
        script?: string;
        audio?: string;
        video?: string;
    };
    created_at: string;
}

export interface HistoryItem {
    id: string;
    video_id: string;
    prompt: string;
    content_type: ContentType; // NEW: Track content type
    status: 'pending' | 'generating' | 'completed' | 'failed';
    stage: VideoStage;
    created_at: string;
    html_url?: string;
    audio_url?: string;
    video_url?: string;
    timeline_url?: string;
    words_url?: string;
    options: Omit<GenerateVideoRequest, 'prompt'>;
}

const HISTORY_STORAGE_KEY = 'vacademy_video_generation_history';

export const LANGUAGES = [
    // Global
    { value: 'English (US)', label: 'English (US)', group: 'Global' },
    { value: 'English (UK)', label: 'English (UK)', group: 'Global' },
    { value: 'Spanish', label: 'Spanish', group: 'Global' },
    { value: 'French', label: 'French', group: 'Global' },
    { value: 'German', label: 'German', group: 'Global' },
    { value: 'Japanese', label: 'Japanese', group: 'Global' },
    { value: 'Chinese', label: 'Chinese', group: 'Global' },
    // Indian
    { value: 'English (India)', label: 'English (India)', group: 'Indian' },
    { value: 'Hindi', label: 'Hindi', group: 'Indian' },
    { value: 'Bengali', label: 'Bengali', group: 'Indian' },
    { value: 'Tamil', label: 'Tamil', group: 'Indian' },
    { value: 'Telugu', label: 'Telugu', group: 'Indian' },
    { value: 'Marathi', label: 'Marathi', group: 'Indian' },
    { value: 'Kannada', label: 'Kannada', group: 'Indian' },
    { value: 'Gujarati', label: 'Gujarati', group: 'Indian' },
    { value: 'Malayalam', label: 'Malayalam', group: 'Indian' },
] as const;

export const VOICE_GENDERS = [
    { value: 'female', label: 'Female' },
    { value: 'male', label: 'Male' },
] as const;

export const TTS_PROVIDERS = [
    { value: 'standard' as TtsProvider, label: 'Standard', description: 'Microsoft Edge TTS (Free)' },
    { value: 'premium' as TtsProvider, label: 'Premium', description: 'Google Cloud / Sarvam AI (2x credits)' },
] as const;

export const TARGET_AUDIENCES = [
    'Class 1-2 (Ages 6-7)',
    'Class 3-4 (Ages 8-9)',
    'Class 5 (Ages 10-11)',
    'Class 6-8 (Ages 11-14)',
    'Class 9-10 (Ages 14-16)',
    'Class 11-12 (Ages 16-18)',
    'Undergraduate',
    'Graduate/Professional',
    'General/Adult',
];

export const TARGET_DURATIONS = [
    '30 seconds',
    '1 minute',
    '2-3 minutes',
    '5 minutes',
    '10 minutes',
];

export const DEFAULT_OPTIONS: Omit<GenerateVideoRequest, 'prompt'> = {
    content_type: 'VIDEO',
    language: 'English (US)',
    voice_gender: 'female',
    tts_provider: 'standard',
    voice_id: undefined,
    captions_enabled: true,
    html_quality: 'advanced',
    target_audience: 'Class 5 (Ages 10-11)',
    target_duration: '2-3 minutes',
    model: '',
    quality_tier: 'ultra',
    orientation: 'landscape',
};

export function generateVideoId(): string {
    return `vid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Fetch available TTS voices from the API for a given language, gender, and tier.
 */
export async function fetchTtsVoices(
    language: string,
    gender: VoiceGender,
    tier: TtsProvider,
): Promise<TtsVoicesResponse> {
    const params = new URLSearchParams({ language, gender, tier });
    const resp = await fetch(
        `${AI_SERVICE_BASE_URL}/external/video/v1/tts/voices?${params}`,
    );
    if (!resp.ok) throw new Error(`Failed to fetch TTS voices: ${resp.status}`);
    return resp.json();
}

/**
 * Response metadata from generation API
 */
export interface GenerationResponse {
    videoId: string;
    contentType: ContentType;
    abort: () => void;
}

/**
 * Generate content (video, quiz, storybook, etc.)
 */
export function generateVideo(
    request: GenerateVideoRequest,
    apiKey: string,
    onProgress: (event: SSEEvent) => void,
    onError: (error: Error) => void,
    onHeadersReceived?: (headers: { videoId: string; contentType: ContentType }) => void
): GenerationResponse {
    const videoId = request.video_id || generateVideoId();
    const controller = new AbortController();
    const contentType = request.content_type || 'VIDEO';

    const body = {
        ...request,
        video_id: videoId,
        content_type: contentType,
    };

    fetch(`${AI_SERVICE_BASE_URL}/external/video/v1/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Institute-Key': apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
    })
        .then(async (response) => {
            if (!response.ok) {
                const errorText = await response.text().catch(() => response.statusText);
                if (response.status === 402) {
                    // Parse detail from FastAPI error response
                    let detail = 'Insufficient credits';
                    try {
                        const parsed = JSON.parse(errorText);
                        detail = parsed.detail || detail;
                    } catch {
                        // use raw text
                        detail = errorText || detail;
                    }
                    const err = new Error(detail);
                    err.name = 'InsufficientCreditsError';
                    throw err;
                }
                if (response.status === 429) {
                    let detail = 'Too many requests. Please wait a moment and try again.';
                    try {
                        const parsed = JSON.parse(errorText);
                        detail = parsed.detail || detail;
                    } catch {
                        detail = errorText || detail;
                    }
                    const err = new Error(detail);
                    err.name = 'RateLimitError';
                    throw err;
                }
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            // Read content type from response headers
            const responseVideoId = response.headers.get('X-Video-ID') || videoId;
            const responseContentType =
                (response.headers.get('X-Content-Type') as ContentType) || contentType;

            // Notify caller of headers
            if (onHeadersReceived) {
                onHeadersReceived({
                    videoId: responseVideoId,
                    contentType: responseContentType,
                });
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            // eslint-disable-next-line no-constant-condition
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            let jsonStr = line.slice(6).trim();
                            // Handle Python-style single quotes by converting to double quotes
                            jsonStr = jsonStr
                                .replace(/'/g, '"')
                                .replace(/None/g, 'null')
                                .replace(/True/g, 'true')
                                .replace(/False/g, 'false');
                            const data = JSON.parse(jsonStr) as SSEEvent;
                            onProgress(data);
                        } catch (e) {
                            console.warn('SSE parse error:', e, 'Line:', line);
                        }
                    }
                }
            }
        })
        .catch((error) => {
            if (error.name !== 'AbortError') {
                onError(error);
            }
        });

    return {
        abort: () => controller.abort(),
        videoId,
        contentType,
    };
}

export async function getVideoUrls(videoId: string, apiKey: string): Promise<VideoUrls> {
    const response = await fetch(`${AI_SERVICE_BASE_URL}/external/video/v1/urls/${videoId}`, {
        headers: {
            'X-Institute-Key': apiKey,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to get video URLs: ${response.statusText}`);
    }

    return response.json();
}

// ---------------------------------------------------------------------------
// Render settings
// ---------------------------------------------------------------------------

export type RenderResolution = '720p' | '1080p';
export type RenderFps = 15 | 20 | 25;
export type CaptionSize = 'S' | 'M' | 'L';
export type CaptionPosition = 'top' | 'bottom';

export interface RenderSettings {
    resolution: RenderResolution;
    fps: RenderFps;
    captions: boolean;
    captionPosition: CaptionPosition;
    captionTextColor: string;
    captionBgColor: string;
    captionBgOpacity: number; // 0-100
    captionSize: CaptionSize;
    watermark: boolean;
}

export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
    resolution: '720p',
    fps: 20,
    captions: true,
    captionPosition: 'bottom',
    captionTextColor: '#ffffff',
    captionBgColor: '#000000',
    captionBgOpacity: 60,
    captionSize: 'M',
    watermark: true,
};

export async function requestVideoRender(
    videoId: string,
    apiKey: string,
    settings?: RenderSettings
): Promise<{ job_id: string; status: string }> {
    const headers: Record<string, string> = {
        'X-Institute-Key': apiKey,
    };
    let body: string | undefined;

    if (settings) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({
            resolution: settings.resolution,
            fps: settings.fps,
            show_captions: settings.captions,
            show_branding: settings.watermark,
            caption_position: settings.captionPosition,
            caption_text_color: settings.captionTextColor,
            caption_bg_color: settings.captionBgColor,
            caption_bg_opacity: settings.captionBgOpacity,
            caption_size: settings.captionSize,
        });
    }

    const response = await fetch(`${AI_SERVICE_BASE_URL}/external/video/v1/render/${videoId}`, {
        method: 'POST',
        headers,
        body,
    });

    if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(`Failed to request render: ${text}`);
    }

    return response.json();
}

export interface RenderStatus {
    job_id: string;
    video_id: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'unknown';
    progress: number | null;
    video_url: string | null;
    error: string | null;
}

export async function getRenderStatus(
    jobId: string,
    apiKey: string
): Promise<RenderStatus> {
    const response = await fetch(
        `${AI_SERVICE_BASE_URL}/external/video/v1/render/status/${jobId}`,
        {
            headers: {
                'X-Institute-Key': apiKey,
            },
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to get render status: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Clear the cached rendered MP4 for a video so it can be re-rendered.
 * Removes `video` from s3_urls and `render_job_id` from metadata.
 */
export async function clearRenderedVideo(
    videoId: string,
    apiKey: string
): Promise<void> {
    const response = await fetch(
        `${AI_SERVICE_BASE_URL}/external/video/v1/render/${videoId}`,
        {
            method: 'DELETE',
            headers: {
                'X-Institute-Key': apiKey,
            },
        }
    );

    if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(`Failed to clear rendered video: ${text}`);
    }
}

export async function getVideoStatus(
    videoId: string,
    apiKey: string
): Promise<VideoStatusResponse> {
    const response = await fetch(`${AI_SERVICE_BASE_URL}/external/video/v1/status/${videoId}`, {
        headers: {
            'X-Institute-Key': apiKey,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to get video status: ${response.statusText}`);
    }

    return response.json();
}

export function getHistory(): HistoryItem[] {
    try {
        const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

export function saveToHistory(item: HistoryItem): void {
    const history = getHistory();
    const existingIndex = history.findIndex((h) => h.video_id === item.video_id);

    if (existingIndex >= 0) {
        history[existingIndex] = item;
    } else {
        history.unshift(item);
    }

    // Keep only last 50 items
    const trimmed = history.slice(0, 50);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
}

export function deleteFromHistory(videoId: string): void {
    const history = getHistory().filter((h) => h.video_id !== videoId);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
}

export function clearHistory(): void {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
}

/**
 * Get navigation mode for a content type
 */
export function getNavigationMode(contentType: ContentType): NavigationMode {
    return CONTENT_TYPE_NAVIGATION[contentType] || 'time_driven';
}

/**
 * Check if content type requires audio
 */
export function requiresAudio(contentType: ContentType): boolean {
    return getNavigationMode(contentType) === 'time_driven';
}

/**
 * Get content type label for display
 */
export function getContentTypeLabel(contentType: ContentType): string {
    const found = CONTENT_TYPES.find((ct) => ct.value === contentType);
    return found?.label || contentType;
}

interface RemoteHistoryItem {
    id: string;
    video_id: string;
    current_stage: VideoStage;
    status: VideoStatusType;
    content_type: ContentType;
    file_ids: Record<string, string>;
    s3_urls: {
        audio?: string;
        words?: string;
        script?: string;
        timeline?: string;
        branding_meta?: string;
        generated_images?: string;
    };
    prompt: string;
    language: string;
    error_message: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
}

/** Map backend status strings (uppercase) to FE HistoryItem status. */
function mapRemoteStatus(status: string): HistoryItem['status'] {
    switch (status.toUpperCase()) {
        case 'COMPLETED': return 'completed';
        case 'FAILED':    return 'failed';
        case 'STALLED':   return 'failed';
        case 'IN_PROGRESS': return 'generating';
        case 'PENDING':   return 'pending';
        default:          return 'pending';
    }
}

export async function getRemoteHistory(apiKey: string, limit: number = 20): Promise<HistoryItem[]> {
    const response = await fetch(
        `${AI_SERVICE_BASE_URL}/external/video/v1/history?limit=${limit}`,
        {
            headers: {
                'X-Institute-Key': apiKey,
                accept: 'application/json',
            },
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch history: ${response.statusText}`);
    }

    const data: RemoteHistoryItem[] = await response.json();

    return data.map((item) => ({
        id: item.id,
        video_id: item.video_id,
        prompt: item.prompt,
        content_type: item.content_type,
        status: mapRemoteStatus(item.status),
        stage: item.current_stage,
        created_at: item.created_at,
        html_url: item.s3_urls.timeline,
        audio_url: item.s3_urls.audio,
        words_url: item.s3_urls.words,
        // Reconstruct options as they aren't fully returned by the history API yet
        options: {
            content_type: item.content_type,
            language: item.language,
            // Defaults for missing fields
            voice_gender: 'female',
            tts_provider: 'standard',
            captions_enabled: true,
            html_quality: 'advanced',
            target_audience: 'General/Adult',
            target_duration: '2-3 minutes',
            model: '',
            quality_tier: 'ultra',
        },
    }));
}

// ---------------------------------------------------------------------------
// Frame regeneration
// ---------------------------------------------------------------------------

export interface RegenerateFrameResponse {
    video_id: string;
    frame_index: number;
    timestamp: number;
    original_html: string;
    new_html: string;
}

/**
 * Ask the AI to regenerate a single frame's HTML using a user prompt.
 * Pass the entry's inTime (seconds) as `timestamp` for time_driven videos,
 * or the entry's array index for user_driven/self_contained.
 * Returns the new HTML for preview — call frame/update to persist.
 */
export async function regenerateFrame(
    videoId: string,
    apiKey: string,
    timestamp: number,
    userPrompt: string
): Promise<RegenerateFrameResponse> {
    const response = await fetch(`${AI_SERVICE_BASE_URL}/external/video/v1/frame/regenerate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Institute-Key': apiKey,
        },
        body: JSON.stringify({
            video_id: videoId,
            timestamp,
            user_prompt: userPrompt,
        }),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(`Failed to regenerate frame: ${text}`);
    }

    return response.json();
}
