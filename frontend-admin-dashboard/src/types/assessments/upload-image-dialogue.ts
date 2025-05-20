import { uploadQuestionPaperFormSchema } from "@/routes/assessment/question-papers/-utils/upload-question-paper-form-schema";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";

// Infer the form type from the schema
type QuestionFormSchemaType = z.infer<typeof uploadQuestionPaperFormSchema>;

export interface UploadImageDialogueProps {
    form: UseFormReturn<QuestionFormSchemaType>; // Type for the form
    title: string; // Title for the dialogue
    triggerButton?: React.ReactNode; // Optional trigger button
    currentQuestionIndex: number;
    currentQuestionImageIndex: number;
}

export interface OptionImageDialogueProps {
    form: UseFormReturn<QuestionFormSchemaType>; // Type for the form
    title: string; // Title for the dialogue
    triggerButton?: React.ReactNode; // Optional trigger button
    option: number;
    currentQuestionIndex: number;
}
