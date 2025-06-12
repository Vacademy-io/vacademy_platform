import { uploadQuestionPaperFormSchema } from "@/routes/assessment/question-papers/-utils/upload-question-paper-form-schema";
import { Dispatch, SetStateAction } from "react";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";

// Infer the form type from the schema
type QuestionFormSchemaType = z.infer<typeof uploadQuestionPaperFormSchema>;

export interface QuestionImagePreviewDialogueProps {
    form: UseFormReturn<QuestionFormSchemaType>; // Type for the form
    currentQuestionIndex: number;
    currentQuestionImageIndex: number;
    setCurrentQuestionImageIndex: Dispatch<SetStateAction<number>>;
    isUploadedAgain?: boolean;
}

export interface OptionImagePreviewDialogueProps {
    form: UseFormReturn<QuestionFormSchemaType>; // Type for the form
    option: number;
    currentQuestionIndex: number;
    isUploadedAgain?: boolean;
}
