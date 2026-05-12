import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    GET_USER_CPO_USER_PLANS,
    GET_USER_PLAN_INSTALLMENTS,
    POST_USER_PLAN_OFFLINE_PAYMENT,
    PUT_INSTALLMENT,
    PUT_USER_PLAN_CPO_DISCOUNT,
} from '@/constants/urls';
import type {
    ApplyCpoDiscountRequest,
    CpoSideViewInstallmentsResponse,
    CpoUserPlanSummary,
    ModifyInstallmentRequest,
    RecordOfflinePaymentRequest,
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

// ─── Writes ────────────────────────────────────────────────────────────────

const refresh = (queryClient: ReturnType<typeof useQueryClient>, userPlanId: string, userId?: string | null) => {
    queryClient.invalidateQueries({ queryKey: ['cpo-side-view', 'installments', userPlanId] });
    if (userId) queryClient.invalidateQueries({ queryKey: ['cpo-side-view', 'user-plans', userId] });
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
