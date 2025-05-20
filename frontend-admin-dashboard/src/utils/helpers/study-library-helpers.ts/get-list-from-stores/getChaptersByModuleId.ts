import {
    ChapterWithSlides,
    useModulesWithChaptersStore,
} from "@/stores/study-library/use-modules-with-chapters-store";

export const getChaptersByModuleId = (moduleId: string): ChapterWithSlides[] | null => {
    const modulesWithChaptersData = useModulesWithChaptersStore.getState().modulesWithChaptersData;

    if (!modulesWithChaptersData) return null;

    const targetModule = modulesWithChaptersData.find(
        (moduleData) => moduleData.module.id === moduleId,
    );

    return targetModule?.chapters || null;
};
