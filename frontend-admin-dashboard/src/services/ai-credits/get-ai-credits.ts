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

export interface CreditEstimate {
    request_type: string;
    model: string | null;
    estimated_tokens: number;
    estimated_cost: number;
    current_balance?: number;
    balance_after?: number;
    has_sufficient_credits?: boolean;
}

// ---- Parametric tool cost preview ("≈ N credits") ----

export type ToolKey = 'assessment' | 'transcription' | 'notes' | 'lecture';
export type ToolUnitField = 'questions' | 'audio_minutes' | 'chars' | 'flat';
export type ToolParams = Record<string, string | number | boolean | undefined>;

export interface ToolPricingRow {
    tool_key: string;
    request_type: string;
    flat_base_credits: number;
    per_unit_credits: number;
    unit_field: ToolUnitField;
    params: Record<string, unknown>;
}

export interface ToolPricingResponse {
    tools: ToolPricingRow[];
}

export interface ToolEstimateBreakdownItem {
    component: string;
    detail: string;
    credits: number;
}

export interface ToolEstimate {
    tool_key: string;
    request_type: string;
    unit_field: ToolUnitField;
    estimated_credits: number;
    breakdown: ToolEstimateBreakdownItem[];
    current_balance?: number | null;
    balance_after?: number | null;
    sufficient?: boolean | null;
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

export const fetchCreditEstimate = async (
    requestType: string,
    model?: string,
    estimatedTokens = 1000
): Promise<CreditEstimate> => {
    const INSTITUTE_ID = getCurrentInstituteId();
    const params = new URLSearchParams({
        request_type: requestType,
        estimated_tokens: estimatedTokens.toString(),
    });
    if (model) params.set('model', model);
    if (INSTITUTE_ID) params.set('institute_id', INSTITUTE_ID);

    const response = await authenticatedAxiosInstance.get<CreditEstimate>(
        `${AI_SERVICE_BASE_URL}/credits/v1/estimate?${params}`
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

export const useCreditEstimateQuery = (
    requestType: string,
    model?: string,
    estimatedTokens = 1000,
    enabled = true
) => {
    return useQuery({
        queryKey: ['GET_CREDIT_ESTIMATE', requestType, model, estimatedTokens],
        queryFn: () => fetchCreditEstimate(requestType, model, estimatedTokens),
        enabled,
        staleTime: 120000, // 2 minutes
        retry: false,
    });
};

// ---- Parametric tool cost preview ----

export const fetchToolPricing = async (): Promise<ToolPricingResponse> => {
    const response = await authenticatedAxiosInstance.get<ToolPricingResponse>(
        `${AI_SERVICE_BASE_URL}/credits/v1/tool-pricing`
    );
    return response.data;
};

export const fetchToolEstimate = async (
    toolKey: ToolKey,
    params: ToolParams
): Promise<ToolEstimate> => {
    const INSTITUTE_ID = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance.post<ToolEstimate>(
        `${AI_SERVICE_BASE_URL}/credits/v1/estimate-tool`,
        { tool_key: toolKey, params, institute_id: INSTITUTE_ID || undefined }
    );
    return response.data;
};

// ---- Per-user self usage (widget "your usage" stat) ----

export interface UserUsage {
    institute_id: string;
    user_id: string;
    period_days: number;
    total_credits: number;
    request_count: number;
}

export const fetchUserAiUsage = async (userId: string, days = 7): Promise<UserUsage> => {
    const INSTITUTE_ID = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance.get<UserUsage>(
        `${AI_SERVICE_BASE_URL}/credits/v1/institutes/${INSTITUTE_ID}/users/${userId}/usage?days=${days}`
    );
    return response.data;
};

export const useUserAiUsageQuery = (userId: string, days = 7, enabled = true) => {
    return useQuery({
        queryKey: ['GET_USER_AI_USAGE', userId, days],
        queryFn: () => fetchUserAiUsage(userId, days),
        enabled: enabled && !!userId,
        staleTime: 60000,
        retry: false,
    });
};

export const useToolPricingQuery = (enabled = true) => {
    return useQuery({
        queryKey: ['GET_TOOL_PRICING'],
        queryFn: fetchToolPricing,
        enabled,
        staleTime: 10 * 60 * 1000, // 10 minutes — rates change rarely
        retry: false,
    });
};

/**
 * Local mirror of the backend ToolCostEstimator math. Lets the live badge update
 * instantly as inputs change without a network round-trip. MUST stay in sync with
 * ai_service/app/services/tool_cost_estimator.py (and the V321 seed).
 */
export const computeToolCredits = (
    row: ToolPricingRow | undefined,
    params: ToolParams
): number | null => {
    if (!row) return null;
    const flatBase = Number(row.flat_base_credits) || 0;
    const perUnit = Number(row.per_unit_credits) || 0;
    const extra = row.params || {};
    let total = flatBase;

    switch (row.unit_field) {
        case 'questions': {
            const n = Math.max(0, Number(params.num_questions) || 0);
            total += n * perUnit;
            // Explicit image_count (charge time) wins; else include_images is the
            // preview upper bound of one image per question.
            let images = 0;
            if (params.image_count != null) {
                images = Math.max(0, Number(params.image_count) || 0);
            } else if (params.include_images) {
                images = n;
            }
            if (images > 0) {
                total += images * (Number(extra.image_unit_credits) || 0);
            }
            break;
        }
        case 'audio_minutes': {
            const minutes =
                params.duration_seconds != null
                    ? Math.ceil((Number(params.duration_seconds) || 0) / 60)
                    : Math.ceil(Number(params.audio_minutes) || 0);
            total = Math.max(Number(extra.min_credits) || 0, flatBase + minutes * perUnit);
            break;
        }
        case 'chars': {
            const chars = Math.max(0, Number(params.transcript_chars) || 0);
            // Guard a misconfigured non-positive rate (mirrors the Python estimator).
            let divisor = Number(extra.chars_per_unit);
            if (!(divisor > 0)) divisor = 2000;
            total += Math.ceil(chars / divisor) * perUnit;
            break;
        }
        case 'flat': {
            if (params.generate_questions) total += Number(extra.questions_add) || 0;
            if (params.generate_homework) total += Number(extra.homework_add) || 0;
            break;
        }
    }
    return Math.ceil(total);
};
