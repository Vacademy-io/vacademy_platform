import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { TELEPHONY_CALLS_BY_USER, TELEPHONY_CALL_RECORDING } from '@/constants/urls';

export interface CallLogItem {
    id: string;
    providerType: string;
    direction: 'OUTBOUND' | 'INBOUND';
    status: string;
    terminationReason?: string | null;
    fromNumberMasked?: string | null;
    toNumberMasked?: string | null;
    callerId?: string | null;
    startTime?: string | null;
    answerTime?: string | null;
    endTime?: string | null;
    durationSeconds?: number | null;
    price?: number | null;
    hasRecording: boolean;
    // Nullable on INBOUND rows that fell through to voicemail with no agent
    // matched. Outbound rows always carry the actor user id.
    counsellorUserId: string | null;
    responseId?: string | null;
    userId: string;
    // AI-call disposition (e.g. "Interested", "No_Response", "Callback") for
    // calls placed by the AI voice agent; null/absent for human-dialed calls.
    aiDisposition?: string | null;
    // Row creation time — fallback call time for AI calls, which don't set startTime.
    createdAt?: string | null;
    // AI-call attempt number (0 = first dial, 1+ = retries); null for human-dialed calls.
    aiCallRetry?: number | null;
}

export interface PagedCallLog {
    content: CallLogItem[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    first: boolean;
    last: boolean;
}

/**
 * GET /v1/telephony/calls — paged call history for one lead.
 * instituteId is required; the backend rejects cross-institute lookups.
 */
export const fetchCallHistory = async (
    userId: string,
    instituteId: string,
    page = 0,
    size = 20
): Promise<PagedCallLog> => {
    const { data } = await authenticatedAxiosInstance.get<PagedCallLog>(
        TELEPHONY_CALLS_BY_USER(userId, instituteId, page, size)
    );
    return data;
};

/** Resolve the presigned mp3 URL for a given call. */
export const fetchCallRecordingUrl = async (
    callLogId: string,
    instituteId: string
): Promise<string | null> => {
    const { data } = await authenticatedAxiosInstance.get<{ url?: string }>(
        TELEPHONY_CALL_RECORDING(callLogId, instituteId)
    );
    return data?.url || null;
};
