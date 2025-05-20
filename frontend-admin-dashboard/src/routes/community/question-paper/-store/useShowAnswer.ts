import { create } from "zustand";

interface useShowAnswerProps {
    showAnswer: boolean;
    setShowAnswer: (showAnswer: boolean) => void;
}

export const useShowAnswer = create<useShowAnswerProps>((set) => ({
    showAnswer: false,
    setShowAnswer: (value) => set({ showAnswer: value }),
}));
