/**
 * API client + React Query hooks for the counselor pool feature.
 * Wraps the 12 endpoints exposed by CounselorPoolController.
 *
 * Pool data model (mirrors backend DTOs):
 *   CounselorPool ──< PoolAudience    (one campaign per pool)
 *                  ──< PoolMember     (per-(audience, counselor) config)
 *                  ──< PoolShift      (only used when mode = TIME_BASED)
 *                        ──< PoolShiftMember
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import {
    COUNSELOR_POOL_AUDIENCE,
    COUNSELOR_POOL_AUDIENCE_ORDER,
    COUNSELOR_POOL_BASE,
    COUNSELOR_POOL_BY_ID,
    COUNSELOR_POOL_COUNSELOR,
    COUNSELOR_POOL_COUNSELOR_STATUS,
    COUNSELOR_POOL_SCHEDULE,
} from '@/constants/urls';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AssignmentMode = 'MANUAL' | 'ROUND_ROBIN' | 'TIME_BASED';
export type PoolStatus = 'ACTIVE' | 'INACTIVE';
export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export const DAYS_OF_WEEK: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export interface PoolAudienceDTO {
    id: string;
    pool_id: string;
    audience_id: string;
    last_assigned_counselor_id?: string | null;
    last_assigned_at?: string | null;
    added_at?: string;
}

export interface PoolMemberDTO {
    id: string;
    pool_id: string;
    audience_id: string;
    counselor_user_id: string;
    display_order: number;
    monthly_target?: number | null;
    status: PoolStatus;
    backup_counselor_user_id?: string | null;
    added_by?: string;
    added_at?: string;
    updated_at?: string;
}

export interface PoolShiftMemberDTO {
    id: string;
    shift_id: string;
    counselor_user_id: string;
    status: PoolStatus;
    added_at?: string;
}

export interface PoolShiftDTO {
    id: string;
    pool_id: string;
    day_of_week: DayOfWeek;
    /** Wall-clock time in institute timezone, formatted "HH:mm:ss". */
    start_time: string;
    end_time: string;
    label?: string;
    status: PoolStatus;
    created_at?: string;
    updated_at?: string;
    members?: PoolShiftMemberDTO[];
}

export interface CounselorPoolDTO {
    id: string;
    institute_id: string;
    name: string;
    description?: string;
    assignment_mode: AssignmentMode;
    created_by?: string;
    created_at?: string;
    updated_at?: string;
    audiences?: PoolAudienceDTO[];
    members?: PoolMemberDTO[];
    shifts?: PoolShiftDTO[];
}

export interface CreatePoolRequest {
    institute_id: string;
    name: string;
    description?: string;
    assignment_mode: AssignmentMode;
    audience_ids?: string[];
    counselor_user_ids?: string[];
}

export interface UpdatePoolRequest {
    name?: string;
    description?: string;
    assignment_mode?: AssignmentMode;
}

export interface UpdateMemberStatusRequest {
    status: PoolStatus;
    /** Required when status = INACTIVE. */
    backup_counselor_user_id?: string | null;
}

export interface ShiftBlockRequest {
    day_of_week: DayOfWeek;
    /** "HH:mm:ss" — wall-clock in institute timezone. */
    start_time: string;
    end_time: string;
    label?: string;
    counselor_user_ids: string[];
}

export interface WeeklyScheduleRequest {
    shifts: ShiftBlockRequest[];
}

// ─── API functions ───────────────────────────────────────────────────────────

export const fetchPools = async (): Promise<CounselorPoolDTO[]> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: COUNSELOR_POOL_BASE,
        params: { instituteId },
    });
    return response.data ?? [];
};

export const fetchPool = async (poolId: string): Promise<CounselorPoolDTO> => {
    const response = await authenticatedAxiosInstance.get(COUNSELOR_POOL_BY_ID(poolId));
    return response.data;
};

export const createPool = async (request: CreatePoolRequest): Promise<CounselorPoolDTO> => {
    const response = await authenticatedAxiosInstance.post(COUNSELOR_POOL_BASE, request);
    return response.data;
};

export const updatePool = async (
    poolId: string,
    request: UpdatePoolRequest
): Promise<CounselorPoolDTO> => {
    const response = await authenticatedAxiosInstance.patch(COUNSELOR_POOL_BY_ID(poolId), request);
    return response.data;
};

export const deletePool = async (poolId: string): Promise<void> => {
    await authenticatedAxiosInstance.delete(COUNSELOR_POOL_BY_ID(poolId));
};

export const addAudienceToPool = async (poolId: string, audienceId: string): Promise<void> => {
    await authenticatedAxiosInstance.post(COUNSELOR_POOL_AUDIENCE(poolId, audienceId));
};

export const removeAudienceFromPool = async (poolId: string, audienceId: string): Promise<void> => {
    await authenticatedAxiosInstance.delete(COUNSELOR_POOL_AUDIENCE(poolId, audienceId));
};

export const addCounselorToPool = async (poolId: string, counselorUserId: string): Promise<void> => {
    await authenticatedAxiosInstance.post(COUNSELOR_POOL_COUNSELOR(poolId, counselorUserId));
};

export const removeCounselorFromPool = async (
    poolId: string,
    counselorUserId: string
): Promise<void> => {
    await authenticatedAxiosInstance.delete(COUNSELOR_POOL_COUNSELOR(poolId, counselorUserId));
};

