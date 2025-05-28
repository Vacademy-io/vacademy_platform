import { create } from 'zustand';

interface AIQuestionDialogStore {
    isAIQuestionDialog1: boolean;
    isAIQuestionDialog2: boolean;
    isAIQuestionDialog3: boolean;
    isAIQuestionDialog4: boolean;
    isAIQuestionDialog5: boolean;
    isAIQuestionDialog6: boolean;
    isAIQuestionDialog7: boolean;
    isAIQuestionDialog8: boolean;
    isAIQuestionDialog9: boolean;
    setIsAIQuestionDialog1: (value: boolean) => void;
    setIsAIQuestionDialog2: (value: boolean) => void;
    setIsAIQuestionDialog3: (value: boolean) => void;
    setIsAIQuestionDialog4: (value: boolean) => void;
    setIsAIQuestionDialog5: (value: boolean) => void;
    setIsAIQuestionDialog6: (value: boolean) => void;
    setIsAIQuestionDialog7: (value: boolean) => void;
    setIsAIQuestionDialog8: (value: boolean) => void;
    setIsAIQuestionDialog9: (value: boolean) => void;
}

export const useAIQuestionDialogStore = create<AIQuestionDialogStore>((set) => ({
    isAIQuestionDialog1: false,
    isAIQuestionDialog2: false,
    isAIQuestionDialog3: false,
    isAIQuestionDialog4: false,
    isAIQuestionDialog5: false,
    isAIQuestionDialog6: false,
    isAIQuestionDialog7: false,
    isAIQuestionDialog8: false,
    isAIQuestionDialog9: false,
    setIsAIQuestionDialog1: (value) => set({ isAIQuestionDialog1: value }),
    setIsAIQuestionDialog2: (value) => set({ isAIQuestionDialog2: value }),
    setIsAIQuestionDialog3: (value) => set({ isAIQuestionDialog3: value }),
    setIsAIQuestionDialog4: (value) => set({ isAIQuestionDialog4: value }),
    setIsAIQuestionDialog5: (value) => set({ isAIQuestionDialog5: value }),
    setIsAIQuestionDialog6: (value) => set({ isAIQuestionDialog6: value }),
    setIsAIQuestionDialog7: (value) => set({ isAIQuestionDialog7: value }),
    setIsAIQuestionDialog8: (value) => set({ isAIQuestionDialog8: value }),
    setIsAIQuestionDialog9: (value) => set({ isAIQuestionDialog9: value }),
}));
