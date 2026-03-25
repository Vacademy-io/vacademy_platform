import { createFileRoute } from '@tanstack/react-router';

interface SubjectSearchParams {
    courseId: string;
    levelId: string;
    subjectId: string;
    sessionId: string;
}

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/study-library/courses/course-details/subjects/modules/')({
    validateSearch: (search: Record<string, unknown>): SubjectSearchParams => {
        return {
            courseId: search.courseId as string,
            levelId: search.levelId as string,
            subjectId: search.subjectId as string,
            sessionId: search.sessionId as string,
        };
    },
});
