import { createFileRoute } from '@tanstack/react-router';

interface CourseDetailsSearchParams {
    courseId: string;
    sessionId?: string;
    levelId?: string;
    // Content-structure drill position. Persisted in the URL so the browser/app
    // back button steps Subject → Module → Chapter, and returning from the slides
    // view restores the exact level the user was on.
    navLevel?: 'modules' | 'chapters';
    navSubjectId?: string;
    navModuleId?: string;
}

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/study-library/courses/course-details/')({
    validateSearch: (search: Record<string, unknown>): CourseDetailsSearchParams => ({
        courseId: (search.courseId as string) || '',
        sessionId: (search.sessionId as string) || undefined,
        levelId: (search.levelId as string) || undefined,
        navLevel:
            search.navLevel === 'modules' || search.navLevel === 'chapters'
                ? (search.navLevel as 'modules' | 'chapters')
                : undefined,
        navSubjectId: (search.navSubjectId as string) || undefined,
        navModuleId: (search.navModuleId as string) || undefined,
    }),
});
