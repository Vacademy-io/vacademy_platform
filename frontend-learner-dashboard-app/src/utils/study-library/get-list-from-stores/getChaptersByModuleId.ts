import {
    Chapter,
    useModulesWithChaptersStore,
} from "@/stores/study-library/use-modules-with-chapters-store";

export const getChaptersByModuleId = (moduleId: string): Chapter[] | null => {
    const modulesWithChaptersData = useModulesWithChaptersStore.getState().modulesWithChaptersData;

    if (!modulesWithChaptersData) return null;

    const targetModule = modulesWithChaptersData.find(
        (moduleData) => moduleData.module.id === moduleId,
    );

    return targetModule?.chapters || null;
};