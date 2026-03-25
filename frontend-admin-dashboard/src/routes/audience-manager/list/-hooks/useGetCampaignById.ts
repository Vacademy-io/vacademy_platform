import { useQuery } from '@tanstack/react-query';
import { getCampaignById } from '../-services/get-campaign-by-id';

interface UseGetCampaignByIdParams {
    instituteId: string;
    audienceId: string;
    enabled?: boolean;
}

export const useGetCampaignById = ({ instituteId, audienceId, enabled = true }: UseGetCampaignByIdParams) => {
    return useQuery({
        queryKey: ['campaign', instituteId, audienceId],
        queryFn: () => getCampaignById(instituteId, audienceId),
        enabled: enabled && !!instituteId && !!audienceId,
        staleTime: 0, // Always fetch fresh data when opening edit dialog
        gcTime: 0, // Don't cache to ensure we get latest data
    });
};

