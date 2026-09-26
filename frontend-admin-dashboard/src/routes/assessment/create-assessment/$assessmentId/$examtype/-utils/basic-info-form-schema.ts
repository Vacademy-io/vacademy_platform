import { z } from 'zod';
import { DEFAULT_PROCTORING_FORM } from '@/types/assessments/proctoring';

export const BasicInfoFormSchema = z.object({
    status: z.string(),
    testCreation: z.object({
        assessmentName: z.string().min(1, 'Assessment name is required'),
        subject: z.string(),
        assessmentInstructions: z.string(),
        liveDateRange: z
            .object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
            })
            .refine(
                (data) =>
                    (!data.startDate && !data.endDate) || // Allow empty
                    new Date(data.endDate!) > new Date(data.startDate!), // Date comparison
                {
                    message: 'End date must be greater than start date',
                    path: ['endDate'],
                }
            ),
    }),
    assessmentPreview: z.object({
        checked: z.boolean(),
        previewTimeLimit: z.string(),
    }),
    reattemptCount: z
        .string()
        .default('1') // Default to "1" to prevent undefined errors
        .refine(
            (value) => {
                const num = Number(value);
                return !isNaN(num) && num > 0;
            },
            {
                message: 'Reattempt count must be greater than 0',
                path: ['reattemptCount'],
            }
        ),
    submissionType: z.string(),
    durationDistribution: z.string(),
    evaluationType: z.string(),
    // No schema default: an unselected radio must fail loudly, not quietly
    // become a manually-checked assessment (see defaultResultTypeFor).
    resultType: z.string().min(1, 'Choose how results are evaluated'),
    // Automatic AI evaluation on submit. Off by default: it spends institute credits.
    aiEvaluationEnabled: z.boolean().default(false),
    // Proctoring tier + knobs. NONE by default: the camera is only ever asked
    // for because someone chose a tier.
    proctoring: z
        .object({
            tier: z.enum(['NONE', 'BASIC', 'PRO', 'ULTRA']),
            cameraRequired: z.boolean(),
            snapshotIntervalSec: z.number().int().min(0).max(600),
            faceCheck: z.boolean(),
            maxViolations: z.number().int().min(0).max(20),
            showSelfView: z.boolean(),
        })
        .default(DEFAULT_PROCTORING_FORM),
    switchSections: z.boolean(),
    raiseReattemptRequest: z.boolean(),
    raiseTimeIncreaseRequest: z.boolean(),
});
