import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { GET_LEARNER_PORTAL_ACCESS, SEND_LEARNER_RESET_PASSWORD } from '@/constants/urls';

export interface LearnerPortalAccessResponse {
    redirect_url: string;
}

export interface SendResetPasswordResponse {
    success: boolean;
    message?: string;
}

/**
 * Get learner portal access URL for a specific user
 * @param userId - The user ID of the student
 * @param packageId - The package ID of the student's course
 * @returns Promise with redirect URL
 */
export const getLearnerPortalAccess = async (
    userId: string,
    packageId: string
): Promise<LearnerPortalAccessResponse> => {
    const instituteId = getCurrentInstituteId();

    if (!instituteId) {
        throw new Error('Institute ID not found. Please log in again.');
    }

    const response = await authenticatedAxiosInstance.get<LearnerPortalAccessResponse>(
        GET_LEARNER_PORTAL_ACCESS,
        {
            params: {
                instituteId,
                userId,
                packageId,
            },
            headers: {
                accept: '*/*',
            },
        }
    );

    return response.data;
};

/**
 * Send reset password email to a specific user
 * @param userId - The user ID of the student
 * @param packageId - The package ID of the student's course
 * @returns Promise with success response
 */
export const sendResetPasswordEmail = async (
    userId: string,
    packageId: string
): Promise<SendResetPasswordResponse> => {
    const instituteId = getCurrentInstituteId();

    if (!instituteId) {
        throw new Error('Institute ID not found. Please log in again.');
    }

    const response = await authenticatedAxiosInstance.get<SendResetPasswordResponse>(
        SEND_LEARNER_RESET_PASSWORD,
        {
            params: {
                instituteId,
                userId,
                packageId,
            },
            headers: {
                accept: '*/*',
            },
        }
    );

    return response.data;
};
