import { TokenKey } from '@/constants/auth/tokens';
import axios from 'axios';
import {
    getTokenFromCookie,
    isTokenExpired,
    refreshTokens,
    removeCookiesAndLogout,
    debugTokenStatus,
} from './sessionUtility';

const authenticatedAxiosInstance = axios.create();

// Debug function that can be called from browser console
const debugAuthStatus = () => {
    debugTokenStatus();
};

// Attach debug function to window for console access
if (typeof window !== 'undefined') {
    (window as any).debugAuth = debugAuthStatus;
}

authenticatedAxiosInstance.interceptors.request.use(
    async (request) => {
        let accessToken = getTokenFromCookie(TokenKey.accessToken);

        if (!accessToken) {
            console.error('[Axios Request] No access token found');
            removeCookiesAndLogout();
            return Promise.reject(new Error('No access token found'));
        }

        if (isTokenExpired(accessToken)) {
            const refreshToken = getTokenFromCookie(TokenKey.refreshToken);

            if (!refreshToken) {
                console.error('[Axios Request] No refresh token found');
                removeCookiesAndLogout();
                return Promise.reject(new Error('Refresh token missing or expired'));
            }

            try {
                await refreshTokens(refreshToken); // This should also update the cookies
                accessToken = getTokenFromCookie(TokenKey.accessToken); // Get the new token
            } catch (error) {
                console.error('[Axios Request] Token refresh failed:', error);
                removeCookiesAndLogout();
                return Promise.reject(new Error('Token refresh failed'));
            }
        }

        // Now that token is valid, attach it to headers
        request.headers.Authorization = `Bearer ${accessToken}`;
        return request;
    },

    async (error) => {
        console.error('[Axios Request] Request interceptor error:', error);
        return Promise.reject(error);
    }
);

// Add response interceptor to handle authentication errors
authenticatedAxiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const { response } = error;

        // Only log non-403 errors to reduce noise
        if (response?.status !== 403) {
            console.error('[Axios Response] Request failed:', {
                url: error.config?.url,
                status: response?.status,
                statusText: response?.statusText,
                data: response?.data,
            });
        }

        // Handle 511 Network Authentication Required
        if (response?.status === 511) {
            const responseData = response?.data;

            // Check if it's actually a backend error message disguised as 511
            // Sometimes backend returns 511 for business logic errors which should NOT log the user out
            if (responseData && (responseData.ex || responseData.responseCode)) {
                console.warn('[Axios Response] 511 Error with backend exception details - NOT logging out:', responseData);
                // Return the error as is so the calling service can handle the specific error message
                return Promise.reject(error);
            }

            console.error(
                '[Axios Response] 511 Network Authentication Required - Token may be invalid or expired'
            );
            console.error('[Axios Response] Response data:', response.data);
            console.error('[Axios Response] Running auth debug...');
            debugAuthStatus();
            removeCookiesAndLogout();
            return Promise.reject(
                new Error('Network authentication required. Please log in again.')
            );
        }

        // Handle 401 Unauthorized
        if (response?.status === 401) {
            console.error('[Axios Response] 401 Unauthorized - Token is invalid');
            console.error('[Axios Response] Response data:', response.data);
            removeCookiesAndLogout();
            return Promise.reject(new Error('Authentication failed. Please log in again.'));
        }

        // Handle 403 Forbidden
        if (response?.status === 403) {
            // Don't log 403 errors as they're expected for some institute details requests
            return Promise.reject(new Error('You do not have permission to perform this action.'));
        }

        // Handle other authentication-related errors
        if (response?.status >= 500 && response?.status < 600) {
            console.error(`[Axios Response] Server error ${response.status}:`, response.data);
            return Promise.reject(new Error('Server error. Please try again later.'));
        }

        return Promise.reject(error);
    }
);

export default authenticatedAxiosInstance;
