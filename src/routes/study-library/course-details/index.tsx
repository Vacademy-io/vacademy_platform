import { createFileRoute } from "@tanstack/react-router";
import { CourseDetailsPage } from "./-components/course-details-page";
interface CourseSearchParams {
    courseId: string;
}

export const Route = createFileRoute("/study-library/course-details/")({
    component: CourseDetailsPage,
    validateSearch: (search: Record<string, unknown>): CourseSearchParams => {
        return {
            courseId: search.courseId as string,
        };
    },
});
