/**
 * useLeadCounsellorOptions — counsellor list for the Leads filter bars (Recent Leads,
 * per-campaign leads, Follow-ups), scoped to the caller's team hierarchy.
 *
 * The backend `/lead-counsellor-options` endpoint returns `{ scoped, counsellors }`. When a
 * leads team is configured AND the caller is inside that subtree, `scoped` is true and
 * `counsellors` is the caller + their reports (self + reports + reports' reports) — so the
 * filter only lists counsellors whose leads the caller can actually see. Otherwise `scoped`
 * is false and we fall back to the institute-wide counsellor list (preserving admin behaviour).
 *
 * Replaces the previous `useQuery(['counsellor-options'], fetchCounselors)` blocks that each
 * surface hand-rolled — those always returned every institute counsellor regardless of team.
 */
import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { GET_LEAD_COUNSELLOR_OPTIONS } from '@/constants/urls';
import { fetchCounselors } from '@/routes/settings/leads/pools/-components/schedule/shared';

export interface CounsellorOption {
    id: string;
    full_name: string;
}

interface LeadCounsellorOptionsResponse {
    scoped: boolean;
    counsellors: Array<{ id: string; full_name: string }>;
}

async function fetchLeadCounsellorOptions(
    instituteId: string
): Promise<LeadCounsellorOptionsResponse> {
    const { data } = await authenticatedAxiosInstance.get<LeadCounsellorOptionsResponse>(
        GET_LEAD_COUNSELLOR_OPTIONS,
        { params: { instituteId } }
    );
    return {
        scoped: !!data?.scoped,
        counsellors: Array.isArray(data?.counsellors)
            ? data.counsellors.map((u) => ({ id: u.id, full_name: u.full_name }))
            : [],
    };
}

export function useLeadCounsellorOptions(): {
    options: CounsellorOption[];
    isLoading: boolean;
} {
    const instituteId = getCurrentInstituteId() ?? '';

    const scopedQuery = useQuery({
        queryKey: ['lead-counsellor-options', instituteId],
        queryFn: () => fetchLeadCounsellorOptions(instituteId),
        enabled: !!instituteId,
        staleTime: 5 * 60 * 1000,
    });

    const isScoped = scopedQuery.data?.scoped === true;
    // Only the unscoped (admin / no leads-team) path needs the institute-wide list.
    const needsFallback = scopedQuery.data?.scoped === false;

    const fallbackQuery = useQuery({
        queryKey: ['counsellor-options', instituteId],
        queryFn: fetchCounselors,
        enabled: !!instituteId && needsFallback,
        staleTime: 5 * 60 * 1000,
    });

    const options = isScoped ? (scopedQuery.data?.counsellors ?? []) : (fallbackQuery.data ?? []);
    const isLoading = scopedQuery.isLoading || (needsFallback && fallbackQuery.isLoading);

    return { options, isLoading };
}
