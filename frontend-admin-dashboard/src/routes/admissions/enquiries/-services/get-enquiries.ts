import { GET_ENQUIRIES } from '@/constants/urls';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

export interface EnquiryUser {
    id: string;
    username: string;
    email: string | null;
    full_name: string;
    address_line?: string | null;
    city?: string | null;
    region?: string | null;
    pin_code?: string | null;
    mobile_number?: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
    password?: string | null;
    profile_pic_file_id?: string | null;
    roles?: string[];
    last_login_time?: string | null;
    is_parent?: boolean | null;
    linked_parent_id?: string | null;
    root_user: boolean;
}

export interface EnquiryItem {
    enquiry_id: string;
    checklist?: unknown | null;
    enquiry_status: string;
    convertion_status: string;
    reference_source?: string | null;
    assigned_user_id?: boolean | null;
    assigned_visit_session_id?: boolean | null;
    fee_range_expectation?: string | null;
    transport_requirement?: string | null;
    mode: string;
    enquiry_tracking_id?: string | null;
    interest_score?: number | null;
    notes?: string | null;
    enquiry_created_at: string;
    audience_response_id: string;
    audience_id: string;
    source_type: string;
    source_id?: string;
    destination_package_session_id?: string;
    parent_name: string;
    parent_email: string;
    parent_mobile: string;
    submitted_at: string;
    parent_user: EnquiryUser;
    child_user: EnquiryUser;
    custom_fields: Record<string, string>;
    assigned_counsellor_id?: string | null;
    // Deduplication
    is_duplicate?: boolean | null;
    primary_response_id?: string | null;
    // Lead score
    lead_score?: number | null;
    lead_tier?: string | null;
    percentile_rank?: number | null;
}

export interface EnquiriesResponse {
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    first: boolean;
    last: boolean;
    content: EnquiryItem[];
}

export interface EnquiriesRequest {
    audience_id: string;
    status?: string;
    source?: string;
    destination_package_session_id?: string;
    created_from?: string;
    created_to?: string;
    search?: string;
    page: number;
    size: number;
    // Phase 1 filters
    lead_tier?: string;
    assigned_counselor_id?: string;
    exclude_duplicates?: boolean;
    min_lead_score?: number;
    max_lead_score?: number;
    overall_statuses?: string[];
    sort_by?: string;
    sort_direction?: string;
}

export const fetchEnquiries = async (payload: EnquiriesRequest): Promise<EnquiriesResponse> => {
    try {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const response = await fetch(
            `${GET_ENQUIRIES}?pageNo=${payload.page}&pageSize=${payload.size}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    audience_id: payload.audience_id,
                    status: payload.status,
                    source: payload.source,
                    destination_package_session_id: payload.destination_package_session_id,
                    created_from: payload.created_from,
                    created_to: payload.created_to,
                    search: payload.search || undefined,
                    page: payload.page,
                    size: payload.size,
                    lead_tier: payload.lead_tier || undefined,
                    assigned_counselor_id: payload.assigned_counselor_id || undefined,
                    exclude_duplicates: payload.exclude_duplicates,
                    min_lead_score: payload.min_lead_score,
                    max_lead_score: payload.max_lead_score,
                    overall_statuses: payload.overall_statuses,
                    sort_by: payload.sort_by || undefined,
                    sort_direction: payload.sort_direction || undefined,
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching enquiries:', error);
        throw error;
    }
};

export const handleFetchEnquiries = (payload: EnquiriesRequest) => {
    return {
        queryKey: ['enquiries', payload],
        queryFn: () => fetchEnquiries(payload),
        staleTime: 60 * 1000, // 1 minute
    };
};
