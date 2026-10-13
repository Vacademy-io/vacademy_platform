/**
 * LMS AI Video — teacher-facing AI video generation from inside a chapter
 * (ai_service /lms-video/v1).
 *
 * Every call carries the admin JWT and the institute `clientId` (through
 * authenticatedAxiosInstance); the server pins the caller to that institute and
 * requires a staff role. The server owns the mapping from `format` to the video
 * pipeline's options, so the dashboard only sends what the teacher chose.
 *
 * Flow: POST /estimate (review step) → POST /generate (returns video_id and
 * starts the run in the background) → the dashboard adds an HTML_VIDEO slide
 * linked by ai_gen_video_id → the slide polls GET /status/{id} until the run
 * ends. POST /cancel/{id} stops a run and refunds unused credits.
 */
import { AI_SERVICE_BASE_URL } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

export const LMS_VIDEO_BASE = `${AI_SERVICE_BASE_URL}/lms-video/v1`;

// ── request ──────────────────────────────────────────────────────────────────

export type LmsVideoFormat =
    | 'lesson_teacher'
    | 'board_explainer'
    | 'problem_walkthrough'
    | 'quick_concept'
    | 'revision_short'
    | 'storybook'
    | 'conversation'
    | 'code_lesson';

export type LmsVideoDuration = '1-2 minutes' | '2-3 minutes' | '3-5 minutes' | '5-8 minutes';

/** UI labels: Standard / Premium / Best (= ultra). */
export type LmsVideoQuality = 'standard' | 'premium' | 'ultra';

export type LmsVideoOrientation = 'landscape' | 'portrait';

export type LmsVideoLayout = 'auto' | 'corner' | 'bubble' | 'side' | 'presenter' | 'board';

export type LmsVideoVoiceGender = 'female' | 'male';

export interface LmsVideoTeacher {
    /** Spatius avatar id (TutorAsset.external_id from GET /tutor/v1/options). */
    avatar_id: string;
    name?: string;
    title?: string;
}

export interface LmsVideoReferenceFile {
    /** Public URL of an uploaded file. */
    url: string;
    name: string;
    type: 'pdf' | 'image';
}

/** Where the video is being made — stored in the video's metadata. */
export interface LmsVideoContext {
    course_id?: string;
    subject_id?: string;
    module_id?: string;
    chapter_id?: string;
    chapter_name?: string;
    package_session_id?: string;
}

export interface LmsVideoRequest {
    topic: string;
    objectives?: string | null;
    audience?: string | null;
    notes?: string | null;
    language: string;
    format: LmsVideoFormat;
    duration: LmsVideoDuration;
    quality: LmsVideoQuality;
    /** null → the format's default. */
    orientation?: LmsVideoOrientation | null;
    teacher?: LmsVideoTeacher | null;
    layout?: LmsVideoLayout | null;
    voice_gender?: LmsVideoVoiceGender | null;
    voice_id?: string | null;
    include_worked_example?: boolean | null;
    include_recap?: boolean | null;
    subject?: string | null;
    captions_enabled: boolean;
    background_music_enabled?: boolean | null;
    /** Chapter slides to ground the video on (server extracts their text). */
    source_slide_ids: string[];
    reference_files: LmsVideoReferenceFile[];
    context?: LmsVideoContext | null;
}

// ── responses ────────────────────────────────────────────────────────────────

export interface LmsVideoEstimate {
    expected_credits: number;
    low_credits: number;
    high_credits: number;
    rows: Array<{ label: string; credits: number }>;
}

export interface LmsVideoPolicy {
    enabled: boolean;
    allowed_qualities: LmsVideoQuality[];
    teacher_allowed: boolean;
    max_minutes_per_video: number;
    /** null = no monthly cap. */
    monthly_credit_cap: number | null;
    max_concurrent: number;
}

export interface LmsVideoEstimateResponse {
    estimate: LmsVideoEstimate;
    /** null when the balance couldn't be read. */
    balance: { current_balance: number | null };
    policy: LmsVideoPolicy;
    allowed: boolean;
    blocked_reason: string | null;
    /** Same codes as the /generate 402/403 errors (e.g. MONTHLY_CAP). */
    blocked_code?: string | null;
    warnings: string[];
}

export interface LmsVideoGenerateResponse {
    video_id: string;
    estimate: LmsVideoEstimate;
    /** True for code lessons: the slide gets a code editor beside the video. */
    code_editor: boolean;
    warnings: string[];
}

