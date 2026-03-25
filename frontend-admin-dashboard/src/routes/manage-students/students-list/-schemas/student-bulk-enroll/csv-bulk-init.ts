// types/bulk-upload.ts
import { z } from 'zod';

// Define Zod schemas for validation
export const HeaderSchema = z.object({
    type: z.string(),
    optional: z.boolean(),
    column_name: z.string(),
    options: z.array(z.string()).nullable(),
    send_option_id: z.boolean().nullable(),
    option_ids: z.record(z.string(), z.string()).nullable(),
    format: z.string().nullable(),
    regex: z.string().nullable(),
    regex_error_message: z.string().nullable(),
    order: z.number(),
    sample_values: z.array(z.string()),
});

export const SubmitApiSchema = z.object({
    route: z.string(),
    status_col: z.string(),
    error_response_col: z.string(),
    request_params: z.object({
        instituteId: z.string(),
    }),
});

export const BulkUploadSchema = z.object({
    page_title: z.string(),
    instructions: z.array(z.string()),
    submit_api: SubmitApiSchema,
    headers: z.array(HeaderSchema),
});

// Infer TypeScript types from Zod schemas
export type Header = z.infer<typeof HeaderSchema>;
export type SubmitApi = z.infer<typeof SubmitApiSchema>;
export type BulkUploadResponse = z.infer<typeof BulkUploadSchema>;
