import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { GET_LEARNER_PORTAL_ACCESS } from '@/constants/urls';

export interface LearnerPortalAccessResponse {
    redirect_url: string;
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
