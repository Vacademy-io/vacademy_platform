import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginForm } from '@/features/vimotion/auth/LoginForm';
import { getTokenFromCookie, isTokenExpired } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

export const Route = createFileRoute('/vim/login')({
    beforeLoad: () => {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const refreshToken = getTokenFromCookie(TokenKey.refreshToken);
        if (accessToken && refreshToken && !isTokenExpired(accessToken)) {
            throw redirect({ to: '/vim/dashboard' });
        }
    },
    component: LoginForm,
});
