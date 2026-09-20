import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ToolPricingRow } from '@/services/ai-credits/get-ai-credits';

// The rate card is whatever ai_tool_pricing says — the hook must not carry its
// own numbers. This row mirrors the live copy_check_evaluation row (2026-09-21).
const copyCheckRow: ToolPricingRow = {
    tool_key: 'copy_check_evaluation',
    request_type: 'evaluation',
    flat_base_credits: 1,
    per_unit_credits: 0.2,
    unit_field: 'questions',
    params: {},
};

vi.mock('@/services/ai-credits/get-ai-credits', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/services/ai-credits/get-ai-credits')>();
    return {
        ...actual,
        useToolPricingQuery: () => ({ data: { tools: [copyCheckRow] }, isLoading: false }),
        useAiCreditsQuery: () => ({
            data: { current_balance: '100', low_balance_threshold: '10' },
        }),
    };
});

import { useToolCostPreview } from '@/components/common/ai-credits/useToolCostPreview';

describe('useToolCostPreview', () => {
    it('quotes one copy from the rate row: ceil(1 + 0.2 × 64) = 14', () => {
        const { result } = renderHook(() =>
            useToolCostPreview('copy_check_evaluation', { num_questions: 64 })
        );
        expect(result.current.credits).toBe(14);
        expect(result.current.rate).toEqual(copyCheckRow);
    });

    it('charges the flat base and rounding per copy, not once over the summed questions', () => {
        // 3 copies of a 64-question paper: 3 × ceil(13.8) = 42,
        // not ceil(1 + 0.2 × 192) = 40 — the backend bills each copy separately.
        const { result } = renderHook(() =>
            useToolCostPreview('copy_check_evaluation', { num_questions: 64 }, true, 3)
        );
        expect(result.current.credits).toBe(42);
        expect(result.current.balanceAfter).toBe(58);
        expect(result.current.sufficient).toBe(true);
    });

    it('flags an insufficient balance across all copies', () => {
        const { result } = renderHook(() =>
            useToolCostPreview('copy_check_evaluation', { num_questions: 64 }, true, 8)
        );
        expect(result.current.credits).toBe(112);
        expect(result.current.sufficient).toBe(false);
    });
});
