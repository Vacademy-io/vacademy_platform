// utils/study-library/getSubjectName.ts
import { useStudyLibraryStore } from "@/stores/study-library/use-study-library-store";

export const getSubjectName = (subjectId: string): string => {
    const studyLibraryData = useStudyLibraryStore.getState().studyLibraryData;

    if (!studyLibraryData) {
        return "";
    }

    // Search through all courses, sessions, and levels to find the subject
    for (const courseData of studyLibraryData) {
        for (const session of courseData.sessions) {
            for (const level of session.level_with_details) {
                const subject = level.subjects.find((subject) => subject.id === subjectId);

                if (subject) {
                    return subject.subject_name;
                }
            }
        }
    }

    return "";
};
