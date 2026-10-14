import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    GET_USER_CPO_USER_PLANS,
    GET_USER_PLAN_INSTALLMENTS,
    POST_SPLIT_INSTALLMENT,
    POST_USER_PLAN_CPO_DISCOUNT_PREVIEW,
    POST_USER_PLAN_OFFLINE_PAYMENT,
    PUT_INSTALLMENT,
    PUT_USER_PLAN_CPO_DISCOUNT,
} from '@/constants/urls';
import type {
    ApplyCpoDiscountRequest,
    CpoDiscountPreview,
    CpoSideViewInstallmentsResponse,
    CpoUserPlanSummary,
    ModifyInstallmentRequest,
    RecordOfflinePaymentRequest,
    SplitInstallmentRequest,
} from '../-types/cpo-side-view-types';

// ─── Reads ─────────────────────────────────────────────────────────────────

export const fetchUserCpoUserPlans = async (userId: string): Promise<CpoUserPlanSummary[]> => {
    const r = await authenticatedAxiosInstance.get<CpoUserPlanSummary[]>(GET_USER_CPO_USER_PLANS(userId));
    return r.data ?? [];
};

export const useUserCpoUserPlans = (userId: string | null | undefined) =>
    useQuery({
        queryKey: ['cpo-side-view', 'user-plans', userId],
        queryFn: () => fetchUserCpoUserPlans(userId!),
        enabled: !!userId,
        staleTime: 30000,
    });

export const fetchUserPlanInstallments = async (
    userPlanId: string,
): Promise<CpoSideViewInstallmentsResponse> => {
    const r = await authenticatedAxiosInstance.get<CpoSideViewInstallmentsResponse>(
        GET_USER_PLAN_INSTALLMENTS(userPlanId),
    );
    return r.data;
};

export const useUserPlanInstallments = (userPlanId: string | null | undefined) =>
    useQuery({
        queryKey: ['cpo-side-view', 'installments', userPlanId],
        queryFn: () => fetchUserPlanInstallments(userPlanId!),
        enabled: !!userPlanId,
        staleTime: 15000,
    });

/**
 * What a plan discount would take off each installment, recomputed as the admin edits it.
 * Null body = nothing to preview (no discount typed yet).
 */
export const useCpoDiscountPreview = (userPlanId: string, body: ApplyCpoDiscountRequest | null) =>
    useQuery({
        queryKey: ['cpo-side-view', 'discount-preview', userPlanId, body],
        queryFn: async () => {
            const r = await authenticatedAxiosInstance.post<CpoDiscountPreview>(
                POST_USER_PLAN_CPO_DISCOUNT_PREVIEW(userPlanId),
                body,
            );
            return r.data;
        },
        enabled: !!body,
        retry: false,
        staleTime: 10000,
        placeholderData: (previous) => previous,
    });

// ─── Writes ────────────────────────────────────────────────────────────────

const refresh = (queryClient: ReturnType<typeof useQueryClient>, userPlanId: string, userId?: string | null) => {
    queryClient.invalidateQueries({ queryKey: ['cpo-side-view', 'installments', userPlanId] });
    queryClient.invalidateQueries({ queryKey: ['cpo-side-view', 'discount-preview', userPlanId] });
    if (userId) {
        queryClient.invalidateQueries({ queryKey: ['cpo-side-view', 'user-plans', userId] });
        // Payments and discounts also move the invoices and the Account Summary on the same panel.
        queryClient.invalidateQueries({ queryKey: ['user-invoices', userId] });
        queryClient.invalidateQueries({ queryKey: ['user-account-summary', userId] });
        queryClient.invalidateQueries({ queryKey: ['user-account-ledger', userId] });
    }
};

export const useModifyInstallment = (userPlanId: string, userId?: string | null) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { sfpId: string; body: ModifyInstallmentRequest }) => {
            const r = await authenticatedAxiosInstance.put<CpoSideViewInstallmentsResponse>(
                PUT_INSTALLMENT(input.sfpId),
                input.body,
            );
            return r.data;
        },
        onSuccess: () => refresh(queryClient, userPlanId, userId),
    });
};

export const useApplyCpoDiscount = (userPlanId: string, userId?: string | null) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (body: ApplyCpoDiscountRequest) => {
            const r = await authenticatedAxiosInstance.put<CpoSideViewInstallmentsResponse>(
                PUT_USER_PLAN_CPO_DISCOUNT(userPlanId),
                body,
            );
            return r.data;
        },
        onSuccess: () => refresh(queryClient, userPlanId, userId),
    });
};

export const useRecordOfflinePayment = (userPlanId: string, userId?: string | null) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (body: RecordOfflinePaymentRequest) => {
            const r = await authenticatedAxiosInstance.post<CpoSideViewInstallmentsResponse>(
                POST_USER_PLAN_OFFLINE_PAYMENT(userPlanId),
                body,
            );
            return r.data;
        },
        onSuccess: () => refresh(queryClient, userPlanId, userId),
    });
};

export const useSplitInstallment = (userPlanId: string, userId?: string | null) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { sfpId: string; body: SplitInstallmentRequest }) => {
            const r = await authenticatedAxiosInstance.post<CpoSideViewInstallmentsResponse>(
                POST_SPLIT_INSTALLMENT(input.sfpId),
                input.body,
            );
            return r.data;
        },
        onSuccess: () => {
            refresh(queryClient, userPlanId, userId);
            // A split re-posts the plan's ledger rows, so the Account Summary and Transaction
            // History on the same panel refresh too.
            if (userId) {
                queryClient.invalidateQueries({ queryKey: ['user-account-summary', userId] });
                queryClient.invalidateQueries({ queryKey: ['user-account-ledger', userId] });
            }
        },
    });
};
