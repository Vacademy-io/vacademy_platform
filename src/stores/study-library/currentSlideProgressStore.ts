import { create } from "zustand";

interface CurrentSlideProgressStore {
    currentProgress: number | null;
    setCurrentProgress: (value: number | null) => void;
}

export const useCurrentSlideProgressStore = create<CurrentSlideProgressStore>((set) => ({
    currentProgress: 0,
    setCurrentProgress: (value) => set({ currentProgress: value })
}));
