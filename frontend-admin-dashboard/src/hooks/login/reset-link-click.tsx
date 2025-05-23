import { z } from "zod";

// Define the response schema using Zod
const sendResetLinkResponseSchema = z.object({
    status: z.enum(["success", "error"]),
    message: z.string().optional(),
});

// Dummy send reset link function
async function sendResetLink(): Promise<z.infer<typeof sendResetLinkResponseSchema>> {
    // Simulate a successful reset link request
    return {
        status: "success",
    };

    // Uncomment the following to simulate a failed reset link request
    // return {
    //   status: 'error',
    //   message: 'Failed to send reset link',
    // };
}

export { sendResetLink, sendResetLinkResponseSchema };
