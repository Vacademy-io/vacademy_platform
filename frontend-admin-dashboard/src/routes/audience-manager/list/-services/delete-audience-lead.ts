import { DELETE_AUDIENCE_LEAD } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

export const deleteAudienceLead = async (responseId: string): Promise<string> => {
    if (!responseId) {
        throw new Error('Response ID is required to delete a lead.');
    }

    const response = await authenticatedAxiosInstance({
        method: 'DELETE',
        url: DELETE_AUDIENCE_LEAD(responseId),
    });

    return response?.data;
};
