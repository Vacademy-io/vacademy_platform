import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { AI_SERVICE_BASE_URL } from '@/constants/urls';
import { useQuery } from '@tanstack/react-query';

export interface AiCreditsType {
    institute_id: string;
    total_credits: string;
    used_credits: string;
    current_balance: string;
    low_balance_threshold: string;
    is_low_balance: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreditTransaction {
    id: string;
    institute_id: string;
    transaction_type: 'INITIAL_GRANT' | 'ADMIN_GRANT' | 'USAGE_DEDUCTION' | 'REFUND';
    amount: number;
    balance_after: number;
    description: string;
    request_type?: string;
    model_name?: string;
    granted_by?: string;
    created_at: string;
}

export interface TransactionsResponse {
    transactions: CreditTransaction[];
    total_count: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface UsageByRequestType {
    request_type: string;
    total_requests: number;
    total_credits: number;
    percentage: number;
}

export interface UsageByDay {
    date: string;
    total_requests: number;
    total_credits: number;
}

export interface TopModel {
    model: string;
    requests: number;
    credits: number;
}

export interface UsageAnalytics {
    institute_id: string;
    period_start: string;
    period_end: string;
    total_requests: number;
    total_credits_used: number;
    by_request_type: UsageByRequestType[];
    by_day: UsageByDay[];
    top_models: TopModel[];
}

export interface UsageForecast {
    institute_id: string;
    current_balance: number;
    average_daily_usage: number;
    estimated_days_remaining: number;
    projected_zero_date: string;
    recommendation: string;
}

// ---- Fetcher functions ----

export const fetchAiCredits = async (): Promise<AiCreditsType> => {
    const INSTITUTE_ID = getCurrentInstituteId();

    const response = await authenticatedAxiosInstance.get<AiCreditsType>(
        `${AI_SERVICE_BASE_URL}/credits/v1/institutes/${INSTITUTE_ID}/balance`
    );
    return response.data;
};

export const fetchAiTransactions = async (
    page = 1,
    pageSize = 20,
    transactionTypes?: string
): Promise<TransactionsResponse> => {
    const INSTITUTE_ID = getCurrentInstituteId();
    const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
    });
    if (transactionTypes) {
        params.set('transaction_types', transactionTypes);
    }

    const response = await authenticatedAxiosInstance.get<TransactionsResponse>(
        `${AI_SERVICE_BASE_URL}/credits/v1/institutes/${INSTITUTE_ID}/transactions?${params}`
    );
    return response.data;
};

export const fetchAiUsageAnalytics = async (days = 30): Promise<UsageAnalytics> => {
    const INSTITUTE_ID = getCurrentInstituteId();

    const response = await authenticatedAxiosInstance.get<UsageAnalytics>(
        `${AI_SERVICE_BASE_URL}/credits/v1/institutes/${INSTITUTE_ID}/usage?days=${days}`
    );
    return response.data;
};

export const fetchAiUsageForecast = async (): Promise<UsageForecast> => {
    const INSTITUTE_ID = getCurrentInstituteId();

    const response = await authenticatedAxiosInstance.get<UsageForecast>(
        `${AI_SERVICE_BASE_URL}/credits/v1/institutes/${INSTITUTE_ID}/forecast`
    );
    return response.data;
};

// ---- React Query hooks ----

export const useAiCreditsQuery = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['GET_AI_CREDITS'],
        queryFn: fetchAiCredits,
        enabled: enabled,
        staleTime: 60000, // 1 minute
        retry: false, // Do not retry on failure as per requirement "if the api fails ... do not give error just do not show"
    });
};

export const useAiTransactionsQuery = (
    page = 1,
    pageSize = 10,
    transactionTypes?: string,
    enabled = true
) => {
    return useQuery({
        queryKey: ['GET_AI_TRANSACTIONS', page, pageSize, transactionTypes],
        queryFn: () => fetchAiTransactions(page, pageSize, transactionTypes),
        enabled,
        staleTime: 30000,
        retry: false,
    });
};

export const useAiUsageAnalyticsQuery = (days = 30, enabled = true) => {
    return useQuery({
        queryKey: ['GET_AI_USAGE_ANALYTICS', days],
        queryFn: () => fetchAiUsageAnalytics(days),
        enabled,
        staleTime: 60000,
        retry: false,
    });
};

export const useAiUsageForecastQuery = (enabled = true) => {
    return useQuery({
        queryKey: ['GET_AI_USAGE_FORECAST'],
        queryFn: fetchAiUsageForecast,
        enabled,
        staleTime: 60000,
        retry: false,
    });
};
