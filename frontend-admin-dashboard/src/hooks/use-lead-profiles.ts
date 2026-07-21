/**
 * useLeadProfiles — batch-fetches UserLeadProfile records for a list of user IDs.
 *
 * Used by manage-contacts and manage-students tables to show LeadScoreBadge
 * next to user names. Skips the request when the lead system is disabled or
 * when no user IDs are provided.
 *
 * Returns a Map<userId, score> so callers can look up scores by user ID in O(1).
 */

import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_USER_LEAD_PROFILES_BATCH } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

export interface LeadProfileSummary {
    user_id: string;
    best_score: number;
    lead_tier: string | null;
    conversion_status: string;
    assigned_counselor_id?: string | null;
    assigned_counselor_name?: string | null;
}

export async function fetchBatchProfiles(
    userIds: string[],
    instituteId: string
): Promise<Record<string, LeadProfileSummary>> {
    if (!userIds.length) return {};
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: GET_USER_LEAD_PROFILES_BATCH,
        params: { instituteId },
        data: userIds,
    });
    return response.data ?? {};
}

/**
 * @param userIds     Array of user IDs visible in the current table page.
 * @param enabled     Set to false to skip the request entirely (lead system off).
 * @param instituteId Institute to scope the fetch to. A user_id can now have a lead
 *                     profile per institute, so this is required by the backend —
 *                     defaults to the caller's current institute when omitted.
 */
export function useLeadProfiles(userIds: string[], enabled = true, instituteId?: string) {
    const resolvedInstituteId = instituteId ?? getCurrentInstituteId();
    const stableKey = userIds.slice().sort().join(',');

    const { data, isLoading } = useQuery({
        queryKey: ['lead-profiles-batch', resolvedInstituteId, stableKey],
        queryFn: () => fetchBatchProfiles(userIds, resolvedInstituteId as string),
        enabled: enabled && userIds.length > 0 && !!resolvedInstituteId,
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
    });

    return {
        /** Map from userId → LeadProfileSummary */
        profiles: data ?? {},
        isLoading,
    };
}
