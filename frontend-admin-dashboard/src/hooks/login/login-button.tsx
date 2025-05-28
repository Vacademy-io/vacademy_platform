import { z } from "zod";
import { LOGIN_URL } from "@/constants/urls";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";

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
});

// Dummy login function
async function loginUser(
    username: string,
    password: string,
): Promise<z.infer<typeof loginResponseSchema>> {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
    const response = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            user_name: username,
            password: password,
            client_name: "ADMIN_PORTAL",
            institute_id: INSTITUTE_ID,
        }),
    });

    if (!response.ok) {
        throw new Error("Login failed");
    }

    return response.json();
}

export { loginUser, loginRequestSchema, loginResponseSchema };
