import { toast } from 'sonner';
import { setTokenInStorage, isTokenExpired } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

// export type OAuthProvider = 'google' | 'github';


// export const handleOAuthLogin = (
//   provider: OAuthProvider
// ) => {
//   console.log("handleOathLogin Called");
//   try {
//     const stateObj = {
//       from: `${window.location.origin}/login/oauth/redirect?`};
//     const base64State = btoa(JSON.stringify(stateObj));

//     const loginUrl = `https://backend-stage.vacademy.io/auth-service/oauth2/authorization/${provider}?state=${encodeURIComponent(
//       base64State
//     )}`;

//     console.log('[OAuthLogin] Redirecting to:', loginUrl);
//     window.location.href = loginUrl;
//   } catch (error) {
//     console.error('[OAuthLogin] Error during OAuth login initiation:', error);
//     toast.error('Failed to initiate login. Please try again.');
//   }
// };

export const handleLoginOAuthCallback = async () => {
  const urlParams = new URLSearchParams(window.location.search);
 console.log("we are in handle LoginAuthcall")
  const error = urlParams.get('error');
  const message = urlParams.get('message');
  const stateEncoded = urlParams.get('state');
  const accessToken = urlParams.get('accessToken');
  const refreshToken = urlParams.get('refreshToken');

  console.log('[OAuthCallback] URL Params:', {
    error,
    message,
    stateEncoded,
    accessToken,
    refreshToken,
  });

  if (error === 'true' || message) {
    const errorMsg = message || 'OAuth Authentication failed.';
    toast.error('OAuth Login Failed', {
      description: decodeURIComponent(errorMsg),
      duration: 5000,
    });
    return { success: false };
  }

  let redirectUrl = '/dashboard';

  if (stateEncoded) {
    try {
      const decodedState = JSON.parse(atob(decodeURIComponent(stateEncoded)));
      console.log('[OAuthCallback] Decoded state:', decodedState);
      if (decodedState?.from) {
        redirectUrl = decodedState.from;
      }
    } catch (err) {
      console.warn('[OAuthCallback] Failed to decode state. Using fallback redirect:', err);
    }
  }

  if (accessToken && refreshToken) {
    if (isTokenExpired(accessToken)) {
      toast.error('Login failed. Access token is expired.');
      return { success: false };
    }

    try {
      await setTokenInStorage(TokenKey.accessToken, accessToken);
      await setTokenInStorage(TokenKey.refreshToken, refreshToken);

      // Clean up query params
      window.history.replaceState({}, document.title, redirectUrl);
      window.location.href = redirectUrl;
      return { success: true };
    } catch (err) {
      toast.error('Failed to store tokens.');
      console.error('[OAuthCallback] Token storage error:', err);
      return { success: false };
    }
  }

  toast.error('Login failed. Missing tokens.');
  console.warn('[OAuthCallback] Tokens missing in URL.');
  return { success: false };
};
