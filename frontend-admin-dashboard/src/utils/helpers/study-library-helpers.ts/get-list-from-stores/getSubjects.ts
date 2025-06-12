// utils/study-library/getCourseSubjects.ts
import { useStudyLibraryStore, SubjectType } from "@/stores/study-library/use-study-library-store";

export const getCourseSubjects = (
    courseId: string,
    sessionId: string,
    levelId: string,
): SubjectType[] => {
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

    const level = session.level_with_details.find((level) => level.id === levelId);

    if (!level) {
        return [];
    }

    return level.subjects;
};
