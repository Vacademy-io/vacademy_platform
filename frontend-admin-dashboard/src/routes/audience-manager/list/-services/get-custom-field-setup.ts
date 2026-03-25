import { GET_CUSTOM_FIELD_SETUP } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

export interface CustomFieldSetupItem {
    custom_field_id: string;
    field_key: string;
    field_name: string;
    field_type: string;
    form_order: number;
    is_hidden?: boolean;
    group_name?: string;
    type?: string;
    type_id?: string;
    status?: string;
}

const normalizeResponse = (responseData: unknown): CustomFieldSetupItem[] => {
    if (Array.isArray(responseData)) {
        return responseData as CustomFieldSetupItem[];
    }

    if (responseData && typeof responseData === 'object') {
        const dataField = (responseData as Record<string, unknown>).data;
        if (Array.isArray(dataField)) {
            return dataField as CustomFieldSetupItem[];
        }

        const resultField = (responseData as Record<string, unknown>).result;
        if (Array.isArray(resultField)) {
            return resultField as CustomFieldSetupItem[];
        }
    }

    return [];
};

export const fetchCustomFieldSetup = async (
    instituteId: string
): Promise<CustomFieldSetupItem[]> => {
    if (!instituteId) {
        return [];
    }

    try {
        const response = await authenticatedAxiosInstance({
            method: 'GET',
            url: GET_CUSTOM_FIELD_SETUP,
            params: {
                instituteId,
            },
        });

        return normalizeResponse(response.data);
    } catch (error) {
        console.error('Error fetching custom field setup:', error);
        throw error;
    }
};

