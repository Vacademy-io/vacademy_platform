import {
    useToolPricingQuery,
    useAiCreditsQuery,
    computeToolCredits,
} from '@/services/ai-credits/get-ai-credits';
import type { ToolKey, ToolParams } from '@/services/ai-credits/get-ai-credits';

export interface ToolCostPreview {
    /** Parametric estimate in credits (computed locally, mirrors the backend). */
    credits: number | null;
    isLoading: boolean;
    currentBalance: number | null;
    balanceAfter: number | null;
    /** false when the estimate exceeds the current balance. null when balance unknown. */
    sufficient: boolean | null;
    /** true when running this would drop the balance below the low-balance threshold. */
    isLowBalanceAfter: boolean;
}

/**
 * Live "≈ N credits" preview for an AI tool. Computes the parametric cost locally
 * from cached rates (no per-keystroke network call) and cross-checks the institute
 * balance. Read-only — never deducts. Phase 1 of academy-credits.
 */
export function useToolCostPreview(
    toolKey: ToolKey,
    params: ToolParams,
    enabled = true
): ToolCostPreview {
    const { data: pricing, isLoading: pricingLoading } = useToolPricingQuery(enabled);
    const { data: credits } = useAiCreditsQuery(enabled);

    const row = pricing?.tools.find((t) => t.tool_key === toolKey);
    const estimated = computeToolCredits(row, params);

    const currentBalance = credits ? parseFloat(credits.current_balance || '0') : null;
    const threshold = credits ? parseFloat(credits.low_balance_threshold || '0') : 0;
    const balanceAfter =
        currentBalance != null && estimated != null ? currentBalance - estimated : null;
    const sufficient = balanceAfter != null ? balanceAfter >= 0 : null;
    const isLowBalanceAfter = balanceAfter != null ? balanceAfter < threshold : false;

    return {
        credits: estimated,
        isLoading: pricingLoading,
        currentBalance,
        balanceAfter,
        sufficient,
        isLowBalanceAfter,
    };
}
