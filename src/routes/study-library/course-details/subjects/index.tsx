import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { SubjectMaterial } from "@/components/common/study-library/level-material/subject-material/subject-material";
import { InitStudyLibraryProvider } from "@/providers/study-library/init-study-library-provider";
import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet";

interface LevelSearchParams {
    courseId: string;
    levelId: string;
}

export const Route = createFileRoute("/study-library/course-details/subjects/")(
    {
        component: RouteComponent,
        validateSearch: (
            search: Record<string, unknown>
        ): LevelSearchParams => {
            return {
                courseId: search.courseId as string,
                levelId: search.levelId as string,
            };
        },
    }
);

function RouteComponent() {
    return (
        <LayoutContainer>
            <Helmet>
                <title>Learning Center</title>
                <meta name="description" content="Learning Center page" />
            </Helmet>
            <InitStudyLibraryProvider>
                <SubjectMaterial />
            </InitStudyLibraryProvider>
        </LayoutContainer>
    );
}
