import { LayoutContainer } from "@/components/common/layout-container/layout-container";
import { SubjectMaterial } from "@/components/common/study-library/level-material/subject-material/subject-material";
import { InitStudyLibraryProvider } from "@/providers/study-library/init-study-library-provider";
import { createFileRoute } from "@tanstack/react-router";
import { Helmet } from "react-helmet";

export const Route = createFileRoute("/study-library/courses/levels/subjects/")(
  {
    component: RouteComponent,
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
