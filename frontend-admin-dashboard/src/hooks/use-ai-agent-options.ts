/**
 * useAiAgentOptions — the institute's Vacademy AI agents (ai_agent registry,
 * Settings > AI Calling > AI Agents) for pickers outside that screen, e.g. the
 * IVR builder's "Talk to AI agent" step. Unlike useAiCampaignOptions (which
 * reads the provider-agnostic campaigns envelope), this returns registry rows
 * by id — the IVR node stores the agent's id directly.
 */
import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

export interface AiAgentOption {
    id: string;
    name: string;
    direction?: 'OUTBOUND' | 'INBOUND';
    enabled?: boolean;
}

const AI_AGENTS_URL = `${BASE_URL}/admin-core-service/v1/telephony/ai-agents`;

async function fetchAgents(instituteId: string): Promise<AiAgentOption[]> {
    const { data } = await authenticatedAxiosInstance.get<AiAgentOption[]>(AI_AGENTS_URL, {
        params: { instituteId },
    });
    return Array.isArray(data) ? data : [];
}

export function useAiAgentOptions(): { agents: AiAgentOption[]; isLoading: boolean } {
    const instituteId = getCurrentInstituteId() ?? '';
    const { data, isLoading } = useQuery({
        queryKey: ['ai-agents', instituteId],
        queryFn: () => fetchAgents(instituteId),
        enabled: !!instituteId,
        staleTime: 60_000,
    });
    return { agents: (data ?? []).filter((a) => a.enabled !== false), isLoading };
}
