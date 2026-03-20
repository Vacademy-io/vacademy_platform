import { createFileRoute } from '@tanstack/react-router';

interface ChapterSearchParams {
    courseId: string;
    levelId: string;
    subjectId: string;
    moduleId: string;
    chapterId: string;
    slideId: string;
    sessionId: string;
    timestamp?: number;
    currentPage?: number;
    quickAdd?: boolean;
}

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute(
    '/study-library/courses/course-details/subjects/modules/chapters/slides/'
)({
    validateSearch: (search: Record<string, unknown>): ChapterSearchParams => {
        return {
            courseId: search.courseId as string,
            levelId: search.levelId as string,
            subjectId: search.subjectId as string,
            moduleId: search.moduleId as string,
            chapterId: search.chapterId as string,
            slideId: search.slideId as string,
            sessionId: search.sessionId as string,
            ...(typeof search.timestamp === 'number' && { timestamp: search.timestamp }),
            ...(typeof search.currentPage === 'number' && { currentPage: search.currentPage }),
            ...(typeof search.quickAdd === 'boolean' && { quickAdd: search.quickAdd }),
        };
    },
});
