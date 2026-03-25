import { z } from 'zod';

export const enrollBulkFormSchema = z.object({
    course: z.object({
        id: z.string(),
        name: z.string(),
    }),
    session: z.object({
        id: z.string(),
        name: z.string(),
    }),
    level: z.object({
        id: z.string(),
        name: z.string(),
    }),
});

export type enrollBulkFormType = z.infer<typeof enrollBulkFormSchema>;

export const csvFormatSchema = z.object({
    autoGenerateUsername: z.boolean().default(true),
    autoGeneratePassword: z.boolean().default(true),
    autoGenerateEnrollmentId: z.boolean().default(true),
    setCommonExpiryDate: z.boolean().default(true),
    daysFromToday: z.string().default('365'),
    addStudentStatus: z.boolean().default(true),
    studentStatus: z.string().default('Active'),
    // Optional CSV columns
    fatherName: z.boolean().default(true),
    motherName: z.boolean().default(true),
    fatherEmail: z.boolean().default(true),
    motherEmail: z.boolean().default(true),
    fatherMobile: z.boolean().default(true),
    motherMobile: z.boolean().default(true),
    collegeName: z.boolean().default(true),
    state: z.boolean().default(true),
    city: z.boolean().default(true),
    pincode: z.boolean().default(true),
});

export type CSVFormatFormType = z.infer<typeof csvFormatSchema>;
