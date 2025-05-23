// utils/study-library/getModuleName.ts
import { useModulesWithChaptersStore } from "@/stores/study-library/use-modules-with-chapters-store";

export const getModuleName = (moduleId: string): string => {
    const modulesData = useModulesWithChaptersStore.getState().modulesWithChaptersData;

    if (!modulesData) {
        return "";
    }

    const moduleData = modulesData.find(
        (moduleWithChapters) => moduleWithChapters.module.id === moduleId,
    );

    return moduleData?.module.module_name || "";
};
