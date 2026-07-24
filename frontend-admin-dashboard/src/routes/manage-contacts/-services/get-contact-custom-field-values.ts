import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_CONTACT_CUSTOM_FIELD_VALUES } from '@/constants/urls';

/** One page of distinct values for a custom field (Spring Page<String>). */
export interface ContactCustomFieldValuesResponse {
    content: string[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    first: boolean;
    last: boolean;
}

export interface FetchContactCustomFieldValuesParams {
    instituteId: string;
    customFieldId: string;
    /** Case-insensitive substring filter on the value (e.g. typing "pun" → "Pune"). */
    search?: string;
    pageNo: number;
    pageSize: number;
}

/**
 * Distinct values a custom field holds across the institute's contacts — the
 * union of learner (USER) and lead (AUDIENCE_RESPONSE) answers. Feeds the
 * multi-select custom-field dropdowns on the All Contacts filter bar; only
 * called for enabled fields and only once a dropdown is opened.
 */
export const fetchContactCustomFieldValues = async ({
    instituteId,
    customFieldId,
    search,
    pageNo,
    pageSize,
}: FetchContactCustomFieldValuesParams): Promise<ContactCustomFieldValuesResponse> => {
    const { data } = await authenticatedAxiosInstance.get<ContactCustomFieldValuesResponse>(
        GET_CONTACT_CUSTOM_FIELD_VALUES,
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
