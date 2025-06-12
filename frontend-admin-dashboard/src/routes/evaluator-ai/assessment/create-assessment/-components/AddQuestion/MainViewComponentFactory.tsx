import React, { Dispatch, SetStateAction } from "react";
import { LongAnswerQuestionPaperTemplateMainView } from "./LongAnswerType/LongAnswerQuestionPaperTemplateMainView";
import { uploadQuestionPaperFormSchema } from "../../-utils/upload-question-paper-form-schema";
import { z } from "zod";
import { UseFormReturn } from "react-hook-form";

type QuestionPaperForm = z.infer<typeof uploadQuestionPaperFormSchema>;
export interface QuestionPaperTemplateFormProps {
    form: UseFormReturn<QuestionPaperForm>;
    currentQuestionIndex: number;
    setCurrentQuestionIndex: Dispatch<SetStateAction<number>>;
    className: string;
}
export const MainViewComponentFactory = (params: { props: QuestionPaperTemplateFormProps }) => {
    return <LongAnswerQuestionPaperTemplateMainView {...params.props} />;
};
