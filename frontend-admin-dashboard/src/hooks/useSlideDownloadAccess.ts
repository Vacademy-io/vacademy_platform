import { useQuery } from '@tanstack/react-query';
import { getSlideDownloadPermission } from '@/routes/settings/-services/slide-download-permission-service';
import { getUserRoles, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { canRoleDownloadInAdmin } from '@/constants/slide-download-permission';

/**
 * Enforce the per-role slide download/print permission in the ADMIN authoring
 * app. Reads the current user's roles from the access token and the institute's
 * setting, and exposes `canDownload(typeKey)`.
 *
 * Uses the default-allow / deny-on-explicit-false resolver, so admins and
 * unconfigured roles keep their existing access — only a role an admin has
 * explicitly turned off (e.g. a teacher) is blocked. Shares the React Query key
 * with the settings card so the fetch is deduped.
 */
export function useSlideDownloadAccess() {
    const { data } = useQuery({
        queryKey: ['slide-download-permission'],
        queryFn: getSlideDownloadPermission,
        staleTime: 5 * 60 * 1000,
    });

    const roles = getUserRoles(getTokenFromCookie(TokenKey.accessToken));

    const canDownload = (typeKey: string) => canRoleDownloadInAdmin(data, typeKey, roles);

    return { canDownload };
}
