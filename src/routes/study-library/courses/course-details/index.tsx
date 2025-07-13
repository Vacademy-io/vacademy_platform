import { createFileRoute } from "@tanstack/react-router";
import { CourseDetailsPage } from "./-components/course-details-page";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
interface CourseSearchParams {
    courseId: string;
    selectedTab?: string;
}

export const Route = createFileRoute("/study-library/courses/course-details/")({
    component: () => (
        <LayoutContainer>
            <CourseDetailsPage />
        </LayoutContainer>
    ),
    validateSearch: (search: Record<string, unknown>): CourseSearchParams => {
        return {
            courseId: search.courseId as string,
            selectedTab: search.selectedTab as string,
        };
    },
});
