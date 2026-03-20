import { AUDIENCE_CAMPAIGN } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

export const deleteAudienceCampaign = async (instituteId: string, audienceId: string) => {
    if (!instituteId || !audienceId) {
        throw new Error('Institute ID and audience ID are required to delete a campaign.');
    }

    const response = await authenticatedAxiosInstance({
        method: 'DELETE',
        url: `${AUDIENCE_CAMPAIGN}/${instituteId}/${audienceId}`,
    });

    return response?.data;
};


