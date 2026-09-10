import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_LEAD_IDS } from '@/constants/urls';

/**
 * "Select all across pages" for the leads tables.
 *
 * Both tables used to implement this by refetching the whole filtered table through the normal
 * list endpoint with `size: totalElements`. That runs every matching row through the per-row
 * enrichment — one auth_service round-trip carrying every user id, plus four more IN-list
 * queries — to produce the three fields a selection actually keeps. It failed once a list got
 * big enough, and because the cost scales with the row count the failure looked intermittent.
 *
 * This endpoint takes the identical filter body and applies the identical RBAC scoping, but
 * returns ids only. Pass the SAME body the list query used, so the selected set cannot drift
 * from the visible one.
 */

export interface LeadIdItem {
    response_id: string;
    /** Never blank — rows with no resolvable user are dropped server-side, since no bulk
     *  action can act on them. */
    user_id: string;
    /** Display label only; blank for leads whose name lives solely on the auth user. */
    name?: string | null;
}

export interface LeadIdsResponse {
    content: LeadIdItem[];
    /** Total matching the filter — larger than `content.length` when `truncated`. */
    total: number;
    /** True when the match exceeded the server's select-all ceiling and only the first
     *  page of it came back. Tell the user rather than letting them believe a bulk action
     *  covers every matching lead. */
    truncated: boolean;
}

/**
 * @param filterBody the same LeadFilterDTO body the list query posted, minus paging
 *                   (the endpoint is not paginated — it answers "everything matching").
 */
export const fetchLeadIds = async (
    filterBody: Record<string, unknown>
): Promise<LeadIdsResponse> => {
    const { data } = await authenticatedAxiosInstance.post<LeadIdsResponse>(
        GET_LEAD_IDS,
        filterBody
    );
    return {
        content: data?.content ?? [],
        total: data?.total ?? 0,
        truncated: data?.truncated ?? false,
    };
};
