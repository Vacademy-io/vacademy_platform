import React, { useEffect } from 'react';
import {
    handleSSOLogin,
    getTokenFromCookie,
    getUserRoles,
    canAccessLearnerPlatform,
} from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

interface SSOHandlerProps {
    children: React.ReactNode;
    onAuthenticationChange?: (isAuthenticated: boolean) => void;
}

export function SSOHandler({ children, onAuthenticationChange }: SSOHandlerProps) {
    useEffect(() => {
        // Check for SSO login from URL parameters
        const ssoLoginSuccess = handleSSOLogin();

        if (ssoLoginSuccess) {
            console.log('SSO login successful');
            onAuthenticationChange?.(true);
            return;
        }

        // Check if user is already authenticated
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        if (accessToken) {
            const userRoles = getUserRoles(accessToken);
            const canAccess = canAccessLearnerPlatform(accessToken);

            console.log('Existing authentication found:', {
                hasToken: !!accessToken,
                userRoles,
                canAccessLearner: canAccess,
            });

            if (canAccess) {
                onAuthenticationChange?.(true);
            } else {
                console.log('User does not have STUDENT role, redirecting to admin dashboard');
                window.location.href = `https://${import.meta.env.VITE_ADMIN_DOMAIN}`;
            }
        } else {
            onAuthenticationChange?.(false);
        }
    }, [onAuthenticationChange]);

    return <>{children}</>;
}

// Hook for using SSO functionality in components
export function useSSO() {
    const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);
    const [userRoles, setUserRoles] = React.useState<string[]>([]);

    useEffect(() => {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        if (accessToken) {
            const roles = getUserRoles(accessToken);
            const canAccessLearner = canAccessLearnerPlatform(accessToken);

            setUserRoles(roles);
            setIsAuthenticated(canAccessLearner);
        } else {
            setIsAuthenticated(false);
            setUserRoles([]);
        }
    }, []);

    const redirectToAdminDashboard = () => {
        window.location.href = `https://${import.meta.env.VITE_ADMIN_DOMAIN}`;
    };

    const hasRole = (role: string) => userRoles.includes(role);

    return {
        isAuthenticated,
        userRoles,
        hasRole,
        redirectToAdminDashboard,
        canAccessLearner: isAuthenticated,
    };
}
