import { createFileRoute, redirect } from '@tanstack/react-router';
import { getTokenFromCookie, isTokenExpired } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

export const Route = createFileRoute('/vim/')({
    beforeLoad: () => {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const refreshToken = getTokenFromCookie(TokenKey.refreshToken);
        const authed = accessToken && refreshToken && !isTokenExpired(accessToken);
        throw redirect({ to: authed ? '/vim/dashboard' : '/vim/onboarding' });
    },
});
