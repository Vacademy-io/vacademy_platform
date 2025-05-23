import { z } from "zod";

// Define the request and response schemas using Zod
const forgotPasswordRequestSchema = z.object({
    email: z.string().email(),
});

const forgotPasswordResponseSchema = z.object({
    status: z.enum(["success", "error"]),
    message: z.string().optional(),
});

// Dummy forgot password function
async function forgotPassword(
    email: string,
): Promise<z.infer<typeof forgotPasswordResponseSchema>> {
    // Validate the input using the request schema
    const { email: validEmail } = forgotPasswordRequestSchema.parse({ email });

    // Simulate a successful forgot password request
    if (validEmail === "test@example.com") {
        return {
            status: "success",
        };
    }

    // Simulate a failed forgot password request
    return {
        status: "error",
        message: "Invalid email address",
    };
}

export { forgotPassword, forgotPasswordRequestSchema, forgotPasswordResponseSchema };
