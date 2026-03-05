import { z } from 'zod';

// Step One Schema - Profile Picture
export const stepOneSchema = z.object({
    profilePicture: z.union([z.string(), z.null(), z.undefined()]),
});

// Step Two Schema - Personal Details (System Fields + Custom Fields)
// This will be dynamically validated based on system fields from cache
export const stepTwoSchema = z.object({
    // Core mandatory fields (always required)
    full_name: z.string().min(1, 'Full name is required'),
    email: z.string().email('Invalid email format').optional().or(z.literal('')),
    mobile_number: z.string().min(1, 'Mobile number is required'),

    // Optional system fields (based on cache visibility)
    gender: z.string().optional(),
    date_of_birth: z.string().optional(),
    linked_institute_name: z.string().optional(), // College/School
    address_line: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional(), // state
    pin_code: z.string().optional(),

    // Parent/Guardian fields
    fathers_name: z.string().optional(),
    mothers_name: z.string().optional(),
    parents_email: z.string().email('Invalid email format').optional().or(z.literal('')),
    parents_mobile_number: z.string().optional(),
    parents_to_mother_email: z.string().email('Invalid email format').optional().or(z.literal('')),
    parents_to_mother_mobile_number: z.string().optional(),

    // Custom fields will be added dynamically
    custom_fields: z.record(z.string(), z.string()).optional(),
});

// Step Three Schema - Invite Selection Only
export const stepThreeSchema = z.object({
    invite: z.object({
        id: z.string().min(1, 'Please select an invite'),
        name: z.string(),
        payment_option_id: z.string().optional(), // Will be populated from API
        package_session_ids: z.array(z.string()).optional(), // Will be populated from API
        payment_plans: z.array(z.any()).optional(), // Payment plans from invite details
    }),
    enrollment_number: z.string().optional(),
    access_days: z.string().optional(),
    start_date: z.string().optional(), // Enrollment start date, defaults to today
});

// Step Four Schema - Payment Details (Plan selection only)
export const stepFourSchema = z.object({
    plan_id: z.string().min(1, 'Please select a payment plan'), // Required
    amount: z.string().min(1, 'Amount is required'), // Auto-filled from plan
    currency: z.string().min(1, 'Currency is required'), // Auto-filled from plan
    file_id: z.string().optional(), // payment proof file (optional)
    transaction_id: z.string().optional(), // transaction ID (optional)
});

// Step Five Schema - Credentials
export const stepFiveSchema = z.object({
    username: z.string().nonempty('Username is required'),
    password: z.string().min(4, {
        message: 'Password must be at least 4 characters',
    }),
});

// Type exports
export type StepOneData = z.infer<typeof stepOneSchema>;
export type StepTwoData = z.infer<typeof stepTwoSchema>;
export type StepThreeData = z.infer<typeof stepThreeSchema>;
export type StepFourData = z.infer<typeof stepFourSchema>;
export type StepFiveData = z.infer<typeof stepFiveSchema>;
