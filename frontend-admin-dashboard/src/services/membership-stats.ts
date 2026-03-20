import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import type { AllStudentStatsResponse, StudentStatsFilter } from '@/types/membership-stats';

export const MEMBERSHIP_STATS_URL = `${BASE_URL}/admin-core-service/institute/institute_learner/stats/users`;

/**
 * Fetch membership stats with pagination and filtering
 */
export const fetchMembershipStats = async (
    pageNo: number = 0,
    pageSize: number = 20,
    requestBody: Omit<StudentStatsFilter, 'institute_id'>
): Promise<AllStudentStatsResponse> => {
    const instituteId = getCurrentInstituteId();

    if (!instituteId) {
        throw new Error('Institute ID not found');
    }

    const finalRequestBody: StudentStatsFilter = {
        ...requestBody,
        institute_id: instituteId,
    };

    const response = await authenticatedAxiosInstance.post<AllStudentStatsResponse>(
        MEMBERSHIP_STATS_URL,
        finalRequestBody,
        {
            params: {
                pageNo,
                pageSize,
            },
        }
    );

    return response.data;
};

/**
 * Get membership stats query configuration for React Query
 */
export const getMembershipStatsQueryKey = (
    pageNo: number,
    pageSize: number,
    filters: Omit<StudentStatsFilter, 'institute_id'>
) => ['membership-stats', pageNo, pageSize, filters];
