// utils/study-library/getModuleName.ts
import { ModulesWithChapters } from "@/stores/study-library/use-modules-with-chapters-store";

export const getModuleName = (moduleId: string, modulesWithChaptersData: ModulesWithChapters[] | null): string => {

    if (!modulesWithChaptersData) {
        return "";
    }

    const moduleData = modulesWithChaptersData.find(
        (moduleWithChapters) => moduleWithChapters.module.id === moduleId,
    );

    return moduleData?.module.module_name || "";
};
