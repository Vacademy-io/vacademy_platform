import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { CourseMaterial } from "@/routes/study-library/courses/-components/course-material";
import { InitStudyLibraryProvider } from "@/providers/study-library/init-study-library-provider";
import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet";

export const Route = createFileRoute("/study-library/courses/")({
    component: RouteComponent,
});

function RouteComponent() {
    return (
        <LayoutContainer>
            <Helmet>
                <title>Study Library</title>
                <meta
                    name="description"
                    content="This page shows the study library of the institute."
                />
            </Helmet>
            <InitStudyLibraryProvider>
                <CourseMaterial />
            </InitStudyLibraryProvider>
        </LayoutContainer>
    );
}
