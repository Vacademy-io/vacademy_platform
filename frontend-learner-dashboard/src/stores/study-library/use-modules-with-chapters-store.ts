// stores/study-library/useModulesWithChaptersStore.ts
import { create } from "zustand";

export interface Chapter {
    id: string;
    chapter_name: string;
    status: string;
    file_id: string;
    description: string;
    chapter_order: number;
    last_slide_viewed: string,
    percentage_completed: number,
    video_count: number,
    pdf_count: number,
    doc_count: number,
    unknown_count: number,
    question_slide_count: number,
    assignment_slide_count: number
}

export interface Module {
    id: string;
    module_name: string;
    status: string;
    description: string;
    thumbnail_id: string;
}

export interface ModulesWithChapters {
    module: Module;
    percentage_completed: number;
    chapters: Chapter[];
}

interface ModulesWithChaptersStore {
    modulesWithChaptersData: ModulesWithChapters[] | null;
    setModulesWithChaptersData: (data: ModulesWithChapters[]) => void;
}

export const useModulesWithChaptersStore = create<ModulesWithChaptersStore>((set) => ({
    modulesWithChaptersData: null,
    setModulesWithChaptersData: (data) => set({ modulesWithChaptersData: data }),
}));
