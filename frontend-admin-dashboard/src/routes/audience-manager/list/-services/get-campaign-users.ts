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

export interface CampaignLeadsRequest {
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
            payload.submitted_from,
            payload.submitted_to,
        ],
        queryFn: () => fetchCampaignLeads(payload),
        staleTime: 60 * 1000, // 1 minute
    };
};
