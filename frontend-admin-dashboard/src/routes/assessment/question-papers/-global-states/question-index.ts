import { create } from "zustand";

interface QuestionIndexState {
    currentQuestionIndex: number;
    setCurrentQuestionIndex: (index: number) => void;
    initialize: (initialValues: { currentQuestionIndex?: number }) => void;
}

export const useQuestionStore = create<QuestionIndexState>((set) => ({
    currentQuestionIndex: 0,
    setCurrentQuestionIndex: (currentQuestionIndex) =>
        set({ currentQuestionIndex: currentQuestionIndex }),
    initialize: ({ currentQuestionIndex = 0 } = {}) =>
        set({
            currentQuestionIndex: currentQuestionIndex,
        }),
}));
