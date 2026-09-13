import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import type {
    EngagementPlanDTO,
    EngagementPlanRequest,
    EngagementSlotDTO,
    EngagementSlotRequest,
    EngagementTrackingDTO,
} from '../-types/types';

/** Admin/teacher API for daily engagement plans. */

const ROOT = `${BASE_URL}/admin-core-service/engagement/admin/v1`;

function instituteParams() {
    return { instituteId: getInstituteId() };
}

export async function listEngagementPlans(packageSessionId?: string): Promise<EngagementPlanDTO[]> {
    const { data } = await authenticatedAxiosInstance.get<EngagementPlanDTO[]>(
        `${ROOT}/plan/list`,
        { params: { ...instituteParams(), packageSessionId } }
    );
    return Array.isArray(data) ? data : [];
}

export async function getEngagementPlan(planId: string): Promise<EngagementPlanDTO> {
    const { data } = await authenticatedAxiosInstance.get<EngagementPlanDTO>(
        `${ROOT}/plan/${planId}`,
        { params: instituteParams() }
    );
    return data;
}

export async function createEngagementPlan(
    request: EngagementPlanRequest
): Promise<EngagementPlanDTO> {
    const { data } = await authenticatedAxiosInstance.post<EngagementPlanDTO>(
        `${ROOT}/plan`,
        request,
        { params: instituteParams() }
    );
    return data;
}

export async function updateEngagementPlan(
    planId: string,
    request: Partial<EngagementPlanRequest>
): Promise<EngagementPlanDTO> {
    const { data } = await authenticatedAxiosInstance.put<EngagementPlanDTO>(
        `${ROOT}/plan/${planId}`,
        request,
        { params: instituteParams() }
    );
    return data;
}

export async function deleteEngagementPlan(planId: string): Promise<void> {
    await authenticatedAxiosInstance.delete(`${ROOT}/plan/${planId}`, {
        params: instituteParams(),
    });
}

export async function upsertEngagementSlot(
    planId: string,
    request: EngagementSlotRequest
): Promise<EngagementSlotDTO> {
    const { data } = await authenticatedAxiosInstance.post<EngagementSlotDTO>(
        `${ROOT}/plan/${planId}/slot`,
        request,
        { params: instituteParams() }
    );
    return data;
}

export async function deleteEngagementSlot(slotId: string): Promise<void> {
    await authenticatedAxiosInstance.delete(`${ROOT}/slot/${slotId}`, {
        params: instituteParams(),
    });
}

export async function getItemTracking(itemId: string): Promise<EngagementTrackingDTO> {
    const { data } = await authenticatedAxiosInstance.get<EngagementTrackingDTO>(
        `${ROOT}/item/${itemId}/tracking`,
        { params: instituteParams() }
    );
    return data;
}
