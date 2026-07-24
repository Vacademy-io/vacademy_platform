import { createFileRoute } from '@tanstack/react-router';

interface TranslationReviewSearch {
    /** Course the review screen links back to. */
    courseId?: string;
    /** Scope of the sidecar rows under review. */
    packageSessionId?: string;
    /** Target locale being reviewed. */
    locale?: string;
    /** Set when arriving from the Translate action — enables job polling. */
    jobId?: string;
}

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/study-library/courses/course-details/translation/')({
    validateSearch: (search: Record<string, unknown>): TranslationReviewSearch => ({
        courseId: typeof search.courseId === 'string' ? search.courseId : undefined,
        packageSessionId:
            typeof search.packageSessionId === 'string' ? search.packageSessionId : undefined,
        locale: typeof search.locale === 'string' ? search.locale : undefined,
        jobId: typeof search.jobId === 'string' ? search.jobId : undefined,
    }),
    // Component is defined in index.lazy.tsx
});
