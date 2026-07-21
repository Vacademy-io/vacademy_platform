/**
 * Course-translation API layer (Phase 1 i18n).
 *
 * Two backends serve this feature and the split matters:
 *  - ai_service  /translation/v1/*  — credit estimate + the async job stage
 *    machine (EXTRACT -> TRANSLATE -> REVIEW -> WRITE_BACK).
 *  - admin_core  /translations/v1/* — the sidecar rows the job writes, which is
 *    what the review screen reads and approves/rejects.
 *
 * All payloads are snake_case (backend contract). Nothing here mutates the
 * canonical English content — translations live in sidecar tables and English
 * delivery is unchanged.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    TRANSLATE_COURSE_URL,
    TRANSLATION_ESTIMATE_URL,
    TRANSLATION_ITEMS_URL,
    TRANSLATION_ITEM_STATE_URL,
    TRANSLATION_JOB_APPROVE_URL,
    TRANSLATION_JOB_URL,
    TRANSLATION_STATUS_URL,
} from '@/constants/urls';

// ---- Types (mirror the backend contracts) ----

/** DRAFT parks the job at REVIEW for a human gate; AUTO_PUBLISH writes straight through. */
export type TranslationMode = 'DRAFT' | 'AUTO_PUBLISH';

/** Sidecar row lifecycle. PUBLISHED + STALE are the learner-visible states. */
export type TranslationItemState = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'STALE';

export type TranslationJobStatus =
    | 'PENDING'
    | 'IN_PROGRESS'
    | 'AWAITING_INPUT'
    | 'COMPLETED'
    | 'FAILED';

export type TranslationJobStage =
    | 'PENDING'
    | 'EXTRACT'
    | 'TRANSLATE'
    | 'REVIEW'
    | 'WRITE_BACK'
    | 'COMPLETED';

export interface TranslationEstimateBreakdownRow {
    component: string;
    detail: string;
    credits: number;
}

export interface TranslationEstimate {
    scope: string;
    estimated_credits: number;
    breakdown: TranslationEstimateBreakdownRow[];
    chars_considered: number;
    items_found: number;
    /** null when the institute has no credit balance row yet. */
    current_balance: number | null;
    balance_after: number | null;
    sufficient: boolean | null;
}

export interface TranslationJobCreated {
    job_id: string;
    status: TranslationJobStatus;
    current_stage: TranslationJobStage;
    estimated_credits?: number;
}

export interface TranslationJob {
    job_id: string;
    institute_id: string;
    package_session_id: string;
    source_locale: string;
    target_locale: string;
    scope: string;
    mode: TranslationMode;
    status: TranslationJobStatus;
    current_stage: TranslationJobStage;
    items_total: number | null;
    items_done: number | null;
    failed_items: unknown[];
    write_back?: unknown;
    error_message: string | null;
    created_by: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface TranslationStatus {
    package_session_id: string;
    locale: string;
    counts_by_state: Record<string, number>;
    coverage_published_count: number;
}

/** RICH_TEXT rows carry rich_text_id; ENTITY_FIELD rows carry entity_type/entity_id/field. */
export type TranslationItemTable = 'RICH_TEXT' | 'ENTITY_FIELD';

export interface TranslationReviewItem {
    table: TranslationItemTable;
    id: string;
    state: TranslationItemState;
    translated_content?: string;
    /** Canonical source content; absent when not cheaply resolvable server-side. */
    base_content?: string;
    entity_ref?: Record<string, string>;
    translated_by?: string;
    updated_at?: string;
}

export interface TranslationItemsPage {
    package_session_id: string;
    locale: string;
    state?: string;
    page: number;
    size: number;
    total_elements: number;
    total_pages: number;
    items: TranslationReviewItem[];
}

// ---- Query keys ----

export const translationKeys = {
    status: (packageSessionId: string, locale: string) =>
        ['translation', 'status', packageSessionId, locale] as const,
    items: (packageSessionId: string, locale: string, state: string, page: number, size: number) =>
        ['translation', 'items', packageSessionId, locale, state, page, size] as const,
    job: (jobId: string) => ['translation', 'job', jobId] as const,
};

// ---- ai_service: estimate + job ----

export async function fetchTranslationEstimate(params: {
    packageSessionId: string;
    targetLocale: string;
}): Promise<TranslationEstimate> {
    const response = await authenticatedAxiosInstance.post<TranslationEstimate>(
        TRANSLATION_ESTIMATE_URL,
        {
            scope: 'FULL',
            package_session_id: params.packageSessionId,
            target_locale: params.targetLocale,
        }
    );
    return response.data;
}

export async function startCourseTranslation(params: {
    packageSessionId: string;
    targetLocale: string;
    sourceLocale: string;
    mode: TranslationMode;
}): Promise<TranslationJobCreated> {
    const response = await authenticatedAxiosInstance.post<TranslationJobCreated>(
        TRANSLATE_COURSE_URL(params.packageSessionId),
        {
            target_locale: params.targetLocale,
            source_locale: params.sourceLocale,
            scope: 'FULL',
            mode: params.mode,
        }
    );
    return response.data;
}

/**
 * Job polling. Stops polling once the job reaches a terminal state or parks at
 * AWAITING_INPUT (the human review gate) — nothing moves until the user acts.
 */
export function useTranslationJobQuery(jobId: string | undefined) {
    return useQuery({
        queryKey: translationKeys.job(jobId ?? ''),
        queryFn: async (): Promise<TranslationJob> => {
            const response = await authenticatedAxiosInstance.get<TranslationJob>(
                TRANSLATION_JOB_URL(jobId ?? '')
            );
            return response.data;
        },
        enabled: Boolean(jobId),
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            if (!status) return 5000;
            const settled =
                status === 'COMPLETED' || status === 'FAILED' || status === 'AWAITING_INPUT';
            return settled ? false : 5000;
        },
    });
}

