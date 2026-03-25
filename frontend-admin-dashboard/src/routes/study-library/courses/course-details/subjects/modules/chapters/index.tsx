import { createFileRoute } from '@tanstack/react-router';

interface ModulesSearchParams {
    courseId: string;
    levelId: string;
    subjectId: string;
    moduleId: string;
    sessionId: string;
}

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute(
    '/study-library/courses/course-details/subjects/modules/chapters/'
)({
    validateSearch: (search: Record<string, unknown>): ModulesSearchParams => {
        return {
            courseId: search.courseId as string,
            levelId: search.levelId as string,
            subjectId: search.subjectId as string,
            moduleId: search.moduleId as string,
            sessionId: search.sessionId as string,
        };
    },
});
