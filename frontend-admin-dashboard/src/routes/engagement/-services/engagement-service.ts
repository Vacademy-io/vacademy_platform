import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import type {
    EngagementPlanDTO,
    PlanOverview,
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

/** Creates one plan per selected batch; the server always answers with a list. */
export async function createEngagementPlan(
    request: EngagementPlanRequest
): Promise<EngagementPlanDTO[]> {
    const { data } = await authenticatedAxiosInstance.post<EngagementPlanDTO[] | EngagementPlanDTO>(
        `${ROOT}/plan`,
        request,
        { params: instituteParams() }
    );
    return Array.isArray(data) ? data : [data];
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

export async function getPlanOverview(planId: string): Promise<PlanOverview> {
    const { data } = await authenticatedAxiosInstance.get<PlanOverview>(
        `${ROOT}/plan/${planId}/overview`,
        { params: instituteParams() }
    );
    return data;
}

export async function getItemTracking(
    itemId: string,
    page = 0,
    size = 20
): Promise<EngagementTrackingDTO> {
    const { data } = await authenticatedAxiosInstance.get<EngagementTrackingDTO>(
        `${ROOT}/item/${itemId}/tracking`,
        { params: { ...instituteParams(), page, size } }
    );
    return data;
}

/**
 * Download every attempt as CSV.
 *
 * The file is built server-side so the export covers the whole result set rather
 * than the page currently on screen.
 */
export async function downloadItemTrackingCsv(itemId: string, title: string): Promise<void> {
    const response = await authenticatedAxiosInstance.get<Blob>(
        `${ROOT}/item/${itemId}/tracking/export`,
        { params: instituteParams(), responseType: 'blob' }
    );
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    const safeTitle = title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'engagement';
    link.download = `${safeTitle}-attempts.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoking immediately can cancel the download in some browsers; give it a beat.
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
