import { z } from "zod";

// Define the schema for a single role
const roleSchema = z.object({
    roleId: z.string(), // Assuming roleId is always a string
    roleName: z.string(), // Assuming roleName is always a string
});

// Define the schema for a single user
const userSchema = z.object({
    userId: z.string(), // Assuming userId is always a string
    email: z.string().email(), // Email validation
    name: z.string(),
    roles: z.array(roleSchema),
    status: z.string(),
});

// Define the schema for the entire object
export const AccessControlFormSchema = z.object({
    status: z.string(),
    assessment_creation_access: z.array(userSchema),
    live_assessment_notification: z.array(userSchema),
    assessment_submission_and_report_access: z.array(userSchema),
    evaluation_process: z.array(userSchema),
});
