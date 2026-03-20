import { createFileRoute } from '@tanstack/react-router';

export interface StudentReportParam {
    tab?: string;
    learningTab?: string;
    courseId?: string;
    sessionId?: string;
    levelId?: string;
    fullName?: string;
    userId?: string;
}

export interface searchParams {
    studentReport: StudentReportParam | undefined;
}

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/study-library/reports/')({
    validateSearch: (search: searchParams) => ({
        studentReport: search.studentReport as StudentReportParam | undefined,
    }),
});
