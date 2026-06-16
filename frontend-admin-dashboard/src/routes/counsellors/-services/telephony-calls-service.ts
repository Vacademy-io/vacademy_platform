import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import type { PagedCallLog } from '@/components/shared/leads';

/**
 * Counsellor-scoped telephony call history — the manager-coaching "Calls" tab
 * in the workbench drawer. Same endpoint the lead side-view uses, filtered by
 * `counsellorUserId` instead of the lead's `userId` (backed by
 * idx_tcl_counsellor, so the query is cheap).
 *
 * Lives in its own service file (not counsellor-workbench-services.ts) because
 * it talks to the telephony feature, not the workbench API.
 */
const TELEPHONY_CALLS_BY_COUNSELLOR = (
    counsellorUserId: string,
    instituteId: string,
    page = 0,
    size = 20
) =>
    `${BASE_URL}/admin-core-service/v1/telephony/calls?counsellorUserId=${encodeURIComponent(
        counsellorUserId
    )}&instituteId=${encodeURIComponent(instituteId)}&page=${page}&size=${size}`;

export const fetchCounsellorCalls = async (
    counsellorUserId: string,
    instituteId: string,
    page = 0,
    size = 20
): Promise<PagedCallLog> => {
    const { data } = await authenticatedAxiosInstance.get<PagedCallLog>(
        TELEPHONY_CALLS_BY_COUNSELLOR(counsellorUserId, instituteId, page, size)
    );
    return data;
};
