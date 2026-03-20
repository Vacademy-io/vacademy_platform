import { useQuery } from '@tanstack/react-query';
import {
    getOutgoingTemplates,
    challengeAnalyticsKeys,
} from '@/services/challenge-analytics';
import type { OutgoingTemplatesResponse } from '@/types/challenge-analytics';

export function useOutgoingTemplates() {
    return useQuery<OutgoingTemplatesResponse>({
        queryKey: challengeAnalyticsKeys.outgoingTemplates(),
        queryFn: getOutgoingTemplates,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}
