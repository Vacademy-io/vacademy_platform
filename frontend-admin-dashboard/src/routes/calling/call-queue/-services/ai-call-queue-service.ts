/**
 * AI call queue data layer — this institute's own queue only.
 *
 * Backed by the institute-scoped queue endpoints (admin-core-service):
 *   GET    /v1/telephony/ai-queue/summary?instituteId=   — depth, in-flight, ETA
 *   GET    /v1/telephony/ai-queue?instituteId=&status=   — paged rows (Spring Page envelope)
 *   POST   /v1/telephony/ai-queue/cancel?instituteId=    — cancel everything still waiting
 *   DELETE /v1/telephony/ai-queue/{id}?instituteId=      — cancel one waiting call
 *
 * Every endpoint is validated server-side against the caller's institute, so this
 * page can only ever read or cancel its own calls — the fleet-wide view and the
 * capacity controls live behind separate super-admin routes and are deliberately
 * not reachable from here.
 *
 * Payloads are camelCase (these controllers use the default naming strategy, unlike
 * the snake_case call-search endpoints next door in call-log-service.ts).
 */
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

const QUEUE_BASE = `${BASE_URL}/admin-core-service/v1/telephony/ai-queue`;

/** Lifecycle of one queued call. Mirrors the backend AiCallQueueStatus enum. */
export type QueueStatus = 'QUEUED' | 'DISPATCHING' | 'DIALED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

/**
 * Filter values the list accepts: any real status, plus LIVE.
 *
 * LIVE is not a queue status. A queue row reads DIALED from the instant the provider
 * accepts the call and never moves again, so "on a line right now" can only be answered
 * by joining the call log — which the backend does for this filter. Without it, "Dialled"
 * mixes a call that is talking now with one that ended this morning.
 */
export type QueueFilter = QueueStatus | 'LIVE' | '';

export interface QueueItem {
    id: string;
    instituteId: string;
    instituteName?: string | null;
    /** The AI agent as a person names it, resolved from the campaign id. */
    agentName?: string | null;
    provider?: string | null;
    source?: string | null;
    /** MANUAL | AUTOMATION | BULK_MANUAL | WORKFLOW_EXPLICIT */
    callTrigger?: string | null;
    priority?: number;
    sourceRef?: string | null;
    status: QueueStatus;
    /** Why it ended where it did — the only explanation an admin gets for a skip. */
    statusReason?: string | null;
    responseId?: string | null;
    userId?: string | null;
    phoneNumber?: string | null;
    campaignId?: string | null;
    campaignName?: string | null;
    attempts?: number;
    notBefore?: string | null;
    expiresAt?: string | null;
    callLogId?: string | null;
    dispatchedAt?: string | null;
    createdAt?: string | null;
    /** Calls ahead of this one in THIS institute's lane. Only set while QUEUED. */
    aheadInLane?: number | null;
    etaMinutes?: number | null;
    /** Live state of the actual call, for rows that have already dialled. */
    callStatus?: string | null;
    callDurationSeconds?: number | null;
    /** True while the call is still up. The queue row alone cannot tell you this. */
    live?: boolean;
}

/**
 * Depth and wait for this institute.
 *
 * Carries no capacity numbers by design — the size of the shared calling pool is an
 * internal operating fact, so the API does not return it here and the UI has nothing
 * to accidentally render.
 */
export interface QueueSummary {
    instituteId: string;
    queued: number;
    /** This institute's own calls currently on a line. Not a share of anything. */
    inFlight: number;
    paused: boolean;
    etaMinutes: number;
    byStatus?: Record<string, number>;
}

/** Spring Page envelope, trimmed to what the table needs. */
export interface QueuePage {
    content: QueueItem[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
}

export async function fetchQueueSummary(instituteId: string): Promise<QueueSummary> {
    const { data } = await authenticatedAxiosInstance.get(`${QUEUE_BASE}/summary`, {
        params: { instituteId },
    });
    return data;
}

export async function fetchQueueItems(args: {
    instituteId: string;
    status?: QueueFilter;
    page?: number;
    size?: number;
}): Promise<QueuePage> {
    const { data } = await authenticatedAxiosInstance.get(QUEUE_BASE, {
        params: {
            instituteId: args.instituteId,
            // Omitted rather than sent blank: the backend treats an absent status as
            // "no filter", and an empty string would be compared against the column.
            ...(args.status ? { status: args.status } : {}),
            page: args.page ?? 0,
            size: args.size ?? 25,
        },
    });
    return data;
}

/** Cancel every call this institute still has waiting. Only QUEUED rows are affected. */
export async function cancelAllQueued(
    instituteId: string,
    reason?: string
): Promise<{ cancelled: number }> {
    const { data } = await authenticatedAxiosInstance.post(
        `${QUEUE_BASE}/cancel`,
        { reason },
        { params: { instituteId } }
    );
    return data;
}

/** Cancel one waiting call. A call already dialling cannot be taken back. */
export async function cancelQueuedItem(
    instituteId: string,
    id: string,
    reason?: string
): Promise<{ cancelled: boolean }> {
    const { data } = await authenticatedAxiosInstance.delete(`${QUEUE_BASE}/${id}`, {
        params: { instituteId, ...(reason ? { reason } : {}) },
    });
    return data;
}
