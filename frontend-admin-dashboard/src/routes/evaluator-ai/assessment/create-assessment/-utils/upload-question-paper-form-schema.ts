import { z } from "zod";
import { isQuillContentEmpty } from "./helper";

export const uploadQuestionPaperFormSchema = z.object({
    questionPaperId: z
        .string({
            required_error: "Question Paper ID is required",
            invalid_type_error: "Question Paper ID must be a number",
        })
        .optional(),
    isFavourite: z.boolean().default(false),
    createdOn: z.date().default(() => new Date()),
    questionsType: z.string({
        required_error: "Question field is required",
        invalid_type_error: "Question field must be a string",
    }),
    optionsType: z.string({
        required_error: "Option field is required",
        invalid_type_error: "Option field must be a string",
    }),
    answersType: z.string({
        required_error: "Answer field is required",
        invalid_type_error: "Answer field must be a string",
    }),
    explanationsType: z.string({
        required_error: "Explanation field is required",
        invalid_type_error: "Explanation field must be a string",
    }),
    fileUpload: z
        .instanceof(File, {
            message: "File upload is required and must be a valid file",
        })
        .optional(),
    questions: z.array(
        z
            .object({
                questionId: z.string().optional(),
                questionName: z.string().refine((val) => !isQuillContentEmpty(val), {
                    message: "Question name is required",
                }),
                explanation: z.string().optional(),
                questionType: z.string().default("MCQS"),
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
                        }),
                    )
                    .optional(),
                multipleChoiceOptions: z
                    .array(
                        z.object({
                            id: z.string().optional(),
                            name: z.string().optional(),
                            isSelected: z.boolean().optional(),
                        }),
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
                if (question.questionType === "MCQS") {
                    // Validate singleChoiceOptions when type is MCQS
                    if (
                        !question.singleChoiceOptions ||
                        question.singleChoiceOptions.length === 0
                    ) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: "MCQS questions must have singleChoiceOptions",
                            path: ["singleChoiceOptions"],
                        });
                        return;
                    }

                    if (question.singleChoiceOptions.length !== 4) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: "MCQS must have exactly 4 options",
                            path: ["singleChoiceOptions"],
                        });
                    }

                    const selectedCount = question.singleChoiceOptions.filter(
                        (opt) => opt.isSelected,
                    ).length;
                    if (selectedCount !== 1) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: "MCQS must have exactly one option selected",
                            path: ["singleChoiceOptions"],
                        });
                    }

                    question.singleChoiceOptions.forEach((opt, index) => {
                        if (!opt?.name?.trim()) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                message: `Option ${index + 1} is required`,
                                path: ["singleChoiceOptions", index, "name"],
                            });
                        }
                    });
                } else if (question.questionType === "MCQM") {
                    // Validate multipleChoiceOptions when type is MCQM
                    if (
                        !question.multipleChoiceOptions ||
                        question.multipleChoiceOptions.length === 0
                    ) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: "MCQM questions must have multipleChoiceOptions",
                            path: ["multipleChoiceOptions"],
                        });
                        return;
                    }

                    if (question.multipleChoiceOptions.length !== 4) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: "MCQM must have exactly 4 options",
                            path: ["multipleChoiceOptions"],
                        });
                    }

                    const selectedCount = question.multipleChoiceOptions.filter(
                        (opt) => opt.isSelected,
                    ).length;
                    if (selectedCount < 1) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: "MCQM must have at least one option selected",
                            path: ["multipleChoiceOptions"],
                        });
                    }

                    question.multipleChoiceOptions.forEach((opt, index) => {
                        if (!opt.name?.trim()) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                message: `Option ${index + 1} is required`,
                                path: ["multipleChoiceOptions", index, "name"],
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
                    DECIMAL: (n) => typeof n === "number",
                };

                const check = numericType ? typeChecks[numericType] : undefined;

                if (check && !validAnswers.every(check)) {
                    ctx.addIssue({
                        path: ["validAnswers"],
                        code: z.ZodIssueCode.custom,
                        message: `Not correct answer type is entered ${numericType}`,
                    });
                }
            }),
    ),
});
