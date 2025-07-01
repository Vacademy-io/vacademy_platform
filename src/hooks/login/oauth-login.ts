import { toast } from 'sonner';
import { setTokenInStorage, isTokenExpired } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';

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
    toast.error('No account linked with this GitHub profile. Please sign up first.', {
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
