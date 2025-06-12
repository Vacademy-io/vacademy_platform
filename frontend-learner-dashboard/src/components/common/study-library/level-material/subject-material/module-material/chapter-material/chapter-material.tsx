// module-material.tsx
import { useEffect, useState } from "react";
import { Chapters } from "./chapters";
import { useModulesWithChaptersStore } from "@/stores/study-library/use-modules-with-chapters-store";
import { getChaptersByModuleId } from "@/utils/study-library/get-list-from-stores/getChaptersByModuleId";

interface ChapterMaterialProps {
    currentModuleId: string
}

export const ChapterMaterial = ({ currentModuleId }: ChapterMaterialProps) => {
    
    const { modulesWithChaptersData } = useModulesWithChaptersStore();
    const [existingChapters, setExistingChapters] = useState(
        getChaptersByModuleId(currentModuleId) || [],
    );

    useEffect(() => {
        setExistingChapters(getChaptersByModuleId(currentModuleId) || []);
    }, [ modulesWithChaptersData, currentModuleId]); 

    return (
        <Chapters
            chapters={existingChapters}
        />
    );
};
