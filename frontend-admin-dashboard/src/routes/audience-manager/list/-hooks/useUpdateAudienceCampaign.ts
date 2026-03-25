import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    AudienceCampaignPayload,
    updateAudienceCampaign,
} from '../-services/create-audience-campaign';

interface UpdateAudienceCampaignParams {
    audienceId: string;
    payload: AudienceCampaignPayload;
}

export function useUpdateAudienceCampaign() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ audienceId, payload }: UpdateAudienceCampaignParams) =>
            updateAudienceCampaign(audienceId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaignsList'] });
            toast.success('Update successfully');
        },
        onError: (error: any) => {
            const message =
                error?.response?.data?.message || error?.message || 'Failed to update campaign';
            toast.error(message);
            console.error('useUpdateAudienceCampaign error', error);
        },
    });
}

