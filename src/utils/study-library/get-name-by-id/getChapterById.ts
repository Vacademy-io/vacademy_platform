// utils/chapter.ts
import { ModulesWithChapters } from "@/stores/study-library/use-modules-with-chapters-store";

export const getChapterName = (chapterId: string, modulesWithChaptersData:  ModulesWithChapters[] | null): string | null => {
    
    if (!modulesWithChaptersData) return null;

    for (const module of modulesWithChaptersData) {
        for (const chapters of module.chapters) {
            if (chapters.id === chapterId) {
                return chapters.chapter_name;
            }
        }
    }
    return null;
};