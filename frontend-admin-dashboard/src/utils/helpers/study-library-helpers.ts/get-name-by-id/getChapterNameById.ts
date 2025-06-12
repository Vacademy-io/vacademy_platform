// hooks/useChapterName.ts
import { useModulesWithChaptersStore } from "@/stores/study-library/use-modules-with-chapters-store";

export const useChapterName = (chapterId: string): string | undefined => {
    const modulesWithChaptersData = useModulesWithChaptersStore(
        (state) => state.modulesWithChaptersData,
    );

    if (!modulesWithChaptersData) return undefined;

    for (const moduleWithChapters of modulesWithChaptersData) {
        const chapter = moduleWithChapters.chapters.find(
            (chapterWithSlides) => chapterWithSlides.chapter.id === chapterId,
        );

        if (chapter) {
            return chapter.chapter.chapter_name;
        }
    }

    return undefined;
};
