import { createFileRoute, redirect } from '@tanstack/react-router';
import { getTokenFromCookie, isTokenExpired } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { getVimotionConfig } from '@/features/vimotion/api/signup';

export const Route = createFileRoute('/vim/')({
    beforeLoad: async () => {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const refreshToken = getTokenFromCookie(TokenKey.refreshToken);
        const authed = accessToken && refreshToken && !isTokenExpired(accessToken);
        if (authed) throw redirect({ to: '/vim/dashboard' });

        // When invite-only is on, unauth users land on the waitlist; otherwise
        // the open onboarding flow. Fail closed (waitlist) if the config call
        // errors so a backend hiccup never silently opens up signup.
        // 3s timeout so a slow/down auth_service doesn't hang the bare /vim
        // URL on a blank page. Fail-closed: timeout/error → waitlist.
        let inviteOnly = true;
        try {
            const config = await getVimotionConfig(3000);
            inviteOnly = config.invite_only;
        } catch {
            inviteOnly = true;
        }
        throw redirect({ to: inviteOnly ? '/vim/waitlist' : '/vim/onboarding' });
    },
});
