import { GET_CAMPAIGN_USERS } from '@/constants/urls';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

export interface UserDto {
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

export interface EnquiryLeadUser {
    enquiry_id: string;
    checklist?: any | null;
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
    parent_user: UserDto;
    child_user: UserDto;
    custom_fields: Record<string, string>;
    assigned_counsellor_id?: string | null;
}

export interface EnquiryLeadsResponse {
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    first: boolean;
    last: boolean;
    content: EnquiryLeadUser[];
}

export interface EnquiryLeadsRequest {
    audience_id: string;
    source_type?: string;
    source_id?: string;
    submitted_from?: string;
    submitted_to?: string;
    page: number;
    size: number;
    sort_by?: string;
    sort_direction?: string;
}

export const fetchEnquiryLeads = async (
    payload: EnquiryLeadsRequest
): Promise<EnquiryLeadsResponse> => {
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
                submitted_from: payload.submitted_from,
                submitted_to: payload.submitted_to,
                page: payload.page,
                size: payload.size,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching enquiry leads:', error);
        throw error;
    }
};

export const handleFetchEnquiryLeads = (payload: EnquiryLeadsRequest) => {
    return {
        queryKey: [
            'enquiryLeads',
            payload.audience_id,
            payload.page,
            payload.size,
            payload.sort_by,
            payload.sort_direction,
            payload.source_type,
            payload.source_id,
            payload.submitted_from,
            payload.submitted_to,
        ],
        queryFn: () => fetchEnquiryLeads(payload),
        staleTime: 60 * 1000, // 1 minute
    };
};
