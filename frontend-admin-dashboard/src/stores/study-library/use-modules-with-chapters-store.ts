// stores/study-library/useModulesWithChaptersStore.ts
import { create } from "zustand";

export interface SlidesCount {
    video_count: number;
    pdf_count: number;
    doc_count: number;
    unknown_count: number;
}

export interface Chapter {
    id: string;
    chapter_name: string;
    status: string;
    file_id: string;
    description: string;
    chapter_order: number;
}

export interface ChapterWithSlides {
    chapter: Chapter;
    slides_count: SlidesCount;
    chapter_in_package_sessions: string[];
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
    chapters: ChapterWithSlides[];
}

interface ModulesWithChaptersStore {
    modulesWithChaptersData: ModulesWithChapters[] | null;
    setModulesWithChaptersData: (data: ModulesWithChapters[]) => void;
    resetModulesWithChaptersStore: () => void;
}

export const useModulesWithChaptersStore = create<ModulesWithChaptersStore>((set) => ({
    modulesWithChaptersData: null,
    setModulesWithChaptersData: (data) => set({ modulesWithChaptersData: data }),
    resetModulesWithChaptersStore: () => set({ modulesWithChaptersData: null }),
}));
