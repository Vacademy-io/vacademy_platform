import axios, { type AxiosResponse } from "axios";
import { Preferences as Storage } from "@capacitor/preferences";
import { jwtDecode } from "jwt-decode";
import { REFRESH_TOKEN_URL, TERMINATE_CURRENT_SESSION } from "@/constants/urls";
import { UnauthorizedResponse } from "@/constants/auth/unauthorizeresponse";
import { IAccessToken, TokenKey, Tokens } from "@/constants/auth/tokens";
import { isNullOrEmptyOrUndefined } from "../utils";
import Cookies from "js-cookie";
import { clearStudentDisplaySettingsCache } from "@/services/student-display-settings";
import { clearChatbotSettingsCache } from "@/services/chatbot-settings";

// Set token in cookie with domain support for cross-subdomain access
export const setAuthorizationCookie = (key: string, token: string): void => {
  // Do NOT set domain — let cookies scope to the exact hostname
  // so learner.vacademy.io and admin.vacademy.io stay independent
  Cookies.set(key, token, { expires: 7 });
};

// Get token from cookie
export const getTokenFromCookie = (tokenKey: string): string | null => {
  return Cookies.get(tokenKey) ?? null;
};

// Helper function to get a token from Capacitor Storage
const getTokenFromStorage = async (
  tokenKey: string
): Promise<string | null> => {
  // Try Capacitor Storage first
  const { value } = await Storage.get({ key: tokenKey });
  if (value) return value;

  // Fallback to localStorage only (cookies removed as per requirement)
  try {
    const localStorageValue = localStorage.getItem(tokenKey);
    if (localStorageValue) {
      console.log(
        `[SessionUtility] Token ${tokenKey} recovered from localStorage`
      );
      return localStorageValue;
    }
  } catch (error) {
    console.warn(`[SessionUtility] Failed to read from localStorage:`, error);
  }

  return null;
};

// Helper function to set a token in Capacitor Storage
const setTokenInStorage = async (key: string, token: string): Promise<void> => {
  // Store in Capacitor Preferences
  await Storage.set({
    key,
    value: token,
  });

  // Store in cookies for cross-subdomain access
  setAuthorizationCookie(key, token);

  // Also store in localStorage for synchronous access
  try {
    localStorage.setItem(key, token);
  } catch (error) {
    console.warn(`[SessionUtility] Failed to write to localStorage:`, error);
  }
};

// Helper function to remove a token from all storage locations
const removeTokenFromStorage = async (key: string): Promise<void> => {
  // Remove from Capacitor Storage
  await Storage.remove({ key });

  // Remove from cookies
  try {
    Cookies.remove(key);
    // Also remove any legacy cookies that were set on the shared parent domain
    Cookies.remove(key, { domain: ".vacademy.io" });
  } catch (error) {
    console.warn(`[SessionUtility] Failed to remove cookie:`, error);
  }

  // Remove from localStorage
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[SessionUtility] Failed to remove from localStorage:`, error);
  }
};

// Helper function to get institute ID from Capacitor Storage with localStorage fallback
const getInstituteIdFromStorage = async (
  tokenKey: string
): Promise<string | null> => {
  // Try Capacitor Storage first
  const { value } = await Storage.get({ key: tokenKey });
  if (value) return value;

  // Fallback to localStorage
  try {
    const localStorageValue = localStorage.getItem(tokenKey);
    if (localStorageValue) {
      console.log(
        `[SessionUtility] InstituteId ${tokenKey} recovered from localStorage`
      );
      return localStorageValue;
    }
  } catch (error) {
    console.warn(
      `[SessionUtility] Failed to read InstituteId from localStorage:`,
      error
    );
  }

  return null;
};

// Helper function to set institute ID in Capacitor Storage, Cookies, and localStorage
const setInstituteIdInStorage = async (
  key: string,
  id: string
): Promise<void> => {
  // Store in Capacitor Preferences
  await Storage.set({
    key,
    value: id,
  });

  // Also store in cookies (scoped to exact hostname, not shared domain)
  Cookies.set(key, id, { expires: 7 });

  // Also store in localStorage for synchronous access
  try {
    localStorage.setItem(key, id);
  } catch (error) {
    console.warn(
      `[SessionUtility] Failed to write InstituteId to localStorage:`,
      error
    );
  }
};

// function to remove institute ID from Capacitor Storage
const removeInstituteIdFromStorage = async (): Promise<void> => {
  await Storage.remove({ key: "instituteId" });
};

// Check if a token is expired
const isTokenExpired = (token: string | null): boolean => {
  if (isNullOrEmptyOrUndefined(token)) {
    return true;
  }

  const tokenData = jwtDecode(token);

  if (!isNullOrEmptyOrUndefined(tokenData.exp)) {
    const expirationTime = new Date(tokenData.exp * 1000); // Convert seconds to milliseconds
    return expirationTime <= new Date(); // Check if expiration time is less than or equal to current time
  } else {
    // Expiration time not found in token, consider it expired
    return true;
  }
};

// Decode token data
const getTokenDecodedData = (
  token: string | null
): IAccessToken | undefined => {
  if (isNullOrEmptyOrUndefined(token)) {
    return {
      user: "",
      email: "",
      is_root_user: false,
      authorities: {},
      username: "",
      sub: "",
      iat: 0,
      exp: 0,
    };
  }
  try {
    const tokenData: IAccessToken = jwtDecode(token);
    return tokenData;
  } catch (error) {
    console.warn("Failed to decode token:", error);
    return {
      user: "",
      email: "",
      is_root_user: false,
      authorities: {},
      username: "",
      sub: "",
      iat: 0,
      exp: 0,
    };
  }
};

// Refresh tokens
async function refreshTokens(
  refreshToken: string
): Promise<UnauthorizedResponse | Tokens> {
  const response: AxiosResponse<Tokens> = await axios({
    method: "GET",
    url: REFRESH_TOKEN_URL,
    params: { token: refreshToken },
  });

  // Store the new tokens in Capacitor Storage
  await setTokenInStorage(TokenKey.accessToken, response.data?.accessToken);
  await setTokenInStorage(TokenKey.refreshToken, response.data?.refreshToken);

  return response.data;
}

// Remove tokens from storage and log out
const removeTokensAndLogout = async (): Promise<void> => {
  // Terminate the current session in backend BEFORE clearing tokens
  try {
    const token = await getTokenFromStorage(TokenKey.accessToken);
    if (token) {
      await axios.post(TERMINATE_CURRENT_SESSION, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // Best-effort — don't block logout if session termination fails
  }

  // Remove tokens from all storage locations
  await removeTokenFromStorage(TokenKey.accessToken);
  await removeTokenFromStorage(TokenKey.refreshToken);
  clearStudentDisplaySettingsCache();
  clearChatbotSettingsCache();
  // Don't remove institute ID - keep it for comparison in courses
  // await removeInstituteIdFromStorage();

  // Remove all other items from Capacitor Storage except InstituteId
  const keys = await Storage.keys();
  for (const key of keys.keys) {
    if (key !== "InstituteId") {
      await Storage.remove({ key });
    }
  }

  // Also clear localStorage except InstituteId
  try {
    const keysToRemove = [
      "StudentDetails",
      "InstituteDetails",
      "students",
      "sessionList",
      "instituteBatchesForSessions",
      TokenKey.accessToken,
      TokenKey.refreshToken,
    ];

    keysToRemove.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove ${key} from localStorage:`, error);
      }
    });
  } catch (error) {
    console.warn("Failed to clear localStorage during logout:", error);
  }

  // Redirect to login or handle logout logic
  console.log("User logged out.");
};

