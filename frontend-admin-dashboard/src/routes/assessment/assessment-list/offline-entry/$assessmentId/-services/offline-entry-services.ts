import {
    GET_ADMIN_PARTICIPANTS,
    GET_BATCH_DETAILS_URL,
    OFFLINE_ATTACH_FILES,
    OFFLINE_BULK_IMPORT,
    OFFLINE_CREATE_ATTEMPT,
    OFFLINE_CREATE_AND_SUBMIT,
    OFFLINE_SUBMIT_RESPONSES,
    SUBMIT_MARKS,
} from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    DirectMarksSubmitRequest,
    OfflineAttachmentsRequest,
    OfflineAttemptCreateResponse,
    OfflineBulkImportRequest,
    OfflineBulkImportResponse,
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

/**
 * Combined: create attempt + submit responses + evaluate in a single HTTP call.
 * Eliminates 2 extra round-trips compared to calling create-attempt and submit-responses separately.
 */
export const createAndSubmitOffline = async (
    params: CreateAttemptParams,
    data: OfflineResponseSubmitRequest
): Promise<OfflineAttemptCreateResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: OFFLINE_CREATE_AND_SUBMIT,
        params: {
            assessmentId: params.assessmentId,
            instituteId: params.instituteId,
            ...(params.registrationId ? { registrationId: params.registrationId } : {}),
        },
        data: {
            ...data,
            // Include user details for batch students
            ...(params.registrationId
                ? {}
                : {
                      user_id: params.userId,
                      full_name: params.fullName,
                      email: params.email,
                      username: params.username,
                      mobile_number: params.mobileNumber,
                      batch_id: params.batchId,
                  }),
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

/**
 * Attaches the scanned answer sheet / checked copy / report PDFs to an attempt.
 *
 * Note this does NOT reuse manual-evaluation's submit/marks (which also carries a
 * `file_id`): that endpoint recomputes total_marks from the questions in its
 * payload, so calling it just to carry a file id would wipe the marks the offline
 * entry has already calculated.
 */
export const attachOfflineFiles = async (
    assessmentId: string,
    attemptId: string,
    instituteId: string,
    data: OfflineAttachmentsRequest
): Promise<string> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: OFFLINE_ATTACH_FILES,
        params: { assessmentId, attemptId, instituteId },
        data,
    });
    return response?.data;
};

/**
 * One bulk pass: total marks + already-uploaded sheet file ids for many students.
 * The PDFs are uploaded to storage client-side first, so this stays a single JSON
 * request no matter how many sheets the batch contains.
 */
export const bulkImportOfflineEntries = async (
    assessmentId: string,
    instituteId: string,
    data: OfflineBulkImportRequest
): Promise<OfflineBulkImportResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: OFFLINE_BULK_IMPORT,
        params: { assessmentId, instituteId },
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
