import { useQuery } from '@tanstack/react-query';
import { handleFetchCampaignsList, CampaignListRequest } from '../-services/get-campaigns-list';

export const useCampaignsList = (payload: CampaignListRequest) => {
    return useQuery({
        ...handleFetchCampaignsList(payload),
        enabled: !!payload.institute_id, // Only fetch if institute_id is available
    });
};

