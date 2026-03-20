import { getActiveRoleDisplaySettingsKey } from '@/lib/auth/instituteUtils';
import { getInstituteId } from '@/constants/helper';
import { hasFacultyAssignedPermission } from '@/lib/auth/facultyAccessUtils';
import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { TokenKey } from '@/constants/auth/tokens';
import {
  setAuthorizationCookie,
  getTokenFromCookie,
  isTokenExpired,
} from '@/lib/auth/sessionUtility';
import { getUserRoles } from '@/lib/auth/sessionUtility';
import { getDisplaySettings, getDisplaySettingsFromCache } from '@/services/display-settings';
import { ADMIN_DISPLAY_SETTINGS_KEY, TEACHER_DISPLAY_SETTINGS_KEY, CUSTOM_ROLE_DISPLAY_SETTINGS_KEY } from '@/types/display-settings';

export const Route = createLazyFileRoute('/auth-transfer/')({
  component: AuthTransferPage,
});

function AuthTransferPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      // 1) Ensure tokens exist (cookie or URL), otherwise go to login with redirect
      let accessToken = getTokenFromCookie(TokenKey.accessToken);
      let refreshToken = getTokenFromCookie(TokenKey.refreshToken);

      if (!accessToken || !refreshToken || isTokenExpired(accessToken)) {
        const params = new URLSearchParams(window.location.search);
        const urlAccess = params.get('accessToken');
        const urlRefresh = params.get('refreshToken');

        if (urlAccess && urlRefresh) {
          setAuthorizationCookie(TokenKey.accessToken, urlAccess);
          setAuthorizationCookie(TokenKey.refreshToken, urlRefresh);
          accessToken = urlAccess;
          refreshToken = urlRefresh;
        }
      }

      if (!accessToken || !refreshToken || isTokenExpired(accessToken)) {
        navigate({
          to: '/login',
          search: { redirect: '/auth-transfer' },
          replace: true,
        });
        return;
      }

      // 2) Load role-based display settings BEFORE showing any UI
      const roles = getUserRoles(accessToken);
      const isAdmin = roles.includes('ADMIN');
      const hasFaculty = hasFacultyAssignedPermission(getInstituteId());
    const roleKey = getActiveRoleDisplaySettingsKey();

      let ds: { postLoginRedirectRoute?: string } | null = null;
      const maxRetries = 3;
      let retry = 0;

      while (retry < maxRetries && !ds) {
        try {
          ds = await getDisplaySettings(roleKey, true);
        } catch (e) {
          retry += 1;
          if (retry >= maxRetries) {
            ds = getDisplaySettingsFromCache(roleKey);
            break;
          }
          const delay = Math.pow(2, retry - 1) * 500;
          await new Promise((r) => setTimeout(r, delay));
        }
      }

      const redirectTo = ds?.postLoginRedirectRoute || '/dashboard';

      // 3) Navigate to the post-login route with a single loader experience
      navigate({ to: redirectTo, replace: true });
    };

    void run();
  }, [navigate]);

  return <DashboardLoader />;
}
