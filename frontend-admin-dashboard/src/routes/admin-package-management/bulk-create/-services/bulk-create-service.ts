import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { ADD_LEVEL, ADD_SESSION, BULK_ADD_COURSES, GET_PAYMENT_OPTIONS } from '@/constants/urls';
import {
    BulkCreateRequest,
    BulkCreateResponse,
    PaymentOptionItem,
} from '../-types/bulk-create-types';

export const bulkCreateCourses = async (
    request: BulkCreateRequest
): Promise<BulkCreateResponse> => {
    const instituteId = getCurrentInstituteId();

    const response = await authenticatedAxiosInstance<BulkCreateResponse>({
        method: 'POST',
        url: `${BULK_ADD_COURSES}/${instituteId}`,
        data: request,
    });

    return response.data;
};

export const createLevel = async (levelName: string): Promise<{ id: string; name: string }> => {
    const instituteId = getCurrentInstituteId();

    const response = await authenticatedAxiosInstance<{ id: string; level_name: string }>({
        method: 'POST',
        url: ADD_LEVEL,
        params: { instituteId },
        data: {
            level_name: levelName,
            duration_in_days: 365,
        },
    });

    return {
        id: response.data.id,
        name: response.data.level_name,
    };
};

export const createSession = async (sessionName: string): Promise<{ id: string; name: string }> => {
    const instituteId = getCurrentInstituteId();

    const response = await authenticatedAxiosInstance<{ id: string; session_name: string }>({
        method: 'POST',
        url: ADD_SESSION,
        params: { instituteId },
        data: {
            session_name: sessionName,
            start_date: new Date().toISOString(),
            status: 'ACTIVE',
        },
    });

    return {
        id: response.data.id,
        name: response.data.session_name,
    };
};

export const fetchPaymentOptions = async (): Promise<PaymentOptionItem[]> => {
    const instituteId = getCurrentInstituteId();

    const response = await authenticatedAxiosInstance<any[]>({
        method: 'GET',
        url: GET_PAYMENT_OPTIONS,
        params: { instituteId },
    });

    return response.data.map((option) => ({
        id: option.id,
        name: option.name,
        type: option.type || 'ONE_TIME',
        price: option.payment_plans?.[0]?.actual_price,
        currency: option.payment_plans?.[0]?.currency || 'INR',
    }));
};
