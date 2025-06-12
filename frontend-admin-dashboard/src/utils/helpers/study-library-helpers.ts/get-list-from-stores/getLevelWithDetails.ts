// utils/study-library/getCourseLevels.ts
import {
    useStudyLibraryStore,
    LevelWithDetailsType,
} from "@/stores/study-library/use-study-library-store";

export const getCourseLevels = (courseId: string, sessionId: string): LevelWithDetailsType[] => {
    const studyLibraryData = useStudyLibraryStore.getState().studyLibraryData;

    if (!studyLibraryData) {
        return [];
    }

    const course = studyLibraryData.find((courseData) => courseData.course.id === courseId);

    if (!course) {
        return [];
    }

    const session = course.sessions.find((session) => session.session_dto.id === sessionId);

    if (!session) {
        return [];
    }

    return session.level_with_details;
};
