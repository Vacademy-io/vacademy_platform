// utils/chapter.ts
import { useModulesWithChaptersStore } from "@/stores/study-library/use-modules-with-chapters-store";

export const getChapterName = (chapterId: string): string | null => {
    const modulesWithChaptersData = useModulesWithChaptersStore.getState().modulesWithChaptersData;
    
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