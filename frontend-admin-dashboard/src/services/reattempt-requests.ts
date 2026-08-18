import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    REATTEMPT_REQUEST_LIST_URL,
    REATTEMPT_REQUEST_PENDING_COUNT_URL,
    REATTEMPT_REQUEST_REVIEW_URL,
} from '@/constants/urls';

export type ReattemptRequestType = 'REATTEMPT' | 'TIME_INCREASE';
export type ReattemptRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ReattemptRequest {
    id: string;
    assessment_id: string;
    assessment_name?: string | null;
    user_id: string;
    registration_id?: string | null;
    request_type: ReattemptRequestType;
    reason?: string | null;
    status: ReattemptRequestStatus;
    granted_count?: number | null;
    review_note?: string | null;
    reviewed_at?: string | null;
    created_at?: string | null;
    participant_name?: string | null;
    user_email?: string | null;
    phone_number?: string | null;
    attempts_allowed?: number | null;
    attempts_used?: number | null;
}

interface PageResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;
}

/** `assessmentId` omitted gives the institute-wide inbox. */
export const getReattemptRequests = async (params: {
    instituteId: string;
    assessmentId?: string;
    status?: ReattemptRequestStatus[];
    page?: number;
    size?: number;
}): Promise<PageResponse<ReattemptRequest>> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: REATTEMPT_REQUEST_LIST_URL,
        params: {
            instituteId: params.instituteId,
            assessmentId: params.assessmentId,
            status: params.status,
            page: params.page ?? 0,
            size: params.size ?? 25,
        },
    });
    return response?.data;
};

export const getPendingReattemptRequestCount = async (instituteId: string): Promise<number> => {
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: REATTEMPT_REQUEST_PENDING_COUNT_URL,
        params: { instituteId },
    });
    return response?.data ?? 0;
};

/**
 * Approving a REATTEMPT request grants the attempts through the same path the participants
 * screen uses, so the learner's allowance and the ASSESSMENT_REATTEMPT_GRANTED event behave
 * identically however the grant was made.
 */
export const reviewReattemptRequest = async (params: {
    requestId: string;
    instituteId: string;
    status: 'APPROVED' | 'REJECTED';
    grantedCount?: number;
    reviewNote?: string;
}): Promise<ReattemptRequest> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: `${REATTEMPT_REQUEST_REVIEW_URL}/${params.requestId}/review`,
        params: { instituteId: params.instituteId },
        data: {
            status: params.status,
            granted_count: params.grantedCount,
            review_note: params.reviewNote,
        },
    });
    return response?.data;
};
