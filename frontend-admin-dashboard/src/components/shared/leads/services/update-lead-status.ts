import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { UPDATE_LEAD_STATUS } from '@/constants/urls';

/**
 * Calls the EXISTING `update-status` endpoint (no new backend surface). Mirrors
 * the local `updateLeadStatus` used by the student lead-profile side view so the
 * inline status chip behaves identically.
 */
export async function updateLeadStatus(userId: string, instituteId: string, status: string) {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: UPDATE_LEAD_STATUS,
        params: { userId, instituteId, status },
    });
    return response.data;
}
