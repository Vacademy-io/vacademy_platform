// stores/study-library/useStudyLibraryStore.ts
import { SessionType } from '@/schemas/student/student-list/institute-schema';
import { create } from 'zustand';

export interface CourseType {
    id: string;
    package_name: string;
    thumbnail_file_id: string;
    status: string;
}

export type StudyLibrarySessionType = SessionType;

export interface SubjectType {
    id: string;
    subject_name: string;
    subject_code: string;
    credit: number;
    thumbnail_id: string | null;
    created_at: string | null;
    updated_at: string | null;
    subject_order?: number;
}

export interface LevelWithDetailsType {
    id: string;
    name: string;
    duration_in_days: number;
    subjects: SubjectType[];
}

export interface SessionWithLevelsType {
    session_dto: StudyLibrarySessionType;
    level_with_details: LevelWithDetailsType[];
}

export interface CourseWithSessionsType {
    course: CourseType;
    sessions: SessionWithLevelsType[];
}

interface StudyLibraryStore {
    studyLibraryData: CourseWithSessionsType[] | null;
    setStudyLibraryData: (data: CourseWithSessionsType[]) => void;
    resetStudyLibraryStore: () => void;
    getSessionsByCourseLevelSubject: (params: {
        courseId: string;
        levelId: string;
        subjectId: string;
    }) => Array<{ id: string; name: string }>;
}

export const useStudyLibraryStore = create<StudyLibraryStore>((set, get) => ({
    studyLibraryData: null,
    setStudyLibraryData: (data) => set({ studyLibraryData: data }),
    resetStudyLibraryStore: () => set({ studyLibraryData: null }),
    getSessionsByCourseLevelSubject: (params) => {
        const { studyLibraryData } = get();
        if (!studyLibraryData) return [];

        // Find the course
        const course = studyLibraryData.find((c) => c.course.id === params.courseId);
        if (!course) return [];

        // Find sessions that have the specified level and subject
        const matchingSessions = course.sessions.filter((session) => {
            // Check if any level in this session matches the levelId and contains the subjectId
            return session.level_with_details.some(
                (level) =>
                    level.id === params.levelId &&
                    level.subjects.some((subject) => subject.id === params.subjectId)
            );
        });

        // Map to the required format
        return matchingSessions.map((session) => ({
            id: session.session_dto.id,
            name: session.session_dto.session_name,
        }));
    },
}));
