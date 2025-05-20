import { z } from "zod";
import { create } from "zustand";
import { uploadQuestionPaperFormSchema } from "../-utils/upload-question-paper-form-schema";

type QuestionPaperForm = z.infer<typeof uploadQuestionPaperFormSchema>;

export interface QuestionPaperListInterface {
    questionPaperList: QuestionPaperForm[]; // Array of plain form data
    setQuestionPaperList: (data: QuestionPaperForm[]) => void;
}

export const useAllQuestionsStore = create<QuestionPaperListInterface>((set) => ({
    questionPaperList: [], // Initial state
    setQuestionPaperList: (data) => set(() => ({ questionPaperList: data })),
}));
