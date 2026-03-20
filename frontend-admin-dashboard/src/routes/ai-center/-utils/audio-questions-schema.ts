import { z } from 'zod';

export const audioQuestionsFormSchema = z.object({
    numQuestions: z.string().min(1, 'Required'),
    prompt: z.string().min(1, 'Required'),
    difficulty: z.string().min(1, 'Required'),
    language: z.string().min(1, 'Required'),
    taskName: z.string().min(1, 'Required'),
    preferredModel: z.string().optional(),
});

export type AudioAIQuestionFormSchema = z.infer<typeof audioQuestionsFormSchema>;

