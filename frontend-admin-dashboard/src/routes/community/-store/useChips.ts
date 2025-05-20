import { create } from "zustand";
import { TagResponse } from "@/types/community/filters/types";

interface useChipsProps {
    popularChips: TagResponse[];
    setPopularChips: (values: TagResponse[]) => void;
    selectedChips: TagResponse[];
    setSelectedChips: (values: TagResponse[]) => void;
}

export const useChips = create<useChipsProps>((set) => ({
    popularChips: [],
    setPopularChips: (values) => set({ popularChips: values }),

    selectedChips: [],
    setSelectedChips: (values) => set({ selectedChips: values }),
}));
