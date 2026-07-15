import { TokenKey } from '@/constants/auth/tokens';
import { getTokenDecodedData, getTokenFromCookie } from './sessionUtility';

/**
 * Whether the signed-in user holds the ADMIN role for a given institute.
 *
 * Roles are per-institute — the token's `authorities` map is keyed by institute id — so an admin
 * of one institute is not an admin of another. Always pass the institute the action targets.
 *
 * This gates UI affordances only; the server re-checks the same role and is the real boundary.
 */
export const isAdminForInstitute = (instituteId?: string | null): boolean => {
    if (!instituteId) return false;
    const tokenData = getTokenDecodedData(getTokenFromCookie(TokenKey.accessToken));
    const roles = tokenData?.authorities?.[instituteId]?.roles;
    return Array.isArray(roles) && roles.includes('ADMIN');
};
