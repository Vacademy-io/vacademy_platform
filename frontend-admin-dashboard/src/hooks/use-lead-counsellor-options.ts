/**
 * useLeadCounsellorOptions — counsellor list for the Leads filter bars (Recent Leads,
 * per-campaign leads, Follow-ups), scoped to the caller's role + org hierarchy.
 *
 * The backend `/lead-counsellor-options` endpoint returns `{ scoped, counsellors }`.
 * Counsellors are role-defined (COUNSELLOR) — a hierarchy-scoped caller (anyone holding
 * the COUNSELLOR role, even alongside ADMIN) gets self + their counsellor reports; a pure
 * admin gets the institute-wide COUNSELLOR-role roster. The list is authoritative either
 * way, so the old institute-wide `fetchCounselors` fallback (which also offered ADMIN-role
 * users) is gone.
 */
import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { GET_LEAD_COUNSELLOR_OPTIONS } from '@/constants/urls';

export interface CounsellorOption {
    id: string;
    full_name: string;
}

interface LeadCounsellorOptionsResponse {
    scoped: boolean;
    counsellors: Array<{ id: string; full_name: string }>;
}

async function fetchLeadCounsellorOptions(
    instituteId: string,
    assignable: boolean
): Promise<LeadCounsellorOptionsResponse> {
    const { data } = await authenticatedAxiosInstance.get<LeadCounsellorOptionsResponse>(
        GET_LEAD_COUNSELLOR_OPTIONS,
        { params: assignable ? { instituteId, assignable: true } : { instituteId } }
    );
    return {
        scoped: !!data?.scoped,
        counsellors: Array.isArray(data?.counsellors)
            ? data.counsellors.map((u) => ({ id: u.id, full_name: u.full_name }))
            : [],
    };
}

export function useLeadCounsellorOptions(opts?: {
    /** Resolve assignment TARGETS instead of the visibility list: ADMIN-role
     *  callers get the institute-wide counsellor roster even when they also
     *  hold COUNSELLOR (and are hierarchy-scoped in filters/tables). Use for
     *  assign dialogs and routing config pickers — never for data filters. */
    assignable?: boolean;
}): {
    options: CounsellorOption[];
    /** True when the caller is hierarchy-scoped (holds the COUNSELLOR role):
     *  the options are self + their counsellor reports, and the backend
     *  narrows their data the same way. False for pure admins (institute-wide
     *  roster) and for non-counsellor roles. */
    scoped: boolean;
    isLoading: boolean;
} {
    const instituteId = getCurrentInstituteId() ?? '';
    const assignable = opts?.assignable === true;

    const query = useQuery({
        queryKey: ['lead-counsellor-options', instituteId, assignable],
        queryFn: () => fetchLeadCounsellorOptions(instituteId, assignable),
        enabled: !!instituteId,
        staleTime: 5 * 60 * 1000,
    });

    return {
        options: query.data?.counsellors ?? [],
        scoped: query.data?.scoped === true,
        isLoading: query.isLoading,
    };
}
