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

export const BILLING_SUMMARY_URL = `${BASE_URL}/admin-core-service/v1/user-plan/payment-logs/billing-summary`;

/** What learners were billed, what they paid, and the difference. Amounts are in `currency`. */
export interface BillingSummary {
    total_billed: number;
    collected: number;
    due: number;
    plan_count: number;
    settled_plan_count: number;
    currency: string | null;
}

export interface BillingSummaryRequest {
    /** ISO local date-time (YYYY-MM-DDTHH:mm:ss); omit for all-time. Filters when the plan began. */
    start_date_in_utc?: string;
    end_date_in_utc?: string;
    package_session_ids?: string[];
}

/**
 * Billing totals for the Total / Collected / Due cards.
 *
 * These come from the plans learners are enrolled on, not from payment rows: a ₹50,000 course paid
 * in one ₹10,000 instalment leaves a single PAID row and no trace of the ₹40,000 still owed, and an
 * enrolment that has paid nothing has no payment rows at all. Summing payment logs therefore
 * reports institutes as fully collected while the money is still outstanding.
 */
export const fetchBillingSummary = async (
    requestBody: BillingSummaryRequest = {}
): Promise<BillingSummary> => {
    const instituteId = getCurrentInstituteId();

    if (!instituteId) {
        throw new Error('Institute ID not found');
    }

    const response = await authenticatedAxiosInstance.post(BILLING_SUMMARY_URL, {
        ...requestBody,
        institute_id: instituteId,
    });

    const d = (response.data ?? {}) as Partial<BillingSummary>;
    const totalBilled = typeof d.total_billed === 'number' ? d.total_billed : 0;
    const collected = typeof d.collected === 'number' ? d.collected : 0;
    return {
        total_billed: totalBilled,
        collected,
        // Trust the server's own subtraction when it sent one; never render a negative due.
        due: Math.max(0, typeof d.due === 'number' ? d.due : totalBilled - collected),
        plan_count: typeof d.plan_count === 'number' ? d.plan_count : 0,
        settled_plan_count: typeof d.settled_plan_count === 'number' ? d.settled_plan_count : 0,
        currency: d.currency ?? null,
    };
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
