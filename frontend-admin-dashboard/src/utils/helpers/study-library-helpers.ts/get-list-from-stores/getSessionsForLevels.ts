// utils/study-library/getCourseSessions.ts
import {
    useStudyLibraryStore,
    StudyLibrarySessionType,
} from "@/stores/study-library/use-study-library-store";

export const getCourseSessions = (courseId: string): StudyLibrarySessionType[] => {
    const studyLibraryData = useStudyLibraryStore.getState().studyLibraryData;

    if (!studyLibraryData) {
        return [];
    }

    const course = studyLibraryData.find((courseData) => courseData.course.id === courseId);

    if (!course) {
        return [];
    }

    return course.sessions.map((session) => session.session_dto);
};
