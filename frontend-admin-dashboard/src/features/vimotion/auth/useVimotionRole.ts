import { useMemo } from 'react';
import { TokenKey } from '@/constants/auth/tokens';
import { getTokenFromCookie, getUserRoles } from '@/lib/auth/sessionUtility';

export interface VimotionRoleInfo {
    roles: string[];
    isAdmin: boolean;
    isContentCreator: boolean;
}

// Reads the viewer's roles off the JWT. ADMIN gates the Team tab and the
// Top Up flow; CONTENT CREATOR sees credits read-only and cannot top up.
export function useVimotionRole(): VimotionRoleInfo {
    return useMemo(() => {
        const token = getTokenFromCookie(TokenKey.accessToken);
        const roles = (getUserRoles(token) || []).map((r) => r.toUpperCase());
        return {
            roles,
            isAdmin: roles.includes('ADMIN'),
            isContentCreator: roles.includes('CONTENT CREATOR'),
        };
    }, []);
}
