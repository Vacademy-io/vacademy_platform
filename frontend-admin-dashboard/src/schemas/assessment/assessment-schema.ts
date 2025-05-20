import { z } from "zod";

export const AssessmentSchema = z.object({
    assessment_access_statuses: z.array(z.string()),
    assessment_mode_types: z.array(z.string()),
    evaluation_types: z.array(z.string()),
    assessment_statuses: z.array(z.string()),
    tag_and_ids: z.record(z.string(), z.array(z.string())), // Assuming it's a record with string arrays as values
});

export type AssessmentDetailsType = z.infer<typeof AssessmentSchema>;
