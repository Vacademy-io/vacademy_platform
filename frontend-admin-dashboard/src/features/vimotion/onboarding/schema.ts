import { z } from 'zod';

export const inviteCodeSchema = z.object({
    inviteCode: z.string().trim().min(1, 'Enter your invite code').max(64, 'Code is too long'),
});

export const contactSchema = z.object({
    fullName: z.string().trim().min(2, 'Full name is required'),
    email: z.string().trim().email('Enter a valid email'),
    phoneNumber: z
        .string()
        .trim()
        .min(10, 'Enter a valid phone number')
        .regex(/^\+?[0-9\s-]+$/, 'Only digits, spaces, +, - allowed'),
    password: z.string().min(8, 'Use at least 8 characters').max(128, 'Password is too long'),
});

export const otpSchema = z.object({
    otp: z
        .string()
        .trim()
        .length(6, 'Enter the 6-digit code')
        .regex(/^[0-9]+$/, 'Code must be numeric'),
});

export const accountTypeSchema = z.object({
    accountType: z.enum(['individual', 'studio', 'agency']),
});

export const studioSchema = z.object({
    studioName: z.string().trim().min(2, 'Studio name is required'),
    logoFileId: z.string().optional(),
    brandColor: z.string().regex(/^#([0-9A-Fa-f]{6})$/, 'Pick a hex color'),
    companySize: z.enum(['1-10', '11-50', '51-200', '201+']),
});

export type InviteCodeValues = z.infer<typeof inviteCodeSchema>;
export type ContactValues = z.infer<typeof contactSchema>;
export type OtpValues = z.infer<typeof otpSchema>;
export type AccountTypeValues = z.infer<typeof accountTypeSchema>;
export type StudioValues = z.infer<typeof studioSchema>;
