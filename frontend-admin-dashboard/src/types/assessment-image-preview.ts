import { sectionsEditQuestionFormSchema } from "@/routes/assessment/assessment-list/assessment-details/$assessmentId/$examType/$assesssmentType/$assessmentTab/-utils/sections-edit-question-form-schema";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";

// Infer the form type from the schema
type AssessmentQuestionFormSchemaType = z.infer<typeof sectionsEditQuestionFormSchema>;

export interface AssessmentQuestionImagePreviewDialogueProps {
    form: UseFormReturn<AssessmentQuestionFormSchemaType>; // Type for the form
    currentQuestionIndex: number;
    currentQuestionImageIndex: number;
    setCurrentQuestionImageIndex: (index: number) => void; // Function to set the image index
    selectedSectionIndex: number;
    isUploadedAgain: boolean;
}

export interface AssessmentOptionImagePreviewDialogueProps {
    form: UseFormReturn<AssessmentQuestionFormSchemaType>; // Type for the form
    option: number;
    selectedSectionIndex: number;
    currentQuestionIndex: number;
    isUploadedAgain?: boolean;
}