export function useApproveTranslationJobMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (jobId: string) => {
            const response = await authenticatedAxiosInstance.post(
                TRANSLATION_JOB_APPROVE_URL(jobId),
                {}
            );
            return response.data;
        },
        onSuccess: (_data, jobId) => {
            queryClient.invalidateQueries({ queryKey: translationKeys.job(jobId) });
        },
    });
}

// ---- admin_core: status + review items ----

export function useTranslationStatusQuery(
    packageSessionId: string | undefined,
    locale: string | undefined
) {
    return useQuery({
        queryKey: translationKeys.status(packageSessionId ?? '', locale ?? ''),
        queryFn: async (): Promise<TranslationStatus> => {
            const response = await authenticatedAxiosInstance.get<TranslationStatus>(
                TRANSLATION_STATUS_URL,
                { params: { packageSessionId, locale } }
            );
            return response.data;
        },
        enabled: Boolean(packageSessionId && locale),
    });
}

export function useTranslationItemsQuery(params: {
    packageSessionId: string | undefined;
    locale: string | undefined;
    /** '' means "all states" — the param is omitted from the request. */
    state: string;
    page: number;
    size: number;
}) {
    const { packageSessionId, locale, state, page, size } = params;
    return useQuery({
        queryKey: translationKeys.items(packageSessionId ?? '', locale ?? '', state, page, size),
        queryFn: async (): Promise<TranslationItemsPage> => {
            const response = await authenticatedAxiosInstance.get<TranslationItemsPage>(
                TRANSLATION_ITEMS_URL,
                {
                    params: {
                        packageSessionId,
                        locale,
                        page,
                        size,
                        ...(state ? { state } : {}),
                    },
                }
            );
            return response.data;
        },
        enabled: Boolean(packageSessionId && locale),
    });
}

export interface TranslationItemStateUpdate {
    table: TranslationItemTable;
    id: string;
    state: TranslationItemState;
    packageSessionId: string;
}

export function useUpdateTranslationItemStateMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (update: TranslationItemStateUpdate) => {
            const response = await authenticatedAxiosInstance.put(TRANSLATION_ITEM_STATE_URL, {
                table: update.table,
                id: update.id,
                state: update.state,
                package_session_id: update.packageSessionId,
            });
            return response.data;
        },
        onSuccess: () => {
            // Both the page and the state counts shift on every approve/reject.
            queryClient.invalidateQueries({ queryKey: ['translation', 'items'] });
            queryClient.invalidateQueries({ queryKey: ['translation', 'status'] });
        },
    });
}
