import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { CampaignItem } from './get-campaigns-list';

/**
 * Fetches a single campaign by instituteId and audienceId
 * Uses the GET endpoint: /admin-core-service/open/v1/audience/campaign/{instituteId}/{audienceId}
 */
export const getCampaignById = async (
    instituteId: string,
    audienceId: string
): Promise<CampaignItem> => {
    if (!instituteId || !audienceId) {
        throw new Error('Institute ID and Audience ID are required');
    }

    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: `${BASE_URL}/admin-core-service/open/v1/audience/campaign/${instituteId}/${audienceId}`,
    });

    return response?.data;
};