export type LmsVideoStatusValue =
    | 'PENDING'
    | 'IN_PROGRESS'
    | 'AWAITING_INPUT'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED';

export interface LmsVideoStatus {
    video_id: string;
    /** Usually one of LmsVideoStatusValue; kept open so a new server value never crashes the UI. */
    status: string;
    current_stage: string | null;
    percentage: number | null;
    sub_stage: string | null;
    shots_completed: number | null;
    shots_total: number | null;
    error_message: string | null;
    html_url: string | null;
    audio_url: string | null;
    updated_at: string | null;
}

export interface LmsVideoCancelResponse {
    status: string;
    video_id: string;
    stopped?: boolean;
}

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

/** COMPLETED, FAILED and CANCELLED never change again — stop polling. */
export const isTerminalLmsVideoStatus = (status: string | null | undefined): boolean =>
    !!status && TERMINAL_STATUSES.has(status.toUpperCase());

// ── calls ────────────────────────────────────────────────────────────────────

export const estimateLmsVideo = async (
    request: LmsVideoRequest,
    signal?: AbortSignal
): Promise<LmsVideoEstimateResponse> => {
    const res = await authenticatedAxiosInstance.post<LmsVideoEstimateResponse>(
        `${LMS_VIDEO_BASE}/estimate`,
        request,
        { signal }
    );
    return res.data;
};

export const generateLmsVideo = async (
    request: LmsVideoRequest
): Promise<LmsVideoGenerateResponse> => {
    const res = await authenticatedAxiosInstance.post<LmsVideoGenerateResponse>(
        `${LMS_VIDEO_BASE}/generate`,
        request
    );
    return res.data;
};

/** 404 when the video was not created through /lms-video (or belongs to another institute). */
export const getLmsVideoStatus = async (
    videoId: string,
    signal?: AbortSignal
): Promise<LmsVideoStatus> => {
    const res = await authenticatedAxiosInstance.get<LmsVideoStatus>(
        `${LMS_VIDEO_BASE}/status/${encodeURIComponent(videoId)}`,
        { signal }
    );
    return res.data;
};

export const cancelLmsVideo = async (videoId: string): Promise<LmsVideoCancelResponse> => {
    const res = await authenticatedAxiosInstance.post<LmsVideoCancelResponse>(
        `${LMS_VIDEO_BASE}/cancel/${encodeURIComponent(videoId)}`
    );
    return res.data;
};

// ── errors ───────────────────────────────────────────────────────────────────

export interface LmsVideoApiError {
    /** HTTP status, when the server answered. */
    status?: number;
    /** e.g. INSUFFICIENT_CREDITS, MONTHLY_CAP, TOO_MANY_RUNNING. */
    code?: string;
    /** Human-readable reason to show the teacher. */
    detail: string;
}

const asText = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

/**
 * Normalise an API failure into `{status, code, detail}`. Accepts every shape
 * FastAPI produces: `{detail: "…", code}`, `{detail: {detail|message, code}}`
 * (HTTPException with a dict) and the 422 list `{detail: [{msg}, …]}`.
 */
export const parseLmsVideoError = (error: unknown, fallback: string): LmsVideoApiError => {
    const response = (error as { response?: { status?: number; data?: unknown } })?.response;
    const status = response?.status;
    const data = response?.data as Record<string, unknown> | string | undefined;

    if (typeof data === 'string') {
        return { status, detail: asText(data) ?? fallback };
    }
    if (data && typeof data === 'object') {
        const raw = data.detail;
        if (Array.isArray(raw)) {
            const msgs = raw
                .map((item) => asText((item as { msg?: unknown })?.msg))
                .filter((m): m is string => !!m);
            return {
                status,
                code: asText(data.code),
                detail: msgs.length ? msgs.join('; ') : fallback,
            };
        }
        if (raw && typeof raw === 'object') {
            const inner = raw as Record<string, unknown>;
            return {
                status,
                code: asText(inner.code) ?? asText(data.code),
                detail: asText(inner.detail) ?? asText(inner.message) ?? fallback,
            };
        }
        return {
            status,
            code: asText(data.code),
            detail: asText(raw) ?? asText(data.message) ?? fallback,
        };
    }
    return { status, detail: fallback };
};
