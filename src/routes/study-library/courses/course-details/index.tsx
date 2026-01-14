import { createFileRoute } from "@tanstack/react-router";
import { CourseDetailsPage } from "./-components/course-details-page";
import { LayoutContainer } from "@/components/common/layout-container/layout-container";
interface CourseSearchParams {
    courseId: string;
    packageSessionId?: string;
    selectedTab?: string;
    percentageCompleted?: number;
}

export const Route = createFileRoute("/study-library/courses/course-details/")({
    component: () => (
        <LayoutContainer>
            <CourseDetailsPage />
        </LayoutContainer>
    ),
    validateSearch: (search: Record<string, unknown>): CourseSearchParams => {
        const s = search as { [k: string]: unknown };
        const rawPct = s["percentageCompleted"] ?? s["percentage_completed"];
        const parsedPct =
            typeof rawPct === "string"
                ? Number(rawPct)
                : typeof rawPct === "number"
                ? rawPct
                : undefined;
        return {
            courseId: search.courseId as string,
            packageSessionId: search.packageSessionId as string,
            selectedTab: search.selectedTab as string,
            percentageCompleted:
                typeof parsedPct === "number" && Number.isFinite(parsedPct) ? parsedPct : undefined,
        };
    },
});
