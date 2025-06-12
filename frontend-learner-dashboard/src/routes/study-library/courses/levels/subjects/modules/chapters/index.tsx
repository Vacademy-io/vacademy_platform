import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LayoutContainer } from '@/components/common/layout-container/layout-container'
import { ChapterMaterial } from '@/components/common/study-library/level-material/subject-material/module-material/chapter-material/chapter-material'
import { useEffect, useState } from 'react'
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore'
import { getSubjectName } from '@/utils/study-library/get-name-by-id/getSubjectNameById'
import { CaretLeft } from 'phosphor-react'
import { ChapterSidebarComponent } from '@/components/common/study-library/level-material/subject-material/module-material/chapter-material/chapter-sidebar-component'
import { InitStudyLibraryProvider } from '@/providers/study-library/init-study-library-provider'
import { ModulesWithChaptersProvider } from '@/providers/study-library/modules-with-chapters-provider'
import { useContentStore } from '@/stores/study-library/chapter-sidebar-store'
import { useQueryClient } from '@tanstack/react-query'

interface ModulesSearchParams {
  subjectId: string
  moduleId: string
}

export const Route = createFileRoute(
  '/study-library/courses/levels/subjects/modules/chapters/',
)({
  component: ModuleMaterialPage,
  validateSearch: (search: Record<string, unknown>): ModulesSearchParams => {
    return {
      subjectId: search.subjectId as string,
      moduleId: search.moduleId as string,
    }
  },
})

function ModuleMaterialPage() {
  const navigate = useNavigate();
  const { subjectId, moduleId } = Route.useSearch();
  const [currentModuleId, setCurrentModuleId] = useState(moduleId);
  const { setNavHeading } = useNavHeadingStore();
  const { setActiveItem } = useContentStore();

  const queryClient = useQueryClient(); // Get the queryClient instance

  const invalidateModulesQuery = () => {
    queryClient.invalidateQueries({
      queryKey: ["GET_MODULES_WITH_CHAPTERS", subjectId],
    });
  };

  useEffect(() => {
    setActiveItem(null);
    invalidateModulesQuery()
  }, [])

  useEffect(() => {
    navigate({
      to: "/study-library/courses/levels/subjects/modules/chapters",
      search: {
        subjectId,
        moduleId: currentModuleId,
      },
      replace: true,
    });
  }, [currentModuleId, subjectId]);

  // Module page heading
  const subjectName = getSubjectName(subjectId);

  const handleBackClick = () => {
    navigate({
      to: `/study-library/courses/levels/subjects/modules`,
      search: {
        subjectId,
      },
    });
  };

  const heading = (
    <div className="flex items-center gap-4">
      <CaretLeft onClick={handleBackClick} className="cursor-pointer" />
      <div>{`${subjectName}`}</div>
    </div>
  );

  useEffect(() => {
    setNavHeading(heading);
  }, []);

  return (
    <LayoutContainer sidebarComponent={<ChapterSidebarComponent
      currentModuleId={currentModuleId}
      setCurrentModuleId={setCurrentModuleId}
    />}>
      <InitStudyLibraryProvider>
        <ModulesWithChaptersProvider subjectId={subjectId}>
          <ChapterMaterial currentModuleId={currentModuleId} />
        </ModulesWithChaptersProvider>
      </InitStudyLibraryProvider>
    </LayoutContainer>
  )
}
