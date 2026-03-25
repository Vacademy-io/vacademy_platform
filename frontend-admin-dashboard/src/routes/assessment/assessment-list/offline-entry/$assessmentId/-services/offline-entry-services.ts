import {
    GET_ADMIN_PARTICIPANTS,
    GET_BATCH_DETAILS_URL,
    OFFLINE_CREATE_ATTEMPT,
    OFFLINE_SUBMIT_RESPONSES,
    SUBMIT_MARKS,
} from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    DirectMarksSubmitRequest,
    OfflineAttemptCreateResponse,
    OfflineResponseSubmitRequest,
} from '../-utils/types';

// ---- Batch learners (admin-core-service) ----

export interface BatchLearnerItem {
    user_id: string;
    full_name: string;
    username: string;
    phone_number: string;
    email: string;
    gender: string;
    package_session_id: string;
    face_file_id: string | null;
}

export interface BatchLearnersResponse {
    content: BatchLearnerItem[];
    page_no: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    last: boolean;
}

export const fetchBatchLearners = async (
    instituteId: string,
    packageSessionIds: string[],
    pageNo: number,
    pageSize: number
): Promise<BatchLearnersResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_BATCH_DETAILS_URL,
        params: { pageNo, pageSize },
        data: {
            name: '',
            statuses: [],
            institute_ids: [instituteId],
            package_session_ids: packageSessionIds,
            group_ids: [],
            gender: [],
            sort_columns: {},
        },
    });
    return response?.data;
};

// ---- Individual participants (assessment-service) ----

export interface IndividualParticipantItem {
    registration_id: string;
    attempt_id: string | null;
    student_name: string;
    user_id: string;
    batch_id: string;
    score: number | null;
    evaluation_status: string | null;
}

export interface ParticipantsResponse {
    content: IndividualParticipantItem[];
    page_no: number;
    page_size: number;
    total_elements: number;
    total_pages: number;
    last: boolean;
}

export const fetchIndividualParticipants = async (
    assessmentId: string,
    instituteId: string,
    assessmentType: string
): Promise<ParticipantsResponse> => {
    const [attemptedData, pendingData] = await Promise.all([
        authenticatedAxiosInstance({
            method: 'POST',
            url: GET_ADMIN_PARTICIPANTS,
            params: { instituteId, assessmentId, pageNo: 0, pageSize: 1000 },
            data: {
                name: '',
                assessment_type: assessmentType,
                attempt_type: ['ENDED'],
                registration_source: 'ADMIN_PRE_REGISTRATION',
                batches: [],
                status: ['ACTIVE'],
                sort_columns: {},
            },
        }),
        authenticatedAxiosInstance({
            method: 'POST',
            url: GET_ADMIN_PARTICIPANTS,
            params: { instituteId, assessmentId, pageNo: 0, pageSize: 1000 },
            data: {
                name: '',
                assessment_type: assessmentType,
                attempt_type: ['PENDING'],
                registration_source: 'ADMIN_PRE_REGISTRATION',
                batches: [],
                status: ['ACTIVE'],
                sort_columns: {},
            },
        }),
    ]);

    const attempted: ParticipantsResponse = attemptedData?.data;
    const pending: ParticipantsResponse = pendingData?.data;

    const allContent = [...(attempted?.content ?? []), ...(pending?.content ?? [])];
    const seen = new Set<string>();
    const deduplicated = allContent.filter((item) => {
        if (seen.has(item.registration_id)) return false;
        seen.add(item.registration_id);
        return true;
    });

    return {
        content: deduplicated,
        page_no: 0,
        page_size: deduplicated.length,
        total_elements: deduplicated.length,
        total_pages: 1,
        last: true,
    };
};

// ---- Offline attempt actions ----

export interface CreateAttemptParams {
    assessmentId: string;
    instituteId: string;
    registrationId?: string; // for individual participants
    // for batch learners (no registration yet):
    userId?: string;
    fullName?: string;
    email?: string;
    username?: string;
    mobileNumber?: string;
    batchId?: string;
}

export const createOfflineAttempt = async (
    params: CreateAttemptParams
): Promise<OfflineAttemptCreateResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: OFFLINE_CREATE_ATTEMPT,
        params: {
            assessmentId: params.assessmentId,
            instituteId: params.instituteId,
            ...(params.registrationId ? { registrationId: params.registrationId } : {}),
        },
        data: params.registrationId
            ? {}
            : {
                  user_id: params.userId,
                  full_name: params.fullName,
                  email: params.email,
                  username: params.username,
                  mobile_number: params.mobileNumber,
                  batch_id: params.batchId,
              },
    });
    return response?.data;
};

export const submitOfflineResponses = async (
    assessmentId: string,
    attemptId: string,
    instituteId: string,
    data: OfflineResponseSubmitRequest
): Promise<string> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: OFFLINE_SUBMIT_RESPONSES,
        params: { assessmentId, attemptId, instituteId },
        data,
    });
    return response?.data;
};

export const submitDirectMarks = async (
    assessmentId: string,
    attemptId: string,
    instituteId: string,
    data: DirectMarksSubmitRequest
): Promise<string> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: SUBMIT_MARKS,
        params: { assessmentId, attemptId, instituteId },
        data,
    });
    return response?.data;
};
