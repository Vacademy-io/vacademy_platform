import { TokenKey } from "@/constants/auth/tokens";
import axios from "axios";
import {
    getTokenFromCookie,
    isTokenExpired,
    refreshTokens,
    removeCookiesAndLogout,
} from "./sessionUtility";

// Create an instance of Axios
const authenticatedAxiosInstance = axios.create();

// Request interceptor: gets called before every request
authenticatedAxiosInstance.interceptors.request.use(
    async (request) => {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        // After token is either retrieved or refreshed, add it to the request headers
        request.headers.Authorization = `Bearer ${accessToken}`;
        // Check if the access token is expired
        if (!isTokenExpired(accessToken)) {
            // If the access token is not expired, proceed with the request
            return request;
        } else {
            // If the access token is expired, refresh the token
            const refreshToken = getTokenFromCookie(TokenKey.refreshToken);
            // Refresh the access token using the refresh token
            try {
                // Await the refreshTokens function
                await refreshTokens(refreshToken ?? "");
                // Retry the original request
                return request;
            } catch (error) {
                console.error("Error refreshing token: Logging out ...", error);
                // If token refresh fails, log the user out
                removeCookiesAndLogout();
                // Reject the request with an error indicating that the user is not authenticated
                return await Promise.reject(new Error("Unauthorized"));
            }
        }
    },

    async (error) => {
        // eslint-disable-next-line
        return await Promise.reject(error);
    },
);

export default authenticatedAxiosInstance;
