import { z } from 'zod';
import type { TFunction } from 'i18next';
import i18n from '@/i18n';

const NAMESPACE = 'evaluatorAiBasicInfoFormSchema';

/**
 * This zod schema is a module-scope singleton whose exact shape is consumed
 * via `z.infer<typeof BasicInfoFormSchema>` across other files in the
 * create-assessment flow, so converting it to a `buildXxx(t)` factory would
 * require touching every type-inference call site outside this batch.
 * Instead we use the "outside a React render tree" fallback: call the
 * shared i18next singleton directly with a fixed namespace.
 */
const t: TFunction = ((key: string, options?: Record<string, unknown>) =>
    i18n.t(key, { ns: NAMESPACE, ...options })) as TFunction;

export const BasicInfoFormSchema = z.object({
    status: z.string(),
    testCreation: z.object({
        assessmentName: z.string().min(1, t('assessmentNameRequired')),
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
                    message: t('endDateAfterStartDate'),
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
                message: t('reattemptCountPositive'),
                path: ['reattemptCount'],
            }
        ),
    submissionType: z.string(),
    durationDistribution: z.string(),
    evaluationType: z.string(),
    switchSections: z.boolean(),
    raiseReattemptRequest: z.boolean(),
    raiseTimeIncreaseRequest: z.boolean(),
});
