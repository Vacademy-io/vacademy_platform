import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';

export interface ChatUser {
    userId: string;
    instituteId: string;
    userRole: string;
    userName: string;
    token: string;
}

/**
 * Synchronously resolves the current user's chat identity from the access-token
 * cookie + the selected institute. The chat backend reads identity from query
 * params (userId/instituteId/userRole/userName), so every chat call threads these
 * through. userRole falls back to ADMIN; the backend normalizes role casing.
 */
export const getChatUser = (): ChatUser => {
    const token = getTokenFromCookie(TokenKey.accessToken) || '';
    const decoded = getTokenDecodedData(token);
    const instituteId = getCurrentInstituteId() || '';

    const userId = decoded?.user || decoded?.sub || '';
    const userName = decoded?.fullname || decoded?.username || '';
    const userRole = decoded?.authorities?.[instituteId]?.roles?.[0] || 'ADMIN';

    return { userId, instituteId, userRole, userName, token };
};
