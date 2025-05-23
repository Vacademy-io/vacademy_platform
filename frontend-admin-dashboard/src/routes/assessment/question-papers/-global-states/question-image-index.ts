import { create } from "zustand";

interface QuestionImageIndexState {
    currentQuestionImageIndex: number;
    setCurrentQuestionImageIndex: (index: number) => void;
    initialize: (initialValues: { currentQuestionImageIndex?: number }) => void;
}

export const useQuestionImageStore = create<QuestionImageIndexState>((set) => ({
    currentQuestionImageIndex: 0,
    setCurrentQuestionImageIndex: (index) => set({ currentQuestionImageIndex: index }),
    initialize: ({ currentQuestionImageIndex = 0 } = {}) =>
        set({
            currentQuestionImageIndex: currentQuestionImageIndex,
        }),
}));
