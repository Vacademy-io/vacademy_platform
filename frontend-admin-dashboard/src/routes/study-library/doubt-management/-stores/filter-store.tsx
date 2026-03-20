import { create } from 'zustand';
import { DoubtFilter } from '@/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-types/get-doubts-type';

// Zustand store for doubt filters
interface DoubtFilterStore {
    filters: DoubtFilter;
    updateFilters: (filters: Partial<DoubtFilter>) => void;
    resetFilters: () => void;
}

const defaultFilters: DoubtFilter = {
    name: '',
    start_date: '',
    end_date: '',
    user_ids: [],
    content_positions: [],
    content_types: [],
    sources: [],
    source_ids: [],
    status: [],
    batch_ids: [],
    sort_columns: {},
};

export const useDoubtFilters = create<DoubtFilterStore>((set) => ({
    filters: defaultFilters,
    updateFilters: (newFilters) =>
        set((state) => ({
            filters: { ...state.filters, ...newFilters },
        })),
    resetFilters: () => set({ filters: defaultFilters }),
}));
