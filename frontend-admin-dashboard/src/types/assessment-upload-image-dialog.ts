import { sectionsEditQuestionFormSchema } from "@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-utils/sections-edit-question-form-schema";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";

// Infer the form type from the schema
type AssessmentQuestionFormSchemaType = z.infer<typeof sectionsEditQuestionFormSchema>;

export interface AssessmentUploadImageDialogueProps {
    form: UseFormReturn<AssessmentQuestionFormSchemaType>; // Type for the form
    title: string; // Title for the dialogue
    triggerButton?: React.ReactNode; // Optional trigger button
    selectedSectionIndex: number;
    currentQuestionIndex: number;
    currentQuestionImageIndex: number;
}

export interface AssessmentOptionImageDialogueProps {
    form: UseFormReturn<AssessmentQuestionFormSchemaType>; // Type for the form
    title: string; // Title for the dialogue
    triggerButton?: React.ReactNode; // Optional trigger button
    option: number;
    currentQuestionIndex: number;
    selectedSectionIndex: number;
}
