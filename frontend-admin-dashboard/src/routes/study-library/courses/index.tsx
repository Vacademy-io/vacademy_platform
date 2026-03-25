import { createFileRoute } from '@tanstack/react-router';

interface CourseSearchParams {
    selectedTab?: 'AuthoredCourses' | 'AllCourses' | 'CourseInReview' | 'CourseApproval';
}

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/study-library/courses/')({
    validateSearch: (search: Record<string, unknown>): CourseSearchParams => ({
        selectedTab: (search.selectedTab as CourseSearchParams['selectedTab']) || undefined,
    }),
});
