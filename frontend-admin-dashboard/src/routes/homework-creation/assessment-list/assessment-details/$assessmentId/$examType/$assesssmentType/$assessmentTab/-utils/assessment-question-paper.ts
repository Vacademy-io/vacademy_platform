import { z } from 'zod';
import { UseFormReturn } from 'react-hook-form';
import { sectionsEditQuestionFormSchema } from './sections-edit-question-form-schema';

// Infer the form type from the schema
type sectionQuestionPaperForm = z.infer<typeof sectionsEditQuestionFormSchema>;

interface QuestionIndexes {
    [sectionId: string]: number;
}
export interface SectionQuestionPaperFormProps {
    form: UseFormReturn<sectionQuestionPaperForm>;
    selectedSection: string;
    currentQuestionIndexes: QuestionIndexes;
    setCurrentQuestionIndexes: React.Dispatch<React.SetStateAction<QuestionIndexes>>;
    currentQuestionIndex: number;
    className: string;
    selectedSectionIndex: number;
}
