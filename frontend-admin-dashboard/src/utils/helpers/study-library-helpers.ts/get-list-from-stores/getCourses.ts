// utils/study-library/getCourses.ts
import { useStudyLibraryStore, CourseType } from "@/stores/study-library/use-study-library-store";

export const getCourses = (): CourseType[] => {
    const studyLibraryData = useStudyLibraryStore.getState().studyLibraryData;

    if (!studyLibraryData) {
        return [];
    }

    return studyLibraryData.map((data) => data.course);
};
