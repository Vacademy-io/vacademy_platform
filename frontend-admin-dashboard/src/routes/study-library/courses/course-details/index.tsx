import { createFileRoute } from '@tanstack/react-router';

interface CourseDetailsSearchParams {
    courseId: string;
    sessionId?: string;
    levelId?: string;
}

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/study-library/courses/course-details/')({
    validateSearch: (search: Record<string, unknown>): CourseDetailsSearchParams => ({
        courseId: (search.courseId as string) || '',
        sessionId: (search.sessionId as string) || undefined,
        levelId: (search.levelId as string) || undefined,
    }),
});
