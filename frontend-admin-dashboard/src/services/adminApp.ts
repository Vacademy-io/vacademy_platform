import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { NOTIFICATION_SERVICE_BASE } from '@/constants/urls';
import { getInstituteId } from '@/constants/helper';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import type { IAccessToken } from '@/constants/auth/tokens';

export type AdminAppPlatform = 'ANDROID' | 'IOS';

const REQUEST_ADMIN_APP_LINK_URL = `${NOTIFICATION_SERVICE_BASE}/admin-app/request-link`;

/**
 * Ask the backend to WhatsApp the Vacademy Admin app download link (Android or
 * iOS) to the given phone number. The requester's identity and institute are
 * gathered here so the backend can log who asked. Sends from the platform
 * (Vidyayatan) WhatsApp account — no institute credentials required.
 */
export async function requestAdminAppLink(
    platform: AdminAppPlatform,
    phoneNumber: string
): Promise<void> {
    const token = getTokenDecodedData(getTokenFromCookie(TokenKey.accessToken)) as
        | IAccessToken
        | undefined;
    const instituteName =
        useInstituteDetailsStore.getState().instituteDetails?.institute_name ?? null;

    await authenticatedAxiosInstance.post(REQUEST_ADMIN_APP_LINK_URL, {
        platform,
        phoneNumber,
        instituteId: getInstituteId() ?? null,
        instituteName,
        requesterName: token?.fullname ?? token?.username ?? null,
        requesterEmail: token?.email ?? null,
    });
}