// Get access token from storage
export const getAccessToken = async () => {
  const { value } = await Storage.get({ key: "accessToken" });
  return value;
};

// Get refresh token from storage
export const getRefreshToken = async () => {
  const { value } = await Storage.get({ key: "refreshToken" });
  return value;
};

// Decode the current access token from storage
export async function getDecodedAccessTokenFromStorage(): Promise<
  IAccessToken | undefined
> {
  const token = await getAccessToken();
  return getTokenDecodedData(token);
}

// Convenience helpers to get current user details from stored token
export async function getCurrentUserId(): Promise<string | null> {
  const decoded = await getDecodedAccessTokenFromStorage();
  return decoded?.user ?? null;
}

export async function getCurrentUsername(): Promise<string | null> {
  const decoded = await getDecodedAccessTokenFromStorage();
  return decoded?.username ?? null;
}

export async function getCurrentEmail(): Promise<string | null> {
  const decoded = await getDecodedAccessTokenFromStorage();
  return decoded?.email ?? null;
}

const handleSSOLogin = (): boolean => {
  const urlParams = new URLSearchParams(window.location.search);
  const isSSOLogin = urlParams.get("sso") === "true";
  if (!isSSOLogin) return false;

  const accessToken = urlParams.get("accessToken");
  const refreshToken = urlParams.get("refreshToken");
  const redirectPath = urlParams.get("redirect");
  try {
    if (accessToken && refreshToken && !isTokenExpired(accessToken)) {
      // Set tokens in cookies
      setTokenInStorage(TokenKey.accessToken, accessToken);
      setTokenInStorage(TokenKey.refreshToken, refreshToken);
      setAuthorizationCookie(TokenKey.accessToken, accessToken);
      setAuthorizationCookie(TokenKey.refreshToken, refreshToken);

      // Clean up URL
      const cleanUrl =
        window.location.pathname +
        (redirectPath ? `?redirect=${redirectPath}` : "");
      window.history.replaceState({}, document.title, cleanUrl);
      return true;
    } else {
      console.error("Decrypted tokens are invalid or expired");
      return false;
    }
  } catch (error) {
    console.error("Error decrypting SSO tokens:", error);
    return false;
  }
};

export {
  refreshTokens,
  removeTokensAndLogout,
  setTokenInStorage,
  getTokenFromStorage,
  isTokenExpired,
  getTokenDecodedData,
  // exports for institute ID management
  setInstituteIdInStorage,
  getInstituteIdFromStorage,
  removeInstituteIdFromStorage,
  handleSSOLogin,
};
