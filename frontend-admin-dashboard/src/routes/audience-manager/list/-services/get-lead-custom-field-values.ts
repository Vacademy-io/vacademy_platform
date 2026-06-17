import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_LEAD_CUSTOM_FIELD_VALUES } from '@/constants/urls';

/**
 * A single custom-field filter sent on the leads request. Within one entry the
 * `values` are OR-combined (city = Pune OR Mumbai); across entries the backend
 * AND-combines them. `field_id` is the custom_field_id (uuid), matching how lead
 * rows key their custom_field_values.
 */
export interface LeadCustomFieldFilter {
    field_id: string;
    values: string[];
}

/** One page of distinct values for a custom field (Spring Page<String>). */
export interface LeadCustomFieldValuesResponse {
    content: string[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    first: boolean;
    last: boolean;
}

export interface FetchLeadCustomFieldValuesParams {
    instituteId: string;
    customFieldId: string;
    /** Case-insensitive substring filter on the value (e.g. typing "pun" → "Pune"). */
    search?: string;
    pageNo: number;
    pageSize: number;
}

/**
 * Distinct values a custom field actually holds across the institute's leads,
 * searchable + paginated. Only called for fields the admin has enabled as leads
 * filters, and only once a dropdown is opened, so it stays cheap.
 */
export const fetchLeadCustomFieldValues = async ({
    instituteId,
    customFieldId,
    search,
    pageNo,
    pageSize,
}: FetchLeadCustomFieldValuesParams): Promise<LeadCustomFieldValuesResponse> => {
    const { data } = await authenticatedAxiosInstance.get<LeadCustomFieldValuesResponse>(
        GET_LEAD_CUSTOM_FIELD_VALUES,
        {
            params: {
                instituteId,
                customFieldId,
                ...(search ? { search } : {}),
                pageNo,
                pageSize,
            },
        }
    );
    return data;
};
