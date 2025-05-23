import { create } from "zustand";

interface MarkEntry {
    section_id: string;
    question_id: string;
    status: string;
    marks: number;
}

interface MarksStore {
    marksData: MarkEntry[];
    addOrUpdateMark: (entry: MarkEntry) => void;
    resetMarks: () => void;
}

export const useMarksStore = create<MarksStore>((set) => ({
    marksData: [],
    addOrUpdateMark: (entry) =>
        set((state) => {
            const existingIndex = state.marksData.findIndex(
                (item) =>
                    item.section_id === entry.section_id && item.question_id === entry.question_id,
            );

            if (existingIndex !== -1) {
                // Update existing entry
                const updatedMarksData = [...state.marksData];
                updatedMarksData[existingIndex] = entry;
                return { marksData: updatedMarksData };
            } else {
                // Add new entry
                return { marksData: [...state.marksData, entry] };
            }
        }),
    resetMarks: () => set({ marksData: [] }),
}));
