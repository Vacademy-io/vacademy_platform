/**
 * Live AI Tutor — creation-time API (ai_service /tutor/v1).
 *
 * Every call carries the admin JWT and the institute `clientId`; the server
 * pins the caller to that institute and requires a staff role. Compile calls
 * stream Server-Sent Events, read here with fetch + a line reader (the same
 * transport the copilot uses), so the course page can show per-slide progress.
 */
import { AI_SERVICE_BASE_URL } from '@/constants/urls';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

const BASE = `${AI_SERVICE_BASE_URL}/tutor/v1`;

export type TutorPlanStatus =
    | 'NOT_COMPILED'
    | 'UNSUPPORTED'
    | 'NEEDS_DETAILS'
    | 'COMPILING'
    | 'READY'
    | 'FAILED'
    | 'STALE'
    | 'DELETED';

export interface TutorPlanStatusItem {
    slide_id: string;
    slide_title: string | null;
    source_type: string | null;
    chapter_id: string | null;
    chapter_name: string | null;
    plan_id: string | null;
    version: number | null;
    status: TutorPlanStatus;
    error: string | null;
    serving_plan_id: string | null;
    topics: number;
    concepts: number;
    updated_at: string | null;
}

export interface TutorPackagePlans {
    package_id: string;
    counts: Record<string, number>;
    slides: TutorPlanStatusItem[];
}

export interface TutorConceptView {
    id: string;
    order: number;
    title: string;
    concept_tags: string[];
    board_ops: Array<Record<string, unknown>>;
    board_html: string;
    say: string;
    say_i18n: Record<string, string>;
    teach_notes: string | null;
    check: Record<string, unknown> | null;
}

export interface TutorTopicView {
    id: string;
    order: number;
    title: string;
    estimated_seconds: number | null;
    summary_html: string | null;
    concepts: TutorConceptView[];
}

export interface TutorPlanView {
    plan_id: string;
    slide_id: string;
    version: number;
    status: TutorPlanStatus;
    language: string;
    model: string | null;
    objectives: string[];
    key_terms: Array<{ term: string; meaning: string }>;
    source_description: string | null;
    error: string | null;
    topics: TutorTopicView[];
    media: Array<Record<string, unknown>>;
}

export interface TutorCompileOptions {
    language?: 'en' | 'hi';
    teacher_name?: string;
    generate_images?: boolean;
    kb_grounding?: { knowledge_base_id: string; mode?: 'STRICT' | 'BLENDED' } | null;
    compile_run_id?: string;
}

export interface TutorCompileEvent {
    type:
        | 'INFO'
        | 'PLAN_STARTED'
        | 'PLAN_READY'
        | 'PLAN_STALE'
        | 'PLAN_SKIPPED'
        | 'PLAN_NEEDS_DETAILS'
        | 'PLAN_UP_TO_DATE'
        | 'PLAN_IN_PROGRESS'
        | 'PLAN_ERROR'
        | 'ERROR'
        | 'DONE';
    slide_id?: string;
    plan_id?: string;
    message?: string;
    reason?: string;
    error?: string;
    topics?: number;
    concepts?: number;
    total?: number;
    code?: number;
}

/** Per-course Tutor Mode settings (package course_setting key TUTOR_MODE_SETTING). */
export interface TutorModeSetting {
    enabled?: boolean;
    defaultOn?: boolean;
    teacherName?: string;
    ttsProvider?: 'smallest' | 'sarvam' | 'google';
    ttsModel?: string;
    ttsVoice?: string;
    languages?: string[];
    sessionLanguage?: 'course' | 'learner';
    llmModel?: string;
    compileModel?: string;
    strictness?: 'gentle' | 'normal' | 'strict';
    /** Let the compiler generate AI images (about 1 credit each plus tokens; at most 4 per slide). */
    generateImages?: boolean;
}

export const TUTOR_MODE_SETTING_KEY = 'TUTOR_MODE_SETTING';

export const getTutorPlans = async (packageId: string): Promise<TutorPackagePlans> => {
    const res = await authenticatedAxiosInstance.get<TutorPackagePlans>(
        `${BASE}/packages/${packageId}/plans`
    );
    return res.data;
};

export const getTutorSlidePlan = async (
    slideId: string,
    latest = false
): Promise<TutorPlanView> => {
    const res = await authenticatedAxiosInstance.get<TutorPlanView>(`${BASE}/slides/${slideId}/plan`, {
        params: latest ? { latest: true } : undefined,
    });
    return res.data;
};

export const putTutorSourceDescription = async (
    slideId: string,
    description: string
): Promise<{ slide_id: string; plan_id: string; status: string }> => {
    const res = await authenticatedAxiosInstance.put(`${BASE}/slides/${slideId}/source-description`, {
        description,
    });
    return res.data;
};

const authHeaders = (): Record<string, string> => {
    const token = getTokenFromCookie(TokenKey.accessToken) || '';
    const instituteId = getCurrentInstituteId() || '';
    return {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
        clientId: instituteId,
    };
};

/**
 * Read a `data:` SSE stream with fetch. Resolves when the server sends DONE or
 * closes; rejects on a non-2xx status (402 = not enough credits, 403 = not
 * staff) with the server's detail message.
 */
async function readSse(
    url: string,
    body: unknown,
    onEvent: (ev: TutorCompileEvent) => void,
    signal?: AbortSignal
): Promise<void> {
    const res = await fetch(url, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body ?? {}),
        signal,
    });
    if (!res.ok || !res.body) {
        let detail = `HTTP ${res.status}`;
        try {
            const j = await res.json();
            detail = j?.detail || j?.message || detail;
        } catch {
            /* body was not JSON */
        }
        throw new Error(detail);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, idx).trimEnd();
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith('data:')) continue;
            try {
                onEvent(JSON.parse(line.slice(5).trim()) as TutorCompileEvent);
            } catch {
                /* keepalive or partial frame */
            }
        }
    }
}

export const compileTutorPlans = (
    packageId: string,
    options: TutorCompileOptions & { slide_ids?: string[]; force?: boolean },
    onEvent: (ev: TutorCompileEvent) => void,
    signal?: AbortSignal
): Promise<void> =>
    readSse(`${BASE}/compile`, { package_id: packageId, ...options }, onEvent, signal);

export const recompileTutorSlide = (
    slideId: string,
    options: TutorCompileOptions,
    onEvent: (ev: TutorCompileEvent) => void,
    signal?: AbortSignal
): Promise<void> => readSse(`${BASE}/slides/${slideId}/recompile`, options, onEvent, signal);

export const newCompileRunId = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `run-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
