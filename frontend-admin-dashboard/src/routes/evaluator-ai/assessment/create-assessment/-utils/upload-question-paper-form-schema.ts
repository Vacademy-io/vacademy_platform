import { z } from 'zod';
import type { TFunction } from 'i18next';
import i18n from '@/i18n';
import { isQuillContentEmpty } from './helper';

/**
 * This zod schema is a module-scope singleton consumed via
 * `zodResolver(uploadQuestionPaperFormSchema)` in AddQuestion/QuestionPaperUpload.tsx,
 * which is outside this i18n batch. Converting it to a `buildXxx(t)` factory would
 * require touching that call site too, so — per the rollout's established fallback
 * for exactly this situation (see studyLibraryScheduleSchema) — we call the shared
 * i18next singleton directly with a fixed namespace instead of threading `t`.
 */
const NAMESPACE = 'evaluatorAiUploadQuestionPaperFormSchema';
const t: TFunction = ((key: string, options?: Record<string, unknown>) =>
    i18n.t(key, { ns: NAMESPACE, ...options })) as TFunction;

export const uploadQuestionPaperFormSchema = z.object({
    questionPaperId: z
        .string({
            required_error: t('questionPaperIdRequired'),
            invalid_type_error: t('questionPaperIdMustBeNumber'),
        })
        .optional(),
    isFavourite: z.boolean().default(false),
    createdOn: z.date().default(() => new Date()),
    questionsType: z.string({
        required_error: t('questionFieldRequired'),
        invalid_type_error: t('questionFieldMustBeString'),
    }),
    optionsType: z.string({
        required_error: t('optionFieldRequired'),
        invalid_type_error: t('optionFieldMustBeString'),
    }),
    answersType: z.string({
        required_error: t('answerFieldRequired'),
        invalid_type_error: t('answerFieldMustBeString'),
    }),
    explanationsType: z.string({
        required_error: t('explanationFieldRequired'),
        invalid_type_error: t('explanationFieldMustBeString'),
    }),
    fileUpload: z
        .instanceof(File, {
            message: t('fileUploadRequired'),
        })
        .optional(),
    questions: z.array(
        z
            .object({
                questionId: z.string().optional(),
                questionName: z.string().refine((val) => !isQuillContentEmpty(val), {
                    message: t('questionNameRequired'),
                }),
                explanation: z.string().optional(),
                questionType: z.string().default('MCQS'),
                questionPenalty: z.string(),
                questionDuration: z.object({
                    hrs: z.string(),
                    min: z.string(),
                }),
                questionMark: z.string(),
                singleChoiceOptions: z
                    .array(
                        z.object({
                            id: z.string().optional(),
                            name: z.string().optional(),
                            isSelected: z.boolean().optional(),
                        })
                    )
                    .optional(),
                multipleChoiceOptions: z
                    .array(
                        z.object({
                            id: z.string().optional(),
                            name: z.string().optional(),
                            isSelected: z.boolean().optional(),
                        })
                    )
                    .optional(),
                parentRichTextContent: z.union([z.string(), z.null()]).optional(),
                decimals: z.number().optional(),
                numericType: z.string().optional(),
                validAnswers: z.union([z.array(z.number()), z.null()]).optional(),
                questionResponseType: z.union([z.string(), z.null()]).optional(),
                subjectiveAnswerText: z.string().optional(),
            })
            .superRefine((question, ctx) => {
                // Validate based on question type
                if (question.questionType === 'MCQS') {
                    // Validate singleChoiceOptions when type is MCQS
                    if (
                        !question.singleChoiceOptions ||
                        question.singleChoiceOptions.length === 0
                    ) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: t('mcqsMustHaveSingleChoiceOptions'),
                            path: ['singleChoiceOptions'],
                        });
                        return;
                    }

                    if (question.singleChoiceOptions.length < 2) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: t('mcqsMustHaveAtLeast2Options'),
                            path: ['singleChoiceOptions'],
                        });
                    }

                    const selectedCount = question.singleChoiceOptions.filter(
                        (opt) => opt.isSelected
                    ).length;
                    if (selectedCount !== 1) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: t('mcqsMustHaveExactlyOneSelected'),
                            path: ['singleChoiceOptions'],
                        });
                    }

                    question.singleChoiceOptions.forEach((opt, index) => {
                        if (!opt?.name?.trim()) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                message: t('optionIsRequired', { number: index + 1 }),
                                path: ['singleChoiceOptions', index, 'name'],
                            });
                        }
                    });
                } else if (question.questionType === 'MCQM') {
                    // Validate multipleChoiceOptions when type is MCQM
                    if (
                        !question.multipleChoiceOptions ||
                        question.multipleChoiceOptions.length === 0
                    ) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: t('mcqmMustHaveMultipleChoiceOptions'),
                            path: ['multipleChoiceOptions'],
                        });
                        return;
                    }

                    if (question.multipleChoiceOptions.length < 2) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: t('mcqmMustHaveAtLeast2Options'),
                            path: ['multipleChoiceOptions'],
                        });
                    }

                    const selectedCount = question.multipleChoiceOptions.filter(
                        (opt) => opt.isSelected
                    ).length;
                    if (selectedCount < 1) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: t('mcqmMustHaveAtLeastOneSelected'),
                            path: ['multipleChoiceOptions'],
                        });
                    }

                    question.multipleChoiceOptions.forEach((opt, index) => {
                        if (!opt.name?.trim()) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                message: t('optionIsRequired', { number: index + 1 }),
                                path: ['multipleChoiceOptions', index, 'name'],
                            });
                        }
                    });
                }

                const { numericType, validAnswers } = question;

                if (!validAnswers || !Array.isArray(validAnswers)) return;
                const typeChecks: Record<string, (n: number) => boolean> = {
                    SINGLE_DIGIT_NON_NEGATIVE_INTEGER: (n) =>
                        Number.isInteger(n) && n >= 0 && n <= 9,
                    INTEGER: (n) => Number.isInteger(n),
                    POSITIVE_INTEGER: (n) => Number.isInteger(n) && n > 0,
                    DECIMAL: (n) => typeof n === 'number',
                };

                const check = numericType ? typeChecks[numericType] : undefined;

                if (check && !validAnswers.every(check)) {
                    ctx.addIssue({
                        path: ['validAnswers'],
                        code: z.ZodIssueCode.custom,
                        message: t('incorrectAnswerTypeEntered', { numericType }),
                    });
                }
            })
    ),
});
