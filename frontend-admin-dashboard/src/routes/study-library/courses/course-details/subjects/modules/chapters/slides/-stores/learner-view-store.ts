import { create } from 'zustand';

interface LearnerViewStore {
    isLearnerView: boolean;
    toggleLearnerView: () => void;
    setLearnerView: (isLearnerView: boolean) => void;
}

export const useLearnerViewStore = create<LearnerViewStore>((set) => ({
    isLearnerView: false,
    toggleLearnerView: () => set((state) => ({ isLearnerView: !state.isLearnerView })),
    setLearnerView: (isLearnerView) => set({ isLearnerView }),
}));
