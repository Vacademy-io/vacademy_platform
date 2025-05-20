import { create } from "zustand";
import { InitData } from "@/types/community/types";
import { TagResponse } from "@/types/community/filters/types";

interface FilterStore {
    options: InitData;
    setOptions: (options: InitData) => void;
    selectedChips: TagResponse[];
    setSelectedChips: (values: TagResponse[]) => void;
    addSelectedChip: (chip: TagResponse) => void;
    removeSelectedChip: (chipId: string) => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
    options: {
        levels: [],
        streams: {},
        subjects: {},
        difficulties: [],
        topics: [],
        types: [],
        tags: [],
    },
    setOptions: (options) => set({ options }),
    selectedChips: [],
    setSelectedChips: (values) => set({ selectedChips: values }),
    addSelectedChip: (chip: TagResponse) =>
        set((state) => ({
            selectedChips: state.selectedChips.some((c) => c.tagId === chip.tagId)
                ? state.selectedChips
                : [...state.selectedChips, chip],
        })),
    removeSelectedChip: (chipId) =>
        set((state) => ({
            selectedChips: state.selectedChips.filter((chip) => chip.tagId !== chipId),
        })),
}));