export const updateMemberStatus = async (
    poolId: string,
    counselorUserId: string,
    request: UpdateMemberStatusRequest
): Promise<void> => {
    await authenticatedAxiosInstance.patch(
        COUNSELOR_POOL_COUNSELOR_STATUS(poolId, counselorUserId),
        request
    );
};

/**
 * Replace the rotation order for one (pool, audience). The list must contain
 * every existing member's user_id in the desired order. Backend assigns
 * display_order = 1..N based on position.
 */
export const updateAudienceOrder = async (
    poolId: string,
    audienceId: string,
    counselorUserIds: string[]
): Promise<void> => {
    await authenticatedAxiosInstance.put(COUNSELOR_POOL_AUDIENCE_ORDER(poolId, audienceId), {
        counselor_user_ids: counselorUserIds,
    });
};

export const fetchWeeklySchedule = async (poolId: string): Promise<PoolShiftDTO[]> => {
    const response = await authenticatedAxiosInstance.get(COUNSELOR_POOL_SCHEDULE(poolId));
    return response.data ?? [];
};

export const setWeeklySchedule = async (
    poolId: string,
    request: WeeklyScheduleRequest
): Promise<PoolShiftDTO[]> => {
    const response = await authenticatedAxiosInstance.put(COUNSELOR_POOL_SCHEDULE(poolId), request);
    return response.data ?? [];
};

// ─── React Query hooks ───────────────────────────────────────────────────────

const POOL_LIST_KEY = ['counselor-pools'];
const poolDetailKey = (poolId: string) => ['counselor-pool', poolId];
const poolScheduleKey = (poolId: string) => ['counselor-pool-schedule', poolId];

export const useCounselorPools = () =>
    useQuery({
        queryKey: POOL_LIST_KEY,
        queryFn: fetchPools,
        staleTime: 30 * 1000,
    });

export const useCounselorPool = (poolId: string | undefined) =>
    useQuery({
        queryKey: poolDetailKey(poolId ?? ''),
        queryFn: () => fetchPool(poolId!),
        enabled: !!poolId,
    });

export const useWeeklySchedule = (poolId: string | undefined) =>
    useQuery({
        queryKey: poolScheduleKey(poolId ?? ''),
        queryFn: () => fetchWeeklySchedule(poolId!),
        enabled: !!poolId,
    });

/** Invalidate all caches for a pool after a mutation. */
export const useInvalidatePool = () => {
    const qc = useQueryClient();
    return (poolId?: string) => {
        qc.invalidateQueries({ queryKey: POOL_LIST_KEY });
        if (poolId) {
            qc.invalidateQueries({ queryKey: poolDetailKey(poolId) });
            qc.invalidateQueries({ queryKey: poolScheduleKey(poolId) });
        }
    };
};

export const useCreatePool = () => {
    const invalidate = useInvalidatePool();
    return useMutation({
        mutationFn: createPool,
        onSuccess: (pool) => invalidate(pool.id),
    });
};

export const useUpdatePool = (poolId: string) => {
    const invalidate = useInvalidatePool();
    return useMutation({
        mutationFn: (request: UpdatePoolRequest) => updatePool(poolId, request),
        onSuccess: () => invalidate(poolId),
    });
};

export const useDeletePool = () => {
    const invalidate = useInvalidatePool();
    return useMutation({
        mutationFn: deletePool,
        onSuccess: () => invalidate(),
    });
};

export const useAddAudienceToPool = (poolId: string) => {
    const invalidate = useInvalidatePool();
    return useMutation({
        mutationFn: (audienceId: string) => addAudienceToPool(poolId, audienceId),
        onSuccess: () => invalidate(poolId),
    });
};

export const useRemoveAudienceFromPool = (poolId: string) => {
    const invalidate = useInvalidatePool();
    return useMutation({
        mutationFn: (audienceId: string) => removeAudienceFromPool(poolId, audienceId),
        onSuccess: () => invalidate(poolId),
    });
};

export const useAddCounselorToPool = (poolId: string) => {
    const invalidate = useInvalidatePool();
    return useMutation({
        mutationFn: (counselorUserId: string) => addCounselorToPool(poolId, counselorUserId),
        onSuccess: () => invalidate(poolId),
    });
};

export const useRemoveCounselorFromPool = (poolId: string) => {
    const invalidate = useInvalidatePool();
    return useMutation({
        mutationFn: (counselorUserId: string) => removeCounselorFromPool(poolId, counselorUserId),
        onSuccess: () => invalidate(poolId),
    });
};

export const useUpdateAudienceOrder = (poolId: string) => {
    const invalidate = useInvalidatePool();
    return useMutation({
        mutationFn: (args: { audienceId: string; counselorUserIds: string[] }) =>
            updateAudienceOrder(poolId, args.audienceId, args.counselorUserIds),
        onSuccess: () => invalidate(poolId),
    });
};

export const useUpdateMemberStatus = (poolId: string) => {
    const invalidate = useInvalidatePool();
    return useMutation({
        mutationFn: (args: { counselorUserId: string; request: UpdateMemberStatusRequest }) =>
            updateMemberStatus(poolId, args.counselorUserId, args.request),
        onSuccess: () => invalidate(poolId),
    });
};

export const useSetWeeklySchedule = (poolId: string) => {
    const invalidate = useInvalidatePool();
    return useMutation({
        mutationFn: (request: WeeklyScheduleRequest) => setWeeklySchedule(poolId, request),
        onSuccess: () => invalidate(poolId),
    });
};
