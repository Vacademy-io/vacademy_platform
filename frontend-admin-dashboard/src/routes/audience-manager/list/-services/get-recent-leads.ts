import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_CAMPAIGN_USERS } from '@/constants/urls';

// The backend endpoint POST /admin-core-service/v1/audience/leads accepts a
// `LeadFilterDTO`. When `audience_id` is omitted it returns leads across every
// audience for the supplied `institute_id` — which is what the cross-audience
// "Recent Leads" view wants.

export interface RecentLeadDetail {
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
        full_name?: string;
        email?: string;
        mobile_number?: string;
    };
    /** Form answers indexed by custom_field_id. */
    custom_field_values?: Record<string, string | null>;
    /** Field metadata keyed by custom_field_id (name + type). */
    custom_field_metadata?: Record<
        string,
        { fieldName?: string; field_name?: string; fieldType?: string; field_type?: string }
    >;
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

export interface RecentLeadsResponse {
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    first: boolean;
    last: boolean;
    content: RecentLeadDetail[];
}

export interface RecentLeadsRequest {
    institute_id: string;
    // When set, the backend's `findLeadsWithFilters` runs scoped to this
    // audience. When omitted, `findInstituteLeadsWithFilters` returns leads
    // across every audience for the institute. Both order by submitted_at DESC.
    audience_id?: string;
    submitted_from_local?: string; // ISO-8601 timestamp
    submitted_to_local?: string;
    // Substring match against parent_name / parent_email / parent_mobile.
    search_query?: string;
    // Lead temperature bucket — 'HOT' | 'WARM' | 'COLD'. Omitted = all tiers.
    lead_tier?: string;
    // Custom pipeline status filter — lead_status.id. Omitted = all statuses.
    lead_status_id?: string;
    // Conversion-state filter — defaults to EXCLUDE_CONVERTED on the backend so
    // leads that have been enrolled into a course don't pollute the active list.
    conversion_status_filter?: 'EXCLUDE_CONVERTED' | 'ONLY_CONVERTED' | 'ALL';
    /** Filter by SLA stage (the badge shown in the table). 'ANY_OVERDUE' = TAT_OVERDUE OR FOLLOW_UP_OVERDUE. */
    sla_filter?:
        | 'TAT_BEFORE'
        | 'TAT_OVERDUE'
        | 'FOLLOW_UP_DUE'
        | 'FOLLOW_UP_OVERDUE'
        | 'ANY_OVERDUE';
    page: number;
    size: number;
}

export const fetchRecentLeads = async (
    payload: RecentLeadsRequest
): Promise<RecentLeadsResponse> => {
    const { data } = await authenticatedAxiosInstance.post<RecentLeadsResponse>(
        GET_CAMPAIGN_USERS,
        payload
    );
    return data;
};
