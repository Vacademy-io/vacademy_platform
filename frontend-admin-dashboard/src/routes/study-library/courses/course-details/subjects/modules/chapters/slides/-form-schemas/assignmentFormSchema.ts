import { z } from 'zod';

export const assignmentFormSchema = z.object({
    id: z.string(),
    task: z.string(),
    taskDescription: z.string().optional(),
    startDate: z.string(),
    endDate: z.string(),
    reattemptCount: z.string(),
    uploaded_question_paper: z.string().nullable(),
    adaptive_marking_for_each_question: z.array(
        z.object({
            questionId: z.string().optional(),
            questionName: z.string(),
            questionType: z.string(),
            newQuestion: z.boolean().optional(),
        })
    ),
    totalParticipants: z.number().optional(),
    submittedParticipants: z.number().optional(),
});

export type AssignmentFormType = z.infer<typeof assignmentFormSchema>;
