import { z } from 'zod';
import { UseFormReturn } from 'react-hook-form';
import { uploadQuestionPaperFormSchema } from './upload-question-paper-form-schema';
import { Dispatch, SetStateAction } from 'react';

// Infer the form type from the schema
type QuestionPaperForm = z.infer<ReturnType<typeof uploadQuestionPaperFormSchema>>;
export interface QuestionPaperTemplateFormProps {
    form: UseFormReturn<QuestionPaperForm>;
    currentQuestionIndex: number;
    setCurrentQuestionIndex: Dispatch<SetStateAction<number>>;
    className: string;
    showQuestionNumber?: boolean; // Optional prop to control question number display
    examType?: string; // Add exam type prop
    // When true, answer-option editors show an "expand" button that opens the
    // full rich-text editor in a modal (compact row + full toolbar on demand).
    // Opted into by the Quiz slide editors only; assessments keep plain options.
    enableOptionModalCompose?: boolean;
}
