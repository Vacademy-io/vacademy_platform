import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
    getTokenFromCookie,
    getUserRoles,
    canAccessAdminDashboard,
    canAccessLearnerPlatform,
    generateSSOUrl,
    handleSSOLogin,
    SSO_CONFIG,
} from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

interface SSOState {
    isAuthenticated: boolean;
    userRoles: string[];
    canAccessAdmin: boolean;
    canAccessLearner: boolean;
    isLoading: boolean;
}

export const useSSO = () => {
    const navigate = useNavigate();
    const [ssoState, setSSOState] = useState<SSOState>({
        isAuthenticated: false,
        userRoles: [],
        canAccessAdmin: false,
        canAccessLearner: false,
        isLoading: true,
    });

    useEffect(() => {
        const checkAuthStatus = () => {
            const accessToken = getTokenFromCookie(TokenKey.accessToken);

            if (!accessToken) {
                setSSOState({
                    isAuthenticated: false,
                    userRoles: [],
                    canAccessAdmin: false,
                    canAccessLearner: false,
                    isLoading: false,
                });
                return;
            }

            const userRoles = getUserRoles(accessToken);
            const canAccessAdmin = canAccessAdminDashboard(accessToken);
            const canAccessLearner = canAccessLearnerPlatform(accessToken);

            setSSOState({
                isAuthenticated: true,
                userRoles,
                canAccessAdmin,
                canAccessLearner,
                isLoading: false,
            });
        };

        // Check for SSO login first
        const ssoSuccess = handleSSOLogin();
        if (ssoSuccess) {
            // Re-check auth status after SSO login
            setTimeout(checkAuthStatus, 100);
        } else {
            checkAuthStatus();
        }
    }, []);

    const redirectToLearnerPlatform = (redirectPath?: string) => {
        const ssoUrl = generateSSOUrl(SSO_CONFIG.LEARNER_DOMAIN, redirectPath);
        if (ssoUrl) {
            window.location.href = ssoUrl;
        } else {
            window.location.href = `https://${SSO_CONFIG.LEARNER_DOMAIN}`;
        }
    };

    const redirectToAdminDashboard = (redirectPath?: string) => {
        const ssoUrl = generateSSOUrl(SSO_CONFIG.ADMIN_DOMAIN, redirectPath);
        if (ssoUrl) {
            window.location.href = ssoUrl;
        } else {
            window.location.href = `https://${SSO_CONFIG.ADMIN_DOMAIN}`;
        }
    };

    const handleRoleBasedRedirect = () => {
        const { canAccessAdmin, canAccessLearner } = ssoState;

        if (!ssoState.isAuthenticated) {
            navigate({ to: '/login' });
            return;
        }

        const currentDomain = window.location.hostname;

        // If on admin dashboard
        if (currentDomain === SSO_CONFIG.ADMIN_DOMAIN) {
            if (!canAccessAdmin && canAccessLearner) {
                // User only has STUDENT role, redirect to learner
                redirectToLearnerPlatform('/dashboard');
            }
        }

        // If on learner platform
        if (currentDomain === SSO_CONFIG.LEARNER_DOMAIN) {
            if (!canAccessLearner && canAccessAdmin) {
                // User doesn't have STUDENT role, redirect to admin
                redirectToAdminDashboard('/dashboard');
            }
        }
    };

    return {
        ...ssoState,
        redirectToLearnerPlatform,
        redirectToAdminDashboard,
        handleRoleBasedRedirect,
    };
};

export default useSSO;
