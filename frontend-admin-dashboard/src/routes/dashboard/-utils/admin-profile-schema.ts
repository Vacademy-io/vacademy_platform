import { z } from 'zod';

export const userRoleSchema = z.object({
    id: z.string(),
    name: z.string(),
});

export const adminProfileSchema = z.object({
    profilePictureUrl: z.string(),
    profilePictureId: z.union([z.string(), z.undefined(), z.null()]),
    name: z.string().min(1, 'Name is required'),
    roleType: z.array(z.string()),
    email: z
        .string()
        .optional()
        .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), 'Invalid email address'),
    phone: z.string(),
});
