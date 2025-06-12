import { useModulesWithChaptersStore } from "@/stores/study-library/use-modules-with-chapters-store";

export const getModuleById = (moduleId: string) => {
    const modulesWithChaptersData = useModulesWithChaptersStore.getState().modulesWithChaptersData;
    return modulesWithChaptersData?.find((moduleData) => moduleData.module.id === moduleId);
};
