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
    counsellorUserId: string;
    responseId?: string | null;
    userId: string;
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
