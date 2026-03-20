// routes/study-library/$class/$subject/index.tsx
import { createFileRoute } from '@tanstack/react-router';

interface LevelSearchParams {
    courseId: string;
    levelId: string;
}

// Route definition only - component is lazy loaded from index.lazy.tsx
export const Route = createFileRoute('/study-library/courses/course-details/subjects/')({
    validateSearch: (search: Record<string, unknown>): LevelSearchParams => {
        return {
            courseId: search.courseId as string,
            levelId: search.levelId as string,
        };
    },
});
