import { z } from "zod";
import { LOGIN_URL } from "@/constants/urls";
import { Storage } from "@capacitor/storage";
import { TokenKey } from "@/constants/auth/tokens";
// import { INSTITUTE_ID } from "@/constants/urls";

// Define the request and response schemas using Zod
const loginRequestSchema = z.object({
    user_name: z.string(),
    password: z.string(),
    client_name: z.literal("ADMIN_PORTAL"),
    institute_id: z.string().uuid(),
});

const loginResponseSchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    instituteId: z.string(),
});

// Custom error for session limit exceeded
export class SessionLimitError extends Error {
    activeSessions: any[];
    constructor(activeSessions: any[]) {
        super("Session limit exceeded");
        this.name = "SessionLimitError";
        this.activeSessions = activeSessions;
    }
}

// Dummy login function
async function loginUser(
    username: string,
    password: string,
    convertToLowercase?: boolean | null,
): Promise<z.infer<typeof loginResponseSchema>> {
    // Convert username and password to lowercase if flag is true
    const finalUsername = convertToLowercase === true ? username.toLowerCase() : username;
    const finalPassword = convertToLowercase === true ? password.toLowerCase() : password;

    const response = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            user_name: finalUsername,
            password: finalPassword,
            client_name: "ADMIN_PORTAL",
            // institute_id: INSTITUTE_ID,
        }),
    });

    if (!response.ok) {
        throw new Error("Login failed");
    }

    const tokenData = await response.json();

    // Check for session limit exceeded BEFORE storing tokens
    if (tokenData.session_limit_exceeded === true) {
        throw new SessionLimitError(tokenData.active_sessions || []);
    }

    // --- BUG FIX: Save tokens and instituteId to storage ---
    try {
        await Storage.set({ key: TokenKey.accessToken, value: tokenData.accessToken });
        await Storage.set({ key: TokenKey.refreshToken, value: tokenData.refreshToken });
        await Storage.set({ key: "instituteId", value: tokenData.instituteId });
    } catch (error) {
        console.error("Error saving tokens to storage", error);
        // If we can't save tokens, the login is effectively failed.
        throw new Error("Failed to save session.");
    }

    return tokenData;
}

export { loginUser, loginRequestSchema, loginResponseSchema };
