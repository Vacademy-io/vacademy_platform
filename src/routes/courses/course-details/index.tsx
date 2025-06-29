import { createFileRoute } from "@tanstack/react-router";
import { CourseDetailsPage } from "./-components/course-details-page";
interface CourseSearchParams {
    courseId: string;
    instituteId: string;
}

export const Route = createFileRoute("/courses/course-details/")({
    component: CourseDetailsPage,
    validateSearch: (search: Record<string, unknown>): CourseSearchParams => {
        return {
            courseId: search.courseId as string,
            instituteId: search.instituteId as string,
        };
    },
});
