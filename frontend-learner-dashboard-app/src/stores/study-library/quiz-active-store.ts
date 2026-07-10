import { create } from "zustand";

/**
 * Tracks whether a quiz is currently being taken (QuizViewer mounted).
 * Used to hide the floating chatbot button so it never covers the quiz
 * Next/Finish controls in the bottom-right corner — same reason the button
 * hides while the doubt sidebar is open.
 */
interface QuizActiveStore {
  isActive: boolean;
  setActive: (active: boolean) => void;
}

export const useQuizActiveStore = create<QuizActiveStore>((set) => ({
  isActive: false,
  setActive: (active: boolean) => set({ isActive: active }),
}));
