import { Preferences } from "@capacitor/preferences";
import {
    setTokenInStorage,
    setAuthorizationCookie,
    getTokenDecodedData,
    setInstituteIdInStorage
} from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";
import { getStudentDisplaySettings } from "@/services/student-display-settings";
import { loginEnrolledUser } from "@/services/signup-api";
import { HOLISTIC_INSTITUTE_ID } from "@/constants/urls";

export interface LoginResponse {
    accessToken: string;
    refreshToken: string;
    user?: {
        id: string;
        username: string;
        email: string;
        full_name: string;
        roles: string[];
    };
}

/**
 * Performs a complete authentication cycle:
 * 1. Stores access and refresh tokens in Preferences and Cookies.
 * 2. Decodes the token to find the User ID.
 * 3. Fetches and stores Institute and Student details in local storage.
 * 4. Loads student display settings for the dashboard.
 */
export const performFullAuthCycle = async (
    loginResponse: LoginResponse,
    instituteId: string
) => {
    console.log("[AuthCycle] Starting full auth cycle");

    // 1. Store tokens
    await setTokenInStorage(TokenKey.accessToken, loginResponse.accessToken);
    await setTokenInStorage(TokenKey.refreshToken, loginResponse.refreshToken);
    setAuthorizationCookie(TokenKey.accessToken, loginResponse.accessToken);
    setAuthorizationCookie(TokenKey.refreshToken, loginResponse.refreshToken);

    // 2. Decode token to get userId
    const decodedData = getTokenDecodedData(loginResponse.accessToken);
    const userId = decodedData?.user;

    if (userId) {
        console.log("[AuthCycle] Populating user and institute details for:", userId);

        // 3. Store InstituteId in storage and cookies
        await setInstituteIdInStorage("InstituteId", instituteId);
        await setInstituteIdInStorage("instituteId", instituteId);

        // 4. Create a robust fallback user from the token if not provided in loginResponse
        const fallbackUser = loginResponse.user || {
            id: userId,
            username: decodedData?.username || "Learner",
            email: decodedData?.email || "",
            full_name: decodedData?.username || "Learner",
            roles: []
        };

        // 5. OPTIMISTIC HYDRATION: Store minimal details immediately to pass isAuthenticated() checks
        // This prevents race conditions where guards run before background fetches complete.
        console.log("[AuthCycle] Performing optimistic hydration");
        const minimalStudent = {
            id: userId,
            user_id: userId,
            username: fallbackUser.username,
            email: fallbackUser.email,
            full_name: fallbackUser.full_name,
            institute_id: instituteId,
            status: "ACTIVE"
        };
        const minimalInstitute = {
            id: instituteId,
            institute_name: "Loading...",
            institute_theme_code: "#000000"
        };

        await Preferences.set({ key: "StudentDetails", value: JSON.stringify(minimalStudent) });
        await Preferences.set({ key: "InstituteDetails", value: JSON.stringify(minimalInstitute) });

        // Also store in localStorage for consistency
        try {
            localStorage.setItem("StudentDetails", JSON.stringify(minimalStudent));
            localStorage.setItem("InstituteDetails", JSON.stringify(minimalInstitute));
        } catch (error) {
            console.warn("[AuthCycle] Failed to write minimal details to localStorage:", error);
        }

        // 6. Background Fetch: Hydrate with real data from APIs
        // Since we've already set the minimal data, these failing won't trigger a logout.
        try {
            await fetchAndStoreInstituteDetails(instituteId, userId);
        } catch (e) {
            console.warn("[AuthCycle] background fetchAndStoreInstituteDetails failed", e);
        }

        try {
            await fetchAndStoreStudentDetails(instituteId, userId, fallbackUser);
        } catch (e) {
            console.warn("[AuthCycle] background fetchAndStoreStudentDetails failed", e);
        }

        // 7. Load display settings
        try {
            await getStudentDisplaySettings(true, instituteId);
        } catch (e) {
            console.warn("[AuthCycle] Failed to load display settings:", e);
        }
    }

    console.log("[AuthCycle] Auth cycle complete");
};

