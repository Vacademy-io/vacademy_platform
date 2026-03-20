import { verifyEmailWithOtp } from '@/components/common/LoginPages/VerifyEmailWithOtp';
import { toast } from 'sonner';

export type OAuthProvider = 'google' | 'github';
interface OAuthLoginOptions {
    isSignup?: boolean;
    assess?: boolean;
    lms?: boolean;
    volt?: boolean;
    vsmart?: boolean;
}

export const handleOAuthSignUp = (provider: OAuthProvider, options: OAuthLoginOptions = {}) => {
    try {
        const { isSignup = true, assess = false, lms = false } = options;

        const stateObj = {
            from: `${window.location.origin}/signup/oauth/callback?assess=${assess}&lms=${lms}`,
            account_type: isSignup ? 'signup' : 'login',
            user_type: 'admin',
        };

        const base64State = btoa(JSON.stringify(stateObj));
        const loginUrl = `${import.meta.env.VITE_BACKEND_URL || 'https://backend-stage.vacademy.io'}/auth-service/oauth2/authorization/${provider}?state=${encodeURIComponent(
            base64State
        )}`;

        // console.log('[OAuthLogin] Redirecting to:', loginUrl);
        // console.log('[OAuthLogin] State object:', stateObj);

        window.location.href = loginUrl;
    } catch (error) {
        // console.error('[OAuthLogin] Error during OAuth login initiation:', error);
        toast.error('Failed to initiate login. Please try again.');
    }
};

export const handleOAuthCallback = async () => {
    // console.log('[OAuthCallback] Starting OAuth callback handling...');

    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const signupData = urlParams.get('signupData');
    const state = urlParams.get('state');
    const emailVerified = urlParams.get('emailVerified') === 'true';

    // console.log('[OAuthCallback] Params:', {
    //     error,
    //     signupData,
    //     state,
    //     emailVerified,
    // });

    if (error) {
        toast.error('Authentication failed', {
            description: error,
            duration: 3000,
        });
        // console.error('[OAuthCallback] OAuth error param found:', error);
        return { success: false };
    }

    if (!emailVerified && signupData) {
        // console.log('[OAuthCallback] Email not verified. Attempting to decode signup data...');
        try {
            const decodedData = JSON.parse(atob(decodeURIComponent(signupData)));
            const email = decodedData?.email;

            console.log('[OAuthCallback] Decoded signup data:', decodedData);

            const isInvalidEmail =
                !email || email === 'null' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

            if (isInvalidEmail) {
                console.warn(
                    '[OAuthCallback] Invalid or missing email. Prompting for verification...'
                );
                const verifiedEmail = await verifyEmailWithOtp();

                if (verifiedEmail) {
                    console.log('[OAuthCallback] Email verified through OTP. Proceeding...');
                    return {
                        success: true,
                        signupData: {
                            ...decodedData,
                            email: verifiedEmail, // ✅ Use the actual verified email
                        },
                        state,
                    };
                } else {
                    console.warn('[OAuthCallback] Email verification failed or was cancelled.');
                    return { success: false };
                }
            } else {
                console.warn('[OAuthCallback] Email is valid but emailVerified flag was false.');
            }
        } catch (e) {
            // console.error('[OAuthCallback] Error decoding signupData:', e);
            return { success: false };
        }
    }

    if (emailVerified && signupData) {
        try {
            const decodedData = JSON.parse(atob(decodeURIComponent(signupData)));
            // console.log(
            //     '[OAuthCallback] Email already verified. Proceeding with signup data:',
            //     decodedData
            // );

            return {
                success: true,
                signupData: decodedData,
                state,
            };
        } catch (e) {
            // console.error('[OAuthCallback] Error decoding verified signupData:', e);
            return { success: false };
        }
    }

    return { success: false };
};
