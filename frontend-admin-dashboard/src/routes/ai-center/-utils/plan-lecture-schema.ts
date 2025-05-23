import { z } from "zod";

export const planLectureFormSchema = z.object({
    taskName: z.string().min(1, "Required"),
    prompt: z.string().min(1, "Required"),
    level: z.string().min(1, "Required"),
    teachingMethod: z.string().min(1, "Required"),
    language: z.string().min(1, "Required"),
    lectureDuration: z.object({
        hrs: z.string(),
        min: z.string(),
    }),
    isQuestionGenerated: z.boolean(),
    isAssignmentHomeworkGenerated: z.boolean(),
});

export type PlanLectureAIFormSchema = z.infer<typeof planLectureFormSchema>;
