import { AUDIENCE_CAMPAIGNS_LIST } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

export interface EnquiryListRequest {
    institute_id: string;
    campaign_name?: string;
    status?: string;
    campaign_type?: string;
    to_notify?: string;
    send_respondent_email?: boolean;
    start_date_from_local?: string;
    start_date_to_local?: string;
    page: number;
    size: number;
    sort_by?: string;
    sort_direction?: string;
}

export interface EnquiryListResponse {
    totalElements: number;
    totalPages: number;
    pageable: {
        paged: boolean;
        unpaged: boolean;
        pageNumber: number;
        pageSize: number;
        offset: number;
        sort: {
            unsorted: boolean;
            sorted: boolean;
            empty: boolean;
        };
    };
    numberOfElements: number;
    size: number;
    content: EnquiryItem[];
    number: number;
    sort: {
        unsorted: boolean;
        sorted: boolean;
        empty: boolean;
    };
    first: boolean;
    last: boolean;
    empty: boolean;
}

export interface EnquiryItem {
    id?: string;
    campaign_id?: string;
    audience_id?: string;
    institute_id?: string;
    campaign_name: string;
    campaign_type: string;
    description?: string;
    campaign_objective: string;
    start_date_local: string;
    end_date_local: string;
    status: string;
    json_web_metadata?: string;
    created_by_user_id?: string;
    to_notify?: string;
    send_respondent_email?: boolean;
    institute_custom_fields?: any[];
}

const fetchEnquiriesList = async (payload: EnquiryListRequest): Promise<EnquiryListResponse> => {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: AUDIENCE_CAMPAIGNS_LIST,
        data: payload,
    });
    return response?.data;
};

export const handleFetchEnquiriesList = (payload: EnquiryListRequest) => {
    return {
        queryKey: [
            'enquiriesList',
            payload.institute_id,
            payload.page,
            payload.size,
            payload.campaign_name,
            payload.status,
            payload.campaign_type,
        ],
        queryFn: async () => {
            const data = await fetchEnquiriesList(payload);
            return data;
        },
        staleTime: 60 * 1000, // 1 minute
    };
};
