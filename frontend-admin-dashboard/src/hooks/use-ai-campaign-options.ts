/**
 * useAiCampaignOptions — the institute's registered AI campaigns/agents (from the
 * AI_CALLING_SETTING envelope) for pickers outside the settings screen, e.g. the
 * workflow builder's CALL_AI node. Workflow nodes reference the provider-agnostic
 * agent NAME; the backend resolves it to the active provider's campaign id at
 * dial time (AiCallingSettingsPojo.resolveCampaignId).
 */
import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

export interface AiCampaignOption {
    campaignId: string;
    name: string;
    direction: 'OUTBOUND' | 'INBOUND';
    provider?: string;
}

interface AiCallingSettingSlice {
    provider?: string;
    campaigns?: AiCampaignOption[];
}

const GET_URL = `${BASE_URL}/admin-core-service/institute/setting/v1/get`;

async function fetchCampaigns(instituteId: string): Promise<AiCallingSettingSlice> {
    const response = await authenticatedAxiosInstance.get(GET_URL, {
        params: { instituteId, settingKey: 'AI_CALLING_SETTING' },
    });
    const data = response.data?.data ?? {};
    return {
        provider: typeof data.provider === 'string' ? data.provider : undefined,
        campaigns: Array.isArray(data.campaigns) ? data.campaigns : [],
    };
}

export function useAiCampaignOptions(): {
    campaigns: AiCampaignOption[];
    defaultProvider?: string;
    isLoading: boolean;
} {
    const instituteId = getCurrentInstituteId() ?? '';
    const query = useQuery({
        queryKey: ['ai-calling-campaign-options', instituteId],
        queryFn: () => fetchCampaigns(instituteId),
        enabled: !!instituteId,
        staleTime: 60 * 1000,
    });
    return {
        campaigns: query.data?.campaigns ?? [],
        defaultProvider: query.data?.provider,
        isLoading: query.isLoading,
    };
}
