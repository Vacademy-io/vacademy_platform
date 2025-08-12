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

// Dummy login function
async function loginUser(
    username: string,
    password: string,
): Promise<z.infer<typeof loginResponseSchema>> {
    const response = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            user_name: username,
            password: password,
            client_name: "ADMIN_PORTAL",
            // institute_id: INSTITUTE_ID,
        }),
    });

    if (!response.ok) {
        throw new Error("Login failed");
    }

    const tokenData = await response.json();

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
