import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_STUDENT_CUSTOM_FIELD_VALUES } from '@/constants/urls';

/** One page of distinct values for a custom field (Spring Page<String>). */
export interface StudentCustomFieldValuesResponse {
    content: string[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
    first: boolean;
    last: boolean;
}

export interface FetchStudentCustomFieldValuesParams {
    instituteId: string;
    customFieldId: string;
    /** Case-insensitive substring filter on the value (e.g. typing "equ" → "Equine"). */
    search?: string;
    pageNo: number;
    pageSize: number;
}

/**
 * Distinct values a custom field actually holds across the institute's
 * learners, searchable + paginated. Powers the Manage Students filter bar's
 * multi-select for free-text custom fields (e.g. VetEducation's "Practice
 * Type") that have no fixed DROPDOWN option list. Only called once a
 * dropdown is opened, so it stays cheap.
 */
export const fetchStudentCustomFieldValues = async ({
    instituteId,
    customFieldId,
    search,
    pageNo,
    pageSize,
}: FetchStudentCustomFieldValuesParams): Promise<StudentCustomFieldValuesResponse> => {
    const { data } = await authenticatedAxiosInstance.get<StudentCustomFieldValuesResponse>(
        GET_STUDENT_CUSTOM_FIELD_VALUES,
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
