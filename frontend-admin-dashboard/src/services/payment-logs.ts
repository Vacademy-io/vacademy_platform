import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import type { PaymentLogsRequest, PaymentLogsResponse } from '@/types/payment-logs';

export const PAYMENT_LOGS_URL = `${BASE_URL}/admin-core-service/v1/user-plan/payment-logs`;
/**
 * Fetch payment logs with pagination and filtering
 */
export const fetchPaymentLogs = async (
    pageNo: number = 0,
    pageSize: number = 20,
    requestBody: Omit<PaymentLogsRequest, 'institute_id'>
): Promise<PaymentLogsResponse> => {
    const instituteId = getCurrentInstituteId();

    if (!instituteId) {
        throw new Error('Institute ID not found');
    }

    const finalRequestBody: PaymentLogsRequest = {
        ...requestBody,
        institute_id: instituteId,
    };

    const response = await authenticatedAxiosInstance.post<PaymentLogsResponse>(
        PAYMENT_LOGS_URL,
        finalRequestBody,
        {
            params: {
                pageNo,
                pageSize,
            },
        }
    );

    return response.data;
};

/**
 * Get payment logs query configuration for React Query
 */
export const getPaymentLogsQueryKey = (
    pageNo: number,
    pageSize: number,
    filters: Omit<PaymentLogsRequest, 'institute_id'>
) => ['payment-logs', pageNo, pageSize, filters];

export const usePaymentLogsQuery = (
    pageNo: number,
    pageSize: number,
    filters: Omit<PaymentLogsRequest, 'institute_id'>
) => {
    return {
        queryKey: getPaymentLogsQueryKey(pageNo, pageSize, filters),
        queryFn: () => fetchPaymentLogs(pageNo, pageSize, filters),
        keepPreviousData: true,
        staleTime: 30000, // 30 seconds
    };
};

export interface UpdatePaymentLogTrackingRequest {
    payment_log_id: string;
    tracking_id: string;
    tracking_source: string;
    order_status: string;
}
export const UPDATE_PAYMENT_LOG_TRACKING_URL = `${BASE_URL}/admin-core-service/v1/user-plan/payment-logs/update-tracking`;

/**
 * Update tracking info (tracking_id, tracking_source, order_status) for a payment log row.
 */
export const updatePaymentLogTracking = async (
    request: UpdatePaymentLogTrackingRequest
): Promise<void> => {
    await authenticatedAxiosInstance.post(UPDATE_PAYMENT_LOG_TRACKING_URL, request);
};

