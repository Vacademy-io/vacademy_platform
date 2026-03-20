import { toast } from 'sonner';

export type OAuthProvider = 'google' | 'github';

interface OAuthLoginOptions {
    isSignup?: boolean;
    assess?: boolean;
    lms?: boolean;
}

export const handleOAuthLogin = (provider: OAuthProvider, options: OAuthLoginOptions = {}) => {
    try {
        const { isSignup = false, assess = false, lms = false } = options;

        const stateObj = {
            from: `${window.location.origin}/login/oauth/redirect?assess=${assess}&lms=${lms}`,
            account_type: isSignup ? 'signup' : 'login',
            user_type: 'admin',
        };

        const base64State = btoa(JSON.stringify(stateObj));

        const loginUrl = `${import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io'}/auth-service/oauth2/authorization/${provider}?state=${encodeURIComponent(
            base64State
        )}`;

        window.location.href = loginUrl;
    } catch (error) {
        toast.error('Failed to initiate login. Please try again.');
    }
};
import { handleLoginFlow } from '@/lib/auth/loginFlowHandler';

export const handleLoginOAuthCallback = async () => {
    try {
        const urlParams = new URLSearchParams(window.location.search);

        const error = urlParams.get('error');
        const message = urlParams.get('message');
        const stateEncoded = urlParams.get('state');
        const accessToken = urlParams.get('accessToken');
        const refreshToken = urlParams.get('refreshToken');

        if (error === 'true' || message) {
            const errorMsg = message || 'OAuth Authentication failed.';
            toast.error('OAuth Login Failed', {
                description: decodeURIComponent(errorMsg),
                duration: 5000,
            });

            return { success: false };
        }

        if (accessToken && refreshToken) {
            // Use centralized login flow
            const result = await handleLoginFlow({
                loginMethod: 'oauth',
                accessToken,
                refreshToken,
            });

            if (!result.success) {
                // User was blocked or error occurred
                setTimeout(() => {
                    window.location.href = '/login?error=student_access_denied';
                }, 2000);
                return { success: false };
            }

            if (result.shouldShowInstituteSelection) {
                return { success: true, shouldShowInstituteSelection: true };
            }

            // Determine redirect URL
            let redirectUrl = result.redirectUrl || '/dashboard';

            if (stateEncoded) {
                try {
                    const decodedState = JSON.parse(atob(decodeURIComponent(stateEncoded)));

                    if (decodedState?.from) {
                        redirectUrl = decodedState.from;
                    }
                } catch (err) {
                    // Failed to decode state, using fallback redirect
                }
            }

            return { success: true, redirectUrl };
        }

        toast.error('Login failed. Missing tokens.');
        return { success: false };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
};
