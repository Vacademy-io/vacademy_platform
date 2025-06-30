import { createFileRoute } from "@tanstack/react-router";
import { CourseDetailsPage } from "./-components/course-details-page";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
interface CourseSearchParams {
    courseId: string;
}

export const Route = createFileRoute("/study-library/course-details/")({
    component: () => (
        <LayoutContainer>
            <CourseDetailsPage />
        </LayoutContainer>
    ),
    validateSearch: (search: Record<string, unknown>): CourseSearchParams => {
        return {
            courseId: search.courseId as string,
        };
    },
});
