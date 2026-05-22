import { GET_CAMPAIGN_USERS } from '@/constants/urls';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

export interface CampaignLeadUser {
    response_id?: string;
    audience_id?: string;
    campaign_name?: string;
    user_id?: string;
    source_type?: string;
    source_id?: string;
    submitted_at_local?: string;
    parent_name?: string;
    parent_email?: string;
    parent_mobile?: string;
    source_audience_name?: string;
    user?: {
        id?: string;
        username?: string;
        email?: string;
        full_name?: string;
        address_line?: string;
        city?: string;
        region?: string;
        pin_code?: string;
        mobile_number?: string;
        date_of_birth?: string;
        gender?: string;
        roles?: string[];
        last_login_time?: string;
        root_user?: boolean;
    };
    custom_field_values?: Record<string, string>;
    custom_field_metadata?: Record<string, unknown>;
    // ── TAT / Follow-up SLA (deadlines + badge; visual only) ──
    tat_due_at?: string | null;
    /** First time the assigned counselor acted — drives "Responded in N" in the Reach-out-by cell. */
    first_response_at?: string | null;
    /** Follow-up deadline = last counselor action + followUpSlaHours (null until acted). */
    follow_up_due_at?: string | null;
    tat_reminder_stage?: string | null;
    tat_overdue?: boolean | null;
    tat_due_soon?: boolean | null;
    follow_up_overdue?: boolean | null;
    /** Custom pipeline status (enquiry_status), e.g. NEW / INTERESTED. */
    lead_status?: string | null;
}

export interface CampaignLeadsResponse {
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    first: boolean;
    last: boolean;
    content: CampaignLeadUser[];
}

export interface CustomFieldFilter {
    field_id: string;
    value: string;
}

export interface CampaignLeadsRequest {
    audience_id: string;
    source_type?: string;
    source_id?: string;
    // Backend `LeadFilterDTO` uses snake_case `submitted_from_local` /
    // `submitted_to_local`. The earlier non-`_local` fields were silently
    // ignored — keep the field names aligned with the DTO.
    submitted_from_local?: string;
    submitted_to_local?: string;
    // Substring match across parent_name / parent_email / parent_mobile.
    search_query?: string;
    // Lead-temperature bucket: 'HOT' | 'WARM' | 'COLD'. Omitted = all tiers.
    lead_tier?: string;
    // Custom pipeline status filter — lead_status.id. Omitted = all statuses.
    lead_status_id?: string;
    // Per-dropdown-field filters. Each entry narrows the result to responses
    // whose custom_field_values row matches ({field_id, value}). Multiple
    // entries are AND-combined on the backend.
    custom_field_filters?: CustomFieldFilter[];
    // Conversion-state filter:
    //   undefined / 'EXCLUDE_CONVERTED' → hide leads who've been assigned to a course
    //   'ONLY_CONVERTED'                → only show those leads
    //   'ALL'                           → show every lead regardless of state
    conversion_status_filter?: 'EXCLUDE_CONVERTED' | 'ONLY_CONVERTED' | 'ALL';
    page: number;
    size: number;
    sort_by?: string;
    sort_direction?: string;
}

export const fetchCampaignLeads = async (
    payload: CampaignLeadsRequest
): Promise<CampaignLeadsResponse> => {
    try {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const response = await fetch(`${GET_CAMPAIGN_USERS}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                audience_id: payload.audience_id,
                source_type: payload.source_type,
                source_id: payload.source_id,
                submitted_from_local: payload.submitted_from_local,
                submitted_to_local: payload.submitted_to_local,
                search_query: payload.search_query,
                lead_tier: payload.lead_tier,
                lead_status_id: payload.lead_status_id,
                custom_field_filters: payload.custom_field_filters,
                conversion_status_filter: payload.conversion_status_filter,
                sort_by: payload.sort_by,
                sort_direction: payload.sort_direction,
                page: payload.page,
                size: payload.size,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching campaign leads:', error);
        throw error;
    }
};

export const handleFetchCampaignUsers = (payload: CampaignLeadsRequest) => {
    return {
        queryKey: [
            'campaignUsers',
            payload.audience_id,
            payload.page,
            payload.size,
            payload.sort_by,
            payload.sort_direction,
            payload.source_type,
            payload.source_id,
            payload.submitted_from_local,
            payload.submitted_to_local,
            payload.search_query,
            payload.lead_tier,
            payload.conversion_status_filter ?? 'EXCLUDE_CONVERTED',
            // Stable cache key for an order-independent set of dropdown filters.
            payload.custom_field_filters
                ? payload.custom_field_filters
                      .map((f) => `${f.field_id}=${f.value}`)
                      .sort()
                      .join('|')
                : '',
        ],
        queryFn: () => fetchCampaignLeads(payload),
        staleTime: 60 * 1000, // 1 minute
    };
};
