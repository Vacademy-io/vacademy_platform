import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { TFunction } from 'i18next';
import {
    AudienceCampaignPayload,
    updateAudienceCampaign,
} from '../-services/create-audience-campaign';

interface UpdateAudienceCampaignParams {
    audienceId: string;
    payload: AudienceCampaignPayload;
}

export function useUpdateAudienceCampaign(t: TFunction) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ audienceId, payload }: UpdateAudienceCampaignParams) =>
            updateAudienceCampaign(audienceId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaignsList'] });
            toast.success(t('success.updateCampaign'));
        },
        onError: (error: any) => {
            const message =
                error?.response?.data?.message || error?.message || t('errors.updateCampaign');
            toast.error(message);
            console.error('useUpdateAudienceCampaign error', error);
        },
    });
}

