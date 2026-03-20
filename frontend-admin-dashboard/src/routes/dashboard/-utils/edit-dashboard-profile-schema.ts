import { z } from 'zod';

export const editDashboardProfileSchema = z.object({
    instituteProfilePictureUrl: z.string(),
    instituteProfilePictureId: z.union([z.string(), z.undefined()]),
    instituteName: z.string().min(1, 'Institute Name is required'),
    instituteThemeCode: z.string().optional(),
    instituteType: z.string().min(1, 'Select institute type'),
    instituteEmail: z
        .string()
        .optional()
        .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), 'Invalid email address'),
    institutePhoneNumber: z.string().optional(),
    instituteWebsite: z
        .string()
        .optional()
        .refine((val) => !val || /^https?:\/\/[^\s$.?#].[^\s]*$/i.test(val), 'Invalid website URL'),
    instituteAddress: z.string().optional(),
    instituteCountry: z.string().optional(),
    instituteState: z.string().optional(),
    instituteCity: z.string().optional(),
    institutePinCode: z.string().optional(),
});