/**
 * Checks localStorage for pending session data (tokens or credentials)
 * and attempts to recover the session. This is useful for post-payment
 * redirects where the user might not be authenticated yet.
 */
export const checkAndRecoverSession = async (instituteId?: string) => {
    // 1. Try to get tokens from "pending" storage first (from redirect)
    let accessToken = localStorage.getItem("pendingAccessToken");
    let refreshToken = localStorage.getItem("pendingRefreshToken");

    // 2. Fallback: If no pending tokens, check shared Storage and browser Cookies
    const { getTokenFromStorage } = await import("@/lib/auth/sessionUtility");
    if (!accessToken) {
        accessToken = await getTokenFromStorage(TokenKey.accessToken);
    }
    if (!refreshToken) {
        refreshToken = await getTokenFromStorage(TokenKey.refreshToken);
    }

    const pendingUsername = localStorage.getItem("pendingUsername");
    const pendingPassword = localStorage.getItem("pendingUserPassword");
    const pendingInstituteId = localStorage.getItem("pendingInstituteId");

    // 3. Determine if we actually HAVE enough to proceed
    const hasTokens = !!(accessToken && refreshToken);
    const hasCreds = !!(pendingUsername && pendingPassword);

    if (!hasTokens && !hasCreds) {
        return false;
    }

    // 4. Resolve Institute ID
    let targetInstituteId: string | undefined = pendingInstituteId || undefined;
    if (!targetInstituteId && instituteId && !["dashboard", "login", "courses", "signup"].includes(instituteId)) {
        targetInstituteId = instituteId;
    }

    // Fallback: decode from token
    if (!targetInstituteId && accessToken) {
        try {
            const decoded = getTokenDecodedData(accessToken);
            targetInstituteId = decoded?.authorities ? Object.keys(decoded.authorities)[0] : undefined;
            console.log("[AuthCycle] Resolved instituteId from token:", targetInstituteId);
        } catch (e) {
            console.warn("[AuthCycle] Failed to decode token for instituteId fallback", e);
        }
    }

    if (!targetInstituteId) {
        console.warn("[AuthCycle] Failed to resolve instituteId definitively. Falling back to HOLISTIC_INSTITUTE_ID.");
        targetInstituteId = HOLISTIC_INSTITUTE_ID;
    }

    // 5. Special Case: If we have tokens in cookies/storage, check if we actually NEED to recover details
    // (This avoids unnecessary auth cycles if the session is already fully established)
    if (hasTokens && !localStorage.getItem("pendingAccessToken")) {
        const studentDetails = await Preferences.get({ key: "StudentDetails" });
        const instituteDetails = await Preferences.get({ key: "InstituteDetails" });

        if (studentDetails.value && instituteDetails.value) {
            console.log("[AuthCycle] Session established and details present. Recovery not needed.");
            return true;
        }
    }

    console.log("[AuthCycle] Session recovery triggered", {
        method: hasTokens ? "via tokens (priority)" : "via credentials",
        instituteId: targetInstituteId
    });

    try {
        if (hasTokens) {
            console.log("[AuthCycle] Recovering via tokens found in " +
                (localStorage.getItem("pendingAccessToken") ? "explicit pending storage" : "cookies/shared storage"));

            await performFullAuthCycle(
                { accessToken: accessToken as string, refreshToken: refreshToken as string },
                targetInstituteId as string
            );
        } else if (hasCreds) {
            console.log("[AuthCycle] Recovering via pending credentials");
            const loginResponse = await loginEnrolledUser(
                pendingUsername as string,
                pendingPassword as string,
                targetInstituteId as string
            );
            await performFullAuthCycle(loginResponse, targetInstituteId as string);
        }

        // Cleanup pending data
        localStorage.removeItem("pendingAccessToken");
        localStorage.removeItem("pendingRefreshToken");
        localStorage.removeItem("pendingUsername");
        localStorage.removeItem("pendingUserPassword");
        localStorage.removeItem("pendingInstituteId");

        console.log("[AuthCycle] Session recovered successfully");
        return true;
    } catch (error) {
        console.error("[AuthCycle] Session recovery failed:", error);
        return false;
    }
};
