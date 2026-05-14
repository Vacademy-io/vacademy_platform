import { useQuery } from '@tanstack/react-query';

import { AI_SERVICE_BASE_URL } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';

/**
 * Backend response from GET /credits/v1/rate-config (V252).
 *
 * effective_ratio = usd_to_credits × (1 + margin_pct/100) — the multiplier
 * the FE applies when converting USD upper bounds (Veo cost cap, per-second
 * rates) into the credit equivalent shown to users.
 */
export interface CreditRateConfig {
    usd_to_credits: number;
    margin_pct: number;
    effective_ratio: number;
    currency_code: string;
}

/**
 * Sensible seed values matching the V252 migration's INSERT. Used as a
 * fallback when the rate-config endpoint is unreachable so the UI keeps
 * rendering credit values rather than NaN or `$undefined`.
 */
const DEFAULT_RATE: CreditRateConfig = {
    usd_to_credits: 100,
    margin_pct: 50,
    effective_ratio: 150,
    currency_code: 'USD',
};

const fetchCreditRate = async (): Promise<CreditRateConfig> => {
    const response = await authenticatedAxiosInstance.get<CreditRateConfig>(
        `${AI_SERVICE_BASE_URL}/credits/v1/rate-config`
    );
    return response.data;
};

/**
 * Reads the live credit↔USD rate. Cached for the entire session — rate
 * changes are infrequent (admin operation) and a few seconds of staleness
 * on a UI label is harmless. If the endpoint fails the hook silently falls
 * back to seed values rather than spinning the UI on retries.
 */
export const useCreditRate = () => {
    return useQuery({
        queryKey: ['GET_CREDIT_RATE_CONFIG'],
        queryFn: fetchCreditRate,
        staleTime: 24 * 60 * 60 * 1000, // 24h — rate changes are rare and admin-driven
        retry: false,
        placeholderData: DEFAULT_RATE,
    });
};

/**
 * Convenience wrapper: read the live effective ratio with the seeded
 * default as fallback. Most callers want a plain number, not the
 * surrounding React Query state.
 */
export const useEffectiveCreditRatio = (): number => {
    const { data } = useCreditRate();
    return data?.effective_ratio ?? DEFAULT_RATE.effective_ratio;
};
