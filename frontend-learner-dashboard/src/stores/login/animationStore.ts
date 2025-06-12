import { create } from "zustand";

interface AnimationStore {
    hasSeenAnimation: boolean;
    setHasSeenAnimation: () => void;
}

export const useAnimationStore = create<AnimationStore>((set) => ({
    hasSeenAnimation: false,
    setHasSeenAnimation: () => set({ hasSeenAnimation: true }),
}));
