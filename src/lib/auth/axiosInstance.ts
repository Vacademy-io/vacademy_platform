import { Preferences } from "@capacitor/preferences";
import { TokenKey } from "@/constants/auth/tokens";
import axios from "axios";
import { isTokenExpired, removeTokensAndLogout, getTokenFromStorage } from "./sessionUtility"; // Utility for JWT expiration checks
import { REFRESH_TOKEN_URL } from "@/constants/urls";
import { maybeServeFromCache, maybeStoreInCache } from "@/lib/http/clientCache";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";

const removeTokensAndInstituteId = async () => {
  await Preferences.remove({ key: TokenKey.accessToken });
  await Preferences.remove({ key: TokenKey.refreshToken });
  await Preferences.remove({ key: "instituteId" });
  await Preferences.remove({ key: "InstituteId" });
  Sentry.logger.info("[Auth] Removed tokens and institute ID from storage.");
};

const refreshTokens = async (refreshToken: string): Promise<void> => {
  try {
    const response = await axios.post(REFRESH_TOKEN_URL, { refreshToken });
    const {
      accessToken,
      refreshToken: newRefreshToken,
      instituteId,
    } = response.data;
    // Store the new tokens and institute ID
    await Preferences.set({ key: TokenKey.accessToken, value: accessToken });
    await Preferences.set({
      key: TokenKey.refreshToken,
      value: newRefreshToken,
    });
    if (instituteId) {
      await Preferences.set({ key: "instituteId", value: instituteId });
      await Preferences.set({ key: "InstituteId", value: instituteId });
    }
  } catch (error) {
    console.error("[Auth] Failed to refresh tokens:", error);
    toast.error("Session expired. Please log in again.");
    removeTokensAndLogout();
  }
};

// Create an instance of Axios
const authenticatedAxiosInstance = axios.create({
  // Optional base configuration can be added here
  // For example: baseURL, timeout, etc.
  headers: {
    clientId: "",
  },
});

// Request interceptor: gets called before every request
authenticatedAxiosInstance.interceptors.request.use(
  async (request) => {
    const requestUrl = String(request.url || "");
    const isPublicDomainRouting = requestUrl.includes(
      "/public/domain-routing/"
    );
    const isOpenEndpoint = requestUrl.includes("/open/");

    // For public/open endpoints, do not attach auth or perform refresh logic
    if (isPublicDomainRouting || isOpenEndpoint) {
      try {
        let instituteId = await getTokenFromStorage("InstituteId");
        if (!instituteId) {
          instituteId = await getTokenFromStorage("instituteId");
        }
        if (instituteId) {
          request.headers["clientId"] = instituteId;
          request.headers["X-Institute-Id"] = instituteId;
        }

        // Attempt to attach local token if available, but do not force refresh/logout logic
        const accessToken = await getTokenFromStorage(TokenKey.accessToken);
        if (accessToken && !isTokenExpired(accessToken)) {
            request.headers["Authorization"] = `Bearer ${accessToken}`;
        }
      } catch {
        // no-op
      }
      request = maybeServeFromCache(request);
      return request;
    }

    const accessToken = await getTokenFromStorage(TokenKey.accessToken);
    let instituteId = await getTokenFromStorage("InstituteId");
    if (!instituteId) {
      instituteId = await getTokenFromStorage("instituteId");
    }
    // Attempt to populate user and package session for Vary-aware caching
    try {
      const studentDetailsStr = await Preferences.get({
        key: "StudentDetails",
      });
      if (studentDetailsStr?.value) {
        const student = JSON.parse(studentDetailsStr.value);
        const userId = student?.user_id || student?.userId;
        const packageSessionId =
          student?.package_session_id || student?.packageSessionId;
        if (userId) {
          request.headers["X-User-Id"] = String(userId);
        }
        if (packageSessionId) {
          request.headers["X-Package-Session-Id"] = String(packageSessionId);
        }
      }
    } catch {
      // no-op
    }

    // Add instituteId to headers if available
    if (instituteId) {
      request.headers["clientId"] = instituteId;
      request.headers["X-Institute-Id"] = instituteId;
    }

    // Check if the access token is expired
    const isExpired = isTokenExpired(accessToken);

    if (!isExpired) {
      request.headers.Authorization = `Bearer ${accessToken}`;
      // Serve from client cache for GET when possible
      request = maybeServeFromCache(request);
      return request;
    } else {
      // If the access token is expired, refresh it
      const refreshToken = await getTokenFromStorage(TokenKey.refreshToken);
      try {
        if (!refreshToken) throw new Error("No refresh token found");

        // Refresh tokens
        await refreshTokens(refreshToken);

        // Get the new access token after refresh
        const newAccessToken = await getTokenFromStorage(TokenKey.accessToken);
        request.headers["Authorization"] = `Bearer ${newAccessToken}`;
        // Serve from client cache for GET when possible
        request = maybeServeFromCache(request);
        return request;
      } catch (err) {
        Sentry.logger.warn(
          Sentry.logger
            .fmt`[Auth] Token refresh failed for request to '${requestUrl}'`,
          { error: err }
        );
        // If token refresh fails, remove tokens and institute ID
        await removeTokensAndInstituteId();

        // Reject the request with an error indicating that the user is not authenticated
        return Promise.reject(new Error("Unauthorized"));
      }
    }
  },
  async (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle global error responses
authenticatedAxiosInstance.interceptors.response.use(
  (response) => {
    // Store successful GET responses in client cache per headers
    return maybeStoreInCache(response);
  },
  async (error) => {
    // Allow public domain routing errors to pass through without auth side-effects
    const requestUrl = String(error?.config?.url || "");
    const isPublicDomainRouting = requestUrl.includes(
      "/public/domain-routing/"
    );

    // Handle unauthorized errors (401)
    if (
      !isPublicDomainRouting &&
      error.response &&
      error.response.status === 401
    ) {
      console.warn("[Axios] Received 401 Unauthorized. Not performing auto-logout to avoid session recovery race conditions. Route guards will handle redirection if needed.");
    }

    // Handle forbidden errors (403) - might be token issues
    if (
      !isPublicDomainRouting &&
      error.response &&
      error.response.status === 403
    ) {
      // Handle 403 errors silently
    }

    return Promise.reject(error);
  }
);

export default authenticatedAxiosInstance;
