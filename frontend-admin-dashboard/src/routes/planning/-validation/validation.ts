import { z } from 'zod';

// Interval Type ID validation regex pattern
// Interval Type ID validation regex pattern
// Daily: YYYY-MM-DD
// Weekly: YYYY_D0X (day of week 1-7)
// Monthly: YYYY_MM_W0X (week of month 1-5)
// Yearly Month: YYYY_MXX (month 01-12)
// Yearly Quarter: YYYY_Q0X (quarter 1-4)
const INTERVAL_TYPE_ID_PATTERN = /^(\d{4}-\d{2}-\d{2}|\d{4}_D0[1-7]|\d{4}_\d{2}_W0[1-5]|\d{4}_M(0[1-9]|1[0-2])|\d{4}_Q0[1-4])$/;

export const intervalTypeIdSchema = z
    .string()
    .regex(
        INTERVAL_TYPE_ID_PATTERN,
        'Invalid interval_type_id format. Must match patterns like: 2024-11-26 (daily), 2024_D01 (weekly), 2024_01_W01 (monthly), 2024_M01 (yearly month), or 2024_Q01 (quarterly)'
    );

export const planningLogSchema = z.object({
    log_type: z.enum(['planning', 'diary'], {
        required_error: 'Log type is required',
    }),
    entity: z.literal('packageSession'),
    entity_id: z.string().min(1, 'Package session is required'),
    interval_type: z.enum(['daily', 'weekly', 'monthly', 'quarterly'], {
        required_error: 'Interval type is required',
    }),
    interval_type_id: intervalTypeIdSchema,
    title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
    description: z.string().optional(),
    content_html: z.string().min(1, 'Content is required'),
    subject_id: z.string().min(1, 'Subject is required'),
    comma_separated_file_ids: z.string().optional(),
});

export const updatePlanningLogSchema = z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().optional(),
    content_html: z.string().min(1).optional(),
    comma_separated_file_ids: z.string().optional(),
    status: z.enum(['ACTIVE', 'DELETED']).optional(),
});

export const filterSchema = z.object({
    interval_types: z.array(z.enum(['daily', 'weekly', 'monthly', 'quarterly'])).optional(),
    interval_type_ids: z.array(z.string()).optional(),
    created_by_user_ids: z.array(z.string()).optional(),
    log_types: z.array(z.enum(['planning', 'diary'])).optional(),
    entity_ids: z.array(z.string()).optional(),
    subject_ids: z.array(z.string()).optional(),
    statuses: z.array(z.enum(['ACTIVE', 'DELETED'])).optional(),
});

export type PlanningLogFormData = z.infer<typeof planningLogSchema>;
export type UpdatePlanningLogFormData = z.infer<typeof updatePlanningLogSchema>;
export type FilterFormData = z.infer<typeof filterSchema>;
