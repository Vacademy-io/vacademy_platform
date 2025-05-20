// utils/study-library/getLevelName.ts
import { useStudyLibraryStore } from "@/stores/study-library/use-study-library-store";

export const getLevelName = (levelId: string): string => {
    const studyLibraryData = useStudyLibraryStore.getState().studyLibraryData;

    if (!studyLibraryData) {
        return "";
    }

    // Iterate through all courses and their sessions to find the level
    for (const courseData of studyLibraryData) {
        for (const session of courseData.sessions) {
            const level = session.level_with_details.find((level) => level.id === levelId);

            if (level) {
                return level.name;
            }
        }
    }

    return "";
};
