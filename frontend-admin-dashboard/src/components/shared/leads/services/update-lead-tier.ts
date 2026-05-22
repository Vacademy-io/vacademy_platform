import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { UPDATE_LEAD_TIER } from '@/constants/urls';

/**
 * Calls the EXISTING `update-tier` endpoint (no new backend surface). Mirrors
 * the local `updateLeadTier` used by the student lead-profile side view so the
 * board's "Set tier" action behaves identically.
 */
export async function updateLeadTier(userId: string, instituteId: string, tier: string) {
    const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: UPDATE_LEAD_TIER,
        params: { userId, instituteId, tier },
    });
    return response.data;
}
